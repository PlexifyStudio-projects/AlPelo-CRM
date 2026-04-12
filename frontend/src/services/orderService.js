const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const opts = { credentials: 'include' };

const handleRes = async (r) => {
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: 'Error de servidor' }));
    throw new Error(e.detail || `HTTP ${r.status}`);
  }
  return r.json();
};

const orderService = {
  list: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    if (params.search) q.set('search', params.search);
    const qs = q.toString();
    return handleRes(await fetch(`${API}/orders/${qs ? '?' + qs : ''}`, opts));
  },

  get: async (id) => handleRes(await fetch(`${API}/orders/${id}`, opts)),

  create: async (data) => handleRes(await fetch(`${API}/orders/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: JSON.stringify(data),
  })),

  update: async (id, data) => handleRes(await fetch(`${API}/orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: JSON.stringify(data),
  })),

  delete: async (id) => handleRes(await fetch(`${API}/orders/${id}`, {
    method: 'DELETE',
    ...opts,
  })),
};

export default orderService;
