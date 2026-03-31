import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-tenants';

const formatCOP = (v) => `$${Number(v || 0).toLocaleString('es-CO')}`;

const PLANS = {
  starter: { name: 'Starter', price: 190000, messages: 1000, automations: 10, color: '#3B82F6' },
  pro: { name: 'Pro', price: 390000, messages: 3000, automations: 25, color: '#8B5CF6' },
  business: { name: 'Business', price: 590000, messages: 5000, automations: 50, color: '#F59E0B' },
  custom: { name: 'Custom', price: 0, messages: 0, automations: 999, color: '#94A3B8' },
};

const RECARGAS = [
  { id: 'recarga_500', name: '500 mensajes', messages: 500, price: 50000 },
  { id: 'recarga_1500', name: '1,500 mensajes', messages: 1500, price: 120000 },
];

const COUNTRIES = [
  { code: 'CO', name: 'Colombia', prefix: '+57', flag: '🇨🇴', phoneMask: '(###) ###-####' },
  { code: 'VE', name: 'Venezuela', prefix: '+58', flag: '🇻🇪', phoneMask: '(###) ###-####' },
  { code: 'PE', name: 'Peru', prefix: '+51', flag: '🇵🇪', phoneMask: '(###) ###-###' },
  { code: 'EC', name: 'Ecuador', prefix: '+593', flag: '🇪🇨', phoneMask: '(##) ###-####' },
  { code: 'CL', name: 'Chile', prefix: '+56', flag: '🇨🇱', phoneMask: '(#) ####-####' },
  { code: 'AR', name: 'Argentina', prefix: '+54', flag: '🇦🇷', phoneMask: '(##) ####-####' },
  { code: 'BR', name: 'Brasil', prefix: '+55', flag: '🇧🇷', phoneMask: '(##) #####-####' },
  { code: 'BO', name: 'Bolivia', prefix: '+591', flag: '🇧🇴', phoneMask: '(#) ###-####' },
  { code: 'GT', name: 'Guatemala', prefix: '+502', flag: '🇬🇹', phoneMask: '(####) ####' },
  { code: 'UY', name: 'Uruguay', prefix: '+598', flag: '🇺🇾', phoneMask: '(##) ###-###' },
  { code: 'PA', name: 'Panama', prefix: '+507', flag: '🇵🇦', phoneMask: '(####) ####' },
  { code: 'PY', name: 'Paraguay', prefix: '+595', flag: '🇵🇾', phoneMask: '(###) ###-###' },
  { code: 'MX', name: 'Mexico', prefix: '+52', flag: '🇲🇽', phoneMask: '(##) ####-####' },
  { code: 'CR', name: 'Costa Rica', prefix: '+506', flag: '🇨🇷', phoneMask: '(####) ####' },
  { code: 'DO', name: 'Rep. Dominicana', prefix: '+1', flag: '🇩🇴', phoneMask: '(###) ###-####' },
  { code: 'US', name: 'Estados Unidos', prefix: '+1', flag: '🇺🇸', phoneMask: '(###) ###-####' },
  { code: 'ES', name: 'Espana', prefix: '+34', flag: '🇪🇸', phoneMask: '(###) ###-###' },
];

const formatPhone = (raw, countryCode) => {
  const digits = (raw || '').replace(/\D/g, '');
  const country = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
  const mask = country.phoneMask;
  let result = '';
  let di = 0;
  for (let i = 0; i < mask.length && di < digits.length; i++) {
    if (mask[i] === '#') {
      result += digits[di++];
    } else {
      result += mask[i];
    }
  }
  return result;
};

const displayPhone = (raw, countryCode) => {
  if (!raw) return '';
  const country = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
  const formatted = formatPhone(raw, countryCode);
  return `${country.prefix} ${formatted}`;
};

const BUSINESS_TYPES = [
  'peluqueria', 'barberia', 'spa', 'centro_estetico', 'clinica', 'odontologia',
  'fisioterapia', 'psicologia', 'veterinaria', 'nutricion',
  'gimnasio', 'academia', 'yoga_pilates',
  'restaurante', 'hotel',
  'tatuajes', 'estudio_foto', 'taller_mecanico', 'lavanderia', 'consultoria', 'otro',
];

const EMPTY_TENANT = {
  name: '', business_type: 'peluqueria', owner_name: '', owner_phone: '',
  owner_email: '', city: 'Bucaramanga', country: 'CO', plan: 'starter',
  monthly_price: 190000, messages_limit: 1500,
  booking_enabled: false, booking_tagline: '',
};

const DevTenants = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('active-first'); // active-first, name, plan, messages, newest, oldest
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_TENANT });
  const [editingId, setEditingId] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [credMsg, setCredMsg] = useState(null);
  const [savingCreds, setSavingCreds] = useState(false);
  const [tenantAdmins, setTenantAdmins] = useState([]);
  const [resetPwId, setResetPwId] = useState(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [showRecarga, setShowRecarga] = useState(null);
  const [customRecarga, setCustomRecarga] = useState('');

  const apiFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error');
    }
    return res.json();
  }, []);

  const fetchTenants = useCallback(async () => {
    try { setTenants(await apiFetch('/dev/tenants')); } catch { setTenants([]); }
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handlePlanChange = (planKey) => {
    const plan = PLANS[planKey];
    setFormData((f) => ({ ...f, plan: planKey, monthly_price: plan.price, messages_limit: plan.messages }));
  };

  const handleOpenCreate = () => {
    setFormData({ ...EMPTY_TENANT }); setEditingId(null);
    setAdminUsername(''); setAdminPassword(''); setCredMsg(null); setShowForm(true);
  };

  const handleOpenEdit = (t) => {
    setFormData({
      name: t.name, business_type: t.business_type || 'peluqueria',
      owner_name: t.owner_name || '', owner_phone: t.owner_phone || '',
      owner_email: t.owner_email || '', city: t.city || '', country: t.country || 'CO',
      plan: t.plan || 'starter', monthly_price: t.monthly_price || 0,
      messages_limit: t.messages_limit || 5000,
      booking_enabled: !!t.booking_enabled, booking_tagline: t.booking_tagline || '',
      slug: t.slug || '',
    });
    setEditingId(t.id); setAdminUsername(t.admin_user?.username || '');
    setNewPassword(''); setCredMsg(null); setTenantAdmins([]); setResetPwId(null);
    setShowForm(true);
    // Load admins list
    apiFetch(`/dev/tenants/${t.id}/admins`).then(d => setTenantAdmins(d.admins || [])).catch(() => {});
  };

  const handleSave = async () => {
    setActionLoading('save');
    try {
      if (editingId) {
        await apiFetch(`/dev/tenants/${editingId}`, { method: 'PUT', body: JSON.stringify(formData) });
      } else {
        await apiFetch('/dev/tenants', {
          method: 'POST',
          body: JSON.stringify({ ...formData, slug: slugify(formData.name), admin_username: adminUsername, admin_password: adminPassword }),
        });
      }
      setShowForm(false); fetchTenants();
    } catch (err) { setCredMsg({ type: 'error', text: err.message }); }
    setActionLoading('');
  };

  const handleSaveCredentials = async () => {
    if (!editingId) return;
    setSavingCreds(true); setCredMsg(null);
    try {
      const body = { username: adminUsername };
      if (newPassword) body.password = newPassword;
      await apiFetch(`/dev/tenants/${editingId}/admin-credentials`, { method: 'PUT', body: JSON.stringify(body) });
      setCredMsg({ type: 'success', text: 'Credenciales actualizadas' }); fetchTenants();
    } catch (err) { setCredMsg({ type: 'error', text: err.message }); }
    setSavingCreds(false);
  };

  const handleToggleAdmin = async (adminId) => {
    try {
      const res = await apiFetch(`/dev/tenants/${editingId}/admins/${adminId}/toggle`, { method: 'PUT' });
      setTenantAdmins(prev => prev.map(a => a.id === adminId ? { ...a, is_active: res.is_active } : a));
      setCredMsg({ type: 'success', text: res.is_active ? 'Admin activado' : 'Admin desactivado — sesión cerrada' });
    } catch (err) { setCredMsg({ type: 'error', text: err.message }); }
  };

  const handleResetAdminPw = async (adminId) => {
    if (!resetPwValue || resetPwValue.length < 6) { setCredMsg({ type: 'error', text: 'Mínimo 6 caracteres' }); return; }
    try {
      await apiFetch(`/dev/tenants/${editingId}/admins/${adminId}/password`, { method: 'PUT', body: JSON.stringify({ password: resetPwValue }) });
      setCredMsg({ type: 'success', text: 'Contraseña actualizada — sesión cerrada' });
      setResetPwId(null); setResetPwValue('');
    } catch (err) { setCredMsg({ type: 'error', text: err.message }); }
  };

  const handleToggleAI = async (id, current) => {
    setActionLoading(`ai-${id}`);
    try { await apiFetch(`/dev/tenants/${id}/toggle-ai`, { method: 'POST', body: JSON.stringify({ paused: !current }) }); fetchTenants(); } catch { /* */ }
    setActionLoading('');
  };

  const handleRecarga = async (tenantId, recarga) => {
    setActionLoading(`recarga-${tenantId}`);
    try { await apiFetch(`/dev/tenants/${tenantId}/add-messages`, { method: 'POST', body: JSON.stringify({ amount: recarga.messages }) }); setShowRecarga(null); setCustomRecarga(''); fetchTenants(); } catch { /* */ }
    setActionLoading('');
  };

  const handleCustomRecarga = async (tenantId) => {
    const amount = parseInt(customRecarga);
    if (!amount || amount <= 0) return;
    setActionLoading(`recarga-${tenantId}`);
    try { await apiFetch(`/dev/tenants/${tenantId}/add-messages`, { method: 'POST', body: JSON.stringify({ amount }) }); setShowRecarga(null); setCustomRecarga(''); fetchTenants(); } catch { /* */ }
    setActionLoading('');
  };

  const handleToggleActive = async (id, current) => {
    setActionLoading(`active-${id}`);
    try { await apiFetch(`/dev/tenants/${id}/toggle-active`, { method: 'POST', body: JSON.stringify({ active: !current }) }); fetchTenants(); } catch { /* */ }
    setActionLoading('');
  };

  const filteredTenants = (() => {
    let list = searchQuery.trim().length < 2 ? [...tenants] : tenants.filter(t => {
      const q = searchQuery.toLowerCase();
      return [t.name, t.slug, t.owner_name, t.owner_phone, t.owner_email, t.city, t.plan, t.business_type]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });

    const planOrder = { business: 0, pro: 1, starter: 2, trial: 3, custom: 4 };

    list.sort((a, b) => {
      switch (sortBy) {
        case 'active-first': {
          // Active + IA on first, then active + IA off, then inactive
          const scoreA = (a.is_active ? 0 : 2) + (a.ai_is_paused ? 1 : 0);
          const scoreB = (b.is_active ? 0 : 2) + (b.ai_is_paused ? 1 : 0);
          if (scoreA !== scoreB) return scoreA - scoreB;
          return (a.name || '').localeCompare(b.name || '');
        }
        case 'name': return (a.name || '').localeCompare(b.name || '');
        case 'plan': return (planOrder[a.plan] ?? 9) - (planOrder[b.plan] ?? 9);
        case 'messages': return (b.messages_used || 0) - (a.messages_used || 0);
        case 'newest': return (b.id || 0) - (a.id || 0);
        case 'oldest': return (a.id || 0) - (b.id || 0);
        default: return 0;
      }
    });

    return list;
  })();

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Agencias</h1></div>
        <p className={`${b}__loading`}>Cargando agencias...</p>
      </div>
    );
  }

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Agencias</h1>
          <p className={`${b}__subtitle`}>{searchQuery ? `${filteredTenants.length} de ${tenants.length}` : tenants.length} negocios registrados</p>
        </div>
        <button className={`${b}__create-btn`} onClick={handleOpenCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva agencia
        </button>
      </div>

      {/* Search Bar */}
      <div className={`${b}__search`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, slug, dueño, ciudad, plan..."
          className={`${b}__search-input`}
        />
        {searchQuery && (
          <button className={`${b}__search-clear`} onClick={() => setSearchQuery('')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      {/* Sort Filters */}
      <div className={`${b}__filters`}>
        {[
          { key: 'active-first', label: 'Activas primero' },
          { key: 'plan', label: 'Por plan' },
          { key: 'messages', label: 'Más uso IA' },
          { key: 'name', label: 'Nombre A-Z' },
          { key: 'newest', label: 'Más recientes' },
          { key: 'oldest', label: 'Más antiguas' },
        ].map(f => (
          <button
            key={f.key}
            className={`${b}__filter-btn ${sortBy === f.key ? `${b}__filter-btn--active` : ''}`}
            onClick={() => setSortBy(f.key)}
          >{f.label}</button>
        ))}
      </div>

      {/* Tenant Cards */}
      <div className={`${b}__grid`}>
        {filteredTenants.map((t) => {
          const planInfo = PLANS[t.plan] || PLANS.custom;
          const usagePct = t.messages_limit > 0 ? Math.round((t.messages_used / t.messages_limit) * 100) : 0;
          const daysLeft = t.days_remaining;

          return (
            <div key={t.id} className={`${b}__card ${!t.is_active ? `${b}__card--suspended` : ''}`}>
              <div className={`${b}__card-top`}>
                <div className={`${b}__card-name-row`}>
                  <h3 className={`${b}__card-name`}>{t.name}</h3>
                  <span className={`${b}__plan-badge`} style={{ background: `${planInfo.color}15`, color: planInfo.color, borderColor: `${planInfo.color}30` }}>
                    {planInfo.name}
                  </span>
                </div>
                <span className={`${b}__card-slug`}>{t.slug}</span>
              </div>

              <div className={`${b}__usage`}>
                <div className={`${b}__usage-header`}>
                  <span className={`${b}__usage-label`}>Mensajes IA</span>
                  <span className={`${b}__usage-count`}>{(t.messages_used || 0).toLocaleString('es-CO')} / {(t.messages_limit || 0).toLocaleString('es-CO')}</span>
                </div>
                <div className={`${b}__usage-track`}>
                  <div className={`${b}__usage-fill ${usagePct > 80 ? `${b}__usage-fill--warning` : ''} ${usagePct > 95 ? `${b}__usage-fill--critical` : ''}`} style={{ width: `${Math.min(usagePct, 100)}%` }} />
                </div>
                <div className={`${b}__usage-footer`}>
                  <span>{usagePct}% usado</span>
                  <button className={`${b}__recarga-btn`} onClick={() => setShowRecarga(showRecarga === t.id ? null : t.id)}>+ Recarga</button>
                </div>
                {showRecarga === t.id && (
                  <div className={`${b}__recarga-panel`}>
                    {RECARGAS.map((r) => (
                      <button key={r.id} className={`${b}__recarga-option`} onClick={() => handleRecarga(t.id, r)} disabled={actionLoading === `recarga-${t.id}`}>
                        <span>{r.name}</span>
                        <span className={`${b}__recarga-price`}>{formatCOP(r.price)}</span>
                      </button>
                    ))}
                    <div className={`${b}__recarga-custom`}>
                      <input
                        type="number"
                        className={`${b}__recarga-input`}
                        placeholder="Cantidad"
                        value={customRecarga}
                        onChange={(e) => setCustomRecarga(e.target.value)}
                        min="1"
                      />
                      <button
                        className={`${b}__recarga-custom-btn`}
                        onClick={() => handleCustomRecarga(t.id)}
                        disabled={!customRecarga || actionLoading === `recarga-${t.id}`}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className={`${b}__info-grid`}>
                <div className={`${b}__info-item`}>
                  <span className={`${b}__info-label`}>Plan</span>
                  <span className={`${b}__info-value`}>{formatCOP(t.monthly_price)}/mes</span>
                </div>
                <div className={`${b}__info-item`}>
                  <span className={`${b}__info-label`}>Vence</span>
                  <span className={`${b}__info-value ${daysLeft != null && daysLeft <= 5 ? `${b}__info-value--warn` : ''}`}>
                    {daysLeft != null ? `${daysLeft} dias` : 'Sin fecha'}
                  </span>
                </div>
                <div className={`${b}__info-item`}>
                  <span className={`${b}__info-label`}>Clientes</span>
                  <span className={`${b}__info-value`}>{t.total_clients || 0}</span>
                </div>
                <div className={`${b}__info-item`}>
                  <span className={`${b}__info-label`}>Staff</span>
                  <span className={`${b}__info-value`}>{t.total_staff || 0}</span>
                </div>
              </div>

              {t.owner_name && (
                <div className={`${b}__owner`}>
                  <span>{t.owner_name}</span>
                  {t.owner_phone && <span className={`${b}__owner-phone`}>{displayPhone(t.owner_phone, t.country)}</span>}
                  {t.city && <span className={`${b}__owner-city`}>{t.city}</span>}
                </div>
              )}

              <div className={`${b}__actions`}>
                <button className={`${b}__action-btn`} onClick={() => handleOpenEdit(t)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  Editar
                </button>
                <button className={`${b}__action-btn ${t.ai_is_paused ? `${b}__action-btn--success` : `${b}__action-btn--warn`}`} onClick={() => handleToggleAI(t.id, t.ai_is_paused)} disabled={actionLoading === `ai-${t.id}`}>
                  {t.ai_is_paused ? 'Activar IA' : 'Pausar IA'}
                </button>
                <button className={`${b}__action-btn ${t.is_active ? `${b}__action-btn--danger` : `${b}__action-btn--success`}`} onClick={() => handleToggleActive(t.id, t.is_active)} disabled={actionLoading === `active-${t.id}`}>
                  {t.is_active ? 'Suspender' : 'Activar'}
                </button>
              </div>

              {/* Sedes / Locations */}
              <LocationsPanel tenantId={t.id} />

              <div className={`${b}__status-row`}>
                <span className={`${b}__status ${t.ai_is_paused ? `${b}__status--off` : `${b}__status--on`}`}>
                  IA {t.ai_is_paused ? 'Pausada' : 'Activa'}
                </span>
                <span className={`${b}__status ${t.is_active ? `${b}__status--on` : `${b}__status--off`}`}>
                  {t.is_active ? 'Activa' : 'Suspendida'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Form — Portal to body to escape overflow constraints */}
      {showForm && createPortal(
        <div className={`${b}__overlay`} onClick={() => setShowForm(false)}>
          <div className={`${b}__modal`} onClick={(e) => e.stopPropagation()}>
            <div className={`${b}__modal-header`}>
              <h2>{editingId ? 'Editar Agencia' : 'Nueva Agencia'}</h2>
              <button className={`${b}__modal-close`} onClick={() => setShowForm(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className={`${b}__modal-body`}>
              <div className={`${b}__form-section`}>
                <h3 className={`${b}__form-section-title`}>Informacion del negocio</h3>
                <div className={`${b}__form-grid`}>
                  <div className={`${b}__field`}><label>Nombre</label><input value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: AlPelo Peluqueria" /></div>
                  <div className={`${b}__field`}><label>Tipo</label><select value={formData.business_type} onChange={(e) => setFormData((f) => ({ ...f, business_type: e.target.value }))}>{BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>)}</select></div>
                  <div className={`${b}__field`}><label>Ciudad</label><input value={formData.city} onChange={(e) => setFormData((f) => ({ ...f, city: e.target.value }))} placeholder="Bucaramanga" /></div>
                </div>
              </div>

              <div className={`${b}__form-section`}>
                <h3 className={`${b}__form-section-title`}>Propietario</h3>
                <div className={`${b}__form-grid`}>
                  <div className={`${b}__field`}><label>Nombre</label><input value={formData.owner_name} onChange={(e) => setFormData((f) => ({ ...f, owner_name: e.target.value }))} /></div>
                  <div className={`${b}__field`}>
                    <label>Telefono</label>
                    <div className={`${b}__phone-row`}>
                      <div className={`${b}__phone-country-wrap`}>
                        <span className={`${b}__phone-country-display`}>
                          {(COUNTRIES.find((c) => c.code === formData.country) || COUNTRIES[0]).flag}{' '}
                          {(COUNTRIES.find((c) => c.code === formData.country) || COUNTRIES[0]).prefix}
                        </span>
                        <select
                          className={`${b}__phone-country`}
                          value={formData.country}
                          onChange={(e) => setFormData((f) => ({ ...f, country: e.target.value }))}
                        >
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.prefix})</option>
                          ))}
                        </select>
                      </div>
                      <input
                        className={`${b}__phone-input`}
                        value={formatPhone(formData.owner_phone, formData.country)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '');
                          setFormData((f) => ({ ...f, owner_phone: digits }));
                        }}
                        placeholder={COUNTRIES.find((c) => c.code === formData.country)?.phoneMask.replace(/#/g, '0') || '(300) 123-4567'}
                      />
                    </div>
                  </div>
                  <div className={`${b}__field`}><label>Email</label><input type="email" value={formData.owner_email} onChange={(e) => setFormData((f) => ({ ...f, owner_email: e.target.value }))} /></div>
                </div>
              </div>

              <div className={`${b}__form-section`}>
                <h3 className={`${b}__form-section-title`}>Plan & Paquete</h3>
                <div className={`${b}__plan-grid`}>
                  {Object.entries(PLANS).filter(([k]) => k !== 'custom').map(([key, plan]) => (
                    <button key={key} type="button" className={`${b}__plan-card ${formData.plan === key ? `${b}__plan-card--selected` : ''}`} onClick={() => handlePlanChange(key)} style={{ '--plan-color': plan.color }}>
                      <div className={`${b}__plan-card-glow`} />
                      <span className={`${b}__plan-card-name`}>{plan.name}</span>
                      <span className={`${b}__plan-card-price`}>{formatCOP(plan.price)}<small>/mes</small></span>
                      <span className={`${b}__plan-card-msgs`}>{plan.messages.toLocaleString('es-CO')} msgs IA · {plan.automations} auto.</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Booking Online ── */}
              <div className={`${b}__form-section`}>
                <h3 className={`${b}__form-section-title`}>Booking Online</h3>
                <div className={`${b}__form-grid`}>
                  <div className={`${b}__field`} style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!formData.booking_enabled} onChange={e => setFormData(f => ({ ...f, booking_enabled: e.target.checked }))} style={{ width: 18, height: 18, accentColor: '#10b981' }} />
                      <span>Pagina publica de reservas habilitada</span>
                    </label>
                  </div>
                  {formData.booking_enabled && (
                    <div className={`${b}__field`} style={{ gridColumn: '1 / -1' }}>
                      <label>Tagline (frase corta)</label>
                      <input value={formData.booking_tagline || ''} onChange={e => setFormData(f => ({ ...f, booking_tagline: e.target.value }))} placeholder="Ej: Descubre la excelencia en AlPelo!" maxLength={300} />
                    </div>
                  )}
                  {formData.booking_enabled && formData.slug && (
                    <div className={`${b}__field`} style={{ gridColumn: '1 / -1' }}>
                      <label>Link publico</label>
                      <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: 8, fontSize: '0.85rem', color: '#475569', wordBreak: 'break-all' }}>
                        {window.location.origin}{import.meta.env.BASE_URL || '/'}book/{formData.slug}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={`${b}__form-section`}>
                <h3 className={`${b}__form-section-title`}>{editingId ? 'Usuarios Admin' : 'Crear Admin'}</h3>

                {!editingId ? (
                  <div className={`${b}__form-grid`}>
                    <div className={`${b}__field`}><label>Usuario admin</label><input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="admin_alpelo" /></div>
                    <div className={`${b}__field`}><label>Contraseña</label><input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Min 6 caracteres" /></div>
                  </div>
                ) : (
                  <div className={`${b}__admin-list`}>
                    {tenantAdmins.length === 0 && <p style={{ color: '#94A3B8', fontSize: 13, padding: '8px 0' }}>Cargando admins...</p>}
                    {tenantAdmins.map(a => (
                      <div key={a.id} className={`${b}__admin-row ${!a.is_active ? `${b}__admin-row--inactive` : ''}`}>
                        <div className={`${b}__admin-info`}>
                          <div className={`${b}__admin-avatar`} style={{ background: a.is_active ? '#3B82F6' : '#94A3B8' }}>
                            {a.username?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className={`${b}__admin-username`}>{a.username}</span>
                            <span className={`${b}__admin-meta`}>
                              {a.name || 'Sin nombre'} · {a.email || 'Sin email'}
                              {a.last_session && ` · Última sesión: ${new Date(a.last_session).toLocaleDateString('es-CO')}`}
                            </span>
                          </div>
                        </div>
                        <div className={`${b}__admin-actions`}>
                          {resetPwId === a.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="password" value={resetPwValue} onChange={e => setResetPwValue(e.target.value)} placeholder="Nueva contraseña" style={{ height: 32, fontSize: 12, padding: '0 10px', borderRadius: 6, border: '1px solid #e2e8f0', width: 150 }} />
                              <button className={`${b}__cred-btn`} onClick={() => handleResetAdminPw(a.id)} style={{ padding: '4px 10px', fontSize: 11 }}>Guardar</button>
                              <button className={`${b}__cred-btn`} onClick={() => { setResetPwId(null); setResetPwValue(''); }} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', color: '#94A3B8' }}>✕</button>
                            </div>
                          ) : (
                            <button className={`${b}__cred-btn`} onClick={() => { setResetPwId(a.id); setResetPwValue(''); }} style={{ padding: '4px 10px', fontSize: 11 }}>Cambiar contraseña</button>
                          )}
                          <button
                            className={`${b}__cred-btn`}
                            onClick={() => handleToggleAdmin(a.id)}
                            style={{ padding: '4px 10px', fontSize: 11, background: a.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', color: a.is_active ? '#EF4444' : '#10B981', border: `1px solid ${a.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}` }}
                          >
                            {a.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {credMsg && <div className={`${b}__msg ${b}__msg--${credMsg.type}`}>{credMsg.text}</div>}
            </div>

            <div className={`${b}__modal-footer`}>
              <button className={`${b}__btn-cancel`} onClick={() => setShowForm(false)}>Cancelar</button>
              <button className={`${b}__btn-save`} onClick={handleSave} disabled={actionLoading === 'save'}>{actionLoading === 'save' ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear agencia'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ════════════════════════════════════════════
// LOCATIONS PANEL — Manage sedes per tenant
// ════════════════════════════════════════════
function LocationsPanel({ tenantId }) {
  const [locations, setLocations] = useState([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddr, setNewAddr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/tenants/${tenantId}/locations`, { credentials: 'include' });
      if (res.ok) setLocations(await res.json());
    } catch {}
  }, [tenantId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/dev/tenants/${tenantId}/locations`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, address: newAddr }),
      });
      if (res.ok) { setNewName(''); setNewAddr(''); setAdding(false); load(); }
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (locId) => {
    try {
      await fetch(`${API_URL}/dev/locations/${locId}`, { method: 'DELETE', credentials: 'include' });
      load();
    } catch {}
  };

  return (
    <div className={`${b}__locations`}>
      <div className={`${b}__locations-header`}>
        <button className={`${b}__locations-toggle`} onClick={() => setOpen(!open)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <span>Sedes</span>
          <span className={`${b}__locations-count`}>{locations.length}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {open && !adding && (
          <button className={`${b}__locations-add-btn`} onClick={() => setAdding(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Nueva sede
          </button>
        )}
      </div>

      {open && (
        <div className={`${b}__locations-body`}>
          {/* Existing locations */}
          {locations.length === 0 && !adding && (
            <div className={`${b}__locations-empty`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span>Sin sedes configuradas</span>
            </div>
          )}

          {locations.map(loc => (
            <div key={loc.id} className={`${b}__location-card`}>
              <div className={`${b}__location-pin`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" opacity="0.6">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <div className={`${b}__location-data`}>
                <div className={`${b}__location-name`}>
                  {loc.name}
                  {loc.is_default && <span className={`${b}__location-badge`}>Principal</span>}
                </div>
                <div className={`${b}__location-details`}>
                  {loc.address && <span>{loc.address}</span>}
                  <span>{loc.staff_count} staff</span>
                  <span>{loc.appointments_count} citas</span>
                  <span>{loc.opening_time || '08:00'} - {loc.closing_time || '19:00'}</span>
                </div>
              </div>
              <button
                className={`${b}__location-toggle-btn ${loc.is_active ? `${b}__location-toggle-btn--on` : ''}`}
                onClick={async () => {
                  try {
                    await fetch(`${API_URL}/dev/locations/${loc.id}`, {
                      method: 'PUT', credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ is_active: !loc.is_active }),
                    });
                    load();
                  } catch {}
                }}
                title={loc.is_active ? 'Desactivar sede' : 'Activar sede'}
              >
                <span className={`${b}__location-toggle-track`}>
                  <span className={`${b}__location-toggle-knob`} />
                </span>
                <span>{loc.is_active ? 'Activa' : 'Inactiva'}</span>
              </button>
            </div>
          ))}

          {/* Create form */}
          {adding && (
            <div className={`${b}__location-create`}>
              <h4 className={`${b}__location-create-title`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Nueva sede
              </h4>
              <div className={`${b}__location-create-fields`}>
                <div className={`${b}__location-field`}>
                  <label>Nombre de la sede *</label>
                  <input placeholder="Ej: Sede Norte, Sucursal Centro..." value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div className={`${b}__location-field`}>
                  <label>Dirección</label>
                  <input placeholder="Ej: Cra 33 #48-20, Bucaramanga" value={newAddr} onChange={e => setNewAddr(e.target.value)} />
                </div>
              </div>
              <div className={`${b}__location-create-actions`}>
                <button className={`${b}__location-create-btn`} onClick={handleCreate} disabled={saving || !newName.trim()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  {saving ? 'Creando...' : 'Crear sede'}
                </button>
                <button className={`${b}__location-cancel-btn`} onClick={() => { setAdding(false); setNewName(''); setNewAddr(''); }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DevTenants;
