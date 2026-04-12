import { useState, useEffect } from 'react';
import staffMeService from '../../../services/staffMeService';

const b = 'staff-finances';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const DollarIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const TrendIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;

const PERIODS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
];

const StaffFinances = () => {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const d = await staffMeService.getCommissions({ period });
        setData(d);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  const filtered = data?.items ? (
    filter === 'paid' ? data.items.filter(i => i.is_paid) :
    filter === 'pending' ? data.items.filter(i => !i.is_paid) :
    data.items
  ) : [];

  const paidCount = data?.items?.filter(i => i.is_paid).length || 0;
  const pendingCount = data?.items?.filter(i => !i.is_paid).length || 0;

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h2>Mis Ingresos</h2>
        <p>Comisiones y ganancias por servicios realizados</p>
      </div>

      <div className={`${b}__tabs`}>
        {PERIODS.map((p) => (
          <button key={p.id} className={`${b}__tab ${period === p.id ? `${b}__tab--active` : ''}`} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={`${b}__loading`}>Cargando datos...</p>
      ) : data ? (
        <>
          <div className={`${b}__summary`}>
            <div className={`${b}__card ${b}__card--highlight`}>
              <div className={`${b}__card-icon`}><DollarIcon /></div>
              <div className={`${b}__card-info`}>
                <span className={`${b}__card-value`}>{formatCurrency(data.total_commission)}</span>
                <span className={`${b}__card-label`}>Tu ganancia total</span>
              </div>
            </div>
            <div className={`${b}__card ${b}__card--success`}>
              <div className={`${b}__card-info`}>
                <span className={`${b}__card-value`}>{formatCurrency(data.total_paid || 0)}</span>
                <span className={`${b}__card-label`}>Pagado</span>
              </div>
            </div>
            <div className={`${b}__card ${b}__card--warning`}>
              <div className={`${b}__card-info`}>
                <span className={`${b}__card-value`}>{formatCurrency(data.total_pending || 0)}</span>
                <span className={`${b}__card-label`}>Pendiente por cobrar</span>
              </div>
            </div>
            <div className={`${b}__card`}>
              <div className={`${b}__card-info`}>
                <span className={`${b}__card-value`}>{data.services_count}</span>
                <span className={`${b}__card-label`}>Servicios</span>
              </div>
            </div>
          </div>

          {data.items.length > 0 ? (
            <div className={`${b}__detail`}>
              <div className={`${b}__detail-header`}>
                <h3 className={`${b}__detail-title`}><TrendIcon /> Detalle de servicios</h3>
                <div className={`${b}__detail-filters`}>
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'pending', label: `Pendientes${pendingCount ? ` (${pendingCount})` : ''}` },
                    { id: 'paid', label: `Pagados${paidCount ? ` (${paidCount})` : ''}` },
                  ].map(f => (
                    <button key={f.id} className={`${b}__filter ${filter === f.id ? `${b}__filter--active` : ''}`} onClick={() => setFilter(f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`${b}__table`}>
                <div className={`${b}__table-head`}>
                  <span>Ticket</span>
                  <span>Fecha</span>
                  <span>Hora</span>
                  <span>Cliente</span>
                  <span>Servicio</span>
                  <span>Tu ganancia</span>
                  <span>Estado</span>
                </div>
                {filtered.map((item) => (
                  <div key={item.id} className={`${b}__table-row ${item.is_paid ? `${b}__table-row--paid` : ''}`}>
                    <span className={`${b}__table-code`}>{item.visit_code ? `#${item.visit_code}` : `#${item.id}`}</span>
                    <span className={`${b}__table-date`}>
                      {new Date(item.date + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                    <span>{item.time || '—'}</span>
                    <span>{item.client_name}</span>
                    <span>{item.service_name}</span>
                    <span className={`${b}__table-commission`}>{formatCurrency(item.commission)}</span>
                    <span className={`${b}__table-status`}>
                      {item.is_paid ? <><CheckIcon /> Pagado</> : <><ClockIcon /> Pendiente</>}
                    </span>
                  </div>
                ))}
              </div>
              <div className={`${b}__table-footer`}>
                <span>{filtered.length} servicios</span>
                <span className={`${b}__table-footer-total`}>Total: {formatCurrency(filtered.reduce((s, i) => s + i.commission, 0))}</span>
              </div>
            </div>
          ) : (
            <div className={`${b}__empty`}>
              <p>No hay servicios completados en este periodo</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default StaffFinances;
