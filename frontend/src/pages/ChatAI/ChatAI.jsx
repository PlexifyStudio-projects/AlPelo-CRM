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
  { icon: '📊', text: 'Dame el resumen completo del negocio', desc: 'Dashboard: KPIs, ingresos, metricas' },
  { icon: '⚠️', text: 'Que clientes estan en riesgo?', desc: 'Clientes sin venir 30+ dias' },
  { icon: '📱', text: 'Como esta el inbox de WhatsApp?', desc: 'Conversaciones, sin leer, IA activa' },
  { icon: '👥', text: 'Dame el estado completo del equipo', desc: 'Barberos, ratings, especialidades' },
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
  const [pendingImage, setPendingImage] = useState(null); // { base64, mime, preview }
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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
                  Tu asistente ejecutiva con control total de AlPelo. Dashboard, clientes, equipo, inbox, plantillas, configuracion — preguntame lo que necesites o pideme que haga cualquier cosa.
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
                              {msg.content}
                            </>
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
                <span>📊 Dashboard y KPIs</span>
                <span>👥 CRM de clientes</span>
                <span>💈 Equipo y staff</span>
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
