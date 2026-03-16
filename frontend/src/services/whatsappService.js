const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const headers = { 'Content-Type': 'application/json' };

// Authenticated fetch — sends cookies for auth
const authFetch = (url, opts = {}) => fetch(url, { ...opts, credentials: 'include' });

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
    const res = await authFetch(`${API}/whatsapp/conversations`, { headers });
    return handleResponse(res);
  },

  getConversation: async (id) => {
    const res = await authFetch(`${API}/whatsapp/conversations/${id}`, { headers });
    return handleResponse(res);
  },

  // ========================= MESSAGES =========================
  getMessages: async (conversationId) => {
    const res = await authFetch(`${API}/whatsapp/conversations/${conversationId}/messages`, { headers });
    return handleResponse(res);
  },

  sendMessage: async (conversationId, text) => {
    const res = await authFetch(`${API}/whatsapp/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId, content: text }),
    });
    return handleResponse(res);
  },

  // ========================= TEMPLATES =========================
  getMetaTemplates: async () => {
    const res = await authFetch(`${API}/whatsapp/templates`, { headers });
    return handleResponse(res);
  },

  sendTemplate: async (phone, name, templateName, languageCode, bodyText) => {
    const res = await authFetch(`${API}/whatsapp/send-template`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone,
        name,
        template_name: templateName,
        language_code: languageCode,
        body_text: bodyText,
      }),
    });
    return handleResponse(res);
  },

  // ========================= MARK AS READ =========================
  markAsRead: async (conversationId) => {
    const res = await authFetch(`${API}/whatsapp/conversations/${conversationId}/read`, {
      method: 'PUT',
      headers,
    });
    return handleResponse(res);
  },

  // ========================= UNREAD COUNT =========================
  getUnreadCount: async () => {
    const res = await authFetch(`${API}/whatsapp/unread-count`, { headers });
    return handleResponse(res);
  },

  // ========================= SEARCH MESSAGES =========================
  searchMessages: async (query) => {
    const res = await authFetch(`${API}/whatsapp/messages/search?q=${encodeURIComponent(query)}`, { headers });
    return handleResponse(res);
  },

  // ========================= DELETE =========================
  deleteConversation: async (id) => {
    const res = await authFetch(`${API}/whatsapp/conversations/${id}`, { method: 'DELETE', headers });
    return handleResponse(res);
  },

  deleteAllConversations: async () => {
    const res = await authFetch(`${API}/whatsapp/conversations`, { method: 'DELETE', headers });
    return handleResponse(res);
  },

  // ========================= CREATE CONVERSATION =========================
  createConversation: async (phone, name) => {
    const res = await authFetch(`${API}/whatsapp/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, name }),
    });
    return handleResponse(res);
  },

  // ========================= STATS =========================
  getStats: async () => {
    const res = await authFetch(`${API}/whatsapp/stats`, { headers });
    return handleResponse(res);
  },

  // ========================= TOGGLE AI =========================
  toggleAi: async (conversationId, isActive) => {
    const res = await authFetch(`${API}/whatsapp/conversations/${conversationId}/ai`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ is_ai_active: isActive }),
    });
    return handleResponse(res);
  },

  // ========================= TAGS =========================
  updateTags: async (conversationId, tags) => {
    const res = await authFetch(`${API}/whatsapp/conversations/${conversationId}/tags`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ tags }),
    });
    return handleResponse(res);
  },
};

export default whatsappService;
