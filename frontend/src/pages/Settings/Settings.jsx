import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/common/Card/Card';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import aiService from '../../services/aiService';
import settingsService from '../../services/settingsService';

// Model is managed by Plexify (dev), not by the agency admin

const PLACEHOLDER_CONTEXT = `=== DATOS DEL NEGOCIO ===
Nombre: [Nombre de tu negocio]
Ubicacion: [Ciudad, barrio/zona, pais]
Tipo: [Barberia / Peluqueria / Salon de belleza / Spa / etc.]

=== HORARIO ===
Lunes a Viernes: 9:00am - 7:00pm
Sabado: 9:00am - 5:00pm
Domingo: CERRADO
Fuera de horario: Lina responde preguntas y agenda citas, pero informa el horario si preguntan.

=== ESTILO DE COMUNICACION ===
Tono: [Calido y cercano / Formal y profesional / Regional y directo / etc.]
Tutea o trata de usted: [Tutea / Usted / Depende del cliente]
Largo de mensajes: Maximo 2-3 lineas por mensaje.
Emojis: [1 emoji si aporta / Sin emojis / Libre]
Expresiones tipicas: [Expresiones locales o del negocio que quieras usar]

=== POLITICAS ===
Pagos: [Como se paga, metodos aceptados]
Cancelaciones: [Politica de cancelacion si la hay]
Reservas: [Link o instrucciones]

=== NOTAS ADICIONALES ===
[Cualquier instruccion especifica para tu negocio: servicios estrella, barberos/estilistas destacados, promociones activas, reglas especiales, etc.]`;

const Settings = () => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();

  const [aiConfig, setAiConfig] = useState(null);
  const [businessContext, setBusinessContext] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadAiConfig();
  }, []);

  const loadAiConfig = async () => {
    try {
      const config = await aiService.getConfig();
      setAiConfig(config);
      setBusinessContext(config.system_prompt || '');
    } catch {
      // No config yet
    } finally {
      setAiLoading(false);
    }
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
        system_prompt: businessContext,
        model: 'claude-sonnet-4-5-20250929',
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
  }, [businessContext, aiConfig, addNotification]);

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
  const [metaStatus, setMetaStatus] = useState(null); // { connected, phone_display, message }
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaChecking, setMetaChecking] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [metaTemplates, setMetaTemplates] = useState(null); // { templates, approved, pending, rejected }

  useEffect(() => {
    // Pre-fill from tenant config
    if (tenant?.wa_access_token) setMetaToken(tenant.wa_access_token);
    if (tenant?.wa_phone_number_id) setMetaPhoneId(tenant.wa_phone_number_id);
    if (tenant?.wa_business_account_id) setMetaBizId(tenant.wa_business_account_id);
  }, [tenant]);

  useEffect(() => {
    // Check token status on load
    settingsService.getMetaTokenStatus().then(setMetaStatus).catch(() => {});
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
      // Reload templates after token update
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
          <div className={`${b}__ai-field`}>
            <label className={`${b}__ai-label`}>
              Instrucciones del negocio
              <span className={`${b}__ai-label-hint`}>
                Aqui le dices a Lina TODO sobre tu negocio: nombre, ubicacion, horarios, como quieres que hable, politicas de pago, y cualquier detalle importante. Lina ya sabe como operar (agendar citas, responder precios, manejar quejas, etc.) — tu solo defines el contexto de TU negocio.
              </span>
            </label>
            <textarea
              className={`${b}__ai-textarea`}
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder={PLACEHOLDER_CONTEXT}
              rows={22}
            />
            <span className={`${b}__ai-char-count`}>
              {businessContext.length} caracteres
            </span>
          </div>

          <div className={`${b}__ai-actions`}>
            <button
              className={`${b}__ai-save`}
              onClick={handleSaveAiConfig}
              disabled={aiSaving || !businessContext.trim()}
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
                  : metaStatus?.message || 'Configura tu token de acceso'
                }
              </span>
            </div>
            <button className={`${b}__meta-check`} onClick={handleCheckStatus} disabled={metaChecking}>
              {metaChecking ? 'Verificando...' : 'Verificar conexion'}
            </button>
          </div>

          {/* Token input */}
          <div className={`${b}__meta-field`}>
            <label>Token de acceso (Meta Business)</label>
            <span className={`${b}__meta-hint`}>
              Generalo en developers.facebook.com → Tu app → Configuracion de la API → Generar token de acceso
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
    </div>
  );
};

export default Settings;
