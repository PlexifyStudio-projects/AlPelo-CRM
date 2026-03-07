const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const headers = { 'Content-Type': 'application/json' };

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

const clientService = {
  // ========================= CLIENTS =========================
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.active !== undefined) query.set('active', params.active);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    const qs = query.toString();
    const res = await fetch(`${API}/clients/${qs ? `?${qs}` : ''}`, { headers });
    return handleResponse(res);
  },

  get: async (id) => {
    const res = await fetch(`${API}/clients/${id}`, { headers });
    return handleResponse(res);
  },

  create: async (data) => {
    const res = await fetch(`${API}/clients/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  update: async (id, data) => {
    const res = await fetch(`${API}/clients/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  delete: async (id) => {
    const res = await fetch(`${API}/clients/${id}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(res);
  },

  // ========================= VISITS =========================
  listVisits: async (clientId) => {
    const res = await fetch(`${API}/clients/${clientId}/visits/`, { headers });
    return handleResponse(res);
  },

  createVisit: async (data) => {
    const res = await fetch(`${API}/visits/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // ========================= NOTES =========================
  listNotes: async (clientId) => {
    const res = await fetch(`${API}/clients/${clientId}/notes/`, { headers });
    return handleResponse(res);
  },

  createNote: async (data) => {
    const res = await fetch(`${API}/client-notes/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  deleteNote: async (id) => {
    const res = await fetch(`${API}/client-notes/${id}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(res);
  },

  // ========================= DASHBOARD =========================
  kpis: async () => {
    const res = await fetch(`${API}/dashboard/kpis`, { headers });
    return handleResponse(res);
  },
};

export default clientService;
