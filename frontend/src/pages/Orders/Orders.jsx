import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import orderService from '../../services/orderService';
import servicesService from '../../services/servicesService';
import staffService from '../../services/staffService';
import clientService from '../../services/clientService';
import { useNotification } from '../../context/NotificationContext';
import { formatPhone } from '../../utils/formatters';
import CheckoutModal from '../../components/common/CheckoutModal/CheckoutModal';

const b = 'orders';

const STATUS_META = {
  pending:     { label: 'Pendiente',   color: '#D4A017', bg: 'rgba(212,160,23,0.08)' },
  in_progress: { label: 'En proceso',  color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  completed:   { label: 'Completada',  color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  cancelled:   { label: 'Cancelada',   color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  no_show:     { label: 'No asistió', color: '#D4A017', bg: 'rgba(212,160,23,0.08)' },
};

const PAYMENT_META = {
  unpaid: { label: 'Sin pagar', color: '#D4A017' },
  paid:   { label: 'Pagada',    color: '#10B981' },
};

const PAY_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

const formatCOP = (n) => {
  if (!n && n !== 0) return '$0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });
};

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const TicketIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
  </svg>
);
const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const Orders = () => {
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [checkoutOrder, setCheckoutOrder] = useState(null);

  // Client search state
  const [clientSearchQ, setClientSearchQ] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isNewClient, setIsNewClient] = useState(false);

  // Form state
  const [form, setForm] = useState({
    ticket_number: '',
    client_name: '', client_phone: '', client_email: '',
    client_doc_type: '', client_doc_number: '', client_birthday: '',
    staff_id: '', notes: '',
  });
  const [formItems, setFormItems] = useState([]);
  const [formProducts, setFormProducts] = useState([]);
  const [svcSearch, setSvcSearch] = useState('');
  const [prodSearch, setProdSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [orderList, svcList, staffData, invData] = await Promise.all([
        orderService.list(),
        servicesService.list(),
        staffService.list(),
        fetch(`${API}/inventory/products`, { credentials: 'include' }).then(r => r.ok ? r.json() : { products: [] }).catch(() => ({ products: [] })),
      ]);
      setOrders(orderList);
      setServices(svcList.filter(s => s.is_active));
      setStaffList(staffData.filter(s => s.is_active !== false));
      setProducts(invData?.products || []);
    } catch (err) {
      addNotification('Error al cargar órdenes: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Block body scroll when drawer is open
  useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  // Client search debounce
  useEffect(() => {
    if (!clientSearchQ.trim() || isNewClient || selectedClient) { setClientResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchingClients(true);
      try {
        const res = await clientService.list({ search: clientSearchQ });
        setClientResults(Array.isArray(res) ? res.slice(0, 8) : []);
      } catch { setClientResults([]); }
      finally { setSearchingClients(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQ, isNewClient, selectedClient]);

  const selectClient = (c) => {
    setSelectedClient(c);
    setForm(p => ({
      ...p,
      client_name: c.name || '',
      client_phone: c.phone || '',
      client_email: c.email || '',
      client_doc_type: c.doc_type || '',
      client_doc_number: c.doc_number || '',
    }));
    setClientSearchQ('');
    setClientResults([]);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setIsNewClient(false);
    setClientSearchQ('');
    setForm(p => ({ ...p, client_name: '', client_phone: '', client_email: '', client_doc_type: '', client_doc_number: '' }));
  };

  const filtered = useMemo(() => {
    let list = [...orders];
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      list = list.filter(o => {
        if (o.ticket_number.toLowerCase().includes(q)) return true;
        if (o.client_name.toLowerCase().includes(q)) return true;
        if (qDigits && o.client_phone) {
          const ph = o.client_phone.replace(/\D/g, '');
          if (ph.includes(qDigits)) return true;
        }
        return false;
      });
    }
    return list;
  }, [orders, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { all: orders.length, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    orders.forEach(o => { if (c[o.status] !== undefined) c[o.status]++; });
    return c;
  }, [orders]);

  const openCreate = () => {
    setEditOrder(null);
    setSelectedClient(null);
    setIsNewClient(false);
    setClientSearchQ('');
    setForm({ ticket_number: '', client_name: '', client_phone: '', client_email: '', client_doc_type: '', client_doc_number: '', client_birthday: '', staff_id: '', notes: '' });
    setFormItems([]);
    setFormProducts([]);
    setSvcSearch('');
    setProdSearch('');
    setShowModal(true);
  };

  const openEdit = (o) => {
    setEditOrder(o);
    setSelectedClient(o.client_id ? { id: o.client_id, name: o.client_name, phone: o.client_phone } : null);
    setIsNewClient(!o.client_id);
    setClientSearchQ('');
    setForm({
      ticket_number: o.ticket_number || '',
      client_name: o.client_name || '', client_phone: o.client_phone || '',
      client_email: o.client_email || '', client_doc_type: o.client_doc_type || '',
      client_doc_number: o.client_doc_number || '', client_birthday: '', staff_id: o.staff_id || '',
      notes: o.notes || '',
    });
    setFormItems(o.items?.map(i => {
      const svc = services.find(s => s.id === i.service_id);
      return { service_id: i.service_id, service_name: i.service_name, price: i.price, duration_minutes: i.duration_minutes, staff_id: i.staff_id, staff_ids: svc?.staff_ids || [] };
    }) || []);
    setFormProducts(o.products?.map(p => ({ product_id: p.product_id, product_name: p.product_name, quantity: p.quantity, unit_price: p.unit_price, charged_to: p.charged_to })) || []);
    setSvcSearch('');
    setProdSearch('');
    setShowModal(true);
  };

  const addService = (svc) => {
    setFormItems(prev => [...prev, { service_id: svc.id, service_name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, staff_id: '', staff_ids: svc.staff_ids || [] }]);
    setSvcSearch('');
  };

  const updateItem = (idx, field, val) => {
    setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const removeService = (idx) => setFormItems(prev => prev.filter((_, i) => i !== idx));

  const addProduct = (prod) => {
    setFormProducts(prev => [...prev, { product_id: prod.id, product_name: prod.name, quantity: 1, unit_price: prod.price, charged_to: 'client' }]);
    setProdSearch('');
  };

  const removeProduct = (idx) => setFormProducts(prev => prev.filter((_, i) => i !== idx));

  const updateProduct = (idx, field, val) => {
    setFormProducts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };

  const formSubtotal = useMemo(() => {
    const svcTotal = formItems.reduce((s, i) => s + (i.price || 0), 0);
    const prodTotal = formProducts.filter(p => p.charged_to === 'client').reduce((s, p) => s + (p.quantity * p.unit_price), 0);
    return svcTotal + prodTotal;
  }, [formItems, formProducts]);

  const handleSave = async () => {
    if (!form.client_name.trim()) { addNotification('Nombre del cliente requerido', 'error'); return; }
    if (!formItems.length) { addNotification('Agrega al menos un servicio', 'error'); return; }
    setSubmitting(true);
    try {
      // Use first item's staff_id as order-level staff
      const mainStaff = formItems.find(it => it.staff_id)?.staff_id || null;
      const payload = {
        ...form,
        client_id: selectedClient?.id || null,
        staff_id: mainStaff ? parseInt(mainStaff) : null,
        items: formItems.map(it => ({ ...it, staff_id: it.staff_id ? parseInt(it.staff_id) : null })),
        products: formProducts,
      };
      if (editOrder) {
        await orderService.update(editOrder.id, payload);
        addNotification('Orden actualizada', 'success');
      } else {
        await orderService.create(payload);
        addNotification('Orden creada', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    try {
      await orderService.update(order.id, { status: newStatus });
      addNotification(`Orden: ${STATUS_META[newStatus]?.label || newStatus}`, 'success');
      // Update local editOrder so drawer reflects immediately
      if (editOrder?.id === order.id) setEditOrder(prev => ({ ...prev, status: newStatus }));
      loadData();
    } catch (err) { addNotification(err.message, 'error'); }
  };

  const handlePay = (order) => {
    // Use current form items if editing, otherwise order items
    const items = showModal && formItems.length ? formItems : order.items || [];
    // Validate at least one staff assigned
    const hasStaff = items.some(i => i.staff_id) || order.staff_id;
    if (!hasStaff) {
      addNotification('Debes asignar personal a al menos un servicio antes de cobrar', 'error');
      return;
    }
    const firstWithStaff = items.find(i => i.staff_id) || items[0] || {};
    const staffId = parseInt(firstWithStaff.staff_id) || order.staff_id;
    const staffName = staffList.find(s => s.id === staffId)?.name || order.staff_name || '';
    setCheckoutOrder({
      id: order.id,
      client_id: order.client_id,
      client_name: order.client_name || form.client_name,
      client_phone: order.client_phone || form.client_phone,
      service_id: firstWithStaff.service_id,
      service_name: firstWithStaff.service_name || 'Servicio',
      staff_id: staffId,
      staff_name: staffName,
      price: order.subtotal || order.total || items.reduce((s, i) => s + (i.price || 0), 0),
      notes: '',
      _order_id: order.id,
    });
    setShowModal(false);
  };

  const filteredSvc = svcSearch.length >= 2
    ? services.filter(s => s.name.toLowerCase().includes(svcSearch.toLowerCase()) && !formItems.some(fi => fi.service_id === s.id))
    : [];

  const filteredProd = prodSearch.length >= 2
    ? products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()) && !formProducts.some(fp => fp.product_id === p.id))
    : [];

  const revenue = useMemo(() => orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + (o.total || 0), 0), [orders]);
  const avgTime = useMemo(() => {
    const done = orders.filter(o => o.service_start_time && o.service_end_time);
    if (!done.length) return 0;
    return Math.round(done.reduce((s, o) => s + (new Date(o.service_end_time) - new Date(o.service_start_time)) / 60000, 0) / done.length);
  }, [orders]);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div className={`${b}__header-left`}>
          <h1 className={`${b}__title`}>Órdenes</h1>
          <span className={`${b}__subtitle`}>Gestión de servicios en proceso</span>
        </div>
        <button className={`${b}__create-btn`} onClick={openCreate}>
          <PlusIcon /> Nueva orden
        </button>
      </div>

      {/* ─── Metric Cards ────────────────────────────── */}
      <div className={`${b}__metrics`}>
        <div className={`${b}__metric`}>
          <div className={`${b}__metric-icon ${b}__metric-icon--warn`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          </div>
          <div className={`${b}__metric-data`}>
            <span className={`${b}__metric-val`}>{counts.pending}</span>
            <span className={`${b}__metric-label`}>En espera</span>
          </div>
        </div>
        <div className={`${b}__metric`}>
          <div className={`${b}__metric-icon ${b}__metric-icon--info`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div className={`${b}__metric-data`}>
            <span className={`${b}__metric-val`}>{counts.in_progress}</span>
            <span className={`${b}__metric-label`}>En proceso</span>
          </div>
        </div>
        <div className={`${b}__metric`}>
          <div className={`${b}__metric-icon ${b}__metric-icon--ok`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className={`${b}__metric-data`}>
            <span className={`${b}__metric-val`}>{counts.completed}</span>
            <span className={`${b}__metric-label`}>Completadas</span>
          </div>
        </div>
        <div className={`${b}__metric`}>
          <div className={`${b}__metric-icon ${b}__metric-icon--money`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className={`${b}__metric-data`}>
            <span className={`${b}__metric-val`}>{formatCOP(revenue)}</span>
            <span className={`${b}__metric-label`}>Ingresos por órdenes</span>
          </div>
        </div>
        <div className={`${b}__metric`}>
          <div className={`${b}__metric-icon ${b}__metric-icon--neutral`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div className={`${b}__metric-data`}>
            <span className={`${b}__metric-val`}>{orders.length}</span>
            <span className={`${b}__metric-label`}>Total hoy</span>
          </div>
        </div>
      </div>

      {/* ─── Toolbar ─────────────────────────────────── */}
      <div className={`${b}__toolbar`}>
        <div className={`${b}__search`}>
          <SearchIcon />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ticket, teléfono o nombre..." />
        </div>
        <div className={`${b}__filters`}>
          {[
            { key: 'all', label: 'Todas' },
            { key: 'pending', label: 'Pendientes' },
            { key: 'in_progress', label: 'En proceso' },
            { key: 'completed', label: 'Completadas' },
          ].map(f => (
            <button key={f.key}
              className={`${b}__filter ${statusFilter === f.key ? `${b}__filter--active` : ''}`}
              onClick={() => setStatusFilter(f.key)}>
              {f.label} <span className={`${b}__filter-count`}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={`${b}__loading`}>
          <div className={`${b}__spinner`} />
          <span>Cargando órdenes...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${b}__empty`}>
          <div className={`${b}__empty-visual`}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
            </svg>
          </div>
          <h3>No hay órdenes{statusFilter !== 'all' ? ` ${STATUS_META[statusFilter]?.label?.toLowerCase() || ''}s` : ''}</h3>
          <p>Las órdenes te permiten gestionar clientes que llegan sin cita previa.</p>
          <p>Asigna un ticket, registra servicios y productos, y procesa el pago al final.</p>
          <button className={`${b}__empty-btn`} onClick={openCreate}><PlusIcon /> Crear nueva orden</button>
        </div>
      ) : (
        <div className={`${b}__grid`}>
          {filtered.map(o => {
            const st = STATUS_META[o.status] || STATUS_META.pending;
            const py = PAYMENT_META[o.payment_status] || PAYMENT_META.unpaid;
            const initials = o.client_name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?';
            const svcCount = o.items?.length || 0;
            const prodCount = o.products?.length || 0;
            return (
              <div key={o.id} className={`${b}__card ${b}__card--${o.status}`} onClick={() => openEdit(o)}>
                {/* Header: status accent bar */}
                <div className={`${b}__card-accent`} style={{ background: st.color }} />

                {/* Ticket + Status */}
                <div className={`${b}__card-header`}>
                  <span className={`${b}__card-ticket`}>{o.ticket_number}</span>
                  <span className={`${b}__card-status`} style={{ color: st.color, background: st.bg }}>{st.label}</span>
                </div>

                {/* Client */}
                <div className={`${b}__card-client`}>
                  <div className={`${b}__card-avatar`} style={{ background: st.color }}>{initials}</div>
                  <div className={`${b}__card-client-info`}>
                    <strong>{o.client_name}</strong>
                    {o.client_phone && <span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                      {o.client_phone}
                    </span>}
                  </div>
                </div>

                {/* Services & Products summary */}
                <div className={`${b}__card-items`}>
                  <div className={`${b}__card-item-group`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                    <span>{svcCount} servicio{svcCount !== 1 ? 's' : ''}</span>
                  </div>
                  {prodCount > 0 && (
                    <div className={`${b}__card-item-group`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                      <span>{prodCount} producto{prodCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {/* Service tags */}
                <div className={`${b}__card-tags`}>
                  {o.items?.slice(0, 2).map((item, i) => (
                    <span key={i} className={`${b}__card-tag`}>{item.service_name}</span>
                  ))}
                  {svcCount > 2 && <span className={`${b}__card-tag ${b}__card-tag--more`}>+{svcCount - 2}</span>}
                </div>

                {/* Staff */}
                <div className={`${b}__card-staff`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  {o.staff_name
                    ? <span className={`${b}__card-staff-name`}>{o.staff_name}</span>
                    : <span className={`${b}__card-staff-pending`}>Por asignar</span>
                  }
                </div>

                {/* Footer: time + total + payment */}
                <div className={`${b}__card-footer`}>
                  <div className={`${b}__card-time`}>
                    <ClockIcon /> {fmtTime(o.arrival_time)}
                  </div>
                  <div className={`${b}__card-money`}>
                    <span className={`${b}__card-total`}>{formatCOP(o.total)}</span>
                    <span className={`${b}__card-pay`} style={{ color: py.color }}>{py.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── DRAWER ────────────────────────────────────── */}
      {showModal && createPortal(
        <div className={`${b}__overlay`} onClick={() => setShowModal(false)}>
          <div className={`${b}__drawer`} onClick={e => e.stopPropagation()}>

            {/* Drawer header */}
            <div className={`${b}__drawer-header`}>
              <button className={`${b}__drawer-back`} onClick={() => setShowModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div className={`${b}__drawer-title`}>
                <h2>{editOrder ? `Orden ${editOrder.ticket_number}` : 'Nueva orden'}</h2>
                {editOrder && <span className={`${b}__drawer-status`} style={{ color: STATUS_META[editOrder.status]?.color, background: STATUS_META[editOrder.status]?.bg }}>{STATUS_META[editOrder.status]?.label}</span>}
              </div>
              {editOrder && editOrder.payment_status === 'unpaid' && editOrder.status !== 'cancelled' && editOrder.status !== 'no_show' && (
                <button className={`${b}__drawer-action ${b}__drawer-action--pay`}
                  onClick={() => handlePay(editOrder)}>
                  Cobrar
                </button>
              )}
              {editOrder && editOrder.payment_status === 'paid' && (
                <button className={`${b}__drawer-action ${b}__drawer-action--unpay`}
                  onClick={async () => {
                    try {
                      await orderService.update(editOrder.id, { payment_status: 'unpaid', status: 'in_progress' });
                      addNotification('Pago revertido', 'success');
                      setShowModal(false);
                      loadData();
                    } catch (err) { addNotification(err.message, 'error'); }
                  }}>
                  Revertir pago
                </button>
              )}
            </div>

            {/* Status bar for existing orders */}
            {editOrder && (
              <div className={`${b}__status-bar`}>
                {[
                  { key: 'pending', label: 'Pendiente', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
                  { key: 'in_progress', label: 'En proceso', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg> },
                  { key: 'completed', label: 'Completada', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
                  { key: 'cancelled', label: 'Cancelada', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg> },
                  { key: 'no_show', label: 'No asistió', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><line x1="2" y1="2" x2="22" y2="22" /></svg> },
                ].map(s => (
                  <button key={s.key}
                    className={`${b}__status-btn ${editOrder.status === s.key ? `${b}__status-btn--active` : ''}`}
                    style={editOrder.status === s.key ? { color: STATUS_META[s.key]?.color, background: STATUS_META[s.key]?.bg } : {}}
                    onClick={() => { handleStatusChange(editOrder, s.key); }}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            )}

            <div className={`${b}__drawer-body`}>
              {/* ── Ticket ── */}
              <div className={`${b}__ticket-section`}>
                <div className={`${b}__ticket-icon`}><TicketIcon /></div>
                <div className={`${b}__ticket-field`}>
                  <label>N° Ticket</label>
                  <input value={form.ticket_number}
                    onChange={e => setForm(p => ({ ...p, ticket_number: e.target.value }))}
                    placeholder={editOrder ? editOrder.ticket_number : 'Auto si vacío'}
                  />
                </div>
              </div>

              {/* ── Cliente ── */}
              <div className={`${b}__section`}>
                <div className={`${b}__section-header`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  <h3>Cliente</h3>
                </div>
                {selectedClient && !isNewClient ? (
                  <div className={`${b}__client-chip`}>
                    <div className={`${b}__client-chip-avatar`}>
                      {selectedClient.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className={`${b}__client-chip-info`}>
                      <span className={`${b}__client-chip-name`}>{selectedClient.name}</span>
                      {selectedClient.phone && <span className={`${b}__client-chip-phone`}>{formatPhone(selectedClient.phone)}</span>}
                    </div>
                    <button className={`${b}__client-chip-x`} onClick={clearClient}><XIcon /></button>
                  </div>
                ) : isNewClient ? (
                  <div className={`${b}__new-client`}>
                    <div className={`${b}__new-client-header`}>
                      <span className={`${b}__new-client-badge`}>Nuevo cliente</span>
                      <button className={`${b}__new-client-cancel`} onClick={clearClient}>Buscar existente</button>
                    </div>
                    <div className={`${b}__form-grid`}>
                      <div className={`${b}__field`}><label>Nombre completo *</label><input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} autoFocus /></div>
                      <div className={`${b}__field`}><label>Teléfono *</label><input value={form.client_phone} onChange={e => setForm(p => ({ ...p, client_phone: e.target.value }))} placeholder="3XX XXX XXXX" /></div>
                      <div className={`${b}__field`}><label>Correo</label><input type="email" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} /></div>
                      <div className={`${b}__field`}><label>Nacimiento</label><input type="date" value={form.client_birthday} onChange={e => setForm(p => ({ ...p, client_birthday: e.target.value }))} /></div>
                      <div className={`${b}__field`}><label>Tipo doc.</label>
                        <select value={form.client_doc_type} onChange={e => setForm(p => ({ ...p, client_doc_type: e.target.value }))}>
                          <option value="">—</option><option value="CC">CC</option><option value="CE">CE</option><option value="TI">TI</option><option value="PP">Pasaporte</option><option value="NIT">NIT</option>
                        </select>
                      </div>
                      <div className={`${b}__field`}><label>N° Documento</label><input value={form.client_doc_number} onChange={e => setForm(p => ({ ...p, client_doc_number: e.target.value }))} /></div>
                    </div>
                  </div>
                ) : (
                  <div className={`${b}__client-search`}>
                    <div className={`${b}__client-search-box`}>
                      <SearchIcon />
                      <input value={clientSearchQ} onChange={e => setClientSearchQ(e.target.value)} placeholder="Nombre, teléfono o documento..." autoFocus />
                      {searchingClients && <div className={`${b}__client-search-spin`} />}
                    </div>
                    {clientResults.length > 0 && (
                      <div className={`${b}__client-results`}>
                        {clientResults.map(c => (
                          <button key={c.id} className={`${b}__client-result`} onClick={() => selectClient(c)}>
                            <div className={`${b}__client-result-avatar`}>{c.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}</div>
                            <div className={`${b}__client-result-info`}>
                              <strong>{c.name}</strong>
                              <span>{c.phone ? formatPhone(c.phone) : 'Sin teléfono'}{c.email ? ` · ${c.email}` : ''}</span>
                            </div>
                            {c.status && <span className={`${b}__client-result-tag ${b}__client-result-tag--${c.status}`}>{c.status}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {clientSearchQ.length >= 2 && !clientResults.length && !searchingClients && (
                      <div className={`${b}__client-no-result`}>No se encontró el cliente</div>
                    )}
                    <button className={`${b}__new-client-btn`} onClick={() => setIsNewClient(true)}><PlusIcon /> Registrar nuevo cliente</button>
                  </div>
                )}
              </div>

              {/* ── Servicios ── */}
              <div className={`${b}__section`}>
                <div className={`${b}__section-header`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                  <h3>Servicios</h3>
                </div>
                {formItems.map((item, i) => {
                  const svcDef = services.find(s => s.id === item.service_id);
                  const sids = item.staff_ids?.length ? item.staff_ids : svcDef?.staff_ids || [];
                  const eligible = sids.length
                    ? staffList.filter(s => sids.includes(s.id))
                    : staffList;
                  const assigned = staffList.find(s => s.id == item.staff_id);
                  return (
                    <div key={i} className={`${b}__svc-card`}>
                      <div className={`${b}__svc-card-top`}>
                        <div className={`${b}__svc-card-info`}>
                          <span className={`${b}__svc-card-name`}>{item.service_name}</span>
                          <span className={`${b}__svc-card-meta`}>{item.duration_minutes} min</span>
                        </div>
                        <span className={`${b}__svc-card-price`}>{formatCOP(item.price)}</span>
                        <button className={`${b}__item-remove`} onClick={() => removeService(i)}><TrashIcon /></button>
                      </div>
                      {eligible.length > 0 && (
                        <div className={`${b}__svc-staff`}>
                          <span className={`${b}__svc-staff-label`}>
                            {assigned ? 'Atendido por' : 'Asignar personal'}
                          </span>
                          <div className={`${b}__svc-staff-list`}>
                            {eligible.map(s => {
                              const active = item.staff_id == s.id;
                              return (
                                <button key={s.id}
                                  className={`${b}__staff-pill ${active ? `${b}__staff-pill--on` : ''}`}
                                  onClick={() => updateItem(i, 'staff_id', active ? '' : s.id)}>
                                  <div className={`${b}__staff-pill-av`} style={{ background: s.color || '#3B82F6' }}>
                                    {s.photo_url
                                      ? <img src={s.photo_url} alt="" />
                                      : <>{s.name?.[0]}</>
                                    }
                                  </div>
                                  <span>{s.name?.split(' ')[0]}</span>
                                  {active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className={`${b}__add-search`}>
                  <input placeholder="Buscar servicio para agregar..." value={svcSearch} onChange={e => setSvcSearch(e.target.value)} />
                  {filteredSvc.length > 0 && (
                    <div className={`${b}__add-dropdown`}>
                      {filteredSvc.slice(0, 8).map(s => (
                        <button key={s.id} onClick={() => addService(s)}>
                          <span>{s.name}</span>
                          <span className={`${b}__add-meta`}>{s.duration_minutes}min · {formatCOP(s.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Productos ── */}
              <div className={`${b}__section`}>
                <div className={`${b}__section-header`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                  <h3>Productos</h3>
                  <span className={`${b}__optional`}>opcional</span>
                </div>
                {formProducts.map((prod, i) => (
                  <div key={i} className={`${b}__prod-card`}>
                    <div className={`${b}__prod-card-top`}>
                      <span className={`${b}__prod-card-name`}>{prod.product_name}</span>
                      <span className={`${b}__prod-card-total`}>{formatCOP(prod.quantity * prod.unit_price)}</span>
                      <button className={`${b}__item-remove`} onClick={() => removeProduct(i)}><TrashIcon /></button>
                    </div>
                    <div className={`${b}__prod-card-fields`}>
                      <label>Cant.<input type="number" min="1" value={prod.quantity} onChange={e => updateProduct(i, 'quantity', parseInt(e.target.value) || 1)} /></label>
                      <label>Precio<input type="number" value={prod.unit_price} onChange={e => updateProduct(i, 'unit_price', parseInt(e.target.value) || 0)} /></label>
                      <label>Cobrar a
                        <select value={prod.charged_to} onChange={e => updateProduct(i, 'charged_to', e.target.value)}>
                          <option value="client">Cliente</option><option value="staff">Personal</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
                <div className={`${b}__add-search`}>
                  <input placeholder="Buscar producto..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                  {filteredProd.length > 0 && (
                    <div className={`${b}__add-dropdown`}>
                      {filteredProd.slice(0, 8).map(p => (
                        <button key={p.id} onClick={() => addProduct(p)}>
                          <span>{p.name}</span>
                          <span className={`${b}__add-meta`}>Stock: {p.stock} · {formatCOP(p.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Notas ── */}
              <div className={`${b}__section`}>
                <div className={`${b}__section-header`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  <h3>Notas</h3>
                  <span className={`${b}__optional`}>opcional</span>
                </div>
                <textarea className={`${b}__notes`} rows="2" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Indicaciones, preferencias..." />
              </div>
            </div>

            {/* Drawer footer */}
            <div className={`${b}__drawer-footer`}>
              <div className={`${b}__drawer-total`}>
                <span>Total</span>
                <strong>{formatCOP(formSubtotal)}</strong>
              </div>
              <button className={`${b}__btn-save`} onClick={handleSave} disabled={submitting}>
                {submitting ? 'Guardando...' : editOrder ? 'Guardar cambios' : 'Crear orden'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {checkoutOrder && (
        <CheckoutModal
          appointment={checkoutOrder}
          onClose={() => setCheckoutOrder(null)}
          onCompleted={async () => {
            // Mark order as completed + paid
            try {
              await orderService.update(checkoutOrder._order_id, { status: 'completed', payment_status: 'paid' });
            } catch {}
            setCheckoutOrder(null);
            loadData();
            addNotification('Cobro realizado exitosamente', 'success');
          }}
        />
      )}
    </div>
  );
};

export default Orders;
