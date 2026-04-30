import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import financeService from '../../../services/financeService';
import aiService from '../../../services/aiService';
import {
  Icons, CHART_COLORS, CATEGORY_COLORS, WEEKDAY_LABELS,
  formatCOP, formatDayLabel,
  AnimatedNumber, GrowthBadge, RechartsTooltip, SkeletonBlock, PaymentDonutChart,
} from '../financeConstants';

const RevenueAreaChart = ({ data }) => {
  if (!data || data.length === 0) return <div className="finances__empty">Sin datos de ingresos para este periodo</div>;

  const chartData = useMemo(() => data.map(item => {
    const { day, weekday } = formatDayLabel(item.date);
    return { ...item, label: `${weekday} ${day}`, avg_ticket: item.visits > 0 ? Math.round(item.revenue / item.visits) : 0 };
  }), [data]);

  const useBar = chartData.length <= 7;

  return (
    <div className="finances__recharts-container">
      <ResponsiveContainer width="100%" height={280}>
        {useBar ? (
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2D5A3D" />
                <stop offset="100%" stopColor="#3D7A52" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDEDEB" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8E8E85', fontWeight: 600 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} width={50} />
            <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
            <Bar dataKey="revenue" name="Ingresos" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={60} />
          </BarChart>
        ) : (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D5A3D" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2D5A3D" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDEDEB" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} width={50} />
            <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
            <Area type="monotone" dataKey="revenue" name="Ingresos" stroke="#2D5A3D" strokeWidth={2.5} fill="url(#revenueGrad)" dot={{ r: 3, fill: '#2D5A3D', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#2D5A3D', stroke: '#fff', strokeWidth: 2 }} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

const StaffBarChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const chartData = useMemo(() => data.map(s => ({ ...s, initials: s.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2) })), [data]);

  return (
    <div className="finances__recharts-container">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 50)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDEDEB" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
          <YAxis type="category" dataKey="staff_name" tick={{ fontSize: 12, fill: '#333330' }} tickLine={false} axisLine={false} width={160} />
          <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
          <Bar dataKey="revenue" name="Ingresos" radius={[0, 6, 6, 0]} barSize={24}>
            {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const CategoryBreakdown = ({ categories }) => {
  if (!categories || categories.length === 0) return <div className="finances__empty">Sin datos por categoria</div>;
  const total = useMemo(() => categories.reduce((s, c) => s + c.revenue, 0) || 1, [categories]);

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

// ─── AnalyticsExtras: comparison cards + top services + weekday chart (from old Reportes tab) ───
const AnalyticsExtras = ({ period, dateFrom, dateTo }) => {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const params = { period };
    if (period === 'custom' && dateFrom && dateTo) { params.date_from = dateFrom; params.date_to = dateTo; }
    financeService.getAnalytics(params).then(setAnalytics).catch(() => {});
  }, [period, dateFrom, dateTo]);

  const comparisonItems = useMemo(() => {
    if (!analytics) return [];
    return [
      { label: 'Ingresos', current: analytics.current_revenue, previous: analytics.previous_revenue, change: analytics.revenue_change_pct, color: '#059669', bg: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(16,185,129,0.03))' },
      { label: 'Gastos', current: analytics.current_expenses, previous: analytics.previous_expenses, change: analytics.expenses_change_pct, color: '#DC2626', bg: 'linear-gradient(135deg, rgba(220,38,38,0.06), rgba(239,68,68,0.02))' },
      { label: 'Ganancia Neta', current: analytics.current_profit, previous: analytics.previous_profit, change: analytics.profit_change_pct, color: '#2D5A3D', bg: 'linear-gradient(135deg, rgba(45,90,61,0.08), rgba(61,122,82,0.03))' },
    ];
  }, [analytics]);

  const weekdayData = useMemo(() => {
    if (!analytics) return [];
    return (analytics.revenue_by_weekday || []).map(d => ({ ...d, label: WEEKDAY_LABELS[d.weekday] || d.weekday_name }));
  }, [analytics]);

  if (!analytics) return null;
  const bestDay = weekdayData.length > 0 ? weekdayData.reduce((a, b) => b.revenue > a.revenue ? b : a) : null;

  return (
    <>
      {/* Comparison vs periodo anterior */}
      <div className="finances__comparison-grid">
        {comparisonItems.map((item, i) => (
          <div key={i} className="finances__comparison-card" style={{ background: item.bg, borderLeft: `3px solid ${item.color}` }}>
            <span className="finances__comparison-label">{item.label}</span>
            <span className="finances__comparison-current-value" style={{ color: item.color }}>{formatCOP(item.current)}</span>
            <div className="finances__comparison-values">
              <div className="finances__comparison-previous">
                <span className="finances__comparison-period-label">Periodo anterior</span>
                <span className="finances__comparison-previous-value">{formatCOP(item.previous)}</span>
              </div>
              <GrowthBadge value={item.change} />
            </div>
          </div>
        ))}
      </div>

      {/* Top servicios + ingresos por dia de semana */}
      <div className="finances__body">
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.scissors} Servicios mas vendidos</h2>
            <span className="finances__card-badge">{(analytics.revenue_by_service || []).length} servicios</span>
          </div>
          <div className="finances__ranking-list">
            {(analytics.revenue_by_service || []).slice(0, 8).map((svc, i) => {
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
    </>
  );
};

const PaymentMethodsCard = ({ period, dateFrom, dateTo }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = { period };
    if (period === 'custom' && dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    }
    financeService.paymentMethods(params).then(setData).catch(err => console.error('PaymentMethodsCard fetch error:', err));
  }, [period, dateFrom, dateTo]);

  if (!data || !data.items || data.items.length === 0) return null;

  return <PaymentDonutChart data={data} />;
};

const TabResumen = ({ data, loading, period, dateFrom, dateTo, isStaffView = false }) => {
  const hasData = data && data.total_visits > 0;
  // Staff: data.total_revenue already IS the commission (transformed in fetchData)
  const staffCommRate = data?.staff_commission_rate || 0.45;
  const staffEarnings = isStaffView ? (data?.total_revenue || 0) : null;
  const daysWorked = isStaffView ? (data?.revenue_by_day || []).filter(d => d.revenue > 0).length : null;
  const staffComm = isStaffView ? data?._staff_data?.commission : null;
  const staffPendingPay = staffComm?.total_pending || 0;
  const staffTips = staffComm?.total_tips || 0;
  const staffFines = staffComm?.total_fines || 0;
  const staffPaid = staffComm?.total_paid || 0;

  return (
    <>
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="110px" height="30px" /> : (
              <>
                <span className="finances__kpi-value"><AnimatedNumber value={isStaffView ? staffEarnings : (data?.total_revenue || 0)} prefix="$" /></span>
                <GrowthBadge value={data?.revenue_growth_pct} />
              </>
            )}
            <span className="finances__kpi-label">{isStaffView ? 'Tus Ingresos' : 'Ingresos Totales'}</span>
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
          <div className="finances__kpi-icon finances__kpi-icon--accent">{isStaffView ? Icons.calendar : Icons.creditCard}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="70px" height="30px" /> : (
              <span className="finances__kpi-value">
                {isStaffView ? <AnimatedNumber value={daysWorked || 0} /> : <AnimatedNumber value={data?.avg_ticket || 0} prefix="$" />}
              </span>
            )}
            <span className="finances__kpi-label">{isStaffView ? 'Dias Trabajados' : 'Ticket Promedio'}</span>
          </div>
        </div>
        {!isStaffView && (data?.pending_payments || 0) > 0 && (
          <div className="finances__kpi-card finances__kpi-card--warning">
            <div className="finances__kpi-icon finances__kpi-icon--warning">{Icons.alert}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value"><AnimatedNumber value={data?.pending_payments || 0} /></span>
              <span className="finances__kpi-label">Pagos Pendientes</span>
            </div>
          </div>
        )}
        {isStaffView && (
          <div className="finances__kpi-card" style={{ borderLeft: '3px solid #10B981' }}>
            <div className="finances__kpi-icon" style={{ color: '#10B981', background: 'rgba(16,185,129,0.08)' }}>{Icons.check}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value"><AnimatedNumber value={staffPaid} prefix="$" /></span>
              <span className="finances__kpi-label">Pagado</span>
            </div>
          </div>
        )}
        {isStaffView && (
          <div className="finances__kpi-card" style={{ borderLeft: '3px solid #F59E0B' }}>
            <div className="finances__kpi-icon" style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.08)' }}>{Icons.clock}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value"><AnimatedNumber value={staffPendingPay} prefix="$" /></span>
              <span className="finances__kpi-label">Por Cobrar</span>
            </div>
          </div>
        )}
        {isStaffView && (
          <div className="finances__kpi-card" style={{ borderLeft: '3px solid #8B5CF6' }}>
            <div className="finances__kpi-icon" style={{ color: '#8B5CF6', background: 'rgba(139,92,246,0.08)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            </div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value"><AnimatedNumber value={staffTips} prefix="$" /></span>
              <span className="finances__kpi-label">Propinas</span>
            </div>
          </div>
        )}
        {isStaffView && (
          <div className="finances__kpi-card" style={{ borderLeft: '3px solid #EF4444' }}>
            <div className="finances__kpi-icon" style={{ color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}>{Icons.alert}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value"><AnimatedNumber value={staffFines} prefix="-$" /></span>
              <span className="finances__kpi-label">Multas</span>
            </div>
          </div>
        )}
      </div>

      {/* Revenue chart */}
      <div className="finances__card finances__card--chart">
        <div className="finances__card-header">
          <h2 className="finances__card-title">{Icons.barChart} {isStaffView ? 'Tus ingresos por dia' : 'Ingresos por dia'}</h2>
          {!loading && hasData && (
            <span className="finances__card-badge">{(data.revenue_by_day || []).length} dias</span>
          )}
        </div>
        {loading ? (
          <div className="finances__chart-skeleton">
            {[...Array(8)].map((_, i) => <SkeletonBlock key={i} width="24px" height={`${25 + Math.random() * 65}%`} />)}
          </div>
        ) : (
          <RevenueAreaChart data={data?.revenue_by_day || []} />
        )}
      </div>

      {/* Bottom section */}
      {!loading && (
        isStaffView ? (() => {
          const staffItems = staffComm?.items || [];
          // Top clients
          const clientMap = {};
          staffItems.forEach(i => {
            if (!clientMap[i.client_name]) clientMap[i.client_name] = { count: 0, revenue: 0 };
            clientMap[i.client_name].count++;
            clientMap[i.client_name].revenue += i.commission;
          });
          const topClients = Object.entries(clientMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
          // Top services
          const svcMap = {};
          staffItems.forEach(i => {
            if (!svcMap[i.service_name]) svcMap[i.service_name] = { count: 0, revenue: 0 };
            svcMap[i.service_name].count++;
            svcMap[i.service_name].revenue += i.commission;
          });
          const topServices = Object.entries(svcMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
          const maxSvc = topServices.length > 0 ? topServices[0][1].count : 1;

          return (
            <div className="finances__body" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              {/* Top clients */}
              <div className="finances__card">
                <div className="finances__card-header">
                  <h2 className="finances__card-title">{Icons.users} Tus clientes frecuentes</h2>
                </div>
                {topClients.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {topClients.map(([name, d], i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < topClients.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <span style={{ width: 32, height: 32, borderRadius: '50%', background: ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444'][i] + '15', color: ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444'][i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{d.count} visita{d.count > 1 ? 's' : ''}</div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>{formatCOP(d.revenue)}</span>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Sin datos</div>}
              </div>

              {/* Top services */}
              <div className="finances__card">
                <div className="finances__card-header">
                  <h2 className="finances__card-title">{Icons.receipt} Tus servicios</h2>
                </div>
                {topServices.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {topServices.map(([name, d], i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</span>
                          <span style={{ fontSize: 12, color: '#64748B', flexShrink: 0, marginLeft: 8 }}>{d.count}x · Ganas {formatCOP(d.revenue)}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: '#F1F5F9', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, background: ['#2D5A3D','#3B82F6','#F59E0B','#8B5CF6','#10B981'][i], width: `${(d.count / maxSvc) * 100}%`, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Sin datos</div>}
              </div>

              {/* Performance summary */}
              <div className="finances__card">
                <div className="finances__card-header">
                  <h2 className="finances__card-title">{Icons.barChart} Tu rendimiento</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { label: 'Comision total', value: formatCOP(staffComm?.total_commission || 0), color: '#2D5A3D' },
                    { label: 'Propinas recibidas', value: `+${formatCOP(staffTips)}`, color: '#8B5CF6' },
                    { label: 'Multas', value: staffFines > 0 ? `-${formatCOP(staffFines)}` : '$0', color: '#EF4444' },
                    { label: 'Promedio por servicio', value: formatCOP(staffItems.length > 0 ? Math.round((staffComm?.total_commission || 0) / staffItems.length) : 0), color: '#3B82F6' },
                    { label: 'Promedio diario', value: formatCOP(daysWorked > 0 ? Math.round(staffEarnings / daysWorked) : 0), color: '#F59E0B' },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 5 ? '1px solid #F1F5F9' : 'none' }}>
                      <span style={{ fontSize: 13, color: '#64748B' }}>{row.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })() : (
          <>
            <div className="finances__body">
              <OwnerProfitPanel period={period} dateFrom={dateFrom} dateTo={dateTo} />
              <PaymentMethodsCard period={period} dateFrom={dateFrom} dateTo={dateTo} />
            </div>
            {/* Merged from old Reportes tab: comparison vs prev period + top services + weekday */}
            <AnalyticsExtras period={period} dateFrom={dateFrom} dateTo={dateTo} />
          </>
        )
      )}
    </>
  );
};

const OwnerProfitPanel = ({ period, dateFrom, dateTo }) => {
  const [pnl, setPnl] = useState(null);

  useEffect(() => {
    const params = { period };
    if (period === 'custom' && dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    }
    financeService.getPnL(params).then(setPnl).catch(err => console.error('OwnerProfitPanel P&L fetch error:', err));
  }, [period, dateFrom, dateTo]);

  if (!pnl) return null;

  const estimatedIva = Math.round(pnl.total_revenue * 0.19);
  const isProfit = pnl.net_profit >= 0;

  return (
    <div className="finances__owner-panel">
      <div className="finances__owner-hero">
        <span className="finances__owner-eyebrow">Tu Ganancia Neta</span>
        <span className={`finances__owner-big ${isProfit ? '' : 'finances__owner-big--loss'}`}>
          {formatCOP(pnl.net_profit)}
        </span>
        <div className="finances__owner-margin">
          <div className="finances__owner-margin-bar">
            <div className="finances__owner-margin-fill" style={{ width: `${Math.max(Math.min(pnl.margin_pct, 100), 0)}%` }} />
          </div>
          <span className="finances__owner-margin-label">Margen {pnl.margin_pct}%</span>
        </div>
      </div>
      <div className="finances__owner-breakdown">
        <div className="finances__owner-row">
          <div className="finances__owner-row-left">
            <span className="finances__owner-dot finances__owner-dot--green" />
            <span className="finances__owner-label">Ingresos por servicios</span>
          </div>
          <span className="finances__owner-value finances__owner-value--positive">+{formatCOP(pnl.total_revenue)}</span>
        </div>
        <div className="finances__owner-row">
          <div className="finances__owner-row-left">
            <span className="finances__owner-dot finances__owner-dot--red" />
            <span className="finances__owner-label">Comisiones equipo</span>
          </div>
          <span className="finances__owner-value finances__owner-value--negative">-{formatCOP(pnl.total_commissions)}</span>
        </div>
        <div className="finances__owner-row">
          <div className="finances__owner-row-left">
            <span className="finances__owner-dot finances__owner-dot--orange" />
            <span className="finances__owner-label">Gastos operativos</span>
          </div>
          <span className="finances__owner-value finances__owner-value--negative">-{formatCOP(pnl.total_expenses)}</span>
        </div>
        {estimatedIva > 0 && (
          <div className="finances__owner-row finances__owner-row--subtle">
            <div className="finances__owner-row-left">
              <span className="finances__owner-dot finances__owner-dot--muted" />
              <span className="finances__owner-label">IVA recaudado (est.)</span>
            </div>
            <span className="finances__owner-value finances__owner-value--muted">{formatCOP(estimatedIva)}</span>
          </div>
        )}
        <div className="finances__owner-dist">
          {pnl.total_revenue > 0 && (
            <>
              <div className="finances__owner-dist-seg finances__owner-dist-seg--profit" style={{ width: `${Math.max((pnl.net_profit / pnl.total_revenue) * 100, 0)}%` }} title={`Ganancia: ${formatCOP(pnl.net_profit)}`} />
              <div className="finances__owner-dist-seg finances__owner-dist-seg--comm" style={{ width: `${(pnl.total_commissions / pnl.total_revenue) * 100}%` }} title={`Comisiones: ${formatCOP(pnl.total_commissions)}`} />
              <div className="finances__owner-dist-seg finances__owner-dist-seg--expense" style={{ width: `${(pnl.total_expenses / pnl.total_revenue) * 100}%` }} title={`Gastos: ${formatCOP(pnl.total_expenses)}`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const FinanceAIWidget = ({ period, dateFrom, dateTo }) => {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const periodLabel = period === 'custom' && dateFrom && dateTo
    ? `${dateFrom} a ${dateTo}`
    : { today: 'hoy', week: 'esta semana', month: 'este mes', year: 'este ano' }[period] || period;

  const chips = [
    'Cuanto gaste en productos este mes?',
    'Cual fue mi mejor dia?',
    'Cuanto le debo al equipo?',
    'Resumen financiero completo',
  ];

  const handleAsk = async (message) => {
    if (!message.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const prefixed = `[Finanzas] El usuario pregunta desde la pagina de Finanzas, periodo: ${periodLabel}. Pregunta: ${message}`;
      const res = await aiService.chat(prefixed, []);
      setResponse(res.response);
    } catch {
      setResponse('Error al consultar la IA. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAsk(query);
  };

  return (
    <div className={`finances__ai-widget ${expanded ? 'finances__ai-widget--expanded' : ''}`}>
      <button className="finances__ai-header" onClick={() => setExpanded(!expanded)}>
        <span className="finances__ai-sparkle">{'\u2728'}</span>
        <span>Preguntale a Lina sobre tus finanzas</span>
        <svg className={`finances__ai-chevron ${expanded ? 'finances__ai-chevron--open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {expanded && (
        <div className="finances__ai-body">
          <div className="finances__ai-chips">
            {chips.map((chip, i) => (
              <button key={i} className="finances__ai-chip" onClick={() => { setQuery(chip); handleAsk(chip); }}>{chip}</button>
            ))}
          </div>
          <form className="finances__ai-input-row" onSubmit={handleSubmit}>
            <input
              className="finances__input"
              placeholder="Escribe tu pregunta financiera..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="finances__btn-primary" disabled={loading || !query.trim()}>
              {loading ? 'Pensando...' : 'Preguntar'}
            </button>
          </form>
          {(response || loading) && (
            <div className="finances__ai-response">
              {loading ? (
                <div className="finances__ai-loading">
                  <span className="finances__ai-dot" /><span className="finances__ai-dot" /><span className="finances__ai-dot" />
                </div>
              ) : (
                <>
                  <div className="finances__ai-answer">{response}</div>
                  <button className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => { setResponse(''); setQuery(''); }}>Limpiar</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export { TabResumen, OwnerProfitPanel, FinanceAIWidget, PaymentMethodsCard };
export default TabResumen;
