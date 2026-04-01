const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const headers = { 'Content-Type': 'application/json' };

const subscriptionService = {
  list: async (clientId = null, status = null) => {
    const params = new URLSearchParams();
    if (clientId) params.append('client_id', clientId);
    if (status) params.append('status', status);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/subscriptions/${qs ? '?' + qs : ''}`, { headers, credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar suscripciones');
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_URL}/subscriptions/`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error al crear suscripción'); }
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_URL}/subscriptions/${id}`, { method: 'PUT', headers, credentials: 'include', body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error al actualizar'); }
    return res.json();
  },

  useSession: async (id) => {
    const res = await fetch(`${API_URL}/subscriptions/${id}/use-session`, { method: 'POST', headers, credentials: 'include' });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error al registrar sesión'); }
    return res.json();
  },
};

export default subscriptionService;
