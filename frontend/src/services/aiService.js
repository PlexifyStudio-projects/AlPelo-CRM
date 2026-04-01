const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const headers = { 'Content-Type': 'application/json' };

const authFetch = (url, opts = {}) => fetch(url, { ...opts, credentials: 'include' });

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

const aiService = {
  getConfig: async () => {
    const res = await authFetch(`${API}/ai/config`, { headers });
    return handleResponse(res);
  },

  saveConfig: async (data) => {
    const res = await authFetch(`${API}/ai/config`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  updateConfig: async (configId, data) => {
    const res = await authFetch(`${API}/ai/config/${configId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  chat: async (message, conversationHistory = [], imageBase64 = null, imageMime = null) => {
    const body = { message, conversation_history: conversationHistory };
    if (imageBase64 && imageMime) {
      body.image_base64 = imageBase64;
      body.image_mime = imageMime;
    }
    const res = await authFetch(`${API}/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },
};

export default aiService;
