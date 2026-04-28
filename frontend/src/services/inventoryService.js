const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

let _listCache = null;
let _listCacheTime = 0;
const CACHE_TTL = 60000;

const inventoryService = {
  list: async (params = {}) => {
    const hasFilters = params.category || params.low_stock || params.search || params.active_only !== undefined;
    if (!hasFilters && _listCache && (Date.now() - _listCacheTime < CACHE_TTL)) {
      return _listCache;
    }
    const q = new URLSearchParams();
    if (params.category) q.append('category', params.category);
    if (params.low_stock) q.append('low_stock', 'true');
    if (params.search) q.append('search', params.search);
    if (params.active_only !== undefined) q.append('active_only', params.active_only);
    const qs = q.toString();
    const res = await fetch(`${API_URL}/inventory/products${qs ? '?' + qs : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar productos');
    const data = await res.json();
    if (!hasFilters) { _listCache = data; _listCacheTime = Date.now(); }
    return data;
  },

  invalidateCache: () => { _listCache = null; _listCacheTime = 0; },

  get: async (id) => {
    const res = await fetch(`${API_URL}/inventory/products/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Producto no encontrado');
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_URL}/inventory/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al crear producto');
    }
    inventoryService.invalidateCache();
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_URL}/inventory/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar producto');
    }
    inventoryService.invalidateCache();
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/inventory/products/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar producto');
    inventoryService.invalidateCache();
    return res.json();
  },

  adjustStock: async (id, payload) => {
    const res = await fetch(`${API_URL}/inventory/products/${id}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al ajustar stock');
    }
    inventoryService.invalidateCache();
    return res.json();
  },

  uploadPhoto: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/inventory/products/${id}/photo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al subir foto');
    }
    inventoryService.invalidateCache();
    return res.json();
  },

  deletePhoto: async (id) => {
    const res = await fetch(`${API_URL}/inventory/products/${id}/photo`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar foto');
    inventoryService.invalidateCache();
    return res.json();
  },

  exportXlsx: async () => {
    const res = await fetch(`${API_URL}/inventory/export`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  importXlsx: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/inventory/import`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al importar');
    }
    inventoryService.invalidateCache();
    return res.json();
  },
};

export default inventoryService;
