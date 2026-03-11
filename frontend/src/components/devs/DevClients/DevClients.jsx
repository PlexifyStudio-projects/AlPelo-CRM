import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-clients';

const formatCOP = (val) => `$${Number(val || 0).toLocaleString('es-CO')}`;

const DevClients = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/clients-overview`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setData({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Clientes</h1></div>
        <p className={`${b}__loading`}>Cargando datos de clientes...</p>
      </div>
    );
  }

  const d = data || {};
  const topClients = d.top_clients || [];

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Clientes</h1>
          <p className={`${b}__subtitle`}>Vista global de clientes de todas las agencias</p>
        </div>
      </div>

      {/* KPIs */}
      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi`}><span className={`${b}__kpi-value`}>{d.total_clients || 0}</span><span className={`${b}__kpi-label`}>Total clientes</span></div>
        <div className={`${b}__kpi`}><span className={`${b}__kpi-value`}>{d.active_clients || 0}</span><span className={`${b}__kpi-label`}>Activos</span></div>
        <div className={`${b}__kpi`}><span className={`${b}__kpi-value`}>{d.new_this_month || 0}</span><span className={`${b}__kpi-label`}>Nuevos este mes</span></div>
        <div className={`${b}__kpi`}><span className={`${b}__kpi-value`}>{d.wa_enabled_clients || 0}</span><span className={`${b}__kpi-label`}>Con WhatsApp</span></div>
      </div>

      {/* Status Breakdown */}
      <div className={`${b}__grid`}>
        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Estado de clientes</h3>
          <div className={`${b}__status-list`}>
            <div className={`${b}__status-row`}>
              <span className={`${b}__status-dot ${b}__status-dot--vip`} />
              <span className={`${b}__status-name`}>VIP</span>
              <span className={`${b}__status-count`}>{d.vip_count || 0}</span>
            </div>
            <div className={`${b}__status-row`}>
              <span className={`${b}__status-dot ${b}__status-dot--active`} />
              <span className={`${b}__status-name`}>Activos</span>
              <span className={`${b}__status-count`}>{(d.active_clients || 0) - (d.vip_count || 0)}</span>
            </div>
            <div className={`${b}__status-row`}>
              <span className={`${b}__status-dot ${b}__status-dot--risk`} />
              <span className={`${b}__status-name`}>En riesgo</span>
              <span className={`${b}__status-count`}>{d.at_risk_count || 0}</span>
            </div>
            <div className={`${b}__status-row`}>
              <span className={`${b}__status-dot ${b}__status-dot--inactive`} />
              <span className={`${b}__status-name`}>Inactivos</span>
              <span className={`${b}__status-count`}>{d.inactive_count || 0}</span>
            </div>
          </div>
        </div>

        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Visitas y revenue</h3>
          <div className={`${b}__revenue-stats`}>
            <div className={`${b}__revenue-row`}>
              <span className={`${b}__revenue-label`}>Visitas totales</span>
              <span className={`${b}__revenue-value`}>{(d.total_visits || 0).toLocaleString('es-CO')}</span>
            </div>
            <div className={`${b}__revenue-row`}>
              <span className={`${b}__revenue-label`}>Visitas este mes</span>
              <span className={`${b}__revenue-value`}>{(d.visits_this_month || 0).toLocaleString('es-CO')}</span>
            </div>
            <div className={`${b}__revenue-row`}>
              <span className={`${b}__revenue-label`}>Revenue total</span>
              <span className={`${b}__revenue-value ${b}__revenue-value--highlight`}>{formatCOP(d.total_revenue_cop)}</span>
            </div>
            <div className={`${b}__revenue-row`}>
              <span className={`${b}__revenue-label`}>Revenue este mes</span>
              <span className={`${b}__revenue-value ${b}__revenue-value--highlight`}>{formatCOP(d.revenue_this_month_cop)}</span>
            </div>
            <div className={`${b}__revenue-row`}>
              <span className={`${b}__revenue-label`}>Tareas pendientes</span>
              <span className={`${b}__revenue-value ${(d.pending_tasks || 0) > 0 ? `${b}__revenue-value--alert` : ''}`}>{d.pending_tasks || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Clients */}
      {topClients.length > 0 && (
        <div className={`${b}__section`}>
          <h3 className={`${b}__section-title`}>Top 10 clientes por gasto</h3>
          <div className={`${b}__table-wrap`}>
            <table className={`${b}__table`}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>ID</th>
                  <th>Visitas</th>
                  <th>Total gastado</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((c, i) => (
                  <tr key={c.client_id}>
                    <td className={`${b}__td-rank`}>{i + 1}</td>
                    <td className={`${b}__td-name`}>{c.name}</td>
                    <td className={`${b}__td-mono`}>{c.client_id}</td>
                    <td className={`${b}__td-mono`}>{c.visits}</td>
                    <td className={`${b}__td-mono ${b}__td-amount`}>{formatCOP(c.total_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevClients;
