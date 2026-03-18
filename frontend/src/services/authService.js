const _API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const API_BASE = `${_API}/auth`;

const authService = {
  verifyCredentials: async (username, password) => {
    const res = await fetch(`${API_BASE}/verify-credentials`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.detail === 'suspended') {
        const err = new Error(data.message || 'Cuenta suspendida');
        err.code = 'SUSPENDED';
        throw err;
      }
      if (data.detail === 'staff_deactivated') {
        const err = new Error(data.message || 'Cuenta desactivada');
        err.code = 'STAFF_DEACTIVATED';
        throw err;
      }
      throw new Error(data.detail || 'Usuario o contraseña incorrectos');
    }

    return res.json();
  },

  createToken: async (userCredentials) => {
    const res = await fetch(`${API_BASE}/create-token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userCredentials.user_id,
        username: userCredentials.username,
        role: userCredentials.role,
      }),
    });

    if (!res.ok) throw new Error('Error al crear la sesión');

    return res.json();
  },

  refreshToken: async () => {
    const res = await fetch(`${API_BASE}/refresh-token`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) return null;

    return res.json();
  },

  getProfile: async () => {
    const res = await fetch(`${API_BASE}/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) return null;

    return res.json();
  },

  logout: async () => {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },
};

export default authService;
