import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTenant } from '../../context/TenantContext';
import UsageMeter from '../../components/common/UsageMeter/UsageMeter';
import EmptyState from '../../components/common/EmptyState/EmptyState';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

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

/** Calculate countdown for pending tasks: how many minutes left until execution */
const taskCountdown = (createdAt, content) => {
  if (!createdAt) return null;
  // Parse delay from content (e.g. "en 10 min", "en 5 minutos")
  const match = (content || '').match(/en\s+(\d+)\s*min/i);
  const delayMin = match ? parseInt(match[1]) : 5;
  const created = new Date(createdAt);
  const executeAt = new Date(created.getTime() + delayMin * 60000);
  const now = new Date();
  const remainMs = executeAt - now;
  if (remainMs <= 0) return { text: 'Ejecutando...', done: true };
  const remainMin = Math.floor(remainMs / 60000);
  const remainSec = Math.floor((remainMs % 60000) / 1000);
  if (remainMin > 0) return { text: `${remainMin}m ${remainSec}s`, done: false };
  return { text: `${remainSec}s`, done: false };
};

// ===== CHART COLORS (match status badges) =====
const CHART_COLORS = {
  confirmed: '#34D399',
  completed: '#60A5FA',
  paid: '#3B82F6',
  cancelled: '#F87171',
  pending: '#FBBF24',
  no_show: '#E05252',
};

// ===== CUSTOM TOOLTIP for revenue chart =====
const RevenueTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dashboard__chart-tooltip">
      <span className="dashboard__chart-tooltip-label">{payload[0].payload.label}</span>
      <span className="dashboard__chart-tooltip-value">{formatCOP(payload[0].value)}</span>
    </div>
  );
};

// ===== CUSTOM LEGEND for pie chart =====
const StatusLegend = ({ payload }) => {
  const total = payload?.reduce((s, e) => s + (e.payload?.value || 0), 0) || 0;
  return (
    <div className="dashboard__status-legend">
      {payload?.map((entry, i) => {
        const pct = total > 0 ? Math.round((entry.payload.value / total) * 100) : 0;
        return (
          <span key={i} className="dashboard__status-legend-item">
            <span className="dashboard__status-legend-dot" style={{ background: entry.color }} />
            {entry.value} {pct}%
          </span>
        );
      })}
    </div>
  );
};

// ===== STATUS BADGE CONFIG =====
const STATUS_CONFIG = {
  confirmed: { label: 'Confirmada', modifier: 'success' },
  completed: { label: 'Completada', modifier: 'info' },
  paid: { label: 'Pagada', modifier: 'info' },
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
  const { tenant } = useTenant();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linaToggling, setLinaToggling] = useState(false);
  const [paymentAlerts, setPaymentAlerts] = useState([]);
  const [dismissingAlert, setDismissingAlert] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [, setTick] = useState(0); // Forces re-render every second for countdowns

  // Tick every second when there are pending tasks
  useEffect(() => {
    const hasPending = (stats?.pending_tasks || []).some(t => t.status === 'pending');
    if (!hasPending) return;
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [stats?.pending_tasks]);

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
      // Build revenue chart from paid appointments data
      if (data.revenue_by_day && Array.isArray(data.revenue_by_day)) {
        setRevenueData(data.revenue_by_day.map(d => ({ label: d.date, value: d.revenue || 0 })));
      }
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
    if (linaToggling || !stats || tenant.ai_is_paused) return;
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

  // Compute trend indicators from available data
  const newClients = stats.new_clients_this_month || 0;
  const totalCl = stats.total_clients || 1;
  const trends = {
    clientsTrend: totalCl > 0 ? Math.round((newClients / totalCl) * 100) : 0,
    activePct: totalCl > 0 ? Math.round(((stats.active_clients || 0) / totalCl) * 100) - 50 : 0,
    apptsTrend: (stats.appointments_today || 1) > 0 ? Math.round(((stats.completed_today || 0) / (stats.appointments_today || 1)) * 100) : 0,
    revTrend: (stats.revenue_this_month || 1) > 0 ? Math.round(((stats.revenue_this_week || 0) / (stats.revenue_this_month || 1)) * 100) : 0,
    riskTrend: (stats.at_risk_clients || 0) > 0 ? -Math.round(((stats.at_risk_clients || 0) / totalCl) * 100) : 0,
  };

  // Appointment status breakdown for pie chart
  const statusCounts = {};
  (stats.appointments_today_list || []).forEach(appt => {
    const s = appt.status || 'pending';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const appointmentStatusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: (STATUS_CONFIG[status] || STATUS_CONFIG.pending).label,
    value: count,
    status,
  }));

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
          <p className="dashboard__subtitle">Panel ejecutivo — {tenant.name}</p>
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
            <span className="dashboard__kpi-sub">
              +{stats.new_clients_this_month || 0} este mes
              {trends.clientsTrend !== 0 && (
                <span className={`dashboard__kpi-trend dashboard__kpi-trend--${trends.clientsTrend >= 0 ? 'up' : 'down'}`}>
                  {trends.clientsTrend >= 0 ? '\u2191' : '\u2193'} {Math.abs(trends.clientsTrend)}%
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="dashboard__kpi-card">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--success">{Icons.checkCircle}</div>
          <div className="dashboard__kpi-info">
            <span className="dashboard__kpi-value">
              <AnimatedNumber value={stats.active_clients} />
            </span>
            <span className="dashboard__kpi-label">Clientes Activos</span>
            <span className="dashboard__kpi-sub">
              {stats.vip_clients || 0} VIP
              {trends.activePct !== 0 && (
                <span className={`dashboard__kpi-trend dashboard__kpi-trend--${trends.activePct >= 0 ? 'up' : 'down'}`}>
                  {trends.activePct >= 0 ? '\u2191' : '\u2193'} {Math.abs(trends.activePct)}%
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="dashboard__kpi-card">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--info">{Icons.calendar}</div>
          <div className="dashboard__kpi-info">
            <span className="dashboard__kpi-value">
              <AnimatedNumber value={stats.appointments_today} />
            </span>
            <span className="dashboard__kpi-label">Citas Hoy</span>
            <span className="dashboard__kpi-sub">
              {stats.completed_today || 0} completadas
              {stats.appointments_today > 0 && (
                <span className={`dashboard__kpi-trend dashboard__kpi-trend--${trends.apptsTrend >= 50 ? 'up' : 'down'}`}>
                  {trends.apptsTrend >= 50 ? '\u2191' : '\u2193'} {trends.apptsTrend}%
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="dashboard__kpi-card">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--accent">{Icons.dollar}</div>
          <div className="dashboard__kpi-info">
            <span className="dashboard__kpi-value">
              <AnimatedNumber value={stats.revenue_this_month} prefix="$" />
            </span>
            <span className="dashboard__kpi-label">Ingresos del Mes</span>
            <span className="dashboard__kpi-sub">
              {formatCOP(stats.revenue_this_week)} esta semana
              {trends.revTrend > 0 && (
                <span className="dashboard__kpi-trend dashboard__kpi-trend--up">
                  {'\u2191'} {trends.revTrend}%
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="dashboard__kpi-card dashboard__kpi-card--warning">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--warning">{Icons.alert}</div>
          <div className="dashboard__kpi-info">
            <span className="dashboard__kpi-value">
              <AnimatedNumber value={stats.at_risk_clients} />
            </span>
            <span className="dashboard__kpi-label">Clientes en Riesgo</span>
            <span className="dashboard__kpi-sub">
              Sin visita reciente
              {trends.riskTrend !== 0 && (
                <span className={`dashboard__kpi-trend dashboard__kpi-trend--${trends.riskTrend >= 0 ? 'up' : 'down'}`}>
                  {trends.riskTrend >= 0 ? '\u2191' : '\u2193'} {Math.abs(trends.riskTrend)}%
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ===== CHARTS SECTION ===== */}
      <div className="dashboard__chart-section">
        {/* Revenue sparkline */}
        <div className="dashboard__revenue-chart">
          <div className="dashboard__section-header">
            <h2 className="dashboard__section-title">
              {Icons.dollar}
              Ingresos - Ultimos 7 dias
            </h2>
          </div>
          {revenueData.length > 0 ? (
            <div className="dashboard__revenue-chart-area">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1E40AF" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1E40AF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#8E8E85' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#1E40AF"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#1E40AF', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard__chart-empty">
              <p>Sin datos de ingresos diarios disponibles</p>
              {/* Revenue chart - data from /finances/analytics → revenue_by_day */}
            </div>
          )}
        </div>

        {/* Appointment status donut */}
        <div className="dashboard__status-chart">
          <div className="dashboard__section-header">
            <h2 className="dashboard__section-title">
              {Icons.calendar}
              Estado de Citas
            </h2>
            <span className="dashboard__section-badge">{appointments.length} total</span>
          </div>
          {appointmentStatusData.length > 0 ? (
            <div className="dashboard__status-chart-area">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={appointmentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {appointmentStatusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[entry.status] || '#B5B5AE'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => {
                      const total = appointmentStatusData.reduce((s, e) => s + e.value, 0);
                      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                      return [`${value} cita${value !== 1 ? 's' : ''} (${pct}%)`, name];
                    }}
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Legend content={<StatusLegend />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard__chart-empty">
              <p>No hay citas agendadas para hoy</p>
            </div>
          )}
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
            <EmptyState
              icon={Icons.calendar}
              title="No hay citas para hoy"
              description="La agenda del día está vacía"
            />
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
            <span className={`dashboard__lina-badge ${tenant.ai_is_paused ? 'dashboard__lina-badge--blocked' : linaActive ? 'dashboard__lina-badge--active' : 'dashboard__lina-badge--inactive'}`}>
              {tenant.ai_is_paused ? 'Bloqueada' : linaActive ? 'Activa' : 'Inactiva'}
            </span>
          </div>

          {/* Toggle */}
          {tenant.ai_is_paused ? (
            <div className="dashboard__lina-blocked">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Control bloqueado por soporte tecnico</span>
            </div>
          ) : (
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
          )}

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

          {/* AI Message Usage */}
          <UsageMeter />
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
              const countdown = taskCountdown(task.created_at, task.content);
              return (
                <div key={task.id} className="dashboard__task-item">
                  <div className={`dashboard__task-dot${countdown?.done ? ' dashboard__task-dot--executing' : ''}`} />
                  <div className="dashboard__task-content">
                    <span className="dashboard__task-client">{task.client_name}</span>
                    <span className="dashboard__task-text">{content}</span>
                  </div>
                  <div className="dashboard__task-actions">
                    {countdown && !countdown.done ? (
                      <span className="dashboard__task-countdown">
                        {Icons.clock} {countdown.text}
                      </span>
                    ) : countdown?.done ? (
                      <span className="dashboard__task-countdown dashboard__task-countdown--active">
                        ⚡ {countdown.text}
                      </span>
                    ) : (
                      <span className="dashboard__task-time">
                        {Icons.clock} {timeAgo(task.created_at)}
                      </span>
                    )}
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
