import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useNotification } from '../../../context/NotificationContext';
import financeService from '../../../services/financeService';
import {
  Icons, CATEGORY_COLORS, WEEKDAY_LABELS,
  formatCOP, GrowthBadge, RechartsTooltip, SkeletonBlock,
} from '../financeConstants';

const TabReportes = ({ period, dateFrom, dateTo }) => {
  const { addNotification } = useNotification();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { period };
    if (period === 'custom' && dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    }
    financeService.getAnalytics(params)
      .then(setAnalytics)
      .catch(err => addNotification('Error cargando analytics: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, [period, dateFrom, dateTo, addNotification]);

  const handleExport = async () => {
    try {
      const params = { period };
      if (period === 'custom' && dateFrom && dateTo) {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }
      const blob = await financeService.exportTransactions(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transacciones_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addNotification('CSV descargado', 'success');
    } catch (err) {
      addNotification('Error al exportar: ' + err.message, 'error');
    }
  };

  const comparisonItems = useMemo(() => {
    if (!analytics) return [];
    return [
      { label: 'Ingresos', current: analytics.current_revenue, previous: analytics.previous_revenue, change: analytics.revenue_change_pct, format: formatCOP, color: '#059669', bg: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(16,185,129,0.03))' },
      { label: 'Gastos', current: analytics.current_expenses, previous: analytics.previous_expenses, change: analytics.expenses_change_pct, format: formatCOP, invertColor: true, color: '#DC2626', bg: 'linear-gradient(135deg, rgba(220,38,38,0.06), rgba(239,68,68,0.02))' },
      { label: 'Ganancia Neta', current: analytics.current_profit, previous: analytics.previous_profit, change: analytics.profit_change_pct, format: formatCOP, color: '#2D5A3D', bg: 'linear-gradient(135deg, rgba(45,90,61,0.08), rgba(61,122,82,0.03))' },
    ];
  }, [analytics]);

  const weekdayData = useMemo(() => {
    if (!analytics) return [];
    return (analytics.revenue_by_weekday || []).map(d => ({
      ...d,
      label: WEEKDAY_LABELS[d.weekday] || d.weekday_name,
    }));
  }, [analytics]);

  if (loading) {
    return (
      <div className="finances__report-skeleton">
        {[...Array(4)].map((_, i) => <SkeletonBlock key={i} width="100%" height="80px" />)}
      </div>
    );
  }

  if (!analytics) return <div className="finances__empty">Sin datos de analytics</div>;

  const bestDay = weekdayData.length > 0 ? weekdayData.reduce((a, b) => b.revenue > a.revenue ? b : a) : null;
  const worstDay = weekdayData.length > 0 ? weekdayData.filter(d => d.revenue > 0).reduce((a, b) => b.revenue < a.revenue ? b : a, weekdayData[0]) : null;
  const topService = (analytics.revenue_by_service || [])[0];
  const staffList = analytics.revenue_by_staff || [];

  return (
    <>
      {/* Header + Export */}
      <div className="finances__section-header">
        <h3 className="finances__section-title">Reportes</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="finances__action-btn" onClick={handleExport}>{Icons.download} CSV</button>
          <button className="finances__action-btn" onClick={async () => {
            try {
              const paramsObj = { period };
              if (period === 'custom' && dateFrom && dateTo) { paramsObj.date_from = dateFrom; paramsObj.date_to = dateTo; }
              const blob = await financeService.exportExcel(paramsObj);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `Finanzas_${period}.xlsx`; a.click();
              URL.revokeObjectURL(url);
              addNotification('Excel descargado', 'success');
            } catch (err) { addNotification('Error al exportar Excel: ' + err.message, 'error'); }
          }}>{Icons.download} Excel</button>
        </div>
      </div>

      {/* Comparison cards with color */}
      <div className="finances__comparison-grid">
        {comparisonItems.map((item, i) => (
          <div key={i} className="finances__comparison-card" style={{ background: item.bg, borderLeft: `3px solid ${item.color}` }}>
            <span className="finances__comparison-label">{item.label}</span>
            <span className="finances__comparison-current-value" style={{ color: item.color }}>{item.format(item.current)}</span>
            <div className="finances__comparison-values">
              <div className="finances__comparison-previous">
                <span className="finances__comparison-period-label">Periodo anterior</span>
                <span className="finances__comparison-previous-value">{item.format(item.previous)}</span>
              </div>
              <GrowthBadge value={item.change} />
            </div>
          </div>
        ))}
      </div>

      {/* Revenue por Servicio + Revenue por Día — side by side */}
      <div className="finances__body">
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.scissors} Servicios mas vendidos</h2>
            <span className="finances__card-badge">{(analytics.revenue_by_service || []).length} servicios</span>
          </div>
          <div className="finances__ranking-list">
            {(analytics.revenue_by_service || []).map((svc, i) => {
              const maxRev = (analytics.revenue_by_service?.[0]?.revenue) || 1;
              const pct = Math.round((svc.revenue / maxRev) * 100);
              return (
                <div key={i} className={`finances__ranking-item ${i < 3 ? 'finances__ranking-item--top' : ''}`}>
                  <span className={`finances__ranking-pos ${i < 3 ? 'finances__ranking-pos--highlight' : ''}`}>
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
                    <span className="finances__ranking-count">{svc.count} {svc.count === 1 ? 'servicio' : 'servicios'} · Ticket: {formatCOP(svc.avg_ticket || Math.round(svc.revenue / Math.max(svc.count, 1)))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue por día de semana */}
        {weekdayData.length > 0 && (
          <div className="finances__card">
            <div className="finances__card-header">
              <h2 className="finances__card-title">{Icons.calendar} Ingresos por dia</h2>
              {bestDay && <span className="finances__card-badge" style={{ color: '#059669' }}>Mejor: {bestDay.label}</span>}
            </div>
            <div className="finances__recharts-container">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDEDEB" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#333330' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} width={45} />
                  <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
                  <Bar dataKey="revenue" name="Ingresos" radius={[6, 6, 0, 0]} barSize={36}>
                    {weekdayData.map((d, i) => {
                      const maxRev = Math.max(...weekdayData.map(x => x.revenue), 1);
                      const intensity = d.revenue / maxRev;
                      const color = intensity > 0.8 ? '#1E3D2A' : intensity > 0.5 ? '#2D5A3D' : intensity > 0.2 ? '#3D7A52' : '#4E9466';
                      return <Cell key={i} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="finances__weekday-stats">
              {weekdayData.map((d, i) => (
                <div key={i} className="finances__weekday-stat">
                  <span className="finances__weekday-label">{d.label}</span>
                  <span className="finances__weekday-value">{formatCOP(d.revenue)}</span>
                  <span className="finances__weekday-visits">{d.visits} servicios</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Key metrics */}
      <div className="finances__report-summary">
        <div className="finances__report-summary-item" style={{ borderTop: '3px solid #3B82F6' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span className="finances__report-summary-value" style={{ color: '#3B82F6' }}>{analytics.unique_clients}</span>
          <span className="finances__report-summary-label">Clientes unicos</span>
        </div>
        <div className="finances__report-summary-item" style={{ borderTop: '3px solid #8B5CF6' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
          <span className="finances__report-summary-value" style={{ color: '#8B5CF6' }}>{analytics.current_visits}</span>
          <span className="finances__report-summary-label">Total servicios</span>
        </div>
        <div className="finances__report-summary-item" style={{ borderTop: '3px solid #F59E0B' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span className="finances__report-summary-value" style={{ color: '#F59E0B' }}>{formatCOP(analytics.current_avg_ticket)}</span>
          <span className="finances__report-summary-label">Ticket promedio</span>
        </div>
        <div className="finances__report-summary-item" style={{ borderTop: '3px solid #059669' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          <span className="finances__report-summary-value" style={{ color: '#059669' }}>{analytics.margin_pct}%</span>
          <span className="finances__report-summary-label">Margen neto</span>
        </div>
      </div>
    </>
  );
};

export default TabReportes;
