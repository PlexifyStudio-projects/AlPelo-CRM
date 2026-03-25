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

// Claude Sonnet pricing: $3/MTok input, $15/MTok output — blended ~$5.4/MTok
// TRM approximate: 1 USD = 4,200 COP
const USD_PER_MTOK = 5.4;
const TRM = 4200;

const DevDashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [waHealth, setWaHealth] = useState(null);
  const [alerts, setAlerts] = useState(null);
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
      const [s, wa, al] = await Promise.allSettled([
        apiFetch('/dev/stats'),
        apiFetch('/dev/whatsapp-health'),
        apiFetch('/dev/alerts'),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (wa.status === 'fulfilled') setWaHealth(wa.value);
      if (al.status === 'fulfilled') setAlerts(al.value);
    } catch { /* partial data ok */ }
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
  const al = alerts || {};

  // Cost calculation — exact: tokens * rate, then to COP
  const tokens = s.total_ai_tokens || 0;
  const costUSD = (tokens / 1_000_000) * USD_PER_MTOK;
  const costCOP = Math.round(costUSD * TRM);

  // Lina total messages this month (not just today)
  const linaTotalMonth = s.lina_messages_today || 0; // we'll enhance this with total
  const totalMessages = s.total_messages_sent || 0;

  return (
    <div className={b}>
      {/* Header */}
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Panel Ejecutivo</h1>
          <p className={`${b}__subtitle`}>Resumen de toda la plataforma — Marzo 2026</p>
        </div>
        <div className={`${b}__header-actions`}>
          <div className={`${b}__header-right`}>
            <span className={`${b}__live-dot`} />
            <span className={`${b}__live-label`}>En vivo</span>
          </div>
        </div>
      </div>

      {/* Alerts banner (if any critical) */}
      {al.critical > 0 && (
        <div className={`${b}__alert-banner`} onClick={() => onNavigate && onNavigate('dev-alerts')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>{al.critical} alerta{al.critical > 1 ? 's' : ''} critica{al.critical > 1 ? 's' : ''} — Click para ver detalles</span>
        </div>
      )}

      {/* Main KPIs — 4 columns */}
      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--primary`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" /></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{s.active_tenants || 0}</span>
            <span className={`${b}__kpi-label`}>Agencias Activas</span>
            <span className={`${b}__kpi-sub`}>{s.total_tenants || 0} total</span>
          </div>
        </div>

        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--accent`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{formatCOP(s.mrr)}</span>
            <span className={`${b}__kpi-label`}>MRR</span>
            <span className={`${b}__kpi-sub`}>Ingreso recurrente mensual</span>
          </div>
        </div>

        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--warning`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{formatCOP(costCOP)}</span>
            <span className={`${b}__kpi-label`}>Costo IA este mes</span>
            <span className={`${b}__kpi-sub`}>USD ${costUSD.toFixed(2)} — {formatTokens(tokens)} tokens</span>
          </div>
        </div>

        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--info`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{formatNum(s.total_clients)}</span>
            <span className={`${b}__kpi-label`}>Clientes</span>
            <span className={`${b}__kpi-sub`}>En toda la plataforma</span>
          </div>
        </div>
      </div>

      {/* Operations KPIs — 4 columns */}
      <div className={`${b}__kpi-section`}>
        <h3 className={`${b}__kpi-section-title`}>Operaciones del mes</h3>
        <div className={`${b}__kpis`}>
          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--success`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{formatNum(totalMessages)}</span>
              <span className={`${b}__kpi-label`}>Mensajes Totales</span>
              <span className={`${b}__kpi-sub`}>WhatsApp enviados + recibidos</span>
            </div>
          </div>

          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--purple`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{formatNum(s.lina_messages_today)}</span>
              <span className={`${b}__kpi-label`}>Respuestas Lina IA</span>
              <span className={`${b}__kpi-sub`}>{s.messages_today || 0} mensajes hoy</span>
            </div>
          </div>

          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--teal`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{formatNum(s.total_appointments)}</span>
              <span className={`${b}__kpi-label`}>Citas</span>
              <span className={`${b}__kpi-sub`}>Total en plataforma</span>
            </div>
          </div>

          <div className={`${b}__kpi`}>
            <div className={`${b}__kpi-icon ${b}__kpi-icon--green`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
            </div>
            <div className={`${b}__kpi-info`}>
              <span className={`${b}__kpi-value`}>{formatNum(s.total_staff)}</span>
              <span className={`${b}__kpi-label`}>Staff</span>
              <span className={`${b}__kpi-sub`}>Profesionales registrados</span>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp section — full width, clean */}
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

      {/* Quick nav cards */}
      <div className={`${b}__quick-nav`}>
        {[
          { id: 'dev-comparison', label: 'Comparativa', desc: 'Cross-tenant analytics', icon: '📊' },
          { id: 'dev-mrr', label: 'MRR', desc: 'Ingresos y proyeccion', icon: '💰' },
          { id: 'dev-health', label: 'Estado', desc: 'Salud del sistema', icon: '🏥' },
          { id: 'dev-prospector', label: 'Tendencias', desc: 'Prospector IA', icon: '🔍' },
        ].map((nav) => (
          <button
            key={nav.id}
            className={`${b}__nav-card`}
            onClick={() => onNavigate && onNavigate(nav.id)}
          >
            <span className={`${b}__nav-card-icon`}>{nav.icon}</span>
            <span className={`${b}__nav-card-label`}>{nav.label}</span>
            <span className={`${b}__nav-card-desc`}>{nav.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DevDashboard;
