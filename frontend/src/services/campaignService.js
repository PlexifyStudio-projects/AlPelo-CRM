const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const opts = (method, body) => ({
  method: method || 'GET',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  ...(body ? { body: JSON.stringify(body) } : {}),
});

const handle = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
};

const campaignService = {
  // Campaign CRUD
  list: () => fetch(`${API}/campaigns`, opts()).then(handle),
  get: (id) => fetch(`${API}/campaigns/${id}`, opts()).then(handle),
  create: (data) => fetch(`${API}/campaigns`, opts('POST', data)).then(handle),
  update: (id, data) => fetch(`${API}/campaigns/${id}`, opts('PUT', data)).then(handle),
  delete: (id) => fetch(`${API}/campaigns/${id}`, opts('DELETE')).then(handle),

  // AI
  generateCopy: (id) => fetch(`${API}/campaigns/${id}/generate-copy`, opts('POST')).then(handle),

  // Audience
  previewAudience: (id) => fetch(`${API}/campaigns/${id}/preview-audience`, opts('POST')).then(handle),
  searchAudience: (filters) => fetch(`${API}/campaigns/audience-search`, opts('POST', filters)).then(handle),

  // Meta
  submitToMeta: (id) => fetch(`${API}/campaigns/${id}/submit-to-meta`, opts('POST')).then(handle),
  checkMetaStatus: (id) => fetch(`${API}/campaigns/${id}/check-meta-status`, opts('POST')).then(handle),

  // Sending
  send: (id) => fetch(`${API}/campaigns/${id}/send`, opts('POST')).then(handle),
  sendOne: (data) => fetch(`${API}/campaigns/send-one`, opts('POST', data)).then(handle),
};

export default campaignService;
