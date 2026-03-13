import { useState, useEffect, useCallback, useRef } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useNotification } from '../../context/NotificationContext';
import financeService from '../../services/financeService';
import clientService from '../../services/clientService';
import servicesService from '../../services/servicesService';
import staffService from '../../services/staffService';

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
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  fileText: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  wallet: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
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
  { value: 'year', label: 'Este Año' },
];

const CATEGORY_COLORS = {
  'Barberia': '#2D5A3D',
  'Arte en Unas': '#C9A84C',
  'Peluqueria': '#60A5FA',
  'Tratamientos Capilares': '#34D399',
  'Color': '#F87171',
  'Otros': '#8E8E85',
};

const EXPENSE_CATEGORIES = [
  'Arriendo', 'Nomina', 'Productos', 'Servicios publicos',
  'Marketing', 'Mantenimiento', 'Impuestos', 'Otros',
];

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
];

const TAB_OPTIONS = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'gastos', label: 'Gastos' },
  { value: 'comisiones', label: 'Comisiones' },
  { value: 'facturas', label: 'Facturas' },
];

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

// ===== REVENUE CHART =====
const RevenueChart = ({ data, maxValue }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!data || data.length === 0) return <div className="finances__empty">Sin datos de ingresos para este periodo</div>;
  const max = maxValue || Math.max(...data.map(d => d.revenue), 1);

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
            <span className="finances__categories-dot" style={{ background: CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Otros'] }} />
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
    insights.push({ icon: Icons.person, label: 'Clientes atendidos', value: `${data.unique_clients} clientes unicos`, color: 'info' });
  }
  if (data.avg_ticket > 0) {
    insights.push({ icon: Icons.zap, label: 'Ticket promedio', value: formatCOP(data.avg_ticket), color: 'success' });
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

// ===== PAYMENT METHODS CARD =====
const PaymentMethodsCard = ({ period }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    financeService.paymentMethods({ period }).then(setData).catch(() => {});
  }, [period]);

  if (!data || !data.items || data.items.length === 0) return null;

  return (
    <div className="finances__card">
      <div className="finances__card-header">
        <h2 className="finances__card-title">{Icons.wallet} Metodos de Pago</h2>
      </div>
      <div className="finances__payment-methods">
        {data.items.map((item, i) => (
          <div key={i} className="finances__pm-row">
            <span className="finances__pm-name">{item.method}</span>
            <div className="finances__pm-bar-wrap">
              <div className="finances__pm-bar" style={{ width: `${item.pct_of_total}%` }} />
            </div>
            <span className="finances__pm-amount">{formatCOP(item.total)}</span>
            <span className="finances__pm-pct">{item.pct_of_total}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ================================================================
// TAB: RESUMEN (existing content)
// ================================================================
const TabResumen = ({ data, loading, period }) => {
  const hasData = data && data.total_visits > 0;

  return (
    <>
      {/* KPIs */}
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="110px" height="30px" /> : (
              <>
                <span className="finances__kpi-value"><AnimatedNumber value={data?.total_revenue || 0} prefix="$" /></span>
                <GrowthBadge value={data?.revenue_growth_pct} />
              </>
            )}
            <span className="finances__kpi-label">Ingresos Totales</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.receipt}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="50px" height="30px" /> : (
              <>
                <span className="finances__kpi-value"><AnimatedNumber value={data?.total_visits || 0} /></span>
                <GrowthBadge value={data?.visits_growth_pct} />
              </>
            )}
            <span className="finances__kpi-label">Servicios Realizados</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--info">{Icons.users}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="40px" height="30px" /> : (
              <span className="finances__kpi-value"><AnimatedNumber value={data?.unique_clients || 0} /></span>
            )}
            <span className="finances__kpi-label">Clientes Atendidos</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.creditCard}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="70px" height="30px" /> : (
              <span className="finances__kpi-value"><AnimatedNumber value={data?.avg_ticket || 0} prefix="$" /></span>
            )}
            <span className="finances__kpi-label">Ticket Promedio</span>
          </div>
        </div>
        {(data?.pending_payments || 0) > 0 && (
          <div className="finances__kpi-card finances__kpi-card--warning">
            <div className="finances__kpi-icon finances__kpi-icon--warning">{Icons.alert}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value"><AnimatedNumber value={data?.pending_payments || 0} /></span>
              <span className="finances__kpi-label">Pagos Pendientes</span>
            </div>
          </div>
        )}
      </div>

      {!loading && hasData && <InsightsPanel data={data} />}

      {/* Chart + Services */}
      <div className="finances__body">
        <div className="finances__card finances__card--chart">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.barChart} Ingresos por Dia</h2>
            {!loading && hasData && (
              <span className="finances__card-badge">{data.revenue_by_day.length} {data.revenue_by_day.length === 1 ? 'dia' : 'dias'}</span>
            )}
          </div>
          {loading ? (
            <div className="finances__chart-skeleton">
              {[...Array(8)].map((_, i) => <SkeletonBlock key={i} width="24px" height={`${25 + Math.random() * 65}%`} />)}
            </div>
          ) : (
            <RevenueChart data={data?.revenue_by_day || []} />
          )}
        </div>

        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.scissors} Top Servicios</h2>
            {!loading && hasData && <span className="finances__card-badge">{data.revenue_by_service.length} servicios</span>}
          </div>
          {loading ? (
            <div className="finances__list-skeleton">{[...Array(5)].map((_, i) => <SkeletonBlock key={i} width="100%" height="44px" />)}</div>
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
                          {svc.category && <span className="finances__ranking-cat" style={{ color: CATEGORY_COLORS[svc.category] || CATEGORY_COLORS['Otros'] }}>{svc.category}</span>}
                        </div>
                        <div className="finances__ranking-amounts">
                          <span className="finances__ranking-amount">{formatCOP(svc.revenue)}</span>
                          <span className="finances__ranking-pct">{svc.pct_of_total}%</span>
                        </div>
                      </div>
                      <div className="finances__ranking-bar-bg">
                        <div className="finances__ranking-bar" style={{ width: `${pct}%`, background: CATEGORY_COLORS[svc.category] || CATEGORY_COLORS['Otros'] }} />
                      </div>
                      <span className="finances__ranking-count">{svc.count} {svc.count === 1 ? 'servicio' : 'servicios'}</span>
                    </div>
                  </div>
                );
              })}
              {(!data?.revenue_by_service || data.revenue_by_service.length === 0) && <div className="finances__empty">Sin datos para este periodo</div>}
            </div>
          )}
        </div>
      </div>

      {/* Categories + Staff + Payment Methods */}
      <div className="finances__body finances__body--bottom">
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.pieChart} Distribucion por Categoria</h2>
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

        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.users} Rendimiento por Profesional</h2>
          </div>
          {loading ? (
            <div className="finances__list-skeleton">{[...Array(3)].map((_, i) => <SkeletonBlock key={i} width="100%" height="64px" />)}</div>
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
              {(!data?.revenue_by_staff || data.revenue_by_staff.length === 0) && <div className="finances__empty">Sin datos para este periodo</div>}
            </div>
          )}
        </div>
      </div>

      {/* Payment Methods + P&L */}
      <div className="finances__body finances__body--bottom">
        {!loading && <PaymentMethodsCard period={period} />}
        {!loading && <PnLMiniCard period={period} />}
      </div>
    </>
  );
};

// ===== P&L MINI CARD (for Resumen tab) =====
const PnLMiniCard = ({ period }) => {
  const [pnl, setPnl] = useState(null);

  useEffect(() => {
    financeService.getPnL({ period }).then(setPnl).catch(() => {});
  }, [period]);

  if (!pnl) return null;

  return (
    <div className="finances__card">
      <div className="finances__card-header">
        <h2 className="finances__card-title">{Icons.barChart} Estado de Resultados</h2>
        <span className="finances__card-badge">P&L</span>
      </div>
      <div className="finances__pnl-rows">
        <div className="finances__pnl-row">
          <span className="finances__pnl-label">{Icons.trendUp} Ingresos</span>
          <span className="finances__pnl-value finances__pnl-value--positive">{formatCOP(pnl.total_revenue)}</span>
        </div>
        <div className="finances__pnl-row">
          <span className="finances__pnl-label">Gastos operativos</span>
          <span className="finances__pnl-value finances__pnl-value--negative">-{formatCOP(pnl.total_expenses)}</span>
        </div>
        <div className="finances__pnl-row">
          <span className="finances__pnl-label">Comisiones equipo</span>
          <span className="finances__pnl-value finances__pnl-value--negative">-{formatCOP(pnl.total_commissions)}</span>
        </div>
        <div className="finances__pnl-divider" />
        <div className="finances__pnl-row finances__pnl-row--total">
          <span className="finances__pnl-label">Ganancia Neta</span>
          <span className={`finances__pnl-value ${pnl.net_profit >= 0 ? 'finances__pnl-value--positive' : 'finances__pnl-value--negative'}`}>
            {formatCOP(pnl.net_profit)}
          </span>
        </div>
        {pnl.margin_pct !== null && (
          <span className="finances__pnl-margin">Margen de ganancia: {pnl.margin_pct}%</span>
        )}
      </div>
    </div>
  );
};

// ================================================================
// TAB: GASTOS
// ================================================================
const TabGastos = ({ period }) => {
  const { addNotification } = useNotification();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_method: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exp, sum, p] = await Promise.all([
        financeService.listExpenses({ period }),
        financeService.expensesSummary({ period }),
        financeService.getPnL({ period }),
      ]);
      setExpenses(exp);
      setSummary(sum);
      setPnl(p);
    } catch (err) {
      addNotification('Error cargando gastos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [period, addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.description || !form.amount || !form.date) return;
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editingId) {
        await financeService.updateExpense(editingId, payload);
        addNotification('Gasto actualizado', 'success');
      } else {
        await financeService.createExpense(payload);
        addNotification('Gasto registrado', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_method: '' });
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const handleEdit = (exp) => {
    setForm({ category: exp.category, description: exp.description, amount: exp.amount.toString(), date: exp.date, payment_method: exp.payment_method || '' });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await financeService.deleteExpense(id);
      addNotification('Gasto eliminado', 'success');
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  if (loading) return <div className="finances__list-skeleton">{[...Array(4)].map((_, i) => <SkeletonBlock key={i} width="100%" height="48px" />)}</div>;

  return (
    <>
      {/* P&L Card */}
      {pnl && (
        <div className="finances__pnl-card">
          <div className="finances__pnl-row">
            <span className="finances__pnl-label">Ingresos</span>
            <span className="finances__pnl-value finances__pnl-value--positive">{formatCOP(pnl.total_revenue)}</span>
          </div>
          <div className="finances__pnl-row">
            <span className="finances__pnl-label">Gastos</span>
            <span className="finances__pnl-value finances__pnl-value--negative">-{formatCOP(pnl.total_expenses)}</span>
          </div>
          <div className="finances__pnl-row">
            <span className="finances__pnl-label">Comisiones</span>
            <span className="finances__pnl-value finances__pnl-value--negative">-{formatCOP(pnl.total_commissions)}</span>
          </div>
          <div className="finances__pnl-divider" />
          <div className="finances__pnl-row finances__pnl-row--total">
            <span className="finances__pnl-label">Ganancia Neta</span>
            <span className={`finances__pnl-value ${pnl.net_profit >= 0 ? 'finances__pnl-value--positive' : 'finances__pnl-value--negative'}`}>
              {formatCOP(pnl.net_profit)}
            </span>
          </div>
          <span className="finances__pnl-margin">Margen: {pnl.margin_pct}%</span>
        </div>
      )}

      {/* Header + Add button */}
      <div className="finances__section-header">
        <h3 className="finances__section-title">Gastos del periodo</h3>
        <button className="finances__action-btn" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_method: '' }); }}>
          {Icons.plus} Nuevo Gasto
        </button>
      </div>

      {/* Expense Form */}
      {showForm && (
        <form className="finances__expense-form" onSubmit={handleSubmit}>
          <div className="finances__form-grid">
            <select className="finances__select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
              <option value="">Categoria *</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="finances__input" placeholder="Descripcion *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            <input className="finances__input" type="number" placeholder="Monto (COP) *" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            <input className="finances__input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <select className="finances__select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="">Metodo de pago</option>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="finances__form-actions">
            <button type="button" className="finances__btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</button>
            <button type="submit" className="finances__btn-primary">{Icons.check} {editingId ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </form>
      )}

      {/* Expense Summary */}
      {summary && summary.by_category && summary.by_category.length > 0 && (
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.pieChart} Gastos por Categoria</h2>
            <span className="finances__card-badge">Total: {formatCOP(summary.total)}</span>
          </div>
          <div className="finances__categories">
            <div className="finances__categories-bar">
              {summary.by_category.map((cat, i) => (
                <div key={i} className="finances__categories-segment" style={{ width: `${Math.max(cat.pct_of_total, 2)}%`, background: CATEGORY_COLORS[cat.category] || '#8B6914' }} title={`${cat.category}: ${formatCOP(cat.total)}`} />
              ))}
            </div>
            <div className="finances__categories-legend">
              {summary.by_category.map((cat, i) => (
                <div key={i} className="finances__categories-item">
                  <span className="finances__categories-dot" style={{ background: CATEGORY_COLORS[cat.category] || '#8B6914' }} />
                  <span className="finances__categories-name">{cat.category}</span>
                  <span className="finances__categories-value">{formatCOP(cat.total)}</span>
                  <span className="finances__categories-pct">{cat.pct_of_total}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expense List */}
      <div className="finances__table-wrap">
        <table className="finances__table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Categoria</th>
              <th>Descripcion</th>
              <th>Metodo</th>
              <th>Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td>{new Date(exp.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</td>
                <td><span className="finances__tag">{exp.category}</span></td>
                <td>{exp.description}</td>
                <td>{exp.payment_method || '—'}</td>
                <td className="finances__amount-cell">{formatCOP(exp.amount)}</td>
                <td>
                  <div className="finances__row-actions">
                    <button className="finances__icon-btn" onClick={() => handleEdit(exp)} title="Editar">{Icons.edit}</button>
                    <button className="finances__icon-btn finances__icon-btn--danger" onClick={() => handleDelete(exp.id)} title="Eliminar">{Icons.trash}</button>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 0, border: 'none' }}>
                <div className="finances__empty-state" style={{ margin: '0', boxShadow: 'none' }}>
                  <div className="finances__empty-state-icon">{Icons.receipt}</div>
                  <p className="finances__empty-state-title">Sin gastos registrados</p>
                  <p className="finances__empty-state-text">Registra arriendo, nómina, productos y otros gastos para ver tu estado de resultados completo</p>
                  <button type="button" className="finances__action-btn" onClick={() => { setShowForm(true); setEditingId(null); setForm({ category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_method: '' }); }}>
                    {Icons.plus} Registrar primer gasto
                  </button>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ================================================================
// TAB: COMISIONES — Rich staff cards
// ================================================================
const STAFF_COLORS = ['#2D5A3D', '#8B6914', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

const TabComisiones = ({ period }) => {
  const { addNotification } = useNotification();
  const [configs, setConfigs] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editRate, setEditRate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        financeService.listCommissions(),
        financeService.commissionPayouts({ period }),
      ]);
      setConfigs(c);
      setPayouts(p);
    } catch (err) {
      addNotification('Error cargando comisiones: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [period, addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleSaveRate = async (staffId) => {
    const rate = parseFloat(editRate) / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) {
      addNotification('La tasa debe ser entre 0 y 100', 'error');
      return;
    }
    try {
      await financeService.updateCommission(staffId, { default_rate: rate, service_overrides: {} });
      addNotification('Comision actualizada', 'success');
      setEditingStaff(null);
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="finances__comm-skeleton">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="finances__card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <SkeletonBlock width="56px" height="56px" />
              <div style={{ flex: 1 }}>
                <SkeletonBlock width="140px" height="18px" />
                <SkeletonBlock width="80px" height="14px" />
              </div>
              <SkeletonBlock width="60px" height="32px" />
            </div>
            <SkeletonBlock width="100%" height="8px" />
          </div>
        ))}
      </div>
    );
  }

  const totalCommissions = payouts.reduce((s, p) => s + p.commission_amount, 0);
  const totalRevenue = payouts.reduce((s, p) => s + p.total_revenue, 0);
  const totalServices = payouts.reduce((s, p) => s + p.services_count, 0);
  const avgRate = configs.length > 0 ? configs.reduce((s, c) => s + c.default_rate, 0) / configs.length : 0.40;
  const maxPayout = Math.max(...payouts.map(p => p.commission_amount), 1);

  // Merge configs with payouts for full picture
  const staffData = configs.map((cfg, i) => {
    const payout = payouts.find(p => p.staff_id === cfg.staff_id);
    return {
      ...cfg,
      revenue: payout?.total_revenue || 0,
      commission: payout?.commission_amount || 0,
      services: payout?.services_count || 0,
      color: STAFF_COLORS[i % STAFF_COLORS.length],
    };
  });

  return (
    <>
      {/* Summary KPIs */}
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.users}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={configs.length} /></span>
            <span className="finances__kpi-label">Profesionales Activos</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalCommissions} prefix="$" /></span>
            <span className="finances__kpi-label">Total Comisiones</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.receipt}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalServices} /></span>
            <span className="finances__kpi-label">Servicios Realizados</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--info">{Icons.pieChart}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{(avgRate * 100).toFixed(0)}%</span>
            <span className="finances__kpi-label">Tasa Promedio</span>
          </div>
        </div>
      </div>

      {/* Commissions distribution bar */}
      {payouts.length > 0 && (
        <div className="finances__comm-dist">
          <div className="finances__comm-dist-bar">
            {staffData.filter(s => s.commission > 0).map((s, i) => (
              <div
                key={s.staff_id}
                className="finances__comm-dist-seg"
                style={{
                  width: `${Math.max((s.commission / totalCommissions) * 100, 3)}%`,
                  background: s.color,
                }}
                title={`${s.staff_name}: ${formatCOP(s.commission)}`}
              />
            ))}
          </div>
          <div className="finances__comm-dist-legend">
            {staffData.filter(s => s.commission > 0).map((s) => (
              <span key={s.staff_id} className="finances__comm-dist-item">
                <span className="finances__comm-dist-dot" style={{ background: s.color }} />
                {s.staff_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Staff cards */}
      <div className="finances__section-header">
        <h3 className="finances__section-title">Equipo y Comisiones</h3>
      </div>

      <div className="finances__staff-cards">
        {staffData.map((staff, i) => {
          const isEditing = editingStaff === staff.staff_id;
          const payoutPct = maxPayout > 0 ? (staff.commission / maxPayout) * 100 : 0;
          const initials = staff.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div key={staff.staff_id} className="finances__staff-card" style={{ animationDelay: `${0.05 + i * 0.06}s` }}>
              {/* Top: avatar + name + rate badge */}
              <div className="finances__sc-header">
                <div className="finances__sc-avatar" style={{ background: `${staff.color}18`, color: staff.color, borderColor: `${staff.color}30` }}>
                  {initials}
                </div>
                <div className="finances__sc-info">
                  <span className="finances__sc-name">{staff.staff_name}</span>
                  <span className="finances__sc-meta">
                    {staff.services > 0
                      ? `${staff.services} servicio${staff.services !== 1 ? 's' : ''} este periodo`
                      : 'Sin servicios este periodo'
                    }
                  </span>
                </div>
                <div className="finances__sc-rate-wrap">
                  {isEditing ? (
                    <div className="finances__sc-rate-edit">
                      <input
                        className="finances__input finances__input--inline"
                        type="number" step="1" min="0" max="100"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRate(staff.staff_id)}
                        autoFocus
                      />
                      <span className="finances__sc-rate-pct">%</span>
                      <button className="finances__icon-btn" onClick={() => handleSaveRate(staff.staff_id)} title="Guardar">{Icons.check}</button>
                      <button className="finances__icon-btn" onClick={() => setEditingStaff(null)} title="Cancelar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      className="finances__sc-rate-badge"
                      style={{ background: `${staff.color}12`, color: staff.color, borderColor: `${staff.color}25` }}
                      onClick={() => { setEditingStaff(staff.staff_id); setEditRate((staff.default_rate * 100).toFixed(0)); }}
                      title="Clic para editar tasa"
                    >
                      {(staff.default_rate * 100).toFixed(0)}%
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Financial row */}
              <div className="finances__sc-financials">
                <div className="finances__sc-fin-item">
                  <span className="finances__sc-fin-label">Ingresos generados</span>
                  <span className="finances__sc-fin-value">{formatCOP(staff.revenue)}</span>
                </div>
                <div className="finances__sc-fin-divider" />
                <div className="finances__sc-fin-item">
                  <span className="finances__sc-fin-label">Comision</span>
                  <span className="finances__sc-fin-value finances__sc-fin-value--highlight" style={{ color: staff.color }}>
                    {formatCOP(staff.commission)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="finances__sc-bar-wrap">
                <div className="finances__sc-bar-bg">
                  <div className="finances__sc-bar-fill" style={{ width: `${payoutPct}%`, background: staff.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {configs.length === 0 && (
        <div className="finances__empty-state">
          <div className="finances__empty-state-icon">{Icons.users}</div>
          <p className="finances__empty-state-title">No hay profesionales activos</p>
          <p className="finances__empty-state-text">Agrega personal en la seccion de Equipo para configurar sus comisiones</p>
        </div>
      )}
    </>
  );
};

// ================================================================
// TAB: FACTURAS — Rich with KPIs, empty state, and invoice cards
// ================================================================
const STATUS_COLORS = { draft: '#8E8E85', sent: '#3B82F6', paid: '#10B981', cancelled: '#EF4444' };
const STATUS_LABELS = { draft: 'Borrador', sent: 'Enviada', paid: 'Pagada', cancelled: 'Anulada' };
const STATUS_ICONS = {
  draft: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  sent: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  paid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  cancelled: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

const TabFacturas = ({ period }) => {
  const { addNotification } = useNotification();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Real data from the system
  const [allClients, setAllClients] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const searchTimer = useRef(null);
  const clientSearchRef = useRef(null);

  const [form, setForm] = useState({
    client_name: '', client_phone: '', client_document: '',
    payment_method: '', tax_rate: 0.19, notes: '',
    items: [{ service_name: '', quantity: 1, unit_price: '', staff_name: '' }],
  });

  // Load invoices + reference data
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeService.listInvoices();
      setInvoices(data);
    } catch (err) {
      addNotification('Error cargando facturas: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  // Load clients, services, staff once for dropdowns
  useEffect(() => {
    clientService.list({ sort_by: 'name' }).then(setAllClients).catch(() => {});
    servicesService.list({ active: true }).then(setAllServices).catch(() => {});
    staffService.list({ active: true }).then(setAllStaff).catch(() => {});
  }, []);

  // Client search
  const handleClientSearch = (value) => {
    setClientSearch(value);
    setShowClientDropdown(true);
    if (selectedClient) { setSelectedClient(null); setForm(f => ({ ...f, client_name: '', client_phone: '', client_document: '' })); }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) { setClientResults([]); return; }
    searchTimer.current = setTimeout(() => {
      const q = value.toLowerCase();
      const results = allClients.filter(c =>
        c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.client_id && c.client_id.toLowerCase().includes(q))
      ).slice(0, 8);
      setClientResults(results);
    }, 150);
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearch(client.name);
    setShowClientDropdown(false);
    setClientResults([]);
    setForm(f => ({
      ...f,
      client_name: client.name,
      client_phone: client.phone || '',
      client_document: '',
    }));
  };

  // Service selection — auto-fill price
  const handleServiceSelect = (idx, serviceName) => {
    const svc = allServices.find(s => s.name === serviceName);
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? {
        ...item,
        service_name: serviceName,
        unit_price: svc ? svc.price.toString() : item.unit_price,
      } : item),
    }));
  };

  // Staff selection for line item
  const handleStaffSelect = (idx, staffName) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, staff_name: staffName } : item),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { service_name: '', quantity: 1, unit_price: '', staff_name: '' }] }));
  };

  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const subtotal = form.items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
  const taxAmount = Math.round(subtotal * form.tax_rate);
  const total = subtotal + taxAmount;

  const resetForm = () => {
    setShowForm(false);
    setSelectedClient(null);
    setClientSearch('');
    setForm({
      client_name: '', client_phone: '', client_document: '',
      payment_method: '', tax_rate: 0.19, notes: '',
      items: [{ service_name: '', quantity: 1, unit_price: '', staff_name: '' }],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalClientName = form.client_name || clientSearch.trim();
    if (!finalClientName || form.items.some((it) => !it.service_name || !it.unit_price)) {
      addNotification('Completa nombre del cliente y todos los servicios', 'error');
      return;
    }
    try {
      await financeService.createInvoice({
        ...form,
        client_name: finalClientName,
        items: form.items.map((it) => ({ ...it, unit_price: Number(it.unit_price), quantity: Number(it.quantity) || 1 })),
      });
      addNotification('Factura creada', 'success');
      resetForm();
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await financeService.updateInvoice(id, { status });
      addNotification(`Factura marcada como ${STATUS_LABELS[status] || status}`, 'success');
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  // Compute KPIs
  const totalFacturado = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0);
  const paidCount = invoices.filter(i => i.status === 'paid').length;
  const pendingCount = invoices.filter(i => i.status === 'draft' || i.status === 'sent').length;
  const pendingAmount = invoices.filter(i => i.status === 'draft' || i.status === 'sent').reduce((s, i) => s + i.total, 0);

  // Group services by category for dropdown
  const servicesByCategory = allServices.reduce((acc, svc) => {
    const cat = svc.category || 'Otros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(svc);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="finances__comm-skeleton">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="finances__card" style={{ padding: '20px' }}>
            <SkeletonBlock width="100%" height="80px" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* KPIs */}
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.fileText}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{invoices.length}</span>
            <span className="finances__kpi-label">Facturas Emitidas</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalFacturado} prefix="$" /></span>
            <span className="finances__kpi-label">Total Facturado</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.check}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{paidCount}</span>
            <span className="finances__kpi-label">Pagadas</span>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="finances__kpi-card finances__kpi-card--warning">
            <div className="finances__kpi-icon finances__kpi-icon--warning">{Icons.alert}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value">{pendingCount}</span>
              <span className="finances__kpi-label">Pendientes ({formatCOP(pendingAmount)})</span>
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="finances__section-header">
        <h3 className="finances__section-title">
          {invoices.length > 0 ? `${invoices.length} factura${invoices.length !== 1 ? 's' : ''}` : 'Facturas'}
        </h3>
        <button className="finances__action-btn" onClick={() => { showForm ? resetForm() : setShowForm(true); }}>
          {Icons.plus} Nueva Factura
        </button>
      </div>

      {/* Invoice Form — connected to real data */}
      {showForm && (
        <form className="finances__invoice-form" onSubmit={handleSubmit}>
          <p className="finances__form-subtitle">Datos del cliente</p>

          {/* Client search */}
          <div className="finances__client-search-wrap" ref={clientSearchRef}>
            {selectedClient ? (
              <div className="finances__client-selected">
                <div className="finances__client-selected-avatar">
                  {selectedClient.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="finances__client-selected-info">
                  <span className="finances__client-selected-name">{selectedClient.name}</span>
                  <span className="finances__client-selected-meta">{selectedClient.client_id} · {selectedClient.phone}</span>
                </div>
                <button type="button" className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => {
                  setSelectedClient(null);
                  setClientSearch('');
                  setForm(f => ({ ...f, client_name: '', client_phone: '', client_document: '' }));
                }}>Cambiar</button>
              </div>
            ) : (
              <div className="finances__client-search-box">
                <svg className="finances__client-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  className="finances__input"
                  type="text"
                  placeholder="Buscar cliente por nombre o teléfono..."
                  value={clientSearch}
                  onChange={(e) => handleClientSearch(e.target.value)}
                  onFocus={() => clientSearch.length >= 2 && setShowClientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                />
                {showClientDropdown && clientResults.length > 0 && (
                  <div className="finances__client-dropdown">
                    {clientResults.map((c) => (
                      <button key={c.id} type="button" className="finances__client-dropdown-item" onClick={() => handleSelectClient(c)}>
                        <span className="finances__client-dropdown-avatar">{c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                        <div className="finances__client-dropdown-info">
                          <span className="finances__client-dropdown-name">{c.name}</span>
                          <span className="finances__client-dropdown-meta">{c.client_id} · {c.phone} · {c.total_visits || 0} visitas</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {clientSearch.length >= 2 && clientResults.length === 0 && showClientDropdown && (
                  <div className="finances__client-dropdown">
                    <div className="finances__client-dropdown-empty">
                      No se encontró — se creará como cliente nuevo
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual fields if no client selected */}
          {!selectedClient && clientSearch.length >= 2 && (
            <div className="finances__form-grid">
              <input className="finances__input" placeholder="Nombre *" value={form.client_name || clientSearch} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required />
              <input className="finances__input" placeholder="Teléfono" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
              <input className="finances__input" placeholder="CC / NIT" value={form.client_document} onChange={(e) => setForm({ ...form, client_document: e.target.value })} />
            </div>
          )}

          <div className="finances__form-grid">
            <select className="finances__select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="">Método de pago</option>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <div className="finances__tax-toggle">
              <label className="finances__label-inline">
                <input type="checkbox" checked={form.tax_rate > 0} onChange={(e) => setForm({ ...form, tax_rate: e.target.checked ? 0.19 : 0 })} />
                <span>Incluir IVA (19%)</span>
              </label>
            </div>
          </div>

          <p className="finances__form-subtitle">Servicios facturados</p>
          <div className="finances__invoice-items">
            {form.items.map((item, idx) => (
              <div key={idx} className="finances__invoice-item-row">
                {/* Service dropdown from catalog */}
                <select
                  className="finances__select"
                  value={item.service_name}
                  onChange={(e) => handleServiceSelect(idx, e.target.value)}
                  required
                >
                  <option value="">Servicio *</option>
                  {Object.entries(servicesByCategory).map(([cat, svcs]) => (
                    <optgroup key={cat} label={cat}>
                      {svcs.map(s => (
                        <option key={s.id} value={s.name}>{s.name} — {formatCOP(s.price)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <input className="finances__input finances__input--sm" type="number" min="1" placeholder="Cant" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                <input className="finances__input" type="number" placeholder="Precio *" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} required />

                {/* Staff dropdown from team */}
                <select
                  className="finances__select"
                  value={item.staff_name}
                  onChange={(e) => handleStaffSelect(idx, e.target.value)}
                >
                  <option value="">Profesional</option>
                  {allStaff.map(s => (
                    <option key={s.id} value={s.name}>{s.name}{s.role ? ` — ${s.role}` : ''}</option>
                  ))}
                </select>

                {form.items.length > 1 && (
                  <button type="button" className="finances__icon-btn finances__icon-btn--danger" onClick={() => removeItem(idx)}>{Icons.trash}</button>
                )}
              </div>
            ))}
            <button type="button" className="finances__btn-ghost finances__btn-ghost--sm" onClick={addItem}>{Icons.plus} Agregar servicio</button>
          </div>

          <div className="finances__invoice-totals">
            <div className="finances__pnl-row"><span>Subtotal</span><span>{formatCOP(subtotal)}</span></div>
            {form.tax_rate > 0 && (
              <div className="finances__pnl-row"><span>IVA ({(form.tax_rate * 100).toFixed(0)}%)</span><span>{formatCOP(taxAmount)}</span></div>
            )}
            <div className="finances__pnl-divider" />
            <div className="finances__pnl-row finances__pnl-row--total"><span>Total</span><span>{formatCOP(total)}</span></div>
          </div>

          <div className="finances__form-actions">
            <button type="button" className="finances__btn-ghost" onClick={resetForm}>Cancelar</button>
            <button type="submit" className="finances__btn-primary">{Icons.check} Crear Factura</button>
          </div>
        </form>
      )}

      {/* Invoice cards */}
      {invoices.length > 0 ? (
        <div className="finances__inv-list">
          {invoices.map((inv, i) => {
            const isExpanded = expandedId === inv.id;
            return (
              <div key={inv.id} className="finances__inv-card" style={{ animationDelay: `${0.05 + i * 0.04}s` }}>
                <div className="finances__inv-main" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                  {/* Left: status dot + number */}
                  <div className="finances__inv-left">
                    <span className="finances__inv-status-dot" style={{ background: STATUS_COLORS[inv.status] }} />
                    <div className="finances__inv-id-wrap">
                      <span className="finances__inv-number">{inv.invoice_number}</span>
                      <span className="finances__inv-date">
                        {new Date(inv.issued_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  {/* Center: client */}
                  <div className="finances__inv-center">
                    <span className="finances__inv-client">{inv.client_name}</span>
                    {inv.client_document && <span className="finances__inv-doc">{inv.client_document}</span>}
                  </div>
                  {/* Right: total + status */}
                  <div className="finances__inv-right">
                    <span className="finances__inv-total">{formatCOP(inv.total)}</span>
                    <span className="finances__inv-status" style={{ color: STATUS_COLORS[inv.status], borderColor: `${STATUS_COLORS[inv.status]}40`, background: `${STATUS_COLORS[inv.status]}10` }}>
                      {STATUS_ICONS[inv.status]}
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="finances__inv-details">
                    {/* Items */}
                    {inv.items && inv.items.length > 0 && (
                      <div className="finances__inv-items-list">
                        {inv.items.map((item, idx) => (
                          <div key={idx} className="finances__inv-item-row">
                            <span className="finances__inv-item-name">{item.service_name}</span>
                            <span className="finances__inv-item-qty">{item.quantity}x</span>
                            <span className="finances__inv-item-price">{formatCOP(item.unit_price)}</span>
                            {item.staff_name && <span className="finances__inv-item-staff">{item.staff_name}</span>}
                            <span className="finances__inv-item-total">{formatCOP(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Totals */}
                    <div className="finances__inv-totals-row">
                      <div className="finances__inv-total-line">
                        <span>Subtotal</span><span>{formatCOP(inv.subtotal)}</span>
                      </div>
                      <div className="finances__inv-total-line">
                        <span>IVA ({(inv.tax_rate * 100).toFixed(0)}%)</span><span>{formatCOP(inv.tax_amount)}</span>
                      </div>
                      <div className="finances__inv-total-line finances__inv-total-line--bold">
                        <span>Total</span><span>{formatCOP(inv.total)}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="finances__inv-actions">
                      {inv.payment_method && <span className="finances__inv-method">{Icons.creditCard} {inv.payment_method}</span>}
                      <div className="finances__row-actions">
                        {inv.status === 'draft' && (
                          <button className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => handleStatusChange(inv.id, 'sent')}>
                            {STATUS_ICONS.sent} Marcar enviada
                          </button>
                        )}
                        {(inv.status === 'draft' || inv.status === 'sent') && (
                          <button className="finances__btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => handleStatusChange(inv.id, 'paid')}>
                            {Icons.check} Marcar pagada
                          </button>
                        )}
                        {inv.status !== 'cancelled' && (
                          <button className="finances__icon-btn finances__icon-btn--danger" onClick={() => handleStatusChange(inv.id, 'cancelled')} title="Anular">
                            {Icons.trash}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="finances__empty-state">
          <div className="finances__empty-state-icon">{Icons.fileText}</div>
          <p className="finances__empty-state-title">Sin facturas emitidas</p>
          <p className="finances__empty-state-text">Crea tu primera factura para comenzar a llevar un registro profesional de tus cobros</p>
          <button className="finances__action-btn" onClick={() => setShowForm(true)}>
            {Icons.plus} Crear primera factura
          </button>
        </div>
      )}
    </>
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
  const [activeTab, setActiveTab] = useState('resumen');

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

  useEffect(() => {
    const interval = setInterval(() => fetchData(period, true), 60000);
    return () => clearInterval(interval);
  }, [period, fetchData]);

  if (error && !data) {
    return (
      <div className="finances">
        <div className="finances__header">
          <div className="finances__header-left"><h1 className="finances__title">Finanzas</h1></div>
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

  return (
    <div className="finances">
      {/* HEADER */}
      <div className="finances__header">
        <div className="finances__header-left">
          <div className="finances__header-title-row">
            <h1 className="finances__title">Finanzas</h1>
            {data?.date_from && (
              <span className="finances__date-range">{Icons.calendar} {formatDateRange(data.date_from, data.date_to)}</span>
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
                onClick={() => setPeriod(opt.value)}
                disabled={loading}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB SELECTOR */}
      <div className="finances__tab-selector">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.value}
            className={`finances__tab-btn ${activeTab === tab.value ? 'finances__tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'resumen' && <TabResumen data={data} loading={loading} period={period} />}
      {activeTab === 'gastos' && <TabGastos period={period} />}
      {activeTab === 'comisiones' && <TabComisiones period={period} />}
      {activeTab === 'facturas' && <TabFacturas period={period} />}
    </div>
  );
};

export default Finances;
