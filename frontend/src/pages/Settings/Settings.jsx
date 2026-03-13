import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/common/Card/Card';
import { useNotification } from '../../context/NotificationContext';
import aiService from '../../services/aiService';

const MODELS = [
  { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic', label: 'Claude Sonnet 4.5', cost: '~$120 COP/msg', tag: 'Recomendado', desc: 'Inteligente y confiable' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', label: 'Claude Haiku 4.5', cost: '~$40 COP/msg', tag: 'Economico', desc: 'Rapido y barato, menos inteligente' },
];

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

  const [aiConfig, setAiConfig] = useState(null);
  const [businessContext, setBusinessContext] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929');
  const [provider, setProvider] = useState('anthropic');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(true);
  const [providerStatus, setProviderStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadAiConfig();
    loadProviderStatus();
  }, []);

  const loadAiConfig = async () => {
    try {
      const config = await aiService.getConfig();
      setAiConfig(config);
      setBusinessContext(config.system_prompt || '');
      setSelectedModel(config.model);
      setProvider(config.provider || 'anthropic');
    } catch {
      // No config yet
    } finally {
      setAiLoading(false);
    }
  };

  const loadProviderStatus = async () => {
    try {
      const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
      const res = await fetch(`${API}/ai/status`);
      if (res.ok) setProviderStatus(await res.json());
    } catch { /* ignore */ }
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
        model: selectedModel,
        provider,
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
  }, [businessContext, selectedModel, provider, aiConfig, addNotification]);

  const handleToggle = (setting) => {
    addNotification(`${setting} actualizado`, 'info');
  };

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

          <div className={`${b}__ai-row`}>
            <div className={`${b}__ai-field ${b}__ai-field--half`}>
              <label className={`${b}__ai-label`}>Modelo de IA</label>
              <select
                className={`${b}__ai-select`}
                value={selectedModel}
                onChange={(e) => {
                  const model = MODELS.find(m => m.id === e.target.value);
                  setSelectedModel(e.target.value);
                  if (model) setProvider(model.provider);
                }}
              >
                {MODELS.map((m) => {
                  const status = providerStatus?.[m.provider];
                  const available = status?.configured !== false;
                  return (
                    <option key={m.id} value={m.id} disabled={!available}>
                      {m.label} — {m.cost}{m.tag ? ` (${m.tag})` : ''}{!available ? ' [Sin API key]' : ''}
                    </option>
                  );
                })}
              </select>
              {(() => {
                const currentModel = MODELS.find(m => m.id === selectedModel);
                return currentModel?.desc ? (
                  <span className={`${b}__ai-label-hint`} style={{ marginTop: 4 }}>
                    {currentModel.desc}
                  </span>
                ) : null;
              })()}
            </div>
          </div>

          {/* Provider status */}
          {providerStatus && (
            <div className={`${b}__providers`}>
              <label className={`${b}__ai-label`}>Proveedor de IA</label>
              <div className={`${b}__provider-list`}>
                <div className={`${b}__provider ${providerStatus.anthropic?.configured ? `${b}__provider--ok ${b}__provider--active` : `${b}__provider--off`}`}>
                  <span className={`${b}__provider-dot`} />
                  <span className={`${b}__provider-name`}>Claude (Anthropic)</span>
                  <span className={`${b}__provider-status`}>
                    {providerStatus.anthropic?.configured ? 'Conectado' : 'Sin API key'}
                  </span>
                </div>
              </div>
            </div>
          )}

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
            <button className={`${b}__toggle ${b}__toggle--active`} onClick={() => handleToggle('Notificaciones de citas')}>
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Alertas de mensajeria</span>
              <span className={`${b}__option-desc`}>Notificar cuando se complete un envio masivo</span>
            </div>
            <button className={`${b}__toggle ${b}__toggle--active`} onClick={() => handleToggle('Alertas de mensajeria')}>
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Sonidos</span>
              <span className={`${b}__option-desc`}>Reproducir sonido con las notificaciones</span>
            </div>
            <button className={`${b}__toggle`} onClick={() => handleToggle('Sonidos')}>
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>
        </Card>

        {/* ========== INTEGRATIONS ========== */}
        <Card title="Integraciones" className={`${b}__card`}>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>WhatsApp Business</span>
              <span className={`${b}__option-desc`}>Conectar con la API de WhatsApp Business</span>
            </div>
            <span className={`${b}__status ${b}__status--connected`}>Conectado</span>
          </div>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Meta (Facebook/Instagram)</span>
              <span className={`${b}__option-desc`}>Conectar con Meta Business Suite</span>
            </div>
            <span className={`${b}__status ${b}__status--pending`}>Pendiente</span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
