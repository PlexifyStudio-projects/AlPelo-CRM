import { useState, useEffect, useMemo, useCallback } from 'react';
import orderService from '../../services/orderService';
import servicesService from '../../services/servicesService';
import staffService from '../../services/staffService';
import clientService from '../../services/clientService';
import { useNotification } from '../../context/NotificationContext';
import { formatPhone } from '../../utils/formatters';

const b = 'orders';

const STATUS_META = {
  pending:     { label: 'Pendiente',   color: '#D4A017', bg: 'rgba(212,160,23,0.08)' },
  in_progress: { label: 'En proceso',  color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  completed:   { label: 'Completada',  color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  cancelled:   { label: 'Cancelada',   color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
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
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
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
    setFormItems(o.items?.map(i => ({ service_id: i.service_id, service_name: i.service_name, price: i.price, duration_minutes: i.duration_minutes, staff_id: i.staff_id })) || []);
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
      addNotification(`Orden ${STATUS_META[newStatus]?.label || newStatus}`, 'success');
      loadData();
    } catch (err) { addNotification(err.message, 'error'); }
  };

  const handlePay = async (order) => {
    try {
      await orderService.update(order.id, { payment_status: 'paid', status: 'completed' });
      addNotification('Pago registrado', 'success');
      loadData();
    } catch (err) { addNotification(err.message, 'error'); }
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
            return (
              <div key={o.id} className={`${b}__card`} onClick={() => openEdit(o)}>
                <div className={`${b}__card-top`}>
                  <div className={`${b}__card-ticket`}>
                    <TicketIcon /> {o.ticket_number}
                  </div>
                  <span className={`${b}__card-status`} style={{ color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                </div>

                <div className={`${b}__card-client`}>
                  <strong>{o.client_name}</strong>
                  {o.client_phone && <span>{o.client_phone}</span>}
                </div>

                <div className={`${b}__card-services`}>
                  {o.items?.slice(0, 3).map((item, i) => (
                    <span key={i} className={`${b}__card-svc`}>{item.service_name}</span>
                  ))}
                  {(o.items?.length || 0) > 3 && <span className={`${b}__card-svc ${b}__card-svc--more`}>+{o.items.length - 3} más</span>}
                </div>

                <div className={`${b}__card-staff`}>
                  {o.staff_name
                    ? <span className={`${b}__card-assigned`}>{o.staff_name}</span>
                    : <span className={`${b}__card-unassigned`}>Sin asignar</span>
                  }
                </div>

                <div className={`${b}__card-bottom`}>
                  <div className={`${b}__card-time`}>
                    <ClockIcon /> {fmtTime(o.arrival_time)}
                  </div>
                  <div className={`${b}__card-total`}>
                    {formatCOP(o.total)}
                  </div>
                </div>

                <div className={`${b}__card-pay`} style={{ color: py.color }}>
                  {py.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL ────────────────────────────────────── */}
      {showModal && (
        <div className={`${b}__overlay`} onClick={() => setShowModal(false)}>
          <div className={`${b}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__modal-header`}>
              <h2>{editOrder ? `Orden ${editOrder.ticket_number}` : 'Nueva orden'}</h2>
              <div className={`${b}__modal-header-actions`}>
                {editOrder && editOrder.status === 'pending' && (
                  <button className={`${b}__modal-action ${b}__modal-action--start`}
                    onClick={() => { handleStatusChange(editOrder, 'in_progress'); setShowModal(false); }}>
                    Iniciar servicio
                  </button>
                )}
                {editOrder && editOrder.payment_status === 'unpaid' && editOrder.status !== 'cancelled' && (
                  <button className={`${b}__modal-action ${b}__modal-action--pay`}
                    onClick={() => { handlePay(editOrder); setShowModal(false); }}>
                    Registrar pago
                  </button>
                )}
                <button className={`${b}__modal-close`} onClick={() => setShowModal(false)}><XIcon /></button>
              </div>
            </div>

            <div className={`${b}__modal-body`}>
              {/* Ticket number */}
              <div className={`${b}__ticket-section`}>
                <div className={`${b}__ticket-icon`}><TicketIcon /></div>
                <div className={`${b}__ticket-field`}>
                  <label>N° Ticket</label>
                  <input value={form.ticket_number}
                    onChange={e => setForm(p => ({ ...p, ticket_number: e.target.value }))}
                    placeholder={editOrder ? editOrder.ticket_number : 'Ej: 001, A-15 (auto si vacío)'}
                  />
                </div>
                {editOrder && <span className={`${b}__ticket-auto`}>{editOrder.ticket_number}</span>}
              </div>

              {/* Client search / selection */}
              <div className={`${b}__section`}>
                <h3 className={`${b}__section-title`}>Cliente</h3>

                {selectedClient && !isNewClient ? (
                  /* ── Client selected chip ── */
                  <div className={`${b}__client-chip`}>
                    <div className={`${b}__client-chip-avatar`}>
                      {selectedClient.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className={`${b}__client-chip-info`}>
                      <span className={`${b}__client-chip-name`}>{selectedClient.name}</span>
                      {selectedClient.phone && <span className={`${b}__client-chip-phone`}>{formatPhone(selectedClient.phone)}</span>}
                    </div>
                    <button className={`${b}__client-chip-x`} onClick={clearClient} title="Cambiar cliente">
                      <XIcon />
                    </button>
                  </div>
                ) : isNewClient ? (
                  /* ── New client form ── */
                  <div className={`${b}__new-client`}>
                    <div className={`${b}__new-client-header`}>
                      <span className={`${b}__new-client-badge`}>Nuevo cliente</span>
                      <button className={`${b}__new-client-cancel`} onClick={clearClient}>Buscar existente</button>
                    </div>
                    <div className={`${b}__form-grid`}>
                      <div className={`${b}__field`}>
                        <label>Nombre completo *</label>
                        <input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} autoFocus />
                      </div>
                      <div className={`${b}__field`}>
                        <label>Teléfono *</label>
                        <input value={form.client_phone} onChange={e => setForm(p => ({ ...p, client_phone: e.target.value }))} placeholder="3XX XXX XXXX" />
                      </div>
                      <div className={`${b}__field`}>
                        <label>Correo</label>
                        <input type="email" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} />
                      </div>
                      <div className={`${b}__field`}>
                        <label>Fecha de nacimiento</label>
                        <input type="date" value={form.client_birthday} onChange={e => setForm(p => ({ ...p, client_birthday: e.target.value }))} />
                      </div>
                      <div className={`${b}__field`}>
                        <label>Tipo de documento</label>
                        <select value={form.client_doc_type} onChange={e => setForm(p => ({ ...p, client_doc_type: e.target.value }))}>
                          <option value="">Seleccionar</option>
                          <option value="CC">Cédula de ciudadanía</option>
                          <option value="CE">Cédula de extranjería</option>
                          <option value="TI">Tarjeta de identidad</option>
                          <option value="PP">Pasaporte</option>
                          <option value="NIT">NIT</option>
                        </select>
                      </div>
                      <div className={`${b}__field`}>
                        <label>Número de documento</label>
                        <input value={form.client_doc_number} onChange={e => setForm(p => ({ ...p, client_doc_number: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Client search ── */
                  <div className={`${b}__client-search`}>
                    <div className={`${b}__client-search-box`}>
                      <SearchIcon />
                      <input value={clientSearchQ} onChange={e => setClientSearchQ(e.target.value)}
                        placeholder="Buscar por nombre, teléfono o documento..." autoFocus />
                      {searchingClients && <div className={`${b}__client-search-spin`} />}
                    </div>
                    {clientResults.length > 0 && (
                      <div className={`${b}__client-results`}>
                        {clientResults.map(c => (
                          <button key={c.id} className={`${b}__client-result`} onClick={() => selectClient(c)}>
                            <div className={`${b}__client-result-avatar`}>
                              {c.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div className={`${b}__client-result-info`}>
                              <strong>{c.name}</strong>
                              <span>{c.phone ? formatPhone(c.phone) : 'Sin teléfono'}{c.email ? ` · ${c.email}` : ''}</span>
                            </div>
                            {c.status && <span className={`${b}__client-result-tag ${b}__client-result-tag--${c.status}`}>{c.status}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {clientSearchQ.length >= 2 && clientResults.length === 0 && !searchingClients && (
                      <div className={`${b}__client-no-result`}>
                        <span>No se encontró el cliente</span>
                      </div>
                    )}
                    <button className={`${b}__new-client-btn`} onClick={() => setIsNewClient(true)}>
                      <PlusIcon /> Registrar nuevo cliente
                    </button>
                  </div>
                )}
              </div>

              {/* Services + Staff per service */}
              <div className={`${b}__section`}>
                <h3 className={`${b}__section-title`}>Servicios y personal</h3>
                {formItems.length > 0 && (
                  <div className={`${b}__item-list`}>
                    {formItems.map((item, i) => {
                      const eligible = item.staff_ids?.length
                        ? staffList.filter(s => item.staff_ids.includes(s.id))
                        : staffList;
                      return (
                        <div key={i} className={`${b}__svc-card`}>
                          <div className={`${b}__svc-card-top`}>
                            <span className={`${b}__svc-card-name`}>{item.service_name}</span>
                            <span className={`${b}__svc-card-dur`}>{item.duration_minutes}min</span>
                            <span className={`${b}__svc-card-price`}>{formatCOP(item.price)}</span>
                            <button className={`${b}__item-remove`} onClick={() => removeService(i)}><TrashIcon /></button>
                          </div>
                          <div className={`${b}__svc-card-staff`}>
                            <label>Asignar a:</label>
                            <div className={`${b}__staff-chips`}>
                              {eligible.map(s => (
                                <button key={s.id}
                                  className={`${b}__staff-chip ${item.staff_id == s.id ? `${b}__staff-chip--active` : ''}`}
                                  onClick={() => updateItem(i, 'staff_id', item.staff_id == s.id ? '' : s.id)}>
                                  <span className={`${b}__staff-chip-avatar`} style={{ background: s.color || '#3B82F6' }}>
                                    {s.name?.split(' ')[0]?.[0]}{s.name?.split(' ')[1]?.[0] || ''}
                                  </span>
                                  <span>{s.name?.split(' ')[0]}</span>
                                </button>
                              ))}
                              {!item.staff_id && <span className={`${b}__staff-pending`}>Sin asignar</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

              {/* Products */}
              <div className={`${b}__section`}>
                <h3 className={`${b}__section-title`}>Productos gastados <span className={`${b}__optional`}>(opcional)</span></h3>
                {formProducts.length > 0 && (
                  <div className={`${b}__item-list`}>
                    {formProducts.map((prod, i) => (
                      <div key={i} className={`${b}__item-row ${b}__item-row--product`}>
                        <span className={`${b}__item-name`}>{prod.product_name}</span>
                        <div className={`${b}__prod-fields`}>
                          <label>Cant.
                            <input type="number" min="1" value={prod.quantity} onChange={e => updateProduct(i, 'quantity', parseInt(e.target.value) || 1)} />
                          </label>
                          <label>Precio
                            <input type="number" value={prod.unit_price} onChange={e => updateProduct(i, 'unit_price', parseInt(e.target.value) || 0)} />
                          </label>
                          <label>Cobra a
                            <select value={prod.charged_to} onChange={e => updateProduct(i, 'charged_to', e.target.value)}>
                              <option value="client">Cliente</option>
                              <option value="staff">Personal</option>
                            </select>
                          </label>
                        </div>
                        <span className={`${b}__item-price`}>{formatCOP(prod.quantity * prod.unit_price)}</span>
                        <button className={`${b}__item-remove`} onClick={() => removeProduct(i)}><TrashIcon /></button>
                      </div>
                    ))}
                  </div>
                )}
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

              {/* Notes */}
              <div className={`${b}__section`}>
                <h3 className={`${b}__section-title`}>Notas <span className={`${b}__optional`}>(opcional)</span></h3>
                <textarea className={`${b}__notes`} rows="2" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Indicaciones, preferencias..." />
              </div>
            </div>

            <div className={`${b}__modal-footer`}>
              <div className={`${b}__modal-total`}>
                <span>Subtotal</span>
                <strong>{formatCOP(formSubtotal)}</strong>
              </div>
              <div className={`${b}__modal-actions`}>
                <button className={`${b}__btn-cancel`} onClick={() => setShowModal(false)}>Cancelar</button>
                <button className={`${b}__btn-save`} onClick={handleSave} disabled={submitting}>
                  {submitting ? 'Guardando...' : editOrder ? 'Guardar cambios' : 'Crear orden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
