const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const servicesService = {
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.active !== undefined) query.append('active', params.active);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    const res = await fetch(`${API_URL}/services/${qs ? '?' + qs : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar servicios');
    return res.json();
  },

  get: async (id) => {
    const res = await fetch(`${API_URL}/services/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Servicio no encontrado');
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_URL}/services/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al crear servicio');
    }
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_URL}/services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar servicio');
    }
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/services/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar servicio');
    return res.json();
  },
};

export default servicesService;
