const _API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const settingsService = {
  // --- OAuth flow ---
  getMetaAuthUrl: async () => {
    const res = await fetch(`${_API}/settings/meta/auth-url`, { credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al obtener URL de autorizacion');
    }
    return res.json();
  },

  exchangeMetaToken: async (code) => {
    const res = await fetch(`${_API}/settings/meta/exchange-token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al intercambiar token');
    }
    return res.json();
  },

  refreshMetaToken: async () => {
    const res = await fetch(`${_API}/settings/meta/refresh-token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al renovar token');
    }
    return res.json();
  },

  // --- Manual token management ---
  updateMetaToken: async (data) => {
    const res = await fetch(`${_API}/settings/meta-token`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar token');
    }
    return res.json();
  },

  getMetaTokenStatus: async () => {
    const res = await fetch(`${_API}/settings/meta-token-status`, { credentials: 'include' });
    if (!res.ok) return { connected: false };
    return res.json();
  },

  getMetaTemplates: async () => {
    const res = await fetch(`${_API}/settings/meta-templates`, { credentials: 'include' });
    if (!res.ok) return { templates: [], error: 'Error de conexion' };
    return res.json();
  },
};

export default settingsService;
