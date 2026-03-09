import { useState, useEffect, useCallback } from 'react';

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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
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
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
};

// ===== HELPERS =====
const formatCOP = (value) => {
  if (!value && value !== 0) return '$0';
  return `$${Number(value).toLocaleString('es-CO')}`;
};

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'month', label: 'Este Mes' },
  { value: 'year', label: 'Este Año' },
];

// ===== ANIMATED NUMBER =====
const AnimatedNumber = ({ value, prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numericValue = typeof value === 'number' ? value : parseInt(value, 10) || 0;
    if (numericValue === 0) { setDisplayValue(0); return; }

    const duration = 1000;
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

// ===== MINI BAR CHART =====
const MiniBarChart = ({ data, maxValue }) => {
  if (!data || data.length === 0) return null;
  const max = maxValue || Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="finances__chart">
      <div className="finances__chart-bars">
        {data.map((item, i) => (
          <div key={i} className="finances__chart-bar-wrap">
            <div
              className="finances__chart-bar"
              style={{ height: `${Math.max((item.revenue / max) * 100, 4)}%` }}
              title={`${item.date}: ${formatCOP(item.revenue)}`}
            />
            <span className="finances__chart-label">
              {item.date ? item.date.slice(8) : i + 1}
            </span>
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

// ===== MAIN COMPONENT =====
const Finances = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');

  const fetchData = useCallback(async (p) => {
    setLoading(true);
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
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const handlePeriodChange = (p) => {
    setPeriod(p);
  };

  // ===== ERROR =====
  if (error && !data) {
    return (
      <div className="finances">
        <div className="finances__header">
          <h1 className="finances__title">Finanzas</h1>
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
      {/* ===== HEADER ===== */}
      <div className="finances__header">
        <div className="finances__header-left">
          <h1 className="finances__title">Finanzas</h1>
          <p className="finances__subtitle">Resumen financiero — AlPelo Peluqueria</p>
        </div>
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

      {/* ===== KPIs ===== */}
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="90px" height="28px" /> : (
              <span className="finances__kpi-value">
                <AnimatedNumber value={data?.total_revenue || 0} prefix="$" />
              </span>
            )}
            <span className="finances__kpi-label">Ingresos Totales</span>
          </div>
        </div>

        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.receipt}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="50px" height="28px" /> : (
              <span className="finances__kpi-value">
                <AnimatedNumber value={data?.total_visits || 0} />
              </span>
            )}
            <span className="finances__kpi-label">Servicios Realizados</span>
          </div>
        </div>

        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.trendUp}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="70px" height="28px" /> : (
              <span className="finances__kpi-value">
                <AnimatedNumber value={data?.avg_ticket || 0} prefix="$" />
              </span>
            )}
            <span className="finances__kpi-label">Ticket Promedio</span>
          </div>
        </div>

        <div className={`finances__kpi-card ${(data?.pending_payments || 0) > 0 ? 'finances__kpi-card--warning' : ''}`}>
          <div className="finances__kpi-icon finances__kpi-icon--warning">{Icons.creditCard}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="30px" height="28px" /> : (
              <span className="finances__kpi-value">
                <AnimatedNumber value={data?.pending_payments || 0} />
              </span>
            )}
            <span className="finances__kpi-label">Pagos Pendientes</span>
          </div>
        </div>
      </div>

      {/* ===== BODY: CHART + TABLES ===== */}
      <div className="finances__body">
        {/* --- Revenue Chart --- */}
        <div className="finances__card finances__card--chart">
          <div className="finances__card-header">
            <h2 className="finances__card-title">
              {Icons.barChart}
              Ingresos por Dia
            </h2>
          </div>
          {loading ? (
            <div className="finances__chart-skeleton">
              {[...Array(7)].map((_, i) => (
                <SkeletonBlock key={i} width="20px" height={`${30 + Math.random() * 60}%`} />
              ))}
            </div>
          ) : (
            <MiniBarChart data={data?.revenue_by_day || []} />
          )}
        </div>

        {/* --- Top Services --- */}
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">
              {Icons.scissors}
              Top Servicios
            </h2>
          </div>
          {loading ? (
            <div className="finances__list-skeleton">
              {[...Array(5)].map((_, i) => <SkeletonBlock key={i} width="100%" height="40px" />)}
            </div>
          ) : (
            <div className="finances__ranking-list">
              {(data?.revenue_by_service || []).slice(0, 8).map((svc, i) => {
                const maxRev = (data?.revenue_by_service?.[0]?.revenue) || 1;
                const pct = Math.round((svc.revenue / maxRev) * 100);
                return (
                  <div key={i} className="finances__ranking-item">
                    <span className="finances__ranking-pos">{i + 1}</span>
                    <div className="finances__ranking-info">
                      <div className="finances__ranking-top">
                        <span className="finances__ranking-name">{svc.service_name}</span>
                        <span className="finances__ranking-amount">{formatCOP(svc.revenue)}</span>
                      </div>
                      <div className="finances__ranking-bar-bg">
                        <div className="finances__ranking-bar" style={{ width: `${pct}%` }} />
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

      {/* ===== STAFF REVENUE ===== */}
      <div className="finances__card finances__card--full">
        <div className="finances__card-header">
          <h2 className="finances__card-title">
            {Icons.users}
            Rendimiento por Barbero
          </h2>
        </div>
        {loading ? (
          <div className="finances__list-skeleton">
            {[...Array(3)].map((_, i) => <SkeletonBlock key={i} width="100%" height="56px" />)}
          </div>
        ) : (
          <div className="finances__staff-grid">
            {(data?.revenue_by_staff || []).map((staff, i) => (
              <div key={i} className="finances__staff-card">
                <div className="finances__staff-rank">#{i + 1}</div>
                <div className="finances__staff-info">
                  <span className="finances__staff-name">{staff.staff_name}</span>
                  <span className="finances__staff-count">{staff.count} servicios</span>
                </div>
                <div className="finances__staff-revenue">{formatCOP(staff.revenue)}</div>
              </div>
            ))}
            {(!data?.revenue_by_staff || data.revenue_by_staff.length === 0) && (
              <div className="finances__empty">Sin datos para este periodo</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Finances;
