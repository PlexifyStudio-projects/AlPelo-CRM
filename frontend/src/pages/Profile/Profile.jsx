import { useState } from 'react';
import { useNotification } from '../../context/NotificationContext';
import authService from '../../services/authService';

const Profile = ({ user, onUpdate }) => {
  const b = 'profile';
  const { addNotification } = useNotification();

  // Profile form
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    username: user?.username || '',
  });
  const [saving, setSaving] = useState(false);

  // Password form
  const [pwForm, setPwForm] = useState({
    new_password: '',
    confirm_password: '',
  });
  const [changingPw, setChangingPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState('info');

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

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
      const res = await fetch('http://localhost:8001/api/auth/me', {
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
      const res = await fetch(`http://localhost:8001/api/auth/users/${user.id}/password`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: pwForm.new_password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Error al cambiar contraseña');
      }

      setPwForm({ new_password: '', confirm_password: '' });
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

  return (
    <div className={b}>
      {/* Header */}
      <div className={`${b}__header`}>
        <h2 className={`${b}__title`}>Mi Perfil</h2>
        <p className={`${b}__subtitle`}>Gestiona tu cuenta y seguridad</p>
      </div>

      <div className={`${b}__layout`}>
        {/* Sidebar card with avatar */}
        <div className={`${b}__sidebar`}>
          <div className={`${b}__avatar-card`}>
            <div className={`${b}__avatar`}>
              <div className={`${b}__avatar-ring`} />
              <span className={`${b}__avatar-initials`}>{initials}</span>
            </div>
            <h3 className={`${b}__user-name`}>{user?.name || 'Admin'}</h3>
            <span className={`${b}__user-role`}>
              {user?.role === 'admin' ? 'Administrador' : 'Barbero'}
            </span>
            <div className={`${b}__user-meta`}>
              <div className={`${b}__meta-item`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span>{user?.email || '-'}</span>
              </div>
              <div className={`${b}__meta-item`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>{user?.phone || '-'}</span>
              </div>
              <div className={`${b}__meta-item`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>@{user?.username || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className={`${b}__main`}>
          {/* Tabs */}
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
          </div>

          {/* Info tab */}
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

          {/* Security tab */}
          {activeTab === 'security' && (
            <div className={`${b}__panel`}>
              <div className={`${b}__panel-header`}>
                <h3 className={`${b}__panel-title`}>Cambiar contraseña</h3>
                <p className={`${b}__panel-desc`}>Asegurate de usar una contraseña segura de al menos 6 caracteres</p>
              </div>

              <form className={`${b}__form`} onSubmit={handleChangePassword}>
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
        </div>
      </div>
    </div>
  );
};

export default Profile;
