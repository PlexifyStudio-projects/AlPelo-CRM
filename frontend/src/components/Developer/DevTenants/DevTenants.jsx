import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-tenants';

const EMPTY_TENANT = {
  name: '',
  business_type: 'peluqueria',
  owner_name: '',
  owner_phone: '',
  owner_email: '',
  city: '',
  country: 'CO',
  monthly_price: 0,
  messages_limit: 5000,
  plan: 'standard',
};

const DevTenants = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_TENANT });
  const [editingId, setEditingId] = useState(null);
  const [editingTenant, setEditingTenant] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [fetchError, setFetchError] = useState(false);
  // Admin credentials state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [credMsg, setCredMsg] = useState(null);
  const [savingCreds, setSavingCreds] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/tenants`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTenants(data || []);
      setFetchError(false);
    } catch {
      setTenants([]);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleOpenCreate = () => {
    setFormData({ ...EMPTY_TENANT });
    setEditingId(null);
    setEditingTenant(null);
    setAdminUsername('');
    setAdminPassword('');
    setNewPassword('');
    setCredMsg(null);
    setShowForm(true);
  };

  const handleOpenEdit = (tenant) => {
    setFormData({
      name: tenant.name,
      business_type: tenant.business_type || 'peluqueria',
      owner_name: tenant.owner_name || '',
      owner_phone: tenant.owner_phone || '',
      owner_email: tenant.owner_email || '',
      city: tenant.city || '',
      country: tenant.country || 'CO',
      monthly_price: tenant.monthly_price || 0,
      messages_limit: tenant.messages_limit || 5000,
      plan: tenant.plan || 'standard',
    });
    setEditingId(tenant.id);
    setEditingTenant(tenant);
    setAdminUsername(tenant.admin_user?.username || '');
    setNewPassword('');
    setCredMsg(null);
    setShowNewPwd(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editingId) {
      if (!adminUsername.trim() || !adminPassword.trim()) {
        alert('Usuario y contrasena son obligatorios');
        return;
      }
    }

    try {
      const url = editingId
        ? `${API_URL}/dev/tenants/${editingId}`
        : `${API_URL}/dev/tenants`;
      const method = editingId ? 'PUT' : 'POST';

      const payload = { ...formData, plan: 'standard' };
      if (!editingId) {
        payload.slug = slugify(payload.name);
        payload.admin_username = adminUsername.trim();
        payload.admin_password = adminPassword.trim();
      }

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Error al guardar');
        return;
      }

      setShowForm(false);
      alert(editingId ? 'Agencia actualizada' : 'Agencia creada exitosamente');
      fetchTenants();
    } catch {
      alert('Error de conexion');
    }
  };

  const handleSaveCredentials = async () => {
    if (!editingId) return;
    setSavingCreds(true);
    setCredMsg(null);

    const payload = {};
    if (adminUsername && adminUsername !== editingTenant?.admin_user?.username) {
      payload.username = adminUsername;
    }
    if (newPassword) {
      if (newPassword.length < 6) {
        setCredMsg({ type: 'error', text: 'Minimo 6 caracteres' });
        setSavingCreds(false);
        return;
      }
      payload.new_password = newPassword;
    }

    if (Object.keys(payload).length === 0) {
      setCredMsg({ type: 'error', text: 'No hay cambios' });
      setSavingCreds(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/dev/tenants/${editingId}/admin-credentials`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCredMsg({ type: 'error', text: err.detail || 'Error' });
      } else {
        setCredMsg({ type: 'success', text: 'Credenciales actualizadas' });
        setNewPassword('');
        fetchTenants();
      }
    } catch {
      setCredMsg({ type: 'error', text: 'Error de conexion' });
    }
    setSavingCreds(false);
  };

  const handleToggleAI = async (tenant) => {
    setActionLoading(`ai-${tenant.id}`);
    try {
      await fetch(`${API_URL}/dev/tenants/${tenant.id}/toggle-ai`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !tenant.ai_is_paused }),
      });
      fetchTenants();
    } catch { /* silent */ }
    setActionLoading(null);
  };

  const handleAddMessages = async (tenant, amount) => {
    setActionLoading(`msg-${tenant.id}`);
    try {
      await fetch(`${API_URL}/dev/tenants/${tenant.id}/add-messages`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      fetchTenants();
    } catch { /* silent */ }
    setActionLoading(null);
  };

  const handleToggleActive = async (tenant) => {
    setActionLoading(`active-${tenant.id}`);
    try {
      await fetch(`${API_URL}/dev/tenants/${tenant.id}/toggle-active`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !tenant.is_active }),
      });
      fetchTenants();
    } catch { /* silent */ }
    setActionLoading(null);
  };

  const getUsagePercent = (t) => t.messages_limit > 0 ? Math.round(((t.messages_used || 0) / t.messages_limit) * 100) : 0;

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Agencias</h1></div>
        <div className={`${b}__loading`}>Cargando agencias...</div>
      </div>
    );
  }

  return (
    <div className={b}>
      {/* Header */}
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Agencias</h1>
          <p className={`${b}__subtitle`}>{tenants.length} agencias registradas</p>
        </div>
        <button className={`${b}__btn-create`} onClick={handleOpenCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nueva agencia
        </button>
      </div>

      {/* Empty State */}
      {tenants.length === 0 && (
        <div className={`${b}__empty`}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <p className={`${b}__empty-text`}>
            {fetchError ? 'No se pudieron cargar las agencias' : 'No hay agencias registradas'}
          </p>
          <button className={`${b}__btn-create`} onClick={handleOpenCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Crear primera agencia
          </button>
        </div>
      )}

      {/* Tenant Cards */}
      {tenants.length > 0 && (
        <div className={`${b}__grid`}>
          {tenants.map((t) => {
            const pct = getUsagePercent(t);
            return (
              <div key={t.id} className={`${b}__card ${!t.is_active ? `${b}__card--suspended` : ''}`}>
                <div className={`${b}__card-header`}>
                  <div className={`${b}__card-title-row`}>
                    <h3 className={`${b}__card-name`}>{t.name}</h3>
                  </div>
                  <span className={`${b}__card-plan`} style={{ '--plan-color': '#4F6EF7' }}>
                    Plexify
                  </span>
                </div>

                {/* Usage bar */}
                <div className={`${b}__card-usage`}>
                  <div className={`${b}__card-usage-header`}>
                    <span>Mensajes IA</span>
                    <span className={`${b}__card-usage-count`}>
                      {(t.messages_used || 0).toLocaleString('es-CO')} / {(t.messages_limit || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className={`${b}__card-bar-track`}>
                    <div
                      className={`${b}__card-bar-fill ${pct > 80 ? `${b}__card-bar-fill--warning` : ''} ${pct > 95 ? `${b}__card-bar-fill--critical` : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`${b}__card-usage-pct`}>{pct}% usado</span>
                </div>

                {/* Info grid */}
                <div className={`${b}__card-info`}>
                  <div className={`${b}__card-info-item`}>
                    <span className={`${b}__card-info-label`}>Dueno</span>
                    <span className={`${b}__card-info-value`}>{t.owner_name || '—'}</span>
                  </div>
                  <div className={`${b}__card-info-item`}>
                    <span className={`${b}__card-info-label`}>Ciudad</span>
                    <span className={`${b}__card-info-value`}>{t.city || '—'}</span>
                  </div>
                  <div className={`${b}__card-info-item`}>
                    <span className={`${b}__card-info-label`}>Usuario</span>
                    <span className={`${b}__card-info-value ${b}__card-info-value--mono`}>
                      {t.admin_user?.username || '—'}
                    </span>
                  </div>
                  <div className={`${b}__card-info-item`}>
                    <span className={`${b}__card-info-label`}>Clientes</span>
                    <span className={`${b}__card-info-value`}>{t.total_clients || 0}</span>
                  </div>
                </div>

                {/* Status row */}
                <div className={`${b}__card-status`}>
                  <span className={`${b}__card-ai ${t.ai_is_paused ? `${b}__card-ai--paused` : `${b}__card-ai--active`}`}>
                    IA: {t.ai_is_paused ? 'Pausada' : 'Activa'}
                  </span>
                  <span className={`${b}__card-active ${t.is_active ? `${b}__card-active--on` : `${b}__card-active--off`}`}>
                    {t.is_active ? 'Activa' : 'Suspendida'}
                  </span>
                </div>

                {/* Actions */}
                <div className={`${b}__card-actions`}>
                  <button className={`${b}__card-btn ${b}__card-btn--edit`} onClick={() => handleOpenEdit(t)} title="Editar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    Editar
                  </button>
                  <button
                    className={`${b}__card-btn ${t.ai_is_paused ? `${b}__card-btn--resume` : `${b}__card-btn--pause`}`}
                    onClick={() => handleToggleAI(t)}
                    disabled={actionLoading === `ai-${t.id}`}
                  >
                    {t.ai_is_paused ? 'Reanudar IA' : 'Pausar IA'}
                  </button>
                  <button
                    className={`${b}__card-btn ${b}__card-btn--add`}
                    onClick={() => handleAddMessages(t, 5000)}
                    disabled={actionLoading === `msg-${t.id}`}
                    title="Sumar 5,000 mensajes"
                  >
                    +5,000 msgs
                  </button>
                  <button
                    className={`${b}__card-btn ${t.is_active ? `${b}__card-btn--suspend` : `${b}__card-btn--activate`}`}
                    onClick={() => handleToggleActive(t)}
                    disabled={actionLoading === `active-${t.id}`}
                  >
                    {t.is_active ? 'Suspender' : 'Activar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className={`${b}__modal-overlay`} onClick={() => setShowForm(false)}>
          <div className={`${b}__modal`} onClick={(e) => e.stopPropagation()}>
            <div className={`${b}__modal-header`}>
              <h3 className={`${b}__modal-title`}>
                {editingId ? 'Editar agencia' : 'Nueva agencia'}
              </h3>
              <button className={`${b}__modal-close`} onClick={() => setShowForm(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className={`${b}__modal-body`}>
              {/* Business info */}
              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Nombre del negocio</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: AlPelo Peluqueria"
                  />
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Tipo de negocio</label>
                  <select
                    className={`${b}__form-select`}
                    value={formData.business_type}
                    onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                  >
                    <option value="peluqueria">Peluqueria</option>
                    <option value="barberia">Barberia</option>
                    <option value="spa">Spa</option>
                    <option value="consultorio">Consultorio</option>
                    <option value="restaurante">Restaurante</option>
                    <option value="gimnasio">Gimnasio</option>
                    <option value="tienda">Tienda</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Ciudad</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Bucaramanga"
                  />
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Pais</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="CO"
                  />
                </div>
              </div>

              {/* Owner info */}
              <div className={`${b}__form-divider`} />
              <h4 className={`${b}__form-section`}>Datos del dueno</h4>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Nombre</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    placeholder="Nombre del dueno"
                  />
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Telefono</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.owner_phone}
                    onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                    placeholder="+573001234567"
                  />
                </div>
              </div>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Email</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.owner_email}
                    onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                    placeholder="email@negocio.com"
                  />
                </div>
              </div>

              {/* Plan & pricing */}
              <div className={`${b}__form-divider`} />
              <h4 className={`${b}__form-section`}>Plan y facturacion</h4>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Precio mensual (COP)</label>
                  <input
                    className={`${b}__form-input`}
                    type="number"
                    value={formData.monthly_price}
                    onChange={(e) => setFormData({ ...formData, monthly_price: parseInt(e.target.value) || 0 })}
                    placeholder="250000"
                  />
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Limite de mensajes IA</label>
                  <input
                    className={`${b}__form-input`}
                    type="number"
                    value={formData.messages_limit}
                    onChange={(e) => setFormData({ ...formData, messages_limit: parseInt(e.target.value) || 0 })}
                    placeholder="5000"
                  />
                </div>
              </div>

              {/* Credentials section — ALWAYS visible */}
              <div className={`${b}__form-divider`} />
              <h4 className={`${b}__form-section`}>Credenciales de acceso</h4>

              {editingId ? (
                <>
                  <div className={`${b}__form-row`}>
                    <div className={`${b}__form-field`}>
                      <label className={`${b}__form-label`}>Usuario actual</label>
                      <input
                        className={`${b}__form-input`}
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="admin-alpelo"
                      />
                    </div>
                    <div className={`${b}__form-field`}>
                      <label className={`${b}__form-label`}>Nueva contrasena</label>
                      <div className={`${b}__form-password-wrap`}>
                        <input
                          className={`${b}__form-input`}
                          type={showNewPwd ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Dejar vacio para no cambiar"
                        />
                        <button
                          type="button"
                          className={`${b}__form-password-toggle`}
                          onClick={() => setShowNewPwd(!showNewPwd)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            {showNewPwd ? (
                              <>
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </>
                            ) : (
                              <>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </>
                            )}
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {credMsg && (
                    <div className={`${b}__form-msg ${b}__form-msg--${credMsg.type}`}>
                      {credMsg.text}
                    </div>
                  )}

                  <button
                    className={`${b}__form-btn-creds`}
                    onClick={handleSaveCredentials}
                    disabled={savingCreds}
                  >
                    {savingCreds ? 'Guardando...' : 'Actualizar credenciales'}
                  </button>
                </>
              ) : (
                <div className={`${b}__form-row`}>
                  <div className={`${b}__form-field`}>
                    <label className={`${b}__form-label`}>Usuario</label>
                    <input
                      className={`${b}__form-input`}
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="admin-nombre"
                      required
                    />
                  </div>
                  <div className={`${b}__form-field`}>
                    <label className={`${b}__form-label`}>Contrasena</label>
                    <input
                      className={`${b}__form-input`}
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Contrasena de acceso"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={`${b}__modal-footer`}>
              <button className={`${b}__modal-btn ${b}__modal-btn--cancel`} onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className={`${b}__modal-btn ${b}__modal-btn--save`} onClick={handleSave}>
                {editingId ? 'Guardar cambios' : 'Crear agencia'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DevTenants;
