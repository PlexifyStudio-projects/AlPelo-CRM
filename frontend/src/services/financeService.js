const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const headers = { 'Content-Type': 'application/json' };

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

const financeService = {
  // ========================= EXPENSES =========================
  listExpenses: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.period) query.set('period', params.period);
    if (params.category) query.set('category', params.category);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    const qs = query.toString();
    const res = await fetch(`${API}/expenses/${qs ? `?${qs}` : ''}`, { headers });
    return handleResponse(res);
  },

  createExpense: async (data) => {
    const res = await fetch(`${API}/expenses/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  updateExpense: async (id, data) => {
    const res = await fetch(`${API}/expenses/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  deleteExpense: async (id) => {
    const res = await fetch(`${API}/expenses/${id}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(res);
  },

  expensesSummary: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.period) query.set('period', params.period);
    const qs = query.toString();
    const res = await fetch(`${API}/expenses/summary${qs ? `?${qs}` : ''}`, { headers });
    return handleResponse(res);
  },

  // ========================= COMMISSIONS =========================
  listCommissions: async () => {
    const res = await fetch(`${API}/finances/commissions/config`, { headers });
    return handleResponse(res);
  },

  updateCommission: async (staffId, data) => {
    const res = await fetch(`${API}/finances/commissions/config/${staffId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  commissionPayouts: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.period) query.set('period', params.period);
    const qs = query.toString();
    const res = await fetch(`${API}/finances/commissions/payouts${qs ? `?${qs}` : ''}`, { headers });
    return handleResponse(res);
  },

  // ========================= INVOICES =========================
  listInvoices: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    const res = await fetch(`${API}/invoices/${qs ? `?${qs}` : ''}`, { headers });
    return handleResponse(res);
  },

  getInvoice: async (id) => {
    const res = await fetch(`${API}/invoices/${id}`, { headers });
    return handleResponse(res);
  },

  createInvoice: async (data) => {
    const res = await fetch(`${API}/invoices/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  updateInvoice: async (id, data) => {
    const res = await fetch(`${API}/invoices/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  cancelInvoice: async (id) => {
    const res = await fetch(`${API}/invoices/${id}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(res);
  },

  // ========================= P&L =========================
  getPnL: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.period) query.set('period', params.period);
    const qs = query.toString();
    const res = await fetch(`${API}/finances/pnl${qs ? `?${qs}` : ''}`, { headers });
    return handleResponse(res);
  },

  // ========================= PAYMENT METHODS =========================
  paymentMethods: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.period) query.set('period', params.period);
    const qs = query.toString();
    const res = await fetch(`${API}/finances/payment-methods${qs ? `?${qs}` : ''}`, { headers });
    return handleResponse(res);
  },

  // ========================= EXPORT / IMPORT =========================
  exportClients: async () => {
    const res = await fetch(`${API}/clients/export`, { headers: {} });
    if (!res.ok) throw new Error('Error al exportar');
    return res.blob();
  },

  importClients: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API}/clients/import`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },
};

export default financeService;
