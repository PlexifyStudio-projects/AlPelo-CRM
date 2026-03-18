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
  list: () => fetch(`${API}/campaigns`, opts()).then(handle),
  get: (id) => fetch(`${API}/campaigns/${id}`, opts()).then(handle),
  create: (data) => fetch(`${API}/campaigns`, opts('POST', data)).then(handle),
  update: (id, data) => fetch(`${API}/campaigns/${id}`, opts('PUT', data)).then(handle),
  delete: (id) => fetch(`${API}/campaigns/${id}`, opts('DELETE')).then(handle),
  generateCopy: (id) => fetch(`${API}/campaigns/${id}/generate-copy`, opts('POST')).then(handle),
  previewAudience: (id) => fetch(`${API}/campaigns/${id}/preview-audience`, opts('POST')).then(handle),
  submitToMeta: (id) => fetch(`${API}/campaigns/${id}/submit-to-meta`, opts('POST')).then(handle),
  checkMetaStatus: (id) => fetch(`${API}/campaigns/${id}/check-meta-status`, opts('POST')).then(handle),
  send: (id) => fetch(`${API}/campaigns/${id}/send`, opts('POST')).then(handle),
};

export default campaignService;
