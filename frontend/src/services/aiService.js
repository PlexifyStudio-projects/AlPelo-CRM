const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const headers = { 'Content-Type': 'application/json' };

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

const aiService = {
  // ========================= CONFIG =========================
  getConfig: async () => {
    const res = await fetch(`${API}/ai/config`, { headers });
    return handleResponse(res);
  },

  saveConfig: async (data) => {
    const res = await fetch(`${API}/ai/config`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  updateConfig: async (configId, data) => {
    const res = await fetch(`${API}/ai/config/${configId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // ========================= CHAT =========================
  chat: async (message, conversationHistory = []) => {
    const res = await fetch(`${API}/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, conversation_history: conversationHistory }),
    });
    return handleResponse(res);
  },
};

export default aiService;
