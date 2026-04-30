const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const headers = { 'Content-Type': 'application/json' };

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
    const msg = typeof err.detail === 'string'
      ? err.detail
      : Array.isArray(err.detail)
        ? err.detail.map(e => e.msg || JSON.stringify(e)).join(', ')
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
};

const handleBlobResponse = async (res) => {
  if (!res.ok) throw new Error('Error al exportar');
  return res.blob();
};

const authFetch = (url, opts = {}) => fetch(url, { ...opts, credentials: 'include' });

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.set(k, v);
  });
  return query.toString();
};

const qs = (params) => { const s = buildQuery(params); return s ? `?${s}` : ''; };

const financeService = {
  // ── Expenses ──
  listExpenses: async (params = {}) => handleResponse(await authFetch(`${API}/expenses/${qs(params)}`, { headers })),
  createExpense: async (data) => handleResponse(await authFetch(`${API}/expenses/`, { method: 'POST', headers, body: JSON.stringify(data) })),
  updateExpense: async (id, data) => handleResponse(await authFetch(`${API}/expenses/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) })),
  deleteExpense: async (id) => handleResponse(await authFetch(`${API}/expenses/${id}`, { method: 'DELETE', headers })),
  expensesSummary: async (params = {}) => handleResponse(await authFetch(`${API}/expenses/summary${qs(params)}`, { headers })),

  // ── Commissions ──
  listCommissions: async () => handleResponse(await authFetch(`${API}/finances/commissions/config`, { headers })),
  updateCommission: async (staffId, data) => handleResponse(await authFetch(`${API}/finances/commissions/config/${staffId}`, { method: 'PUT', headers, body: JSON.stringify(data) })),
  commissionPayouts: async (params = {}) => handleResponse(await authFetch(`${API}/finances/commissions/payouts${qs(params)}`, { headers })),
  getAllCommissionRates: async () => handleResponse(await authFetch(`${API}/services/all-commissions`, { headers })),

  // ── Invoices ──
  listInvoices: async (params = {}) => handleResponse(await authFetch(`${API}/invoices/${qs(params)}`, { headers })),
  getInvoice: async (id) => handleResponse(await authFetch(`${API}/invoices/${id}`, { headers })),
  createInvoice: async (data) => handleResponse(await authFetch(`${API}/invoices/`, { method: 'POST', headers, body: JSON.stringify(data) })),
  updateInvoice: async (id, data) => handleResponse(await authFetch(`${API}/invoices/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) })),
  cancelInvoice: async (id) => handleResponse(await authFetch(`${API}/invoices/${id}`, { method: 'DELETE', headers })),
  getUninvoicedVisits: async (params = {}) => handleResponse(await authFetch(`${API}/finances/uninvoiced-visits${qs(params)}`, { headers })),

  // ── DIAN / POS ──
  getPosStatus: async () => handleResponse(await authFetch(`${API}/invoices/pos-status`, { headers })),
  assignPos: async (invoiceIds) => handleResponse(await authFetch(`${API}/invoices/assign-pos`, { method: 'POST', headers, body: JSON.stringify({ invoice_ids: invoiceIds }) })),
  voidPos: async (id) => handleResponse(await authFetch(`${API}/invoices/${id}/void-pos`, { method: 'PUT', headers })),

  // ── P&L / Analytics ──
  getPnL: async (params = {}) => handleResponse(await authFetch(`${API}/finances/pnl${qs(params)}`, { headers })),
  paymentMethods: async (params = {}) => handleResponse(await authFetch(`${API}/finances/payment-methods${qs(params)}`, { headers })),
  getAnalytics: async (params = {}) => handleResponse(await authFetch(`${API}/finances/analytics${qs(params)}`, { headers })),
  getForecast: async () => handleResponse(await authFetch(`${API}/finances/forecast`, { headers })),
  getStaffPerformance: async (params = {}) => handleResponse(await authFetch(`${API}/finances/staff-performance${qs(params)}`, { headers })),

  // ── Cash Register (legacy global balance + movements) ──
  getCashRegister: async (params = {}) => handleResponse(await authFetch(`${API}/finances/cash-register${qs(params)}`, { headers })),
  cashMovement: async (data) => handleResponse(await authFetch(`${API}/finances/cash-register/movement`, { method: 'POST', headers, body: JSON.stringify(data) })),

  // ── Cash Register Session (apertura/cierre per day) ──
  getRegisterToday: async () => handleResponse(await authFetch(`${API}/cash-register/today`, { headers })),
  openRegister: async (data) => handleResponse(await authFetch(`${API}/cash-register/open`, { method: 'POST', headers, body: JSON.stringify(data) })),
  closeRegister: async (data) => handleResponse(await authFetch(`${API}/cash-register/close`, { method: 'POST', headers, body: JSON.stringify(data) })),
  changeRegisterResponsible: async (data) => handleResponse(await authFetch(`${API}/cash-register/responsible`, { method: 'PUT', headers, body: JSON.stringify(data) })),
  getRegisterHistory: async (params = {}) => handleResponse(await authFetch(`${API}/cash-register/history${qs(params)}`, { headers })),

  // ── Fines ──
  createFine: async (data) => handleResponse(await authFetch(`${API}/finances/fines`, { method: 'POST', headers, body: JSON.stringify(data) })),
  deleteFine: async (id) => handleResponse(await authFetch(`${API}/finances/fines/${id}`, { method: 'DELETE', headers })),

  // ── Staff Payments (Nómina) ──
  getPayrollSummary: async (params = {}) => handleResponse(await authFetch(`${API}/staff-payments/summary${qs(params)}`, { headers })),
  listPayments: async (params = {}) => handleResponse(await authFetch(`${API}/staff-payments/${qs(params)}`, { headers })),
  createPayment: async (data) => handleResponse(await authFetch(`${API}/staff-payments/`, { method: 'POST', headers, body: JSON.stringify(data) })),
  deletePayment: async (id) => handleResponse(await authFetch(`${API}/staff-payments/${id}`, { method: 'DELETE', headers })),
  getPaymentDetail: async (id) => handleResponse(await authFetch(`${API}/staff-payments/${id}/detail`, { headers })),
  getStaffVisits: async (params = {}) => handleResponse(await authFetch(`${API}/staff-payments/visits${qs(params)}`, { headers })),
  unlinkVisit: async (visitId) => handleResponse(await authFetch(`${API}/staff-payments/visits/${visitId}/unlink`, { method: 'PUT', headers })),
  getBankInfo: async (staffId) => handleResponse(await authFetch(`${API}/staff-payments/bank-info/${staffId}`, { headers })),

  // ── WhatsApp ──
  sendDocument: async (data) => handleResponse(await authFetch(`${API}/whatsapp/send-document`, { method: 'POST', headers, body: JSON.stringify(data) })),
  sendText: async (data) => handleResponse(await authFetch(`${API}/whatsapp/send-text`, { method: 'POST', headers, body: JSON.stringify(data) })),

  // ── Staff ──
  getStaff: async (id) => handleResponse(await authFetch(`${API}/staff/${id}`, { headers })),
  listStaff: async () => handleResponse(await authFetch(`${API}/staff`, { headers })),

  // ── My (Staff view) ──
  getMyCommissions: async (params = {}) => handleResponse(await authFetch(`${API}/my/commissions${qs(params)}`, { headers })),
  getMyStats: async () => handleResponse(await authFetch(`${API}/my/stats`, { headers })),

  // ── Summary ──
  getSummary: async (params = {}) => handleResponse(await authFetch(`${API}/finances/summary${qs(params)}`, { headers })),

  // ── Export ──
  exportTransactions: async (params = {}) => handleBlobResponse(await authFetch(`${API}/finances/export${qs(params)}`)),
  exportExcel: async (params = {}) => handleBlobResponse(await authFetch(`${API}/finances/export-excel${qs(params)}`)),
  exportClients: async () => handleBlobResponse(await authFetch(`${API}/clients/export`)),
  importClients: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return handleResponse(await authFetch(`${API}/clients/import`, { method: 'POST', body: formData }));
  },
};

export default financeService;
