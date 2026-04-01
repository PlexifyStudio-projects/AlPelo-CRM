import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-perf';

const formatTokens = (n) => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
};

const DevPerformance = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/performance`, {
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
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Rendimiento</h1></div>
        <p className={`${b}__loading`}>Cargando metricas...</p>
      </div>
    );
  }

  const d = data || {};
  const totalAppts = d.total_appointments || 0;
  const completedRate = totalAppts > 0 ? Math.round((d.completed_appointments / totalAppts) * 100) : 0;
  const cancelRate = totalAppts > 0 ? Math.round((d.cancelled_appointments / totalAppts) * 100) : 0;
  const noshowRate = totalAppts > 0 ? Math.round((d.noshow_appointments / totalAppts) * 100) : 0;

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Rendimiento</h1>
          <p className={`${b}__subtitle`}>Metricas de IA, citas y operaciones</p>
        </div>
      </div>

      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{(d.total_lina_messages || 0).toLocaleString('es-CO')}</span>
          <span className={`${b}__kpi-label`}>Respuestas Lina (total)</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{d.lina_messages_today || 0}</span>
          <span className={`${b}__kpi-label`}>Lina hoy</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{(d.admin_manual_messages || 0).toLocaleString('es-CO')}</span>
          <span className={`${b}__kpi-label`}>Msgs manuales admin</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{formatTokens(d.avg_tokens_per_message)}</span>
          <span className={`${b}__kpi-label`}>Tokens prom/mensaje</span>
        </div>
      </div>

      <div className={`${b}__grid`}>
        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Citas</h3>
          <div className={`${b}__card-body`}>
            <div className={`${b}__metric-row`}>
              <span>Total citas</span>
              <span className={`${b}__metric-value`}>{totalAppts.toLocaleString('es-CO')}</span>
            </div>
            <div className={`${b}__metric-row`}>
              <span>Completadas</span>
              <span className={`${b}__metric-value ${b}__metric-value--success`}>{d.completed_appointments || 0} ({completedRate}%)</span>
            </div>
            <div className={`${b}__metric-row`}>
              <span>Canceladas</span>
              <span className={`${b}__metric-value ${b}__metric-value--warning`}>{d.cancelled_appointments || 0} ({cancelRate}%)</span>
            </div>
            <div className={`${b}__metric-row`}>
              <span>No-show</span>
              <span className={`${b}__metric-value ${b}__metric-value--error`}>{d.noshow_appointments || 0} ({noshowRate}%)</span>
            </div>
            <div className={`${b}__metric-row`}>
              <span>Creadas por Lina</span>
              <span className={`${b}__metric-value ${b}__metric-value--accent`}>{d.lina_created_appointments || 0}</span>
            </div>
          </div>
        </div>

        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Plataforma</h3>
          <div className={`${b}__card-body`}>
            <div className={`${b}__metric-row`}>
              <span>Servicios activos</span>
              <span className={`${b}__metric-value`}>{d.total_services || 0}</span>
            </div>
            <div className={`${b}__metric-row`}>
              <span>Staff activo</span>
              <span className={`${b}__metric-value`}>{d.total_active_staff || 0}</span>
            </div>
            <div className={`${b}__metric-row`}>
              <span>Convos con IA pausada</span>
              <span className={`${b}__metric-value`}>{d.ai_paused_conversations || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevPerformance;
