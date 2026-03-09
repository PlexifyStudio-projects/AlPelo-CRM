import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/common/Card/Card';
import { useNotification } from '../../context/NotificationContext';
import aiService from '../../services/aiService';

// ============================================================================
// 15 AI PERSONALITY PRESETS — Inspired by the best conversational AI assistants
// Each one has a unique voice, style, and approach to client interaction
// ============================================================================
const PERSONALITY_PRESETS = [
  {
    id: 'lina',
    name: 'Lina',
    label: 'Profesional',
    description: 'Recepcionista ejecutiva, formal y organizada. Como la mejor asistente de oficina.',
    temperature: 0.4,
    prompt: `Eres Lina, recepcionista de AlPelo Peluqueria en Cabecera, Bucaramanga. Eres profesional, organizada y con calidez natural. Tu tono es formal pero cercano — como una ejecutiva que tiene todo bajo control pero nunca es fria. Hablas con propiedad, en espanol colombiano formal. Nunca mas de 2-3 lineas. Maximo 1 emoji por mensaje. Tratas de usted hasta que el cliente tutea.

Cuando un cliente nuevo escribe, te presentas, le preguntas su nombre y en que puedes ayudarle. Cuando un cliente conocido escribe, lo saludas por su nombre y le haces sentir recordado.`,
  },
  {
    id: 'valentina',
    name: 'Valentina',
    label: 'Humana',
    description: 'La mas natural y cercana. Habla como una persona real por WhatsApp, calida y genuina.',
    temperature: 0.5,
    prompt: `Eres Valentina, recepcionista de AlPelo Peluqueria en Cabecera, Bucaramanga. Eres la persona mas genuina y humana — hablas exactamente como una persona real por WhatsApp. Nada de frases roboticas o genericas. Eres calida, cercana, y te expresas con naturalidad. Usas "jaja" cuando algo es gracioso, puntos suspensivos cuando piensas, y tu tono cambia segun la conversacion como lo haria cualquier persona real.

Cuando un cliente nuevo escribe, lo saludas como lo haria una recepcionista amable: te presentas, le preguntas el nombre con naturalidad. Cuando un cliente conocido escribe, lo saludas como si fuera un conocido que aprecias — "Hola Juan! Que mas, como vas?". Si llevan tiempo sin venir, lo mencionas casual.

Tu estilo: mensajes que parecen escritos por una persona real, no por una empresa. Cortos, naturales, con las imperfecciones normales de WhatsApp. Maximo 2-3 lineas. 1-2 emojis si fluye.`,
  },
  {
    id: 'camila',
    name: 'Camila',
    label: 'Ventas',
    description: 'Enfocada en convertir. Sugiere servicios, promueve ofertas y cierra agendamientos.',
    temperature: 0.5,
    prompt: `Eres Camila, recepcionista de ventas de AlPelo Peluqueria en Cabecera, Bucaramanga. Tu objetivo principal es que el cliente agende. Eres amable y natural, pero siempre guias la conversacion hacia un servicio o una cita. Sabes recomendar servicios segun lo que el cliente necesita, sugieres combos cuando tiene sentido, y siempre cierras con el link de reservas.

Cuando un cliente nuevo escribe, te presentas con energia, le preguntas el nombre y que esta buscando. Apenas sepas que quiere, recomienda el servicio ideal y manda el link. Cuando un cliente conocido escribe, le sugieres algo nuevo o le recuerdas que ya toca su proximo corte/servicio.

Tecnicas de venta que usas:
- Sugerir combos: "Si te vas a hacer el corte, aprovecha y hazte la barba tambien, te queda en $55.000 el combo"
- Crear urgencia suave: "Hoy tenemos espacio con Anderson a las 3pm si quieres"
- Upselling natural: "Con el corte te recomiendo el tratamiento de alta frecuencia, deja el cabello brutal"

Tu estilo: amable pero orientada a la accion. Maximo 2-3 lineas. Siempre termina con una propuesta concreta o el link.`,
  },
  {
    id: 'isabella',
    name: 'Isabella',
    label: 'Premium',
    description: 'Concierge de lujo. Trato VIP, elegante y sofisticado para clientes exigentes.',
    temperature: 0.3,
    prompt: `Eres Isabella, recepcionista premium de AlPelo Peluqueria en Cabecera, Bucaramanga. Encarnas la elegancia — como la concierge de un hotel cinco estrellas. Tu vocabulario es pulido, tu trato impecable, cada interaccion se siente como una experiencia exclusiva. Tratas de usted siempre, con cortesia genuina. Usas frases como "sera un placer", "con mucho gusto", "permitame".

Cuando un cliente nuevo escribe, lo recibes como si llegara a un lugar exclusivo: con distincion y valorandolo. Te presentas con elegancia y le pides su nombre. Cuando un cliente conocido escribe, lo tratas como a un huesped distinguido que regresa — con reconocimiento y deferencia.

Tu estilo: lenguaje refinado pero accesible, nunca pretencioso. Sin emojis. Maximo 2-3 lineas. Cada respuesta se siente como servicio premium.`,
  },
  {
    id: 'paola',
    name: 'Paola',
    label: 'Bumanguesa',
    description: 'Autentica santandereana. Directa, con carino, y habla como la gente real de aca.',
    temperature: 0.6,
    prompt: `Eres Paola, recepcionista de AlPelo Peluqueria en Cabecera, Bucaramanga. Eres bumanguesa de pura cepa — directa, sin rodeos, con ese desparpajo santandereano que dice las cosas como son pero con carino. Hablas como si conocieras al cliente de toda la vida. Usas expresiones bumanguesas y colombianas: "ve", "oye", "que hubo", "hagale", "listo pues". Eres la que atiende el negocio y sabe todo porque lleva anos ahi.

Cuando un cliente nuevo escribe, lo saludas con confianza directa, te presentas y le preguntas el nombre y que necesita. Cuando un cliente conocido escribe, lo saludas como a un conocido del barrio — familiar, directo.

Tu estilo: mensajes cortos, directos, que suenan a mensaje de texto real bumangues. Tuteas siempre. Maximo 2-3 lineas. Maximo 1 emoji si es natural.`,
  },
];

const MODELS = [
  { id: 'gemini-2.0-flash', provider: 'gemini', label: 'Gemini 2.0 Flash', cost: 'Gratis', tag: 'Recomendado', desc: '15 req/min, 1500/dia' },
  { id: 'gemini-2.5-flash-preview-05-20', provider: 'gemini', label: 'Gemini 2.5 Flash Preview', cost: 'Gratis', tag: 'Nuevo', desc: 'Preview, limites bajos' },
  { id: 'llama-3.3-70b-versatile', provider: 'groq', label: 'Llama 3.3 70B (Groq)', cost: 'Gratis', tag: null, desc: '~9 msg/dia (100K tokens)' },
];

const Settings = () => {
  const { addNotification } = useNotification();

  // AI Config state
  const [aiConfig, setAiConfig] = useState(null);
  const [aiName, setAiName] = useState('Lina IA');
  const [systemPrompt, setSystemPrompt] = useState(PERSONALITY_PRESETS[0].prompt);
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [provider, setProvider] = useState('gemini');
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(512);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(null);
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
      setAiName(config.name);
      setSystemPrompt(config.system_prompt);
      setSelectedModel(config.model);
      setProvider(config.provider || 'gemini');
      setTemperature(config.temperature);
      setMaxTokens(config.max_tokens);

      // Try to match current prompt to a preset
      const match = PERSONALITY_PRESETS.find(p =>
        config.system_prompt?.includes(`Eres ${p.name},`)
      );
      if (match) setSelectedPreset(match.id);
    } catch {
      // No config yet, use defaults
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

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.id);
    setAiName(`${preset.name} IA`);
    setSystemPrompt(preset.prompt);
    setTemperature(preset.temperature);
    addNotification(`Personalidad "${preset.name}" seleccionada. Guarda para aplicar.`, 'info');
  };

  const handleSaveAiConfig = useCallback(async () => {
    setAiSaving(true);
    try {
      const data = {
        name: aiName,
        system_prompt: systemPrompt,
        model: selectedModel,
        provider,
        temperature,
        max_tokens: maxTokens,
      };

      let result;
      if (aiConfig?.id) {
        result = await aiService.updateConfig(aiConfig.id, data);
      } else {
        result = await aiService.saveConfig(data);
      }
      setAiConfig(result);
      addNotification(`Configuracion de ${aiName} guardada`, 'success');
    } catch (err) {
      addNotification(`Error al guardar: ${err.message}`, 'error');
    } finally {
      setAiSaving(false);
    }
  }, [aiName, systemPrompt, selectedModel, provider, temperature, maxTokens, aiConfig, addNotification]);

  const handleToggle = (setting) => {
    addNotification(`${setting} actualizado`, 'info');
  };

  const b = 'settings';

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h2 className={`${b}__title`}>Configuracion</h2>
        <p className={`${b}__subtitle`}>Personaliza tu experiencia</p>
      </div>

      <div className={`${b}__content`}>
        {/* ========== AI PERSONALITY PRESETS ========== */}
        <Card title="Personalidad de la IA" className={`${b}__card ${b}__card--ai`}>
          <p className={`${b}__card-desc`}>
            Elige como se comunica la IA con tus clientes por WhatsApp. Cada personalidad tiene un estilo unico.
            Tambien puedes editar el prompt manualmente despues de seleccionar.
          </p>

          <div className={`${b}__presets`}>
            {PERSONALITY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`${b}__preset ${selectedPreset === preset.id ? `${b}__preset--active` : ''}`}
                onClick={() => handlePresetSelect(preset)}
              >
                <span className={`${b}__preset-label`}>{preset.label}</span>
                <span className={`${b}__preset-name`}>{preset.name}</span>
                <span className={`${b}__preset-desc`}>{preset.description}</span>
                {selectedPreset === preset.id && <span className={`${b}__preset-check`}>Activa</span>}
              </button>
            ))}
          </div>
        </Card>

        {/* ========== LINA IA CONFIG ========== */}
        <Card title={`${aiName} — Configuracion Avanzada`} className={`${b}__card ${b}__card--ai`}>
          <div className={`${b}__ai-field`}>
            <label className={`${b}__ai-label`}>Nombre de la IA</label>
            <input
              className={`${b}__ai-input`}
              type="text"
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="Lina IA"
            />
          </div>

          <div className={`${b}__ai-field`}>
            <label className={`${b}__ai-label`}>
              Instrucciones del sistema
              <span className={`${b}__ai-label-hint`}>
                Este es el prompt que define la personalidad. Puedes editarlo libremente o seleccionar un preset arriba.
              </span>
            </label>
            <textarea
              className={`${b}__ai-textarea`}
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value);
                setSelectedPreset(null);
              }}
              placeholder="Eres Lina, la asistente virtual de AlPelo..."
              rows={16}
            />
            <span className={`${b}__ai-char-count`}>
              {systemPrompt.length} caracteres
            </span>
          </div>

          <div className={`${b}__ai-row`}>
            <div className={`${b}__ai-field ${b}__ai-field--half`}>
              <label className={`${b}__ai-label`}>Modelo</label>
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
                    Limite: {currentModel.desc} — Fallback automatico si se agota
                  </span>
                ) : null;
              })()}
            </div>

            <div className={`${b}__ai-field ${b}__ai-field--quarter`}>
              <label className={`${b}__ai-label`}>
                Creatividad
                <span className={`${b}__ai-label-hint`}>{temperature}</span>
              </label>
              <input
                className={`${b}__ai-range`}
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
              <div className={`${b}__ai-range-labels`}>
                <span>Precisa</span>
                <span>Creativa</span>
              </div>
            </div>

            <div className={`${b}__ai-field ${b}__ai-field--quarter`}>
              <label className={`${b}__ai-label`}>Max tokens</label>
              <input
                className={`${b}__ai-input`}
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 512)}
                min={256}
                max={4096}
                step={256}
              />
            </div>
          </div>

          {/* Provider status */}
          {providerStatus && (
            <div className={`${b}__providers`}>
              <label className={`${b}__ai-label`}>Estado de proveedores (fallback automatico)</label>
              <div className={`${b}__provider-list`}>
                {['gemini', 'groq', 'anthropic'].map(p => {
                  const s = providerStatus[p];
                  const isActive = provider === p;
                  return (
                    <div key={p} className={`${b}__provider ${s?.configured ? `${b}__provider--ok` : `${b}__provider--off`} ${isActive ? `${b}__provider--active` : ''}`}>
                      <span className={`${b}__provider-dot`} />
                      <span className={`${b}__provider-name`}>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                      <span className={`${b}__provider-status`}>
                        {s?.configured ? (isActive ? 'Principal' : 'Respaldo') : 'Sin key'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`${b}__ai-actions`}>
            <button
              className={`${b}__ai-save`}
              onClick={handleSaveAiConfig}
              disabled={aiSaving || !systemPrompt.trim()}
            >
              {aiSaving ? 'Guardando...' : aiConfig?.id ? 'Actualizar configuracion' : 'Guardar configuracion'}
            </button>
            <button
              className={`${b}__ai-test`}
              onClick={handleTestAI}
              disabled={testing}
            >
              {testing ? 'Probando...' : 'Probar IA'}
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
