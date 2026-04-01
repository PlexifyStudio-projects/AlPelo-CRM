import { useState, useEffect, useCallback, useMemo } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-clients';

const formatCOP = (val) => `$${Number(val || 0).toLocaleString('es-CO')}`;
const formatNum = (n) => Number(n || 0).toLocaleString('es-CO');
const pct = (used, limit) => limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

const DevClients = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/tenants`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setTenants(await res.json());
    } catch {
      setTenants([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Nuestros Clientes</h1></div>
        <p className={`${b}__loading`}>Cargando agencias...</p>
      </div>
    );
  }

  const { active, inactive, totalMRR, totalMsgsUsed, totalMsgsLimit, nearLimit, aiPaused } = useMemo(() => {
    const act = tenants.filter(t => t.is_active);
    const inact = tenants.filter(t => !t.is_active);
    return {
      active: act,
      inactive: inact,
      totalMRR: act.reduce((s, t) => s + (t.monthly_price || 0), 0),
      totalMsgsUsed: tenants.reduce((s, t) => s + (t.messages_used || 0), 0),
      totalMsgsLimit: tenants.reduce((s, t) => s + (t.messages_limit || 0), 0),
      nearLimit: tenants.filter(t => t.messages_limit > 0 && (t.messages_used / t.messages_limit) >= 0.8),
      aiPaused: tenants.filter(t => t.ai_is_paused),
    };
  }, [tenants]);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Nuestros Clientes</h1>
          <p className={`${b}__subtitle`}>Agencias que usan Plexify Studio</p>
        </div>
      </div>

      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{tenants.length}</span>
          <span className={`${b}__kpi-label`}>Total agencias</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{active.length}</span>
          <span className={`${b}__kpi-label`}>Activas</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{formatCOP(totalMRR)}</span>
          <span className={`${b}__kpi-label`}>MRR (mensual)</span>
        </div>
        <div className={`${b}__kpi ${nearLimit.length > 0 ? `${b}__kpi--alert` : ''}`}>
          <span className={`${b}__kpi-value`}>{nearLimit.length}</span>
          <span className={`${b}__kpi-label`}>Cerca del limite</span>
        </div>
      </div>

      <div className={`${b}__grid`}>
        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Estado de agencias</h3>
          <div className={`${b}__status-list`}>
            <div className={`${b}__status-row`}>
              <span className={`${b}__status-dot ${b}__status-dot--active`} />
              <span className={`${b}__status-name`}>Activas</span>
              <span className={`${b}__status-count`}>{active.length}</span>
            </div>
            <div className={`${b}__status-row`}>
              <span className={`${b}__status-dot ${b}__status-dot--inactive`} />
              <span className={`${b}__status-name`}>Inactivas</span>
              <span className={`${b}__status-count`}>{inactive.length}</span>
            </div>
            <div className={`${b}__status-row`}>
              <span className={`${b}__status-dot ${b}__status-dot--risk`} />
              <span className={`${b}__status-name`}>IA pausada</span>
              <span className={`${b}__status-count`}>{aiPaused.length}</span>
            </div>
            <div className={`${b}__status-row`}>
              <span className={`${b}__status-dot ${b}__status-dot--vip`} />
              <span className={`${b}__status-name`}>Cerca del limite (&ge;80%)</span>
              <span className={`${b}__status-count`}>{nearLimit.length}</span>
            </div>
          </div>
        </div>

        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Consumo global</h3>
          <div className={`${b}__revenue-stats`}>
            <div className={`${b}__revenue-row`}>
              <span className={`${b}__revenue-label`}>Mensajes usados</span>
              <span className={`${b}__revenue-value`}>{formatNum(totalMsgsUsed)}</span>
            </div>
            <div className={`${b}__revenue-row`}>
              <span className={`${b}__revenue-label`}>Limite total</span>
              <span className={`${b}__revenue-value`}>{formatNum(totalMsgsLimit)}</span>
            </div>
            <div className={`${b}__revenue-row`}>
              <span className={`${b}__revenue-label`}>Uso global</span>
              <span className={`${b}__revenue-value ${b}__revenue-value--highlight`}>{pct(totalMsgsUsed, totalMsgsLimit)}%</span>
            </div>
            <div className={`${b}__revenue-row`}>
              <span className={`${b}__revenue-label`}>MRR total</span>
              <span className={`${b}__revenue-value ${b}__revenue-value--highlight`}>{formatCOP(totalMRR)}</span>
            </div>
          </div>
        </div>
      </div>

      {tenants.length > 0 ? (
        <div className={`${b}__section`}>
          <h3 className={`${b}__section-title`}>Detalle por agencia</h3>
          <div className={`${b}__table-wrap`}>
            <table className={`${b}__table`}>
              <thead>
                <tr>
                  <th>Agencia</th>
                  <th>Propietario</th>
                  <th>Ciudad</th>
                  <th>Mensajes</th>
                  <th>Uso</th>
                  <th>Precio/mes</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const usage = pct(t.messages_used, t.messages_limit);
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className={`${b}__td-agency`}>
                          <span className={`${b}__td-name`}>{t.name}</span>
                          <span className={`${b}__td-slug`}>{t.slug}</span>
                        </div>
                      </td>
                      <td className={`${b}__td-owner`}>
                        <span>{t.owner_name || '—'}</span>
                        {t.owner_phone && <span className={`${b}__td-phone`}>{t.owner_phone}</span>}
                      </td>
                      <td>{t.city || '—'}</td>
                      <td className={`${b}__td-mono`}>
                        {formatNum(t.messages_used)} / {formatNum(t.messages_limit)}
                      </td>
                      <td>
                        <div className={`${b}__usage-bar`}>
                          <div
                            className={`${b}__usage-fill ${usage >= 80 ? `${b}__usage-fill--danger` : usage >= 50 ? `${b}__usage-fill--warn` : ''}`}
                            style={{ width: `${usage}%` }}
                          />
                        </div>
                        <span className={`${b}__td-pct`}>{usage}%</span>
                      </td>
                      <td className={`${b}__td-mono ${b}__td-amount`}>{formatCOP(t.monthly_price)}</td>
                      <td>
                        <span className={`${b}__badge ${t.is_active ? `${b}__badge--active` : `${b}__badge--inactive`}`}>
                          {t.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                        {t.ai_is_paused && (
                          <span className={`${b}__badge ${b}__badge--paused`}>IA off</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={`${b}__empty`}>
          <p>Sin agencias registradas</p>
        </div>
      )}
    </div>
  );
};

export default DevClients;
