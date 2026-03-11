import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-tenants';

const PLAN_CONFIG = {
  trial: { label: 'Trial', color: '#9CA3AF', limit: 500 },
  basic: { label: 'Basico', color: '#3B82F6', limit: 2000 },
  pro: { label: 'Pro', color: '#2D5A3D', limit: 5000 },
  premium: { label: 'Premium', color: '#D4AF37', limit: 15000 },
};

const EMPTY_TENANT = {
  name: '',
  slug: '',
  business_type: 'peluqueria',
  owner_name: '',
  owner_phone: '',
  owner_email: '',
  plan: 'pro',
  messages_limit: 5000,
  ai_name: 'Lina',
  city: '',
  country: 'CO',
};

const DevTenants = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_TENANT });
  const [editingId, setEditingId] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/tenants`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTenants(data);
    } catch {
      // Mock data while endpoint doesn't exist
      setTenants([
        {
          id: 1,
          slug: 'alpelo',
          name: 'AlPelo Peluqueria',
          business_type: 'peluqueria',
          owner_name: 'Jaime',
          owner_phone: '+573001234567',
          owner_email: 'jaime@alpelo.co',
          plan: 'pro',
          messages_used: 347,
          messages_limit: 5000,
          ai_name: 'Lina',
          ai_is_paused: false,
          is_active: true,
          city: 'Bucaramanga',
          country: 'CO',
          created_at: '2026-01-15T10:00:00',
          total_clients: 156,
          total_staff: 18,
          wa_phone_display: '+57 300 123 4567',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const handleOpenCreate = () => {
    setFormData({ ...EMPTY_TENANT });
    setEditingId(null);
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
      plan: tenant.plan,
      messages_limit: tenant.messages_limit,
      ai_name: tenant.ai_name || 'Lina',
      city: tenant.city || '',
      country: tenant.country || 'CO',
    });
    setEditingId(tenant.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    // TODO: API call to create/update tenant
    setShowForm(false);
    fetchTenants();
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

  const getUsagePercent = (t) => t.messages_limit > 0 ? Math.round((t.messages_used / t.messages_limit) * 100) : 0;

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

      {/* Tenant Cards */}
      <div className={`${b}__grid`}>
        {tenants.map((t) => {
          const pct = getUsagePercent(t);
          const planCfg = PLAN_CONFIG[t.plan] || PLAN_CONFIG.pro;
          return (
            <div key={t.id} className={`${b}__card ${!t.is_active ? `${b}__card--suspended` : ''}`}>
              <div className={`${b}__card-header`}>
                <div className={`${b}__card-title-row`}>
                  <h3 className={`${b}__card-name`}>{t.name}</h3>
                  <span className={`${b}__card-slug`}>/{t.slug}</span>
                </div>
                <span className={`${b}__card-plan`} style={{ '--plan-color': planCfg.color }}>
                  {planCfg.label}
                </span>
              </div>

              {/* Usage bar */}
              <div className={`${b}__card-usage`}>
                <div className={`${b}__card-usage-header`}>
                  <span>Mensajes IA</span>
                  <span className={`${b}__card-usage-count`}>
                    {t.messages_used.toLocaleString('es-CO')} / {t.messages_limit.toLocaleString('es-CO')}
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
                  <label className={`${b}__form-label`}>Slug (URL)</label>
                  <input
                    className={`${b}__form-input`}
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
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
                  <label className={`${b}__form-label`}>Plan</label>
                  <select
                    className={`${b}__form-select`}
                    value={formData.plan}
                    onChange={(e) => {
                      const plan = e.target.value;
                      setFormData({ ...formData, plan, messages_limit: PLAN_CONFIG[plan]?.limit || 5000 });
                    }}
                  >
                    <option value="trial">Trial (500 msgs)</option>
                    <option value="basic">Basico (2,000 msgs)</option>
                    <option value="pro">Pro (5,000 msgs)</option>
                    <option value="premium">Premium (15,000 msgs)</option>
                  </select>
                </div>
              </div>

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
