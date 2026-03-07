import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/common/Card/Card';
import { useNotification } from '../../context/NotificationContext';
import aiService from '../../services/aiService';

const DEFAULT_PROMPT = `Eres Lina, la asistente virtual de AlPelo Peluqueria en Bucaramanga, Colombia.

Tu rol:
- Responder preguntas sobre los servicios, horarios y precios de AlPelo
- Ayudar a agendar citas dirigiendo a los clientes al link de reservas
- Dar recomendaciones de servicios basandote en lo que el cliente necesite
- Ser amable, profesional y con tono colombiano natural

Reglas:
- NUNCA inventes informacion sobre precios o servicios que no conozcas
- Si no sabes algo, di que vas a consultar con el equipo
- No uses emojis excesivos, maximo 1-2 por mensaje
- Habla en espanol colombiano natural, sin ser demasiado informal
- El link de reservas es: https://book.weibook.co/alpelo-peluqueria
- Direccion: Cabecera, Bucaramanga
- No compartas informacion personal de los clientes`;

const MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recomendado)', cost: '~$0.003/msg' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Mas rapido)', cost: '~$0.001/msg' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 (Mas inteligente)', cost: '~$0.015/msg' },
];

const Settings = () => {
  const { addNotification } = useNotification();

  // AI Config state
  const [aiConfig, setAiConfig] = useState(null);
  const [aiName, setAiName] = useState('Lina IA');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    loadAiConfig();
  }, []);

  const loadAiConfig = async () => {
    try {
      const config = await aiService.getConfig();
      setAiConfig(config);
      setAiName(config.name);
      setSystemPrompt(config.system_prompt);
      setSelectedModel(config.model);
      setTemperature(config.temperature);
      setMaxTokens(config.max_tokens);
    } catch {
      // No config yet, use defaults
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAiConfig = useCallback(async () => {
    setAiSaving(true);
    try {
      const data = {
        name: aiName,
        system_prompt: systemPrompt,
        model: selectedModel,
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
      addNotification('Configuracion de Lina IA guardada', 'success');
    } catch (err) {
      addNotification(`Error al guardar: ${err.message}`, 'error');
    } finally {
      setAiSaving(false);
    }
  }, [aiName, systemPrompt, selectedModel, temperature, maxTokens, aiConfig, addNotification]);

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
        {/* ========== LINA IA CONFIG ========== */}
        <Card title="Lina IA — Asistente Inteligente" className={`${b}__card ${b}__card--ai`}>
          <p className={`${b}__card-desc`}>
            Configura como se comporta Lina, la IA de AlPelo. Todo lo que escribas aqui define su personalidad,
            conocimiento y limitaciones. No necesitas tocar codigo.
          </p>

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
                Escribe como si le hablaras a la IA. Dile quien es, que puede hacer, que NO puede hacer, y como debe hablar.
              </span>
            </label>
            <textarea
              className={`${b}__ai-textarea`}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
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
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.cost})
                  </option>
                ))}
              </select>
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
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                min={256}
                max={4096}
                step={256}
              />
            </div>
          </div>

          <div className={`${b}__ai-actions`}>
            <button
              className={`${b}__ai-save`}
              onClick={handleSaveAiConfig}
              disabled={aiSaving || !systemPrompt.trim()}
            >
              {aiSaving ? 'Guardando...' : aiConfig?.id ? 'Actualizar configuracion' : 'Guardar configuracion'}
            </button>
            {aiConfig?.updated_at && (
              <span className={`${b}__ai-last-saved`}>
                Ultima actualizacion: {new Date(aiConfig.updated_at).toLocaleDateString('es-CO')}
              </span>
            )}
          </div>
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
            <span className={`${b}__status ${b}__status--pending`}>Pendiente</span>
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
