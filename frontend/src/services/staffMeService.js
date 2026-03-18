const _API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const staffMeService = {
  getStats: async () => {
    const res = await fetch(`${_API}/staff/me/stats`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar estadisticas');
    return res.json();
  },

  getAppointments: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    const url = query.toString() ? `${_API}/staff/me/appointments?${query}` : `${_API}/staff/me/appointments`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar citas');
    return res.json();
  },

  getNotifications: async () => {
    const res = await fetch(`${_API}/staff/me/notifications`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar notificaciones');
    return res.json();
  },

  getCommissions: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.period) query.set('period', params.period);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    const url = query.toString() ? `${_API}/staff/me/commissions?${query}` : `${_API}/staff/me/commissions`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar comisiones');
    return res.json();
  },
};

export default staffMeService;
