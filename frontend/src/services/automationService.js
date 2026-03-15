const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const automationService = {
  getAutomations: async () => {
    try {
      const res = await fetch(`${API}/automations`, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch (e) { /* API not deployed yet */ }
    return [];
  },

  updateAutomation: async (id, data) => {
    const res = await fetch(`${API}/automations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update automation');
    return await res.json();
  },

  getAutomationStats: async () => {
    try {
      const res = await fetch(`${API}/automations/stats`, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch (e) { /* API not deployed yet */ }
    return { active_count: 0, total_count: 0, sent_this_month: 0, response_rate: 0, sent_total: 0 };
  },

  getExecutions: async (limit = 50) => {
    try {
      const res = await fetch(`${API}/automations/executions?limit=${limit}`, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch (e) { /* API not deployed yet */ }
    return [];
  },
};

export default automationService;
