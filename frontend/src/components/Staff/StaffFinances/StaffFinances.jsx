import { useState, useEffect } from 'react';
import staffMeService from '../../../services/staffMeService';

const b = 'staff-finances';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const DollarIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const TrendIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;

const PERIODS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
];

const StaffFinances = () => {
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h2>Mis Ingresos</h2>
        <p>Comisiones y ganancias por servicios completados</p>
      </div>

      <div className={`${b}__tabs`}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            className={`${b}__tab ${period === p.id ? `${b}__tab--active` : ''}`}
            onClick={() => setPeriod(p.id)}
          >
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
                <span className={`${b}__card-label`}>Tu ganancia</span>
              </div>
            </div>
            <div className={`${b}__card`}>
              <div className={`${b}__card-info`}>
                <span className={`${b}__card-value`}>{formatCurrency(data.total_revenue)}</span>
                <span className={`${b}__card-label`}>Ingresos generados</span>
              </div>
            </div>
            <div className={`${b}__card`}>
              <div className={`${b}__card-info`}>
                <span className={`${b}__card-value`}>{data.services_count}</span>
                <span className={`${b}__card-label`}>Servicios</span>
              </div>
            </div>
            <div className={`${b}__card`}>
              <div className={`${b}__card-info`}>
                <span className={`${b}__card-value`}>{Math.round(data.default_rate * 100)}%</span>
                <span className={`${b}__card-label`}>Tu comision</span>
              </div>
            </div>
          </div>

          <div className={`${b}__bar-container`}>
            <div className={`${b}__bar`}>
              <div
                className={`${b}__bar-fill`}
                style={{ width: data.total_revenue > 0 ? `${(data.total_commission / data.total_revenue) * 100}%` : '0%' }}
              />
            </div>
            <div className={`${b}__bar-labels`}>
              <span>Tu parte: {formatCurrency(data.total_commission)}</span>
              <span>Total generado: {formatCurrency(data.total_revenue)}</span>
            </div>
          </div>

          {data.items.length > 0 ? (
            <div className={`${b}__detail`}>
              <h3 className={`${b}__detail-title`}>
                <TrendIcon /> Detalle de servicios
              </h3>
              <div className={`${b}__table`}>
                <div className={`${b}__table-head`}>
                  <span>Fecha</span>
                  <span>Cliente</span>
                  <span>Servicio</span>
                  <span>Ingreso</span>
                  <span>%</span>
                  <span>Tu ganancia</span>
                </div>
                {data.items.map((item) => (
                  <div key={item.id} className={`${b}__table-row`}>
                    <span className={`${b}__table-date`}>
                      {new Date(item.date + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                    <span>{item.client_name}</span>
                    <span>{item.service_name}</span>
                    <span>{formatCurrency(item.amount)}</span>
                    <span>{Math.round(item.rate * 100)}%</span>
                    <span className={`${b}__table-commission`}>{formatCurrency(item.commission)}</span>
                  </div>
                ))}
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
