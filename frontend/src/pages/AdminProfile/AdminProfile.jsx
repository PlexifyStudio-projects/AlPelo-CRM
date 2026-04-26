import { useState, useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const API_BASE = `${API_URL}/auth`;

const AdminProfile = ({ user, onUpdate }) => {
  const b = 'admin-profile';
  const { addNotification } = useNotification();
  const { tenant, refreshTenant } = useTenant();

  const [bizForm, setBizForm] = useState({ name: '', address: '', city: '' });
  const [bizSaving, setBizSaving] = useState(false);

  useEffect(() => {
    setBizForm({
      name: tenant?.name || '',
      address: tenant?.address || '',
      city: tenant?.city || '',
    });
  }, [tenant?.name, tenant?.address, tenant?.city]);

  const handleBizChange = (e) => {
    const { name, value } = e.target;
    setBizForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    setBizSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings/booking`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bizForm),
      });
      if (!res.ok) throw new Error('No se pudo guardar');
      addNotification?.('success', 'Información del negocio actualizada');
      if (refreshTenant) refreshTenant();
    } catch (err) {
      addNotification?.('error', err.message || 'Error al guardar');
    } finally {
      setBizSaving(false);
    }
  };

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    username: user?.username || '',
  });
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileData, setProfileData] = useState(null);

  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [changingPw, setChangingPw] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setProfileData(data);
          setForm({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            username: data.username || '',
          });
        }
      } catch {
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  const initials = (profileData?.name || user?.name || '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const getRoleName = (role) => {
    const roles = {
      admin: 'Administrador',
      dev: 'Desarrollador',
      super_admin: 'Super Admin',
      barber: 'Profesional',
      staff: 'Profesional',
    };
    return roles[role] || role;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getMemberDuration = (dateStr) => {
    if (!dateStr) return '';
    const created = new Date(dateStr);
    const now = new Date();
    const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    if (months < 1) return 'Menos de un mes';
    if (months === 1) return '1 mes';
    if (months < 12) return `${months} meses`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} ${years === 1 ? 'año' : 'años'}`;
    return `${years} ${years === 1 ? 'año' : 'años'} y ${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePwChange = (e) => {
    setPwForm({ ...pwForm, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Error al actualizar perfil');
      }

      const updated = await res.json();
      setProfileData(updated);
      onUpdate({
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        username: updated.username,
      });
      addNotification('Perfil actualizado correctamente', 'success');
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (pwForm.new_password !== pwForm.confirm_password) {
      addNotification('Las contraseñas no coinciden', 'error');
      return;
    }
    if (pwForm.new_password.length < 6) {
      addNotification('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    setChangingPw(true);
    try {
      const userId = profileData?.id || user?.id;
      const res = await fetch(`${API_BASE}/users/${userId}/password`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: pwForm.current_password,
          new_password: pwForm.new_password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Error al cambiar contraseña');
      }

      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      addNotification('Contraseña actualizada correctamente', 'success');
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setChangingPw(false);
    }
  };

  const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const EyeOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  const SkeletonLine = ({ width = '100%' }) => (
    <div className={`${b}__skeleton`} style={{ width }} />
  );

  if (loadingProfile) {
    return (
      <div className={b}>
        <div className={`${b}__header`}>
          <SkeletonLine width="200px" />
          <SkeletonLine width="280px" />
        </div>
        <div className={`${b}__layout`}>
          <div className={`${b}__sidebar`}>
            <div className={`${b}__avatar-card`}>
              <div className={`${b}__skeleton ${b}__skeleton--circle`} />
              <SkeletonLine width="140px" />
              <SkeletonLine width="100px" />
            </div>
          </div>
          <div className={`${b}__main`}>
            <div className={`${b}__panel`}>
              <SkeletonLine width="60%" />
              <SkeletonLine width="100%" />
              <SkeletonLine width="100%" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentData = profileData || user;

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h2 className={`${b}__title`}>Mi Perfil</h2>
        <p className={`${b}__subtitle`}>Gestiona tu cuenta, seguridad e informacion de sesion</p>
      </div>

      <div className={`${b}__layout`}>
        <div className={`${b}__sidebar`}>
          <div className={`${b}__avatar-card`}>
            <div className={`${b}__avatar`}>
              <div className={`${b}__avatar-ring`} />
              <span className={`${b}__avatar-initials`}>{initials}</span>
            </div>
            <h3 className={`${b}__user-name`}>{currentData?.name || 'Admin'}</h3>
            <span className={`${b}__user-role`}>
              {getRoleName(currentData?.role)}
            </span>

            {currentData?.created_at && (
              <div className={`${b}__member-since`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Miembro desde {formatDate(currentData.created_at)}</span>
              </div>
            )}

            <div className={`${b}__user-meta`}>
              <div className={`${b}__meta-item`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span>{currentData?.email || '-'}</span>
              </div>
              <div className={`${b}__meta-item`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>{currentData?.phone || '-'}</span>
              </div>
              <div className={`${b}__meta-item`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>@{currentData?.username || '-'}</span>
              </div>
            </div>

            {currentData?.created_at && (
              <div className={`${b}__member-duration`}>
                {getMemberDuration(currentData.created_at)}
              </div>
            )}
          </div>
        </div>
        <div className={`${b}__main`}>
          <div className={`${b}__tabs`}>
            <button
              className={`${b}__tab ${activeTab === 'info' ? `${b}__tab--active` : ''}`}
              onClick={() => setActiveTab('info')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Informacion personal</span>
            </button>
            <button
              className={`${b}__tab ${activeTab === 'security' ? `${b}__tab--active` : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Seguridad</span>
            </button>
            <button
              className={`${b}__tab ${activeTab === 'business' ? `${b}__tab--active` : ''}`}
              onClick={() => setActiveTab('business')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
              </svg>
              <span>Mi Negocio</span>
            </button>
            <button
              className={`${b}__tab ${activeTab === 'session' ? `${b}__tab--active` : ''}`}
              onClick={() => setActiveTab('session')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Sesion</span>
            </button>
          </div>
          {activeTab === 'info' && (
            <div className={`${b}__panel`}>
              <div className={`${b}__panel-header`}>
                <h3 className={`${b}__panel-title`}>Informacion personal</h3>
                <p className={`${b}__panel-desc`}>Actualiza tu nombre, correo y datos de contacto</p>
              </div>

              <form className={`${b}__form`} onSubmit={handleSaveProfile}>
                <div className={`${b}__form-grid`}>
                  <div className={`${b}__field`}>
                    <label className={`${b}__label`}>Nombre completo</label>
                    <input
                      className={`${b}__input`}
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className={`${b}__field`}>
                    <label className={`${b}__label`}>Usuario</label>
                    <div className={`${b}__input-with-prefix`}>
                      <span className={`${b}__input-prefix`}>@</span>
                      <input
                        className={`${b}__input ${b}__input--prefixed`}
                        type="text"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className={`${b}__field`}>
                    <label className={`${b}__label`}>Correo electronico</label>
                    <input
                      className={`${b}__input`}
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className={`${b}__field`}>
                    <label className={`${b}__label`}>Telefono</label>
                    <input
                      className={`${b}__input`}
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className={`${b}__form-actions`}>
                  <button
                    type="submit"
                    className={`${b}__btn ${b}__btn--primary`}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className={`${b}__spinner`} />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Guardar cambios
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
          {activeTab === 'security' && (
            <div className={`${b}__panel`}>
              <div className={`${b}__panel-header`}>
                <h3 className={`${b}__panel-title`}>Cambiar contraseña</h3>
                <p className={`${b}__panel-desc`}>Asegurate de usar una contraseña segura de al menos 6 caracteres</p>
              </div>

              <form className={`${b}__form`} onSubmit={handleChangePassword}>
                <div className={`${b}__field`}>
                  <label className={`${b}__label`}>Contraseña actual</label>
                  <div className={`${b}__input-password`}>
                    <input
                      className={`${b}__input`}
                      type={showCurrentPw ? 'text' : 'password'}
                      name="current_password"
                      value={pwForm.current_password}
                      onChange={handlePwChange}
                      required
                    />
                    <button
                      type="button"
                      className={`${b}__pw-toggle`}
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                    >
                      {showCurrentPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div className={`${b}__field`}>
                  <label className={`${b}__label`}>Nueva contraseña</label>
                  <div className={`${b}__input-password`}>
                    <input
                      className={`${b}__input`}
                      type={showNewPw ? 'text' : 'password'}
                      name="new_password"
                      value={pwForm.new_password}
                      onChange={handlePwChange}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className={`${b}__pw-toggle`}
                      onClick={() => setShowNewPw(!showNewPw)}
                    >
                      {showNewPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div className={`${b}__field`}>
                  <label className={`${b}__label`}>Confirmar nueva contraseña</label>
                  <div className={`${b}__input-password`}>
                    <input
                      className={`${b}__input`}
                      type={showNewPw ? 'text' : 'password'}
                      name="confirm_password"
                      value={pwForm.confirm_password}
                      onChange={handlePwChange}
                      required
                      minLength={6}
                    />
                  </div>
                  {pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                    <span className={`${b}__field-error`}>Las contraseñas no coinciden</span>
                  )}
                </div>

                <div className={`${b}__form-actions`}>
                  <button
                    type="submit"
                    className={`${b}__btn ${b}__btn--primary`}
                    disabled={changingPw || (pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password)}
                  >
                    {changingPw ? (
                      <>
                        <span className={`${b}__spinner`} />
                        Actualizando...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Cambiar contraseña
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
          {activeTab === 'business' && (
            <div className={`${b}__panel`}>
              <div className={`${b}__panel-header`}>
                <h3 className={`${b}__panel-title`}>Información del negocio</h3>
                <p className={`${b}__panel-desc`}>Datos públicos que aparecen en tu sidebar y página de reservas</p>
              </div>
              <form className={`${b}__form`} onSubmit={handleSaveBusiness}>
                <div className={`${b}__form-grid`}>
                  <div className={`${b}__field`}>
                    <label className={`${b}__label`}>Nombre del negocio</label>
                    <input
                      className={`${b}__input`}
                      type="text"
                      name="name"
                      value={bizForm.name}
                      onChange={handleBizChange}
                      placeholder="Ej: AlPelo Peluquería"
                    />
                  </div>
                  <div className={`${b}__field`}>
                    <label className={`${b}__label`}>Ciudad</label>
                    <input
                      className={`${b}__input`}
                      type="text"
                      name="city"
                      value={bizForm.city}
                      onChange={handleBizChange}
                      placeholder="Bucaramanga"
                    />
                  </div>
                  <div className={`${b}__field ${b}__field--full`}>
                    <label className={`${b}__label`}>Dirección</label>
                    <input
                      className={`${b}__input`}
                      type="text"
                      name="address"
                      value={bizForm.address}
                      onChange={handleBizChange}
                      placeholder="Carrera 31 #50-21"
                    />
                  </div>
                </div>
                <div className={`${b}__form-actions`}>
                  <button
                    type="submit"
                    className={`${b}__btn ${b}__btn--primary`}
                    disabled={bizSaving}
                  >
                    {bizSaving ? (
                      <>
                        <span className={`${b}__spinner`} />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Guardar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
          {activeTab === 'session' && (
            <div className={`${b}__panel`}>
              <div className={`${b}__panel-header`}>
                <h3 className={`${b}__panel-title`}>Informacion de sesion</h3>
                <p className={`${b}__panel-desc`}>Detalles de tu cuenta y asociacion al negocio</p>
              </div>

              <div className={`${b}__session-grid`}>
                <div className={`${b}__session-item`}>
                  <div className={`${b}__session-icon`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className={`${b}__session-content`}>
                    <span className={`${b}__session-label`}>ID de usuario</span>
                    <span className={`${b}__session-value`}>#{currentData?.id || '-'}</span>
                  </div>
                </div>

                <div className={`${b}__session-item`}>
                  <div className={`${b}__session-icon`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div className={`${b}__session-content`}>
                    <span className={`${b}__session-label`}>Rol actual</span>
                    <span className={`${b}__session-value ${b}__session-value--badge`}>
                      {getRoleName(currentData?.role)}
                    </span>
                  </div>
                </div>

                <div className={`${b}__session-item`}>
                  <div className={`${b}__session-icon`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <div className={`${b}__session-content`}>
                    <span className={`${b}__session-label`}>Negocio asociado</span>
                    <span className={`${b}__session-value`}>
                      {currentData?.tenant_id ? `${tenant?.name || 'Negocio'} #${currentData.tenant_id}` : 'Sin asociar'}
                    </span>
                  </div>
                </div>

                <div className={`${b}__session-item`}>
                  <div className={`${b}__session-icon`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div className={`${b}__session-content`}>
                    <span className={`${b}__session-label`}>Cuenta creada</span>
                    <span className={`${b}__session-value`}>
                      {formatDate(currentData?.created_at)}
                    </span>
                  </div>
                </div>

                <div className={`${b}__session-item`}>
                  <div className={`${b}__session-icon`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </div>
                  <div className={`${b}__session-content`}>
                    <span className={`${b}__session-label`}>Ultima actualizacion</span>
                    <span className={`${b}__session-value`}>
                      {formatDate(currentData?.updated_at)}
                    </span>
                  </div>
                </div>

                <div className={`${b}__session-item`}>
                  <div className={`${b}__session-icon ${b}__session-icon--status`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <div className={`${b}__session-content`}>
                    <span className={`${b}__session-label`}>Estado de la cuenta</span>
                    <span className={`${b}__session-value ${b}__session-value--active`}>
                      {currentData?.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
