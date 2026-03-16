const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const templateService = {
  getTemplates: async (status = null) => {
    try {
      const url = status ? `${API}/message-templates?status=${status}` : `${API}/message-templates`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch (e) { /* API not deployed */ }
    return [];
  },

  getApprovedTemplates: async () => {
    return templateService.getTemplates('approved');
  },

  createTemplate: async (data) => {
    const res = await fetch(`${API}/message-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create template');
    return await res.json();
  },

  updateTemplate: async (id, data) => {
    const res = await fetch(`${API}/message-templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update template');
    return await res.json();
  },

  approveTemplate: async (id) => {
    const res = await fetch(`${API}/message-templates/${id}/approve`, {
      method: 'PUT',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to approve template');
    return await res.json();
  },

  submitToMeta: async (id) => {
    const res = await fetch(`${API}/message-templates/${id}/submit-to-meta`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit to Meta');
    }
    return await res.json();
  },

  checkMetaStatus: async (id) => {
    const res = await fetch(`${API}/message-templates/${id}/check-status`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to check status');
    return await res.json();
  },

  deleteTemplate: async (id) => {
    const res = await fetch(`${API}/message-templates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete template');
    return await res.json();
  },
};

export default templateService;
