import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { mockWhatsAppStats, mockWhatsAppConversations } from '../../data/mockData';

// ===== ICONS =====
const Icons = {
  power: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  ),
  message: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </svg>
  ),
  chat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  send: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  reply: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  bot: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  clock: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

// ===== ANIMATED NUMBER =====
const AnimatedNumber = ({ value, suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numericValue = typeof value === 'number' ? value : parseInt(value, 10) || 0;
    if (numericValue === 0) { setDisplayValue(0); return; }

    const duration = 1200;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.round(numericValue * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{displayValue.toLocaleString('es-CO')}{suffix}</span>;
};

// ===== MOCK ACTIVITY LOG =====
const generateActivityLog = () => {
  const actions = [
    { type: 'sent', text: 'Recordatorio de cita enviado a Carlos Mendoza', time: '10:18 AM' },
    { type: 'reply', text: 'Miguel Ángel Torres confirmó su cita del sábado', time: '10:15 AM' },
    { type: 'sent', text: 'Mensaje de bienvenida enviado a Emmanuel Rojas', time: '9:45 AM' },
    { type: 'auto', text: 'Campaña de reactivación enviada a 5 clientes inactivos', time: '9:30 AM' },
    { type: 'reply', text: 'David López confirmó cita de Spa Manicure', time: '9:15 AM' },
    { type: 'sent', text: 'Feedback post-visita enviado a Nicolás Pabón', time: '8:50 AM' },
    { type: 'auto', text: 'Plantilla de recordatorio 24h enviada a 3 clientes', time: '8:30 AM' },
    { type: 'reply', text: 'Valentina Morales respondió encuesta: 5/5', time: '8:15 AM' },
    { type: 'sent', text: 'Promo especial enviada a clientes VIP', time: '8:00 AM' },
    { type: 'auto', text: 'Lina inició turno. Revisando agenda del día...', time: '7:55 AM' },
  ];
  return actions;
};

const getActionIcon = (type) => {
  switch (type) {
    case 'sent': return Icons.send;
    case 'reply': return Icons.reply;
    case 'auto': return Icons.bot;
    default: return Icons.message;
  }
};

const getActionClass = (type) => {
  switch (type) {
    case 'sent': return 'success';
    case 'reply': return 'info';
    case 'auto': return 'accent';
    default: return 'primary';
  }
};

// ===== MAIN DASHBOARD =====
const Dashboard = () => {
  const { user } = useAuth();
  const [linaActive, setLinaActive] = useState(true);
  const [animating, setAnimating] = useState(false);

  const stats = mockWhatsAppStats;
  const activityLog = useMemo(() => generateActivityLog(), []);
  const totalUnread = mockWhatsAppConversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const handleToggle = () => {
    setAnimating(true);
    setTimeout(() => {
      setLinaActive((prev) => !prev);
      setAnimating(false);
    }, 600);
  };

  return (
    <div className="lina-panel">
      {/* ===== HEADER ===== */}
      <div className="lina-panel__header">
        <div className="lina-panel__header-left">
          <div className={`lina-panel__status-dot ${linaActive ? 'lina-panel__status-dot--active' : 'lina-panel__status-dot--inactive'}`} />
          <div className="lina-panel__header-info">
            <h1 className="lina-panel__title">Lina IA</h1>
            <p className="lina-panel__subtitle">
              {linaActive ? 'Activa — Gestionando mensajes y citas' : 'Inactiva — En pausa'}
            </p>
          </div>
        </div>
        <div className="lina-panel__header-right">
          <span className={`lina-panel__status-badge ${linaActive ? 'lina-panel__status-badge--active' : 'lina-panel__status-badge--inactive'}`}>
            {linaActive ? 'En línea' : 'Desconectada'}
          </span>
        </div>
      </div>

      {/* ===== POWER TOGGLE ===== */}
      <div className="lina-panel__toggle-section">
        <button
          className={`lina-panel__power-btn ${linaActive ? 'lina-panel__power-btn--active' : ''} ${animating ? 'lina-panel__power-btn--animating' : ''}`}
          onClick={handleToggle}
          aria-label={linaActive ? 'Desactivar Lina' : 'Activar Lina'}
        >
          <div className="lina-panel__power-ring" />
          <div className="lina-panel__power-icon">
            {Icons.power}
          </div>
        </button>
        <p className="lina-panel__toggle-label">
          {linaActive
            ? 'Lina está activa — enviando mensajes, respondiendo chats, gestionando citas'
            : 'Lina está en pausa — los mensajes no se enviarán automáticamente'
          }
        </p>
        <button className="lina-panel__toggle-text-btn" onClick={handleToggle}>
          {linaActive ? 'Desactivar Lina' : 'Activar Lina'}
        </button>
      </div>

      {/* ===== LIVE STATS ===== */}
      <div className="lina-panel__stats">
        <div className="lina-panel__stat-card lina-panel__stat-card--success">
          <div className="lina-panel__stat-icon">{Icons.message}</div>
          <div className="lina-panel__stat-data">
            <span className="lina-panel__stat-number"><AnimatedNumber value={stats.messagesToday} /></span>
            <span className="lina-panel__stat-label">Mensajes enviados hoy</span>
          </div>
        </div>

        <div className="lina-panel__stat-card lina-panel__stat-card--info">
          <div className="lina-panel__stat-icon">{Icons.chat}</div>
          <div className="lina-panel__stat-data">
            <span className="lina-panel__stat-number"><AnimatedNumber value={stats.conversationsActive} /></span>
            <span className="lina-panel__stat-label">Chats gestionados</span>
          </div>
        </div>

        <div className="lina-panel__stat-card lina-panel__stat-card--primary">
          <div className="lina-panel__stat-icon">{Icons.users}</div>
          <div className="lina-panel__stat-data">
            <span className="lina-panel__stat-number"><AnimatedNumber value={mockWhatsAppConversations.length} /></span>
            <span className="lina-panel__stat-label">Clientes contactados</span>
          </div>
        </div>

        <div className="lina-panel__stat-card lina-panel__stat-card--accent">
          <div className="lina-panel__stat-icon">{Icons.check}</div>
          <div className="lina-panel__stat-data">
            <span className="lina-panel__stat-number"><AnimatedNumber value={stats.responseRate} suffix="%" /></span>
            <span className="lina-panel__stat-label">Tasa de respuesta</span>
          </div>
        </div>
      </div>

      {/* ===== ACTIVITY LOG ===== */}
      <div className="lina-panel__log">
        <div className="lina-panel__log-header">
          <h3 className="lina-panel__log-title">Actividad de Lina</h3>
          <span className="lina-panel__log-badge">Hoy</span>
        </div>
        <div className="lina-panel__log-list">
          {activityLog.map((action, index) => (
            <div
              key={index}
              className={`lina-panel__log-item ${!linaActive && index === 0 ? 'lina-panel__log-item--paused' : ''}`}
              style={{ animationDelay: `${0.04 * (index + 1)}s` }}
            >
              <div className={`lina-panel__log-icon lina-panel__log-icon--${getActionClass(action.type)}`}>
                {getActionIcon(action.type)}
              </div>
              <div className="lina-panel__log-content">
                <span className="lina-panel__log-text">{action.text}</span>
                <span className="lina-panel__log-time">
                  {Icons.clock} {action.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
