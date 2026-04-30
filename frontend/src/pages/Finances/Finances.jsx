import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import {
  Icons, PERIOD_OPTIONS, TAB_OPTIONS, API_URL,
  AUTO_REFRESH_MS, formatDateRange,
} from './financeConstants';
import TabResumen from './tabs/TabResumen';
import TabGastos from './tabs/TabGastos';
import TabComisiones from './tabs/TabComisiones';
import TabFacturas from './tabs/TabFacturas';
import TabLiquidacion from './tabs/TabLiquidacion';
import TabDian from './tabs/TabDian';
import TabForecast from './tabs/TabForecast';
// TabReportes retired — Resumen now hosts the merged dashboard.

const Finances = () => {
  const { tenant } = useTenant();
  const { user: authUser } = useAuth();
  const isStaffView = authUser?.role === 'staff';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const requested = sessionStorage.getItem('finances:initial-tab');
      if (requested) {
        sessionStorage.removeItem('finances:initial-tab');
        return requested;
      }
      // If we were asked to open an invoice, jump straight to the Facturas tab
      const openInv = sessionStorage.getItem('finances:open_invoice');
      if (openInv) return 'facturas';
    } catch {}
    return 'resumen';
  });

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  const fetchData = useCallback(async (p, isRefresh = false, customFrom, customTo) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      let json;
      if (isStaffView) {
        const commRes = await fetch(`${API_URL}/my/commissions?period=${p}`, { credentials: 'include' });
        if (!commRes.ok) throw new Error('Error cargando datos');
        const comm = await commRes.json();
        const statsRes = await fetch(`${API_URL}/my/stats`, { credentials: 'include' });
        const stats = statsRes.ok ? await statsRes.json() : {};
        const daysMap = {};
        (comm.items || []).forEach(i => { if (i.date) daysMap[i.date] = (daysMap[i.date] || 0) + i.commission; });
        json = {
          total_revenue: comm.total_earnings || ((comm.total_commission || 0) + (comm.total_tips || 0)),
          total_visits: comm.services_count || 0,
          unique_clients: comm.unique_clients || 0,
          avg_ticket: 0,
          revenue_by_day: Object.entries(daysMap).sort().map(([d, r]) => ({ date: d, day: new Date(d + 'T12:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }), revenue: r })),
          revenue_growth_pct: null,
          visits_growth_pct: null,
          staff_commission_rate: stats.commission_rate || 0.45,
          _staff_data: { commission: comm, stats },
        };
      } else {
        let url = `${API_URL}/finances/summary?period=${p}`;
        if (p === 'custom' && customFrom && customTo) {
          url += `&date_from=${customFrom}&date_to=${customTo}`;
        }
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }
        json = await res.json();
      }
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
    if (period === 'custom' && dateFrom && dateTo) {
      fetchData(period, false, dateFrom, dateTo);
    } else if (period !== 'custom') {
      fetchData(period);
    }
  }, [period, dateFrom, dateTo, fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (period === 'custom' && dateFrom && dateTo) {
        fetchData(period, true, dateFrom, dateTo);
      } else if (period !== 'custom') {
        fetchData(period, true);
      }
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [period, dateFrom, dateTo, fetchData]);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    if (p !== 'custom') {
      setShowCustomRange(false);
    }
  };

  const handleCustomToggle = () => {
    if (period === 'custom') {
      setPeriod('month');
      setShowCustomRange(false);
    } else {
      setShowCustomRange(true);
      const today = new Date();
      const thirtyAgo = new Date(today);
      thirtyAgo.setDate(today.getDate() - 30);
      const from = thirtyAgo.toISOString().split('T')[0];
      const to = today.toISOString().split('T')[0];
      setDateFrom(from);
      setDateTo(to);
      setPeriod('custom');
    }
  };

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
          <button className="finances__error-btn" onClick={() => fetchData(period, false, dateFrom, dateTo)}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="finances">
      <div className="finances__header">
        <div className="finances__header-left">
          <div className="finances__header-title-row">
            <h1 className="finances__title">{isStaffView ? 'Mis Ingresos' : 'Finanzas'}</h1>
            {data?.date_from && (
              <span className="finances__date-range">{Icons.calendar} {formatDateRange(data.date_from, data.date_to)}</span>
            )}
          </div>
          <p className="finances__subtitle">{isStaffView ? 'Comisiones, propinas y servicios' : `Control financiero — ${tenant.name}`}</p>
        </div>
        <div className="finances__header-right">
          <button
            className={`finances__refresh-btn ${refreshing ? 'finances__refresh-btn--spinning' : ''}`}
            onClick={() => fetchData(period, true, dateFrom, dateTo)}
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
            <button
              className={`finances__period-btn ${period === 'custom' ? 'finances__period-btn--active' : ''}`}
              onClick={handleCustomToggle}
              disabled={loading}
            >
              {Icons.calendar} Personalizado
            </button>
          </div>
          {showCustomRange && (
            <div className="finances__period-custom">
              <input
                className="finances__input finances__input--date"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="finances__period-custom-sep">—</span>
              <input
                className="finances__input finances__input--date"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
      <div className="finances__tab-selector">
        {(isStaffView ? TAB_OPTIONS.filter(t => ['resumen', 'facturas', 'liquidacion'].includes(t.value)) : TAB_OPTIONS).map((tab) => (
          <button
            key={tab.value}
            className={`finances__tab-btn ${activeTab === tab.value ? 'finances__tab-btn--active' : ''}`}
            style={activeTab === tab.value ? { color: tab.color, '--tab-color': tab.color } : { '--tab-color': tab.color }}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>
      {(activeTab === 'resumen' || activeTab === 'reportes') && <TabResumen data={data} loading={loading} period={period} dateFrom={dateFrom} dateTo={dateTo} isStaffView={isStaffView} />}
      {activeTab === 'forecast' && <TabForecast />}
      {activeTab === 'liquidacion' && <TabLiquidacion period={period} dateFrom={dateFrom} dateTo={dateTo} isStaffView={isStaffView} staffUser={authUser} />}
      {activeTab === 'gastos' && <TabGastos period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'facturas' && <TabFacturas period={period} dateFrom={dateFrom} dateTo={dateTo} isStaffView={isStaffView} staffUser={authUser} />}
      {activeTab === 'dian' && <TabDian />}
    </div>
  );
};

export default Finances;
