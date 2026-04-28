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

  // ─── Bank info (extended with Bre-B) ────────────────
  getBankInfo: async (id) => {
    const res = await fetch(`${_API}/staff-payments/bank-info/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar datos bancarios');
    return res.json();
  },

  updateBankInfo: async (id, data) => {
    const res = await fetch(`${_API}/staff-payments/bank-info/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al guardar datos bancarios');
    }
    return res.json();
  },

  // ─── Schedule (horario semanal) ─────────────────────
  getSchedule: async (id) => {
    const res = await fetch(`${API_BASE}/${id}/schedule`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar horario');
    return res.json();
  },

  saveSchedule: async (id, schedule) => {
    const res = await fetch(`${API_BASE}/${id}/schedule`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al guardar horario');
    }
    return res.json();
  },

  // ─── Days off (días libres programados) ─────────────
  getDaysOff: async (id) => {
    const res = await fetch(`${API_BASE}/${id}/days-off`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar días libres');
    return res.json();
  },

  addDayOff: async (id, payload) => {
    const res = await fetch(`${API_BASE}/${id}/days-off`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al agregar día libre');
    }
    return res.json();
  },

  removeDayOff: async (id, dayOffId) => {
    const res = await fetch(`${API_BASE}/${id}/days-off/${dayOffId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar día libre');
    return res.json();
  },

  // ─── Loans / abonos ─────────────────────────────────
  getLoans: async (id) => {
    const res = await fetch(`${API_BASE}/${id}/loans`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar préstamos');
    return res.json();
  },

  addLoan: async (id, data) => {
    const res = await fetch(`${API_BASE}/${id}/loans`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al registrar movimiento');
    }
    return res.json();
  },

  updateLoan: async (id, loanId, data) => {
    const res = await fetch(`${API_BASE}/${id}/loans/${loanId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar movimiento');
    return res.json();
  },

  removeLoan: async (id, loanId) => {
    const res = await fetch(`${API_BASE}/${id}/loans/${loanId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar movimiento');
    return res.json();
  },

  // ─── Clients attended (detail) ──────────────────────
  getClientsDetail: async (id, params = {}) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    if (params.limit) q.set('limit', params.limit);
    const qs = q.toString();
    const res = await fetch(`${API_BASE}/${id}/clients-detail${qs ? '?' + qs : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar clientes atendidos');
    return res.json();
  },

  // ─── Commissions earned (per service) ───────────────
  getCommissionsSummary: async (id, params = {}) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    const qs = q.toString();
    const res = await fetch(`${API_BASE}/${id}/commissions-summary${qs ? '?' + qs : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Error al cargar comisiones');
    return res.json();
  },
};

export default staffService;
