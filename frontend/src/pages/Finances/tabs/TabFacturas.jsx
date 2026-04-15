import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNotification } from '../../../context/NotificationContext';
import { useTenant } from '../../../context/TenantContext';
import { formatPhone } from '../../../utils/formatters';
import financeService from '../../../services/financeService';
import clientService from '../../../services/clientService';
import servicesService from '../../../services/servicesService';
import staffService from '../../../services/staffService';
import {
  Icons, PAYMENT_METHODS, STATUS_COLORS, STATUS_LABELS, STATUS_ICONS,
  formatCOP, AnimatedNumber, SkeletonBlock, API_URL,
} from '../financeConstants';

const TabFacturas = ({ period, dateFrom, dateTo, isStaffView = false, staffUser = null }) => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [svcCommRates, setSvcCommRates] = useState({}); // { `staffId-serviceId`: rate }
  const [methodFilter, setMethodFilter] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invDateFrom, setInvDateFrom] = useState('');
  const [invDateTo, setInvDateTo] = useState('');
  const [sendingWA, setSendingWA] = useState(null); // invoice id being sent
  const [selectedInvs, setSelectedInvs] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(false);
  const [dianFeedback, setDianFeedback] = useState(null); // { type: 'success'|'error'|'info', message: '' }

  const [allClients, setAllClients] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const searchTimer = useRef(null);
  const clientSearchRef = useRef(null);

  const [uninvoicedVisits, setUninvoicedVisits] = useState([]);
  const [showVisitImport, setShowVisitImport] = useState(false);

  const [sendingDianId, setSendingDianId] = useState(null); // single invoice DIAN send

  const [form, setForm] = useState({
    client_name: '', client_phone: '', client_document: '', client_document_type: 'CC',
    client_email: '', client_address: '',
    payment_method: '', payment_terms: 'contado', due_date: '',
    tax_rate: 0.19,
    discount_type: '', discount_value: '',
    notes: '',
    items: [{ service_name: '', quantity: 1, unit_price: '', staff_name: '', visit_id: null }],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data = await financeService.listInvoices();
      // Staff: only show invoices where this staff is assigned
      if (isStaffView && staffUser?.name) {
        const staffName = staffUser.name.toLowerCase();
        data = data.filter(inv =>
          (inv.items || []).some(it => it.staff_name && it.staff_name.toLowerCase().includes(staffName)) ||
          inv.staff_name_primary?.toLowerCase().includes(staffName)
        );
      }
      setInvoices(data);
    } catch (err) {
      addNotification('Error cargando facturas: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  // Filtered invoice list used for rendering AND exports
  const filteredInvList = useMemo(() => {
    return invoices
      .filter(inv => {
        if (methodFilter && inv.payment_method !== methodFilter) return false;
        if (invDateFrom || invDateTo) {
          const invDate = (inv.paid_at || inv.issued_date || inv.created_at || '').slice(0, 10);
          if (invDateFrom && invDate < invDateFrom) return false;
          if (invDateTo && invDate > invDateTo) return false;
        }
        if (!invoiceSearch) return true;
        const q = invoiceSearch.toLowerCase();
        const ticketMatch = (inv.notes || '').match(/\[CODIGO:([^\]]+)\]/);
        const ticket = ticketMatch ? ticketMatch[1] : '';
        const haystack = [
          inv.client_name, inv.client_phone, inv.invoice_number,
          inv.payment_method, String(inv.total), ticket,
          ...(inv.items || []).map(it => it.service_name),
          ...(inv.items || []).map(it => it.staff_name),
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at));
  }, [invoices, methodFilter, invDateFrom, invDateTo, invoiceSearch]);

  // Helper to send a single invoice to DIAN
  const handleSendSingleDian = async (invoiceId) => {
    setSendingDianId(invoiceId);
    try {
      const r = await fetch(`${API_URL}/invoices/assign-pos`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: [invoiceId] }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || 'Error al asignar POS'); }
      setDianFeedback({ type: 'success', message: 'Factura enviada al modulo DIAN con POS asignado.' });
      financeService.listInvoices().then(data => setInvoices(data)).catch(err => console.error('Error recargando facturas:', err));
    } catch (err) {
      setDianFeedback({ type: 'error', message: err.message || 'Error al asignar POS' });
    } finally { setSendingDianId(null); }
  };

  // Export helpers
  const getExportData = () => {
    const target = selectedInvs.size > 0 ? invoices.filter(i => selectedInvs.has(i.id)) : filteredInvList;
    return target;
  };

  const exportCSV = () => {
    const data = getExportData();
    const headers = ['Factura', 'Cliente', 'Documento', 'Email', 'Telefono', 'Servicio', 'Valor', 'Metodo', 'Fecha', 'Estado', 'DIAN'];
    const rows = data.map(inv => [inv.invoice_number, inv.client_name, `${inv.client_document_type || 'CC'}: ${inv.client_document || ''}`, inv.client_email || '', inv.client_phone || '', (inv.items || []).map(i => i.service_name).join('; '), inv.total, inv.payment_method || '', inv.issued_date || '', inv.status, inv.is_pos ? 'Si' : 'No']);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `facturas-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    addNotification(`${data.length} factura(s) exportada(s) a CSV`, 'success');
  };

  const exportExcel = () => {
    const data = getExportData();
    const rows = data.map(inv => `<tr><td>${inv.invoice_number}</td><td>${inv.client_name}</td><td>${inv.client_document_type || 'CC'}: ${inv.client_document || ''}</td><td>${inv.client_email || ''}</td><td>${inv.client_phone || ''}</td><td>${(inv.items || []).map(i => i.service_name).join(', ')}</td><td>${inv.total}</td><td>${inv.payment_method || ''}</td><td>${inv.issued_date || ''}</td><td>${inv.status}</td><td>${inv.is_pos ? 'Si' : 'No'}</td></tr>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"></head><body><h2>Facturas</h2><table border="1" cellpadding="4"><tr><th>Factura</th><th>Cliente</th><th>Documento</th><th>Email</th><th>Telefono</th><th>Servicio</th><th>Valor</th><th>Metodo</th><th>Fecha</th><th>Estado</th><th>DIAN</th></tr>${rows}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `facturas-${new Date().toISOString().slice(0,10)}.xls`; a.click();
    addNotification(`${data.length} factura(s) exportada(s) a Excel`, 'success');
  };

  useEffect(() => {
    clientService.list({ sort_by: 'name' }).then(setAllClients).catch(err => console.error('Error cargando clientes:', err));
    servicesService.list({ active: true }).then(setAllServices).catch(err => console.error('Error cargando servicios:', err));
    staffService.list({ active: true }).then(setAllStaff).catch(err => console.error('Error cargando staff:', err));
  }, []);

  const [staffDefaults, setStaffDefaults] = useState({}); // { staffId: defaultRate }

  // Load staff default rates once
  useEffect(() => {
    financeService.listCommissions()
      .then(data => {
        const m = {};
        (data || []).forEach(c => { m[c.staff_id] = c.default_rate || 0; });
        setStaffDefaults(m);
      }).catch(err => console.error('Error cargando comisiones:', err));
  }, []);

  // Load ALL commission rates from one endpoint
  useEffect(() => {
    fetch(`${API_URL}/services/all-commissions`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { rates: {} })
      .then(data => setSvcCommRates(data.rates || {}))
      .catch(err => console.error('Error cargando tasas de comision:', err));
  }, []);

  const handleClientSearch = (value) => {
    setClientSearch(value);
    setShowClientDropdown(true);
    if (selectedClient) { setSelectedClient(null); setForm(f => ({ ...f, client_name: '', client_phone: '', client_document: '' })); }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) { setClientResults([]); return; }
    searchTimer.current = setTimeout(() => {
      const q = value.toLowerCase();
      const results = allClients.filter(c =>
        c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.client_id && c.client_id.toLowerCase().includes(q))
      ).slice(0, 8);
      setClientResults(results);
    }, 150);
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearch(client.name);
    setShowClientDropdown(false);
    setClientResults([]);
    setForm(f => ({
      ...f,
      client_name: client.name,
      client_phone: client.phone || '',
      client_document: '',
    }));
    financeService.getUninvoicedVisits({ client_id: client.id }).then(setUninvoicedVisits).catch(() => setUninvoicedVisits([]));
  };

  const handleImportVisit = (visit) => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items.filter(it => it.service_name), {
        service_name: visit.service_name,
        quantity: 1,
        unit_price: visit.amount.toString(),
        staff_name: visit.staff_name,
        visit_id: visit.id,
      }],
    }));
    setUninvoicedVisits(prev => prev.filter(v => v.id !== visit.id));
  };

  const handleServiceSelect = (idx, serviceName) => {
    const svc = allServices.find(s => s.name === serviceName);
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? {
        ...item,
        service_name: serviceName,
        unit_price: svc ? svc.price.toString() : item.unit_price,
      } : item),
    }));
  };

  const handleStaffSelect = (idx, staffName) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, staff_name: staffName } : item),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { service_name: '', quantity: 1, unit_price: '', staff_name: '', visit_id: null }] }));
  };

  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const subtotal = form.items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
  const discountAmount = form.discount_type === 'percent' ? Math.round(subtotal * (Number(form.discount_value) || 0) / 100)
    : form.discount_type === 'fixed' ? Math.min(Number(form.discount_value) || 0, subtotal) : 0;
  const taxable = subtotal - discountAmount;
  // IVA INCLUIDO: el precio ya contiene IVA, se descompone para reporting
  const baseAmount = form.tax_rate > 0 ? Math.round(taxable / (1 + form.tax_rate)) : taxable;
  const taxAmount = form.tax_rate > 0 ? taxable - baseAmount : 0;
  const total = taxable; // Cliente paga el mismo precio, IVA es interno

  const resetForm = () => {
    setShowForm(false);
    setSelectedClient(null);
    setClientSearch('');
    setUninvoicedVisits([]);
    setShowVisitImport(false);
    setForm({
      client_name: '', client_phone: '', client_document: '', client_document_type: 'CC',
      client_email: '', client_address: '',
      payment_method: '', payment_terms: 'contado', due_date: '',
      tax_rate: 0.19,
      discount_type: '', discount_value: '',
      notes: '',
      items: [{ service_name: '', quantity: 1, unit_price: '', staff_name: '', visit_id: null }],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalClientName = form.client_name || clientSearch.trim();
    if (!finalClientName || form.items.some((it) => !it.service_name || !it.unit_price)) {
      addNotification('Completa nombre del cliente y todos los servicios', 'error');
      return;
    }
    try {
      await financeService.createInvoice({
        ...form,
        client_name: finalClientName,
        discount_type: form.discount_type || undefined,
        discount_value: Number(form.discount_value) || 0,
        due_date: form.payment_terms === 'credito' && form.due_date ? form.due_date : undefined,
        items: form.items.map((it) => ({ ...it, unit_price: Number(it.unit_price), quantity: Number(it.quantity) || 1, visit_id: it.visit_id || undefined })),
      });
      addNotification('Factura creada', 'success');
      resetForm();
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await financeService.updateInvoice(id, { status });
      addNotification(`Factura marcada como ${STATUS_LABELS[status] || status}`, 'success');
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const { totalFacturado, paidCount, pendingCount, pendingAmount } = useMemo(() => {
    let total = 0, paid = 0, pending = 0, pendingAmt = 0;
    for (const inv of invoices) {
      if (inv.status !== 'cancelled') total += inv.total;
      if (inv.status === 'paid') paid++;
      if (inv.status === 'draft' || inv.status === 'sent') { pending++; pendingAmt += inv.total; }
    }
    return { totalFacturado: total, paidCount: paid, pendingCount: pending, pendingAmount: pendingAmt };
  }, [invoices]);

  const servicesByCategory = useMemo(() => allServices.reduce((acc, svc) => {
    const cat = svc.category || 'Otros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(svc);
    return acc;
  }, {}), [allServices]);

  if (loading) {
    return (
      <div className="finances__comm-skeleton">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="finances__card" style={{ padding: '20px' }}>
            <SkeletonBlock width="100%" height="80px" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.fileText}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{invoices.length}</span>
            <span className="finances__kpi-label">Facturas Emitidas</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalFacturado} prefix="$" /></span>
            <span className="finances__kpi-label">Total Facturado</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.check}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{paidCount}</span>
            <span className="finances__kpi-label">Pagadas</span>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="finances__kpi-card finances__kpi-card--warning">
            <div className="finances__kpi-icon finances__kpi-icon--warning">{Icons.alert}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value">{pendingCount}</span>
              <span className="finances__kpi-label">Pendientes ({formatCOP(pendingAmount)})</span>
            </div>
          </div>
        )}
      </div>
      <div className="finances__section-header">
        <h3 className="finances__section-title">
          {invoices.length > 0 ? `${invoices.length} factura${invoices.length !== 1 ? 's' : ''}` : 'Facturas'}
        </h3>
        {!isStaffView && (
          <button className="finances__action-btn" onClick={() => { showForm ? resetForm() : setShowForm(true); }}>
            {Icons.plus} Nueva Factura
          </button>
        )}
      </div>
      {showForm && (
        <form className="finances__invoice-form" onSubmit={handleSubmit}>
          <p className="finances__form-subtitle">Datos del cliente</p>
          <div className="finances__client-search-wrap" ref={clientSearchRef}>
            {selectedClient ? (
              <div className="finances__client-selected">
                <div className="finances__client-selected-avatar">
                  {selectedClient.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="finances__client-selected-info">
                  <span className="finances__client-selected-name">{selectedClient.name}</span>
                  <span className="finances__client-selected-meta">{selectedClient.client_id} · {formatPhone(selectedClient.phone)}</span>
                </div>
                <button type="button" className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => {
                  setSelectedClient(null);
                  setClientSearch('');
                  setForm(f => ({ ...f, client_name: '', client_phone: '', client_document: '' }));
                }}>Cambiar</button>
              </div>
            ) : (
              <div className="finances__client-search-box">
                <svg className="finances__client-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  className="finances__input"
                  type="text"
                  placeholder="Buscar cliente por nombre o teléfono..."
                  value={clientSearch}
                  onChange={(e) => handleClientSearch(e.target.value)}
                  onFocus={() => clientSearch.length >= 2 && setShowClientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                />
                {showClientDropdown && clientResults.length > 0 && (
                  <div className="finances__client-dropdown">
                    {clientResults.map((c) => (
                      <button key={c.id} type="button" className="finances__client-dropdown-item" onClick={() => handleSelectClient(c)}>
                        <span className="finances__client-dropdown-avatar">{c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                        <div className="finances__client-dropdown-info">
                          <span className="finances__client-dropdown-name">{c.name}</span>
                          <span className="finances__client-dropdown-meta">{c.client_id} · {formatPhone(c.phone)} · {c.total_visits || 0} visitas</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {clientSearch.length >= 2 && clientResults.length === 0 && showClientDropdown && (
                  <div className="finances__client-dropdown">
                    <div className="finances__client-dropdown-empty">
                      No se encontró — se creará como cliente nuevo
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {!selectedClient && clientSearch.length >= 2 && (
            <div className="finances__form-grid">
              <input className="finances__input" placeholder="Nombre *" value={form.client_name || clientSearch} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required />
              <input className="finances__input" placeholder="Teléfono" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
            </div>
          )}

          <p className="finances__form-subtitle" style={{ marginTop: 12 }}>Datos del receptor</p>
          <div className="finances__form-grid finances__form-grid--4">
            <select className="finances__select" value={form.client_document_type} onChange={(e) => setForm({ ...form, client_document_type: e.target.value })}>
              <option value="CC">CC</option>
              <option value="NIT">NIT</option>
              <option value="CE">CE</option>
              <option value="TI">TI</option>
              <option value="Pasaporte">Pasaporte</option>
              <option value="DIE">DIE</option>
            </select>
            <input className="finances__input" placeholder="Nro. documento" value={form.client_document} onChange={(e) => setForm({ ...form, client_document: e.target.value })} />
            <input className="finances__input" type="email" placeholder="Email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
            <input className="finances__input" placeholder="Dirección" value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} />
          </div>

          <p className="finances__form-subtitle" style={{ marginTop: 12 }}>Pago y condiciones</p>
          <div className="finances__form-grid finances__form-grid--4">
            <select className="finances__select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="">Método de pago</option>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select className="finances__select" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>
              <option value="contado">Contado</option>
              <option value="credito">Crédito</option>
            </select>
            {form.payment_terms === 'credito' && (
              <input className="finances__input" type="date" placeholder="Fecha vencimiento" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            )}
            <div className="finances__tax-toggle">
              <label className="finances__label-inline">
                <input type="checkbox" checked={form.tax_rate > 0} onChange={(e) => setForm({ ...form, tax_rate: e.target.checked ? 0.19 : 0 })} />
                <span>IVA (19%)</span>
              </label>
            </div>
          </div>

          <div className="finances__form-grid" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="finances__select" style={{ width: 120 }} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value, discount_value: '' })}>
                <option value="">Sin descuento</option>
                <option value="percent">% Porcentaje</option>
                <option value="fixed">$ Valor fijo</option>
              </select>
              {form.discount_type && (
                <input className="finances__input" type="number" min="0" placeholder={form.discount_type === 'percent' ? '% descuento' : '$ descuento'}
                  value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} style={{ width: 130 }} />
              )}
              {discountAmount > 0 && <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>-{formatCOP(discountAmount)}</span>}
            </div>
            <input className="finances__input" placeholder="Notas / observaciones" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {selectedClient && uninvoicedVisits.length > 0 && (
            <div className="finances__uninvoiced">
              <button type="button" className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => setShowVisitImport(!showVisitImport)}>
                {Icons.receipt} Importar desde visitas ({uninvoicedVisits.length} sin facturar)
              </button>
              {showVisitImport && (
                <div className="finances__uninvoiced-list">
                  {uninvoicedVisits.map((v) => (
                    <button key={v.id} type="button" className="finances__uninvoiced-item" onClick={() => handleImportVisit(v)}>
                      <span className="finances__uninvoiced-date">{new Date(v.visit_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                      <span className="finances__uninvoiced-service">{v.service_name}</span>
                      <span className="finances__uninvoiced-staff">{v.staff_name}</span>
                      <span className="finances__uninvoiced-amount">{formatCOP(v.amount)}</span>
                      <span className="finances__uninvoiced-add">{Icons.plus}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="finances__form-subtitle">Servicios facturados</p>
          <div className="finances__invoice-items">
            {form.items.map((item, idx) => (
              <div key={idx} className="finances__invoice-item-row">
                <select
                  className="finances__select"
                  value={item.service_name}
                  onChange={(e) => handleServiceSelect(idx, e.target.value)}
                  required
                >
                  <option value="">Servicio *</option>
                  {Object.entries(servicesByCategory).map(([cat, svcs]) => (
                    <optgroup key={cat} label={cat}>
                      {svcs.map(s => (
                        <option key={s.id} value={s.name}>{s.name} — {formatCOP(s.price)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <input className="finances__input finances__input--sm" type="number" min="1" placeholder="Cant" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                <input className="finances__input" type="number" placeholder="Precio *" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} required />
                <select
                  className="finances__select"
                  value={item.staff_name}
                  onChange={(e) => handleStaffSelect(idx, e.target.value)}
                >
                  <option value="">Profesional</option>
                  {allStaff.map(s => (
                    <option key={s.id} value={s.name}>{s.name}{s.role ? ` — ${s.role}` : ''}</option>
                  ))}
                </select>

                {form.items.length > 1 && (
                  <button type="button" className="finances__icon-btn finances__icon-btn--danger" onClick={() => removeItem(idx)}>{Icons.trash}</button>
                )}
              </div>
            ))}
            <button type="button" className="finances__btn-ghost finances__btn-ghost--sm" onClick={addItem}>{Icons.plus} Agregar servicio</button>
          </div>

          <div className="finances__invoice-totals">
            {form.tax_rate > 0 && (
              <div className="finances__pnl-row" style={{ fontSize: 12, color: '#64748B' }}><span>Base gravable</span><span>{formatCOP(baseAmount)}</span></div>
            )}
            {form.tax_rate > 0 && (
              <div className="finances__pnl-row" style={{ fontSize: 12, color: '#64748B' }}><span>IVA incluido ({(form.tax_rate * 100).toFixed(0)}%)</span><span>{formatCOP(taxAmount)}</span></div>
            )}
            {discountAmount > 0 && (
              <div className="finances__pnl-row" style={{ color: '#DC2626' }}><span>Descuento {form.discount_type === 'percent' ? `(${form.discount_value}%)` : ''}</span><span>-{formatCOP(discountAmount)}</span></div>
            )}
            <div className="finances__pnl-divider" />
            <div className="finances__pnl-row finances__pnl-row--total"><span>Total a cobrar</span><span>{formatCOP(total)}</span></div>
          </div>

          <div className="finances__form-actions">
            <button type="button" className="finances__btn-ghost" onClick={resetForm}>Cancelar</button>
            <button type="submit" className="finances__btn-primary">{Icons.check} Crear Factura</button>
          </div>
        </form>
      )}
      {invoices.length > 0 ? (
        <>
        <div className="finances__inv-filters">
          <div>
          <div className="finances__inv-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              placeholder="Buscar por cliente, factura, ticket, servicio, monto..."
              value={invoiceSearch}
              onChange={e => setInvoiceSearch(e.target.value)}
            />
            {invoiceSearch && (
              <button onClick={() => setInvoiceSearch('')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
          <div className="finances__inv-date-range">
            <input type="date" value={invDateFrom} onChange={e => setInvDateFrom(e.target.value)} title="Desde" />
            <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
            <input type="date" value={invDateTo} onChange={e => setInvDateTo(e.target.value)} title="Hasta" />
            {(invDateFrom || invDateTo) && (
              <button className="finances__inv-date-clear" onClick={() => { setInvDateFrom(''); setInvDateTo(''); }} title="Limpiar fechas">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
          </div>
          <div className="finances__method-filters">
            <button className={`finances__method-chip ${!methodFilter ? 'finances__method-chip--active' : ''}`} onClick={() => setMethodFilter('')}>Todos</button>
            {[...new Set(invoices.map(inv => inv.payment_method).filter(Boolean))].map(m => (
              <button key={m} className={`finances__method-chip ${methodFilter === m ? 'finances__method-chip--active' : ''}`} onClick={() => setMethodFilter(prev => prev === m ? '' : m)}>
                {PAYMENT_METHODS.find(p => p.value === m)?.label || m}
                <span className="finances__method-chip-count">{invoices.filter(inv => inv.payment_method === m).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="finances__sale-table">
          <div className="finances__sale-thead">
            <span className="finances__sale-th" style={{ width: '36px' }}>
              <input type="checkbox" checked={selectedInvs.size > 0 && selectedInvs.size === invoices.length} onChange={() => { if (selectedInvs.size === invoices.length) setSelectedInvs(new Set()); else setSelectedInvs(new Set(invoices.map(i => i.id))); }} style={{ cursor: 'pointer', accentColor: '#6366F1' }} />
            </span>
            <span className="finances__sale-th" style={{ width: '80px' }}>Hora</span>
            <span className="finances__sale-th" style={{ width: '80px' }}>Estado</span>
            <span className="finances__sale-th" style={{ flex: 1 }}>Cliente</span>
            <span className="finances__sale-th" style={{ flex: 1.5 }}>Servicio / Producto</span>
            <span className="finances__sale-th" style={{ width: '110px', textAlign: 'right' }}>Valor</span>
            <span className="finances__sale-th" style={{ width: '130px' }}>Medio de pago</span>
            <span className="finances__sale-th" style={{ width: '50px' }} />
          </div>
          {/* DIAN inline feedback */}
          {dianFeedback && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', marginBottom: 8, borderRadius: 8,
              background: dianFeedback.type === 'success' ? 'rgba(5,150,105,0.05)' : dianFeedback.type === 'error' ? 'rgba(220,38,38,0.04)' : 'rgba(99,102,241,0.05)',
              border: `1px solid ${dianFeedback.type === 'success' ? 'rgba(5,150,105,0.15)' : dianFeedback.type === 'error' ? 'rgba(220,38,38,0.12)' : 'rgba(99,102,241,0.12)'}` }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dianFeedback.type === 'success' ? '#059669' : dianFeedback.type === 'error' ? '#DC2626' : '#6366F1'} strokeWidth="2">
                {dianFeedback.type === 'success' ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> :
                 <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
              </svg>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: dianFeedback.type === 'success' ? '#065F46' : dianFeedback.type === 'error' ? '#991B1B' : '#3730A3' }}>{dianFeedback.message}</span>
              <button onClick={() => setDianFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(0,0,0,0.25)', fontSize: 16, lineHeight: 1 }}>&times;</button>
            </div>
          )}

          {/* Export toolbar — always visible */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', marginBottom: 6, borderRadius: 8, background: '#FAFBFC', border: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {selectedInvs.size > 0 ? `${selectedInvs.size} seleccionada${selectedInvs.size !== 1 ? 's' : ''}` : `${filteredInvList.length} factura${filteredInvList.length !== 1 ? 's' : ''}`}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* DIAN — only when selected */}
              {selectedInvs.size > 0 && (
                <button onClick={async () => {
                  setDianFeedback(null);
                  const alreadyInDian = invoices.filter(i => selectedInvs.has(i.id) && i.is_pos);
                  if (alreadyInDian.length === selectedInvs.size) {
                    setDianFeedback({ type: 'info', message: `${alreadyInDian.length === 1 ? 'Esta factura ya esta' : 'Estas facturas ya estan'} en el modulo DIAN.` });
                    return;
                  }
                  const onlyNew = [...selectedInvs].filter(id => !invoices.find(i => i.id === id && i.is_pos));
                  try {
                    const r = await fetch(`${API_URL}/invoices/assign-pos`, {
                      method: 'POST', credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ invoice_ids: onlyNew }),
                    });
                    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || 'Error al asignar POS'); }
                    const d = await r.json();
                    setDianFeedback({ type: 'success', message: `${d.count} factura(s) enviada(s) al modulo DIAN.${alreadyInDian.length > 0 ? ` ${alreadyInDian.length} ya tenian POS.` : ''}` });
                    setSelectedInvs(new Set());
                    financeService.listInvoices().then(data => setInvoices(data)).catch(err => console.error('Error recargando facturas:', err));
                  } catch (err) { setDianFeedback({ type: 'error', message: err.message }); }
                }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#4F46E5', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                  Enviar a DIAN
                </button>
              )}
              {/* Exports — always available */}
              <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)', background: 'white', fontSize: 11, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                CSV
              </button>
              <button onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)', background: 'white', fontSize: 11, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#217346" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                Excel
              </button>
              {/* Delete — only when selected */}
              {selectedInvs.size > 0 && (
                <button onClick={async () => {
                  if (!window.confirm(`Eliminar ${selectedInvs.size} factura(s)?`)) return;
                  let ok = 0;
                  for (const id of selectedInvs) {
                    try { await financeService.cancelInvoice(id); ok++; } catch (err) { console.error(`Error eliminando factura ${id}:`, err); }
                  }
                  addNotification(`${ok} factura(s) eliminada(s)`, 'success');
                  setSelectedInvs(new Set()); load();
                }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.15)', background: 'rgba(220,38,38,0.03)', fontSize: 11, fontWeight: 600, color: '#DC2626', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  Eliminar
                </button>
              )}
            </div>
          </div>

          {filteredInvList.map((inv) => {
            const isExpanded = expandedId === inv.id;
            const tipAmount = inv.tip || 0;
            const serviceRevenue = inv.total - tipAmount;
            const ivaAmount = inv.tax_amount || 0;
            // Use FROZEN commission from checkout if available (immutable after payment)
            let staffCommission;
            let commissionRate = inv.staff_commission_rate || 0.5;
            const frozenItems = inv.frozen_items || [];
            const hasFrozen = frozenItems.some(fi => fi.commission_amount != null);
            if (hasFrozen) {
              staffCommission = frozenItems.reduce((sum, fi) => sum + (fi.commission_amount || 0), 0);
              const firstRate = frozenItems.find(fi => fi.commission_rate != null);
              if (firstRate) commissionRate = firstRate.commission_rate;
            } else {
              staffCommission = Math.round(serviceRevenue * commissionRate);
            }
            const staffEarnings = staffCommission + tipAmount;
            const businessEarnings = serviceRevenue - staffCommission - ivaAmount;
            const staffNames = [...new Set((inv.items || []).filter(it => it.staff_name).map(it => it.staff_name))];
            const primaryStaff = staffNames.length > 0 ? staffNames[0] : null;
            const paidTime = inv.paid_at ? new Date(inv.paid_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
            const visitCodeMatch = (inv.notes || '').match(/\[CODIGO:([^\]]+)\]/);
            const visitCode = visitCodeMatch ? visitCodeMatch[1] : null;
            const methodLabel = PAYMENT_METHODS.find(p => p.value === inv.payment_method)?.label || inv.payment_method || '—';

            return (
              <div key={inv.id} className={`finances__sale-row-wrap ${isExpanded ? 'finances__sale-row-wrap--expanded' : ''}`}>
                <div className="finances__sale-row" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                  <span className="finances__sale-td" style={{ width: '36px' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedInvs.has(inv.id)} onChange={() => setSelectedInvs(prev => { const n = new Set(prev); n.has(inv.id) ? n.delete(inv.id) : n.add(inv.id); return n; })} style={{ cursor: 'pointer', accentColor: '#6366F1' }} />
                  </span>
                  <span className="finances__sale-td finances__sale-td--time" style={{ width: '80px' }}>
                    <span className="finances__sale-time">{paidTime || '—'}</span>
                    <span className="finances__sale-invnum">{inv.invoice_number}</span>
                  </span>
                  <span className="finances__sale-td" style={{ width: '80px' }}>
                    <span className={`finances__inv-badge finances__inv-badge--${inv.status}`}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </span>
                  <span className="finances__sale-td finances__sale-td--client" style={{ flex: 1 }}>
                    <strong>{inv.client_name}</strong>
                    {!isStaffView && inv.client_phone && <small>{inv.client_phone}</small>}
                    {!isStaffView && inv.client_document && <small>{inv.client_document_type || 'CC'}: {inv.client_document}</small>}
                    {!isStaffView && inv.client_email && <small>{inv.client_email}</small>}
                  </span>
                  <span className="finances__sale-td finances__sale-td--services" style={{ flex: 1.5 }}>
                    {(inv.items || []).map((item, idx) => (
                      <div key={idx} className="finances__sale-svc-line">
                        <span className="finances__sale-svc-name">{item.service_name}</span>
                        {item.staff_name && <span className="finances__sale-svc-staff">{item.staff_name}</span>}
                      </div>
                    ))}
                  </span>
                  <span className="finances__sale-td" style={{ width: '110px', textAlign: 'right' }}>
                    <strong className="finances__sale-amount">{formatCOP(inv.total)}</strong>
                  </span>
                  <span className="finances__sale-td" style={{ width: '130px' }}>
                    <span className={`finances__inv-method-tag finances__inv-method-tag--${inv.payment_method}`}>{methodLabel}</span>
                  </span>
                  <span className="finances__sale-td" style={{ width: '80px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {inv.is_pos ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#059669', padding: '3px 8px', borderRadius: 4, background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.12)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        FE
                      </span>
                    ) : (
                      <button onClick={() => handleSendSingleDian(inv.id)} disabled={sendingDianId === inv.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#4F46E5', padding: '3px 8px', borderRadius: 4, background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        {sendingDianId === inv.id ? '...' : 'DIAN'}
                      </button>
                    )}
                  </span>
                  <span className="finances__sale-td" style={{ width: '50px' }}>
                    <svg className={`finances__inv-chevron ${isExpanded ? 'finances__inv-chevron--open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </span>
                </div>

                {isExpanded && (
                  <div className="finances__sale-detail">
                    {/* DIAN electronic invoice info */}
                    {inv.is_pos && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', marginBottom: 12, fontSize: 12, color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span>Factura electronica — <strong style={{ color: '#1E293B' }}>{inv.pos_full_number || `POS-${inv.pos_number}`}</strong></span>
                        {inv.dian_status && inv.dian_status !== 'pending' && (
                          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: inv.dian_status === 'accepted' ? '#059669' : inv.dian_status === 'sent' ? '#2563EB' : inv.dian_status === 'rejected' ? '#DC2626' : 'rgba(0,0,0,0.35)' }}>
                            {inv.dian_status === 'sent' ? 'Enviada' : inv.dian_status === 'accepted' ? 'Aceptada DIAN' : inv.dian_status === 'rejected' ? 'Rechazada' : inv.dian_status}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="finances__sale-detail-grid">
                      <div className="finances__sale-detail-col">
                        <h4>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5, verticalAlign: -1 }}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                          {isStaffView ? 'Servicios realizados' : 'Items facturados'}
                        </h4>
                        <div className="finances__sale-detail-items">
                          {(inv.items || []).map((item, idx) => {
                            const frozenItem = frozenItems.find(fi => fi.service_name === item.service_name && fi.staff_id === item.staff_id);
                            const itemRate = frozenItem?.commission_rate || (item.staff_id && item.service_id ? (svcCommRates[`${item.staff_id}-${item.service_id}`] || commissionRate) : commissionRate);
                            const itemComm = frozenItem?.commission_amount || Math.round((item.total || 0) * itemRate);
                            const itemPct = Math.round(itemRate * 100);
                            return (
                              <div key={idx} className="finances__sale-detail-item">
                                <div className="finances__sale-detail-item-main">
                                  <span className="finances__sale-detail-item-name">{item.service_name}</span>
                                  <span className="finances__sale-detail-item-price" style={isStaffView ? { color: '#059669' } : {}}>
                                    {isStaffView ? formatCOP(itemComm) : formatCOP(item.total)}
                                  </span>
                                </div>
                                <div className="finances__sale-detail-item-meta">
                                  {!isStaffView && item.staff_name && <span>Profesional: {item.staff_name}</span>}
                                  <span>Cant: {item.quantity}</span>
                                  {!isStaffView && <span>P/U: {formatCOP(item.unit_price)}</span>}
                                  {isStaffView && <span>Tu ganancia ({itemPct}%)</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="finances__sale-detail-col">
                        <h4>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5, verticalAlign: -1 }}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                          {isStaffView ? 'Tu ganancia' : 'Resumen financiero'}
                        </h4>
                        <div className="finances__sale-detail-summary">
                          {isStaffView ? (() => {
                            // Calculate real commission from frozen items or per-item rates
                            const realComm = hasFrozen
                              ? frozenItems.reduce((s, fi) => s + (fi.commission_amount || 0), 0)
                              : (inv.items || []).reduce((s, it) => {
                                  const r = (it.staff_id && it.service_id && svcCommRates[`${it.staff_id}-${it.service_id}`]) || commissionRate;
                                  return s + Math.round((it.total || 0) * r);
                                }, 0);
                            return (
                              <>
                                <div className="finances__sale-summary-line"><span>Tu comision</span><span>{formatCOP(realComm)}</span></div>
                                {inv.tip > 0 && <div className="finances__sale-summary-line"><span>Propina</span><span style={{ color: '#10B981' }}>+{formatCOP(inv.tip)}</span></div>}
                                <div className="finances__sale-summary-line finances__sale-summary-line--total"><span>TU TOTAL</span><span>{formatCOP(realComm + (inv.tip || 0))}</span></div>
                              </>
                            );
                          })() : (
                            <>
                              <div className="finances__sale-summary-line"><span>Subtotal</span><span>{formatCOP(inv.subtotal)}</span></div>
                              {inv.discount_amount > 0 && <div className="finances__sale-summary-line finances__sale-summary-line--discount"><span>Descuento</span><span>-{formatCOP(inv.discount_amount)}</span></div>}
                              {inv.tax_amount > 0 && <div className="finances__sale-summary-line"><span>IVA ({(inv.tax_rate * 100).toFixed(0)}%)</span><span>{formatCOP(inv.tax_amount)}</span></div>}
                              {inv.tip > 0 && <div className="finances__sale-summary-line"><span>Propina</span><span>+{formatCOP(inv.tip)}</span></div>}
                              <div className="finances__sale-summary-line finances__sale-summary-line--total"><span>TOTAL</span><span>{formatCOP(inv.total)}</span></div>
                            </>
                          )}
                          {inv.payment_method === 'efectivo' && inv.payment_details?.received > 0 && (
                            <>
                              <div className="finances__sale-summary-line" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
                                <span>Efectivo recibido</span><span>{formatCOP(inv.payment_details.received)}</span>
                              </div>
                              {inv.payment_details.change > 0 && (
                                <div className="finances__sale-summary-line" style={{ color: '#D97706' }}>
                                  <span>Cambio entregado</span><span>{formatCOP(inv.payment_details.change)}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {!isStaffView && (() => {
                          // Group items by staff with per-service rates (admin only)
                          const byStaff = {};
                          (inv.items || []).forEach(it => {
                            const name = it.staff_name || 'Sin asignar';
                            if (!byStaff[name]) byStaff[name] = { name, staffId: it.staff_id, items: [], total: 0, comm: 0 };
                            const isProduct = (it.service_name || '').startsWith('[Producto]');
                            const itemTotal = (it.unit_price || 0) * (it.quantity || 1);
                            let rate = 0, c = 0;
                            if (isProduct) {
                              // Products use fixed commission, not percentage
                              c = 0; // Fixed commission stored elsewhere, not in rate
                              rate = 0;
                            } else {
                              const key = `${it.staff_id}-${it.service_id}`;
                              const perSvcRate = it.service_id ? svcCommRates[key] : undefined;
                              const defRate = staffDefaults[it.staff_id];
                              rate = perSvcRate > 0 ? perSvcRate : defRate > 0 ? defRate : 0;
                              c = Math.round(itemTotal * rate);
                            }
                            byStaff[name].items.push({ ...it, rate, commAmount: c, isProduct });
                            byStaff[name].total += itemTotal;
                            byStaff[name].comm += c;
                          });
                          const entries = Object.values(byStaff);
                          const totalComm = entries.reduce((s, e) => s + e.comm, 0);
                          const bizEarnings = (inv.total || 0) - (inv.tip || 0) - totalComm - (inv.tax_amount || 0);
                          if (!entries.length) return null;
                          return (
                            <div className="finances__sale-detail-commission">
                              {entries.map((s, idx) => (
                                <div key={idx}>
                                  <div className="finances__sale-commission-row" style={{ fontWeight: 700 }}>
                                    <span className="finances__sale-commission-dot finances__sale-commission-dot--staff" />
                                    <span>{s.name}</span>
                                    <strong>{formatCOP(s.total)}</strong>
                                  </div>
                                  {s.items.map((it, j) => (
                                    <div key={j} className="finances__sale-commission-row" style={{ paddingLeft: 20, fontSize: '0.78rem', color: '#64748B' }}>
                                      <span>{it.service_name}{it.isProduct ? '' : ` (${(it.rate * 100).toFixed(0)}%)`}</span>
                                      <strong style={{ color: '#059669' }}>{formatCOP(it.commAmount)}</strong>
                                    </div>
                                  ))}
                                  {idx < entries.length - 1 && <div style={{ borderBottom: '1px dashed #e2e8f0', margin: '4px 0' }} />}
                                </div>
                              ))}
                              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 6, paddingTop: 6 }}>
                                <div className="finances__sale-commission-row">
                                  <span className="finances__sale-commission-dot finances__sale-commission-dot--staff" />
                                  <span>{isStaffView ? 'Tu ganancia' : 'Total comisiones'}</span>
                                  <strong style={{ color: '#059669' }}>{formatCOP(totalComm)}</strong>
                                </div>
                                {!isStaffView && (
                                  <div className="finances__sale-commission-row">
                                    <span className="finances__sale-commission-dot finances__sale-commission-dot--biz" />
                                    <span>Ganancia negocio</span>
                                    <strong>{formatCOP(bizEarnings)}</strong>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="finances__sale-detail-footer">
                      <div className="finances__sale-detail-meta">
                        <span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          {inv.invoice_number}
                        </span>
                        {visitCode && <span style={{ fontWeight: 700, color: '#2D5A3D' }}>Codigo: {visitCode}</span>}
                        <span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          {new Date(inv.issued_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span>{methodLabel}{inv.payment_terms === 'credito' ? ' (Credito)' : ''}</span>
                        {inv.due_date && <span style={{ color: new Date(inv.due_date) < new Date() && inv.status !== 'paid' ? '#DC2626' : '#D97706' }}>Vence: {new Date(inv.due_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                        {!isStaffView && inv.client_document && <span>{inv.client_document_type || 'CC'}: {inv.client_document}</span>}
                        {!isStaffView && inv.client_email && <span>{inv.client_email}</span>}
                      </div>
                      {inv.receipt_url && (() => {
                        const url = inv.receipt_url;
                        const isImage = url.startsWith('data:image/') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                        const isPdf = url.startsWith('data:application/pdf') || url.match(/\.pdf$/i);
                        const isDoc = !isImage && !isPdf;
                        const docLabel = isPdf ? 'Ver PDF' : isDoc ? 'Descargar documento' : 'Ver comprobante';
                        // Convert data URI to Blob URL for secure viewing (no "Not secure" warning)
                        const openBlob = (dataUri) => {
                          try {
                            const [header, b64] = dataUri.split(',');
                            const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
                            const bytes = atob(b64);
                            const arr = new Uint8Array(bytes.length);
                            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                            const blob = new Blob([arr], { type: mime });
                            window.open(URL.createObjectURL(blob), '_blank');
                          } catch { window.open(dataUri, '_blank'); }
                        };
                        return (
                          <div className="finances__sale-receipt">
                            <span className="finances__sale-receipt-label">Comprobante adjunto</span>
                            {isImage ? (
                              <img src={url} alt="Comprobante" className="finances__sale-receipt-img" onClick={() => openBlob(url)} />
                            ) : isPdf ? (
                              <button onClick={() => openBlob(url)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                {docLabel}
                              </button>
                            ) : (
                              <button onClick={() => openBlob(url)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#f0f9ff', borderRadius: 8, color: '#1e40af', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                {docLabel}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                      <div className="finances__sale-detail-actions">
                        {!isStaffView && (inv.status === 'draft' || inv.status === 'sent') && (
                          <button className="finances__btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => handleStatusChange(inv.id, 'paid')}>
                            {Icons.check} Marcar pagada
                          </button>
                        )}
                        {!isStaffView && inv.status !== 'cancelled' && (
                          <button className="finances__icon-btn finances__icon-btn--danger" onClick={() => handleStatusChange(inv.id, 'cancelled')} title="Anular">
                            {Icons.trash}
                          </button>
                        )}
                        <button className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => {
                          const win = window.open('', '_blank', 'width=900,height=700');
                          const dateStr = new Date(inv.issued_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
                          const timeStr = inv.paid_at ? new Date(inv.paid_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                          const ml = PAYMENT_METHODS.find(p => p.value === inv.payment_method)?.label || inv.payment_method;
                          const tn = tenant || {};
                          win.document.write(`<html><head><title>Factura ${inv.invoice_number}</title><style>
                            *{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:48px;color:#1a1a1a;max-width:780px;margin:0 auto;font-size:13px}
                            .biz{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2D5A3D}
                            .biz-left{display:flex;align-items:center;gap:12px}.biz-logo{width:48px;height:48px;border-radius:10px;object-fit:cover}
                            .biz-name{font-size:20px;font-weight:800;letter-spacing:-0.02em}.biz-info{font-size:11px;color:#64748b;text-align:right}
                            .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
                            .header h2{font-size:18px;letter-spacing:-0.02em}.header-right{text-align:right;font-size:12px;color:#64748b}
                            .header-right strong{font-size:16px;color:#1a1a1a;display:block;margin-bottom:2px}
                            .client{background:#f8f9fb;padding:14px 20px;border-radius:10px;margin-bottom:20px;display:flex;gap:24px;flex-wrap:wrap;font-size:12px}
                            .client strong{font-size:13px;display:block;margin-bottom:1px}.client span{color:#64748b}
                            table{width:100%;border-collapse:collapse;margin:16px 0}
                            th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;padding:8px 0;border-bottom:2px solid #e5e7eb}th.r{text-align:right}
                            td{padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px}td.r{text-align:right;font-variant-numeric:tabular-nums}td.staff{font-size:11px;color:#64748b}
                            .product td{color:#92400e;font-style:italic}
                            .subtotal-row td{color:#64748b;font-size:12px;border-bottom:none;padding:5px 0}
                            .discount-row td{color:#dc2626;font-size:12px;border-bottom:none;padding:5px 0}
                            .total-row td{font-weight:800;font-size:18px;border-top:2px solid #1a1a1a;border-bottom:none;padding-top:12px}
                            .breakdown{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}
                            .box{padding:14px;background:#f8f9fb;border-radius:10px}.box h3{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:8px}
                            .box-row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#475569}.box-row strong{color:#1a1a1a}
                            .box-row.green strong{color:#059669}.box-row.blue strong{color:#2563eb}
                            .footer{margin-top:28px;padding-top:14px;border-top:1px dashed #d1d5db;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
                            .no-print{text-align:center;margin-top:20px}@media print{.no-print{display:none!important}body{padding:24px}}
                          </style></head><body>`);
                          // Business header
                          win.document.write(`<div class="biz"><div class="biz-left">${tn.logo_url ? `<img src="${tn.logo_url}" class="biz-logo">` : ''}<div><div class="biz-name">${tn.name || 'Negocio'}</div>${tn.nit ? `<span style="font-size:11px;color:#64748b">NIT: ${tn.nit}</span>` : ''}</div></div><div class="biz-info">${tn.address || ''}${tn.phone ? `<br>${tn.phone}` : ''}${tn.owner_email ? `<br>${tn.owner_email}` : ''}</div></div>`);
                          // Invoice header
                          win.document.write(`<div class="header"><div><h2>Factura ${inv.invoice_number}</h2><span style="color:#64748b;font-size:12px">${dateStr}${timeStr ? ' — ' + timeStr : ''}${visitCode ? ' — Codigo: ' + visitCode : ''}${inv.payment_terms === 'credito' && inv.due_date ? ` — Vence: ${new Date(inv.due_date+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})}` : ''}</span></div><div class="header-right"><strong>${formatCOP(inv.total)}</strong>${ml}${inv.payment_terms === 'credito' ? ' — Credito' : ''}</div></div>`);
                          // Client info (staff: only name + ticket)
                          if (isStaffView) {
                            win.document.write(`<div class="client"><div><strong>${inv.client_name || 'Cliente'}</strong><span>Cliente</span></div>${visitCode ? `<div><strong>${visitCode}</strong><span>Ticket</span></div>` : ''}</div>`);
                          } else {
                            win.document.write(`<div class="client"><div><strong>${inv.client_name || 'No registrado'}</strong><span>Cliente</span></div><div><strong>${inv.client_phone || 'No registrado'}</strong><span>Telefono</span></div><div><strong>${inv.client_document ? `${inv.client_document_type || 'CC'} ${inv.client_document}` : 'No registrado'}</strong><span>Documento</span></div><div><strong>${inv.client_email || 'No registrado'}</strong><span>Email</span></div>${visitCode ? `<div><strong>${visitCode}</strong><span>Ticket</span></div>` : ''}</div>`);
                          }
                          // Items table
                          if (isStaffView) {
                            win.document.write('<table><tr><th>Servicio</th><th>Cant.</th><th class="r">Tu ganancia</th></tr>');
                            (inv.items || []).forEach(it => {
                              const fi = frozenItems.find(f => f.service_name === it.service_name && f.staff_id === it.staff_id);
                              const iRate = fi?.commission_rate || (it.staff_id && it.service_id && svcCommRates[`${it.staff_id}-${it.service_id}`]) || commissionRate;
                              const iComm = fi?.commission_amount || Math.round((it.total || 0) * iRate);
                              win.document.write(`<tr><td>${it.service_name}</td><td>${it.quantity}</td><td class="r" style="color:#059669;font-weight:700">${formatCOP(iComm)}</td></tr>`);
                            });
                            const printTotalComm = hasFrozen ? frozenItems.reduce((s, f) => s + (f.commission_amount || 0), 0) : (inv.items || []).reduce((s, it) => { const r = (it.staff_id && it.service_id && svcCommRates[`${it.staff_id}-${it.service_id}`]) || commissionRate; return s + Math.round((it.total || 0) * r); }, 0);
                            if (inv.tip > 0) win.document.write(`<tr class="subtotal-row"><td colspan="2">Propina</td><td class="r" style="color:#059669">+${formatCOP(inv.tip)}</td></tr>`);
                            win.document.write(`<tr class="total-row"><td colspan="2">TU TOTAL</td><td class="r">${formatCOP(printTotalComm + (inv.tip || 0))}</td></tr></table>`);
                          } else {
                            win.document.write('<table><tr><th>Servicio / Producto</th><th>Profesional</th><th>Cant.</th><th class="r">P/U</th><th class="r">Total</th></tr>');
                            (inv.items || []).forEach(it => {
                              const isProduct = it.service_name?.startsWith('[Producto]');
                              win.document.write(`<tr class="${isProduct ? 'product' : ''}"><td>${it.service_name}</td><td class="staff">${it.staff_name || '—'}</td><td>${it.quantity}</td><td class="r">${formatCOP(it.unit_price)}</td><td class="r">${formatCOP(it.total)}</td></tr>`);
                            });
                            win.document.write(`<tr class="subtotal-row"><td colspan="4">Subtotal</td><td class="r">${formatCOP(inv.subtotal)}</td></tr>`);
                            if (inv.discount_amount > 0) win.document.write(`<tr class="discount-row"><td colspan="4">Descuento${inv.discount_type === 'percent' ? ` (${inv.discount_value}%)` : ''}</td><td class="r">-${formatCOP(inv.discount_amount)}</td></tr>`);
                            if (inv.tax_amount > 0) win.document.write(`<tr class="subtotal-row"><td colspan="4">IVA (${(inv.tax_rate*100).toFixed(0)}%)</td><td class="r">${formatCOP(inv.tax_amount)}</td></tr>`);
                            if (inv.tip > 0) win.document.write(`<tr class="subtotal-row"><td colspan="4">Propina</td><td class="r">+${formatCOP(inv.tip)}</td></tr>`);
                            win.document.write(`<tr class="total-row"><td colspan="4">TOTAL</td><td class="r">${formatCOP(inv.total)}</td></tr></table>`);
                          }
                          // Breakdown — per-staff commissions (admin only)
                          win.document.write('<div class="breakdown">');
                          if (isStaffView) {
                            // Staff print: just show their commission + tips
                            const staffPrintComm = hasFrozen
                              ? frozenItems.reduce((s, fi) => s + (fi.commission_amount || 0), 0)
                              : (inv.items || []).reduce((s, it) => { const r = (it.staff_id && it.service_id && svcCommRates[`${it.staff_id}-${it.service_id}`]) || commissionRate; return s + Math.round((it.total || 0) * r); }, 0);
                            win.document.write(`<div class="box"><h3>Tu ganancia</h3><div class="box-row"><span>Tu comision</span><strong style="color:#059669">${formatCOP(staffPrintComm)}</strong></div>${inv.tip > 0 ? `<div class="box-row"><span>Propina</span><strong style="color:#059669">+${formatCOP(inv.tip)}</strong></div>` : ''}<div class="box-row" style="font-weight:700;border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px"><span>TU TOTAL</span><strong>${formatCOP(staffPrintComm + (inv.tip || 0))}</strong></div></div>`);
                          } else {
                          {
                            const byStaff = {};
                            (inv.items || []).forEach(it => {
                              const name = it.staff_name || 'Sin asignar';
                              if (!byStaff[name]) byStaff[name] = { name, items: [], totalSvc: 0, totalComm: 0 };
                              const isProduct = (it.service_name || '').startsWith('[Producto]');
                              const itemTotal = (it.unit_price || 0) * (it.quantity || 1);
                              let rate = 0, comm = 0;
                              if (!isProduct) {
                                const pRate = it.service_id ? svcCommRates[`${it.staff_id}-${it.service_id}`] : undefined;
                                const dRate = it.staff_id ? staffDefaults[it.staff_id] : undefined;
                                rate = (pRate !== undefined && pRate > 0) ? pRate : (dRate !== undefined && dRate > 0) ? dRate : 0;
                                comm = Math.round(itemTotal * rate);
                              }
                              byStaff[name].items.push({ svc: it.service_name, rate, comm, isProduct });
                              byStaff[name].totalSvc += itemTotal;
                              byStaff[name].totalComm += comm;
                            });
                            const entries = Object.values(byStaff);
                            const totalComm = entries.reduce((s, e) => s + e.totalComm, 0);
                            const bizEarn = (inv.total || 0) - (inv.tip || 0) - totalComm;
                            let distHtml = '<div class="box"><h3>Distribucion por profesional</h3>';
                            entries.forEach(s => {
                              distHtml += `<div class="box-row" style="font-weight:700"><span>${s.name}</span><strong>${formatCOP(s.totalSvc)}</strong></div>`;
                              s.items.forEach(it => {
                                distHtml += `<div class="box-row" style="font-size:11px;color:#64748b;padding-left:12px"><span>${it.svc}${it.isProduct ? '' : ` (${(it.rate * 100).toFixed(0)}%)`}</span><strong style="color:#059669">${formatCOP(it.comm)}</strong></div>`;
                              });
                            });
                            distHtml += `<div style="border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px"><div class="box-row green"><span>Total comisiones</span><strong>${formatCOP(totalComm)}</strong></div><div class="box-row blue"><span>Ganancia negocio</span><strong>${formatCOP(bizEarn)}</strong></div></div></div>`;
                            win.document.write(distHtml);
                          }}
                          // Payment details
                          let payHtml = `<div class="box"><h3>Detalles de pago</h3><div class="box-row"><span>Metodo</span><strong>${ml}</strong></div>`;
                          if (inv.payment_method === 'efectivo' && inv.payment_details?.received > 0) {
                            payHtml += `<div class="box-row"><span>Efectivo recibido</span><strong>${formatCOP(inv.payment_details.received)}</strong></div>`;
                            if (inv.payment_details.change > 0) payHtml += `<div class="box-row" style="color:#D97706"><span>Cambio entregado</span><strong>${formatCOP(inv.payment_details.change)}</strong></div>`;
                          }
                          payHtml += `<div class="box-row"><span>Condicion</span><strong>${inv.payment_terms === 'credito' ? 'Credito' : 'Contado'}</strong></div><div class="box-row"><span>Estado</span><strong>${STATUS_LABELS[inv.status] || inv.status}</strong></div><div class="box-row"><span>Fecha</span><strong>${dateStr}</strong></div>${timeStr ? `<div class="box-row"><span>Hora</span><strong>${timeStr}</strong></div>` : ''}${visitCode ? `<div class="box-row"><span>Ticket</span><strong>${visitCode}</strong></div>` : ''}</div>`;
                          win.document.write(payHtml);
                          win.document.write('</div>');
                          win.document.write(`<div class="footer"><span>Factura ${inv.invoice_number} — ${dateStr}</span><span>Generado por Plexify Studio</span></div>`);
                          win.document.write('<div class="no-print"><button onclick="window.print()" style="background:#2D5A3D;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">Imprimir</button></div>');
                          win.document.write('</body></html>');
                          win.document.close();
                        }} title="Imprimir">
                          {Icons.fileText} Imprimir
                        </button>
                        {inv.client_phone && (
                          <button className="finances__btn-ghost finances__btn-ghost--sm" disabled={sendingWA === inv.id} onClick={async () => {
                            setSendingWA(inv.id);
                            try {
                              const r = await fetch(`${API_URL}/whatsapp/send-document`, {
                                method: 'POST', credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ phone: inv.client_phone, invoice_id: inv.id, name: inv.client_name }),
                              });
                              if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || 'Error enviando documento'); }
                              addNotification('Factura PDF enviada por WhatsApp', 'success');
                              if (inv.status === 'draft') handleStatusChange(inv.id, 'sent');
                            } catch (err) { addNotification('Error: ' + err.message, 'error'); }
                            finally { setSendingWA(null); }
                          }} title="Enviar factura PDF por WhatsApp">
                            {sendingWA === inv.id ? (
                              <><svg className="finances__spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Enviando PDF...</>
                            ) : (
                              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg> Enviar PDF</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
      ) : (
        <div className="finances__empty-state">
          <div className="finances__empty-state-icon">{Icons.fileText}</div>
          <p className="finances__empty-state-title">Sin facturas emitidas</p>
          <p className="finances__empty-state-text">Crea tu primera factura para comenzar a llevar un registro profesional de tus cobros</p>
          <button className="finances__action-btn" onClick={() => setShowForm(true)}>
            {Icons.plus} Crear primera factura
          </button>
        </div>
      )}
    </>
  );
};

export default TabFacturas;
