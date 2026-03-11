import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-tenants';

const EMPTY_TENANT = {
  name: '',
  slug: '',
  business_type: 'peluqueria',
  owner_name: '',
  owner_phone: '',
  owner_email: '',
  messages_limit: 5000,
  ai_name: 'Lina',
  city: '',
  country: 'CO',
  wa_phone_number_id: '',
  wa_business_account_id: '',
  wa_access_token: '',
  wa_webhook_token: '',
  wa_phone_display: '',
  admin_username: '',
  admin_password: '',
};

const generatePassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const DevTenants = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_TENANT });
  const [editingId, setEditingId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showPasswordCreate, setShowPasswordCreate] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState(false);

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

  const handleOpenCreate = () => {
    const password = generatePassword();
    setFormData({ ...EMPTY_TENANT, admin_password: password });
    setEditingId(null);
    setShowPasswordCreate(false);
    setShowForm(true);
  };

  const handleOpenEdit = (tenant) => {
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      business_type: tenant.business_type,
      owner_name: tenant.owner_name || '',
      owner_phone: tenant.owner_phone || '',
      owner_email: tenant.owner_email || '',
      messages_limit: tenant.messages_limit,
      ai_name: tenant.ai_name || 'Lina',
      city: tenant.city || '',
      country: tenant.country || 'CO',
      wa_phone_number_id: tenant.wa_phone_number_id || '',
      wa_business_account_id: tenant.wa_business_account_id || '',
      wa_access_token: tenant.wa_access_token || '',
      wa_webhook_token: tenant.wa_webhook_token || '',
      wa_phone_display: tenant.wa_phone_display || '',
      admin_username: '',
      admin_password: '',
    });
    setEditingId(tenant.id);
    setShowForm(true);
  };

  const handleSlugFromName = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name) => {
    const updates = { name };
    if (!editingId) {
      const slug = handleSlugFromName(name);
      updates.slug = slug;
      updates.admin_username = slug ? `admin-${slug}` : '';
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSlugChange = (slug) => {
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const updates = { slug: clean };
    if (!editingId) {
      updates.admin_username = clean ? `admin-${clean}` : '';
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    try {
      const url = editingId
        ? `${API_URL}/dev/tenants/${editingId}`
        : `${API_URL}/dev/tenants`;
      const method = editingId ? 'PUT' : 'POST';

      const payload = { ...formData };
      if (!payload.slug && payload.name) {
        payload.slug = handleSlugFromName(payload.name);
      }

      // Don't send admin credentials on edit
      if (editingId) {
        delete payload.admin_username;
        delete payload.admin_password;
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

      const result = await res.json().catch(() => ({}));

      setShowForm(false);

      if (!editingId) {
        // Show success modal with credentials
        setSuccessData({
          name: result.name || payload.name,
          slug: result.slug || payload.slug,
          admin_username: result.admin_username || payload.admin_username,
          admin_password: result.admin_password || payload.admin_password,
        });
        setCopied(false);
      }

      fetchTenants();
    } catch {
      alert('Error de conexion');
    }
  };

  const handleCopyCredentials = async () => {
    if (!successData) return;
    const text = `Agencia: ${successData.name}\nSlug: ${successData.slug}\nUsuario: ${successData.admin_username}\nContrasena: ${successData.admin_password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleAI = async (tenant) => {
    setActionLoading(`ai-${tenant.id}`);
    try {
      await fetch(`${API_URL}/dev/tenants/${tenant.id}/toggle-ai`, {
        method: 'POST',
        credentials: 'include',
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
        method: 'POST',
        credentials: 'include',
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
        method: 'POST',
        credentials: 'include',
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
        <div className={`${b}__header`}>
          <h1 className={`${b}__title`}>Agencias</h1>
        </div>
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
                    <span className={`${b}__card-slug`}>/{t.slug}</span>
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
                      {(t.messages_used || 0).toLocaleString('es-CO')} / {t.messages_limit.toLocaleString('es-CO')}
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
                    <span className={`${b}__card-info-label`}>Clientes</span>
                    <span className={`${b}__card-info-value`}>{t.total_clients || 0}</span>
                  </div>
                  <div className={`${b}__card-info-item`}>
                    <span className={`${b}__card-info-label`}>Equipo</span>
                    <span className={`${b}__card-info-value`}>{t.total_staff || 0}</span>
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
                  <button
                    className={`${b}__card-btn ${b}__card-btn--edit`}
                    onClick={() => handleOpenEdit(t)}
                    title="Editar"
                  >
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
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ej: AlPelo Peluqueria"
                  />
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Slug (URL)</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="alpelo"
                    disabled={!!editingId}
                  />
                </div>
              </div>

              <div className={`${b}__form-row`}>
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
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Ciudad</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Bucaramanga"
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

              {/* AI config */}
              <div className={`${b}__form-divider`} />
              <h4 className={`${b}__form-section`}>Configuracion IA</h4>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Nombre de la IA</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.ai_name}
                    onChange={(e) => setFormData({ ...formData, ai_name: e.target.value })}
                    placeholder="Lina"
                  />
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Limite de mensajes</label>
                  <input
                    className={`${b}__form-input`}
                    type="number"
                    value={formData.messages_limit}
                    onChange={(e) => setFormData({ ...formData, messages_limit: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* WhatsApp config */}
              <div className={`${b}__form-divider`} />
              <h4 className={`${b}__form-section`}>Configuracion WhatsApp</h4>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Phone Number ID</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.wa_phone_number_id}
                    onChange={(e) => setFormData({ ...formData, wa_phone_number_id: e.target.value })}
                    placeholder="1061738603687334"
                  />
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Business Account ID</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.wa_business_account_id}
                    onChange={(e) => setFormData({ ...formData, wa_business_account_id: e.target.value })}
                    placeholder="1488407832803597"
                  />
                </div>
              </div>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Numero visible</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.wa_phone_display}
                    onChange={(e) => setFormData({ ...formData, wa_phone_display: e.target.value })}
                    placeholder="+57 300 123 4567"
                  />
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Webhook Verify Token</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.wa_webhook_token}
                    onChange={(e) => setFormData({ ...formData, wa_webhook_token: e.target.value })}
                    placeholder="alpelo_webhook_2026"
                  />
                </div>
              </div>

              <div className={`${b}__form-field`}>
                <label className={`${b}__form-label`}>Access Token</label>
                <textarea
                  className={`${b}__form-textarea`}
                  value={formData.wa_access_token}
                  onChange={(e) => setFormData({ ...formData, wa_access_token: e.target.value })}
                  placeholder="EAAxxxxxxx..."
                  rows={3}
                />
              </div>

              {/* Admin credentials — only on create */}
              {!editingId && (
                <>
                  <div className={`${b}__form-divider`} />
                  <h4 className={`${b}__form-section`}>Credenciales de admin</h4>
                  <p className={`${b}__form-note`}>Estas credenciales se generan al crear la agencia</p>

                  <div className={`${b}__form-row`}>
                    <div className={`${b}__form-field`}>
                      <label className={`${b}__form-label`}>Usuario</label>
                      <input
                        className={`${b}__form-input`}
                        value={formData.admin_username}
                        onChange={(e) => setFormData({ ...formData, admin_username: e.target.value })}
                        placeholder="admin-alpelo"
                      />
                    </div>
                    <div className={`${b}__form-field`}>
                      <label className={`${b}__form-label`}>Contrasena</label>
                      <div className={`${b}__form-password-wrap`}>
                        <input
                          className={`${b}__form-input`}
                          type={showPasswordCreate ? 'text' : 'password'}
                          value={formData.admin_password}
                          onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                          placeholder="Contrasena"
                        />
                        <button
                          type="button"
                          className={`${b}__form-password-toggle`}
                          onClick={() => setShowPasswordCreate(!showPasswordCreate)}
                          title={showPasswordCreate ? 'Ocultar' : 'Mostrar'}
                        >
                          {showPasswordCreate ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
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

      {/* Success Modal */}
      {successData && (
        <div className={`${b}__modal-overlay`} onClick={() => setSuccessData(null)}>
          <div className={`${b}__success-modal`} onClick={(e) => e.stopPropagation()}>
            <div className={`${b}__success-icon`}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2D5A3D" strokeWidth="2" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 className={`${b}__success-title`}>Agencia creada exitosamente</h3>
            <p className={`${b}__success-name`}>{successData.name}</p>

            <div className={`${b}__success-credentials`}>
              <div className={`${b}__success-cred-row`}>
                <span className={`${b}__success-cred-label`}>Usuario</span>
                <span className={`${b}__success-cred-value`}>{successData.admin_username}</span>
              </div>
              <div className={`${b}__success-cred-row`}>
                <span className={`${b}__success-cred-label`}>Contrasena</span>
                <span className={`${b}__success-cred-value`}>{successData.admin_password}</span>
              </div>
            </div>

            <div className={`${b}__success-actions`}>
              <button className={`${b}__success-btn ${b}__success-btn--copy`} onClick={handleCopyCredentials}>
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copiar credenciales
                  </>
                )}
              </button>
              <button className={`${b}__success-btn ${b}__success-btn--close`} onClick={() => setSuccessData(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevTenants;
