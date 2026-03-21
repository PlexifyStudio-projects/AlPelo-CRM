import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Card from '../../components/common/Card/Card';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import aiService from '../../services/aiService';
import settingsService from '../../services/settingsService';

// Model is managed by Plexify (dev), not by the agency admin

const DEFAULT_FIELDS = {
  nombre: '',
  ubicacion: '',
  tipo: '',
  horario_lv: '9:00am - 7:00pm',
  horario_sab: '9:00am - 5:00pm',
  horario_dom: 'CERRADO',
  fuera_horario: 'Lina responde preguntas y agenda citas, pero informa el horario si preguntan.',
  tono: 'Calido y cercano',
  trato: 'Tutea',
  largo_mensajes: 'Maximo 2-3 lineas por mensaje',
  emojis: '1 emoji si aporta',
  expresiones: '',
  pagos: '',
  cancelaciones: '',
  reservas: '',
  notas: '',
};

function parsePromptToFields(prompt) {
  if (!prompt) return { ...DEFAULT_FIELDS };
  const f = { ...DEFAULT_FIELDS };
  const get = (label) => {
    const re = new RegExp(`${label}:\\s*(.+)`, 'i');
    const m = prompt.match(re);
    return m ? m[1].trim() : '';
  };
  f.nombre = get('Nombre');
  f.ubicacion = get('Ubicacion');
  f.tipo = get('Tipo');
  f.horario_lv = get('Lunes a Viernes') || f.horario_lv;
  f.horario_sab = get('Sabado') || f.horario_sab;
  f.horario_dom = get('Domingo') || f.horario_dom;
  f.fuera_horario = get('Fuera de horario') || f.fuera_horario;
  f.tono = get('Tono') || f.tono;
  f.trato = get('Tutea o trata de usted') || get('Trato') || f.trato;
  f.largo_mensajes = get('Largo de mensajes') || f.largo_mensajes;
  f.emojis = get('Emojis') || f.emojis;
  f.expresiones = get('Expresiones tipicas') || '';
  f.pagos = get('Pagos') || '';
  f.cancelaciones = get('Cancelaciones') || '';
  f.reservas = get('Reservas') || '';
  const notasMatch = prompt.match(/=== NOTAS ADICIONALES ===\s*([\s\S]*?)$/i);
  f.notas = notasMatch ? notasMatch[1].trim() : '';
  return f;
}

function fieldsToPrompt(f) {
  let prompt = `=== DATOS DEL NEGOCIO ===
Nombre: ${f.nombre}
Ubicacion: ${f.ubicacion}
Tipo: ${f.tipo}

=== HORARIO ===
Lunes a Viernes: ${f.horario_lv}
Sabado: ${f.horario_sab}
Domingo: ${f.horario_dom}
Fuera de horario: ${f.fuera_horario}

=== ESTILO DE COMUNICACION ===
Tono: ${f.tono}
Tutea o trata de usted: ${f.trato}
Largo de mensajes: ${f.largo_mensajes}
Emojis: ${f.emojis}`;
  if (f.expresiones) prompt += `\nExpresiones tipicas: ${f.expresiones}`;
  prompt += `\n\n=== POLITICAS ===
Pagos: ${f.pagos}
Cancelaciones: ${f.cancelaciones}
Reservas: ${f.reservas}`;
  if (f.notas) prompt += `\n\n=== NOTAS ADICIONALES ===\n${f.notas}`;
  return prompt;
}

const Settings = () => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();

  const [aiConfig, setAiConfig] = useState(null);
  const [fields, setFields] = useState({ ...DEFAULT_FIELDS });
  const [aiSaving, setAiSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadAiConfig();
  }, []);

  const loadAiConfig = async () => {
    try {
      const config = await aiService.getConfig();
      setAiConfig(config);
      setFields(parsePromptToFields(config.system_prompt));
    } catch {
      // No config yet
    }
  };

  const updateField = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleTestAI = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const start = Date.now();
      const result = await aiService.chat('Responde SOLO con "OK, funcionando correctamente" y nada mas.', []);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      setTestResult({ ok: true, msg: `${result.response} (${elapsed}s, ${result.tokens_used} tokens)` });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAiConfig = useCallback(async () => {
    setAiSaving(true);
    try {
      const data = {
        name: 'Lina IA',
        system_prompt: fieldsToPrompt(fields),
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        temperature: 0.4,
        max_tokens: 2048,
      };

      let result;
      if (aiConfig?.id) {
        result = await aiService.updateConfig(aiConfig.id, data);
      } else {
        result = await aiService.saveConfig(data);
      }
      setAiConfig(result);
      addNotification('Configuracion de Lina guardada', 'success');
    } catch (err) {
      addNotification(`Error al guardar: ${err.message}`, 'error');
    } finally {
      setAiSaving(false);
    }
  }, [fields, aiConfig, addNotification]);

  const [notifPrefs, setNotifPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('plexify_notif_prefs') || '{}'); } catch { return {}; }
  });

  const handleToggle = (key) => {
    setNotifPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('plexify_notif_prefs', JSON.stringify(updated));
      return updated;
    });
  };

  // Meta token management
  const [metaToken, setMetaToken] = useState('');
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaBizId, setMetaBizId] = useState('');
  const [metaStatus, setMetaStatus] = useState(null);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaChecking, setMetaChecking] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [metaTemplates, setMetaTemplates] = useState(null);
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (tenant?.wa_access_token) setMetaToken(tenant.wa_access_token);
    if (tenant?.wa_phone_number_id) setMetaPhoneId(tenant.wa_phone_number_id);
    if (tenant?.wa_business_account_id) setMetaBizId(tenant.wa_business_account_id);
  }, [tenant]);

  useEffect(() => {
    settingsService.getMetaTokenStatus().then(setMetaStatus).catch(() => {});
  }, []);

  // OAuth popup flow — uses postMessage from callback page (works cross-origin)
  const handleFacebookLogin = async () => {
    setOauthLoading(true);
    try {
      const { url } = await settingsService.getMetaAuthUrl();

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        url,
        'fb_oauth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );
      popupRef.current = popup;

      // Listen for postMessage from the callback page
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'META_OAUTH_CODE' && event.data.code) {
          window.removeEventListener('message', messageHandler);
          clearInterval(pollRef.current);
          handleExchangeToken(event.data.code);
        }
      };
      window.addEventListener('message', messageHandler);

      // Fallback: detect if popup was closed without completing
      pollRef.current = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(pollRef.current);
          window.removeEventListener('message', messageHandler);
          setOauthLoading(false);
        }
      }, 1000);
    } catch (err) {
      setOauthLoading(false);
      addNotification(err.message, 'error');
    }
  };

  const handleExchangeToken = async (code) => {
    try {
      const result = await settingsService.exchangeMetaToken(code);
      if (result.success) {
        setMetaStatus({
          connected: true,
          phone_display: result.phone_display,
          phone_number_id: result.phone_number_id,
          business_account_id: result.business_account_id,
          expires_at: result.expires_at,
          days_until_expiry: result.expires_in ? Math.floor(result.expires_in / 86400) : null,
        });
        if (result.phone_number_id) setMetaPhoneId(result.phone_number_id);
        if (result.business_account_id) setMetaBizId(result.business_account_id);
        addNotification('Conectado con Facebook exitosamente', 'success');
        loadMetaTemplates();
      }
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setOauthLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const result = await settingsService.refreshMetaToken();
      if (result.success) {
        setMetaStatus(prev => ({
          ...prev,
          expires_at: result.expires_at,
          days_until_expiry: result.expires_in ? Math.floor(result.expires_in / 86400) : null,
        }));
        addNotification('Token renovado exitosamente', 'success');
      }
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await settingsService.disconnectMeta();
      setMetaStatus({ connected: false });
      setMetaToken('');
      setMetaPhoneId('');
      setMetaBizId('');
      setMetaTemplates(null);
      setShowDisconnectModal(false);
      addNotification('Cuenta de Meta desconectada', 'info');
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  // Cleanup popup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
  }, []);

  const handleSaveToken = async () => {
    if (!metaToken.trim()) return;
    setMetaSaving(true);
    try {
      const result = await settingsService.updateMetaToken({
        wa_access_token: metaToken.trim(),
        wa_phone_number_id: metaPhoneId.trim(),
        wa_business_account_id: metaBizId.trim(),
      });
      setMetaStatus({ connected: result.verified, phone_display: result.phone_display });
      addNotification(result.message, result.verified ? 'success' : 'warning');
      loadMetaTemplates();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setMetaSaving(false);
    }
  };

  const handleCheckStatus = async () => {
    setMetaChecking(true);
    try {
      const status = await settingsService.getMetaTokenStatus();
      setMetaStatus(status);
      addNotification(status.connected ? 'Token valido — conexion activa' : `Token invalido: ${status.message}`, status.connected ? 'success' : 'error');
    } catch {
      addNotification('Error al verificar token', 'error');
    } finally {
      setMetaChecking(false);
    }
  };

  const loadMetaTemplates = async () => {
    try {
      const data = await settingsService.getMetaTemplates();
      setMetaTemplates(data);
    } catch { /* silent */ }
  };

  useEffect(() => { loadMetaTemplates(); }, []);

  const maskToken = (t) => t ? `${t.slice(0, 12)}...${t.slice(-8)}` : '';

  const formatExpiryDate = (isoString) => {
    if (!isoString) return null;
    try {
      return new Date(isoString).toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return null; }
  };

  const isTokenExpiringSoon = metaStatus?.days_until_expiry != null && metaStatus.days_until_expiry <= 7;

  const b = 'settings';

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h2 className={`${b}__title`}>Configuracion</h2>
        <p className={`${b}__subtitle`}>Personaliza como Lina atiende tu negocio</p>
      </div>

      <div className={`${b}__content`}>
        {/* ========== LINA IA CONFIG ========== */}
        <Card title="Lina IA — Contexto del negocio" className={`${b}__card ${b}__card--ai`}>
          <p className={`${b}__card-desc`}>
            Llena cada campo para que Lina conozca tu negocio a fondo. Ella ya sabe agendar citas, responder precios y manejar quejas — tu solo defines el contexto.
          </p>

          {/* DATOS DEL NEGOCIO */}
          <div className={`${b}__form-section`}>
            <h4 className={`${b}__form-section-title`}>Datos del negocio</h4>
            <div className={`${b}__form-grid`}>
              <div className={`${b}__form-field`}>
                <label>Nombre del negocio</label>
                <input type="text" value={fields.nombre} onChange={e => updateField('nombre', e.target.value)} placeholder="Ej: AlPelo Peluqueria" />
              </div>
              <div className={`${b}__form-field`}>
                <label>Ubicacion</label>
                <input type="text" value={fields.ubicacion} onChange={e => updateField('ubicacion', e.target.value)} placeholder="Ej: Cabecera, Bucaramanga, Colombia" />
              </div>
              <div className={`${b}__form-field`}>
                <label>Tipo de negocio</label>
                <input type="text" value={fields.tipo} onChange={e => updateField('tipo', e.target.value)} placeholder="Ej: Barberia, Salon de belleza, Spa, Clinica..." />
              </div>
            </div>
          </div>

          {/* HORARIO */}
          <div className={`${b}__form-section`}>
            <h4 className={`${b}__form-section-title`}>Horario de atencion</h4>
            <div className={`${b}__form-grid ${b}__form-grid--3col`}>
              <div className={`${b}__form-field`}>
                <label>Lunes a Viernes</label>
                <input type="text" value={fields.horario_lv} onChange={e => updateField('horario_lv', e.target.value)} placeholder="9:00am - 7:00pm" />
              </div>
              <div className={`${b}__form-field`}>
                <label>Sabado</label>
                <input type="text" value={fields.horario_sab} onChange={e => updateField('horario_sab', e.target.value)} placeholder="9:00am - 5:00pm" />
              </div>
              <div className={`${b}__form-field`}>
                <label>Domingo</label>
                <input type="text" value={fields.horario_dom} onChange={e => updateField('horario_dom', e.target.value)} placeholder="CERRADO" />
              </div>
            </div>
            <div className={`${b}__form-field`}>
              <label>Fuera de horario</label>
              <input type="text" value={fields.fuera_horario} onChange={e => updateField('fuera_horario', e.target.value)} placeholder="Que hace Lina fuera de horario" />
            </div>
          </div>

          {/* ESTILO */}
          <div className={`${b}__form-section`}>
            <h4 className={`${b}__form-section-title`}>Estilo de comunicacion</h4>
            <div className={`${b}__form-grid`}>
              <div className={`${b}__form-field`}>
                <label>Tono</label>
                <select value={fields.tono} onChange={e => updateField('tono', e.target.value)}>
                  <option value="Calido y cercano">Calido y cercano</option>
                  <option value="Formal y profesional">Formal y profesional</option>
                  <option value="Regional y directo">Regional y directo</option>
                  <option value="Divertido y relajado">Divertido y relajado</option>
                  <option value="Elegante y sofisticado">Elegante y sofisticado</option>
                </select>
              </div>
              <div className={`${b}__form-field`}>
                <label>Trato</label>
                <select value={fields.trato} onChange={e => updateField('trato', e.target.value)}>
                  <option value="Tutea">Tutea (tu)</option>
                  <option value="Usted">Usted</option>
                  <option value="Depende del cliente">Depende del cliente</option>
                </select>
              </div>
              <div className={`${b}__form-field`}>
                <label>Emojis</label>
                <select value={fields.emojis} onChange={e => updateField('emojis', e.target.value)}>
                  <option value="1 emoji si aporta">1 emoji si aporta</option>
                  <option value="Sin emojis">Sin emojis</option>
                  <option value="Libre">Libre</option>
                </select>
              </div>
            </div>
            <div className={`${b}__form-field`}>
              <label>Expresiones tipicas (opcional)</label>
              <input type="text" value={fields.expresiones} onChange={e => updateField('expresiones', e.target.value)} placeholder="Ej: parcero, que mas, a la orden..." />
            </div>
          </div>

          {/* POLITICAS */}
          <div className={`${b}__form-section`}>
            <h4 className={`${b}__form-section-title`}>Politicas del negocio</h4>
            <div className={`${b}__form-field`}>
              <label>Metodos de pago</label>
              <input type="text" value={fields.pagos} onChange={e => updateField('pagos', e.target.value)} placeholder="Ej: Efectivo, Nequi, Daviplata, tarjeta" />
            </div>
            <div className={`${b}__form-field`}>
              <label>Politica de cancelaciones</label>
              <input type="text" value={fields.cancelaciones} onChange={e => updateField('cancelaciones', e.target.value)} placeholder="Ej: Cancelar con minimo 2 horas de anticipacion" />
            </div>
            <div className={`${b}__form-field`}>
              <label>Reservas</label>
              <input type="text" value={fields.reservas} onChange={e => updateField('reservas', e.target.value)} placeholder="Ej: Link de reservas o instrucciones" />
            </div>
          </div>

          {/* NOTAS ADICIONALES */}
          <div className={`${b}__form-section`}>
            <h4 className={`${b}__form-section-title`}>Notas adicionales (opcional)</h4>
            <div className={`${b}__form-field`}>
              <textarea
                className={`${b}__ai-textarea`}
                value={fields.notas}
                onChange={e => updateField('notas', e.target.value)}
                placeholder="Servicios estrella, profesionales destacados, promociones activas, reglas especiales..."
                rows={4}
              />
            </div>
          </div>

          <div className={`${b}__ai-actions`}>
            <button
              className={`${b}__ai-save`}
              onClick={handleSaveAiConfig}
              disabled={aiSaving || !fields.nombre.trim()}
            >
              {aiSaving ? 'Guardando...' : aiConfig?.id ? 'Actualizar configuracion' : 'Guardar configuracion'}
            </button>
            <button
              className={`${b}__ai-test`}
              onClick={handleTestAI}
              disabled={testing}
            >
              {testing ? 'Probando...' : 'Probar Lina'}
            </button>
            {aiConfig?.updated_at && (
              <span className={`${b}__ai-last-saved`}>
                Ultima actualizacion: {new Date(aiConfig.updated_at).toLocaleDateString('es-CO')}
              </span>
            )}
          </div>
          {testResult && (
            <div className={`${b}__test-result ${testResult.ok ? `${b}__test-result--ok` : `${b}__test-result--err`}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.msg}
            </div>
          )}
        </Card>

        {/* ========== NOTIFICATIONS ========== */}
        <Card title="Notificaciones" className={`${b}__card`}>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Notificaciones de citas</span>
              <span className={`${b}__option-desc`}>Recibir alertas cuando se agende una cita</span>
            </div>
            <button className={`${b}__toggle ${notifPrefs.citas !== false ? `${b}__toggle--active` : ''}`} onClick={() => handleToggle('citas')}>
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Alertas de mensajeria</span>
              <span className={`${b}__option-desc`}>Notificar cuando se complete un envio masivo</span>
            </div>
            <button className={`${b}__toggle ${notifPrefs.mensajeria !== false ? `${b}__toggle--active` : ''}`} onClick={() => handleToggle('mensajeria')}>
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Sonidos</span>
              <span className={`${b}__option-desc`}>Reproducir sonido con las notificaciones</span>
            </div>
            <button className={`${b}__toggle ${notifPrefs.sonidos ? `${b}__toggle--active` : ''}`} onClick={() => handleToggle('sonidos')}>
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>
        </Card>

        {/* ========== META / WHATSAPP ========== */}
        <Card title="Meta / WhatsApp Business" className={`${b}__card ${b}__card--meta`}>
          {/* Token expiry warning banner */}
          {metaStatus?.connected && isTokenExpiringSoon && (
            <div className={`${b}__meta-expiry-warning`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Tu token expira en {metaStatus.days_until_expiry} dia{metaStatus.days_until_expiry !== 1 ? 's' : ''}. Renovalo para mantener la conexion activa.</span>
              <button className={`${b}__meta-expiry-renew`} onClick={handleRefreshToken} disabled={refreshing}>
                {refreshing ? 'Renovando...' : 'Renovar ahora'}
              </button>
            </div>
          )}

          {/* Status indicator */}
          <div className={`${b}__meta-status`}>
            <div className={`${b}__meta-status-dot ${metaStatus?.connected ? `${b}__meta-status-dot--on` : `${b}__meta-status-dot--off`}`} />
            <div className={`${b}__meta-status-info`}>
              <span className={`${b}__meta-status-label`}>
                {metaStatus?.connected ? 'Conectado' : 'Desconectado'}
              </span>
              <span className={`${b}__meta-status-detail`}>
                {metaStatus?.connected
                  ? `WhatsApp: ${metaStatus.phone_display || 'Activo'}`
                  : metaStatus?.message || 'Configura tu conexion con Facebook'
                }
              </span>
            </div>
            {metaStatus?.connected && (
              <span className={`${b}__meta-connected-pill`}>Conectado</span>
            )}
            <button className={`${b}__meta-check`} onClick={handleCheckStatus} disabled={metaChecking}>
              {metaChecking ? 'Verificando...' : 'Verificar conexion'}
            </button>
            {metaStatus?.connected && (
              <button className={`${b}__meta-disconnect`} onClick={() => setShowDisconnectModal(true)}>
                Desconectar
              </button>
            )}
          </div>

          {/* Token expiration info */}
          {metaStatus?.connected && metaStatus.expires_at && (
            <div className={`${b}__meta-token-info`}>
              <div className={`${b}__meta-token-info-row`}>
                <span className={`${b}__meta-token-info-label`}>Token valido hasta</span>
                <span className={`${b}__meta-token-info-date`}>
                  {formatExpiryDate(metaStatus.expires_at)}
                  {metaStatus.days_until_expiry != null && (
                    <span className={`${b}__meta-token-info-days ${isTokenExpiringSoon ? `${b}__meta-token-info-days--warning` : ''}`}>
                      ({metaStatus.days_until_expiry} dias restantes)
                    </span>
                  )}
                </span>
              </div>
              <button
                className={`${b}__meta-token-refresh`}
                onClick={handleRefreshToken}
                disabled={refreshing}
              >
                {refreshing ? 'Renovando...' : 'Renovar token'}
              </button>
            </div>
          )}

          {/* Facebook OAuth button — always visible */}
          <div className={`${b}__meta-oauth`}>
            <button
              className={`${b}__meta-fb-btn`}
              onClick={handleFacebookLogin}
              disabled={oauthLoading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {oauthLoading ? 'Conectando...' : metaStatus?.connected ? 'Reconectar con Facebook' : 'Conectar con Facebook'}
            </button>
            <p className={`${b}__meta-oauth-hint`}>
              {metaStatus?.connected
                ? 'Reconecta si necesitas actualizar permisos o cambiar de cuenta'
                : 'Conecta tu cuenta de Facebook para configurar WhatsApp Business automaticamente'}
            </p>
          </div>

          {/* Manual config accordion */}
          <div className={`${b}__meta-manual`}>
            <button
              className={`${b}__meta-manual-toggle`}
              onClick={() => setShowManualConfig(!showManualConfig)}
            >
              <svg
                className={`${b}__meta-manual-chevron ${showManualConfig ? `${b}__meta-manual-chevron--open` : ''}`}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              Configuracion manual (avanzado)
            </button>

            {showManualConfig && (
              <div className={`${b}__meta-manual-content`}>
                {/* Token input */}
                <div className={`${b}__meta-field`}>
                  <label>Token de acceso (Meta Business)</label>
                  <span className={`${b}__meta-hint`}>
                    Generalo en developers.facebook.com &rarr; Tu app &rarr; Configuracion de la API &rarr; Generar token de acceso
                  </span>
                  <div className={`${b}__meta-token-input`}>
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={metaToken}
                      onChange={e => setMetaToken(e.target.value)}
                      placeholder="EAAxxxxxxxxxxxxxxx..."
                    />
                    <button type="button" className={`${b}__meta-eye`} onClick={() => setShowToken(!showToken)}>
                      {showToken ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                </div>

                {/* Phone Number ID + Business Account ID */}
                <div className={`${b}__meta-row`}>
                  <div className={`${b}__meta-field`}>
                    <label>Phone Number ID</label>
                    <input
                      type="text"
                      value={metaPhoneId}
                      onChange={e => setMetaPhoneId(e.target.value)}
                      placeholder="Ej: 123456789012345"
                    />
                  </div>
                  <div className={`${b}__meta-field`}>
                    <label>WhatsApp Business Account ID</label>
                    <input
                      type="text"
                      value={metaBizId}
                      onChange={e => setMetaBizId(e.target.value)}
                      placeholder="Ej: 123456789012345"
                    />
                  </div>
                </div>

                <div className={`${b}__meta-actions`}>
                  <button
                    className={`${b}__ai-save`}
                    onClick={handleSaveToken}
                    disabled={metaSaving || !metaToken.trim()}
                  >
                    {metaSaving ? 'Guardando...' : 'Guardar configuracion Meta'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Approved templates from Meta */}
          {metaTemplates && metaTemplates.templates && metaTemplates.templates.length > 0 && (
            <div className={`${b}__meta-templates`}>
              <div className={`${b}__meta-templates-header`}>
                <span>Plantillas en Meta</span>
                <div className={`${b}__meta-templates-badges`}>
                  {metaTemplates.approved > 0 && <span className={`${b}__meta-badge ${b}__meta-badge--approved`}>{metaTemplates.approved} aprobadas</span>}
                  {metaTemplates.pending > 0 && <span className={`${b}__meta-badge ${b}__meta-badge--pending`}>{metaTemplates.pending} pendientes</span>}
                  {metaTemplates.rejected > 0 && <span className={`${b}__meta-badge ${b}__meta-badge--rejected`}>{metaTemplates.rejected} rechazadas</span>}
                </div>
              </div>
              <div className={`${b}__meta-templates-list`}>
                {metaTemplates.templates.filter(t => t.status === 'approved').map(t => (
                  <div key={t.id} className={`${b}__meta-tpl`}>
                    <span className={`${b}__meta-tpl-name`}>{t.name}</span>
                    <span className={`${b}__meta-tpl-cat`}>{t.category}</span>
                    <span className={`${b}__meta-tpl-body`}>{t.body?.slice(0, 80)}{t.body?.length > 80 ? '...' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metaTemplates?.error && (
            <div className={`${b}__test-result ${b}__test-result--err`}>
              Meta API: {metaTemplates.error}
            </div>
          )}
        </Card>
      </div>

      {/* Disconnect confirmation modal — rendered via portal to avoid stacking context issues */}
      {showDisconnectModal && createPortal(
        <div className={`${b}__modal-overlay`} onClick={() => setShowDisconnectModal(false)}>
          <div className={`${b}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__modal-icon`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className={`${b}__modal-title`}>Desconectar cuenta de Meta</h3>
            <p className={`${b}__modal-desc`}>
              Se eliminara el token de acceso y la conexion con WhatsApp Business.
              Las automatizaciones dejaran de funcionar hasta que vuelvas a conectar.
            </p>
            <div className={`${b}__modal-actions`}>
              <button
                className={`${b}__modal-cancel`}
                onClick={() => setShowDisconnectModal(false)}
                disabled={disconnecting}
              >
                Cancelar
              </button>
              <button
                className={`${b}__modal-confirm`}
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Desconectando...' : 'Si, desconectar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Settings;
