import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNotification } from '../../../context/NotificationContext';
import financeService from '../../../services/financeService';
import {
  Icons, STAFF_COLORS,
  formatCOP, AnimatedNumber, SkeletonBlock,
} from '../financeConstants';

const TabComisiones = ({ period, dateFrom, dateTo }) => {
  const { addNotification } = useNotification();
  const [configs, setConfigs] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editRate, setEditRate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { period };
      if (period === 'custom' && dateFrom && dateTo) {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }
      const [c, p] = await Promise.all([
        financeService.listCommissions(),
        financeService.commissionPayouts(params),
      ]);
      setConfigs(c);
      setPayouts(p);
    } catch (err) {
      addNotification('Error cargando comisiones: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo, addNotification]);

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

  const { totalCommissions, totalRevenue, totalServices, avgRate, maxPayout, staffData } = useMemo(() => {
    const tc = payouts.reduce((s, p) => s + p.commission_amount, 0);
    const tr = payouts.reduce((s, p) => s + p.total_revenue, 0);
    const ts = payouts.reduce((s, p) => s + p.services_count, 0);
    const ar = tr > 0 ? tc / tr : 0;
    const mp = Math.max(...payouts.map(p => p.commission_amount), 1);
    const sd = payouts.map((p, i) => ({
      staff_id: p.staff_id,
      staff_name: p.staff_name,
      rate: p.rate,
      revenue: p.total_revenue,
      commission: p.commission_amount,
      services: p.services_count,
      color: STAFF_COLORS[i % STAFF_COLORS.length],
    }));
    return { totalCommissions: tc, totalRevenue: tr, totalServices: ts, avgRate: ar, maxPayout: mp, staffData: sd };
  }, [payouts]);

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

  return (
    <>
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
      <div className="finances__section-header">
        <h3 className="finances__section-title">Desglose por profesional</h3>
        <span className="finances__section-hint">Las tasas se configuran en Servicios → botón %</span>
      </div>

      {staffData.length > 0 ? (
        <div className="finances__comm-table">
          <div className="finances__comm-table-head">
            <span>Profesional</span>
            <span>Servicios</span>
            <span>Ingresos generados</span>
            <span>Tasa prom.</span>
            <span>Comisión ganada</span>
            <span>Negocio recibe</span>
          </div>
          {staffData.map((staff, i) => {
            const payoutPct = maxPayout > 0 ? (staff.commission / maxPayout) * 100 : 0;
            const negocio = staff.revenue - staff.commission;
            return (
              <div key={staff.staff_id} className="finances__comm-table-row" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="finances__comm-table-staff">
                  <div className="finances__comm-table-avatar" style={{ background: staff.color }}>
                    {staff.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span>{staff.staff_name}</span>
                </div>
                <span className="finances__comm-table-count">{staff.services}</span>
                <span className="finances__comm-table-revenue">{formatCOP(staff.revenue)}</span>
                <span className="finances__comm-table-rate">{(staff.rate * 100).toFixed(0)}%</span>
                <div className="finances__comm-table-earned">
                  <span style={{ color: staff.color, fontWeight: 700 }}>{formatCOP(staff.commission)}</span>
                  <div className="finances__comm-table-bar">
                    <div style={{ width: `${payoutPct}%`, background: staff.color }} />
                  </div>
                </div>
                <span className="finances__comm-table-negocio">{formatCOP(negocio)}</span>
              </div>
            );
          })}
          <div className="finances__comm-table-total">
            <span>Total</span>
            <span>{totalServices}</span>
            <span>{formatCOP(totalRevenue)}</span>
            <span>{(avgRate * 100).toFixed(0)}%</span>
            <span style={{ fontWeight: 700 }}>{formatCOP(totalCommissions)}</span>
            <span style={{ fontWeight: 700 }}>{formatCOP(totalRevenue - totalCommissions)}</span>
          </div>
        </div>
      ) : (
        <div className="finances__empty-state">
          <div className="finances__empty-state-icon">{Icons.users}</div>
          <p className="finances__empty-state-title">Sin comisiones en este periodo</p>
          <p className="finances__empty-state-text">No hay citas completadas o pagadas. Configura las tasas en Servicios → botón %</p>
        </div>
      )}
    </>
  );
};

export default TabComisiones;
