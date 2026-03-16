import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-dash';

const formatCOP = (val) => `$${Number(val || 0).toLocaleString('es-CO')}`;
const formatNum = (n) => Number(n || 0).toLocaleString('es-CO');
const formatTokens = (n) => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
};

const DevDashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [waHealth, setWaHealth] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  const apiFetch = useCallback(async (path) => {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [s, wa, act] = await Promise.allSettled([
        apiFetch('/dev/stats'),
        apiFetch('/dev/whatsapp-health'),
        apiFetch('/dev/activity'),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (wa.status === 'fulfilled') setWaHealth(wa.value);
      if (act.status === 'fulfilled') setActivity(act.value);
    } catch { /* at least some data loaded */ }
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}>
          <h1 className={`${b}__title`}>Dashboard</h1>
          <p className={`${b}__subtitle`}>Cargando metricas...</p>
        </div>
        <div className={`${b}__kpis`}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`${b}__kpi ${b}__kpi--skeleton`}>
              <div className={`${b}__skeleton-line`} />
              <div className={`${b}__skeleton-line ${b}__skeleton-line--short`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const s = stats || {};
  const wa = waHealth || {};
  const tenantList = s.tenants || [];

  // Cost estimate
  const costDisplay = s.cost_estimate_usd != null ? `$${s.cost_estimate_usd.toFixed(2)}` : '$0.00';

  return (
    <div className={b}>
      {/* Header */}
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Dashboard</h1>
          <p className={`${b}__subtitle`}>Plexify Studio — Panel de control en tiempo real</p>
        </div>
        <div className={`${b}__header-actions`}>
          <div className={`${b}__header-right`}>
            <span className={`${b}__live-dot`} />
            <span className={`${b}__live-label`}>En vivo</span>
          </div>
        </div>
      </div>

      {/* KPIs Row 1 — Business */}
      <div className={`${b}__kpi-section`}>
        <h3 className={`${b}__kpi-section-title`}>Negocio</h3>
        <div className={`${b}__kpis`}>
          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--primary`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{s.total_tenants || 0}</span>
              <span className={`${b}__kpi-label`}>Agencias</span>
              <span className={`${b}__kpi-sub`}>{s.active_tenants || 0} activas</span>
            </div>
          </div>

          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--accent`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{formatCOP(s.mrr)}</span>
              <span className={`${b}__kpi-label`}>MRR</span>
              <span className={`${b}__kpi-sub`}>Ingreso mensual</span>
            </div>
          </div>

          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--warning`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{costDisplay}</span>
              <span className={`${b}__kpi-label`}>Costo IA</span>
              <span className={`${b}__kpi-sub`}>USD este mes</span>
            </div>
          </div>

          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--info`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{formatNum(s.total_clients)}</span>
              <span className={`${b}__kpi-label`}>Clientes</span>
              <span className={`${b}__kpi-sub`}>Total registrados</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Row 2 — Operations */}
      <div className={`${b}__kpi-section`}>
        <h3 className={`${b}__kpi-section-title`}>Operaciones hoy</h3>
        <div className={`${b}__kpis`}>
          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--success`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{formatNum(s.total_messages_sent)}</span>
              <span className={`${b}__kpi-label`}>Mensajes IA</span>
              <span className={`${b}__kpi-sub`}>{wa.messages_today || 0} hoy</span>
            </div>
          </div>

          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--purple`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{formatTokens(s.total_ai_tokens)}</span>
              <span className={`${b}__kpi-label`}>Tokens IA</span>
              <span className={`${b}__kpi-sub`}>Consumo este mes</span>
            </div>
          </div>

          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--teal`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{formatNum(s.total_appointments)}</span>
              <span className={`${b}__kpi-label`}>Citas</span>
              <span className={`${b}__kpi-sub`}>Total agendadas</span>
            </div>
          </div>

          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--green`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{wa.lina_responses_today || 0}</span>
              <span className={`${b}__kpi-label`}>Lina hoy</span>
              <span className={`${b}__kpi-sub`}>Respuestas IA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className={`${b}__grid-2col`}>
        {/* WhatsApp Health Strip */}
        <div className={`${b}__section`}>
          <div className={`${b}__section-header`}>
            <h2 className={`${b}__section-title`}>WhatsApp</h2>
            <span className={`${b}__section-badge ${wa.has_wa_token ? `${b}__section-badge--ok` : `${b}__section-badge--error`}`}>
              {wa.has_wa_token ? 'Conectado' : 'Sin token'}
            </span>
          </div>
          <div className={`${b}__wa-stats`}>
            <div className={`${b}__wa-stat`}>
              <span className={`${b}__wa-stat-value`}>{wa.total_conversations || 0}</span>
              <span className={`${b}__wa-stat-label`}>Conversaciones</span>
            </div>
            <div className={`${b}__wa-stat`}>
              <span className={`${b}__wa-stat-value`}>{wa.active_conversations_7d || 0}</span>
              <span className={`${b}__wa-stat-label`}>Activas (7d)</span>
            </div>
            <div className={`${b}__wa-stat`}>
              <span className={`${b}__wa-stat-value`}>{wa.ai_active_conversations || 0}</span>
              <span className={`${b}__wa-stat-label`}>IA activa</span>
            </div>
            <div className={`${b}__wa-stat`}>
              <span className={`${b}__wa-stat-value ${(wa.total_unread || 0) > 0 ? `${b}__wa-stat-value--alert` : ''}`}>{wa.total_unread || 0}</span>
              <span className={`${b}__wa-stat-label`}>Sin leer</span>
            </div>
            <div className={`${b}__wa-stat`}>
              <span className={`${b}__wa-stat-value ${(wa.failed_messages || 0) > 0 ? `${b}__wa-stat-value--alert` : ''}`}>{wa.failed_messages || 0}</span>
              <span className={`${b}__wa-stat-label`}>Fallidos</span>
            </div>
          </div>
          {/* Daily messages mini chart */}
          {wa.daily_messages && wa.daily_messages.length > 0 && (
            <div className={`${b}__mini-chart`}>
              <h4 className={`${b}__mini-chart-title`}>Mensajes ultimos 7 dias</h4>
              <div className={`${b}__mini-bars`}>
                {wa.daily_messages.slice().reverse().map((d) => {
                  const max = Math.max(...wa.daily_messages.map(x => x.count), 1);
                  const pct = Math.max((d.count / max) * 100, 2);
                  return (
                    <div key={d.date} className={`${b}__mini-bar-col`}>
                      <div className={`${b}__mini-bar`} style={{ height: `${pct}%` }} title={`${d.date}: ${d.count}`} />
                      <span className={`${b}__mini-bar-label`}>{d.date.split('-')[2]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className={`${b}__section`}>
          <div className={`${b}__section-header`}>
            <h2 className={`${b}__section-title`}>Actividad reciente</h2>
            {onNavigate && (
              <button className={`${b}__section-link`} onClick={() => onNavigate('dev-activity')}>
                Ver todo
              </button>
            )}
          </div>
          <div className={`${b}__activity-list`}>
            {activity && activity.events && activity.events.length > 0 ? (
              activity.events.slice(0, 8).map((evt, i) => (
                <div key={i} className={`${b}__activity-item`}>
                  <span className={`${b}__activity-dot ${b}__activity-dot--${evt.status || evt.type || 'info'}`} />
                  <div className={`${b}__activity-content`}>
                    <span className={`${b}__activity-text`}>{evt.description || evt.message || 'Evento'}</span>
                    <span className={`${b}__activity-time`}>{evt.display_time || evt.time || ''}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className={`${b}__activity-empty`}>
                Sin actividad reciente. Lina comenzara a generar eventos cuando reciba mensajes.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tenants overview table */}
      <div className={`${b}__section`}>
        <div className={`${b}__section-header`}>
          <h2 className={`${b}__section-title`}>Agencias</h2>
          <span className={`${b}__section-badge`}>{tenantList.length}</span>
        </div>

        {tenantList.length === 0 ? (
          <div className={`${b}__empty`}>
            <div className={`${b}__empty-icon`}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /></svg>
            </div>
            <h3 className={`${b}__empty-title`}>Sin agencias registradas</h3>
            <p className={`${b}__empty-text`}>Ve a Agencias para crear la primera.</p>
          </div>
        ) : (
          <div className={`${b}__table-wrap`}>
            <table className={`${b}__table`}>
              <thead>
                <tr>
                  <th>Agencia</th>
                  <th>Mensajes</th>
                  <th>Uso</th>
                  <th>Clientes</th>
                  <th>Equipo</th>
                  <th>IA</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {tenantList.map((t) => {
                  const pct = t.messages_limit > 0 ? Math.round((t.messages_used / t.messages_limit) * 100) : 0;
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className={`${b}__tenant-name`}>
                          <span className={`${b}__tenant-slug`}>{t.slug}</span>
                          <span className={`${b}__tenant-full`}>{t.name}</span>
                        </div>
                      </td>
                      <td className={`${b}__td-mono`}>
                        {(t.messages_used || 0).toLocaleString('es-CO')} / {(t.messages_limit || 0).toLocaleString('es-CO')}
                      </td>
                      <td>
                        <div className={`${b}__usage-bar`}>
                          <div className={`${b}__usage-fill ${pct > 80 ? `${b}__usage-fill--warning` : ''} ${pct > 95 ? `${b}__usage-fill--critical` : ''}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`${b}__usage-pct`}>{pct}%</span>
                      </td>
                      <td className={`${b}__td-mono`}>{t.total_clients || 0}</td>
                      <td className={`${b}__td-mono`}>{t.total_staff || 0}</td>
                      <td>
                        <span className={`${b}__ai-status ${t.ai_is_paused ? `${b}__ai-status--paused` : `${b}__ai-status--active`}`}>
                          {t.ai_is_paused ? 'Pausada' : 'Activa'}
                        </span>
                      </td>
                      <td>
                        <span className={`${b}__status-dot ${t.is_active ? `${b}__status-dot--active` : `${b}__status-dot--inactive`}`} />
                        {t.is_active ? 'Activa' : 'Suspendida'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevDashboard;
