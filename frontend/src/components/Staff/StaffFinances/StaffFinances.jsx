import { useState, useEffect } from 'react';
import staffMeService from '../../../services/staffMeService';

const b = 'finances';
const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => { if (!d) return ''; const dt = new Date(d + 'T12:00:00'); return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }); };

const PERIODS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta Semana' },
  { id: 'month', label: 'Este Mes' },
];

const Icons = {
  dollar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  trend: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  tip: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
};

const StaffFinances = () => {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const d = await staffMeService.getCommissions({ period });
        setData(d);
      } catch { /* silent */ } finally { setLoading(false); }
    };
    load();
  }, [period]);

  const items = data?.items || [];
  const filtered = items.filter(i => {
    if (filter === 'paid' && !i.is_paid) return false;
    if (filter === 'pending' && i.is_paid) return false;
    if (search) {
      const q = search.toLowerCase();
      const h = [i.client_name, i.service_name, i.visit_code, String(i.id)].filter(Boolean).join(' ').toLowerCase();
      if (!h.includes(q)) return false;
    }
    return true;
  });
  const paidCount = items.filter(i => i.is_paid).length;
  const pendingCount = items.filter(i => !i.is_paid).length;
  const totalTips = items.reduce((s, i) => s + (i.tip || 0), 0);

  return (
    <div className={b} style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div className={`${b}__top-bar`}>
        <div>
          <h1 className={`${b}__title`}>Mis Ingresos</h1>
          <p className={`${b}__subtitle`}>Comisiones y ganancias por servicios realizados</p>
        </div>
      </div>

      {/* Period selector */}
      <div className={`${b}__period-selector`}>
        {PERIODS.map(p => (
          <button key={p.id} className={`${b}__period-btn ${period === p.id ? `${b}__period-btn--active` : ''}`} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Cargando...</div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className={`${b}__kpi-row`}>
            <div className={`${b}__kpi-card ${b}__kpi-card--primary`}>
              <div className={`${b}__kpi-icon`}>{Icons.dollar}</div>
              <div className={`${b}__kpi-body`}>
                <span className={`${b}__kpi-value`}>{fmt(data.total_commission)}</span>
                <span className={`${b}__kpi-label`}>Tu ganancia total</span>
              </div>
            </div>
            <div className={`${b}__kpi-card`}>
              <div className={`${b}__kpi-body`}>
                <span className={`${b}__kpi-value`}>{fmt(data.total_paid || 0)}</span>
                <span className={`${b}__kpi-label`}>Pagado</span>
              </div>
            </div>
            <div className={`${b}__kpi-card`}>
              <div className={`${b}__kpi-body`}>
                <span className={`${b}__kpi-value`}>{fmt(data.total_pending || 0)}</span>
                <span className={`${b}__kpi-label`}>Pendiente por cobrar</span>
              </div>
            </div>
            {totalTips > 0 && (
              <div className={`${b}__kpi-card`}>
                <div className={`${b}__kpi-icon`} style={{ color: '#10B981' }}>{Icons.tip}</div>
                <div className={`${b}__kpi-body`}>
                  <span className={`${b}__kpi-value`} style={{ color: '#10B981' }}>{fmt(totalTips)}</span>
                  <span className={`${b}__kpi-label`}>Propinas</span>
                </div>
              </div>
            )}
            <div className={`${b}__kpi-card`}>
              <div className={`${b}__kpi-body`}>
                <span className={`${b}__kpi-value`}>{data.services_count}</span>
                <span className={`${b}__kpi-label`}>Servicios</span>
              </div>
            </div>
          </div>

          {/* Table */}
          {items.length > 0 ? (
            <div className={`${b}__sale-section`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {Icons.trend} Detalle de servicios
                </h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { id: 'all', label: `Todos (${items.length})` },
                    { id: 'pending', label: `Pendientes (${pendingCount})` },
                    { id: 'paid', label: `Pagados (${paidCount})` },
                  ].map(f => (
                    <button key={f.id}
                      className={`${b}__method-chip ${filter === f.id ? `${b}__method-chip--active` : ''}`}
                      onClick={() => setFilter(f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className={`${b}__inv-search`} style={{ marginBottom: 12 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder="Buscar por cliente, servicio, ticket..." value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button onClick={() => setSearch('')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>}
              </div>

              <div className={`${b}__sale-table`}>
                <div className={`${b}__sale-thead`}>
                  <span className={`${b}__sale-th`} style={{ width: 70 }}>Ticket</span>
                  <span className={`${b}__sale-th`} style={{ width: 80 }}>Fecha</span>
                  <span className={`${b}__sale-th`} style={{ width: 70 }}>Hora</span>
                  <span className={`${b}__sale-th`} style={{ flex: 1 }}>Cliente</span>
                  <span className={`${b}__sale-th`} style={{ flex: 1 }}>Servicio</span>
                  <span className={`${b}__sale-th`} style={{ width: 100, textAlign: 'right' }}>Tu ganancia</span>
                  {totalTips > 0 && <span className={`${b}__sale-th`} style={{ width: 80, textAlign: 'right' }}>Propina</span>}
                  <span className={`${b}__sale-th`} style={{ width: 90 }}>Estado</span>
                </div>
                {filtered.map(item => (
                  <div key={item.id} className={`${b}__sale-row`}>
                    <span style={{ width: 70, fontWeight: 600, color: '#3B82F6', fontSize: 12 }}>
                      {item.visit_code ? `#${item.visit_code}` : `#${item.id}`}
                    </span>
                    <span style={{ width: 80, fontSize: 12, color: '#64748B' }}>{fmtDate(item.date)}</span>
                    <span style={{ width: 70, fontSize: 12, color: '#64748B' }}>{item.time || '—'}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{item.client_name}</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#64748B' }}>{item.service_name}</span>
                    <span style={{ width: 100, textAlign: 'right', fontWeight: 700, color: '#10B981', fontSize: 13 }}>{fmt(item.commission)}</span>
                    {totalTips > 0 && <span style={{ width: 80, textAlign: 'right', fontWeight: 600, color: item.tip > 0 ? '#F59E0B' : '#CBD5E1', fontSize: 12 }}>{item.tip > 0 ? `+${fmt(item.tip)}` : '—'}</span>}
                    <span style={{ width: 90 }}>
                      {item.is_paid
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#10B981', background: 'rgba(16,185,129,0.08)', padding: '3px 8px', borderRadius: 6 }}>{Icons.check} Pagado</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#D97706', background: 'rgba(217,119,6,0.08)', padding: '3px 8px', borderRadius: 6 }}>{Icons.clock} Pendiente</span>
                      }
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #E2E8F0', marginTop: 8, fontSize: 13, color: '#64748B' }}>
                <span>{filtered.length} servicios</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>Total: {fmt(filtered.reduce((s, i) => s + i.commission + (i.tip || 0), 0))}</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8', background: '#F8FAFC', borderRadius: 14, border: '1px dashed #E2E8F0' }}>
              No hay servicios en este periodo
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default StaffFinances;
