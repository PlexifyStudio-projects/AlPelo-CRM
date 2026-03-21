import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-whatsapp';

const DevWhatsApp = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const url = selectedTenant
        ? `${API_URL}/dev/whatsapp-health?tenant_id=${selectedTenant}`
        : `${API_URL}/dev/whatsapp-health`;
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setData({});
    }
    setLoading(false);
  }, [selectedTenant]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleTenantChange = (e) => {
    setSelectedTenant(e.target.value);
  };

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>WhatsApp</h1></div>
        <p className={`${b}__loading`}>Cargando estado de WhatsApp...</p>
      </div>
    );
  }

  const d = data || {};
  const tenants = d.tenants || [];
  const dailyMsgs = d.daily_messages || [];
  const maxDaily = Math.max(...dailyMsgs.map(x => x.count), 1);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>WhatsApp Business</h1>
          <p className={`${b}__subtitle`}>Estado de la conexion y metricas de mensajeria</p>
        </div>
        <div className={`${b}__header-actions`}>
          <select
            className={`${b}__tenant-select`}
            value={selectedTenant}
            onChange={handleTenantChange}
          >
            <option value="">Todas las agencias</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className={`${b}__status-pill ${d.has_wa_token ? `${b}__status-pill--ok` : `${b}__status-pill--error`}`}>
            <span className={`${b}__status-dot`} />
            {d.has_wa_token ? 'Token activo' : 'Sin token'}
          </div>
        </div>
      </div>

      {d.wa_phone_display && (
        <div className={`${b}__phone-display`}>
          Numero: <strong>{d.wa_phone_display}</strong>
          {d.selected_tenant && <span> — {d.selected_tenant.name}</span>}
        </div>
      )}

      {/* KPIs */}
      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{(d.total_conversations || 0).toLocaleString('es-CO')}</span>
          <span className={`${b}__kpi-label`}>Total conversaciones</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{(d.total_messages || 0).toLocaleString('es-CO')}</span>
          <span className={`${b}__kpi-label`}>Total mensajes</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{d.messages_today || 0}</span>
          <span className={`${b}__kpi-label`}>Mensajes hoy</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{d.lina_responses_today || 0}</span>
          <span className={`${b}__kpi-label`}>Lina hoy</span>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className={`${b}__grid`}>
        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Mensajes hoy</h3>
          <div className={`${b}__card-stats`}>
            <div className={`${b}__card-stat`}>
              <span className={`${b}__card-stat-label`}>Entrantes</span>
              <span className={`${b}__card-stat-value`}>{d.inbound_today || 0}</span>
            </div>
            <div className={`${b}__card-stat`}>
              <span className={`${b}__card-stat-label`}>Salientes</span>
              <span className={`${b}__card-stat-value`}>{d.outbound_today || 0}</span>
            </div>
            <div className={`${b}__card-stat`}>
              <span className={`${b}__card-stat-label`}>Respuestas Lina</span>
              <span className={`${b}__card-stat-value`}>{d.lina_responses_today || 0}</span>
            </div>
          </div>
        </div>

        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Conversaciones</h3>
          <div className={`${b}__card-stats`}>
            <div className={`${b}__card-stat`}>
              <span className={`${b}__card-stat-label`}>Activas (7d)</span>
              <span className={`${b}__card-stat-value`}>{d.active_conversations_7d || 0}</span>
            </div>
            <div className={`${b}__card-stat`}>
              <span className={`${b}__card-stat-label`}>IA activa</span>
              <span className={`${b}__card-stat-value`}>{d.ai_active_conversations || 0}</span>
            </div>
            <div className={`${b}__card-stat`}>
              <span className={`${b}__card-stat-label`}>Sin leer</span>
              <span className={`${b}__card-stat-value ${(d.total_unread || 0) > 0 ? `${b}__card-stat-value--alert` : ''}`}>{d.total_unread || 0}</span>
            </div>
          </div>
        </div>

        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Contenido</h3>
          <div className={`${b}__card-stats`}>
            <div className={`${b}__card-stat`}>
              <span className={`${b}__card-stat-label`}>Templates enviados</span>
              <span className={`${b}__card-stat-value`}>{d.template_messages || 0}</span>
            </div>
            <div className={`${b}__card-stat`}>
              <span className={`${b}__card-stat-label`}>Media (fotos/audio)</span>
              <span className={`${b}__card-stat-value`}>{d.media_messages || 0}</span>
            </div>
            <div className={`${b}__card-stat`}>
              <span className={`${b}__card-stat-label`}>Fallidos</span>
              <span className={`${b}__card-stat-value ${(d.failed_messages || 0) > 0 ? `${b}__card-stat-value--alert` : ''}`}>{d.failed_messages || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Chart */}
      {dailyMsgs.length > 0 && (
        <div className={`${b}__chart-section`}>
          <h3 className={`${b}__chart-title`}>Mensajes ultimos 7 dias</h3>
          <div className={`${b}__chart`}>
            {dailyMsgs.slice().reverse().map(dm => (
              <div key={dm.date} className={`${b}__chart-col`}>
                <span className={`${b}__chart-count`}>{dm.count}</span>
                <div className={`${b}__chart-bar`} style={{ height: `${Math.max((dm.count / maxDaily) * 100, 4)}%` }} />
                <span className={`${b}__chart-label`}>{dm.date.split('-').slice(1).join('/')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DevWhatsApp;
