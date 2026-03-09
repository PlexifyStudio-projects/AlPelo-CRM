const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const appointmentService = {
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.date_from) query.append('date_from', params.date_from);
    if (params.date_to) query.append('date_to', params.date_to);
    if (params.staff_id) query.append('staff_id', params.staff_id);
    if (params.status) query.append('status', params.status);
    const qs = query.toString();
    const res = await fetch(`${API_URL}/appointments/${qs ? '?' + qs : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar citas');
    return res.json();
  },

  get: async (id) => {
    const res = await fetch(`${API_URL}/appointments/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Cita no encontrada');
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_URL}/appointments/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = typeof err.detail === 'string' ? err.detail : Array.isArray(err.detail) ? err.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ') : 'Error al crear cita';
      throw new Error(detail);
    }
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_URL}/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = typeof err.detail === 'string' ? err.detail : Array.isArray(err.detail) ? err.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ') : 'Error al actualizar cita';
      throw new Error(detail);
    }
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/appointments/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar cita');
    return res.json();
  },
};

export default appointmentService;
