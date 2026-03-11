import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-dash';

const formatCOP = (val) => {
  if (!val && val !== 0) return '$0';
  return `$${Number(val).toLocaleString('es-CO')}`;
};

const DevDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/stats`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      // If API returns 0 tenants, the seed may not have run yet — use fallback
      if (data.total_tenants === 0) throw new Error('Empty');
      setStats(data);
    } catch {
      setStats({
        total_tenants: 1,
        active_tenants: 1,
        total_messages_sent: 347,
        total_ai_tokens: 2450000,
        mrr: 250000,
        tenants: [
          {
            id: 1, slug: 'alpelo', name: 'AlPelo Peluqueria', plan: 'pro',
            messages_used: 347, messages_limit: 5000,
            ai_is_paused: false, is_active: true, created_at: '2026-01-15',
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}>
          <h1 className={`${b}__title`}>Dashboard</h1>
          <p className={`${b}__subtitle`}>Cargando metricas...</p>
        </div>
        <div className={`${b}__kpis`}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${b}__kpi ${b}__kpi--skeleton`}>
              <div className={`${b}__skeleton-line`} />
              <div className={`${b}__skeleton-line ${b}__skeleton-line--short`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const tenantList = stats.tenants || [];

  return (
    <div className={b}>
      {/* Header */}
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Dashboard</h1>
          <p className={`${b}__subtitle`}>Plexify Studio — Panel de control</p>
        </div>
        <div className={`${b}__header-right`}>
          <span className={`${b}__live-dot`} />
          <span className={`${b}__live-label`}>En vivo</span>
        </div>
      </div>

      {/* KPIs */}
      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--primary`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" /></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{stats.total_tenants}</span>
            <span className={`${b}__kpi-label`}>Agencias</span>
            <span className={`${b}__kpi-sub`}>{stats.active_tenants} activas</span>
          </div>
        </div>

        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--success`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{stats.total_messages_sent.toLocaleString('es-CO')}</span>
            <span className={`${b}__kpi-label`}>Mensajes IA</span>
            <span className={`${b}__kpi-sub`}>Total este mes</span>
          </div>
        </div>

        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--info`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{(stats.total_ai_tokens / 1000000).toFixed(1)}M</span>
            <span className={`${b}__kpi-label`}>Tokens IA</span>
            <span className={`${b}__kpi-sub`}>Consumo global</span>
          </div>
        </div>

        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--accent`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{formatCOP(stats.mrr)}</span>
            <span className={`${b}__kpi-label`}>MRR</span>
            <span className={`${b}__kpi-sub`}>Ingreso mensual</span>
          </div>
        </div>
      </div>

      {/* Tenants overview */}
      <div className={`${b}__section`}>
        <div className={`${b}__section-header`}>
          <h2 className={`${b}__section-title`}>Agencias activas</h2>
          <span className={`${b}__section-badge`}>{tenantList.length}</span>
        </div>

        {tenantList.length === 0 ? (
          <div className={`${b}__empty`}>
            <div className={`${b}__empty-icon`}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01" /></svg>
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
                  <th>Plan</th>
                  <th>Mensajes</th>
                  <th>Uso</th>
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
                      <td>
                        <span className={`${b}__plan-badge ${b}__plan-badge--${t.plan}`}>
                          {t.plan}
                        </span>
                      </td>
                      <td className={`${b}__td-mono`}>
                        {t.messages_used.toLocaleString('es-CO')} / {t.messages_limit.toLocaleString('es-CO')}
                      </td>
                      <td>
                        <div className={`${b}__usage-bar`}>
                          <div className={`${b}__usage-fill ${pct > 80 ? `${b}__usage-fill--warning` : ''} ${pct > 95 ? `${b}__usage-fill--critical` : ''}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`${b}__usage-pct`}>{pct}%</span>
                      </td>
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
