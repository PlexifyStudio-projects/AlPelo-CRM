import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-activity';

const TYPE_ICONS = {
  respuesta: { color: '#22C55E', label: 'Respuesta' },
  accion: { color: '#4F6EF7', label: 'Accion' },
  tarea: { color: '#F59E0B', label: 'Tarea' },
  error: { color: '#EF4444', label: 'Error' },
  sistema: { color: '#8B5CF6', label: 'Sistema' },
  skip: { color: '#9CA3AF', label: 'Omitido' },
};

const DevActivity = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/activity`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setData({ events: [], daily_stats: {} });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 10000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Actividad IA</h1></div>
        <p className={`${b}__loading`}>Cargando eventos...</p>
      </div>
    );
  }

  const daily = data?.daily_stats || {};
  const events = (data?.events || []).filter(e => filter === 'all' || e.type === filter);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Actividad IA</h1>
          <p className={`${b}__subtitle`}>Monitor en tiempo real de Lina</p>
        </div>
        <button className={`${b}__refresh`} onClick={fetchActivity}>Actualizar</button>
      </div>

      <div className={`${b}__stats`}>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{daily.messages_sent || 0}</span>
          <span className={`${b}__stat-label`}>Enviados</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{daily.messages_failed || 0}</span>
          <span className={`${b}__stat-label`}>Fallidos</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{daily.actions_executed || 0}</span>
          <span className={`${b}__stat-label`}>Acciones</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{daily.conversations_replied || 0}</span>
          <span className={`${b}__stat-label`}>Conversaciones</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{daily.tasks_completed || 0}</span>
          <span className={`${b}__stat-label`}>Tareas</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{daily.skips || 0}</span>
          <span className={`${b}__stat-label`}>Omitidos</span>
        </div>
      </div>

      <div className={`${b}__filters`}>
        {['all', ...Object.keys(TYPE_ICONS)].map(f => (
          <button key={f} className={`${b}__filter ${filter === f ? `${b}__filter--active` : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todos' : TYPE_ICONS[f]?.label || f}
          </button>
        ))}
      </div>

      <div className={`${b}__list`}>
        {events.length === 0 ? (
          <div className={`${b}__empty`}>Sin eventos registrados. Los eventos se generan cuando Lina responde mensajes.</div>
        ) : (
          events.map((evt, i) => {
            const typeInfo = TYPE_ICONS[evt.type] || TYPE_ICONS.sistema;
            return (
              <div key={i} className={`${b}__event`}>
                <div className={`${b}__event-dot`} style={{ background: typeInfo.color }} />
                <div className={`${b}__event-body`}>
                  <div className={`${b}__event-top`}>
                    <span className={`${b}__event-type`} style={{ color: typeInfo.color }}>{typeInfo.label}</span>
                    <span className={`${b}__event-time`}>{evt.display_time || ''}</span>
                  </div>
                  <p className={`${b}__event-desc`}>{evt.description || ''}</p>
                  {evt.details && <p className={`${b}__event-details`}>{evt.details}</p>}
                  {evt.contact_name && <span className={`${b}__event-contact`}>{evt.contact_name}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DevActivity;
