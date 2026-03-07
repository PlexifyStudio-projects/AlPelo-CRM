const API_BASE = 'http://localhost:8001/api/staff';

const staffService = {
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.role) query.set('role', params.role);
    if (params.skill) query.set('skill', params.skill);
    if (params.search) query.set('search', params.search);
    if (params.active !== undefined) query.set('active', params.active);
    if (params.sort_by) query.set('sort_by', params.sort_by);

    const url = query.toString() ? `${API_BASE}/?${query}` : `${API_BASE}/`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar equipo');
    return res.json();
  },

  get: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Staff no encontrado');
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_BASE}/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al crear staff');
    }
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar staff');
    }
    return res.json();
  },

  remove: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar staff');
    return res.json();
  },

  addSkill: async (id, skill) => {
    const res = await fetch(`${API_BASE}/${id}/skills/${encodeURIComponent(skill)}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al agregar habilidad');
    return res.json();
  },

  removeSkill: async (id, skill) => {
    const res = await fetch(`${API_BASE}/${id}/skills/${encodeURIComponent(skill)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar habilidad');
    return res.json();
  },
};

export default staffService;
