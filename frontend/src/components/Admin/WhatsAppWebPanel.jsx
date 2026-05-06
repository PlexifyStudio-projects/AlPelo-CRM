import { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

/**
 * WhatsApp Web (Baileys) settings panel.
 *
 * Lets the admin:
 *  - Switch transport mode between Meta (official) and Web (non-official)
 *  - Accept the disclaimer (required before activating Web)
 *  - Generate/refresh QR to pair the personal phone
 *  - View current status, paired phone, warm-up phase, daily limit, sent today
 *  - Tune pacing (delay between messages) and daily limit
 *  - Disconnect / logout (wipes Baileys credentials so a new QR is required)
 */
export default function WhatsAppWebPanel({ b, onModeChange }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/wa-web/sessions/status`, { credentials: 'include' });
      if (!res.ok) {
        setStatus(null);
        return;
      }
      const data = await res.json();
      setStatus(data);
      if (typeof onModeChange === 'function') onModeChange(data.wa_mode);
    } catch (e) {
      console.error('[WaWeb] status fetch error', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Poll status while QR is pending or connecting
  useEffect(() => {
    const phase = status?.db_status;
    const remoteState = status?.remote?.state;
    const needsPolling = ['qr', 'connecting'].includes(phase) || ['qr', 'connecting'].includes(remoteState);
    if (needsPolling) {
      pollRef.current = setInterval(fetchStatus, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [status?.db_status, status?.remote?.state]);

  const setMode = async (mode) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/wa-web/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wa_mode: mode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo cambiar el modo');
      }
      await fetchStatus();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const acceptDisclaimer = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/wa-web/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept_disclaimer: true, wa_mode: 'web' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.detail
          || (res.status === 404
            ? 'El backend de WhatsApp Web no esta disponible. Verifique que el deploy del backend incluya las rutas /wa-web/.'
            : res.status === 401
              ? 'Sesion expirada. Inicie sesion de nuevo.'
              : `Error ${res.status} al activar el modo Web.`);
        throw new Error(msg);
      }
      setShowDisclaimer(false);
      await fetchStatus();
    } catch (e) {
      // Surface the error so the user sees what's wrong instead of a frozen button.
      setError(e.message || 'No se pudo activar el modo Web. Intente de nuevo.');
      console.error('[WaWeb] acceptDisclaimer error', e);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    if (!status?.disclaimer_accepted_at) {
      setShowDisclaimer(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/wa-web/sessions/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo iniciar la sesion');
      }
      await fetchStatus();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async (logout = false) => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/wa-web/sessions/disconnect`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logout }),
      });
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const updateLimits = async (patch) => {
    try {
      await fetch(`${API_URL}/wa-web/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchStatus();
    } catch (e) {
      setError(e.message);
    }
  };

  const enrichContacts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/wa-web/enrich-contacts`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo iniciar el sync de contactos');
      }
      if (data.queued === 0) {
        setError(data.message || 'Todos los contactos ya tienen nombre + foto');
      } else {
        setError(`Sincronizando ${data.queued} contactos en segundo plano (~${data.estimated_seconds}s). Recarga el inbox en un minuto.`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const dedupeConvs = async () => {
    if (!window.confirm('¿Unificar los chats duplicados que tengan el mismo número? Se mueven los mensajes al chat principal y se borran los vacíos.')) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/wa-web/dedupe-conversations`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'No se pudo unificar');
      if (data.groups_merged === 0) {
        setError('No hay chats duplicados para unificar.');
      } else {
        setError(`✓ ${data.groups_merged} grupos unificados. ${data.messages_moved} mensajes movidos, ${data.duplicates_deleted} chats vacíos borrados.`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const purgeChats = async (scope = 'all') => {
    const msg = scope === 'current'
      ? '¿Borrar TODOS los chats Web del numero conectado actualmente? No se puede deshacer.'
      : '¿Borrar TODOS los chats Web del tenant (de todos los numeros que se hayan conectado)? No se puede deshacer.';
    if (!window.confirm(msg)) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/wa-web/purge-chats`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo borrar');
      }
      setError(`Borrados: ${data.deleted_convs} chats / ${data.deleted_messages} mensajes. Recarga el inbox.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const isWebMode = status?.wa_mode === 'web';
  const dbStatus = status?.db_status || 'disconnected';
  const remote = status?.remote || {};
  const qrUrl = remote.qr || null;
  const connected = dbStatus === 'connected';
  const banned = dbStatus === 'banned';

  const statusLabel = banned
    ? 'Numero baneado por WhatsApp'
    : connected
      ? `Conectado: ${status?.phone || 'numero pendiente'}`
      : dbStatus === 'qr'
        ? 'Escaneando codigo QR...'
        : dbStatus === 'connecting'
          ? 'Conectando...'
          : 'Desconectado';

  const statusColor = banned ? '#DC2626' : connected ? '#16A34A' : dbStatus === 'qr' || dbStatus === 'connecting' ? '#F59E0B' : '#94A3B8';

  return (
    <div className={`${b}__waweb`}>
      {/* Mode tabs ------------------------------------------------------ */}
      <div className={`${b}__waweb-tabs`}>
        <button
          type="button"
          className={`${b}__waweb-tab ${!isWebMode ? `${b}__waweb-tab--active` : ''}`}
          onClick={() => setMode('meta')}
          disabled={loading || !isWebMode}
        >
          <span className={`${b}__waweb-tab-title`}>Oficial (Meta)</span>
          <span className={`${b}__waweb-tab-sub`}>Cloud API certificada — paga por mensaje</span>
        </button>
        <button
          type="button"
          className={`${b}__waweb-tab ${isWebMode ? `${b}__waweb-tab--active` : ''}`}
          onClick={() => (isWebMode ? null : status?.disclaimer_accepted_at ? setMode('web') : setShowDisclaimer(true))}
          disabled={loading || isWebMode}
        >
          <span className={`${b}__waweb-tab-title`}>Numero personal (Web)</span>
          <span className={`${b}__waweb-tab-sub`}>Conecta tu WhatsApp como WhatsApp Web — sin costo por mensaje</span>
        </button>
      </div>

      {/* Disclaimer modal --------------------------------------------- */}
      {showDisclaimer && (
        <div className={`${b}__waweb-disclaimer`}>
          <h4 className={`${b}__waweb-disclaimer-title`}>Activar modo WhatsApp Web</h4>
          <p className={`${b}__waweb-disclaimer-body`}>
            Esta opcion conecta su numero personal de WhatsApp como si lo estuviera usando en una pagina web.
            <strong> No es la API oficial de Meta.</strong> Es responsabilidad suya respetar las reglas de WhatsApp:
          </p>
          <ul className={`${b}__waweb-disclaimer-list`}>
            <li>WhatsApp puede bloquear su numero si detecta patrones automatizados o spam.</li>
            <li>El sistema enviara mensajes con pausas aleatorias y un limite diario que crece progresivamente (warm-up).</li>
            <li>Empezamos en 20 mensajes/dia. Despues de 14 dias activo, alcanza el limite que usted configure.</li>
            <li>No puede enviar plantillas de Meta — solo texto libre.</li>
            <li>Plexify Studio no se hace responsable si su numero es bloqueado.</li>
          </ul>
          {error && (
            <div className={`${b}__waweb-error`} style={{ marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div className={`${b}__waweb-disclaimer-actions`}>
            <button className={`${b}__waweb-btn ${b}__waweb-btn--ghost`} onClick={() => setShowDisclaimer(false)} disabled={loading}>
              Cancelar
            </button>
            <button className={`${b}__waweb-btn ${b}__waweb-btn--primary`} onClick={acceptDisclaimer} disabled={loading}>
              {loading ? 'Activando...' : 'Acepto y deseo activar el modo Web'}
            </button>
          </div>
        </div>
      )}

      {/* Web mode panel ----------------------------------------------- */}
      {isWebMode && !showDisclaimer && (
        <div className={`${b}__waweb-panel`}>
          {/* Status row */}
          <div className={`${b}__waweb-status`}>
            <span className={`${b}__waweb-dot`} style={{ background: statusColor }} />
            <div className={`${b}__waweb-status-info`}>
              <strong>{statusLabel}</strong>
              {connected && status?.connected_at && (
                <span className={`${b}__waweb-status-sub`}>
                  Activo desde {new Date(status.connected_at).toLocaleString('es-CO')}
                </span>
              )}
              {banned && remote?.lastError && (
                <span className={`${b}__waweb-status-sub`}>{remote.lastError}</span>
              )}
            </div>
            {!connected && !banned && (
              <button className={`${b}__waweb-btn ${b}__waweb-btn--primary`} onClick={startSession} disabled={loading}>
                {dbStatus === 'qr' || dbStatus === 'connecting' ? 'Generando QR...' : 'Generar QR'}
              </button>
            )}
            {(dbStatus === 'qr' || dbStatus === 'connecting') && !connected && (
              <button
                className={`${b}__waweb-btn ${b}__waweb-btn--ghost`}
                onClick={() => disconnect(false)}
                disabled={loading}
                title="Resetear el estado si quedo atascado"
              >
                Cancelar
              </button>
            )}
            {connected && (
              <button
                className={`${b}__waweb-btn ${b}__waweb-btn--ghost`}
                onClick={enrichContacts}
                disabled={loading}
                title="Refresca nombres + fotos desde el WhatsApp del telefono"
              >
                Sincronizar contactos
              </button>
            )}
            {connected && (
              <button
                className={`${b}__waweb-btn ${b}__waweb-btn--ghost`}
                onClick={dedupeConvs}
                disabled={loading}
                title="Unifica chats duplicados del mismo numero (e.g. uno Meta antiguo + uno Web nuevo)"
              >
                Unificar chats duplicados
              </button>
            )}
            {connected && (
              <button
                className={`${b}__waweb-btn ${b}__waweb-btn--danger`}
                onClick={() => purgeChats('all')}
                disabled={loading}
                title="Elimina TODOS los chats Web (de todos los numeros) del tenant"
              >
                Borrar todos los chats
              </button>
            )}
            {connected && (
              <button className={`${b}__waweb-btn ${b}__waweb-btn--ghost`} onClick={() => disconnect(false)} disabled={loading}>
                Pausar
              </button>
            )}
            {(connected || banned) && (
              <button className={`${b}__waweb-btn ${b}__waweb-btn--danger`} onClick={() => disconnect(true)} disabled={loading}>
                Desconectar
              </button>
            )}
          </div>

          {error && <div className={`${b}__waweb-error`}>{error}</div>}

          {/* QR display */}
          {qrUrl && !connected && (
            <div className={`${b}__waweb-qr-wrap`}>
              <img src={qrUrl} alt="WhatsApp Web QR" className={`${b}__waweb-qr`} />
              <div className={`${b}__waweb-qr-instructions`}>
                <h4>Escanee el codigo</h4>
                <ol>
                  <li>Abra <strong>WhatsApp</strong> en su telefono.</li>
                  <li>Vaya a <strong>Configuracion &rarr; Dispositivos vinculados &rarr; Vincular un dispositivo</strong>.</li>
                  <li>Apunte la camara a este codigo.</li>
                </ol>
                <p className={`${b}__waweb-qr-hint`}>
                  El codigo expira en pocos segundos. Si tarda, regeneramos uno nuevo automaticamente.
                </p>
              </div>
            </div>
          )}

          {/* Stats grid */}
          {connected && (
            <div className={`${b}__waweb-stats`}>
              <div className={`${b}__waweb-stat`}>
                <span className={`${b}__waweb-stat-label`}>Enviados hoy</span>
                <span className={`${b}__waweb-stat-value`}>
                  {status?.sent_today ?? 0}
                  <span className={`${b}__waweb-stat-cap`}>/ {status?.daily_limit ?? '-'}</span>
                </span>
              </div>
              <div className={`${b}__waweb-stat`}>
                <span className={`${b}__waweb-stat-label`}>Warm-up</span>
                <span className={`${b}__waweb-stat-value`}>
                  {(() => {
                    if (!status?.warmup_started_at) return 'Pendiente';
                    const days = Math.floor((Date.now() - new Date(status.warmup_started_at).getTime()) / 86400000);
                    if (days < 3) return `Dia ${days + 1} — fase 1`;
                    if (days < 7) return `Dia ${days + 1} — fase 2`;
                    if (days < 14) return `Dia ${days + 1} — fase 3`;
                    return 'Calentado';
                  })()}
                </span>
              </div>
              <div className={`${b}__waweb-stat`}>
                <span className={`${b}__waweb-stat-label`}>Pausa entre msgs</span>
                <span className={`${b}__waweb-stat-value`}>
                  {(status?.pacing_seconds || [30, 90])[0]}s &mdash; {(status?.pacing_seconds || [30, 90])[1]}s
                </span>
              </div>
            </div>
          )}

          {/* Capacity presets — WhatsApp Web no expone tu límite real, así que el dueño elige */}
          {connected && (
            <>
              <div className={`${b}__waweb-presets-intro`}>
                <strong>Capacidad de envío diario</strong>
                <p>
                  WhatsApp <em>no expone</em> tu límite real en modo Web. Estos presets son
                  recomendaciones probadas. Empieza Conservador y sube solo si tu número
                  ya tiene historial y nunca ha sido reportado.
                </p>
              </div>
              <div className={`${b}__waweb-presets`}>
                {[
                  {
                    id: 'conservative',
                    label: 'Conservador',
                    desc: 'Recomendado para números nuevos',
                    cap: 80, pmin: 60, pmax: 180,
                    color: '#10B981',
                  },
                  {
                    id: 'moderate',
                    label: 'Moderado',
                    desc: 'Números con uso normal previo',
                    cap: 120, pmin: 30, pmax: 90,
                    color: '#3B82F6',
                  },
                  {
                    id: 'aggressive',
                    label: 'Agresivo',
                    desc: 'Solo números business antiguos',
                    cap: 200, pmin: 20, pmax: 60,
                    color: '#F59E0B',
                  },
                ].map(p => {
                  const active = (status?.daily_limit || 20) === p.cap
                              && (status?.pacing_seconds || [30,90])[0] === p.pmin
                              && (status?.pacing_seconds || [30,90])[1] === p.pmax;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`${b}__waweb-preset ${active ? `${b}__waweb-preset--active` : ''}`}
                      style={active ? { borderColor: p.color, boxShadow: `0 0 0 3px ${p.color}22` } : {}}
                      onClick={() => updateLimits({
                        daily_limit: p.cap,
                        pacing_min_seconds: p.pmin,
                        pacing_max_seconds: p.pmax,
                      })}
                    >
                      <span className={`${b}__waweb-preset-label`} style={{ color: p.color }}>{p.label}</span>
                      <span className={`${b}__waweb-preset-cap`}>{p.cap} msgs/día</span>
                      <span className={`${b}__waweb-preset-pacing`}>Pausa {p.pmin}–{p.pmax}s</span>
                      <span className={`${b}__waweb-preset-desc`}>{p.desc}</span>
                    </button>
                  );
                })}
              </div>

              <details className={`${b}__waweb-custom`}>
                <summary>Personalizar manualmente</summary>
                <div className={`${b}__waweb-controls`}>
                  <label className={`${b}__waweb-control`}>
                    <span>Limite diario maximo</span>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      value={status?.daily_limit || 20}
                      onChange={(e) => updateLimits({ daily_limit: parseInt(e.target.value, 10) || 20 })}
                    />
                  </label>
                  <label className={`${b}__waweb-control`}>
                    <span>Pausa minima (segundos)</span>
                    <input
                      type="number"
                      min={10}
                      max={600}
                      value={(status?.pacing_seconds || [30, 90])[0]}
                      onChange={(e) => updateLimits({ pacing_min_seconds: parseInt(e.target.value, 10) || 30 })}
                    />
                  </label>
                  <label className={`${b}__waweb-control`}>
                    <span>Pausa maxima (segundos)</span>
                    <input
                      type="number"
                      min={10}
                      max={600}
                      value={(status?.pacing_seconds || [30, 90])[1]}
                      onChange={(e) => updateLimits({ pacing_max_seconds: parseInt(e.target.value, 10) || 90 })}
                    />
                  </label>
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}
