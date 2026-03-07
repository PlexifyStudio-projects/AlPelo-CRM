const API = 'http://localhost:8001/api';

const headers = { 'Content-Type': 'application/json' };

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

const whatsappService = {
  // ========================= CONVERSATIONS =========================
  getConversations: async () => {
    const res = await fetch(`${API}/whatsapp/conversations`, { headers });
    return handleResponse(res);
  },

  getConversation: async (id) => {
    const res = await fetch(`${API}/whatsapp/conversations/${id}`, { headers });
    return handleResponse(res);
  },

  // ========================= MESSAGES =========================
  getMessages: async (conversationId) => {
    const res = await fetch(`${API}/whatsapp/conversations/${conversationId}/messages`, { headers });
    return handleResponse(res);
  },

  sendMessage: async (conversationId, text) => {
    const res = await fetch(`${API}/whatsapp/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId, content: text }),
    });
    return handleResponse(res);
  },

  // ========================= TEMPLATES =========================
  getTemplates: async () => {
    const res = await fetch(`${API}/whatsapp/templates`, { headers });
    return handleResponse(res);
  },

  sendTemplate: async (templateId, clientIds) => {
    const res = await fetch(`${API}/whatsapp/templates/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ template_id: templateId, client_ids: clientIds }),
    });
    return handleResponse(res);
  },

  // ========================= STATS =========================
  getStats: async () => {
    const res = await fetch(`${API}/whatsapp/stats`, { headers });
    return handleResponse(res);
  },
};

export default whatsappService;
