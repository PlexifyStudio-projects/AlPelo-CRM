const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

let _listCache = null;
let _listCacheTime = 0;
const CACHE_TTL = 120000;

const servicesService = {
  list: async (params = {}) => {
    const hasFilters = params.category || params.active !== undefined || params.search;
    if (!hasFilters && _listCache && (Date.now() - _listCacheTime < CACHE_TTL)) {
      return _listCache;
    }

    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.active !== undefined) query.append('active', params.active);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    const res = await fetch(`${API_URL}/services/${qs ? '?' + qs : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar servicios');
    const data = await res.json();

    if (!hasFilters) { _listCache = data; _listCacheTime = Date.now(); }
    return data;
  },

  invalidateCache: () => { _listCache = null; _listCacheTime = 0; },

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
    servicesService.invalidateCache();
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
    servicesService.invalidateCache();
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/services/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar servicio');
    servicesService.invalidateCache();
    return res.json();
  },

  uploadPhoto: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/services/${id}/photo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al subir foto');
    }
    servicesService.invalidateCache();
    return res.json();
  },

  deletePhoto: async (id) => {
    const res = await fetch(`${API_URL}/services/${id}/photo`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar foto');
    servicesService.invalidateCache();
    return res.json();
  },

  getCommissions: async (id) => {
    const res = await fetch(`${API_URL}/services/${id}/commissions`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar comisiones');
    return res.json();
  },

  saveCommissions: async (id, items) => {
    const res = await fetch(`${API_URL}/services/${id}/commissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(items),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al guardar comisiones');
    }
    servicesService.invalidateCache();
    return res.json();
  },

  exportXlsx: async () => {
    const res = await fetch(`${API_URL}/services/export`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `servicios_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  importXlsx: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/services/import`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al importar');
    }
    servicesService.invalidateCache();
    return res.json();
  },
};

export default servicesService;
