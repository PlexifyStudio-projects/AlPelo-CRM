const _API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const settingsService = {
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
