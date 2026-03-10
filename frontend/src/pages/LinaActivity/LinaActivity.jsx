import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

// ===== ICONS =====
const Icons = {
  pulse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  message: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  zap: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  alertTriangle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  xCircle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  skipForward: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
};

const STATUS_CONFIG = {
  ok: { icon: Icons.check, className: 'lina-activity__status--ok', label: 'Exitoso' },
  info: { icon: Icons.info, className: 'lina-activity__status--info', label: 'Info' },
  warning: { icon: Icons.alertTriangle, className: 'lina-activity__status--warning', label: 'Atencion' },
  error: { icon: Icons.xCircle, className: 'lina-activity__status--error', label: 'Error' },
};

const TYPE_CONFIG = {
  respuesta: { icon: Icons.send, label: 'Respuesta', color: 'primary' },
  accion: { icon: Icons.zap, label: 'Accion', color: 'accent' },
  tarea: { icon: Icons.calendar, label: 'Tarea', color: 'success' },
  sistema: { icon: Icons.settings, label: 'Sistema', color: 'info' },
  skip: { icon: Icons.skipForward, label: 'Omitido', color: 'neutral' },
  error: { icon: Icons.xCircle, label: 'Error', color: 'error' },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todo' },
  { value: 'respuesta', label: 'Respuestas' },
  { value: 'accion', label: 'Acciones' },
  { value: 'tarea', label: 'Tareas' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'skip', label: 'Omitidos' },
  { value: 'error', label: 'Errores' },
];


const LinaActivity = () => {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const isLive = true; // Always live — status indicator only
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tokenStatus, setTokenStatus] = useState(null);
  const intervalRef = useRef(null);
  const feedRef = useRef(null);
  const prevCountRef = useRef(0);

  const fetchActivity = useCallback(async () => {
    try {
      const resp = await fetch(`${API_URL}/lina/activity?limit=200`, { credentials: 'include' });
      if (!resp.ok) return;
      const data = await resp.json();
      setEvents(data.events || []);
      setStats(data.stats || null);
      setLastUpdate(new Date());

      // Auto-scroll to top if new events
      if (data.events?.length > prevCountRef.current && feedRef.current) {
        feedRef.current.scrollTop = 0;
      }
      prevCountRef.current = data.events?.length || 0;
    } catch (err) {
      console.error('Activity fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkToken = useCallback(async () => {
    try {
      const resp = await fetch(`${API_URL}/lina/health`, { credentials: 'include' });
      if (resp.ok) setTokenStatus(await resp.json());
    } catch { setTokenStatus({ status: 'error', message: 'No se pudo verificar' }); }
  }, []);

  useEffect(() => {
    fetchActivity();
    checkToken();
    intervalRef.current = setInterval(fetchActivity, 5000);
    const tokenInterval = setInterval(checkToken, 60000);
    return () => { clearInterval(intervalRef.current); clearInterval(tokenInterval); };
  }, [fetchActivity, checkToken]);

  const filteredEvents = filter === 'all' ? events : events.filter(e => e.event_type === filter);

  const statCards = stats ? [
    { label: 'Mensajes enviados', value: stats.messages_sent, icon: Icons.send, color: 'primary' },
    { label: 'Acciones ejecutadas', value: stats.actions_executed, icon: Icons.zap, color: 'accent' },
    { label: 'Tareas completadas', value: stats.tasks_completed, icon: Icons.check, color: 'success' },
    { label: 'Envios fallidos', value: stats.messages_failed, icon: Icons.xCircle, color: 'error' },
    { label: 'Mensajes omitidos', value: stats.skips, icon: Icons.skipForward, color: 'neutral' },
    { label: 'Chats respondidos', value: stats.conversations_replied, icon: Icons.message, color: 'info' },
  ] : [];

  return (
    <div className="lina-activity">
      {/* Header */}
      <div className="lina-activity__header">
        <div className="lina-activity__header-left">
          <div className="lina-activity__title-row">
            <span className="lina-activity__icon">{Icons.pulse}</span>
            <h1 className="lina-activity__title">Actividad de Lina</h1>
          </div>
          <p className="lina-activity__subtitle">Monitoreo en tiempo real de todas las acciones de Lina IA</p>
        </div>
        <div className="lina-activity__header-right">
          <span className="lina-activity__live-btn lina-activity__live-btn--active">
            <span className="lina-activity__live-dot lina-activity__live-dot--pulse" />
            EN VIVO
          </span>
          {lastUpdate && (
            <span className="lina-activity__last-update">
              Actualizado: {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Token Status */}
      {tokenStatus && (
        <div className={`lina-activity__token-bar lina-activity__token-bar--${tokenStatus.status}`}>
          <span className={`lina-activity__token-dot lina-activity__token-dot--${tokenStatus.status}`} />
          <span className="lina-activity__token-label">WhatsApp:</span>
          <span className="lina-activity__token-msg">{tokenStatus.message}</span>
          <button className="lina-activity__token-check" onClick={checkToken}>Verificar</button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="lina-activity__stats">
          {statCards.map((card, i) => (
            <div key={i} className={`lina-activity__stat-card lina-activity__stat-card--${card.color}`}>
              <div className="lina-activity__stat-icon">{card.icon}</div>
              <div className="lina-activity__stat-info">
                <span className="lina-activity__stat-value">{card.value}</span>
                <span className="lina-activity__stat-label">{card.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="lina-activity__filters">
        <div className="lina-activity__filter-pills">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`lina-activity__filter-pill ${filter === opt.value ? 'lina-activity__filter-pill--active' : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="lina-activity__event-count">
          {filteredEvents.length} {filteredEvents.length === 1 ? 'evento' : 'eventos'}
        </span>
      </div>

      {/* Event feed */}
      <div className="lina-activity__feed" ref={feedRef}>
        {loading ? (
          <div className="lina-activity__loading">
            <div className="lina-activity__spinner" />
            <span>Cargando actividad...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="lina-activity__empty">
            <span className="lina-activity__empty-icon">{Icons.clock}</span>
            <h3>Sin actividad registrada</h3>
            <p>Los eventos de Lina apareceran aqui en tiempo real cuando empiece a trabajar.</p>
          </div>
        ) : (
          filteredEvents.map((event, idx) => {
            const typeConf = TYPE_CONFIG[event.event_type] || TYPE_CONFIG.sistema;
            const statusConf = STATUS_CONFIG[event.status] || STATUS_CONFIG.info;

            return (
              <div
                key={event.id || idx}
                className={`lina-activity__event lina-activity__event--${typeConf.color} ${idx === 0 ? 'lina-activity__event--latest' : ''}`}
              >
                <div className="lina-activity__event-time">
                  <span className="lina-activity__event-hour">{event.time_display}</span>
                </div>

                <div className="lina-activity__event-line">
                  <div className={`lina-activity__event-dot lina-activity__event-dot--${event.status}`} />
                  {idx < filteredEvents.length - 1 && <div className="lina-activity__event-connector" />}
                </div>

                <div className="lina-activity__event-content">
                  <div className="lina-activity__event-header">
                    <span className={`lina-activity__event-type lina-activity__event-type--${typeConf.color}`}>
                      {typeConf.icon}
                      {typeConf.label}
                    </span>
                    <span className={`lina-activity__event-status ${statusConf.className}`}>
                      {statusConf.icon}
                    </span>
                  </div>

                  <p className="lina-activity__event-desc">{event.description}</p>

                  {event.contact_name && (
                    <span className="lina-activity__event-contact">{event.contact_name}</span>
                  )}

                  {event.detail && (
                    <p className="lina-activity__event-detail">{event.detail}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LinaActivity;
