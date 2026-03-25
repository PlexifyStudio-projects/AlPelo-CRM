import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-system';

const META_CONFIG_KEYS = [
  { key: 'META_APP_ID', label: 'App ID', placeholder: 'Tu Facebook App ID', secret: false },
  { key: 'META_APP_SECRET', label: 'App Secret', placeholder: 'Tu Facebook App Secret', secret: true },
  { key: 'META_REDIRECT_URI', label: 'Redirect URI', placeholder: 'https://tu-dominio.com/oauth-callback.html', secret: false },
];

const SECTIONS = [
  {
    id: 'meta',
    title: 'Meta / WhatsApp',
    desc: 'Credenciales de la app de Meta para WhatsApp Business',
    color1: '#1877F2',
    color2: '#42A5F5',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
    ),
  },
  {
    id: 'ai',
    title: 'Inteligencia Artificial',
    desc: 'Modelo, API key y configuracion de Claude',
    color1: '#D97706',
    color2: '#F59E0B',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a4 4 0 014 4v1a2 2 0 012 2v1a2 2 0 01-2 2h0a2 2 0 01-2 2v3a2 2 0 01-4 0v-3a2 2 0 01-2-2h0a2 2 0 01-2-2V9a2 2 0 012-2V6a4 4 0 014-4z"/></svg>
    ),
  },
  {
    id: 'server',
    title: 'Servidor',
    desc: 'Python, plataforma, entorno de Railway',
    color1: '#0F766E',
    color2: '#14B8A6',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>
    ),
  },
  {
    id: 'database',
    title: 'Base de Datos',
    desc: 'Contadores, estado de conexion, tablas',
    color1: '#7C3AED',
    color2: '#A855F7',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
    ),
  },
  {
    id: 'env',
    title: 'Variables de Entorno',
    desc: 'Keys, tokens y configuracion de Railway',
    color1: '#DC2626',
    color2: '#EF4444',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    ),
  },
  {
    id: 'pricing',
    title: 'Costos IA',
    desc: 'Tarifas de Claude, TRM y calculo de costos',
    color1: '#059669',
    color2: '#10B981',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    ),
  },
];

const DevSystem = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState(null);

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
    } catch { /* silent */ }
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

  const toggleSection = (id) => setOpenSection((prev) => (prev === id ? null : id));

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Configuracion</h1></div>
        <p className={`${b}__loading`}>Cargando configuracion...</p>
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
          <h1 className={`${b}__title`}>Configuracion</h1>
          <p className={`${b}__subtitle`}>Plataforma, integraciones y variables del sistema</p>
        </div>
      </div>

      {/* Section Cards Grid */}
      <div className={`${b}__grid`}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`${b}__card ${openSection === s.id ? `${b}__card--active` : ''}`}
            onClick={() => toggleSection(s.id)}
            style={{ '--c1': s.color1, '--c2': s.color2 }}
          >
            <div className={`${b}__card-glow`} />
            <div className={`${b}__card-icon`}>
              {s.icon}
            </div>
            <h3 className={`${b}__card-title`}>{s.title}</h3>
            <p className={`${b}__card-desc`}>{s.desc}</p>
            {s.id === 'meta' && allMetaConfigured && (
              <span className={`${b}__card-badge`}>Configurado</span>
            )}
          </button>
        ))}
      </div>

      {/* Expanded Panel */}
      {openSection && (
        <div className={`${b}__panel`} key={openSection}>
          <div className={`${b}__panel-content`}>

            {/* META CONFIG */}
            {openSection === 'meta' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Configuracion Meta / Facebook</h3>
                  <p>Credenciales de la app de Plexify en Meta. Se configuran una sola vez y aplican para todos los tenants.</p>
                  {!metaEditing && (
                    <button className={`${b}__edit-btn`} onClick={() => { setMetaEditing(true); setMetaForm({ ...metaConfig }); setMetaMsg(''); }}>Editar</button>
                  )}
                </div>
                {metaEditing ? (
                  <div className={`${b}__form`}>
                    {META_CONFIG_KEYS.map(({ key, label, placeholder, secret }) => (
                      <div key={key} className={`${b}__field`}>
                        <label>{label}</label>
                        <input
                          type={secret ? 'password' : 'text'}
                          placeholder={placeholder}
                          value={metaForm[key] || ''}
                          onChange={(e) => setMetaForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                        <span className={`${b}__field-key`}>{key}</span>
                      </div>
                    ))}
                    <div className={`${b}__form-actions`}>
                      <button className={`${b}__btn-save`} onClick={handleMetaSave} disabled={metaSaving}>{metaSaving ? 'Guardando...' : 'Guardar'}</button>
                      <button className={`${b}__btn-cancel`} onClick={() => { setMetaEditing(false); setMetaMsg(''); }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className={`${b}__info-list`}>
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
                {metaMsg && <p className={`${b}__msg`}>{metaMsg}</p>}
              </>
            )}

            {/* AI CONFIG */}
            {openSection === 'ai' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Inteligencia Artificial</h3>
                  <p>Configuracion del modelo Claude para Lina IA y los endpoints estrategicos.</p>
                </div>
                <div className={`${b}__info-list`}>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Modelo</span>
                    <span className={`${b}__info-value`}>claude-sonnet-4-20250514</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>API Key</span>
                    <span className={`${b}__info-value ${envVars.ANTHROPIC_API_KEY === 'NOT SET' ? `${b}__info-value--missing` : ''}`}>
                      {envVars.ANTHROPIC_API_KEY !== 'NOT SET' ? 'Configurada' : 'No configurada'}
                    </span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Temperatura</span>
                    <span className={`${b}__info-value`}>0.4 (estrategia) / 0.6 (chat)</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Max Tokens</span>
                    <span className={`${b}__info-value`}>4,096 (estrategia) / 2,048 (chat)</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Prompt Caching</span>
                    <span className={`${b}__info-value`}>Activado (ephemeral)</span>
                  </div>
                </div>
              </>
            )}

            {/* SERVER INFO */}
            {openSection === 'server' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Informacion del Servidor</h3>
                  <p>Detalles del entorno de ejecucion en Railway.</p>
                </div>
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
                    <span className={`${b}__info-value`}>{envVars.ENVIRONMENT || 'production'}</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Base de datos</span>
                    <span className={`${b}__info-value`}>{d.database_connected ? 'Conectada' : 'Desconectada'}</span>
                  </div>
                </div>
              </>
            )}

            {/* DATABASE */}
            {openSection === 'database' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Contadores de Base de Datos</h3>
                  <p>Registros reales en PostgreSQL.</p>
                </div>
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
              </>
            )}

            {/* ENV VARS */}
            {openSection === 'env' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Variables de Entorno (Railway)</h3>
                  <p>Estado de las variables configuradas en el servidor.</p>
                </div>
                <div className={`${b}__env-list`}>
                  {Object.entries(envVars).map(([key, val]) => (
                    <div key={key} className={`${b}__env-row`}>
                      <span className={`${b}__env-key`}>{key}</span>
                      <span className={`${b}__env-value ${val === 'NOT SET' ? `${b}__env-value--missing` : ''}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* PRICING */}
            {openSection === 'pricing' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Costos de Inteligencia Artificial</h3>
                  <p>Tarifas de Claude Sonnet y calculo de costos para la plataforma.</p>
                </div>
                <div className={`${b}__info-list`}>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Modelo</span>
                    <span className={`${b}__info-value`}>Claude Sonnet 4 (claude-sonnet-4-20250514)</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Input</span>
                    <span className={`${b}__info-value`}>$3.00 USD / 1M tokens</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Output</span>
                    <span className={`${b}__info-value`}>$15.00 USD / 1M tokens</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Blended rate (estimado)</span>
                    <span className={`${b}__info-value`}>$5.40 USD / 1M tokens</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>TRM (referencia)</span>
                    <span className={`${b}__info-value`}>$4,200 COP / 1 USD</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Cache discount</span>
                    <span className={`${b}__info-value`}>90% en prompts cacheados (ephemeral 5min)</span>
                  </div>
                </div>
                <div className={`${b}__pricing-note`}>
                  Cada mensaje de Lina IA, estrategia, o prospector consume tokens. El costo se calcula como:<br />
                  <strong>tokens usados / 1,000,000 x $5.40 x TRM = costo en COP</strong>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DevSystem;
