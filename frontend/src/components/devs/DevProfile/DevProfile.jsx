import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-profile';

const DevProfile = ({ user, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new_password: '',
    confirm: '',
  });
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pwdMsg, setPwdMsg] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg({ type: 'error', text: err.detail || 'Error al guardar' });
        return;
      }
      const data = await res.json();
      setMsg({ type: 'success', text: 'Perfil actualizado' });
      if (onUpdate) onUpdate(data);
    } catch {
      setMsg({ type: 'error', text: 'Error de conexion' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwdMsg(null);

    if (!passwords.current || !passwords.new_password) {
      setPwdMsg({ type: 'error', text: 'Completa todos los campos' });
      return;
    }
    if (passwords.new_password !== passwords.confirm) {
      setPwdMsg({ type: 'error', text: 'Las contrasenas no coinciden' });
      return;
    }
    if (passwords.new_password.length < 6) {
      setPwdMsg({ type: 'error', text: 'Minimo 6 caracteres' });
      return;
    }

    setSavingPwd(true);
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwords.current,
          new_password: passwords.new_password,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPwdMsg({ type: 'error', text: err.detail || 'Error al cambiar' });
        return;
      }
      setPwdMsg({ type: 'success', text: 'Contrasena actualizada' });
      setPasswords({ current: '', new_password: '', confirm: '' });
    } catch {
      setPwdMsg({ type: 'error', text: 'Error de conexion' });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h1 className={`${b}__title`}>Mi perfil</h1>
        <p className={`${b}__subtitle`}>Gestiona tu informacion personal y credenciales</p>
      </div>

      {/* Profile card */}
      <div className={`${b}__card`}>
        <div className={`${b}__card-header`}>
          <div className={`${b}__avatar`}>
            <span className={`${b}__avatar-letter`}>{(user?.name || 'D')[0].toUpperCase()}</span>
          </div>
          <div className={`${b}__card-header-info`}>
            <h3 className={`${b}__card-name`}>{user?.name || 'Developer'}</h3>
            <span className={`${b}__card-role`}>
              <span className={`${b}__role-dot`} />
              {user?.role === 'dev' ? 'Developer' : 'Super Admin'}
            </span>
          </div>
        </div>

        <div className={`${b}__form`}>
          <h4 className={`${b}__form-section`}>Informacion personal</h4>

          <div className={`${b}__form-grid`}>
            <div className={`${b}__field`}>
              <label className={`${b}__label`}>Nombre</label>
              <input
                className={`${b}__input`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Tu nombre"
              />
            </div>
            <div className={`${b}__field`}>
              <label className={`${b}__label`}>Email</label>
              <input
                className={`${b}__input`}
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@plexify.studio"
              />
            </div>
            <div className={`${b}__field`}>
              <label className={`${b}__label`}>Telefono</label>
              <input
                className={`${b}__input`}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+573001234567"
              />
            </div>
            <div className={`${b}__field`}>
              <label className={`${b}__label`}>Username</label>
              <input
                className={`${b}__input`}
                value={user?.username || ''}
                disabled
              />
            </div>
          </div>

          {msg && (
            <div className={`${b}__msg ${b}__msg--${msg.type}`}>
              {msg.text}
            </div>
          )}

          <button className={`${b}__btn-save`} onClick={handleSaveProfile} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Password card */}
      <div className={`${b}__card`}>
        <div className={`${b}__form`}>
          <h4 className={`${b}__form-section`}>Cambiar contrasena</h4>

          <div className={`${b}__form-grid`}>
            <div className={`${b}__field`}>
              <label className={`${b}__label`}>Contrasena actual</label>
              <input
                className={`${b}__input`}
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                placeholder="Contrasena actual"
              />
            </div>
            <div className={`${b}__field`} />
            <div className={`${b}__field`}>
              <label className={`${b}__label`}>Nueva contrasena</label>
              <input
                className={`${b}__input`}
                type="password"
                value={passwords.new_password}
                onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                placeholder="Minimo 6 caracteres"
              />
            </div>
            <div className={`${b}__field`}>
              <label className={`${b}__label`}>Confirmar nueva</label>
              <input
                className={`${b}__input`}
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                placeholder="Repite la contrasena"
              />
            </div>
          </div>

          {pwdMsg && (
            <div className={`${b}__msg ${b}__msg--${pwdMsg.type}`}>
              {pwdMsg.text}
            </div>
          )}

          <button className={`${b}__btn-save`} onClick={handleChangePassword} disabled={savingPwd}>
            {savingPwd ? 'Cambiando...' : 'Cambiar contrasena'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DevProfile;
