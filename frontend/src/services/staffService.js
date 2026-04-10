const _API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const API_BASE = `${_API}/staff`;

let _listCache = null;
let _listCacheTime = 0;
const CACHE_TTL = 120000;

const staffService = {
  list: async (params = {}) => {
    const hasFilters = params.role || params.skill || params.search || params.active !== undefined || params.sort_by;
    if (!hasFilters && _listCache && (Date.now() - _listCacheTime < CACHE_TTL)) {
      return _listCache;
    }

    const query = new URLSearchParams();
    if (params.role) query.set('role', params.role);
    if (params.skill) query.set('skill', params.skill);
    if (params.search) query.set('search', params.search);
    if (params.active !== undefined) query.set('active', params.active);
    if (params.sort_by) query.set('sort_by', params.sort_by);

    const url = query.toString() ? `${API_BASE}/?${query}` : `${API_BASE}/`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar equipo');
    const data = await res.json();

    if (!hasFilters) { _listCache = data; _listCacheTime = Date.now(); }
    return data;
  },

  invalidateCache: () => { _listCache = null; _listCacheTime = 0; },

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
    staffService.invalidateCache();
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
    staffService.invalidateCache();
    return res.json();
  },

  remove: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar staff');
    staffService.invalidateCache();
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

  uploadPhoto: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/${id}/photo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al subir foto');
    }
    return res.json();
  },

  updateCredentials: async (id, { username, password }) => {
    const res = await fetch(`${API_BASE}/${id}/credentials`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar credenciales');
    }
    return res.json();
  },
};

export default staffService;
