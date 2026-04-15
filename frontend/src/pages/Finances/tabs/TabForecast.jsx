import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import financeService from '../../../services/financeService';
import { formatCOP } from '../financeConstants';

const TabForecast = () => {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await financeService.getForecast();
        setForecast(data);
      } catch (err) { console.error('TabForecast: failed to load forecast', err); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="finances__forecast-loading">Calculando proyección...</div>;
  if (!forecast) return <div className="finances__forecast-loading">Sin datos suficientes para proyectar. Necesitas al menos historial de visitas.</div>;

  const { week, month } = forecast;
  const trendUp = month.trend_pct >= 0;
  const monthPct = month.prev_month_total > 0 ? Math.min(100, Math.round(month.actual_so_far / month.prev_month_total * 100)) : 0;
  const projPct = month.prev_month_total > 0 ? Math.min(150, Math.round(month.projected_total / month.prev_month_total * 100)) : 0;

  return (
    <div className="finances__forecast">
      <div className="finances__fc-hero">
        <div className="finances__fc-hero-left">
          <p className="finances__fc-hero-label">Llevas facturado este mes</p>
          <h2 className="finances__fc-hero-amount">{formatCOP(month.actual_so_far)}</h2>
          <p className="finances__fc-hero-sub">en {month.days_elapsed} dias — quedan {month.days_remaining} dias</p>
        </div>
        <div className="finances__fc-hero-right">
          <div className="finances__fc-hero-card">
            <span className="finances__fc-hero-card-label">Si sigues asi, cierras en</span>
            <span className="finances__fc-hero-card-value">{formatCOP(month.projected_total)}</span>
          </div>
          <div className={`finances__fc-hero-card ${trendUp ? 'finances__fc-hero-card--green' : 'finances__fc-hero-card--red'}`}>
            <span className="finances__fc-hero-card-label">vs mes anterior</span>
            <span className="finances__fc-hero-card-value">{trendUp ? '+' : ''}{month.trend_pct}%</span>
          </div>
        </div>
      </div>
      {month.prev_month_total > 0 && (
        <div className="finances__fc-progress-section">
          <div className="finances__fc-progress-head">
            <span>Meta: igualar mes anterior ({formatCOP(month.prev_month_total)})</span>
            <span className="finances__fc-progress-pct">{monthPct}%</span>
          </div>
          <div className="finances__fc-progress-track">
            <div className="finances__fc-progress-fill" style={{ width: `${monthPct}%` }} />
          </div>
        </div>
      )}
      <div className="finances__fc-kpis">
        <div className="finances__fc-kpi">
          <span className="finances__fc-kpi-icon" style={{ background: '#ECFDF5', color: '#059669' }}>$</span>
          <div>
            <span className="finances__fc-kpi-value">{formatCOP(month.daily_run_rate)}</span>
            <span className="finances__fc-kpi-label">Promedio por dia</span>
          </div>
        </div>
        <div className="finances__fc-kpi">
          <span className="finances__fc-kpi-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>&#10003;</span>
          <div>
            <span className="finances__fc-kpi-value">{formatCOP(month.future_confirmed)}</span>
            <span className="finances__fc-kpi-label">Citas confirmadas por cobrar</span>
          </div>
        </div>
        <div className="finances__fc-kpi">
          <span className="finances__fc-kpi-icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}>&#9650;</span>
          <div>
            <span className="finances__fc-kpi-value">{formatCOP(month.prev_month_total)}</span>
            <span className="finances__fc-kpi-label">Total mes anterior</span>
          </div>
        </div>
      </div>
      <div className="finances__fc-week-card">
        <div className="finances__fc-week-head">
          <h3>Esta semana dia por dia</h3>
          <div className="finances__fc-week-totals">
            <span>Confirmado <strong>{formatCOP(week.total_confirmed)}</strong></span>
            <span>Proyectado <strong>{formatCOP(week.total_projected)}</strong></span>
          </div>
        </div>

        <div className="finances__fc-chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={week.daily} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip
                formatter={(value, name) => [formatCOP(value), name]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.85rem' }}
              />
              <Bar dataKey="projected" name="Proyectado" fill="#E2E8F0" radius={[6, 6, 0, 0]} />
              <Bar dataKey="confirmed" name="Citas confirmadas" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              {week.daily.some(d => d.actual > 0) && (
                <Bar dataKey="actual" name="Ya facturado" fill="#059669" radius={[6, 6, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="finances__fc-days">
          {week.daily.map((d) => {
            const mainValue = d.is_past ? d.actual : d.confirmed;
            const isGood = d.is_past && d.actual > 0;
            return (
              <div key={d.date} className={`finances__fc-day ${d.is_today ? 'finances__fc-day--today' : ''} ${d.is_past ? 'finances__fc-day--past' : ''}`}>
                <div className="finances__fc-day-header">
                  <span className="finances__fc-day-name">{d.day_name}</span>
                  <span className="finances__fc-day-num">{d.day_number}</span>
                  {d.is_today && <span className="finances__fc-day-badge">HOY</span>}
                </div>
                <div className="finances__fc-day-amount" style={{ color: isGood ? '#059669' : d.confirmed > 0 ? '#2563EB' : '#94A3B8' }}>
                  {mainValue > 0 ? formatCOP(mainValue) : '—'}
                </div>
                <div className="finances__fc-day-sub">
                  {d.is_past ? 'Facturado' : d.confirmed > 0 ? 'Confirmado' : 'Sin citas'}
                </div>
                {!d.is_past && d.historical_avg > 0 && (
                  <div className="finances__fc-day-hint">Promedio: {formatCOP(d.historical_avg)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TabForecast;
