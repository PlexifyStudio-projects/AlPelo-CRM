import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import orderService from '../../services/orderService';
import servicesService from '../../services/servicesService';
import staffService from '../../services/staffService';
import clientService from '../../services/clientService';
import appointmentService from '../../services/appointmentService';
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
  // Parse without timezone conversion — backend stores in Colombia time
  const s = String(iso);
  const m = s.match(/(\d{2}):(\d{2})/);
  if (!m) return '—';
  const h = parseInt(m[1]), min = m[2];
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  return `${h % 12 || 12}:${min} ${ampm}`;
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(m[3])} ${MONTHS[parseInt(m[2]) - 1]} ${m[1]}`;
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

const HOURS_START = 7, HOURS_END = 21, SLOT_MIN = 15;
const pad2 = (n) => String(n).padStart(2, '0');
const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minToTime = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const formatTime12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  return `${h % 12 || 12}:${pad2(m)} ${ampm}`;
};
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const Orders = () => {
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; });
  const [statusFilter, setStatusFilter] = useState('pendientes');
  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [staffSchedules, setStaffSchedules] = useState({});
  const [dayApts, setDayApts] = useState([]);
  const [orderDate, setOrderDate] = useState(toISO(new Date()));
  const [dateOffset, setDateOffset] = useState(0);

  // Client search state
  const [clientSearchQ, setClientSearchQ] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isNewClient, setIsNewClient] = useState(false);

  // Ticket-first search — types like "M1212" or a phone number resolve to a client
  const [ticketLookup, setTicketLookup] = useState('');
  const [ticketResults, setTicketResults] = useState([]);
  const [ticketSearching, setTicketSearching] = useState(false);
  const ticketSearchTimer = useRef(null);

  // 3 page tabs: 'services' (catálogo + carrito) | 'products' (mismo) | 'orders' (lista)
  const [pageTab, setPageTab] = useState('services');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('all');

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
      // Build date range from monthFilter (YYYY-MM) to fetch only relevant appointments
      let aptDateFrom, aptDateTo;
      if (monthFilter) {
        const [y, m] = monthFilter.split('-').map(Number);
        aptDateFrom = `${y}-${pad2(m)}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        aptDateTo = `${y}-${pad2(m)}-${pad2(lastDay)}`;
      }
      const [orderData, svcList, staffData, invData, aptList] = await Promise.all([
        orderService.list({ page, limit: 50 }),
        servicesService.list(),
        staffService.list(),
        fetch(`${API}/inventory/products`, { credentials: 'include' }).then(r => r.ok ? r.json() : { products: [] }).catch(() => ({ products: [] })),
        appointmentService.list({ date_from: aptDateFrom, date_to: aptDateTo }).then(list => (Array.isArray(list) ? list : [])).catch(() => []),
      ]);
      const orderList = orderData.orders || orderData || [];
      setTotalPages(orderData.pages || 1);
      // Auto-mark stale pending/in_progress orders as no_show after 48h
      const now = Date.now();
      const stale = orderList.filter(o =>
        (o.status === 'pending' || o.status === 'in_progress') &&
        o.payment_status === 'unpaid' &&
        o.arrival_time && (now - new Date(o.arrival_time).getTime()) > 48 * 60 * 60 * 1000
      );
      if (stale.length) {
        await Promise.all(stale.map(o => orderService.update(o.id, { status: 'no_show' }).catch(() => {})));
        stale.forEach(o => { o.status = 'no_show'; });
        if (stale.length) addNotification(`${stale.length} orden(es) marcada(s) como "No asistió" (más de 48h sin acción)`, 'warning');
      }
      // Convert appointments to order-like cards
      const aptOrders = (Array.isArray(aptList) ? aptList : []).map(a => {
        const statusMap = { confirmed: 'pending', completed: 'completed', paid: 'completed', cancelled: 'cancelled', no_show: 'no_show' };
        return {
          id: `apt-${a.id}`,
          _apt_id: a.id,
          _is_appointment: true,
          ticket_number: a.visit_code || `A-${a.id}`,
          client_id: a.client_id,
          client_name: a.client_name || 'Cliente',
          client_phone: a.client_phone || '',
          staff_id: a.staff_id,
          staff_name: a.staff_name || '',
          status: statusMap[a.status] || a.status,
          payment_status: a.status === 'paid' ? 'paid' : 'unpaid',
          arrival_time: `${a.date}T${a.time || '00:00'}`,
          service_date: a.date,
          service_time: a.time || null,
          total: a.price || 0,
          subtotal: a.price || 0,
          items: [{ service_id: a.service_id, service_name: a.service_name || 'Servicio', price: a.price || 0, duration_minutes: a.duration_minutes, staff_id: a.staff_id, staff_name: a.staff_name || '' }],
          products: [],
          created_at: a.created_at,
        };
      });
      // Merge: orders + appointments, deduplicate by client+time if needed
      const allOrders = [...orderList, ...aptOrders];
      setOrders(allOrders);
      setServices(svcList.filter(s => s.is_active));
      setStaffList(staffData.filter(s => s.is_active !== false));
      setProducts(invData?.products || []);
    } catch (err) {
      addNotification('Error al cargar órdenes: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [monthFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Preselected client handoff from ClientDetail ──
  // When user clicks "Vender" on a client profile, we land here with the
  // client info in sessionStorage and auto-open the create modal.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('orders:preselected_client');
      if (!raw) return;
      const data = JSON.parse(raw);
      sessionStorage.removeItem('orders:preselected_client');
      if (!data.id) return;
      if (data.ts && Date.now() - data.ts > 120000) return; // 2-min staleness

      // Open create modal pre-filled with this client
      setEditOrder(null);
      setIsNewClient(false);
      setSelectedClient({ id: data.id, name: data.name, phone: data.phone, email: data.email });
      setClientSearchQ('');
      setForm({
        ticket_number: '',
        client_name: data.name || '',
        client_phone: data.phone || '',
        client_email: data.email || '',
        client_doc_type: data.document_type || '',
        client_doc_number: data.document_number || '',
        client_birthday: '',
        staff_id: '',
        notes: '',
      });
      setFormItems([]);
      setFormProducts([]);
      setSvcSearch('');
      setProdSearch('');
      setShowModal(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[Orders] preselected client parse failed', err);
    }
  }, []);

  // Load staff schedules — ONLY ONCE per staff set, and only when the modal
  // is opened (avoid the N+1 storm on every render / auto-refresh).
  // Using staff IDs string as the dep so we don't re-fetch when the array
  // reference changes but the IDs are the same.
  const staffIdsKey = useMemo(() => staffList.map(s => s.id).sort().join(','), [staffList]);
  useEffect(() => {
    if (!staffList.length) return;
    if (!showModal) return;          // only when the editor modal is open
    if (Object.keys(staffSchedules).length > 0) return; // already loaded
    const loadSchedules = async () => {
      const schedMap = {};
      await Promise.all(staffList.map(async (s) => {
        try {
          const res = await fetch(`${API}/staff/${s.id}/schedule`, { credentials: 'include' });
          if (res.ok) { const d = await res.json(); schedMap[s.id] = d.schedule || []; }
        } catch {}
      }));
      setStaffSchedules(schedMap);
    };
    loadSchedules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffIdsKey, showModal]);

  // Load appointments for selected date
  useEffect(() => {
    if (!orderDate) return;
    const loadApts = async () => {
      try {
        const apts = await appointmentService.list({ date_from: orderDate, date_to: orderDate });
        setDayApts(Array.isArray(apts) ? apts : []);
      } catch { setDayApts([]); }
    };
    loadApts();
  }, [orderDate]);

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
    setTicketLookup('');
    setTicketResults([]);
    setForm(p => ({ ...p, client_name: '', client_phone: '', client_email: '', client_doc_type: '', client_doc_number: '' }));
  };

  // ── Ticket-first search debounce ──
  // The same /clients/?search= endpoint already matches on visit_code,
  // client_id, name, phone, email — so we just send the raw query.
  useEffect(() => {
    if (!ticketLookup.trim() || selectedClient || isNewClient) { setTicketResults([]); return; }
    if (ticketSearchTimer.current) clearTimeout(ticketSearchTimer.current);
    ticketSearchTimer.current = setTimeout(async () => {
      setTicketSearching(true);
      try {
        const res = await clientService.list({ search: ticketLookup });
        setTicketResults(Array.isArray(res) ? res.slice(0, 6) : []);
      } catch {
        setTicketResults([]);
      } finally {
        setTicketSearching(false);
      }
    }, 250);
    return () => { if (ticketSearchTimer.current) clearTimeout(ticketSearchTimer.current); };
  }, [ticketLookup, selectedClient, isNewClient]);

  const pickTicketResult = useCallback((c) => {
    selectClient(c);
    // Pre-fill the order's ticket field with the client's visit_code if any
    if (c.visit_code) {
      setForm(p => ({ ...p, ticket_number: c.visit_code }));
    }
    setTicketLookup('');
    setTicketResults([]);
  }, []);

  const filtered = useMemo(() => {
    let list = [...orders];
    // Month filter
    if (monthFilter) {
      list = list.filter(o => {
        const d = o.arrival_time || o.created_at || '';
        return d.startsWith(monthFilter);
      });
    }
    // Status filter
    if (statusFilter === 'paid') {
      list = list.filter(o => o.payment_status === 'paid');
    } else if (statusFilter === 'pendientes') {
      // "Pendientes" combines anything still active: scheduled + in-progress
      list = list.filter(o => o.status === 'pending' || o.status === 'in_progress');
    } else if (statusFilter !== 'all') {
      list = list.filter(o => o.status === statusFilter);
    }
    // Search
    if (search) {
      const q = search.toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      list = list.filter(o => {
        if (o.ticket_number?.toLowerCase().includes(q)) return true;
        if (o.client_name?.toLowerCase().includes(q)) return true;
        if (qDigits && o.client_phone) {
          const ph = o.client_phone.replace(/\D/g, '');
          if (ph.includes(qDigits)) return true;
        }
        return false;
      });
    }
    // Sort: pending first, then in_progress, completed, paid, no_show, cancelled
    const STATUS_PRIORITY = { pending: 0, in_progress: 1, completed: 2, no_show: 3, cancelled: 4 };
    list.sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 2;
      const pb = STATUS_PRIORITY[b.status] ?? 2;
      if (pa !== pb) return pa - pb;
      // Within same status, newest first
      return (b.arrival_time || b.created_at || '').localeCompare(a.arrival_time || a.created_at || '');
    });
    return list;
  }, [orders, statusFilter, search, monthFilter]);

  const counts = useMemo(() => {
    const c = { all: orders.length, pendientes: 0, pending: 0, in_progress: 0, completed: 0, paid: 0, no_show: 0, cancelled: 0 };
    orders.forEach(o => {
      if (c[o.status] !== undefined) c[o.status]++;
      if (o.status === 'pending' || o.status === 'in_progress') c.pendientes++;
      if (o.payment_status === 'paid') c.paid++;
    });
    return c;
  }, [orders]);

  const computeSlots = useCallback((staffId, serviceId, itemIndex) => {
    const svc = services.find(s => s.id === serviceId);
    const dur = svc?.duration_minutes || 30;
    const dateObj = new Date(orderDate + 'T12:00:00');
    const dow = dateObj.getDay();
    const bdow = dow === 0 ? 6 : dow - 1;

    let schedStart = HOURS_START * 60, schedEnd = HOURS_END * 60;
    let breakStart = -1, breakEnd = -1, isWorking = true;
    const sched = staffSchedules[staffId];
    if (sched) {
      const ds = sched.find(s => s.day_of_week === bdow);
      if (ds) {
        if (!ds.is_working) isWorking = false;
        else {
          if (ds.start_time && ds.end_time) { schedStart = timeToMin(ds.start_time); schedEnd = timeToMin(ds.end_time); }
          if (ds.break_start && ds.break_end) { breakStart = timeToMin(ds.break_start); breakEnd = timeToMin(ds.break_end); }
        }
      }
    }
    if (!isWorking) return { slots: [], closed: true };

    const busy = dayApts
      .filter(a => a.staff_id === staffId && a.status !== 'cancelled' && a.status !== 'no_show')
      .map(a => ({ s: timeToMin(a.time), e: timeToMin(a.time) + (a.duration_minutes || 30) }));

    formItems.forEach((other, j) => {
      if (j === itemIndex || !other.time) return;
      const otherDur = services.find(s => s.id === other.service_id)?.duration_minutes || 30;
      busy.push({ s: timeToMin(other.time), e: timeToMin(other.time) + otherDur });
    });

    const isToday = orderDate === toISO(new Date());
    const now = new Date();
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : 0;
    const slots = [];
    for (let m = Math.max(HOURS_START * 60, schedStart); m < Math.min(HOURS_END * 60, schedEnd); m += SLOT_MIN) {
      if (isToday && m < nowMin) continue;
      const end = m + dur;
      if (end > schedEnd) break;
      if (breakStart >= 0 && m < breakEnd && end > breakStart) continue;
      if (!busy.some(b => m < b.e && end > b.s)) slots.push(m);
    }
    return { slots, closed: false };
  }, [services, staffSchedules, dayApts, formItems, orderDate]);

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
    setFormItems(prev => [...prev, { service_id: svc.id, service_name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, staff_id: '', time: '', staff_ids: svc.staff_ids || [] }]);
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

  const handleSave = async (opts = {}) => {
    if (!form.client_name.trim()) { addNotification('Nombre del cliente requerido', 'error'); return; }
    setSubmitting(true);
    try {
      const mainStaff = formItems.find(it => it.staff_id)?.staff_id || null;
      const firstTime = formItems.find(it => it.time)?.time || null;
      const payload = {
        ...form,
        client_id: selectedClient?.id || null,
        staff_id: mainStaff ? parseInt(mainStaff) : null,
        service_date: orderDate,
        service_time: firstTime,
        items: formItems.map(it => ({ ...it, staff_id: it.staff_id ? parseInt(it.staff_id) : null })),
        products: formProducts,
      };

      // ── Append-to-existing flow (Servicios/Productos catalog) ──
      // If the client has an open in-progress order we add the new items to
      // it instead of opening a duplicate ticket. The ticket field overrides
      // whatever was on the existing order so reception can update it.
      const existing = opts.existingOpenOrder;
      if (existing && !editOrder) {
        const mergedItems = [
          ...(existing.items || []).map(i => ({
            service_id: i.service_id,
            service_name: i.service_name,
            price: i.price,
            duration_minutes: i.duration_minutes,
            staff_id: i.staff_id ? parseInt(i.staff_id) : null,
          })),
          ...payload.items,
        ];
        const mergedProducts = [
          ...(existing.products || []),
          ...payload.products,
        ];
        await orderService.update(existing.id, {
          ...payload,
          items: mergedItems,
          products: mergedProducts,
          ticket_number: form.ticket_number || existing.ticket_number,
        });
        addNotification(formItems.length + formProducts.length > 0
          ? `Agregado a la orden ${form.ticket_number || existing.ticket_number}`
          : `Ticket actualizado en la orden ${form.ticket_number || existing.ticket_number}`,
          'success');
      } else if (editOrder) {
        if (editOrder._is_appointment) {
          const aptPayload = {
            client_name: form.client_name,
            client_phone: form.client_phone,
            staff_id: mainStaff ? parseInt(mainStaff) : undefined,
            service_id: formItems[0]?.service_id || undefined,
            date: orderDate,
            time: firstTime || undefined,
            visit_code: form.ticket_number || undefined,
            notes: form.notes || undefined,
          };
          await appointmentService.update(editOrder._apt_id, aptPayload);
          addNotification('Cita actualizada', 'success');
        } else {
          await orderService.update(editOrder.id, payload);
          addNotification('Orden actualizada', 'success');
        }
      } else {
        await orderService.create(payload);
        addNotification(formItems.length + formProducts.length > 0
          ? `Orden ${form.ticket_number || 'nueva'} creada y en proceso`
          : `Orden abierta con ticket ${form.ticket_number}`,
          'success');
      }

      // Reset cart + client + ticket so the user can attend the next person
      setShowModal(false);
      setSelectedClient(null);
      setIsNewClient(false);
      setFormItems([]);
      setFormProducts([]);
      setForm(p => ({ ...p, ticket_number: '', client_name: '', client_phone: '', client_email: '', client_doc_type: '', client_doc_number: '', notes: '' }));
      loadData();
    } catch (err) {
      const msg = typeof err?.message === 'string' ? err.message : 'Error al guardar';
      addNotification(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    try {
      if (order._is_appointment) {
        // Update appointment status via appointment service
        const aptStatus = newStatus === 'pending' ? 'confirmed' : newStatus;
        await appointmentService.update(order._apt_id || order.id, { status: aptStatus });
      } else {
        await orderService.update(order.id, { status: newStatus });
      }
      addNotification(`${order._is_appointment ? 'Cita' : 'Orden'}: ${STATUS_META[newStatus]?.label || newStatus}`, 'success');
      if (editOrder?.id === order.id) setEditOrder(prev => ({ ...prev, status: newStatus }));
      loadData();
    } catch (err) { addNotification(typeof err?.message === 'string' ? err.message : 'Error al actualizar', 'error'); }
  };

  const handlePay = (order) => {
    const items = showModal && formItems.length ? formItems : order.items || [];
    const hasStaff = items.some(i => i.staff_id) || order.staff_id;
    if (!hasStaff) {
      addNotification('Debes asignar personal a al menos un servicio antes de cobrar', 'error');
      return;
    }
    const firstWithStaff = items.find(i => i.staff_id) || items[0] || {};
    const staffId = parseInt(firstWithStaff.staff_id) || order.staff_id;
    const staffName = staffList.find(s => s.id === staffId)?.name || order.staff_name || '';
    // Build appointment-like object with ALL items encoded in notes for CheckoutModal
    const allItems = items.map(i => ({
      service_id: i.service_id,
      service_name: i.service_name,
      staff_id: parseInt(i.staff_id) || staffId,
      staff_name: staffList.find(s => s.id === parseInt(i.staff_id))?.name || staffName,
      price: i.price || 0,
    }));
    const prods = (showModal && formProducts.length ? formProducts : order.products || []);
    setCheckoutOrder({
      id: order._is_appointment ? order._apt_id : order.id,
      client_id: order.client_id,
      client_name: order.client_name || form.client_name,
      client_phone: order.client_phone || form.client_phone,
      service_id: firstWithStaff.service_id,
      service_name: firstWithStaff.service_name || 'Servicio',
      staff_id: staffId,
      staff_name: staffName,
      price: allItems.reduce((s, i) => s + i.price, 0),
      visit_code: order.ticket_number,
      notes: '',
      _order_id: order.id,
      _apt_id: order._apt_id || null,
      _is_appointment: order._is_appointment || false,
      _all_items: allItems,
      _products: prods,
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
          <span className={`${b}__subtitle`}>
            {pageTab === 'services' && 'Cobra servicios y agrega al cliente que está en recepción'}
            {pageTab === 'products' && 'Vende productos y agrega al cliente que está en recepción'}
            {pageTab === 'orders' && 'Órdenes en proceso y completadas'}
          </span>
        </div>
      </div>

      {/* ─── Page tabs: Servicios | Productos | Órdenes ───── */}
      <div className={`${b}__page-tabs`}>
        <button
          type="button"
          className={`${b}__page-tab ${pageTab === 'services' ? `${b}__page-tab--active` : ''}`}
          onClick={() => { setPageTab('services'); setCatalogSearch(''); setCatalogCategory('all'); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Servicios
        </button>
        <button
          type="button"
          className={`${b}__page-tab ${pageTab === 'products' ? `${b}__page-tab--active` : ''}`}
          onClick={() => { setPageTab('products'); setCatalogSearch(''); setCatalogCategory('all'); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          Productos
        </button>
        <button
          type="button"
          className={`${b}__page-tab ${pageTab === 'orders' ? `${b}__page-tab--active` : ''}`}
          onClick={() => setPageTab('orders')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/></svg>
          Órdenes en proceso
          {(counts.pending + counts.in_progress) > 0 && (
            <span className={`${b}__page-tab-count`}>{counts.pending + counts.in_progress}</span>
          )}
        </button>
      </div>

      {/* ─── Catalog view (Servicios / Productos) ───── */}
      {(pageTab === 'services' || pageTab === 'products') && (
        <CatalogPane
          mode={pageTab}
          services={services}
          products={products}
          staff={staffList}
          catalogSearch={catalogSearch}
          setCatalogSearch={setCatalogSearch}
          catalogCategory={catalogCategory}
          setCatalogCategory={setCatalogCategory}
          formItems={formItems}
          setFormItems={setFormItems}
          formProducts={formProducts}
          setFormProducts={setFormProducts}
          form={form}
          setForm={setForm}
          selectedClient={selectedClient}
          setSelectedClient={setSelectedClient}
          isNewClient={isNewClient}
          setIsNewClient={setIsNewClient}
          ticketLookup={ticketLookup}
          setTicketLookup={setTicketLookup}
          ticketResults={ticketResults}
          ticketSearching={ticketSearching}
          pickTicketResult={pickTicketResult}
          clearClient={clearClient}
          handleSave={handleSave}
          submitting={submitting}
          formatCOP={formatCOP}
          openCreate={openCreate}
          orders={orders}
          b={b}
        />
      )}

      {/* ─── Orders list (only on 'orders' tab) ───── */}
      {pageTab !== 'orders' ? null : (<>
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
        <input type="month" className={`${b}__month-filter`} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
        <div className={`${b}__filters`}>
          {[
            { key: 'pendientes', label: 'Pendientes' },
            { key: 'all', label: 'Todas' },
            { key: 'pending', label: 'Agendadas' },
            { key: 'in_progress', label: 'En proceso' },
            { key: 'completed', label: 'Completadas' },
            { key: 'paid', label: 'Pagadas' },
            { key: 'no_show', label: 'No asistieron' },
            { key: 'cancelled', label: 'Canceladas' },
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
            const AVATAR_COLORS = ['#2D5A3D','#3B82F6','#E05292','#C9A84C','#8B5CF6','#F97316','#14B8A6','#EC4899','#06B6D4','#EF4444','#6366F1','#059669','#D946EF','#0EA5E9'];
            const avatarColor = AVATAR_COLORS[(o.client_name || '').charCodeAt(0) % AVATAR_COLORS.length];
            const svcCount = o.items?.length || 0;
            const prodCount = o.products?.length || 0;
            return (
              <div key={o.id} className={`${b}__card ${b}__card--${o.status}`} onClick={async (e) => {
                if (o.payment_status === 'paid') {
                  const card = e.currentTarget;
                  const loader = document.createElement('div');
                  loader.className = `${b}__card-loading`;
                  loader.innerHTML = `<div class="${b}__card-loading-spin"></div><span>Cargando factura...</span>`;
                  card.appendChild(loader);
                  try {
                    const res = await fetch(`${API}/invoices/`, { credentials: 'include' });
                    if (res.ok) {
                      const allInvoices = await res.json();
                      // Match by client name — find most recent invoice for this client
                      const clientInvs = allInvoices
                        .filter(i => i.client_name === o.client_name && i.status === 'paid')
                        .sort((a, b) => (b.paid_at || b.issued_date || '').localeCompare(a.paid_at || a.issued_date || ''));
                      const inv = clientInvs[0];
                      console.log('[INVOICE] matched:', inv?.invoice_number, 'client matches:', clientInvs.length);
                      if (inv) {
                        // Redirect to Finanzas with the invoice expanded — but simpler: just open the print
                        // Use the Finanzas print logic inline
                        const dateStr = inv.issued_date ? new Date(inv.issued_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
                        const timeStr = inv.paid_at ? new Date(inv.paid_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                        const ml = inv.payment_method || '—';
                        const win = window.open('', '_blank', 'width=900,height=700');
                        if (win) {
                          win.document.write(`<html><head><title>Factura ${inv.invoice_number}</title><style>*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:750px;margin:0 auto;color:#1a1a1a;font-size:13px}hr{border:none;border-top:2px solid #1E40AF;margin:12px 0 20px}.biz{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.biz-name{font-size:18px;font-weight:800}.biz-info{text-align:right;font-size:11px;color:#64748b}.header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}.header h2{font-size:16px;margin:0}.header-right{text-align:right}.header-right strong{font-size:20px;display:block}.client{display:flex;flex-wrap:wrap;gap:6px 24px;background:#f8fafc;padding:12px 16px;border-radius:8px;margin-bottom:16px}.client div{display:flex;flex-direction:column}.client strong{font-size:12px}.client span{font-size:10px;color:#64748b}table{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:12px}th{text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#1E40AF;border-bottom:2px solid #E5E7EB}td{padding:7px 10px;border-bottom:1px solid #F3F4F6}.r{text-align:right}.staff{color:#1E40AF;font-size:11px}.product{color:#D97706}.subtotal-row td{font-size:11px;color:#64748b;border-bottom:1px dashed #E5E7EB}.discount-row td{color:#059669}.total-row td{font-size:15px;font-weight:800;border-top:2px solid #1a1a1a;border-bottom:none}.breakdown{display:flex;gap:20px;margin-top:16px}.box{flex:1;border:1px solid #E5E7EB;border-radius:8px;padding:12px}.box h3{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #f1f1f1}.box-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px}.green strong{color:#059669}.blue strong{color:#2563EB}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}.no-print{text-align:center;margin-top:16px}button{background:#2D5A3D;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600}@media print{.no-print{display:none}}</style></head><body>`);
                          win.document.write(`<div class="biz-name">AlPelo</div><hr>`);
                          win.document.write(`<div class="header"><div><h2>Factura ${inv.invoice_number}</h2><span style="color:#64748b;font-size:12px">${dateStr}${timeStr ? ' — '+timeStr : ''}</span></div><div class="header-right"><strong>${formatCOP(inv.total)}</strong>${ml}</div></div>`);
                          win.document.write(`<div class="client"><div><strong>${inv.client_name||'N/A'}</strong><span>Cliente</span></div><div><strong>${inv.client_phone||'No registrado'}</strong><span>Teléfono</span></div><div><strong>${inv.client_document?(inv.client_document_type||'CC')+' '+inv.client_document:'No registrado'}</strong><span>Documento</span></div><div><strong>${inv.client_email||'No registrado'}</strong><span>Email</span></div></div>`);
                          win.document.write('<table><tr><th>Servicio / Producto</th><th>Profesional</th><th>Cant.</th><th class="r">P/U</th><th class="r">Total</th></tr>');
                          (inv.items||[]).forEach(it => { const isProd = it.service_name?.startsWith('[Producto]'); win.document.write(`<tr class="${isProd?'product':''}"><td>${it.service_name}</td><td class="staff">${it.staff_name||'—'}</td><td>${it.quantity}</td><td class="r">${formatCOP(it.unit_price)}</td><td class="r">${formatCOP(it.total)}</td></tr>`); });
                          win.document.write(`<tr class="subtotal-row"><td colspan="4">Subtotal</td><td class="r">${formatCOP(inv.subtotal)}</td></tr>`);
                          if (inv.tip > 0) win.document.write(`<tr class="subtotal-row"><td colspan="4" style="color:#059669">Propina</td><td class="r" style="color:#059669">+${formatCOP(inv.tip)}</td></tr>`);
                          win.document.write(`<tr class="total-row"><td colspan="4">TOTAL</td><td class="r">${formatCOP(inv.total)}</td></tr></table>`);
                          // Load commission rates for distribution
                          let svcCommRates = {}, staffDefaults = {};
                          try {
                            const [cr, sd] = await Promise.all([
                              fetch(`${API}/services/all-commissions`, { credentials: 'include' }).then(r => r.ok ? r.json() : {}),
                              fetch(`${API}/finances/commissions/config`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
                            ]);
                            svcCommRates = cr.rates || {};
                            sd.forEach(c => { staffDefaults[c.staff_id] = c.default_rate || 0; });
                          } catch {}
                          // Distribution + Payment details
                          const byStaff = {};
                          (inv.items||[]).forEach(it => {
                            const n = it.staff_name || '—';
                            if (!byStaff[n]) byStaff[n] = { items: [], total: 0 };
                            byStaff[n].items.push(it);
                            byStaff[n].total += it.total || 0;
                          });
                          let distHtml = '<div class="box"><h3>Distribucion por profesional</h3>';
                          Object.entries(byStaff).forEach(([name, s]) => {
                            distHtml += `<div class="box-row" style="font-weight:700"><span>${name}</span><strong>${formatCOP(s.total)}</strong></div>`;
                            s.items.forEach(it => {
                              const isProd = it.service_name?.startsWith('[Producto]');
                              const rate = svcCommRates[`${it.staff_id}-${it.service_id}`] || staffDefaults[it.staff_id] || 0;
                              const comm = isProd ? 0 : Math.round(it.total * rate);
                              distHtml += `<div class="box-row" style="font-size:11px;color:#64748b;padding-left:12px"><span>${it.service_name}${isProd ? '' : ` (${Math.round(rate*100)}%)`}</span><strong style="color:#059669">${formatCOP(comm)}</strong></div>`;
                            });
                          });
                          const totalComm = Object.values(byStaff).reduce((s, st) => s + st.items.reduce((ss, it) => {
                            const isProd = it.service_name?.startsWith('[Producto]');
                            const rate = isProd ? 0 : (svcCommRates[`${it.staff_id}-${it.service_id}`] || staffDefaults[it.staff_id] || 0);
                            return ss + Math.round((it.total||0) * rate);
                          }, 0), 0);
                          distHtml += `<div style="border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px"><div class="box-row green"><span>Total comisiones</span><strong>${formatCOP(totalComm)}</strong></div><div class="box-row blue"><span>Ganancia negocio</span><strong>${formatCOP((inv.total||0)-(inv.tip||0)-totalComm)}</strong></div></div></div>`;
                          let payHtml = `<div class="box"><h3>Detalles de pago</h3><div class="box-row"><span>Metodo</span><strong>${ml}</strong></div>`;
                          if (inv.payment_method === 'efectivo' && inv.payment_details?.received > 0) {
                            payHtml += `<div class="box-row"><span>Efectivo recibido</span><strong>${formatCOP(inv.payment_details.received)}</strong></div>`;
                            if (inv.payment_details.change > 0) payHtml += `<div class="box-row" style="color:#D97706"><span>Cambio entregado</span><strong>${formatCOP(inv.payment_details.change)}</strong></div>`;
                          }
                          payHtml += `<div class="box-row"><span>Condicion</span><strong>Contado</strong></div><div class="box-row"><span>Estado</span><strong>Pagada</strong></div><div class="box-row"><span>Fecha</span><strong>${dateStr}</strong></div>${timeStr ? `<div class="box-row"><span>Hora</span><strong>${timeStr}</strong></div>` : ''}</div>`;
                          win.document.write(`<div class="breakdown">${distHtml}${payHtml}</div>`);
                          win.document.write(`<div class="footer"><span>Factura ${inv.invoice_number} — ${dateStr}</span><span>Generado por Plexify Studio</span></div>`);
                          win.document.write('<div class="no-print"><button onclick="window.print()">Imprimir</button></div></body></html>');
                          win.document.close();
                          loader.remove();
                          return;
                        }
                      }
                    }
                  } catch (err) { console.error('[INVOICE]', err); }
                  loader.remove();
                  openEdit(o);
                  return;
                }
                openEdit(o);
              }}>
                {/* Header: status accent bar */}
                <div className={`${b}__card-accent`} style={{ background: st.color }} />

                {/* Ticket + Status */}
                <div className={`${b}__card-header`}>
                  <div className={`${b}__card-header-left`}>
                    <span className={`${b}__card-ticket`}>{o.ticket_number}</span>
                    {o._is_appointment && <span className={`${b}__card-source`}>Agenda</span>}
                  </div>
                  <span className={`${b}__card-status`} style={{ color: st.color, background: st.bg }}>{st.label}</span>
                </div>

                {/* Client */}
                <div className={`${b}__card-client`}>
                  <div className={`${b}__card-avatar`} style={{ background: avatarColor }}>{initials}</div>
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

                {/* Staff — show all unique staff from items */}
                <div className={`${b}__card-staff`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  {(() => {
                    const names = [...new Set([
                      ...(o.items || []).filter(i => i.staff_name).map(i => i.staff_name),
                      ...(o.staff_name ? [o.staff_name] : []),
                    ].filter(Boolean))];
                    return names.length > 0
                      ? names.map((n, i) => <span key={i} className={`${b}__card-staff-name`}>{n}{i < names.length - 1 ? ', ' : ''}</span>)
                      : <span className={`${b}__card-staff-pending`}>Por asignar</span>;
                  })()}
                </div>

                {/* Footer: time + total + payment */}
                <div className={`${b}__card-footer`}>
                  <div className={`${b}__card-time`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {fmtDate(o.service_date || o.arrival_time)}
                    <ClockIcon /> {o.service_time ? fmtTime(`2000-01-01T${o.service_time}`) : fmtTime(o.arrival_time)}
                  </div>
                  <div className={`${b}__card-money`}>
                    <span className={`${b}__card-total`}>{formatCOP(o.total)}</span>
                    {o.payment_status === 'unpaid' && o.status !== 'cancelled' && o.status !== 'no_show' && (o.staff_id || o.items?.some(it => it.staff_id)) ? (
                      <button className={`${b}__card-pay-btn`} onClick={(e) => { e.stopPropagation(); handlePay(o); }}>
                        Cobrar
                      </button>
                    ) : (
                      <span className={`${b}__card-pay`} style={{ color: py.color }}>{py.label}</span>
                    )}
                  </div>
                </div>

                {/* Quick actions for pending/in_progress */}
                {(o.status === 'pending' || o.status === 'in_progress') && o.payment_status !== 'paid' && (
                  <div className={`${b}__card-quick`}>
                    <button className={`${b}__card-quick-btn ${b}__card-quick-btn--noshow`}
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(o._is_appointment ? { ...o, id: o._apt_id, _is_appointment: true } : o, 'no_show'); }}
                      title="No asistió">
                      No asistió
                    </button>
                    <button className={`${b}__card-quick-btn ${b}__card-quick-btn--cancel`}
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(o._is_appointment ? { ...o, id: o._apt_id, _is_appointment: true } : o, 'cancelled'); }}
                      title="Cancelar">
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && page < totalPages && (
        <div className={`${b}__load-more`}>
          <button onClick={() => { setPage(p => p + 1); loadData(); }}>
            Cargar más ({page}/{totalPages})
          </button>
        </div>
      )}

      </>)}

      {/* ─── DRAWER (legacy "edit order" — still used for editing/cobro) ─── */}
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
              {/* ── PRIMARY: Ticket / Client lookup at the top ── */}
              {!editOrder && !selectedClient && !isNewClient && (
                <div className={`${b}__primary-search`}>
                  <div className={`${b}__primary-search-head`}>
                    <span className={`${b}__primary-search-eyebrow`}>Empieza por aquí</span>
                    <h3>Busca el ticket o cliente</h3>
                    <p>Escribe el número del ticket (ej. <code>M1212</code>), nombre, teléfono o documento.</p>
                  </div>
                  <div className={`${b}__primary-search-box`}>
                    <SearchIcon />
                    <input
                      autoFocus
                      type="text"
                      value={ticketLookup}
                      onChange={(e) => setTicketLookup(e.target.value)}
                      placeholder="Ej: M1212, Luis Nava, 3105551234..."
                    />
                    {ticketSearching && <div className={`${b}__primary-search-spin`} />}
                  </div>

                  {ticketResults.length > 0 && (
                    <div className={`${b}__primary-search-results`}>
                      {ticketResults.map((c) => (
                        <button key={c.id} type="button" className={`${b}__primary-search-result`} onClick={() => pickTicketResult(c)}>
                          <div className={`${b}__primary-search-avatar`}>
                            {c.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?'}
                          </div>
                          <div className={`${b}__primary-search-info`}>
                            <span className={`${b}__primary-search-name`}>{c.name}</span>
                            <span className={`${b}__primary-search-meta`}>
                              {c.visit_code && <span className={`${b}__primary-search-ticket`}>{c.visit_code}</span>}
                              {c.client_id && c.client_id !== c.visit_code && <span>· {c.client_id}</span>}
                              {c.phone && <span>· {formatPhone(c.phone)}</span>}
                            </span>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                      ))}
                    </div>
                  )}

                  {ticketLookup.length >= 2 && !ticketSearching && ticketResults.length === 0 && (
                    <div className={`${b}__primary-search-empty`}>
                      No encontramos a nadie con "{ticketLookup}".
                      <button type="button" className={`${b}__primary-search-new`} onClick={() => setIsNewClient(true)}>
                        + Crear cliente nuevo
                      </button>
                    </div>
                  )}

                  <div className={`${b}__primary-search-divider`}>
                    <span>o</span>
                  </div>

                  <div className={`${b}__primary-search-actions`}>
                    <button type="button" className={`${b}__primary-search-action`} onClick={() => setIsNewClient(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                      Cliente nuevo
                    </button>
                    <button type="button" className={`${b}__primary-search-action`} onClick={() => { setSelectedClient({ id: null, name: 'Consumidor final' }); setForm(p => ({ ...p, client_name: 'Consumidor final' })); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                      Consumidor final
                    </button>
                  </div>
                </div>
              )}

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

              {/* ── Fecha ── */}
              <div className={`${b}__date-nav`}>
                <button className={`${b}__date-arrow`} onClick={() => setDateOffset(p => p - 7)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <div className={`${b}__date-tabs`}>
                  {(() => {
                    const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                    const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                    const today = new Date(); today.setHours(0,0,0,0);
                    const days = [];
                    for (let i = dateOffset; i < dateOffset + 10; i++) {
                      const d = new Date(today); d.setDate(d.getDate() + i);
                      days.push(d);
                    }
                    return days.map(d => {
                      const iso = toISO(d);
                      const isActive = iso === orderDate;
                      const isToday = iso === toISO(today);
                      return (
                        <button key={iso}
                          className={`${b}__date-tab ${isActive ? `${b}__date-tab--on` : ''} ${isToday ? `${b}__date-tab--today` : ''}`}
                          onClick={() => { setOrderDate(iso); formItems.forEach((_, idx) => updateItem(idx, 'time', '')); }}>
                          <span className={`${b}__date-tab-day`}>{DAYS[d.getDay()]}</span>
                          <span className={`${b}__date-tab-num`}>{d.getDate()}</span>
                          <span className={`${b}__date-tab-month`}>{MONTHS[d.getMonth()]}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
                <button className={`${b}__date-arrow`} onClick={() => setDateOffset(p => p + 7)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
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
                      {/* Time slots — show after staff is selected */}
                      {item.staff_id && (() => {
                        const { slots, closed } = computeSlots(parseInt(item.staff_id), item.service_id, i);
                        const dateObj = new Date(orderDate + 'T12:00:00');
                        const dayLabel = dateObj.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
                        return (
                          <div className={`${b}__svc-time`}>
                            <div className={`${b}__svc-time-header`}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                              <span>Horarios — <strong>{dayLabel}</strong></span>
                              {item.time && <span className={`${b}__svc-time-selected`}>{formatTime12(item.time)}</span>}
                            </div>
                            {closed ? (
                              <span className={`${b}__time-none`}>Este personal no trabaja el {dayLabel}</span>
                            ) : slots.length === 0 ? (
                              <span className={`${b}__time-none`}>No hay horarios disponibles para esta fecha</span>
                            ) : (
                              <div className={`${b}__time-slots`}>
                                {slots.map(m => {
                                  const t = minToTime(m);
                                  const active = item.time === t;
                                  return (
                                    <button key={m}
                                      className={`${b}__time-slot ${active ? `${b}__time-slot--on` : ''}`}
                                      onClick={() => updateItem(i, 'time', active ? '' : t)}>
                                      {formatTime12(t)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
            // Backend checkout already marks appointment as 'paid' and order as 'completed'
            // For pure orders (no appointment), update status manually
            try {
              if (!checkoutOrder._is_appointment && checkoutOrder._order_id) {
                await orderService.update(checkoutOrder._order_id, { status: 'completed', payment_status: 'paid' });
              }
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

// ============================================================================
// CATALOG PANE — left: filterable services/products grid
//                right: client search + cart + staff selectors + Crear orden
// ============================================================================
function CatalogPane({
  mode, services, products, staff,
  catalogSearch, setCatalogSearch, catalogCategory, setCatalogCategory,
  formItems, setFormItems, formProducts, setFormProducts,
  form, setForm, selectedClient, setSelectedClient, isNewClient, setIsNewClient,
  ticketLookup, setTicketLookup, ticketResults, ticketSearching, pickTicketResult, clearClient,
  handleSave, submitting, formatCOP, openCreate, b,
  orders, // full orders list (for finding existing in-progress order for this client)
}) {
  // If the selected client has an open in-progress / pending order, this is the
  // order we'll merge into when "Crear orden" is clicked (instead of opening a new one).
  const existingOpenOrder = useMemo(() => {
    if (!selectedClient?.id || !Array.isArray(orders)) return null;
    return orders.find(o =>
      o.client_id === selectedClient.id &&
      (o.status === 'pending' || o.status === 'in_progress') &&
      !o._is_appointment
    ) || null;
  }, [selectedClient?.id, orders]);
  const isProducts = mode === 'products';
  const allItems = isProducts ? products : services;

  const categories = useMemo(() => {
    const set = new Set();
    allItems.forEach(it => { if (it.category) set.add(it.category); });
    return ['all', ...Array.from(set).sort()];
  }, [allItems]);

  const filtered = useMemo(() => {
    let list = allItems;
    if (catalogCategory !== 'all') list = list.filter(it => it.category === catalogCategory);
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      list = list.filter(it => (it.name || '').toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q));
    }
    return list;
  }, [allItems, catalogCategory, catalogSearch]);

  const addToCart = (it) => {
    if (isProducts) {
      if (formProducts.some(p => p.product_id === it.id)) return;
      setFormProducts(prev => [...prev, {
        product_id: it.id,
        product_name: it.name,
        quantity: 1,
        unit_price: it.price || 0,
        commission: it.comm || 0,
        charged_to: null,
      }]);
    } else {
      if (formItems.some(i => i.service_id === it.id)) return;
      setFormItems(prev => [...prev, {
        service_id: it.id,
        service_name: it.name,
        price: it.price || 0,
        duration_minutes: it.duration_minutes || 30,
        staff_id: '',
        time: '',
        staff_ids: it.staff_ids || [],
      }]);
    }
  };

  const removeServiceItem = (idx) => setFormItems(prev => prev.filter((_, i) => i !== idx));
  const removeProductItem = (idx) => setFormProducts(prev => prev.filter((_, i) => i !== idx));

  const updateServiceStaff = (idx, staffId) => {
    setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, staff_id: staffId } : it));
  };
  const updateProductQty = (idx, qty) => {
    setFormProducts(prev => prev.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, qty) } : p));
  };
  const updateProductStaff = (idx, staffId) => {
    setFormProducts(prev => prev.map((p, i) => i === idx ? { ...p, charged_to: staffId } : p));
  };

  // Filter staff list by who actually performs THIS service
  const staffForService = (svcStaffIds) => {
    if (!Array.isArray(svcStaffIds) || svcStaffIds.length === 0) return staff;
    return staff.filter(s => svcStaffIds.includes(s.id));
  };

  const cartTotal = useMemo(() => {
    const svc = formItems.reduce((s, i) => s + (i.price || 0), 0);
    const prod = formProducts.reduce((s, p) => s + (p.unit_price || 0) * (p.quantity || 1), 0);
    return svc + prod;
  }, [formItems, formProducts]);

  const cartCount = formItems.length + formProducts.length;

  // Save is allowed when there's a client + a ticket. Items are optional —
  // you can open an order with just a ticket and add services later when the
  // customer is being attended.
  const canSave = !!(selectedClient || isNewClient || form.client_name) && !!(form.ticket_number && form.ticket_number.trim());

  const isAppending = !!existingOpenOrder;
  const saveLabel = submitting
    ? (isAppending ? 'Agregando...' : 'Creando...')
    : (isAppending
        ? (cartCount > 0 ? `Agregar a orden ${existingOpenOrder.ticket_number}` : 'Actualizar ticket')
        : (cartCount > 0 ? 'Crear orden' : 'Abrir orden con ticket'));

  return (
    <div className={`${b}__catalog`}>
      {/* LEFT — catalog */}
      <div className={`${b}__catalog-left`}>
        <div className={`${b}__catalog-search`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder={`Buscador inteligente — ${isProducts ? 'productos' : 'servicios'}...`}
          />
        </div>

        <div className={`${b}__catalog-cats`}>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`${b}__catalog-cat ${catalogCategory === cat ? `${b}__catalog-cat--active` : ''}`}
              onClick={() => setCatalogCategory(cat)}
            >
              {cat === 'all' ? 'TODOS' : cat.toUpperCase()}
            </button>
          ))}
        </div>

        <div className={`${b}__catalog-grid`}>
          {filtered.length === 0 ? (
            <div className={`${b}__catalog-empty`}>Sin resultados</div>
          ) : filtered.map(it => {
            const inCart = isProducts
              ? formProducts.some(p => p.product_id === it.id)
              : formItems.some(i => i.service_id === it.id);
            const initials = (it.name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
            return (
              <div key={it.id} className={`${b}__catalog-card ${inCart ? `${b}__catalog-card--in` : ''}`}>
                <div className={`${b}__catalog-card-thumb`}>{initials}</div>
                <div className={`${b}__catalog-card-info`}>
                  <span className={`${b}__catalog-card-name`}>{it.name}</span>
                  <span className={`${b}__catalog-card-cat`}>{it.category || (isProducts ? 'Producto' : 'Servicio')}</span>
                  {!isProducts && it.duration_minutes && <span className={`${b}__catalog-card-meta`}>{it.duration_minutes} min</span>}
                  {isProducts && typeof it.stock === 'number' && <span className={`${b}__catalog-card-meta`}>Stock: {it.stock}</span>}
                </div>
                <div className={`${b}__catalog-card-foot`}>
                  <span className={`${b}__catalog-card-price`}>{formatCOP(it.price || 0)}</span>
                  <button
                    type="button"
                    className={`${b}__catalog-card-add ${inCart ? `${b}__catalog-card-add--in` : ''}`}
                    onClick={() => addToCart(it)}
                    disabled={inCart}
                  >
                    {inCart ? (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> En carrito</>
                    ) : (
                      <>+ Agregar</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT — client + cart */}
      <aside className={`${b}__cart`}>
        {/* Client header */}
        <div className={`${b}__cart-client-head`}>
          <span className={`${b}__cart-eyebrow`}>Cliente</span>
          {selectedClient ? (
            <>
              <div className={`${b}__cart-client-pill`}>
                <div className={`${b}__cart-client-avatar`}>
                  {selectedClient.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?'}
                </div>
                <div className={`${b}__cart-client-text`}>
                  <span className={`${b}__cart-client-name`}>{selectedClient.name}</span>
                  {selectedClient.client_id && (
                    <span className={`${b}__cart-client-ticket`}>{selectedClient.client_id}</span>
                  )}
                </div>
                <button type="button" className={`${b}__cart-client-x`} onClick={clearClient} title="Quitar cliente">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Existing open order banner */}
              {existingOpenOrder && (
                <div className={`${b}__cart-merge-banner`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <strong>Tiene una orden abierta</strong>
                    <span>Lo que agregues se sumará a la orden <code>{existingOpenOrder.ticket_number}</code> ({existingOpenOrder.items?.length || 0} servicio{(existingOpenOrder.items?.length || 0) === 1 ? '' : 's'})</span>
                  </div>
                </div>
              )}

              {/* Ticket input — saved/updated on the client profile */}
              <div className={`${b}__cart-ticket`}>
                <label className={`${b}__cart-ticket-label`}>
                  N° Ticket / Manilla
                  <span className={`${b}__cart-ticket-hint`}>se guarda en el perfil del cliente</span>
                </label>
                <div className={`${b}__cart-ticket-input`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 9V5a2 2 0 0 1 2-2h4M22 9V5a2 2 0 0 0-2-2h-4M2 15v4a2 2 0 0 0 2 2h4M22 15v4a2 2 0 0 1-2 2h-4"/><line x1="9" y1="9" x2="9" y2="15"/><line x1="15" y1="9" x2="15" y2="15"/></svg>
                  <input
                    type="text"
                    value={form.ticket_number || ''}
                    onChange={(e) => setForm(p => ({ ...p, ticket_number: e.target.value }))}
                    placeholder="Ej: M1212"
                    autoFocus={!form.ticket_number}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={`${b}__cart-search-wrap`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  value={ticketLookup}
                  onChange={(e) => setTicketLookup(e.target.value)}
                  placeholder="Ticket (M1212), nombre o teléfono..."
                />
                {ticketSearching && <div className={`${b}__cart-search-spin`} />}
              </div>
              {ticketResults.length > 0 && (
                <div className={`${b}__cart-results`}>
                  {ticketResults.map(c => (
                    <button key={c.id} type="button" className={`${b}__cart-result`} onClick={() => pickTicketResult(c)}>
                      <div className={`${b}__cart-result-avatar`}>{c.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}</div>
                      <div className={`${b}__cart-result-info`}>
                        <span>{c.name}</span>
                        <small>{c.visit_code || c.client_id} · {c.phone || ''}</small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {ticketLookup.length >= 2 && !ticketSearching && ticketResults.length === 0 && (
                <p className={`${b}__cart-noresult`}>No encontramos a "{ticketLookup}".</p>
              )}
              <div className={`${b}__cart-shortcuts`}>
                <button type="button" className={`${b}__cart-shortcut`} onClick={openCreate}>+ Cliente nuevo</button>
              </div>
            </>
          )}
        </div>
        {/* close client-head */}

        {/* Cart items */}
        <div className={`${b}__cart-list`}>
          <span className={`${b}__cart-eyebrow`}>{cartCount === 0 ? 'Carrito vacío' : `${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}</span>

          {cartCount === 0 ? (
            <div className={`${b}__cart-empty`}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              <p>
                {selectedClient && form.ticket_number
                  ? 'Puedes crear la orden ya con solo el ticket y agregar servicios después, o agregar desde la izquierda ahora.'
                  : `Agrega ${isProducts ? 'productos' : 'servicios'} desde la izquierda`}
              </p>
            </div>
          ) : (
            <>
              {formItems.map((it, idx) => {
                const eligible = staffForService(it.staff_ids);
                return (
                  <div key={`s-${idx}`} className={`${b}__cart-item`}>
                    <div className={`${b}__cart-item-top`}>
                      <span className={`${b}__cart-item-name`}>{it.service_name}</span>
                      <span className={`${b}__cart-item-price`}>{formatCOP(it.price)}</span>
                      <button type="button" className={`${b}__cart-item-x`} onClick={() => removeServiceItem(idx)}>×</button>
                    </div>
                    <select
                      value={it.staff_id}
                      onChange={(e) => updateServiceStaff(idx, e.target.value)}
                      className={`${b}__cart-item-select`}
                    >
                      <option value="">Profesional...</option>
                      {eligible.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                );
              })}
              {formProducts.map((p, idx) => (
                <div key={`p-${idx}`} className={`${b}__cart-item`}>
                  <div className={`${b}__cart-item-top`}>
                    <span className={`${b}__cart-item-name`}>{p.product_name}</span>
                    <span className={`${b}__cart-item-price`}>{formatCOP((p.unit_price || 0) * (p.quantity || 1))}</span>
                    <button type="button" className={`${b}__cart-item-x`} onClick={() => removeProductItem(idx)}>×</button>
                  </div>
                  <div className={`${b}__cart-item-row`}>
                    <input
                      type="number" min="1" value={p.quantity}
                      onChange={(e) => updateProductQty(idx, parseInt(e.target.value) || 1)}
                      className={`${b}__cart-item-qty`}
                    />
                    <select
                      value={p.charged_to || ''}
                      onChange={(e) => updateProductStaff(idx, e.target.value || null)}
                      className={`${b}__cart-item-select`}
                    >
                      <option value="">Vendido por...</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Totals + Save */}
        <div className={`${b}__cart-foot`}>
          <div className={`${b}__cart-total`}>
            <span>Total</span>
            <strong>{formatCOP(cartTotal)}</strong>
          </div>
          <button
            type="button"
            className={`${b}__cart-save`}
            disabled={!canSave || submitting}
            onClick={() => handleSave({ existingOpenOrder })}
          >
            {saveLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}

export default Orders;
