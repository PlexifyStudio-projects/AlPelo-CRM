import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-system';

const DevSystem = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/system`, {
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
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Sistema</h1></div>
        <p className={`${b}__loading`}>Cargando info del sistema...</p>
      </div>
    );
  }

  const d = data || {};
  const envVars = d.environment_vars || {};

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Sistema</h1>
          <p className={`${b}__subtitle`}>Estado del servidor, base de datos y variables de entorno</p>
        </div>
        <button className={`${b}__refresh`} onClick={fetchData}>Actualizar</button>
      </div>

      {/* Health Status */}
      <div className={`${b}__health`}>
        <div className={`${b}__health-item`}>
          <span className={`${b}__health-dot ${d.database_connected ? `${b}__health-dot--ok` : `${b}__health-dot--error`}`} />
          <span className={`${b}__health-label`}>Base de datos</span>
          <span className={`${b}__health-value`}>{d.database_connected ? 'Conectada' : 'Desconectada'}</span>
        </div>
        <div className={`${b}__health-item`}>
          <span className={`${b}__health-dot ${envVars.ANTHROPIC_API_KEY !== 'NOT SET' ? `${b}__health-dot--ok` : `${b}__health-dot--error`}`} />
          <span className={`${b}__health-label`}>API Anthropic</span>
          <span className={`${b}__health-value`}>{envVars.ANTHROPIC_API_KEY !== 'NOT SET' ? 'Configurada' : 'No configurada'}</span>
        </div>
        <div className={`${b}__health-item`}>
          <span className={`${b}__health-dot ${envVars.WHATSAPP_ACCESS_TOKEN !== 'NOT SET' ? `${b}__health-dot--ok` : `${b}__health-dot--error`}`} />
          <span className={`${b}__health-label`}>WhatsApp Token</span>
          <span className={`${b}__health-value`}>{envVars.WHATSAPP_ACCESS_TOKEN !== 'NOT SET' ? 'Activo' : 'No configurado'}</span>
        </div>
      </div>

      {/* Server Info */}
      <div className={`${b}__grid`}>
        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Servidor</h3>
          <div className={`${b}__info-list`}>
            <div className={`${b}__info-row`}>
              <span className={`${b}__info-label`}>Python</span>
              <span className={`${b}__info-value`}>{d.python_version || '—'}</span>
            </div>
            <div className={`${b}__info-row`}>
              <span className={`${b}__info-label`}>Plataforma</span>
              <span className={`${b}__info-value`}>{d.platform || '—'}</span>
            </div>
            <div className={`${b}__info-row`}>
              <span className={`${b}__info-label`}>Entorno</span>
              <span className={`${b}__info-value`}>{envVars.ENVIRONMENT || '—'}</span>
            </div>
          </div>
        </div>

        <div className={`${b}__card`}>
          <h3 className={`${b}__card-title`}>Base de datos</h3>
          <div className={`${b}__info-list`}>
            <div className={`${b}__info-row`}>
              <span className={`${b}__info-label`}>Admins</span>
              <span className={`${b}__info-value`}>{d.admin_users || 0}</span>
            </div>
            <div className={`${b}__info-row`}>
              <span className={`${b}__info-label`}>Tenants</span>
              <span className={`${b}__info-value`}>{d.tenants || 0}</span>
            </div>
            <div className={`${b}__info-row`}>
              <span className={`${b}__info-label`}>Clientes</span>
              <span className={`${b}__info-value`}>{d.total_clients || 0}</span>
            </div>
            <div className={`${b}__info-row`}>
              <span className={`${b}__info-label`}>Mensajes WA</span>
              <span className={`${b}__info-value`}>{(d.total_messages || 0).toLocaleString('es-CO')}</span>
            </div>
            <div className={`${b}__info-row`}>
              <span className={`${b}__info-label`}>Conversaciones</span>
              <span className={`${b}__info-value`}>{d.total_conversations || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Environment Variables */}
      <div className={`${b}__section`}>
        <h3 className={`${b}__section-title`}>Variables de entorno</h3>
        <div className={`${b}__env-list`}>
          {Object.entries(envVars).map(([key, val]) => (
            <div key={key} className={`${b}__env-row`}>
              <span className={`${b}__env-key`}>{key}</span>
              <span className={`${b}__env-value ${val === 'NOT SET' ? `${b}__env-value--missing` : ''}`}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DevSystem;
