import { useState, useRef, useEffect, useCallback } from 'react';
import aiService from '../../services/aiService';

// ============================================
// AlPelo - Lina IA v6.0
// Admin assistant — persistent chat
// ============================================

const STORAGE_KEY = 'alpelo_lina_chat';
const STORAGE_TOKENS_KEY = 'alpelo_lina_tokens';
const STORAGE_HISTORY_KEY = 'alpelo_lina_queries';

const SUGGESTED_PROMPTS = [
  { icon: '📊', text: 'Dame el resumen del dia', desc: 'KPIs y metricas actuales' },
  { icon: '⚠️', text: 'Que clientes estan en riesgo?', desc: 'Clientes sin venir 30+ dias' },
  { icon: '👥', text: 'Cuantos clientes VIP tenemos?', desc: 'Segmentacion de clientes' },
  { icon: '💰', text: 'Cual es el ingreso total del negocio?', desc: 'Facturacion acumulada' },
  { icon: '💈', text: 'Cual es el servicio mas vendido?', desc: 'Ranking de servicios' },
  { icon: '👤', text: 'Quien es el barbero con mejor rating?', desc: 'Rendimiento del equipo' },
];

const QUICK_ACTIONS = [
  { icon: '➕', text: 'Crear un cliente nuevo' },
  { icon: '📋', text: 'Listar clientes en riesgo' },
  { icon: '📈', text: 'Resumen de ingresos' },
  { icon: '👥', text: 'Estado del equipo' },
  { icon: '📝', text: 'Agregar nota a un cliente' },
  { icon: '🔄', text: 'Ultimas visitas registradas' },
];

const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Load from localStorage
const loadMessages = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const loadTokens = () => {
  try { return parseInt(localStorage.getItem(STORAGE_TOKENS_KEY) || '0', 10); }
  catch { return 0; }
};
const loadHistory = () => {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const ChatAI = () => {
  const [messages, setMessages] = useState(loadMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [queryHistory, setQueryHistory] = useState(loadHistory);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [tokenCount, setTokenCount] = useState(loadTokens);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_TOKENS_KEY, String(tokenCount));
  }, [tokenCount]);

  useEffect(() => {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(queryHistory));
  }, [queryHistory]);

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

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg = { id: generateId(), role: 'user', content: trimmed, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    setQueryHistory((prev) => [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 15));

    // Send full conversation history for context persistence
    const allMsgs = [...messages, userMsg];
    const history = allMsgs.slice(-40).map((m) => ({ role: m.role, content: m.content }));

    try {
      const result = await aiService.chat(trimmed, history);
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
  }, [isTyping, messages]);

  const handleSubmit = (e) => { e.preventDefault(); sendMessage(inputValue); };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue); } };

  const formatTime = (ts) => {
    try { return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); }
    catch { return ''; }
  };

  const clearChat = () => {
    setMessages([]);
    setTokenCount(0);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TOKENS_KEY);
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
              <span className="chat-ai__status-dot" />
              Asistente ejecutiva
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
                  Tu asistente ejecutiva de AlPelo. Tengo acceso completo al sistema: clientes, equipo, metricas, visitas y configuracion.
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
                {messages.map((msg) => (
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
                        {msg.content}
                      </div>
                      <span className="chat-ai__time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}

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
          <form className="chat-ai__input-area" onSubmit={handleSubmit}>
            {hasMessages && !isTyping && (
              <div className="chat-ai__chips">
                {QUICK_ACTIONS.map((c, i) => (
                  <button key={i} type="button" className="chat-ai__chip" onClick={() => sendMessage(c.text)}>
                    <span>{c.icon}</span> {c.text}
                  </button>
                ))}
              </div>
            )}
            <div className="chat-ai__input-row">
              <textarea
                ref={textareaRef}
                className="chat-ai__input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe una instruccion..."
                rows={1}
                disabled={isTyping}
              />
              <button
                type="submit"
                className={`chat-ai__send ${inputValue.trim() ? 'chat-ai__send--active' : ''}`}
                disabled={!inputValue.trim() || isTyping}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <span className="chat-ai__hint">Enter para enviar · Shift+Enter nueva linea</span>
          </form>
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="chat-ai__sidebar">
            <div className="chat-ai__sidebar-section">
              <h4 className="chat-ai__sidebar-title">Sesion</h4>
              <div className="chat-ai__sidebar-stats">
                <div className="chat-ai__sidebar-stat">
                  <span className="chat-ai__sidebar-stat-val">{responseCount}</span>
                  <span className="chat-ai__sidebar-stat-lbl">Respuestas</span>
                </div>
                <div className="chat-ai__sidebar-stat">
                  <span className="chat-ai__sidebar-stat-val">{tokenCount.toLocaleString()}</span>
                  <span className="chat-ai__sidebar-stat-lbl">Tokens</span>
                </div>
              </div>
            </div>

            <div className="chat-ai__sidebar-section">
              <h4 className="chat-ai__sidebar-title">Capacidades</h4>
              <div className="chat-ai__sidebar-caps">
                <span>👥 Gestionar clientes</span>
                <span>💈 Equipo y staff</span>
                <span>📊 KPIs y metricas</span>
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
