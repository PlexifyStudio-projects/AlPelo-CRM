import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-system';

const formatCOP = (v) => `$${Number(v || 0).toLocaleString('es-CO')}`;
const formatTokens = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('es-CO');
};

const META_KEYS = [
  { key: 'META_APP_ID', label: 'App ID', placeholder: 'Ej: 123456789012345', secret: false, help: 'Lo encuentras en developers.facebook.com > Tu App > Configuracion basica' },
  { key: 'META_APP_SECRET', label: 'App Secret', placeholder: 'Ej: abc123def456...', secret: true, help: 'Secreto de la app. NUNCA compartir. Se usa para OAuth server-side.' },
  { key: 'META_REDIRECT_URI', label: 'Redirect URI', placeholder: 'https://plexifystudio-projects.github.io/oauth-callback.html', secret: false, help: 'URL exacta que configuraste en Facebook Login > Configuracion > URIs de redireccionamiento validos' },
  { key: 'GOOGLE_PLACES_API_KEY', label: 'Google Places API Key', placeholder: 'AIzaSy...', secret: true, help: 'Para sincronizar resenas de Google en las paginas de booking. Obtener en Google Cloud Console > APIs & Services > Credentials.' },
];

const SECTIONS = [
  {
    id: 'meta', title: 'Meta Platform', desc: 'WhatsApp Business API, Facebook OAuth, webhook',
    color1: '#0082FB', color2: '#00C6FF',
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <defs><linearGradient id="meta-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0082FB"/><stop offset="100%" stopColor="#00C6FF"/></linearGradient></defs>
        <path fillRule="evenodd" d="M16.434 10.486C18.29 7.976 20.342 6 22.966 6 27.92 6 32 12.306 32.002 19.814c0 4.58-1.972 7.45-5.514 7.45-3.086 0-4.79-1.732-7.848-6.848l-1.334-2.246-.236-.394a110 110 0 00-1.06-1.754l-2.356 4.16c-3.346 5.85-5.23 7.082-7.846 7.082C2.172 27.264 0 24.434 0 19.946 0 12.776 3.99 6 9.196 6q.954-.002 1.848.244c.62.172 1.222.44 1.826.814 1.154.718 2.308 1.83 3.564 3.428zm3.032 4.448q-.756-1.23-1.454-2.266L18 12.652c1.69-2.61 3.086-3.908 4.744-3.908 3.446 0 6.204 5.074 6.204 11.306 0 2.376-.78 3.754-2.39 3.754-1.546 0-2.284-1.02-5.22-5.74zM9.692 9.512c1.45.2 2.77 1.268 4.68 4.002A424 424 0 0011.102 18.6c-2.714 4.252-3.652 5.206-5.162 5.206-1.554 0-2.48-1.364-2.48-3.8 0-5.204 2.596-10.528 5.692-10.528q.274 0 .54.036" fill="url(#meta-g)"/>
      </svg>
    ),
  },
  {
    id: 'ai', title: 'Proveedores de IA', desc: 'Claude, GPT, Gemini — selector con failover automatico',
    color1: '#D97706', color2: '#F59E0B',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2a4 4 0 014 4v1a2 2 0 012 2v1a2 2 0 01-2 2h0a2 2 0 01-2 2v3a2 2 0 01-4 0v-3a2 2 0 01-2-2h0a2 2 0 01-2-2V9a2 2 0 012-2V6a4 4 0 014-4z"/>
        <circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'costs', title: 'Costos IA', desc: 'Desglose en tiempo real por tenant, accion y periodo',
    color1: '#059669', color2: '#10B981',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    ),
  },
  {
    id: 'origins', title: 'Origenes Permitidos', desc: 'URLs que pueden acceder a la API (CORS)',
    color1: '#7C3AED', color2: '#A855F7',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    ),
  },
  {
    id: 'security', title: 'Seguridad', desc: 'JWT, sesiones, autenticacion',
    color1: '#DC2626', color2: '#EF4444',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/></svg>
    ),
  },
];

const DevSystem = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState(null);

  // Meta
  const [metaConfig, setMetaConfig] = useState({});
  const [metaEditing, setMetaEditing] = useState(false);
  const [metaForm, setMetaForm] = useState({});
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaMsg, setMetaMsg] = useState('');

  // AI Providers
  const [providers, setProviders] = useState([]);
  const [providerTypes, setProviderTypes] = useState([]);
  const [addingProvider, setAddingProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: '', provider_type: 'anthropic', api_key: '', model: 'claude-sonnet-4-20250514' });
  const [providerSaving, setProviderSaving] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [toast, setToast] = useState(null); // { type: 'success'|'error', title, message }

  // Costs
  const [costs, setCosts] = useState(null);

  // Origins
  const [origins, setOrigins] = useState([]);
  const [newOrigin, setNewOrigin] = useState('');
  const [originsSaving, setOriginsSaving] = useState(false);

  const apiFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [sys, meta, prov, cost, orig] = await Promise.allSettled([
        apiFetch('/dev/system'),
        apiFetch('/dev/platform-config'),
        apiFetch('/dev/ai-providers'),
        apiFetch('/dev/ai-cost-breakdown'),
        apiFetch('/dev/allowed-origins'),
      ]);
      if (sys.status === 'fulfilled') setData(sys.value);
      if (meta.status === 'fulfilled') { setMetaConfig(meta.value.config || {}); setMetaForm(meta.value.config || {}); }
      if (prov.status === 'fulfilled') { setProviders(prov.value.providers || []); setProviderTypes(prov.value.available_types || []); }
      if (cost.status === 'fulfilled') setCosts(cost.value);
      if (orig.status === 'fulfilled') setOrigins(orig.value.origins || []);
    } catch { /* partial ok */ }
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Meta save
  const handleMetaSave = async () => {
    setMetaSaving(true); setMetaMsg('');
    try {
      await apiFetch('/dev/platform-config', { method: 'PUT', body: JSON.stringify({ items: metaForm }) });
      setMetaMsg('Configuracion guardada correctamente');
      setMetaEditing(false);
      fetchAll();
    } catch { setMetaMsg('Error al guardar'); }
    setMetaSaving(false);
  };

  // AI Provider save
  const handleAddProvider = async () => {
    setProviderSaving(true);
    try {
      await apiFetch('/dev/ai-providers', { method: 'POST', body: JSON.stringify(newProvider) });
      setAddingProvider(false);
      setNewProvider({ name: '', provider_type: 'anthropic', api_key: '', model: 'claude-sonnet-4-20250514' });
      fetchAll();
    } catch { /* */ }
    setProviderSaving(false);
  };

  const handleHealthCheck = async (id) => {
    try {
      const result = await apiFetch(`/dev/ai-providers/${id}/health-check`, { method: 'POST' });
      if (result.status === 'down') {
        // Parse the error to extract the actual message
        let errorMsg = result.error || 'Error desconocido';
        try {
          const parsed = JSON.parse(errorMsg.replace(/^HTTP \d+: /, ''));
          if (parsed.error?.message) errorMsg = parsed.error.message;
          else if (parsed.message) errorMsg = parsed.message;
        } catch { /* use raw */ }
        setToast({ type: 'error', title: 'Health check fallido', message: errorMsg });
      } else {
        setToast({ type: 'success', title: 'Proveedor saludable', message: 'La conexion con la API funciona correctamente.' });
      }
      fetchAll();
    } catch {
      setToast({ type: 'error', title: 'Error', message: 'No se pudo realizar el health check.' });
    }
  };

  const handleSaveEdit = async (id) => {
    setProviderSaving(true);
    try {
      await apiFetch(`/dev/ai-providers/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
      setEditingProvider(null);
      fetchAll();
    } catch { /* */ }
    setProviderSaving(false);
  };

  const handleSetPrimary = async (id) => {
    try { await apiFetch(`/dev/ai-providers/${id}`, { method: 'PUT', body: JSON.stringify({ is_primary: true }) }); fetchAll(); } catch { /* */ }
  };

  const handleDeleteProvider = async (id) => {
    try { await apiFetch(`/dev/ai-providers/${id}`, { method: 'DELETE' }); fetchAll(); } catch { /* */ }
  };

  const handleToggleProvider = async (id, active) => {
    try { await apiFetch(`/dev/ai-providers/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: !active }) }); fetchAll(); } catch { /* */ }
  };

  // Origins
  const handleAddOrigin = async () => {
    if (!newOrigin.trim()) return;
    const updated = [...origins, newOrigin.trim()];
    setOriginsSaving(true);
    try { await apiFetch('/dev/allowed-origins', { method: 'PUT', body: JSON.stringify({ origins: updated }) }); setOrigins(updated); setNewOrigin(''); } catch { /* */ }
    setOriginsSaving(false);
  };

  const handleRemoveOrigin = async (idx) => {
    const updated = origins.filter((_, i) => i !== idx);
    try { await apiFetch('/dev/allowed-origins', { method: 'PUT', body: JSON.stringify({ origins: updated }) }); setOrigins(updated); } catch { /* */ }
  };

  const toggleSection = (id) => setOpenSection((prev) => (prev === id ? null : id));

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Configuracion</h1></div>
        <p className={`${b}__loading`}>Cargando...</p>
      </div>
    );
  }

  const d = data || {};
  const envVars = d.environment_vars || {};
  const selectedType = providerTypes.find((t) => t.id === newProvider.provider_type);
  const STATUS_COLORS = { healthy: '#10B981', degraded: '#F59E0B', down: '#EF4444', unknown: '#94A3B8' };

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Configuracion</h1>
          <p className={`${b}__subtitle`}>Plataforma, integraciones, IA y seguridad</p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className={`${b}__grid`}>
        {SECTIONS.map((s) => (
          <button key={s.id} className={`${b}__card ${openSection === s.id ? `${b}__card--active` : ''}`} onClick={() => toggleSection(s.id)} style={{ '--c1': s.color1, '--c2': s.color2 }}>
            <div className={`${b}__card-glow`} />
            <div className={`${b}__card-icon`}>{s.icon}</div>
            <h3 className={`${b}__card-title`}>{s.title}</h3>
            <p className={`${b}__card-desc`}>{s.desc}</p>
            {s.id === 'ai' && providers.length > 0 && (
              <span className={`${b}__card-badge`}>{providers.filter((p) => p.is_active).length} activos</span>
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      {openSection && (
        <div className={`${b}__panel`} key={openSection}>
          <div className={`${b}__panel-content`}>

            {/* ─── META ─── */}
            {openSection === 'meta' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Meta Platform — WhatsApp Business API</h3>
                  <p>Estas credenciales se configuran UNA VEZ para toda la plataforma. Cada negocio conecta su propia cuenta de Facebook/WhatsApp desde su panel de Ajustes usando OAuth. Para cambiar algo:</p>
                  <ol className={`${b}__help-steps`}>
                    <li>Ve a <strong>developers.facebook.com</strong> → Tu App → Configuracion basica</li>
                    <li>Copia el <strong>App ID</strong> y <strong>App Secret</strong></li>
                    <li>En Facebook Login → Configuracion, agrega el <strong>Redirect URI</strong> exacto</li>
                    <li>Guarda aqui y listo — aplica a todos los tenants al instante</li>
                  </ol>
                  {!metaEditing && <button className={`${b}__edit-btn`} onClick={() => { setMetaEditing(true); setMetaForm({ ...metaConfig }); setMetaMsg(''); }}>Editar credenciales</button>}
                </div>
                {metaEditing ? (
                  <div className={`${b}__form`}>
                    {META_KEYS.map(({ key, label, placeholder, secret, help }) => (
                      <div key={key} className={`${b}__field`}>
                        <label>{label}</label>
                        <input type={secret ? 'password' : 'text'} placeholder={placeholder} value={metaForm[key] || ''} onChange={(e) => setMetaForm((prev) => ({ ...prev, [key]: e.target.value }))} />
                        <span className={`${b}__field-key`}>{help}</span>
                      </div>
                    ))}
                    <div className={`${b}__form-actions`}>
                      <button className={`${b}__btn-save`} onClick={handleMetaSave} disabled={metaSaving}>{metaSaving ? 'Guardando...' : 'Guardar cambios'}</button>
                      <button className={`${b}__btn-cancel`} onClick={() => setMetaEditing(false)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className={`${b}__info-list`}>
                    {META_KEYS.map(({ key, label }) => (
                      <div key={key} className={`${b}__info-row`}>
                        <span className={`${b}__info-label`}>{label}</span>
                        <span className={`${b}__info-value ${!metaConfig[key] ? `${b}__info-value--missing` : ''}`}>{metaConfig[key] ? (key.includes('SECRET') ? `***${metaConfig[key].slice(-4)}` : metaConfig[key]) : 'No configurado'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {metaMsg && <p className={`${b}__msg`}>{metaMsg}</p>}
              </>
            )}

            {/* ─── AI PROVIDERS ─── */}
            {openSection === 'ai' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Proveedores de Inteligencia Artificial</h3>
                  <p>Configura multiples proveedores de IA. El <strong>primario</strong> se usa para todo (Lina, estrategia, prospector). Si falla, el sistema puede usar el <strong>fallback</strong> automaticamente. Las API keys se guardan en la base de datos, no en Railway.</p>
                </div>

                {/* Provider List */}
                {providers.length === 0 ? (
                  <div className={`${b}__empty-msg`}>Sin proveedores configurados. Agrega Claude como primario.</div>
                ) : (
                  <div className={`${b}__provider-list`}>
                    {providers.map((p) => (
                      <div key={p.id} className={`${b}__provider ${p.is_primary ? `${b}__provider--primary` : ''} ${!p.is_active ? `${b}__provider--inactive` : ''}`}>
                        {editingProvider === p.id ? (
                          /* ─── Edit Mode ─── */
                          <div className={`${b}__provider-edit`}>
                            <div className={`${b}__provider-edit-grid`}>
                              <div className={`${b}__field`}>
                                <label>Nombre</label>
                                <input value={editForm.name || ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                              </div>
                              <div className={`${b}__field`}>
                                <label>Proveedor</label>
                                <select className={`${b}__select`} value={editForm.provider_type || ''} onChange={(e) => { const t = providerTypes.find((x) => x.id === e.target.value); setEditForm((f) => ({ ...f, provider_type: e.target.value, model: t?.models[0] || f.model })); }}>
                                  {providerTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                              </div>
                              <div className={`${b}__field`}>
                                <label>Modelo</label>
                                <select className={`${b}__select`} value={editForm.model || ''} onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}>
                                  {(providerTypes.find((t) => t.id === editForm.provider_type)?.models || []).map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </div>
                              <div className={`${b}__field`}>
                                <label>API Key (dejar vacio para mantener actual)</label>
                                <input type="password" placeholder="Dejar vacio para no cambiar" value={editForm.api_key || ''} onChange={(e) => setEditForm((f) => ({ ...f, api_key: e.target.value }))} />
                              </div>
                            </div>
                            <div className={`${b}__form-actions`}>
                              <button className={`${b}__btn-save`} onClick={() => handleSaveEdit(p.id)} disabled={providerSaving}>{providerSaving ? 'Guardando...' : 'Guardar'}</button>
                              <button className={`${b}__btn-cancel`} onClick={() => setEditingProvider(null)}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          /* ─── Display Mode ─── */
                          <>
                            <div className={`${b}__provider-left`}>
                              <span className={`${b}__provider-status`} style={{ background: STATUS_COLORS[p.status] || '#94A3B8' }} title={p.status} />
                              <div className={`${b}__provider-info`}>
                                <span className={`${b}__provider-name`}>
                                  {p.name}
                                  {p.is_primary && <span className={`${b}__provider-badge`}>PRIMARIO</span>}
                                  {!p.is_active && <span className={`${b}__provider-badge ${b}__provider-badge--off`}>INACTIVO</span>}
                                </span>
                                <span className={`${b}__provider-model`}>
                                  {p.model} — {p.api_key_preview} — ${p.input_cost_per_mtok}/${ p.output_cost_per_mtok} MTok
                                  {p.last_health_check && ` — Check: ${new Date(p.last_health_check).toLocaleString('es-CO')}`}
                                </span>
                              </div>
                            </div>
                            <div className={`${b}__provider-actions`}>
                              <button className={`${b}__provider-btn`} onClick={() => handleHealthCheck(p.id)} title="Verificar salud">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                              </button>
                              <button className={`${b}__provider-btn`} onClick={() => { setEditingProvider(p.id); setEditForm({ name: p.name, provider_type: p.provider_type, model: p.model, api_key: '' }); }} title="Editar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                              </button>
                              {!p.is_primary && (
                                <button className={`${b}__provider-btn`} onClick={() => handleSetPrimary(p.id)} title="Hacer primario">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                </button>
                              )}
                              <button className={`${b}__provider-btn`} onClick={() => handleToggleProvider(p.id, p.is_active)} title={p.is_active ? 'Desactivar' : 'Activar'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{p.is_active ? <><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></> : <path d="M17 7l-10 10M7 7l10 10"/>}</svg>
                              </button>
                              {!p.is_primary && (
                                <button className={`${b}__provider-btn ${b}__provider-btn--danger`} onClick={() => handleDeleteProvider(p.id)} title="Eliminar">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Provider Form */}
                {addingProvider ? (
                  <div className={`${b}__form`} style={{ marginTop: 20 }}>
                    <div className={`${b}__field`}>
                      <label>Nombre</label>
                      <input placeholder="Ej: Claude Principal" value={newProvider.name} onChange={(e) => setNewProvider((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className={`${b}__field`}>
                      <label>Proveedor</label>
                      <select className={`${b}__select`} value={newProvider.provider_type} onChange={(e) => { const t = providerTypes.find((x) => x.id === e.target.value); setNewProvider((p) => ({ ...p, provider_type: e.target.value, model: t?.models[0] || '' })); }}>
                        {providerTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className={`${b}__field`}>
                      <label>Modelo</label>
                      <select className={`${b}__select`} value={newProvider.model} onChange={(e) => setNewProvider((p) => ({ ...p, model: e.target.value }))}>
                        {(selectedType?.models || []).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className={`${b}__field`}>
                      <label>API Key</label>
                      <input type="password" placeholder="sk-ant-..." value={newProvider.api_key} onChange={(e) => setNewProvider((p) => ({ ...p, api_key: e.target.value }))} />
                    </div>
                    <div className={`${b}__form-actions`}>
                      <button className={`${b}__btn-save`} onClick={handleAddProvider} disabled={providerSaving || !newProvider.name || !newProvider.api_key}>{providerSaving ? 'Guardando...' : 'Agregar proveedor'}</button>
                      <button className={`${b}__btn-cancel`} onClick={() => setAddingProvider(false)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button className={`${b}__edit-btn`} style={{ marginTop: 16 }} onClick={() => setAddingProvider(true)}>+ Agregar proveedor de IA</button>
                )}
              </>
            )}

            {/* ─── COSTS ─── */}
            {openSection === 'costs' && costs && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Desglose de Costos IA — {costs.period}</h3>
                  <p>Proveedor: <strong>{costs.provider?.name}</strong> ({costs.provider?.model}) — Blended rate: ${costs.provider?.blended_rate}/MTok — TRM: ${costs.trm?.toLocaleString('es-CO')} COP</p>
                </div>

                {/* This month summary */}
                <div className={`${b}__cost-summary`}>
                  <div className={`${b}__cost-card`}>
                    <span className={`${b}__cost-card-value`}>{formatCOP(costs.this_month?.cost_cop)}</span>
                    <span className={`${b}__cost-card-label`}>Costo este mes (COP)</span>
                    <span className={`${b}__cost-card-sub`}>USD ${costs.this_month?.cost_usd?.toFixed(2)}</span>
                  </div>
                  <div className={`${b}__cost-card`}>
                    <span className={`${b}__cost-card-value`}>{formatTokens(costs.this_month?.tokens)}</span>
                    <span className={`${b}__cost-card-label`}>Tokens consumidos</span>
                    <span className={`${b}__cost-card-sub`}>{costs.this_month?.messages?.toLocaleString('es-CO')} mensajes</span>
                  </div>
                  <div className={`${b}__cost-card`}>
                    <span className={`${b}__cost-card-value`}>{formatCOP(costs.all_time?.cost_cop)}</span>
                    <span className={`${b}__cost-card-label`}>Costo total historico</span>
                    <span className={`${b}__cost-card-sub`}>{formatTokens(costs.all_time?.tokens)} tokens all-time</span>
                  </div>
                </div>

                {/* By tenant */}
                <h4 className={`${b}__cost-section-title`}>Por agencia este mes</h4>
                <div className={`${b}__info-list`}>
                  {(costs.this_month?.by_tenant || []).map((t) => (
                    <div key={t.tenant_id} className={`${b}__info-row`}>
                      <span className={`${b}__info-label`}>{t.tenant_name}</span>
                      <span className={`${b}__info-value`}>
                        {formatCOP(t.cost_cop)} — {formatTokens(t.tokens)} tokens — {t.messages_sent} msgs — {t.campaigns} campanas
                      </span>
                    </div>
                  ))}
                </div>

                {/* By action */}
                <h4 className={`${b}__cost-section-title`}>Estimado por tipo de accion</h4>
                <div className={`${b}__info-list`}>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Respuestas de Lina IA</span>
                    <span className={`${b}__info-value`}>{costs.estimated_by_action?.lina_responses?.count} respuestas — {formatCOP(costs.estimated_by_action?.lina_responses?.cost_cop)} est.</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Llamadas de estrategia</span>
                    <span className={`${b}__info-value`}>~4,000 tokens/llamada</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Prospector IA</span>
                    <span className={`${b}__info-value`}>~3,000 tokens/busqueda</span>
                  </div>
                </div>

                {/* History */}
                {(costs.history || []).filter((h) => h.tokens > 0).length > 0 && (
                  <>
                    <h4 className={`${b}__cost-section-title`}>Historial mensual</h4>
                    <div className={`${b}__info-list`}>
                      {(costs.history || []).filter((h) => h.tokens > 0).map((h) => (
                        <div key={h.period} className={`${b}__info-row`}>
                          <span className={`${b}__info-label`}>{h.period}</span>
                          <span className={`${b}__info-value`}>{formatCOP(h.cost_cop)} — {formatTokens(h.tokens)} tokens</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ─── ORIGINS ─── */}
            {openSection === 'origins' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Origenes Permitidos (CORS)</h3>
                  <p>URLs que pueden hacer peticiones a la API. Si despliegas el frontend en un dominio nuevo, agregalo aqui para que funcione.</p>
                </div>
                <div className={`${b}__origins-list`}>
                  {origins.map((o, i) => (
                    <div key={i} className={`${b}__origin-row`}>
                      <span className={`${b}__origin-url`}>{o}</span>
                      <button className={`${b}__provider-btn ${b}__provider-btn--danger`} onClick={() => handleRemoveOrigin(i)} title="Quitar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className={`${b}__origin-add`}>
                  <input placeholder="https://mi-dominio.com" value={newOrigin} onChange={(e) => setNewOrigin(e.target.value)} className={`${b}__origin-input`} />
                  <button className={`${b}__btn-save`} onClick={handleAddOrigin} disabled={originsSaving || !newOrigin.trim()}>Agregar</button>
                </div>
              </>
            )}

            {/* ─── SECURITY ─── */}
            {openSection === 'security' && (
              <>
                <div className={`${b}__panel-header`}>
                  <h3>Seguridad y Autenticacion</h3>
                  <p>Configuracion de JWT y manejo de sesiones.</p>
                </div>
                <div className={`${b}__info-list`}>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>JWT Secret Key</span>
                    <span className={`${b}__info-value`}>Activa (firma tokens de sesion)</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Duracion de sesion</span>
                    <span className={`${b}__info-value`}>60 minutos</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Metodo de auth</span>
                    <span className={`${b}__info-value`}>Bearer Token + Cookie fallback</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Refresh token</span>
                    <span className={`${b}__info-value`}>Activo (auto-refresh en background)</span>
                  </div>
                  <div className={`${b}__info-row`}>
                    <span className={`${b}__info-label`}>Sesion unica por dispositivo</span>
                    <span className={`${b}__info-value`}>Activo — 1 sesion por cuenta</span>
                  </div>
                </div>
                <div className={`${b}__pricing-note`}>
                  <strong style={{ marginTop: 0 }}>Flujo de seguridad:</strong>
                  Cada usuario obtiene un JWT valido por 60 minutos al hacer login. Solo puede haber UNA sesion activa por cuenta — si alguien intenta iniciar sesion desde otro dispositivo, vera una advertencia y podra cerrar la sesion anterior o cancelar. Las API keys de IA se guardan en la base de datos, no en variables de entorno de Railway.
                </div>
              </>
            )}


          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`${b}__toast ${b}__toast--${toast.type}`} onClick={() => setToast(null)}>
          <div className={`${b}__toast-icon`}>
            {toast.type === 'success' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            )}
          </div>
          <div className={`${b}__toast-body`}>
            <strong className={`${b}__toast-title`}>{toast.title}</strong>
            <p className={`${b}__toast-message`}>{toast.message}</p>
          </div>
          <button className={`${b}__toast-close`} onClick={() => setToast(null)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default DevSystem;
