import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

// ===== ICONS (inline SVGs) =====
const Icons = {
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  checkCircle: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  calendar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  dollar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  alert: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  bot: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  message: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </svg>
  ),
  zap: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  chat: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  mail: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  clock: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  clipboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
};

// ===== ANIMATED NUMBER =====
const AnimatedNumber = ({ value, prefix = '', suffix = '' }) => {
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

  return <span>{prefix}{displayValue.toLocaleString('es-CO')}{suffix}</span>;
};

// ===== FORMAT COP =====
const formatCOP = (value) => {
  if (!value && value !== 0) return '$0';
  return `$${Number(value).toLocaleString('es-CO')}`;
};

// ===== TIME AGO =====
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
};

// ===== STATUS BADGE CONFIG =====
const STATUS_CONFIG = {
  confirmed: { label: 'Confirmada', modifier: 'success' },
  completed: { label: 'Completada', modifier: 'info' },
  cancelled: { label: 'Cancelada', modifier: 'error' },
  pending: { label: 'Pendiente', modifier: 'warning' },
  no_show: { label: 'No asistio', modifier: 'error' },
};

// ===== SKELETON LOADER =====
const SkeletonCard = () => (
  <div className="dashboard__kpi-card dashboard__kpi-card--skeleton">
    <div className="dashboard__kpi-icon dashboard__kpi-icon--skeleton" />
    <div className="dashboard__kpi-info">
      <div className="dashboard__skeleton-line dashboard__skeleton-line--short" />
      <div className="dashboard__skeleton-line dashboard__skeleton-line--long" />
    </div>
  </div>
);

const SkeletonRow = () => (
  <div className="dashboard__agenda-row dashboard__agenda-row--skeleton">
    <div className="dashboard__skeleton-line dashboard__skeleton-line--xs" />
    <div className="dashboard__skeleton-line dashboard__skeleton-line--medium" />
    <div className="dashboard__skeleton-line dashboard__skeleton-line--medium" />
    <div className="dashboard__skeleton-line dashboard__skeleton-line--short" />
    <div className="dashboard__skeleton-line dashboard__skeleton-line--xs" />
  </div>
);

// ===== MAIN DASHBOARD =====
const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linaToggling, setLinaToggling] = useState(false);
  const [paymentAlerts, setPaymentAlerts] = useState([]);
  const [dismissingAlert, setDismissingAlert] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard/stats`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + every 30s
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Sync payment alerts from stats
  useEffect(() => {
    if (stats?.payment_alerts) setPaymentAlerts(stats.payment_alerts);
  }, [stats]);

  const dismissPaymentAlert = async (convId) => {
    setDismissingAlert(convId);
    try {
      await fetch(`${API_URL}/payment-alert/${convId}`, { method: 'DELETE', credentials: 'include' });
      setPaymentAlerts(prev => prev.filter(a => a.conversation_id !== convId));
    } catch (e) { console.error(e); }
    setDismissingAlert(null);
  };

  const resolveTask = async (noteId) => {
    try {
      await fetch(`${API_URL}/notes/${noteId}/resolve`, { method: 'PUT', credentials: 'include' });
      fetchStats();
    } catch (e) { console.error(e); }
  };

  // Toggle Lina IA globally
  const handleLinaToggle = async () => {
    if (linaToggling || !stats) return;
    setLinaToggling(true);
    const newState = !stats.lina_is_global_active;

    // Optimistic update
    setStats(prev => ({ ...prev, lina_is_global_active: newState }));

    try {
      const res = await fetch(`${API_URL}/whatsapp/toggle-all-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enable: newState }),
      });
      if (!res.ok) {
        // Revert on failure
        setStats(prev => ({ ...prev, lina_is_global_active: !newState }));
      }
    } catch {
      setStats(prev => ({ ...prev, lina_is_global_active: !newState }));
    } finally {
      setLinaToggling(false);
    }
  };

  // ===== LOADING STATE =====
  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard__header">
          <h1 className="dashboard__title">Dashboard</h1>
          <p className="dashboard__subtitle">Cargando datos...</p>
        </div>
        <div className="dashboard__kpis">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="dashboard__body">
          <div className="dashboard__agenda">
            <div className="dashboard__section-header">
              <div className="dashboard__skeleton-line dashboard__skeleton-line--medium" />
            </div>
            {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
          <div className="dashboard__lina">
            <div className="dashboard__skeleton-line dashboard__skeleton-line--long" />
          </div>
        </div>
      </div>
    );
  }

  // ===== ERROR STATE =====
  if (error && !stats) {
    return (
      <div className="dashboard">
        <div className="dashboard__header">
          <h1 className="dashboard__title">Dashboard</h1>
        </div>
        <div className="dashboard__error">
          <div className="dashboard__error-icon">{Icons.alert}</div>
          <p className="dashboard__error-text">No se pudieron cargar los datos</p>
          <p className="dashboard__error-detail">{error}</p>
          <button className="dashboard__error-btn" onClick={fetchStats}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const linaActive = stats.lina_is_global_active;
  const appointments = stats.appointments_today_list || [];
  const allTasks = stats.pending_tasks || [];
  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const completedTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'expired');
  const topServices = stats.top_services_today || [];

  return (
    <div className="dashboard">
      {/* ===== HEADER ===== */}
      <div className="dashboard__header">
        <div className="dashboard__header-left">
          <h1 className="dashboard__title">Dashboard</h1>
          <p className="dashboard__subtitle">Panel ejecutivo — AlPelo Peluqueria</p>
        </div>
        <div className="dashboard__header-right">
          <span className="dashboard__live-dot" />
          <span className="dashboard__live-label">En vivo</span>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="dashboard__kpis">
        <div className="dashboard__kpi-card">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--primary">{Icons.users}</div>
          <div className="dashboard__kpi-info">
            <span className="dashboard__kpi-value">
              <AnimatedNumber value={stats.total_clients} />
            </span>
            <span className="dashboard__kpi-label">Total Clientes</span>
            <span className="dashboard__kpi-sub">+{stats.new_clients_this_month || 0} este mes</span>
          </div>
        </div>

        <div className="dashboard__kpi-card">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--success">{Icons.checkCircle}</div>
          <div className="dashboard__kpi-info">
            <span className="dashboard__kpi-value">
              <AnimatedNumber value={stats.active_clients} />
            </span>
            <span className="dashboard__kpi-label">Clientes Activos</span>
            <span className="dashboard__kpi-sub">{stats.vip_clients || 0} VIP</span>
          </div>
        </div>

        <div className="dashboard__kpi-card">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--info">{Icons.calendar}</div>
          <div className="dashboard__kpi-info">
            <span className="dashboard__kpi-value">
              <AnimatedNumber value={stats.appointments_today} />
            </span>
            <span className="dashboard__kpi-label">Citas Hoy</span>
            <span className="dashboard__kpi-sub">{stats.completed_today || 0} completadas</span>
          </div>
        </div>

        <div className="dashboard__kpi-card">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--accent">{Icons.dollar}</div>
          <div className="dashboard__kpi-info">
            <span className="dashboard__kpi-value">
              <AnimatedNumber value={stats.revenue_this_month} prefix="$" />
            </span>
            <span className="dashboard__kpi-label">Ingresos del Mes</span>
            <span className="dashboard__kpi-sub">{formatCOP(stats.revenue_this_week)} esta semana</span>
          </div>
        </div>

        <div className="dashboard__kpi-card dashboard__kpi-card--warning">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--warning">{Icons.alert}</div>
          <div className="dashboard__kpi-info">
            <span className="dashboard__kpi-value">
              <AnimatedNumber value={stats.at_risk_clients} />
            </span>
            <span className="dashboard__kpi-label">Clientes en Riesgo</span>
            <span className="dashboard__kpi-sub">Sin visita reciente</span>
          </div>
        </div>
      </div>

      {/* ===== MIDDLE SECTION: AGENDA + LINA ===== */}
      <div className="dashboard__body">
        {/* --- AGENDA DE HOY --- */}
        <div className="dashboard__agenda">
          <div className="dashboard__section-header">
            <h2 className="dashboard__section-title">
              {Icons.calendar}
              Agenda de Hoy
            </h2>
            <span className="dashboard__section-badge">{appointments.length} citas</span>
          </div>

          {appointments.length === 0 ? (
            <div className="dashboard__agenda-empty">
              <p>No hay citas agendadas para hoy</p>
            </div>
          ) : (
            <div className="dashboard__agenda-table">
              <div className="dashboard__agenda-header-row">
                <span>Hora</span>
                <span>Cliente</span>
                <span>Servicio</span>
                <span>Barbero</span>
                <span>Estado</span>
              </div>
              {appointments.map((appt) => {
                const statusCfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
                return (
                  <div key={appt.id} className="dashboard__agenda-row">
                    <span className="dashboard__agenda-time">{appt.time}</span>
                    <span className="dashboard__agenda-client">{appt.client_name}</span>
                    <span className="dashboard__agenda-service">{appt.service_name}</span>
                    <span className="dashboard__agenda-staff">{appt.staff_name}</span>
                    <span className={`dashboard__agenda-status dashboard__agenda-status--${statusCfg.modifier}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top services of the day */}
          {topServices.length > 0 && (
            <div className="dashboard__top-services">
              <span className="dashboard__top-services-label">Servicios populares hoy:</span>
              {topServices.map((svc, i) => (
                <span key={i} className="dashboard__top-services-tag">
                  {svc.name} ({svc.count})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* --- LINA IA PANEL --- */}
        <div className="dashboard__lina">
          <div className="dashboard__section-header">
            <h2 className="dashboard__section-title">
              {Icons.bot}
              Lina IA
            </h2>
            <span className={`dashboard__lina-badge ${linaActive ? 'dashboard__lina-badge--active' : 'dashboard__lina-badge--inactive'}`}>
              {linaActive ? 'Activa' : 'Inactiva'}
            </span>
          </div>

          {/* Toggle */}
          <div className="dashboard__lina-toggle">
            <span className="dashboard__lina-toggle-label">
              {linaActive ? 'Respondiendo chats automaticamente' : 'IA pausada — sin respuestas automaticas'}
            </span>
            <button
              className={`dashboard__toggle-switch ${linaActive ? 'dashboard__toggle-switch--on' : ''}`}
              onClick={handleLinaToggle}
              disabled={linaToggling}
              aria-label={linaActive ? 'Desactivar Lina IA' : 'Activar Lina IA'}
            >
              <span className="dashboard__toggle-knob" />
            </button>
          </div>

          {/* Stats grid */}
          <div className="dashboard__lina-stats">
            <div className="dashboard__lina-stat">
              <div className="dashboard__lina-stat-icon">{Icons.message}</div>
              <div className="dashboard__lina-stat-info">
                <span className="dashboard__lina-stat-value">{stats.lina_messages_today || 0}</span>
                <span className="dashboard__lina-stat-label">Mensajes hoy</span>
              </div>
            </div>

            <div className="dashboard__lina-stat">
              <div className="dashboard__lina-stat-icon">{Icons.zap}</div>
              <div className="dashboard__lina-stat-info">
                <span className="dashboard__lina-stat-value">{stats.lina_actions_today || 0}</span>
                <span className="dashboard__lina-stat-label">Acciones hoy</span>
              </div>
            </div>

            <div className="dashboard__lina-stat">
              <div className="dashboard__lina-stat-icon">{Icons.chat}</div>
              <div className="dashboard__lina-stat-info">
                <span className="dashboard__lina-stat-value">
                  {stats.whatsapp_active_conversations || 0}/{stats.whatsapp_total_conversations || 0}
                </span>
                <span className="dashboard__lina-stat-label">Chats activos</span>
              </div>
            </div>

            <div className="dashboard__lina-stat">
              <div className="dashboard__lina-stat-icon">{Icons.mail}</div>
              <div className="dashboard__lina-stat-info">
                <span className="dashboard__lina-stat-value dashboard__lina-stat-value--unread">
                  {stats.whatsapp_unread || 0}
                </span>
                <span className="dashboard__lina-stat-label">No leidos</span>
              </div>
            </div>
          </div>

          {/* WhatsApp summary */}
          <div className="dashboard__lina-wa">
            <span className="dashboard__lina-wa-label">WhatsApp hoy</span>
            <span className="dashboard__lina-wa-value">{stats.whatsapp_messages_today || 0} mensajes</span>
          </div>
        </div>
      </div>

      {/* ===== PAYMENT ALERTS ===== */}
      {paymentAlerts.length > 0 && (
        <div className="dashboard__payment-alerts">
          <div className="dashboard__section-header">
            <h2 className="dashboard__section-title dashboard__section-title--alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Pagos por Verificar
            </h2>
            <span className="dashboard__alerts-count">{paymentAlerts.length}</span>
          </div>
          <div className="dashboard__alerts-list">
            {paymentAlerts.map((alert) => (
              <div key={alert.conversation_id} className="dashboard__alert-item">
                <div className="dashboard__alert-icon">$</div>
                <div className="dashboard__alert-content dashboard__alert-content--clickable" onClick={() => onNavigate && onNavigate('inbox')}>
                  <span className="dashboard__alert-client">{alert.client_name}</span>
                  <span className="dashboard__alert-phone">{alert.phone}</span>
                  <span className="dashboard__alert-goto">Ver en Inbox →</span>
                </div>
                <button
                  className="dashboard__alert-dismiss"
                  onClick={() => dismissPaymentAlert(alert.conversation_id)}
                  disabled={dismissingAlert === alert.conversation_id}
                  title="Descartar alerta"
                >
                  {dismissingAlert === alert.conversation_id ? '...' : '✕'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== PENDING TASKS ===== */}
      <div className="dashboard__tasks">
        <div className="dashboard__section-header">
          <h2 className="dashboard__section-title">
            {Icons.clipboard}
            Tareas de Lina
          </h2>
          <span className="dashboard__tasks-count">{pendingTasks.length}</span>
        </div>

        {pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="dashboard__tasks-empty">
            <p>No hay tareas pendientes</p>
          </div>
        ) : (
          <div className="dashboard__tasks-list">
            {pendingTasks.map((task) => {
              const content = (task.content || '').replace(/^PENDIENTE:\s*/i, '');
              return (
                <div key={task.id} className="dashboard__task-item">
                  <div className="dashboard__task-dot" />
                  <div className="dashboard__task-content">
                    <span className="dashboard__task-client">{task.client_name}</span>
                    <span className="dashboard__task-text">{content}</span>
                  </div>
                  <div className="dashboard__task-actions">
                    <span className="dashboard__task-time">
                      {Icons.clock} {timeAgo(task.created_at)}
                    </span>
                    <button className="dashboard__task-resolve" onClick={() => resolveTask(task.id)} title="Marcar como resuelta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {completedTasks.map((task) => {
              const content = (task.content || '')
                .replace(/^(COMPLETADO|RESUELTO|EXPIRADO):\s*/i, '')
                .replace(/\s*\[Auto-resuelto.*?\]/, '')
                .replace(/\s*\[Expirado.*?\]/, '');
              return (
                <div key={task.id} className={`dashboard__task-item dashboard__task-item--${task.status}`}>
                  <div className="dashboard__task-check">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div className="dashboard__task-content">
                    <span className="dashboard__task-client">{task.client_name}</span>
                    <span className="dashboard__task-text dashboard__task-text--done">{content}</span>
                  </div>
                  <span className="dashboard__task-badge">
                    {task.status === 'completed' ? 'Completada' : 'Expirada'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
