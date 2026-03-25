import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-health';

const StatusBadge = ({ status }) => {
  const map = {
    healthy: { label: 'Saludable', cls: 'ok' },
    slow: { label: 'Lento', cls: 'warn' },
    operational: { label: 'Operativo', cls: 'ok' },
    no_key: { label: 'Sin clave', cls: 'crit' },
    unknown: { label: 'Desconocido', cls: 'warn' },
  };
  const s = map[status] || map.unknown;
  return <span className={`${b}__badge ${b}__badge--${s.cls}`}>{s.label}</span>;
};

const DevHealth = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/health`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Estado del Sistema</h1></div>
        <p className={`${b}__loading`}>Verificando salud del sistema...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Estado del Sistema</h1></div>
        <p className={`${b}__loading`}>Error al conectar con el servidor</p>
      </div>
    );
  }

  const { db: dbInfo, whatsapp, ai, errors, system } = data;
  const overallStatus = (dbInfo?.status === 'healthy' && ai?.status === 'operational' && whatsapp?.disconnected === 0)
    ? 'ok' : (errors?.last_hour >= 5 ? 'crit' : 'warn');

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Estado del Sistema</h1>
          <p className={`${b}__subtitle`}>Monitoreo en tiempo real — actualiza cada 15s</p>
        </div>
        <div className={`${b}__header-right`}>
          <span className={`${b}__overall ${b}__overall--${overallStatus}`}>
            {overallStatus === 'ok' ? 'Todo OK' : overallStatus === 'warn' ? 'Atencion' : 'Critico'}
          </span>
          <button className={`${b}__refresh`} onClick={fetchData}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16"/></svg>
          </button>
        </div>
      </div>

      {/* Health Cards Grid */}
      <div className={`${b}__grid`}>
        {/* Database */}
        <div className={`${b}__card ${b}__card--${dbInfo?.status === 'healthy' ? 'ok' : 'warn'}`}>
          <div className={`${b}__card-header`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            <h3>Base de Datos</h3>
            <StatusBadge status={dbInfo?.status} />
          </div>
          <div className={`${b}__card-body`}>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>Latencia</span>
              <span className={`${b}__stat-value ${dbInfo?.latency_ms > 100 ? `${b}__stat-value--warn` : ''}`}>
                {dbInfo?.latency_ms}ms
              </span>
            </div>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>Pool</span>
              <span className={`${b}__stat-value`}>
                {dbInfo?.pool?.checked_out || 0} / {dbInfo?.pool?.size || '?'} usados
              </span>
            </div>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>Overflow</span>
              <span className={`${b}__stat-value`}>{dbInfo?.pool?.overflow || 0}</span>
            </div>
          </div>
        </div>

        {/* WhatsApp */}
        <div className={`${b}__card ${whatsapp?.disconnected > 0 ? `${b}__card--warn` : `${b}__card--ok`}`}>
          <div className={`${b}__card-header`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
            <h3>WhatsApp</h3>
            <span className={`${b}__badge ${whatsapp?.disconnected > 0 ? `${b}__badge--warn` : `${b}__badge--ok`}`}>
              {whatsapp?.connected || 0} conectados
            </span>
          </div>
          <div className={`${b}__card-body`}>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>Conectados</span>
              <span className={`${b}__stat-value`}>{whatsapp?.connected || 0}</span>
            </div>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>Desconectados</span>
              <span className={`${b}__stat-value ${whatsapp?.disconnected > 0 ? `${b}__stat-value--warn` : ''}`}>
                {whatsapp?.disconnected || 0}
              </span>
            </div>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>Expiran pronto</span>
              <span className={`${b}__stat-value ${whatsapp?.expiring_soon > 0 ? `${b}__stat-value--warn` : ''}`}>
                {whatsapp?.expiring_soon || 0}
              </span>
            </div>
          </div>
          {whatsapp?.tenants?.length > 0 && (
            <div className={`${b}__card-detail`}>
              {whatsapp.tenants.map((t, i) => (
                <div key={i} className={`${b}__tenant-row`}>
                  <span className={`${b}__dot ${b}__dot--${t.status}`} />
                  <span>{t.tenant}</span>
                  <span className={`${b}__tenant-status`}>{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI */}
        <div className={`${b}__card ${ai?.status === 'operational' ? `${b}__card--ok` : `${b}__card--crit`}`}>
          <div className={`${b}__card-header`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a4 4 0 014 4v1a2 2 0 012 2v1a2 2 0 01-2 2h0a2 2 0 01-2 2v3a2 2 0 01-4 0v-3a2 2 0 01-2-2h0a2 2 0 01-2-2V9a2 2 0 012-2V6a4 4 0 014-4z"/></svg>
            <h3>Inteligencia Artificial</h3>
            <StatusBadge status={ai?.status} />
          </div>
          <div className={`${b}__card-body`}>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>Modelo</span>
              <span className={`${b}__stat-value`}>{ai?.model || 'N/A'}</span>
            </div>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>API Key</span>
              <span className={`${b}__stat-value`}>{ai?.status === 'operational' ? 'Configurada' : 'Faltante'}</span>
            </div>
          </div>
        </div>

        {/* Errors */}
        <div className={`${b}__card ${errors?.last_hour >= 5 ? `${b}__card--crit` : errors?.last_hour > 0 ? `${b}__card--warn` : `${b}__card--ok`}`}>
          <div className={`${b}__card-header`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h3>Errores</h3>
            <span className={`${b}__badge ${errors?.last_hour >= 5 ? `${b}__badge--crit` : errors?.last_hour > 0 ? `${b}__badge--warn` : `${b}__badge--ok`}`}>
              {errors?.last_hour || 0}/h
            </span>
          </div>
          <div className={`${b}__card-body`}>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>Ultima hora</span>
              <span className={`${b}__stat-value`}>{errors?.last_hour || 0}</span>
            </div>
            <div className={`${b}__stat`}>
              <span className={`${b}__stat-label`}>Ultimas 24h</span>
              <span className={`${b}__stat-value`}>{errors?.last_24h || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className={`${b}__system`}>
        <h3 className={`${b}__section-title`}>Informacion del Sistema</h3>
        <div className={`${b}__sys-grid`}>
          <div className={`${b}__sys-item`}>
            <span className={`${b}__sys-label`}>Python</span>
            <span className={`${b}__sys-value`}>{system?.python || 'N/A'}</span>
          </div>
          <div className={`${b}__sys-item`}>
            <span className={`${b}__sys-label`}>Plataforma</span>
            <span className={`${b}__sys-value`}>{system?.platform || 'N/A'}</span>
          </div>
          <div className={`${b}__sys-item`}>
            <span className={`${b}__sys-label`}>Memoria</span>
            <span className={`${b}__sys-value`}>
              {system?.memory?.used_pct !== 'unknown' ? `${system.memory.used_pct}%` : 'N/A'}
              {system?.memory?.total_mb !== 'unknown' ? ` de ${system.memory.total_mb}MB` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevHealth;
