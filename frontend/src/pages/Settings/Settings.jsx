import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/common/Card/Card';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import aiService from '../../services/aiService';

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

  const waConnected = !!(tenant?.wa_phone_number_id && tenant?.wa_access_token);

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

        {/* ========== INTEGRATIONS ========== */}
        <Card title="Integraciones" className={`${b}__card`}>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>WhatsApp Business</span>
              <span className={`${b}__option-desc`}>
                {waConnected ? `Conectado — ${tenant.wa_phone_display || 'Numero configurado'}` : 'Sin configurar — contacta a soporte'}
              </span>
            </div>
            <span className={`${b}__status ${waConnected ? `${b}__status--connected` : `${b}__status--pending`}`}>
              {waConnected ? 'Conectado' : 'No configurado'}
            </span>
          </div>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Meta (Facebook/Instagram)</span>
              <span className={`${b}__option-desc`}>Publicacion de contenido en redes sociales</span>
            </div>
            <span className={`${b}__status ${b}__status--pending`}>Proximamente</span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
