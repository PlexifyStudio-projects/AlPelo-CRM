const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const headers = { 'Content-Type': 'application/json' };
const opts = { headers, credentials: 'include' };

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

const clientService = {
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.active !== undefined) query.set('active', params.active);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    const qs = query.toString();
    const res = await fetch(`${API}/clients/${qs ? `?${qs}` : ''}`, opts);
    return handleResponse(res);
  },

  get: async (id) => {
    const res = await fetch(`${API}/clients/${id}`, opts);
    return handleResponse(res);
  },

  create: async (data) => {
    const res = await fetch(`${API}/clients/`, {
      method: 'POST', ...opts,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  update: async (id, data) => {
    const res = await fetch(`${API}/clients/${id}`, {
      method: 'PUT', ...opts,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  delete: async (id, hard = false) => {
    const url = `${API}/clients/${id}${hard ? '?hard=true' : ''}`;
    const res = await fetch(url, { method: 'DELETE', ...opts });
    return handleResponse(res);
  },

  // ── Bulk import history ──
  listImportHistory: async (limit = 30) => {
    const res = await fetch(`${API}/clients/import-history?limit=${limit}`, opts);
    return handleResponse(res);
  },

  getImportBatch: async (id) => {
    const res = await fetch(`${API}/clients/import-history/${id}`, opts);
    return handleResponse(res);
  },

  listVisits: async (clientId) => {
    const res = await fetch(`${API}/clients/${clientId}/visits/`, opts);
    return handleResponse(res);
  },

  createVisit: async (data) => {
    const res = await fetch(`${API}/visits/`, {
      method: 'POST', ...opts,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  listNotes: async (clientId) => {
    const res = await fetch(`${API}/clients/${clientId}/notes/`, opts);
    return handleResponse(res);
  },

  createNote: async (data) => {
    const res = await fetch(`${API}/client-notes/`, {
      method: 'POST', ...opts,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  deleteNote: async (id) => {
    const res = await fetch(`${API}/client-notes/${id}`, {
      method: 'DELETE', ...opts,
    });
    return handleResponse(res);
  },

  kpis: async () => {
    const res = await fetch(`${API}/dashboard/kpis`, opts);
    return handleResponse(res);
  },

  rfm: async () => {
    const res = await fetch(`${API}/clients/rfm`, opts);
    return handleResponse(res);
  },
};

export default clientService;
