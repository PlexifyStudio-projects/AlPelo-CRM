import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-system';

const META_CONFIG_KEYS = [
  { key: 'META_APP_ID', label: 'App ID', placeholder: 'Tu Facebook App ID', secret: false },
  { key: 'META_APP_SECRET', label: 'App Secret', placeholder: 'Tu Facebook App Secret', secret: true },
  { key: 'META_REDIRECT_URI', label: 'Redirect URI', placeholder: 'https://tu-dominio.com/oauth-callback.html', secret: false },
];

const DevSystem = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Meta config state
  const [metaConfig, setMetaConfig] = useState({});
  const [metaEditing, setMetaEditing] = useState(false);
  const [metaForm, setMetaForm] = useState({});
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaMsg, setMetaMsg] = useState('');

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

  const fetchMetaConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/platform-config`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const d = await res.json();
        setMetaConfig(d.config || {});
        setMetaForm(d.config || {});
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchData(); fetchMetaConfig(); }, [fetchData, fetchMetaConfig]);

  const handleMetaSave = async () => {
    setMetaSaving(true);
    setMetaMsg('');
    try {
      const res = await fetch(`${API_URL}/dev/platform-config`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: metaForm }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      const result = await res.json();
      setMetaMsg(`Guardado: ${(result.updated || []).join(', ')}`);
      setMetaEditing(false);
      fetchMetaConfig();
    } catch (err) {
      setMetaMsg(err.message);
    }
    setMetaSaving(false);
  };

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

  const allMetaConfigured = META_CONFIG_KEYS.every(({ key }) => !!metaConfig[key]);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Sistema</h1>
          <p className={`${b}__subtitle`}>Estado del servidor, base de datos y configuracion de plataforma</p>
        </div>
        <button className={`${b}__refresh`} onClick={() => { fetchData(); fetchMetaConfig(); }}>Actualizar</button>
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
          <span className={`${b}__health-dot ${allMetaConfigured ? `${b}__health-dot--ok` : `${b}__health-dot--error`}`} />
          <span className={`${b}__health-label`}>Meta App</span>
          <span className={`${b}__health-value`}>{allMetaConfigured ? 'Configurada' : 'Sin configurar'}</span>
        </div>
      </div>

      {/* Meta Platform Config */}
      <div className={`${b}__section`}>
        <div className={`${b}__section-header`}>
          <h3 className={`${b}__section-title`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
            Configuracion Meta / Facebook
          </h3>
          {!metaEditing && (
            <button className={`${b}__edit-btn`} onClick={() => { setMetaEditing(true); setMetaForm({ ...metaConfig }); setMetaMsg(''); }}>
              Editar
            </button>
          )}
        </div>
        <p className={`${b}__section-desc`}>
          Credenciales de la app de Plexify en Meta. Se configuran una sola vez y aplican para todos los tenants.
          Cada negocio conecta su propia cuenta de Facebook desde Ajustes.
        </p>

        {metaEditing ? (
          <div className={`${b}__meta-form`}>
            {META_CONFIG_KEYS.map(({ key, label, placeholder, secret }) => (
              <div key={key} className={`${b}__meta-field`}>
                <label className={`${b}__meta-label`}>{label}</label>
                <input
                  className={`${b}__meta-input`}
                  type={secret ? 'password' : 'text'}
                  placeholder={placeholder}
                  value={metaForm[key] || ''}
                  onChange={(e) => setMetaForm(prev => ({ ...prev, [key]: e.target.value }))}
                />
                <span className={`${b}__meta-key`}>{key}</span>
              </div>
            ))}
            <div className={`${b}__meta-actions`}>
              <button className={`${b}__meta-save`} onClick={handleMetaSave} disabled={metaSaving}>
                {metaSaving ? 'Guardando...' : 'Guardar'}
              </button>
              <button className={`${b}__meta-cancel`} onClick={() => { setMetaEditing(false); setMetaMsg(''); }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className={`${b}__meta-display`}>
            {META_CONFIG_KEYS.map(({ key, label }) => (
              <div key={key} className={`${b}__info-row`}>
                <span className={`${b}__info-label`}>{label}</span>
                <span className={`${b}__info-value ${!metaConfig[key] ? `${b}__info-value--missing` : ''}`}>
                  {metaConfig[key] || 'No configurado'}
                </span>
              </div>
            ))}
          </div>
        )}

        {metaMsg && <p className={`${b}__meta-msg`}>{metaMsg}</p>}
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
        <h3 className={`${b}__section-title`}>Variables de entorno (Railway)</h3>
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
