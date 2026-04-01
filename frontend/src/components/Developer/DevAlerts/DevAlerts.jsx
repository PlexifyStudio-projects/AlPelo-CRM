import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-alerts';

const SEVERITY_CONFIG = {
  critical: { label: 'Critico', icon: 'X', color: '#EF4444' },
  warning: { label: 'Advertencia', icon: '!', color: '#F59E0B' },
  info: { label: 'Info', icon: 'i', color: '#3B82F6' },
};

const TYPE_ICONS = {
  message_limit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
  ),
  overdue_payment: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
  ),
  wa_disconnected: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/><line x1="4" y1="4" x2="20" y2="20" stroke="#EF4444" strokeWidth="2"/></svg>
  ),
  wa_expiring: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  ai_paused: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
  ),
  token_spike: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="13 2 3 14h9l-1 8 10-12h-9l1-8"/></svg>
  ),
  error_spike: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
};

const DevAlerts = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/alerts`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setData({ alerts: [], total: 0, critical: 0, warning: 0 });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Alertas</h1></div>
        <p className={`${b}__loading`}>Analizando estado de la plataforma...</p>
      </div>
    );
  }

  const alerts = data?.alerts || [];
  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>
            Alertas
            {data?.critical > 0 && (
              <span className={`${b}__count-badge ${b}__count-badge--crit`}>{data.critical}</span>
            )}
          </h1>
          <p className={`${b}__subtitle`}>{data?.total || 0} alertas activas</p>
        </div>
        <button className={`${b}__refresh`} onClick={fetchData}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16"/></svg>
        </button>
      </div>

      <div className={`${b}__filters`}>
        {[
          { key: 'all', label: `Todas (${alerts.length})` },
          { key: 'critical', label: `Criticas (${data?.critical || 0})` },
          { key: 'warning', label: `Advertencias (${data?.warning || 0})` },
          { key: 'info', label: `Info (${alerts.filter((a) => a.severity === 'info').length})` },
        ].map((f) => (
          <button
            key={f.key}
            className={`${b}__filter ${filter === f.key ? `${b}__filter--active` : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={`${b}__empty`}>
          <div className={`${b}__empty-icon`}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h3 className={`${b}__empty-title`}>Sin alertas</h3>
          <p className={`${b}__empty-text`}>Todos los sistemas funcionan correctamente</p>
        </div>
      ) : (
        <div className={`${b}__list`}>
          {filtered.map((alert, i) => {
            const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
            return (
              <div key={i} className={`${b}__card ${b}__card--${alert.severity}`}>
                <div className={`${b}__card-icon`} style={{ color: sev.color }}>
                  {TYPE_ICONS[alert.type] || TYPE_ICONS.error_spike}
                </div>
                <div className={`${b}__card-body`}>
                  <div className={`${b}__card-top`}>
                    <span className={`${b}__card-severity`} style={{ color: sev.color }}>{sev.label}</span>
                    <span className={`${b}__card-tenant`}>{alert.tenant}</span>
                  </div>
                  <p className={`${b}__card-message`}>{alert.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DevAlerts;
