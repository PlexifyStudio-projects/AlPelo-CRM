const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const automationService = {
  getAutomations: async () => {
    try {
      const res = await fetch(`${API}/automations`, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch (e) { /* fallback below */ }
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem('plexify_automations') || 'null');
  },

  updateAutomation: async (id, data) => {
    try {
      const res = await fetch(`${API}/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) { /* fallback below */ }
    // Save to localStorage as fallback
    const all = JSON.parse(localStorage.getItem('plexify_automations') || '[]');
    const idx = all.findIndex(a => a.id === id);
    if (idx >= 0) all[idx] = { ...all[idx], ...data };
    localStorage.setItem('plexify_automations', JSON.stringify(all));
    return all[idx];
  },

  getAutomationStats: async () => {
    try {
      const res = await fetch(`${API}/automations/stats`, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch (e) { /* fallback below */ }
    return { sent_this_month: 0, response_rate: 0, confirmed_appointments: 0 };
  }
};

export default automationService;
