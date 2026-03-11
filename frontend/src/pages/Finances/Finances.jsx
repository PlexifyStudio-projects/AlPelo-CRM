import { useState, useEffect, useCallback, useRef } from 'react';
import { useTenant } from '../../context/TenantContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

// ===== ICONS =====
const Icons = {
  dollar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  trendUp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  trendDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  receipt: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 10h8" /><path d="M8 14h4" />
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  alert: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  scissors: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
  barChart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  creditCard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  pieChart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  ),
  trophy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  calendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  star: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  person: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  zap: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

// ===== HELPERS =====
const formatCOP = (value) => {
  if (!value && value !== 0) return '$0';
  return `$${Number(value).toLocaleString('es-CO')}`;
};

const formatDateRange = (from, to) => {
  if (!from || !to) return '';
  const opts = { day: 'numeric', month: 'short' };
  const f = new Date(from + 'T12:00:00');
  const t = new Date(to + 'T12:00:00');
  if (from === to) return f.toLocaleDateString('es-CO', { ...opts, year: 'numeric' });
  return `${f.toLocaleDateString('es-CO', opts)} — ${t.toLocaleDateString('es-CO', { ...opts, year: 'numeric' })}`;
};

const formatDayLabel = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  const weekday = d.toLocaleDateString('es-CO', { weekday: 'short' }).slice(0, 2);
  return { day, weekday };
};

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'month', label: 'Este Mes' },
  { value: 'year', label: 'Este Ano' },
];

const CATEGORY_COLORS = {
  'Barberia': '#2D5A3D',
  'Arte en Unas': '#C9A84C',
  'Peluqueria': '#60A5FA',
  'Tratamientos Capilares': '#34D399',
  'Color': '#F87171',
  'Otros': '#8E8E85',
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

// ===== GROWTH BADGE =====
const GrowthBadge = ({ value }) => {
  if (value === null || value === undefined) return null;
  const isPositive = value >= 0;
  return (
    <span className={`finances__growth ${isPositive ? 'finances__growth--up' : 'finances__growth--down'}`}>
      {isPositive ? Icons.trendUp : Icons.trendDown}
      <span>{isPositive ? '+' : ''}{value}%</span>
    </span>
  );
};

// ===== REVENUE CHART (Enhanced) =====
const RevenueChart = ({ data, maxValue }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!data || data.length === 0) return <div className="finances__empty">Sin datos de ingresos para este periodo</div>;
  const max = maxValue || Math.max(...data.map(d => d.revenue), 1);

  // Y-axis labels
  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => Math.round((max / ySteps) * (ySteps - i)));

  return (
    <div className="finances__chart">
      <div className="finances__chart-y-axis">
        {yLabels.map((v, i) => (
          <span key={i} className="finances__chart-y-label">{v >= 1000 ? `${Math.round(v/1000)}k` : v}</span>
        ))}
      </div>
      <div className="finances__chart-area">
        <div className="finances__chart-grid">
          {yLabels.map((_, i) => <div key={i} className="finances__chart-grid-line" />)}
        </div>
        <div className="finances__chart-bars">
          {data.map((item, i) => {
            const { day, weekday } = formatDayLabel(item.date);
            const pct = Math.max((item.revenue / max) * 100, 3);
            const isHovered = hoveredIdx === i;
            return (
              <div
                key={i}
                className={`finances__chart-col ${isHovered ? 'finances__chart-col--active' : ''}`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {isHovered && (
                  <div className="finances__chart-tooltip">
                    <strong>{formatCOP(item.revenue)}</strong>
                    <span>{item.visits} {item.visits === 1 ? 'servicio' : 'servicios'}</span>
                  </div>
                )}
                <div className="finances__chart-bar" style={{ height: `${pct}%` }}>
                  <div className="finances__chart-bar-fill" />
                </div>
                <div className="finances__chart-label">
                  <span className="finances__chart-label-day">{day}</span>
                  <span className="finances__chart-label-weekday">{weekday}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ===== CATEGORY BREAKDOWN =====
const CategoryBreakdown = ({ categories }) => {
  if (!categories || categories.length === 0) return <div className="finances__empty">Sin datos por categoria</div>;
  const total = categories.reduce((s, c) => s + c.revenue, 0) || 1;

  return (
    <div className="finances__categories">
      <div className="finances__categories-bar">
        {categories.map((cat, i) => (
          <div
            key={i}
            className="finances__categories-segment"
            style={{
              width: `${Math.max((cat.revenue / total) * 100, 2)}%`,
              background: CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Otros'],
            }}
            title={`${cat.category}: ${formatCOP(cat.revenue)}`}
          />
        ))}
      </div>
      <div className="finances__categories-legend">
        {categories.map((cat, i) => (
          <div key={i} className="finances__categories-item">
            <span
              className="finances__categories-dot"
              style={{ background: CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Otros'] }}
            />
            <span className="finances__categories-name">{cat.category}</span>
            <span className="finances__categories-value">{formatCOP(cat.revenue)}</span>
            <span className="finances__categories-pct">{cat.pct_of_total}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===== SKELETON =====
const SkeletonBlock = ({ width = '100%', height = '14px' }) => (
  <div className="finances__skeleton" style={{ width, height }} />
);

// ===== INSIGHTS PANEL =====
const InsightsPanel = ({ data }) => {
  if (!data) return null;
  const insights = [];

  if (data.best_day_date && data.best_day_revenue > 0) {
    const d = new Date(data.best_day_date + 'T12:00:00');
    insights.push({
      icon: Icons.trophy,
      label: 'Mejor dia',
      value: `${d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })} — ${formatCOP(data.best_day_revenue)}`,
      color: 'accent',
    });
  }
  if (data.unique_clients > 0) {
    insights.push({
      icon: Icons.person,
      label: 'Clientes atendidos',
      value: `${data.unique_clients} clientes unicos`,
      color: 'info',
    });
  }
  if (data.avg_ticket > 0) {
    insights.push({
      icon: Icons.zap,
      label: 'Ticket promedio',
      value: formatCOP(data.avg_ticket),
      color: 'success',
    });
  }
  if (data.busiest_day_date && data.busiest_day_visits > 0) {
    const d = new Date(data.busiest_day_date + 'T12:00:00');
    insights.push({
      icon: Icons.calendar,
      label: 'Dia mas ocupado',
      value: `${d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric' })} — ${data.busiest_day_visits} servicios`,
      color: 'primary',
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="finances__insights">
      {insights.map((ins, i) => (
        <div key={i} className={`finances__insight finances__insight--${ins.color}`}>
          <span className="finances__insight-icon">{ins.icon}</span>
          <div className="finances__insight-text">
            <span className="finances__insight-label">{ins.label}</span>
            <span className="finances__insight-value">{ins.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
};


// ===== MAIN COMPONENT =====
const Finances = () => {
  const { tenant } = useTenant();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (p, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API_URL}/finances/summary?period=${p}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchData(period, true), 60000);
    return () => clearInterval(interval);
  }, [period, fetchData]);

  const handlePeriodChange = (p) => setPeriod(p);

  // ===== ERROR =====
  if (error && !data) {
    return (
      <div className="finances">
        <div className="finances__header">
          <div className="finances__header-left">
            <h1 className="finances__title">Finanzas</h1>
          </div>
        </div>
        <div className="finances__error">
          <div className="finances__error-icon">{Icons.alert}</div>
          <p className="finances__error-text">No se pudieron cargar los datos financieros</p>
          <p className="finances__error-detail">{error}</p>
          <button className="finances__error-btn" onClick={() => fetchData(period)}>Reintentar</button>
        </div>
      </div>
    );
  }

  const hasData = data && data.total_visits > 0;

  return (
    <div className="finances">
      {/* ===== HEADER ===== */}
      <div className="finances__header">
        <div className="finances__header-left">
          <div className="finances__header-title-row">
            <h1 className="finances__title">Finanzas</h1>
            {data?.date_from && (
              <span className="finances__date-range">
                {Icons.calendar} {formatDateRange(data.date_from, data.date_to)}
              </span>
            )}
          </div>
          <p className="finances__subtitle">Control financiero — {tenant.name}</p>
        </div>
        <div className="finances__header-right">
          <button
            className={`finances__refresh-btn ${refreshing ? 'finances__refresh-btn--spinning' : ''}`}
            onClick={() => fetchData(period, true)}
            disabled={refreshing}
            title="Actualizar datos"
          >
            {Icons.refresh}
          </button>
          <div className="finances__period-selector">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`finances__period-btn ${period === opt.value ? 'finances__period-btn--active' : ''}`}
                onClick={() => handlePeriodChange(opt.value)}
                disabled={loading}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== KPIs ===== */}
      <div className="finances__kpis">
        {/* Total Revenue */}
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="110px" height="30px" /> : (
              <>
                <span className="finances__kpi-value">
                  <AnimatedNumber value={data?.total_revenue || 0} prefix="$" />
                </span>
                <GrowthBadge value={data?.revenue_growth_pct} />
              </>
            )}
            <span className="finances__kpi-label">Ingresos Totales</span>
          </div>
        </div>

        {/* Total Services */}
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.receipt}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="50px" height="30px" /> : (
              <>
                <span className="finances__kpi-value">
                  <AnimatedNumber value={data?.total_visits || 0} />
                </span>
                <GrowthBadge value={data?.visits_growth_pct} />
              </>
            )}
            <span className="finances__kpi-label">Servicios Realizados</span>
          </div>
        </div>

        {/* Unique Clients */}
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--info">{Icons.users}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="40px" height="30px" /> : (
              <span className="finances__kpi-value">
                <AnimatedNumber value={data?.unique_clients || 0} />
              </span>
            )}
            <span className="finances__kpi-label">Clientes Atendidos</span>
          </div>
        </div>

        {/* Avg Ticket */}
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.creditCard}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="70px" height="30px" /> : (
              <span className="finances__kpi-value">
                <AnimatedNumber value={data?.avg_ticket || 0} prefix="$" />
              </span>
            )}
            <span className="finances__kpi-label">Ticket Promedio</span>
          </div>
        </div>

        {/* Pending Payments */}
        {(data?.pending_payments || 0) > 0 && (
          <div className="finances__kpi-card finances__kpi-card--warning">
            <div className="finances__kpi-icon finances__kpi-icon--warning">{Icons.alert}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value">
                <AnimatedNumber value={data?.pending_payments || 0} />
              </span>
              <span className="finances__kpi-label">Pagos Pendientes</span>
            </div>
          </div>
        )}
      </div>

      {/* ===== INSIGHTS STRIP ===== */}
      {!loading && hasData && <InsightsPanel data={data} />}

      {/* ===== BODY: CHART + TOP SERVICES ===== */}
      <div className="finances__body">
        {/* --- Revenue Chart --- */}
        <div className="finances__card finances__card--chart">
          <div className="finances__card-header">
            <h2 className="finances__card-title">
              {Icons.barChart}
              Ingresos por Dia
            </h2>
            {!loading && hasData && (
              <span className="finances__card-badge">
                {data.revenue_by_day.length} {data.revenue_by_day.length === 1 ? 'dia' : 'dias'}
              </span>
            )}
          </div>
          {loading ? (
            <div className="finances__chart-skeleton">
              {[...Array(8)].map((_, i) => (
                <SkeletonBlock key={i} width="24px" height={`${25 + Math.random() * 65}%`} />
              ))}
            </div>
          ) : (
            <RevenueChart data={data?.revenue_by_day || []} />
          )}
        </div>

        {/* --- Top Services --- */}
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">
              {Icons.scissors}
              Top Servicios
            </h2>
            {!loading && hasData && (
              <span className="finances__card-badge">
                {data.revenue_by_service.length} servicios
              </span>
            )}
          </div>
          {loading ? (
            <div className="finances__list-skeleton">
              {[...Array(5)].map((_, i) => <SkeletonBlock key={i} width="100%" height="44px" />)}
            </div>
          ) : (
            <div className="finances__ranking-list">
              {(data?.revenue_by_service || []).slice(0, 10).map((svc, i) => {
                const maxRev = (data?.revenue_by_service?.[0]?.revenue) || 1;
                const pct = Math.round((svc.revenue / maxRev) * 100);
                const isTop3 = i < 3;
                return (
                  <div key={i} className={`finances__ranking-item ${isTop3 ? 'finances__ranking-item--top' : ''}`}>
                    <span className={`finances__ranking-pos ${isTop3 ? 'finances__ranking-pos--highlight' : ''}`}>
                      {i === 0 ? Icons.star : i + 1}
                    </span>
                    <div className="finances__ranking-info">
                      <div className="finances__ranking-top">
                        <div className="finances__ranking-name-wrap">
                          <span className="finances__ranking-name">{svc.service_name}</span>
                          {svc.category && (
                            <span
                              className="finances__ranking-cat"
                              style={{ color: CATEGORY_COLORS[svc.category] || CATEGORY_COLORS['Otros'] }}
                            >
                              {svc.category}
                            </span>
                          )}
                        </div>
                        <div className="finances__ranking-amounts">
                          <span className="finances__ranking-amount">{formatCOP(svc.revenue)}</span>
                          <span className="finances__ranking-pct">{svc.pct_of_total}%</span>
                        </div>
                      </div>
                      <div className="finances__ranking-bar-bg">
                        <div
                          className="finances__ranking-bar"
                          style={{
                            width: `${pct}%`,
                            background: CATEGORY_COLORS[svc.category] || CATEGORY_COLORS['Otros'],
                          }}
                        />
                      </div>
                      <span className="finances__ranking-count">{svc.count} {svc.count === 1 ? 'servicio' : 'servicios'}</span>
                    </div>
                  </div>
                );
              })}
              {(!data?.revenue_by_service || data.revenue_by_service.length === 0) && (
                <div className="finances__empty">Sin datos para este periodo</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== CATEGORY BREAKDOWN + STAFF ===== */}
      <div className="finances__body finances__body--bottom">
        {/* --- Categories --- */}
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">
              {Icons.pieChart}
              Distribucion por Categoria
            </h2>
          </div>
          {loading ? (
            <div className="finances__list-skeleton">
              <SkeletonBlock width="100%" height="12px" />
              {[...Array(4)].map((_, i) => <SkeletonBlock key={i} width="100%" height="32px" />)}
            </div>
          ) : (
            <CategoryBreakdown categories={data?.revenue_by_category || []} />
          )}
        </div>

        {/* --- Staff Performance --- */}
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">
              {Icons.users}
              Rendimiento por Barbero
            </h2>
          </div>
          {loading ? (
            <div className="finances__list-skeleton">
              {[...Array(3)].map((_, i) => <SkeletonBlock key={i} width="100%" height="64px" />)}
            </div>
          ) : (
            <div className="finances__staff-list">
              {(data?.revenue_by_staff || []).map((staff, i) => {
                const maxRev = data?.revenue_by_staff?.[0]?.revenue || 1;
                const pct = Math.round((staff.revenue / maxRev) * 100);
                return (
                  <div key={i} className="finances__staff-row">
                    <div className="finances__staff-left">
                      <div className={`finances__staff-avatar ${i === 0 ? 'finances__staff-avatar--gold' : ''}`}>
                        {staff.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="finances__staff-details">
                        <span className="finances__staff-name">{staff.staff_name}</span>
                        <span className="finances__staff-meta">{staff.count} servicios · Ticket prom. {formatCOP(staff.avg_ticket)}</span>
                      </div>
                    </div>
                    <div className="finances__staff-right">
                      <div className="finances__staff-bar-container">
                        <div className="finances__staff-bar-bg">
                          <div className="finances__staff-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="finances__staff-pct">{staff.pct_of_total}%</span>
                      </div>
                      <span className="finances__staff-revenue">{formatCOP(staff.revenue)}</span>
                    </div>
                  </div>
                );
              })}
              {(!data?.revenue_by_staff || data.revenue_by_staff.length === 0) && (
                <div className="finances__empty">Sin datos para este periodo</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Finances;
