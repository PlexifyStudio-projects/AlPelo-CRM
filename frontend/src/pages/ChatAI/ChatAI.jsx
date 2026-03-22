import { useState, useRef, useEffect, useCallback } from 'react';
import aiService from '../../services/aiService';
import { useTenant } from '../../context/TenantContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const STRATEGY_BUTTONS = [
  { id: 'generate-campaign', icon: '🎯', label: 'Generar Campaña', desc: 'Crea una campaña optimizada con IA', endpoint: '/ai/strategy/generate-campaign' },
  { id: 'business-diagnostics', icon: '📊', label: 'Diagnóstico del Negocio', desc: 'Análisis completo de métricas y salud', endpoint: '/ai/strategy/business-diagnostics' },
  { id: 'rescue-lost-clients', icon: '🔄', label: 'Rescatar Clientes', desc: 'Estrategias para clientes perdidos', endpoint: '/ai/strategy/rescue-lost-clients' },
  { id: 'price-optimizer', icon: '💰', label: 'Optimizar Precios', desc: 'Recomendaciones de pricing inteligente', endpoint: '/ai/strategy/price-optimizer' },
  { id: 'predict-agenda', icon: '👥', label: 'Predecir Agenda', desc: 'Proyección de demanda y agenda', endpoint: '/ai/strategy/predict-agenda' },
  { id: 'growth-plan', icon: '⭐', label: 'Plan de Crecimiento', desc: 'Roadmap personalizado de crecimiento', endpoint: '/ai/strategy/growth-plan' },
  { id: 'staff-retention', icon: '🛡️', label: 'Retención por Staff', desc: 'Plan de retención si un profesional se va', endpoint: '/ai/strategy/staff-retention', needsStaff: true },
];

// ============================================
// Plexify - Lina IA v6.0
// Admin assistant — persistent chat
// ============================================

// Storage keys are tenant-scoped so each agency has its own chat history
const getStorageKey = (tenantId) => `plexify_lina_chat_${tenantId || 0}`;
const getTokensKey = (tenantId) => `plexify_lina_tokens_${tenantId || 0}`;
const getHistoryKey = (tenantId) => `plexify_lina_queries_${tenantId || 0}`;

const SUGGESTED_PROMPTS = [
  { icon: '📊', text: 'Dame el resumen completo del negocio', desc: 'Dashboard: KPIs, ingresos, metricas' },
  { icon: '⚠️', text: 'Que clientes estan en riesgo?', desc: 'Clientes sin venir 30+ dias' },
  { icon: '📱', text: 'Como esta el inbox de WhatsApp?', desc: 'Conversaciones, sin leer, IA activa' },
  { icon: '👥', text: 'Dame el estado completo del equipo', desc: 'Profesionales, ratings, especialidades' },
  { icon: '💰', text: 'Cuales son los servicios mas vendidos?', desc: 'Ranking de servicios y facturacion' },
  { icon: '📋', text: 'Clientes que llevan mas de 40 dias sin venir', desc: 'Filtrar clientes inactivos' },
];

const QUICK_ACTIONS = [
  { icon: '➕', text: 'Crear un cliente nuevo' },
  { icon: '📋', text: 'Listar clientes en riesgo' },
  { icon: '📱', text: 'Resumen del inbox' },
  { icon: '👥', text: 'Estado del equipo' },
  { icon: '📝', text: 'Agregar nota a un cliente' },
  { icon: '📨', text: 'Enviar plantilla a clientes inactivos' },
  { icon: '🔄', text: 'Ultimas visitas registradas' },
  { icon: '⚙️', text: 'Ver configuracion de IA actual' },
];

const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Parse AI response — strip action blocks and separate text from action results.
 * Action results come after the text as "-> result" lines from the backend.
 */
const parseAIResponse = (text) => {
  if (!text) return { message: '', actions: [] };

  // The backend already strips ```action blocks and appends results as "-> ..."
  // But sometimes the AI model leaks action blocks — strip them on frontend too
  let clean = text
    .replace(/[`\u0060\u02CB\u2018\u2019\uFF40]{1,3}\s*action[\s\S]*?[`\u0060\u02CB\u2018\u2019\uFF40]{1,3}/gi, '')
    .replace(/[`\u0060\u02CB\u2018\u2019\uFF40]{1,3}\s*action[\s\S]*/gi, '') // unclosed blocks
    .trim();

  // Separate action results (lines starting with "->") from the message
  const lines = clean.split('\n');
  const messageLines = [];
  const actionLines = [];

  for (const line of lines) {
    if (line.trim().startsWith('->')) {
      actionLines.push(line.trim().replace(/^->\s*/, ''));
    } else {
      messageLines.push(line);
    }
  }

  return {
    message: messageLines.join('\n').trim(),
    actions: actionLines,
  };
};

// Load from localStorage (tenant-scoped)
const loadFromStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const ChatAI = () => {
  const { tenant } = useTenant();
  const tid = tenant?.id || 0;

  const [messages, setMessages] = useState(() => loadFromStorage(getStorageKey(tid)) || []);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [queryHistory, setQueryHistory] = useState(() => loadFromStorage(getHistoryKey(tid)) || []);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [tokenCount, setTokenCount] = useState(() => parseInt(localStorage.getItem(getTokensKey(tid)) || '0', 10));
  const [pendingImage, setPendingImage] = useState(null); // { base64, mime, preview }
  const [strategyLoading, setStrategyLoading] = useState(null); // id of loading button
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Persist messages (tenant-scoped)
  useEffect(() => {
    localStorage.setItem(getStorageKey(tid), JSON.stringify(messages));
  }, [messages, tid]);

  useEffect(() => {
    localStorage.setItem(getTokensKey(tid), String(tokenCount));
  }, [tokenCount, tid]);

  useEffect(() => {
    localStorage.setItem(getHistoryKey(tid), JSON.stringify(queryHistory));
  }, [queryHistory, tid]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }, []);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; }
  }, []);

  useEffect(() => { autoResize(); }, [inputValue, autoResize]);

  const handleImageSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setPendingImage({ base64, mime: file.type, preview: reader.result, name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    const hasImage = !!pendingImage;
    if (!trimmed && !hasImage) return;
    if (isTyping) return;

    const displayContent = hasImage ? `${trimmed || 'Imagen enviada'}\n[📷 ${pendingImage.name}]` : trimmed;
    const userMsg = { id: generateId(), role: 'user', content: displayContent, imagePreview: pendingImage?.preview, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    if (trimmed) setQueryHistory((prev) => [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 15));

    const imageData = pendingImage;
    setPendingImage(null);

    // Send conversation history (exclude error messages to save tokens)
    const allMsgs = [...messages, userMsg];
    const history = allMsgs
      .filter((m) => !m.isError)
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const result = await aiService.chat(trimmed || 'Describe esta imagen', history, imageData?.base64, imageData?.mime);
      const aiMsg = { id: generateId(), role: 'assistant', content: result.response, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);
      setTokenCount((prev) => prev + (result.tokens_used || 0));
    } catch (err) {
      const errorMsg = {
        id: generateId(), role: 'assistant', isError: true, timestamp: new Date().toISOString(),
        content: `No pude conectarme: ${err.message}. Verifica que el backend este corriendo.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, messages, pendingImage]);

  const formatStrategyResponse = useCallback((data) => {
    if (typeof data === 'string') return data;
    if (data.response) return data.response;
    if (data.raw_response) return data.raw_response;

    // Pretty labels for known keys
    const labels = {
      tendencia: '📈 TENDENCIA',
      por_que: '💡 POR QUÉ ESTA CAMPAÑA',
      campana: '📱 CAMPAÑA RECOMENDADA',
      campaign_copy: '📱 CAMPAÑA RECOMENDADA',
      audiencia: '👥 AUDIENCIA',
      target_audience: '👥 AUDIENCIA',
      analysis: '📊 ANÁLISIS',
      reasoning: '💡 RAZÓN',
      recommendations: '✅ RECOMENDACIONES',
      summary: '📋 RESUMEN',
      total_lost: '⚠️ CLIENTES PERDIDOS',
      clients: '👥 CLIENTES',
      services: '🏷️ SERVICIOS',
      predictions: '📅 PREDICCIONES',
      goals: '🎯 METAS',
      action_plan: '📝 PLAN DE ACCIÓN',
      kpis: '📊 KPIs',
      current_state: '📍 ESTADO ACTUAL',
      staff_name: '👤 PROFESIONAL',
      total_clients: '👥 TOTAL CLIENTES',
      campaign_suggestion: '📱 CAMPAÑA RECOMENDADA',
      recovery_plan: '🔄 PLAN DE RECUPERACIÓN',
    };

    const lines = [];
    const formatValue = (key, val, depth = 0) => {
      const label = labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const prefix = depth > 0 ? '   '.repeat(depth) : '';

      if (Array.isArray(val)) {
        lines.push(`\n${prefix}${label}:`);
        val.forEach((item, i) => {
          if (typeof item === 'object' && item !== null) {
            lines.push(`${prefix}  ${i + 1}.`);
            Object.entries(item).forEach(([k, v]) => {
              if (typeof v !== 'object') {
                const subLabel = labels[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                lines.push(`${prefix}     ${subLabel}: ${v}`);
              }
            });
          } else {
            lines.push(`${prefix}  • ${item}`);
          }
        });
      } else if (typeof val === 'object' && val !== null) {
        lines.push(`\n${prefix}${label}:`);
        Object.entries(val).forEach(([k, v]) => formatValue(k, v, depth + 1));
      } else {
        lines.push(`${prefix}${label}: ${val}`);
      }
    };

    Object.entries(data).forEach(([key, val]) => formatValue(key, val));
    return lines.join('\n');
  }, []);

  const handleStrategyClick = useCallback(async (strategy) => {
    if (strategyLoading) return;
    if (strategy.needsStaff) {
      setStaffModalOpen(true);
      setSelectedStaffId('');
      setOfferDescription('');
      // Fetch staff list
      try {
        const res = await fetch(`${API_URL}/staff/`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setStaffList(Array.isArray(data) ? data : (data.staff || data.data || []));
        }
      } catch { /* ignore */ }
      return;
    }
    setStrategyLoading(strategy.id);
    // Add user message
    const userMsg = { id: generateId(), role: 'user', content: `${strategy.icon} ${strategy.label}`, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const res = await fetch(`${API_URL}${strategy.endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const content = formatStrategyResponse(data);
      const campaignText = data.campana || data.campaign_copy || data.campana_recuperacion || data.campana_retencion || data.campaign_suggestion || null;
      const aiMsg = { id: generateId(), role: 'assistant', content, timestamp: new Date().toISOString(), campaignText };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = { id: generateId(), role: 'assistant', isError: true, timestamp: new Date().toISOString(), content: `Error al ejecutar ${strategy.label}: ${err.message}` };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setStrategyLoading(null);
    }
  }, [strategyLoading, formatStrategyResponse]);

  const handleAuthorizeCampaign = useCallback(async (campaignText) => {
    try {
      // Create campaign in DB
      const res = await fetch(`${API_URL}/campaigns`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Campaña IA — ${new Date().toLocaleDateString('es-CO')}`,
          campaign_type: 'promo',
          message_body: campaignText,
          status: 'draft',
        }),
      });
      if (!res.ok) throw new Error('Error al crear campaña');
      const campaign = await res.json();

      // Submit to Meta for approval
      const metaRes = await fetch(`${API_URL}/campaigns/${campaign.id}/submit-to-meta`, {
        method: 'POST',
        credentials: 'include',
      });

      const confirmMsg = {
        id: generateId(), role: 'assistant', timestamp: new Date().toISOString(),
        content: metaRes.ok
          ? `✅ Campaña creada y enviada a Meta para aprobación.\n\nPuedes verla en Campañas. Cuando Meta la apruebe, podrás enviarla a tus clientes.`
          : `✅ Campaña creada en Campañas (borrador).\n\n⚠️ No se pudo enviar a Meta automáticamente. Ve a Campañas para enviarla manualmente.`,
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err) {
      const errorMsg = { id: generateId(), role: 'assistant', isError: true, timestamp: new Date().toISOString(), content: `Error: ${err.message}` };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, []);

  const handleStaffRetentionSubmit = useCallback(async () => {
    if (!selectedStaffId || !offerDescription.trim()) return;
    setStaffModalOpen(false);
    const strategy = STRATEGY_BUTTONS.find(s => s.id === 'staff-retention');
    setStrategyLoading('staff-retention');
    const staffName = staffList.find(s => String(s.id) === String(selectedStaffId))?.name || 'Staff';
    const userMsg = { id: generateId(), role: 'user', content: `🛡️ Retención por Staff — ${staffName}\nOferta: ${offerDescription}`, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const res = await fetch(`${API_URL}${strategy.endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: Number(selectedStaffId), offer_description: offerDescription }),
      });
      const data = await res.json();
      const content = formatStrategyResponse(data);
      const aiMsg = { id: generateId(), role: 'assistant', content, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = { id: generateId(), role: 'assistant', isError: true, timestamp: new Date().toISOString(), content: `Error al ejecutar Retención por Staff: ${err.message}` };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setStrategyLoading(null);
    }
  }, [selectedStaffId, offerDescription, staffList, formatStrategyResponse]);

  const handleSubmit = (e) => { e.preventDefault(); sendMessage(inputValue); };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue); } };

  const formatTime = (ts) => {
    try { return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); }
    catch { return ''; }
  };

  const clearChat = () => {
    setMessages([]);
    // Keep token count — never reset accumulated tokens
    localStorage.removeItem(getStorageKey(tid));
  };

  const hasMessages = messages.length > 0;
  const responseCount = messages.filter((m) => m.role === 'assistant' && !m.isError).length;

  return (
    <div className="chat-ai">
      {/* Header */}
      <div className="chat-ai__header">
        <div className="chat-ai__header-left">
          <div className="chat-ai__header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
              <line x1="10" y1="22" x2="14" y2="22" />
            </svg>
          </div>
          <div>
            <h2 className="chat-ai__title">Lina</h2>
            <span className="chat-ai__subtitle">
              <span className={`chat-ai__status-dot ${tenant.ai_is_paused ? 'chat-ai__status-dot--paused' : ''}`} />
              {tenant.ai_is_paused ? 'Pausada' : 'Asistente ejecutiva'}
            </span>
          </div>
        </div>
        <div className="chat-ai__header-actions">
          {hasMessages && (
            <button className="chat-ai__header-btn" onClick={clearChat} title="Limpiar conversacion">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
          <button
            className={`chat-ai__header-btn ${sidebarOpen ? 'chat-ai__header-btn--active' : ''}`}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Panel lateral"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-ai__body">
        {/* Main chat area */}
        <div className="chat-ai__main">
          <div className="chat-ai__messages" ref={messagesContainerRef} onScroll={handleScroll}>
            {!hasMessages ? (
              <div className="chat-ai__welcome">
                <div className="chat-ai__welcome-badge">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                    <line x1="10" y1="22" x2="14" y2="22" />
                  </svg>
                </div>
                <h3 className="chat-ai__welcome-title">Hola, soy Lina</h3>
                <p className="chat-ai__welcome-text">
                  Tu asistente ejecutiva con control total de {tenant.name}. Dashboard, clientes, equipo, inbox, plantillas, configuracion — preguntame lo que necesites o pideme que haga cualquier cosa.
                </p>
                <div className="chat-ai__prompts">
                  {SUGGESTED_PROMPTS.map((p, i) => (
                    <button key={i} className="chat-ai__prompt-card" onClick={() => sendMessage(p.text)}>
                      <span className="chat-ai__prompt-icon">{p.icon}</span>
                      <div>
                        <span className="chat-ai__prompt-text">{p.text}</span>
                        <span className="chat-ai__prompt-desc">{p.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const parsed = msg.role === 'assistant' && !msg.isError ? parseAIResponse(msg.content) : null;
                  return (
                    <div key={msg.id} className={`chat-ai__message chat-ai__message--${msg.role} ${msg.isError ? 'chat-ai__message--error' : ''}`}>
                      {msg.role === 'assistant' && (
                        <div className="chat-ai__avatar">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                          </svg>
                        </div>
                      )}
                      <div className="chat-ai__bubble-wrap">
                        <div className={`chat-ai__bubble chat-ai__bubble--${msg.role}`}>
                          {parsed ? (
                            <>
                              {parsed.message && <span className="chat-ai__text">{parsed.message}</span>}
                              {parsed.actions.length > 0 && (
                                <div className="chat-ai__action-results">
                                  {parsed.actions.map((a, i) => (
                                    <div key={i} className={`chat-ai__action-result ${a.startsWith('ERROR') ? 'chat-ai__action-result--error' : ''}`}>
                                      <span className="chat-ai__action-icon">{a.startsWith('ERROR') ? '!' : '\u2713'}</span>
                                      {a}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {msg.imagePreview && <img src={msg.imagePreview} alt="Adjunto" className="chat-ai__msg-image" />}
                              <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                            </>
                          )}
                          {msg.campaignText && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                              <button
                                onClick={() => handleAuthorizeCampaign(msg.campaignText)}
                                style={{
                                  background: '#059669', color: '#fff', border: 'none', borderRadius: '8px',
                                  padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center',
                                }}
                              >
                                ✅ Autorizar y enviar a Meta para aprobación
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="chat-ai__time">{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="chat-ai__message chat-ai__message--assistant">
                    <div className="chat-ai__avatar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                      </svg>
                    </div>
                    <div className="chat-ai__bubble chat-ai__bubble--assistant chat-ai__bubble--typing">
                      <span className="chat-ai__dot" /><span className="chat-ai__dot" /><span className="chat-ai__dot" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {showScrollBtn && hasMessages && (
            <button className="chat-ai__scroll-btn" onClick={scrollToBottom}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          )}

          {/* Input */}
          {tenant.ai_is_paused && (
            <div className="chat-ai__paused-overlay">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Lina esta pausada por soporte. No puedes enviar mensajes hasta que sea reactivada.</span>
            </div>
          )}
          <form className="chat-ai__input-area" onSubmit={handleSubmit} style={tenant.ai_is_paused ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            {!isTyping && (
              <div className="chat-ai__strategy">
                <div className="chat-ai__strategy-header">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                  <span>Inteligencia de Negocio</span>
                </div>
                <div className="chat-ai__strategy-grid">
                  {STRATEGY_BUTTONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`chat-ai__strategy-btn ${strategyLoading === s.id ? 'chat-ai__strategy-btn--loading' : ''}`}
                      onClick={() => handleStrategyClick(s)}
                      disabled={!!strategyLoading}
                    >
                      {strategyLoading === s.id ? (
                        <>
                          <span className="chat-ai__strategy-spinner" />
                          <div>
                            <span className="chat-ai__strategy-label">Analizando...</span>
                            <span className="chat-ai__strategy-desc">{s.desc}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="chat-ai__strategy-icon">{s.icon}</span>
                          <div>
                            <span className="chat-ai__strategy-label">{s.label}</span>
                            <span className="chat-ai__strategy-desc">{s.desc}</span>
                          </div>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pendingImage && (
              <div className="chat-ai__image-preview">
                <img src={pendingImage.preview} alt="Preview" className="chat-ai__image-preview-img" />
                <span className="chat-ai__image-preview-name">{pendingImage.name}</span>
                <button type="button" className="chat-ai__image-preview-remove" onClick={() => setPendingImage(null)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            )}
            <div className="chat-ai__input-row">
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
              <button type="button" className="chat-ai__attach-btn" onClick={() => fileInputRef.current?.click()} title="Adjuntar imagen" disabled={isTyping}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                className="chat-ai__input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingImage ? "Describe que quieres saber de la imagen..." : "Escribe una instruccion..."}
                rows={1}
                disabled={isTyping}
              />
              <button
                type="submit"
                className={`chat-ai__send ${(inputValue.trim() || pendingImage) ? 'chat-ai__send--active' : ''}`}
                disabled={(!inputValue.trim() && !pendingImage) || isTyping}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <span className="chat-ai__hint">Enter para enviar · Shift+Enter nueva linea · 📷 Puedes adjuntar imagenes</span>
          </form>
        </div>

        {/* Staff Retention Modal */}
        {staffModalOpen && (
          <div className="chat-ai__modal-overlay" onClick={() => setStaffModalOpen(false)}>
            <div className="chat-ai__modal" onClick={(e) => e.stopPropagation()}>
              <div className="chat-ai__modal-header">
                <span>🛡️ Retención por Staff</span>
                <button className="chat-ai__modal-close" onClick={() => setStaffModalOpen(false)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div className="chat-ai__modal-body">
                <label className="chat-ai__modal-label">Profesional que se fue</label>
                <select
                  className="chat-ai__modal-select"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                >
                  <option value="">Seleccionar profesional...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <label className="chat-ai__modal-label">Oferta de retención</label>
                <textarea
                  className="chat-ai__modal-textarea"
                  value={offerDescription}
                  onChange={(e) => setOfferDescription(e.target.value)}
                  placeholder="Ej: 10% descuento + bebida gratis en la próxima visita..."
                  rows={3}
                />
              </div>
              <div className="chat-ai__modal-footer">
                <button className="chat-ai__modal-cancel" onClick={() => setStaffModalOpen(false)}>Cancelar</button>
                <button
                  className="chat-ai__modal-submit"
                  onClick={handleStaffRetentionSubmit}
                  disabled={!selectedStaffId || !offerDescription.trim()}
                >
                  Analizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="chat-ai__sidebar">
            <div className="chat-ai__sidebar-section">
              <h4 className="chat-ai__sidebar-title">Uso de IA</h4>
              <div className="chat-ai__sidebar-stats">
                <div className="chat-ai__sidebar-stat">
                  <span className="chat-ai__sidebar-stat-val">{tenant.messages_used?.toLocaleString('es-CO') || 0}</span>
                  <span className="chat-ai__sidebar-stat-lbl">Mensajes total</span>
                </div>
                <div className="chat-ai__sidebar-stat">
                  <span className="chat-ai__sidebar-stat-val">{tokenCount.toLocaleString()}</span>
                  <span className="chat-ai__sidebar-stat-lbl">Tokens sesion</span>
                </div>
              </div>
            </div>

            <div className="chat-ai__sidebar-section">
              <h4 className="chat-ai__sidebar-title">Capacidades</h4>
              <div className="chat-ai__sidebar-caps">
                <span>📊 Dashboard y KPIs</span>
                <span>👥 CRM de clientes</span>
                <span>👥 Equipo y staff</span>
                <span>📱 Inbox WhatsApp</span>
                <span>📨 Envio de plantillas</span>
                <span>📝 Notas y visitas</span>
                <span>⚙️ Configuracion IA</span>
                <span>🔒 Seguridad integrada</span>
              </div>
            </div>

            {queryHistory.length > 0 && (
              <div className="chat-ai__sidebar-section">
                <h4 className="chat-ai__sidebar-title">Historial</h4>
                <div className="chat-ai__sidebar-history">
                  {queryHistory.slice(0, 8).map((q, i) => (
                    <button key={i} className="chat-ai__sidebar-history-item" onClick={() => sendMessage(q)} title={q}>
                      {q.length > 32 ? q.slice(0, 32) + '...' : q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};

export default ChatAI;
