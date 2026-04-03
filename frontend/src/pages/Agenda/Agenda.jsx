import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import appointmentService from '../../services/appointmentService';
import staffService from '../../services/staffService';
import servicesService from '../../services/servicesService';
import clientService from '../../services/clientService';
import { useNotification } from '../../context/NotificationContext';
import CheckoutModal from '../../components/common/CheckoutModal/CheckoutModal';
import { formatPhone } from '../../utils/formatters';

const b = 'agenda';

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const HOURS_START = 7;
const HOURS_END = 21;
const TOTAL_HOURS = HOURS_END - HOURS_START;
const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => HOURS_START + i);
const SLOT_MIN = 15;
const SLOTS_PER_HOUR = 60 / SLOT_MIN;
const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR;
const CARD_H = 30;
const STAFF_COLORS = ['#2D5A3D', '#3B82F6', '#E05292', '#C9A84C', '#8B5CF6', '#F97316', '#14B8A6', '#EC4899', '#06B6D4', '#EF4444'];

const STATUS_META = {
  confirmed: { label: 'Confirmada', color: '#2D5A3D', icon: 'check' },
  completed: { label: 'Completada', color: '#22B07E', icon: 'done' },
  paid: { label: 'Pagada', color: '#3B82F6', icon: 'done' },
  cancelled: { label: 'Cancelada', color: '#E05252', icon: 'x' },
  no_show: { label: 'No asistió', color: '#D4A017', icon: 'alert' },
};

const pad2 = (n) => String(n).padStart(2, '0');
const PRODUCTS_TAG = '<!--PRODUCTS:';
const PRODUCTS_TAG_END = ':PRODUCTS-->';

const serializeProducts = (products, userNotes) => {
  const base = userNotes || '';
  if (!products || products.length === 0) return base || null;
  const data = products.map(p => ({ id: p.productId, name: p.name, base: p.basePrice, sale: p.salePrice, qty: p.qty, comm: p.commission }));
  return `${base}${base ? '\n' : ''}${PRODUCTS_TAG}${JSON.stringify(data)}${PRODUCTS_TAG_END}`;
};

const deserializeProducts = (notes) => {
  if (!notes) return { userNotes: '', products: [] };
  const start = notes.indexOf(PRODUCTS_TAG);
  if (start === -1) return { userNotes: notes, products: [] };
  const end = notes.indexOf(PRODUCTS_TAG_END);
  if (end === -1) return { userNotes: notes, products: [] };
  const userNotes = notes.substring(0, start).trim();
  try {
    const data = JSON.parse(notes.substring(start + PRODUCTS_TAG.length, end));
    const products = data.map(p => ({ productId: p.id, name: p.name, basePrice: p.base, salePrice: p.sale, qty: p.qty, commission: p.comm, stock: 0 }));
    return { userNotes, products };
  } catch { return { userNotes: notes, products: [] }; }
};
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minToTime = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const isToday = (d) => { const t = new Date(); return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear(); };

const formatCOP = (n) => {
  if (!n && n !== 0) return '$0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};

const formatDur = (m) => {
  if (!m) return '';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
};

const formatTime12 = (t) => {
  const [h, m] = t.split(':').map(Number);
  const s = h >= 12 ? 'p.m.' : 'a.m.';
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${pad2(m)} ${s}`;
};

const formatHourLabel = (h) => {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

const getEndTime = (time, dur) => {
  const total = timeToMin(time) + (dur || 30);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};

const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekDays = (monday) =>
  Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; });

const getSlotIndex = (time) => {
  const m = timeToMin(time);
  return Math.max(0, Math.min(Math.floor((m - HOURS_START * 60) / SLOT_MIN), TOTAL_SLOTS - 1));
};

const ChevronLeft = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>;
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>;
const PlusIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const ClockIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const TrashIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const SearchIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const UserPlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>;
const CalendarIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const DollarIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const CheckCircleIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
const AlertIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const ScissorsIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>;
const ChevronDown = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>;
const EmptyCalIcon = () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="14" x2="15" y2="14" /><line x1="12" y1="11" x2="12" y2="17" /></svg>;

class AgendaErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch() {}
  render() {
    if (this.state.error) return <div style={{ padding: 40, color: 'red' }}><h2>Error en Agenda</h2><pre>{this.state.error.message}{'\n'}{this.state.error.stack}</pre></div>;
    return this.props.children;
  }
}

const AgendaInner = ({ staffOnlyId = null }) => {
  const isStaffMode = !!staffOnlyId;

  const [view, setView] = useState(() => window.innerWidth < 576 ? 'day' : 'staff');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffFilter, setStaffFilter] = useState(staffOnlyId ? String(staffOnlyId) : '');
  const [showStaffDrop, setShowStaffDrop] = useState(false);
  const staffDropRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [editingApt, setEditingApt] = useState(null);
  const [formData, setFormData] = useState({ date: toISO(new Date()), notes: '', status: 'confirmed', visit_code: '' });
  const [submitting, setSubmitting] = useState(false);

  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [searchingClients, setSearchingClients] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const [serviceAssignments, setServiceAssignments] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [modalDayApts, setModalDayApts] = useState([]);

  const [productItems, setProductItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [inventory, setInventory] = useState([]);
  const autoSaveRef = useRef(null);

  useEffect(() => {
    if (!editingApt || !showModal) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      try {
        const notes = serializeProducts(productItems, formData.notes);
        if (notes !== editingApt.notes) {
          await appointmentService.update(editingApt.id, { notes: notes || null });
        }
      } catch {}
    }, 800);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [productItems, editingApt, showModal, formData.notes]);

  const { addNotification } = useNotification();
  const scrollRef = useRef(null);

  const [staffCompleteApt, setStaffCompleteApt] = useState(null);
  const [checkoutApt, setCheckoutApt] = useState(null);
  const [staffPaymentCode, setStaffPaymentCode] = useState('');
  const [staffCompleting, setStaffCompleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeChunk, setActiveChunk] = useState(0);
  const [serviceFilter, setServiceFilter] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [draggingApt, setDraggingApt] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const handleDragStart = useCallback((e, apt) => {
    if (isStaffMode || apt.status === 'completed' || apt.status === 'paid' || apt.status === 'cancelled') return;
    setDraggingApt(apt);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(apt.id));
    if (e.target) e.target.style.opacity = '0.5';
  }, [isStaffMode]);

  const handleDragEnd = useCallback((e) => {
    if (e.target) e.target.style.opacity = '1';
    setDraggingApt(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e, date, time) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ date: toISO(date), time });
  }, []);

  const handleDrop = useCallback(async (e, date, time, newStaffId) => {
    e.preventDefault();
    setDropTarget(null);
    if (!draggingApt) return;

    const newDate = toISO(date);
    const newTime = time;
    const sameDate = newDate === draggingApt.date;
    const sameTime = newTime === draggingApt.time;
    const sameStaff = !newStaffId || newStaffId === draggingApt.staff_id;

    if (sameDate && sameTime && sameStaff) {
      setDraggingApt(null);
      return;
    }

    try {
      const updateData = { date: newDate, time: newTime };
      if (newStaffId && newStaffId !== draggingApt.staff_id) {
        updateData.staff_id = newStaffId;
      }
      await appointmentService.update(draggingApt.id, updateData);
      const staffName = newStaffId && newStaffId !== draggingApt.staff_id
        ? staff.find(s => s.id === newStaffId)?.name?.split(' ')[0] || ''
        : '';
      const msg = staffName
        ? `Cita de ${draggingApt.client_name} movida a ${newTime} con ${staffName}`
        : `Cita de ${draggingApt.client_name} movida a ${newTime}`;
      addNotification(msg, 'success');
      loadData();
    } catch (err) {
      addNotification('Error al mover cita: ' + (err.message || 'Conflicto de horario'), 'error');
    }
    setDraggingApt(null);
  }, [draggingApt, addNotification, staff]);

  const weekDays = useMemo(() => getWeekDays(getMonday(currentDate)), [currentDate]);
  const isStaffView = view === 'staff';

  const serviceCategories = useMemo(() => {
    const cats = new Set();
    services.forEach(s => { if (s.category) cats.add(s.category); });
    return Array.from(cats).sort();
  }, [services]);
  const columns = useMemo(() => {
    if (isStaffView) return [currentDate];
    return view === 'week' ? weekDays : [currentDate];
  }, [view, weekDays, currentDate, isStaffView]);
  const staffColumns = useMemo(() => {
    if (!isStaffView) return [];
    let result = staff;

    if (serviceFilter) {
      const catServices = services.filter(svc => svc.category === serviceFilter);
      const eligibleStaffIds = new Set();
      catServices.forEach(svc => { svc.staff_ids?.forEach(id => eligibleStaffIds.add(id)); });
      result = result.filter(s => eligibleStaffIds.has(s.id));
    }

    if (searchQuery && searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase().trim();
      const dayStr = toISO(currentDate);
      const dayApts = appointments.filter(a => a.date === dayStr);
      result = result.filter(s => {
        if (s.name.toLowerCase().includes(q)) return true;
        const staffServices = services.filter(svc => svc.staff_ids?.includes(s.id));
        if (staffServices.some(svc => svc.name.toLowerCase().includes(q) || svc.category?.toLowerCase().includes(q))) return true;
        const staffApts = dayApts.filter(a => a.staff_id === s.id);
        if (staffApts.some(a => a.client_name?.toLowerCase().includes(q) || a.service_name?.toLowerCase().includes(q))) return true;
        return false;
      });
    }

    return result;
  }, [isStaffView, staff, searchQuery, serviceFilter, currentDate, appointments, services]);
  const STAFF_PER_ROW = 10;
  const staffChunks = useMemo(() => {
    if (!isStaffView) return [];
    const chunks = [];
    for (let i = 0; i < staffColumns.length; i += STAFF_PER_ROW) {
      chunks.push(staffColumns.slice(i, i + STAFF_PER_ROW));
    }
    return chunks;
  }, [isStaffView, staffColumns]);
  const baseSlotH = view === 'week' ? 28 : 32;
  const gridCols = isStaffView
    ? `56px repeat(${Math.max(staffColumns.length, 1)}, minmax(140px, 1fr))`
    : view === 'week' ? '56px repeat(7, 1fr)' : '56px 1fr';

  const staffColorMap = useMemo(() => {
    const map = {};
    staff.forEach((s, i) => { map[s.id] = s.color || STAFF_COLORS[i % STAFF_COLORS.length]; });
    return map;
  }, [staff]);

  const serviceMap = useMemo(() => {
    const map = {};
    services.forEach(s => { map[s.id] = s; });
    return map;
  }, [services]);

  const selectedServiceIds = useMemo(() => serviceAssignments.map(a => a.serviceId), [serviceAssignments]);

  const totalDuration = useMemo(() =>
    serviceAssignments.reduce((sum, a) => sum + (serviceMap[a.serviceId]?.duration_minutes || 0), 0),
    [serviceAssignments, serviceMap]
  );

  const totalPrice = useMemo(() =>
    serviceAssignments.reduce((sum, a) => sum + (a.clientPrice ?? serviceMap[a.serviceId]?.price ?? 0), 0),
    [serviceAssignments, serviceMap]
  );

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services;
    const q = serviceSearch.toLowerCase().trim();
    return services.filter(s =>
      s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [services, serviceSearch]);

  const filteredServicesByCategory = useMemo(() => {
    const groups = {};
    filteredServices.forEach(s => { if (!groups[s.category]) groups[s.category] = []; groups[s.category].push(s); });
    return groups;
  }, [filteredServices]);

  const quickDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const monday = getMonday(currentDate);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
      const [aptList, staffList, svcList, invData] = await Promise.all([
        appointmentService.list({ date_from: toISO(monday), date_to: toISO(sunday) }),
        staffService.list(),
        servicesService.list(),
        fetch(`${API}/inventory/products`, { credentials: 'include' }).then(r => r.ok ? r.json() : { products: [] }).catch(() => ({ products: [] })),
      ]);
      setAppointments(aptList);
      setStaff(staffList.filter(s => s.is_active !== false));
      setServices(svcList.filter(s => s.is_active));
      setInventory(invData?.products || []);
    } catch (err) {
      addNotification('Error al cargar agenda: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentDate, addNotification]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!showStaffDrop) return;
    const handler = (e) => {
      if (staffDropRef.current && staffDropRef.current.contains(e.target)) return;
      if (e.target.closest(`.${b}__staff-drop-menu`)) return;
      setShowStaffDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStaffDrop]);

  useEffect(() => {
    if (!clientSearch.trim() || isNewClient) { setClientResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchingClients(true);
      try {
        const results = await clientService.list({ search: clientSearch });
        setClientResults(Array.isArray(results) ? results.slice(0, 8) : []);
      } catch { setClientResults([]); }
      finally { setSearchingClients(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, isNewClient]);

  useEffect(() => {
    if (!showModal || !formData.date) return;
    const local = appointments.filter(a => a.date === formData.date && a.status !== 'cancelled');
    setModalDayApts(local);
    const load = async () => {
      try {
        const apts = await appointmentService.list({ date_from: formData.date, date_to: formData.date });
        setModalDayApts(apts.filter(a => a.status !== 'cancelled'));
      } catch { /* keep local data */ }
    };
    load();
  }, [showModal, formData.date, appointments]);

  const computeSlots = useCallback((staffId, serviceId, assignmentIndex) => {
    const svc = serviceMap[serviceId];
    const dur = svc?.duration_minutes || 30;

    const busy = modalDayApts
      .filter(a => a.staff_id === staffId && (!editingApt || a.id !== editingApt.id))
      .map(a => ({ s: timeToMin(a.time), e: timeToMin(a.time) + (a.duration_minutes || 30) }));

    serviceAssignments.forEach((other, j) => {
      if (j === assignmentIndex || !other.staffId || !other.time) return;
      if (parseInt(other.staffId) !== staffId) return;
      const otherSvc = serviceMap[other.serviceId];
      busy.push({ s: timeToMin(other.time), e: timeToMin(other.time) + (otherSvc?.duration_minutes || 30) });
    });

    const now = new Date();
    const isTodayDate = formData.date === toISO(now);
    const nowMin = isTodayDate ? now.getHours() * 60 + now.getMinutes() : 0;

    const editOriginalMin = editingApt ? timeToMin(editingApt.time) : null;

    const slots = [];
    for (let m = HOURS_START * 60; m < HOURS_END * 60; m += 15) {
      if (isTodayDate && m < nowMin && m !== editOriginalMin) continue;
      const end = m + dur;
      if (end > HOURS_END * 60) break;
      if (!busy.some(b => m < b.e && end > b.s)) slots.push(m);
    }
    return slots;
  }, [modalDayApts, serviceMap, editingApt, serviceAssignments, formData.date]);

  const getEligibleStaff = useCallback((serviceId) => {
    const svc = serviceMap[serviceId];
    if (!svc || !svc.staff_ids || !svc.staff_ids.length) return staff;
    return staff.filter(s => svc.staff_ids.includes(s.id));
  }, [staff, serviceMap]);

  const updateAssignment = (index, updates) => {
    setServiceAssignments(prev => prev.map((a, j) => j === index ? { ...a, ...updates } : a));
  };

  const filtered = useMemo(() => {
    let list = [...appointments];
    const activeFilter = isStaffMode ? String(staffOnlyId) : staffFilter;
    if (activeFilter) list = list.filter(a => a.staff_id === parseInt(activeFilter));
    return list;
  }, [appointments, staffFilter, isStaffMode, staffOnlyId]);

  const getStaffApts = useCallback((staffMember) => {
    const dayStr = toISO(currentDate);
    return filtered.filter(a => a.date === dayStr && a.staff_id === staffMember.id).sort((x, y) => x.time.localeCompare(y.time));
  }, [filtered, currentDate]);

  const colApts = useMemo(() => {
    if (isStaffView) {
      return staffColumns.map(s => getStaffApts(s));
    }
    return columns.map(day => {
      const dayStr = toISO(day);
      return filtered.filter(a => a.date === dayStr).sort((x, y) => x.time.localeCompare(y.time));
    });
  }, [columns, filtered, isStaffView, staffColumns, getStaffApts]);

  const slotHeights = useMemo(() => {
    const heights = new Array(TOTAL_SLOTS).fill(baseSlotH);
    colApts.forEach(apts => {
      const counts = {};
      apts.forEach(a => {
        const si = getSlotIndex(a.time);
        counts[si] = (counts[si] || 0) + 1;
      });
      Object.entries(counts).forEach(([si, count]) => {
        const i = parseInt(si);
        heights[i] = Math.max(heights[i], count * CARD_H);
      });
    });
    return heights;
  }, [colApts, baseSlotH]);

  const slotTops = useMemo(() => {
    const tops = [0];
    for (let i = 0; i < slotHeights.length; i++) tops.push(tops[i] + slotHeights[i]);
    return tops;
  }, [slotHeights]);

  const totalH = slotTops[TOTAL_SLOTS];

  const hourTop = (h) => slotTops[(h - HOURS_START) * SLOTS_PER_HOUR];
  const hourHeight = (h) => {
    const si = (h - HOURS_START) * SLOTS_PER_HOUR;
    return slotTops[si + SLOTS_PER_HOUR] - slotTops[si];
  };

  const minToPx = (m) => {
    const si = Math.max(0, Math.min(Math.floor((m - HOURS_START * 60) / SLOT_MIN), TOTAL_SLOTS - 1));
    const slotStart = HOURS_START * 60 + si * SLOT_MIN;
    const frac = (m - slotStart) / SLOT_MIN;
    return slotTops[si] + frac * slotHeights[si];
  };

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const now = new Date();
      const targetHour = isToday(currentDate) ? Math.max(now.getHours() - 1, HOURS_START) : 9;
      scrollRef.current.scrollTop = hourTop(targetHour);
    }
  }, [loading, view, currentDate, slotTops]);

  const stats = useMemo(() => {
    const todayStr = toISO(new Date());
    const todayAll = appointments.filter(a => a.date === todayStr);
    const isDone = a => a.status === 'completed' || a.status === 'paid';
    return {
      total: todayAll.length,
      revenue: todayAll.filter(isDone).reduce((s, a) => s + (a.price || 0), 0),
      completed: todayAll.filter(isDone).length,
      pending: todayAll.filter(a => a.status === 'confirmed').length,
      cancelled: todayAll.filter(a => a.status === 'cancelled').length,
      noShow: todayAll.filter(a => a.status === 'no_show').length,
    };
  }, [appointments]);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return appointments
      .filter(a => {
        const haystack = [
          a.client_name, a.service_name, a.staff_name,
          formatCOP(a.price), a.status, STATUS_META[a.status]?.label,
          a.time, formatTime12(a.time), a.date, a.notes,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const today = toISO(new Date());
        const aToday = a.date === today ? 0 : a.date > today ? 1 : 2;
        const bToday = b.date === today ? 0 : b.date > today ? 1 : 2;
        if (aToday !== bToday) return aToday - bToday;
        return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
      })
      .slice(0, 15);
  }, [searchQuery, appointments]);

  const navLabel = useMemo(() => {
    if (view === 'day' || isStaffView) {
      const d = currentDate;
      return `${DAYS_FULL[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
    }
    const s = weekDays[0], e = weekDays[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} — ${e.getDate()} de ${MONTHS[s.getMonth()]}`;
    }
    return `${s.getDate()} ${MONTHS[s.getMonth()].substring(0, 3)} — ${e.getDate()} ${MONTHS[e.getMonth()].substring(0, 3)}`;
  }, [view, currentDate, weekDays, isStaffView]);

  const navYear = useMemo(() => {
    return (view === 'day' || isStaffView) ? currentDate.getFullYear() : weekDays[0].getFullYear();
  }, [view, currentDate, weekDays, isStaffView]);

  const navigate = (dir) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (view === 'week' ? dir * 7 : dir));
      return d;
    });
  };

  const goToday = () => setCurrentDate(new Date());
  const switchToDay = (date) => { setCurrentDate(date); setView('day'); };

  const colCounts = useMemo(() => {
    return colApts.map(apts => apts.length);
  }, [colApts]);

  const weekTotal = useMemo(() => {
    return filtered.length;
  }, [filtered]);

  const resetModal = () => {
    setSelectedClient(null);
    setIsNewClient(false);
    setClientSearch('');
    setClientResults([]);
    setNewClientName('');
    setNewClientPhone('');
    setServiceAssignments([]);
    setServiceSearch('');
    setShowServiceDropdown(false);
    setProductItems([]);
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const openCreate = (date, time) => {
    setEditingApt(null);
    resetModal();
    setFormData({ date: date ? toISO(date) : toISO(currentDate), notes: '', status: 'confirmed', visit_code: '' });
    setShowModal(true);
  };

  const openEdit = (apt) => {
    setEditingApt(apt);
    resetModal();
    setSelectedClient({ id: apt.client_id, name: apt.client_name, phone: apt.client_phone });
    setServiceAssignments([{ serviceId: apt.service_id, staffId: String(apt.staff_id), time: apt.time, clientPrice: apt.price || serviceMap[apt.service_id]?.price || 0 }]);
    const { userNotes, products } = deserializeProducts(apt.notes);
    const codeMatch = userNotes.match(/\[CODIGO:([^\]]+)\]/);
    const visitCode = codeMatch ? codeMatch[1] : '';
    const cleanNotes = userNotes.replace(/\[CODIGO:[^\]]+\]\s*/g, '').trim();
    setFormData({ date: apt.date, notes: cleanNotes, status: apt.status, visit_code: visitCode });
    setProductItems(products);
    setShowModal(true);
  };

  const handleDateChange = (newDate) => {
    setFormData(prev => ({ ...prev, date: newDate }));
    setServiceAssignments(prev => prev.map(a => ({ ...a, time: '' })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let clientName, clientPhone, clientId;

      if (isNewClient) {
        if (!newClientName.trim() || !newClientPhone.trim()) {
          addNotification('Completa nombre y teléfono del nuevo cliente', 'error');
          setSubmitting(false);
          return;
        }
        try {
          const created = await clientService.create({ name: newClientName.trim(), phone: newClientPhone.trim() });
          clientName = newClientName.trim();
          clientPhone = created.phone;
          clientId = created.id;
          addNotification(`Cliente ${created.name} creado`, 'success');
        } catch (err) {
          addNotification('Error creando cliente: ' + err.message, 'error');
          setSubmitting(false);
          return;
        }
      } else if (selectedClient) {
        clientName = selectedClient.name;
        clientPhone = selectedClient.phone;
        clientId = selectedClient.id;
      } else {
        addNotification('Selecciona un cliente', 'error');
        setSubmitting(false);
        return;
      }

      if (!serviceAssignments.length || serviceAssignments.some(a => !a.staffId || !a.time)) {
        addNotification('Completa profesional y horario para cada servicio', 'error');
        setSubmitting(false);
        return;
      }

      if (editingApt) {
        const first = serviceAssignments[0];
        const updateData = {};
        if (clientName !== editingApt.client_name) updateData.client_name = clientName;
        if (clientPhone !== editingApt.client_phone) updateData.client_phone = clientPhone;
        if ((clientId || null) !== (editingApt.client_id || null)) updateData.client_id = clientId || null;
        if (parseInt(first.staffId) !== editingApt.staff_id) updateData.staff_id = parseInt(first.staffId);
        if (first.serviceId !== editingApt.service_id) updateData.service_id = first.serviceId;
        if (formData.date !== editingApt.date) updateData.date = formData.date;
        if (first.time !== editingApt.time) updateData.time = first.time;
        const userNotesWithCode = (formData.visit_code ? `[CODIGO:${formData.visit_code}] ` : '') + (formData.notes || '');
          const serializedNotes = serializeProducts(productItems, userNotesWithCode.trim());
        if ((serializedNotes || null) !== (editingApt.notes || null)) updateData.notes = serializedNotes || null;
        if (formData.status !== editingApt.status) updateData.status = formData.status;
        const firstPrice = first.clientPrice ?? serviceMap[first.serviceId]?.price;
        if (firstPrice && firstPrice !== editingApt.price) updateData.price = firstPrice;
        if (Object.keys(updateData).length > 0) {
          await appointmentService.update(editingApt.id, updateData);
        }
        for (let i = 1; i < serviceAssignments.length; i++) {
          const a = serviceAssignments[i];
          await appointmentService.create({
            client_name: clientName, client_phone: clientPhone, client_id: clientId || null,
            staff_id: parseInt(a.staffId), service_id: a.serviceId,
            date: formData.date, time: a.time,
            notes: null, status: formData.status, created_by: 'admin',
          });
        }
        addNotification('Cita actualizada', 'success');
      } else {
        for (const a of serviceAssignments) {
          const svcPrice = a.clientPrice ?? serviceMap[a.serviceId]?.price;
          const userNotesWithCode = (formData.visit_code ? `[CODIGO:${formData.visit_code}] ` : '') + (formData.notes || '');
          const serializedNotes = serializeProducts(productItems, userNotesWithCode.trim());
          await appointmentService.create({
            client_name: clientName, client_phone: clientPhone, client_id: clientId || null,
            staff_id: parseInt(a.staffId), service_id: a.serviceId,
            date: formData.date, time: a.time,
            price: svcPrice || null,
            notes: serializedNotes || null, status: formData.status, created_by: 'admin',
          });
        }
        {
          const firstSvc = serviceMap[serviceAssignments[0]?.serviceId];
          const staffName = staff.find(s => s.id === parseInt(serviceAssignments[0]?.staffId))?.name?.split(' ')[0] || '';
          const msg = serviceAssignments.length > 1
            ? `${serviceAssignments.length} citas creadas para ${clientName}`
            : `Cita creada: ${clientName} con ${staffName} — ${firstSvc?.name || 'Servicio'}`;
          addNotification(msg, 'success');
        }
      }
      if (productItems.length > 0) {
        const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
        const assignedStaff = serviceAssignments[0]?.staffId ? staff.find(s => s.id === parseInt(serviceAssignments[0].staffId)) : null;
        const staffLabel = assignedStaff ? assignedStaff.name : 'Staff';
        for (const item of productItems) {
          try {
            const priceDiff = item.salePrice !== item.basePrice ? ` (base: ${formatCOP(item.basePrice)}, cliente: ${formatCOP(item.salePrice)})` : ` (${formatCOP(item.salePrice)})`;
            const commLabel = item.commission ? ` — Comision ${staffLabel}: ${formatCOP(item.commission)}` : '';
            const resp = await fetch(`${API}/inventory/products/${item.productId}/stock`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'sale',
                quantity: item.qty,
                note: `Venta en cita — ${clientName} — ${item.name} x${item.qty}${priceDiff}${commLabel}`,
              }),
            });
            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              addNotification(`Error inventario (${item.name}): ${err.detail || resp.status}`, 'error');
            }
          } catch (e) {
            addNotification(`Error inventario (${item.name}): ${e.message}`, 'error');
          }
        }
        addNotification(`${productItems.length} producto(s) descontados del inventario`, 'info');
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      const msg = typeof err?.message === 'string' ? err.message : 'Error al guardar cita';
      addNotification(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingApt || !window.confirm('¿Eliminar esta cita?')) return;
    try {
      await appointmentService.delete(editingApt.id);
      addNotification('Cita eliminada', 'success');
      setShowModal(false);
      loadData();
    } catch (err) { addNotification(err.message, 'error'); }
  };

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = nowMin >= HOURS_START * 60 && nowMin < HOURS_END * 60;
  const nowTop = minToPx(nowMin);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__loading`}>
          <div className={`${b}__loading-content`}>
            <div className={`${b}__loading-icon`}>
              <CalendarIcon />
            </div>
            <div className={`${b}__loading-skeleton`}>
              <div className={`${b}__skeleton-bar ${b}__skeleton-bar--lg`} />
              <div className={`${b}__skeleton-bar ${b}__skeleton-bar--sm`} />
              <div className={`${b}__skeleton-bar ${b}__skeleton-bar--md`} />
            </div>
            <span className={`${b}__loading-text`}>Cargando agenda...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${b}${draggingApt ? ` ${b}--dragging` : ''}`}>
      <div className={`${b}__topbar`}>
        <div className={`${b}__topbar-left`}>
          <h1 className={`${b}__title`}>Agenda</h1>
          <span className={`${b}__subtitle`}>{navYear}</span>
        </div>
        <div className={`${b}__topbar-center`}>
          <div className={`${b}__topbar-nav`}>
            <button className={`${b}__nav-arrow`} onClick={() => navigate(-1)} title="Anterior"><ChevronLeft /></button>
            <h2 className={`${b}__nav-label`}>{navLabel}</h2>
            <button className={`${b}__nav-arrow`} onClick={() => navigate(1)} title="Siguiente"><ChevronRight /></button>
          </div>
          <button className={`${b}__today-btn`} onClick={goToday}>Hoy</button>
        </div>
        <div className={`${b}__topbar-right`}>
          <div className={`${b}__view-toggle`}>
            <button className={`${b}__vt-btn ${view === 'staff' ? `${b}__vt-btn--on` : ''}`} onClick={() => setView('staff')}>Equipo</button>
            <button className={`${b}__vt-btn ${view === 'week' ? `${b}__vt-btn--on` : ''}`} onClick={() => setView('week')}>Semana</button>
            <button className={`${b}__vt-btn ${view === 'day' ? `${b}__vt-btn--on` : ''}`} onClick={() => setView('day')}>Dia</button>
          </div>
          {!isStaffMode && (
            <button className={`${b}__create-btn`} onClick={() => openCreate()}>
              <PlusIcon /> Nueva cita
            </button>
          )}
        </div>
      </div>
      <div className={`${b}__search`} ref={searchRef}>
        <div className={`${b}__search-box ${searchOpen ? `${b}__search-box--open` : ''}`}>
          <SearchIcon />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); setActiveChunk(0); }}
            onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
            placeholder="Buscar cliente, servicio, precio, estado..."
            className={`${b}__search-input`}
          />
          {searchQuery && (
            <button className={`${b}__search-clear`} onClick={() => { setSearchQuery(''); setSearchOpen(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
        {searchOpen && !isStaffView && searchResults.length > 0 && (
          <div className={`${b}__search-results`}>
            <div className={`${b}__search-results-header`}>
              <span>{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}</span>
            </div>
            {searchResults.map((apt) => {
              const sc = STATUS_META[apt.status]?.color || '#6B6B63';
              const sl = STATUS_META[apt.status]?.label || apt.status;
              const dayName = DAYS_SHORT[new Date(apt.date + 'T12:00:00').getDay()];
              const dateShort = apt.date.split('-').slice(1).reverse().join('/');
              return (
                <button key={apt.id} className={`${b}__search-result`} onClick={() => {
                  setSearchOpen(false);
                  const aptDate = new Date(apt.date + 'T12:00:00');
                  setCurrentDate(aptDate);
                  if (view === 'week') {
                  } else {
                    setView('day');
                  }
                  setTimeout(() => openEdit(apt), 200);
                }}>
                  <div className={`${b}__search-result-status`} style={{ background: sc }} />
                  <div className={`${b}__search-result-info`}>
                    <div className={`${b}__search-result-top`}>
                      <strong>{apt.client_name}</strong>
                      <span className={`${b}__search-result-badge`} style={{ color: sc, background: `${sc}15` }}>{sl}</span>
                    </div>
                    <div className={`${b}__search-result-bottom`}>
                      <span>{apt.service_name || 'Servicio'}</span>
                      <span className={`${b}__search-result-sep`}>&middot;</span>
                      <span>{dayName} {dateShort}</span>
                      <span className={`${b}__search-result-sep`}>&middot;</span>
                      <span>{formatTime12(apt.time)}</span>
                      <span className={`${b}__search-result-sep`}>&middot;</span>
                      <span>{formatCOP(apt.price)}</span>
                      {apt.staff_name && <>
                        <span className={`${b}__search-result-sep`}>&middot;</span>
                        <span>{apt.staff_name}</span>
                      </>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {searchOpen && !isStaffView && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div className={`${b}__search-results`}>
            <div className={`${b}__search-empty`}>No se encontraron citas para "{searchQuery}"</div>
          </div>
        )}
      </div>
      {isStaffView && serviceCategories.length > 0 && (
        <div className={`${b}__service-filters`}>
          <button
            className={`${b}__sf-chip ${!serviceFilter ? `${b}__sf-chip--active` : ''}`}
            onClick={() => { setServiceFilter(''); setActiveChunk(0); }}>
            Todos
          </button>
          {serviceCategories.map(cat => (
            <button
              key={cat}
              className={`${b}__sf-chip ${serviceFilter === cat ? `${b}__sf-chip--active` : ''}`}
              onClick={() => { setServiceFilter(prev => prev === cat ? '' : cat); setActiveChunk(0); }}>
              {cat}
            </button>
          ))}
        </div>
      )}
      {isStaffView ? (
        <div className={`${b}__calendar`}>
          <div className={`${b}__cal-scroll`} ref={scrollRef}>
            {staffChunks.map((chunk, chunkIdx) => {
              const chunkGridCols = `56px repeat(${chunk.length}, minmax(140px, 1fr))`;
              const chunkStartIdx = chunkIdx * STAFF_PER_ROW;
              return (
                <div key={chunkIdx} id={`staff-chunk-${chunkIdx}`} className={`${b}__staff-chunk`}>
                  <div className={`${b}__cal-header`} style={{ gridTemplateColumns: chunkGridCols }}>
                    <div className={`${b}__corner`}>
                      <ScissorsIcon />
                    </div>
                    {chunk.map((s, i) => {
                      const globalIdx = chunkStartIdx + i;
                      const apts = getStaffApts(s);
                      const count = apts.length;
                      const color = staffColorMap[s.id] || STAFF_COLORS[globalIdx % STAFF_COLORS.length];
                      return (
                        <div key={s.id} className={`${b}__col-head ${b}__col-head--staff`}>
                          <div className={`${b}__staff-avatar`} style={{ '--staff-color': color }}>
                            {s.photo_url ? (
                              <img src={s.photo_url} alt={s.name} className={`${b}__staff-avatar-img`} />
                            ) : (
                              <span className={`${b}__staff-avatar-initials`}>
                                {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className={`${b}__col-staff-name`}>{s.name.split(' ')[0]}</span>
                          {count > 0 && <span className={`${b}__col-badge`}>{count}</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className={`${b}__cal-grid`} style={{ gridTemplateColumns: chunkGridCols }}>
                    <div className={`${b}__time-col`} style={{ height: `${totalH}px` }}>
                      {HOURS.map(h => {
                        const si0 = (h - HOURS_START) * SLOTS_PER_HOUR;
                        return [0, 15, 30, 45].map((m, mi) => (
                          <div key={`${h}-${m}`}
                            className={`${b}__time-cell ${mi === 0 ? `${b}__time-cell--hour` : `${b}__time-cell--sub`}`}
                            style={{ top: `${slotTops[si0 + mi]}px`, height: `${baseSlotH}px` }}>
                            <span className={`${b}__time-text`}>
                              {mi === 0 ? formatHourLabel(h) : `${pad2(m)}`}
                            </span>
                          </div>
                        ));
                      })}
                    </div>
                    {chunk.map((s, ci) => {
                      const apts = getStaffApts(s);
                      const slotGroups = {};
                      apts.forEach(apt => {
                        const si = getSlotIndex(apt.time);
                        if (!slotGroups[si]) slotGroups[si] = [];
                        slotGroups[si].push(apt);
                      });
                      const today = isToday(currentDate);
                      return (
                        <div key={s.id} className={`${b}__day-col ${ci % 2 === 1 ? `${b}__day-col--alt` : ''}`} style={{ height: `${totalH}px` }}>
                          {HOURS.map(h => (
                            <div key={`hl-${h}`} className={`${b}__hour-line`} style={{ top: `${hourTop(h)}px` }} />
                          ))}
                          {HOURS.map(h => {
                            const base = (h - HOURS_START) * SLOTS_PER_HOUR;
                            return [
                              <div key={`q1-${h}`} className={`${b}__quarter-line`} style={{ top: `${slotTops[base + 1]}px` }} />,
                              <div key={`hh-${h}`} className={`${b}__half-line`} style={{ top: `${slotTops[base + 2]}px` }} />,
                              <div key={`q3-${h}`} className={`${b}__quarter-line`} style={{ top: `${slotTops[base + 3]}px` }} />,
                            ];
                          })}
                          {apts.length === 0 && (
                            <div className={`${b}__empty-col`}>
                              <EmptyCalIcon />
                              <span>Sin citas</span>
                            </div>
                          )}
                          {Object.entries(slotGroups).map(([si, group]) => (
                            <div key={si} className={`${b}__event-stack`} style={{ top: `${slotTops[parseInt(si)]}px` }}>
                              {group.map((apt, evIdx) => {
                                const staffColor = staffColorMap[apt.staff_id] || '#6B6B63';
                                const statusColor = STATUS_META[apt.status]?.color || '#6B6B63';
                                const svc = serviceMap[apt.service_id];
                                const endTime = getEndTime(apt.time, apt.duration_minutes || svc?.duration_minutes || 30);
                                return (
                                  <div key={apt.id}
                                    className={`${b}__event ${(apt.status === 'completed' || apt.status === 'paid') ? `${b}__event--done` : ''} ${apt.status === 'cancelled' ? `${b}__event--cancel` : ''} ${draggingApt?.id === apt.id ? `${b}__event--dragging` : ''}`}
                                    style={{ '--c': staffColor, '--sc': statusColor, animationDelay: `${evIdx * 30}ms` }}
                                    draggable={apt.status === 'confirmed'}
                                    onDragStart={(e) => handleDragStart(e, apt)}
                                    onDragEnd={handleDragEnd}
                                    onClick={(e) => { e.stopPropagation(); openEdit(apt); }}
                                    title={`${apt.client_name} - ${apt.service_name || ''} (${formatTime12(apt.time)} - ${formatTime12(endTime)})`}>
                                    <div className={`${b}__event-accent`} />
                                    <div className={`${b}__event-body`}>
                                      <div className={`${b}__event-left`}>
                                        <span className={`${b}__event-time`}>{formatTime12(apt.time)}</span>
                                        <span className={`${b}__event-sep`}>&middot;</span>
                                        <span className={`${b}__event-name`}>{apt.client_name}</span>
                                      </div>
                                      <div className={`${b}__event-right`}>
                                        <span className={`${b}__event-service`}>{apt.service_name || ''}</span>
                                        <span className={`${b}__event-dur`}>{formatDur(apt.duration_minutes || svc?.duration_minutes)}</span>
                                        <span className={`${b}__event-price`}>{formatCOP(apt.price)}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                          {today && showNow && ci === 0 && chunkIdx === 0 && (
                            <div className={`${b}__now`} style={{ top: `${nowTop}px`, width: `calc(${chunk.length} * 100%)`, zIndex: 5 }}>
                              <div className={`${b}__now-dot`} />
                              <div className={`${b}__now-line`} />
                            </div>
                          )}
                          {HOURS.map(h => {
                            const dt = toISO(currentDate);
                            return [0, 15, 30, 45].map((m) => {
                              const t = `${pad2(h)}:${pad2(m)}`;
                              const si = (h - HOURS_START) * SLOTS_PER_HOUR + (m / SLOT_MIN);
                              const isDrop = dropTarget?.date === dt && dropTarget?.time === t;
                              return (
                                <div key={`s${h}${m}`}
                                  className={`${b}__slot ${isDrop ? `${b}__slot--drop-target` : ''}`}
                                  style={{ top: `${slotTops[si]}px`, height: `${baseSlotH}px` }}
                                  onClick={() => openCreate(currentDate, t)}
                                  onDragOver={(e) => handleDragOver(e, currentDate, t)}
                                  onDragLeave={() => setDropTarget(null)}
                                  onDrop={(e) => handleDrop(e, currentDate, t, s.id)}>
                                  {isDrop && <span className={`${b}__drop-label`}>{formatTime12(t)}</span>}
                                </div>
                              );
                            });
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {staffChunks.length > 1 && (
            <div className={`${b}__chunk-arrows`}>
              <button
                className={`${b}__chunk-arrow ${activeChunk === 0 ? `${b}__chunk-arrow--disabled` : ''}`}
                disabled={activeChunk === 0}
                onClick={() => {
                  const prev = activeChunk - 1;
                  setActiveChunk(prev);
                  const el = document.getElementById(`staff-chunk-${prev}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <span className={`${b}__chunk-label`}>{activeChunk + 1}/{staffChunks.length}</span>
              <button
                className={`${b}__chunk-arrow ${activeChunk >= staffChunks.length - 1 ? `${b}__chunk-arrow--disabled` : ''}`}
                disabled={activeChunk >= staffChunks.length - 1}
                onClick={() => {
                  const next = activeChunk + 1;
                  setActiveChunk(next);
                  const el = document.getElementById(`staff-chunk-${next}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`${b}__calendar`}>
          <div className={`${b}__cal-scroll`} ref={scrollRef}>
            <div className={`${b}__cal-header`} style={{ gridTemplateColumns: gridCols }}>
              <div className={`${b}__corner`}>
                <ScissorsIcon />
              </div>
              {columns.map((day, i) => {
                const today = isToday(day);
                const count = colCounts[i];
                return (
                  <div key={i} className={`${b}__col-head ${today ? `${b}__col-head--today` : ''}`} onClick={() => view === 'week' ? switchToDay(day) : null}>
                    <span className={`${b}__col-day`}>{DAYS_SHORT[day.getDay()]}</span>
                    <span className={`${b}__col-num ${today ? `${b}__col-num--today` : ''}`}>{day.getDate()}</span>
                    {count > 0 && <span className={`${b}__col-badge`}>{count}</span>}
                  </div>
                );
              })}
            </div>
            <div className={`${b}__cal-grid`} style={{ gridTemplateColumns: gridCols }}>
              <div className={`${b}__time-col`} style={{ height: `${totalH}px` }}>
                {HOURS.map(h => {
                  const si0 = (h - HOURS_START) * SLOTS_PER_HOUR;
                  return [0, 15, 30, 45].map((m, mi) => (
                    <div key={`${h}-${m}`}
                      className={`${b}__time-cell ${mi === 0 ? `${b}__time-cell--hour` : `${b}__time-cell--sub`}`}
                      style={{ top: `${slotTops[si0 + mi]}px`, height: `${baseSlotH}px` }}>
                      <span className={`${b}__time-text`}>
                        {mi === 0 ? formatHourLabel(h) : `${pad2(m)}`}
                      </span>
                    </div>
                  ));
                })}
              </div>
              {columns.map((day, ci) => {
                const today = isToday(day);
                const apts = colApts[ci] || [];
                const slotGroups = {};
                apts.forEach(apt => {
                  const si = getSlotIndex(apt.time);
                  if (!slotGroups[si]) slotGroups[si] = [];
                  slotGroups[si].push(apt);
                });
                return (
                  <div key={ci} className={`${b}__day-col ${today ? `${b}__day-col--today` : ''} ${ci % 2 === 1 ? `${b}__day-col--alt` : ''}`} style={{ height: `${totalH}px` }}>
                    {HOURS.map(h => (
                      <div key={`hl-${h}`} className={`${b}__hour-line`} style={{ top: `${hourTop(h)}px` }} />
                    ))}
                    {HOURS.map(h => {
                      const base = (h - HOURS_START) * SLOTS_PER_HOUR;
                      return [
                        <div key={`q1-${h}`} className={`${b}__quarter-line`} style={{ top: `${slotTops[base + 1]}px` }} />,
                        <div key={`hh-${h}`} className={`${b}__half-line`} style={{ top: `${slotTops[base + 2]}px` }} />,
                        <div key={`q3-${h}`} className={`${b}__quarter-line`} style={{ top: `${slotTops[base + 3]}px` }} />,
                      ];
                    })}
                    {apts.length === 0 && today && (
                      <div className={`${b}__empty-col`}>
                        <EmptyCalIcon />
                        <span>Sin citas</span>
                      </div>
                    )}
                    {Object.entries(slotGroups).map(([si, group]) => (
                      <div key={si} className={`${b}__event-stack`} style={{ top: `${slotTops[parseInt(si)]}px` }}>
                        {group.map((apt, evIdx) => {
                          const staffColor = staffColorMap[apt.staff_id] || '#6B6B63';
                          const statusColor = STATUS_META[apt.status]?.color || '#6B6B63';
                          const statusLabel = STATUS_META[apt.status]?.label || '';
                          const svc = serviceMap[apt.service_id];
                          const endTime = getEndTime(apt.time, apt.duration_minutes || svc?.duration_minutes || 30);
                          return (
                            <div key={apt.id}
                              className={`${b}__event ${(apt.status === 'completed' || apt.status === 'paid') ? (isStaffMode ? `${b}__event--done-staff` : `${b}__event--done`) : ''} ${apt.status === 'cancelled' ? `${b}__event--cancel` : ''} ${draggingApt?.id === apt.id ? `${b}__event--dragging` : ''}`}
                              style={{ '--c': staffColor, '--sc': statusColor, animationDelay: `${evIdx * 30}ms` }}
                              draggable={!isStaffMode && apt.status === 'confirmed'}
                              onDragStart={(e) => handleDragStart(e, apt)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isStaffMode) {
                                  if (apt.status === 'confirmed') { setStaffCompleteApt(apt); setStaffPaymentCode(''); }
                                } else {
                                  openEdit(apt);
                                }
                              }}
                              title={`${apt.client_name} - ${apt.service_name || ''} (${formatTime12(apt.time)} - ${formatTime12(endTime)})`}>
                              <div className={`${b}__event-accent`} />
                              <div className={`${b}__event-body`}>
                                <div className={`${b}__event-left`}>
                                  <span className={`${b}__event-time`}>{formatTime12(apt.time)}</span>
                                  <span className={`${b}__event-sep`}>&middot;</span>
                                  <span className={`${b}__event-name`}>{apt.client_name}</span>
                                </div>
                                <div className={`${b}__event-right`}>
                                  <span className={`${b}__event-service`}>{apt.service_name || ''}</span>
                                  <span className={`${b}__event-dur`}>{formatDur(apt.duration_minutes || svc?.duration_minutes)}</span>
                                  <span className={`${b}__event-price`}>{formatCOP(apt.price)}</span>
                                  <span className={`${b}__event-badge`} style={{ '--sc': statusColor }} title={statusLabel}>
                                    <span className={`${b}__event-badge-dot`} style={{ background: statusColor }} />
                                    {apt.staff_name || ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {today && showNow && (
                      <div className={`${b}__now`} style={{ top: `${nowTop}px` }}>
                        <div className={`${b}__now-dot`} />
                        <div className={`${b}__now-line`} />
                      </div>
                    )}
                    {!isStaffMode && HOURS.map(h => {
                      const dt = toISO(day);
                      return [0, 15, 30, 45].map((m) => {
                        const t = `${pad2(h)}:${pad2(m)}`;
                        const si = (h - HOURS_START) * SLOTS_PER_HOUR + (m / SLOT_MIN);
                        const isDrop = dropTarget?.date === dt && dropTarget?.time === t;
                        return (
                          <div key={`s${h}${m}`}
                            className={`${b}__slot ${isDrop ? `${b}__slot--drop-target` : ''}`}
                            style={{ top: `${slotTops[si]}px`, height: `${baseSlotH}px` }}
                            onClick={() => openCreate(day, t)}
                            onDragOver={(e) => handleDragOver(e, day, t)}
                            onDragLeave={() => setDropTarget(null)}
                            onDrop={(e) => handleDrop(e, day, t)}>
                            {isDrop && <span className={`${b}__drop-label`}>{formatTime12(t)}</span>}
                          </div>
                        );
                      });
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showModal && createPortal(
        <div className={`${b}__overlay`} onClick={() => setShowModal(false)}>
          <div className={`${b}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__modal-head`}>
              <div className={`${b}__modal-head-left`}>
                <div className={`${b}__modal-head-icon`}>
                  {editingApt ? <CalendarIcon /> : <PlusIcon />}
                </div>
                <div className={`${b}__modal-head-text`}>
                  <h2>{editingApt ? 'Editar cita' : 'Nueva cita'}</h2>
                  {editingApt && <span className={`${b}__modal-head-sub`}>ID: {editingApt.id}</span>}
                </div>
              </div>
              <div className={`${b}__modal-head-actions`}>
                <button type="submit" className={`${b}__modal-save`} disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" className={`${b}__modal-x`} onClick={() => setShowModal(false)}><CloseIcon /></button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className={`${b}__modal-body`}>
              <div className={`${b}__section`}>
                <span className={`${b}__section-label`}>Cliente</span>
                {selectedClient && !isNewClient ? (
                  <div className={`${b}__client-chip`}>
                    <div className={`${b}__client-avatar`}>
                      {selectedClient.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className={`${b}__client-chip-info`}>
                      <span className={`${b}__client-chip-name`}>{selectedClient.name}</span>
                      <span className={`${b}__client-chip-phone`}>{formatPhone(selectedClient.phone)}</span>
                    </div>
                    {selectedClient.status && (
                      <span className={`${b}__client-tag ${b}__client-tag--${selectedClient.status}`}>{selectedClient.status}</span>
                    )}
                    <button type="button" className={`${b}__client-chip-x`} onClick={() => { setSelectedClient(null); setClientSearch(''); }}>
                      <CloseIcon />
                    </button>
                  </div>
                ) : isNewClient ? (
                  <div className={`${b}__new-client`}>
                    <div className={`${b}__new-client-badge`}><UserPlusIcon /> Nuevo cliente</div>
                    <div className={`${b}__row`}>
                      <div className={`${b}__field`}>
                        <label>Nombre completo</label>
                        <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} required placeholder="Juan Perez" autoFocus />
                      </div>
                      <div className={`${b}__field`}>
                        <label>Telefono</label>
                        <input type="text" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} required placeholder="+573001234567" />
                      </div>
                    </div>
                    <button type="button" className={`${b}__link-btn`} onClick={() => { setIsNewClient(false); setNewClientName(''); setNewClientPhone(''); }}>
                      ← Buscar cliente existente
                    </button>
                  </div>
                ) : (
                  <div className={`${b}__client-search`}>
                    <div className={`${b}__search-wrap`}>
                      <SearchIcon />
                      <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Buscar por nombre o telefono..." autoFocus />
                      {searchingClients && <div className={`${b}__search-spin`} />}
                    </div>
                    {clientResults.length > 0 && (
                      <div className={`${b}__search-results`}>
                        {clientResults.map(c => (
                          <button key={c.id} type="button" className={`${b}__search-item`}
                            onClick={() => { setSelectedClient(c); setClientSearch(''); setClientResults([]); }}>
                            <div className={`${b}__search-item-avatar`}>{c.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}</div>
                            <div className={`${b}__search-item-info`}>
                              <span className={`${b}__search-item-name`}>{c.name}</span>
                              <span className={`${b}__search-item-phone`}>{formatPhone(c.phone)}</span>
                            </div>
                            {c.total_visits > 0 && <span className={`${b}__search-item-visits`}>{c.total_visits} visitas</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {clientSearch.length > 2 && !searchingClients && clientResults.length === 0 && (
                      <div className={`${b}__search-empty`}>Sin resultados para &ldquo;{clientSearch}&rdquo;</div>
                    )}
                    <button type="button" className={`${b}__new-client-btn`} onClick={() => { setIsNewClient(true); if (clientSearch.trim()) setNewClientName(clientSearch.trim()); }}>
                      <UserPlusIcon /> Agregar cliente nuevo
                    </button>
                  </div>
                )}
              </div>
              <div className={`${b}__section`}>
                <span className={`${b}__section-label`}>
                  {serviceAssignments.length > 1 ? `Servicios (${serviceAssignments.length})` : 'Servicio'}
                </span>
                {serviceAssignments.length > 0 && (
                  <div className={`${b}__svc-list`}>
                    {serviceAssignments.map((a, i) => {
                      const svc = serviceMap[a.serviceId];
                      if (!svc) return null;
                      return (
                        <div key={`${a.serviceId}-${i}`} className={`${b}__svc-chip`}>
                          <span className={`${b}__svc-chip-num`}>{i + 1}</span>
                          <div className={`${b}__svc-chip-info`}>
                            <span className={`${b}__svc-chip-name`}>{svc.name}</span>
                            <span className={`${b}__svc-chip-meta`}>{svc.category} &middot; {formatDur(svc.duration_minutes)} &middot; Base: {formatCOP(svc.price)}</span>
                          </div>
                          <div className={`${b}__svc-chip-price`}>
                            <label>Precio cliente</label>
                            <input type="number" value={a.clientPrice ?? svc.price}
                              onChange={e => updateAssignment(i, { clientPrice: Number(e.target.value) })} />
                          </div>
                          <button type="button" className={`${b}__svc-chip-x`} onClick={() => setServiceAssignments(prev => prev.filter((_, j) => j !== i))}>
                            <CloseIcon />
                          </button>
                        </div>
                      );
                    })}
                    {serviceAssignments.length > 1 && (
                      <div className={`${b}__svc-total`}><ClockIcon /> Total: {formatDur(totalDuration)} &middot; {formatCOP(totalPrice)}</div>
                    )}
                  </div>
                )}
                <div className={`${b}__svc-search`}>
                  <div className={`${b}__search-wrap`}>
                    <SearchIcon />
                    <input type="text" value={serviceSearch}
                      onChange={e => { setServiceSearch(e.target.value); setShowServiceDropdown(true); }}
                      onFocus={() => setShowServiceDropdown(true)}
                      placeholder={serviceAssignments.length > 0 ? 'Agregar otro servicio...' : 'Buscar servicio...'} />
                  </div>
                  {showServiceDropdown && (
                    <div className={`${b}__svc-results`}>
                      {Object.entries(filteredServicesByCategory).length > 0 ? (
                        Object.entries(filteredServicesByCategory).map(([cat, svcs]) => (
                          <div key={cat} className={`${b}__svc-group`}>
                            <span className={`${b}__svc-group-label`}>{cat}</span>
                            {svcs.map(s => {
                              const added = selectedServiceIds.includes(s.id);
                              return (
                                <button key={s.id} type="button" className={`${b}__svc-item ${added ? `${b}__svc-item--added` : ''}`} disabled={added}
                                  onClick={() => {
                                    setServiceAssignments(prev => [...prev, { serviceId: s.id, staffId: '', time: '', clientPrice: s.price }]);
                                    setServiceSearch('');
                                    setShowServiceDropdown(false);
                                  }}>
                                  <span className={`${b}__svc-item-name`}>{s.name}</span>
                                  <span className={`${b}__svc-item-detail`}>{added ? 'Agregado' : `${formatDur(s.duration_minutes)} · ${formatCOP(s.price)}`}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))
                      ) : (
                        <div className={`${b}__search-empty`}>Sin resultados para &ldquo;{serviceSearch}&rdquo;</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className={`${b}__section`}>
                <span className={`${b}__section-label`}>
                  Productos utilizados {productItems.length > 0 ? `(${productItems.length})` : ''}
                </span>
                {productItems.length > 0 && (
                  <div className={`${b}__product-list`}>
                    {productItems.map((item, i) => {
                      const assignedStaff = serviceAssignments[0]?.staffId ? staff.find(s => s.id === parseInt(serviceAssignments[0].staffId)) : null;
                      return (
                        <div key={i} className={`${b}__product-row`}>
                          <div className={`${b}__product-info`}>
                            <span className={`${b}__product-name`}>{item.name}</span>
                            <span className={`${b}__product-stock`}>Stock: {item.stock} &middot; Base: {formatCOP(item.basePrice)}</span>
                          </div>
                          <div className={`${b}__product-fields`}>
                            <div className={`${b}__product-field`}>
                              <label>Precio cliente</label>
                              <input type="number" value={item.salePrice}
                                onChange={e => setProductItems(prev => prev.map((p, j) => j === i ? { ...p, salePrice: Number(e.target.value) } : p))} />
                            </div>
                            <div className={`${b}__product-field`}>
                              <label>Cant.</label>
                              <input type="number" min="1" value={item.qty}
                                onChange={e => setProductItems(prev => prev.map((p, j) => j === i ? { ...p, qty: Number(e.target.value) || 1 } : p))} />
                            </div>
                            <div className={`${b}__product-field`}>
                              <label>Comision {assignedStaff ? assignedStaff.name.split(' ')[0] : ''}</label>
                              <input type="number" value={item.commission}
                                onChange={e => setProductItems(prev => prev.map((p, j) => j === i ? { ...p, commission: Number(e.target.value) } : p))} />
                            </div>
                          </div>
                          <button type="button" className={`${b}__product-remove`}
                            onClick={() => setProductItems(prev => prev.filter((_, j) => j !== i))}>
                            <CloseIcon />
                          </button>
                        </div>
                      );
                    })}
                    <div className={`${b}__product-total`}>
                      Total productos: {formatCOP(productItems.reduce((s, p) => s + p.salePrice * p.qty, 0))}
                      {productItems.some(p => p.commission > 0) && (
                        <> &middot; Comisiones: {formatCOP(productItems.reduce((s, p) => s + p.commission, 0))}</>
                      )}
                    </div>
                  </div>
                )}
                <div className={`${b}__svc-search`}>
                  <div className={`${b}__search-wrap`}>
                    <SearchIcon />
                    <input type="text" value={productSearch}
                      onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                      onFocus={() => setShowProductDropdown(true)}
                      placeholder="Buscar producto del inventario..." />
                  </div>
                  {showProductDropdown && (
                    <div className={`${b}__svc-results`}>
                      {(() => {
                        const q = productSearch.toLowerCase().trim();
                        const list = q ? inventory.filter(p => p.name?.toLowerCase().includes(q)) : inventory;
                        if (list.length === 0) return <div className={`${b}__search-empty`}>{q ? `Sin productos para "${productSearch}"` : 'No hay productos en inventario'}</div>;
                        return list.map(p => (
                          <button key={p.id} type="button" className={`${b}__svc-item`}
                            onClick={() => {
                              setProductItems(prev => [...prev, {
                                productId: p.id,
                                name: p.name,
                                stock: p.stock || 0,
                                basePrice: p.sale_price || p.price || 0,
                                salePrice: p.sale_price || p.price || 0,
                                qty: 1,
                                commission: 0,
                              }]);
                              setProductSearch('');
                              setShowProductDropdown(false);
                            }}>
                            <span className={`${b}__svc-item-name`}>{p.name}</span>
                            <span className={`${b}__svc-item-detail`}>Stock: {p.stock || 0} · {formatCOP(p.sale_price || p.price || 0)}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
              {serviceAssignments.length > 0 && (
                <div className={`${b}__section`}>
                  <span className={`${b}__section-label`}>Fecha</span>
                  <div className={`${b}__quick-dates`}>
                    {quickDates.map((d, i) => {
                      const iso = toISO(d);
                      const active = formData.date === iso;
                      return (
                        <button key={iso} type="button" className={`${b}__quick-date ${active ? `${b}__quick-date--on` : ''}`}
                          onClick={() => handleDateChange(iso)}>
                          <span className={`${b}__quick-date-day`}>{DAYS_SHORT[d.getDay()]}</span>
                          <span className={`${b}__quick-date-num`}>{d.getDate()}</span>
                          {i === 0 && <span className={`${b}__quick-date-tag`}>Hoy</span>}
                        </button>
                      );
                    })}
                  </div>
                  <input type="date" value={formData.date} onChange={e => handleDateChange(e.target.value)} required />
                </div>
              )}
              {serviceAssignments.length > 0 && formData.date && serviceAssignments.map((assignment, aIdx) => {
                const svc = serviceMap[assignment.serviceId];
                if (!svc) return null;
                const eligible = getEligibleStaff(assignment.serviceId);
                const staffWithAvail = eligible.map(s => ({
                  ...s,
                  availableSlots: computeSlots(s.id, assignment.serviceId, aIdx),
                  busyCount: modalDayApts.filter(a => a.staff_id === s.id && a.status !== 'cancelled').length,
                }));

                return (
                  <div key={`avail-${aIdx}`} className={`${b}__section ${b}__svc-avail`}>
                    <span className={`${b}__section-label`}>
                      {serviceAssignments.length > 1 ? `${aIdx + 1}. ` : ''}{svc.name} — {formatDur(svc.duration_minutes)}
                    </span>

                    {staffWithAvail.length > 0 ? (
                      <>
                        <div className={`${b}__avail-staff`}>
                          {staffWithAvail.map(s => {
                            const active = assignment.staffId === String(s.id);
                            const freeSlots = s.availableSlots.length;
                            const color = staffColorMap[s.id] || '#6B6B63';
                            return (
                              <button key={s.id} type="button"
                                className={`${b}__avail-card ${active ? `${b}__avail-card--on` : ''} ${freeSlots === 0 ? `${b}__avail-card--full` : ''}`}
                                style={{ '--sc': color }}
                                onClick={() => {
                                  if (active) return;
                                  const keepTime = assignment.time && s.availableSlots.includes(timeToMin(assignment.time)) ? assignment.time : '';
                                  updateAssignment(aIdx, { staffId: String(s.id), time: keepTime });
                                }}
                                disabled={freeSlots === 0}>
                                <span className={`${b}__avail-avatar`} style={{ background: s.photo_url ? 'transparent' : color }}>
                                  {s.photo_url
                                    ? <img src={s.photo_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                    : s.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
                                </span>
                                <span className={`${b}__avail-name`}>{s.name.split(' ')[0]}</span>
                                <span className={`${b}__avail-role`}>{s.role}</span>
                                <span className={`${b}__avail-meta`}>
                                  {freeSlots > 0
                                    ? <span className={`${b}__avail-free`}>{freeSlots} horarios</span>
                                    : <span className={`${b}__avail-busy`}>Ocupado</span>}
                                  {s.busyCount > 0 && <span className={`${b}__avail-count`}>{s.busyCount} cita{s.busyCount > 1 ? 's' : ''}</span>}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {assignment.staffId && (() => {
                          const selStaffId = parseInt(assignment.staffId);
                          const slots = computeSlots(selStaffId, assignment.serviceId, aIdx);
                          const selStaff = staff.find(s => s.id === selStaffId);

                          const busyRanges = modalDayApts
                            .filter(a => a.staff_id === selStaffId && a.status !== 'cancelled')
                            .map(a => ({
                              s: timeToMin(a.time),
                              e: timeToMin(a.time) + (a.duration_minutes || 30),
                              isCurrent: editingApt && a.id === editingApt.id,
                              clientName: a.client_name,
                              type: 'staff',
                            }));

                          const clientBusyRanges = selectedClient ? modalDayApts
                            .filter(a => a.client_id === selectedClient.id && a.staff_id !== selStaffId && a.status !== 'cancelled')
                            .map(a => ({
                              s: timeToMin(a.time),
                              e: timeToMin(a.time) + (a.duration_minutes || 30),
                              clientName: `${selectedClient.name} (con ${a.staff_name || 'otro'})`,
                              type: 'client',
                            })) : [];

                          const allBusyRanges = [...busyRanges, ...clientBusyRanges];

                          const allSlots = [];
                          for (let m = HOURS_START * 60; m < HOURS_END * 60; m += 15) {
                            const staffOverlap = busyRanges.find(r => m >= r.s && m < r.e);
                            const clientOverlap = clientBusyRanges.find(r => m >= r.s && m < r.e);
                            const isAvailable = slots.includes(m) && !clientOverlap;
                            const isCurrent = staffOverlap?.isCurrent || false;
                            if (isAvailable || isCurrent) {
                              allSlots.push({ m, isAvailable: true, isBusy: false, isCurrent, isClientBusy: false, busyClient: null });
                            }
                          }
                          const availCount = allSlots.length;

                          return (
                            <div className={`${b}__slots`}>
                              <span className={`${b}__slots-label`}>
                                Horarios disponibles — {selStaff?.name}
                                <span className={`${b}__slots-count`}> ({availCount} disponibles)</span>
                              </span>
                              {allSlots.length > 0 ? (
                                <div className={`${b}__slots-grid`}>
                                  {allSlots.map(({ m, isAvailable, isBusy, isCurrent, isClientBusy, busyClient }) => {
                                    const t = minToTime(m);
                                    const isSelected = assignment.time === t;
                                    const canClick = isAvailable || isCurrent;
                                    return (
                                      <button key={m} type="button"
                                        className={[
                                          `${b}__slot-btn`,
                                          isSelected ? `${b}__slot-btn--on` : '',
                                          isBusy ? `${b}__slot-btn--busy` : '',
                                          isClientBusy ? `${b}__slot-btn--client-busy` : '',
                                          isCurrent ? `${b}__slot-btn--current` : '',
                                          !canClick && !isBusy && !isClientBusy ? `${b}__slot-btn--blocked` : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => { if (canClick) updateAssignment(aIdx, { time: t }); }}
                                        disabled={!canClick}
                                        title={isClientBusy ? `Cliente ocupado: ${busyClient || ''}` : isBusy ? `Staff ocupado: ${busyClient || ''}` : isCurrent ? 'Horario actual' : !canClick ? 'No disponible' : formatTime12(t)}>
                                        {formatTime12(t)}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className={`${b}__slots-empty`}>Sin horarios disponibles para este dia.</p>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <p className={`${b}__slots-empty`}>Ningun profesional realiza este servicio.</p>
                    )}
                  </div>
                );
              })}

              {editingApt && (
                <div className={`${b}__section`}>
                  <span className={`${b}__section-label`}>Estado</span>
                  <div className={`${b}__status-row`}>
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <button key={k} type="button"
                        className={`${b}__status-btn ${formData.status === k ? `${b}__status-btn--on` : ''}`}
                        style={{ '--stc': v.color }}
                        onClick={() => setFormData({ ...formData, status: k })}>
                        <span className={`${b}__status-dot`} style={{ background: v.color }} />
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={`${b}__section ${b}__code-notes-row`}>
                <div className={`${b}__code-field`}>
                  <span className={`${b}__section-label`}>Codigo de visita *</span>
                  <input type="text" value={formData.visit_code || ''} onChange={e => setFormData({ ...formData, visit_code: e.target.value })}
                    placeholder="Ej: M20202" className={`${b}__code-input`} />
                </div>
                <div className={`${b}__notes-field`}>
                  <span className={`${b}__section-label`}>Notas (opcional)</span>
                  <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Preferencias, indicaciones especiales..." rows={2} className={`${b}__notes-input`} />
                </div>
              </div>

              {(() => {
                const missingClient = !selectedClient && !isNewClient;
                const missingService = !serviceAssignments.length;
                const missingStaffOrTime = serviceAssignments.some(a => !a.staffId || !a.time);
                const canSubmit = !submitting && !missingClient && !missingService && !missingStaffOrTime;
                const hint = missingClient ? 'Selecciona un cliente' : missingService ? 'Agrega un servicio' : missingStaffOrTime ? 'Selecciona profesional y horario' : null;
                return (
                  <div className={`${b}__modal-foot`}>
                    {editingApt && (
                      <>
                        <button type="button" className={`${b}__btn--danger`} onClick={handleDelete}><TrashIcon /> Eliminar</button>
                        {editingApt.status === 'confirmed' || editingApt.status === 'completed' ? (
                          <button type="button" className={`${b}__btn--primary`} style={{ background: '#059669' }} onClick={async () => {
                            setShowModal(false);
                            try {
                              const fresh = await appointmentService.get(editingApt.id);
                              setCheckoutApt(fresh);
                            } catch {
                              setCheckoutApt({ ...editingApt, notes: serializeProducts(productItems, formData.notes) });
                            }
                          }}>
                            Cobrar
                          </button>
                        ) : null}
                      </>
                    )}
                    <div className={`${b}__modal-foot-right`}>
                      {hint && <span className={`${b}__foot-hint`}>{hint}</span>}
                      <button type="button" className={`${b}__btn--ghost`} onClick={() => setShowModal(false)}>Cancelar</button>
                      <button type="submit" className={`${b}__btn--primary`} disabled={!canSubmit}>
                        {submitting ? 'Guardando...' : editingApt ? 'Guardar cambios' : serviceAssignments.length > 1 ? `Crear ${serviceAssignments.length} citas` : 'Crear cita'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </form>
          </div>
        </div>,
        document.body
      )}

      {staffCompleteApt && isStaffMode && createPortal(
        <div className={`${b}__overlay`} onClick={() => setStaffCompleteApt(null)}>
          <div className={`${b}__staff-complete`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__staff-complete-header`}>
              <h3>Completar cita</h3>
              <button className={`${b}__modal-x`} onClick={() => setStaffCompleteApt(null)}><CloseIcon /></button>
            </div>
            <div className={`${b}__staff-complete-body`}>
              <div className={`${b}__staff-complete-info`}>
                <div className={`${b}__staff-complete-row`}>
                  <span className={`${b}__staff-complete-label`}>Cliente</span>
                  <span className={`${b}__staff-complete-value`}>{staffCompleteApt.client_name}</span>
                </div>
                <div className={`${b}__staff-complete-row`}>
                  <span className={`${b}__staff-complete-label`}>Servicio</span>
                  <span className={`${b}__staff-complete-value`}>{staffCompleteApt.service_name || 'Servicio'}</span>
                </div>
                <div className={`${b}__staff-complete-row`}>
                  <span className={`${b}__staff-complete-label`}>Hora</span>
                  <span className={`${b}__staff-complete-value`}>{formatTime12(staffCompleteApt.time)}</span>
                </div>
                <div className={`${b}__staff-complete-row`}>
                  <span className={`${b}__staff-complete-label`}>Precio</span>
                  <span className={`${b}__staff-complete-value`}>{formatCOP(staffCompleteApt.price)}</span>
                </div>
              </div>
              <div className={`${b}__staff-complete-field`}>
                <label>Codigo de referencia *</label>
                <input
                  type="text"
                  value={staffPaymentCode}
                  onChange={e => setStaffPaymentCode(e.target.value.toUpperCase())}
                  placeholder="Ej: M1010"
                  autoFocus
                />
              </div>
            </div>
            <div className={`${b}__staff-complete-foot`}>
              <button className={`${b}__btn--ghost`} onClick={() => setStaffCompleteApt(null)}>Cancelar</button>
              <button
                className={`${b}__btn--primary`}
                disabled={staffCompleting || !staffPaymentCode.trim()}
                onClick={async () => {
                  setStaffCompleting(true);
                  try {
                    const { default: staffMeService } = await import('../../services/staffMeService');
                    await staffMeService.completeAppointment(staffCompleteApt.id, staffPaymentCode.trim());
                    addNotification(`Cita completada — ${staffCompleteApt.client_name} [${staffPaymentCode.trim()}]`, 'success');
                    setStaffCompleteApt(null);
                    setStaffPaymentCode('');
                    loadData();
                  } catch (err) {
                    addNotification(err.message, 'error');
                  } finally {
                    setStaffCompleting(false);
                  }
                }}
              >
                {staffCompleting ? 'Completando...' : 'Completar cita'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {checkoutApt && (
        <CheckoutModal
          appointment={checkoutApt}
          onClose={() => setCheckoutApt(null)}
          onCompleted={() => {
            setCheckoutApt(null);
            loadData();
            addNotification('Cobro realizado exitosamente', 'success');
          }}
        />
      )}
    </div>
  );
};

const Agenda = ({ staffOnlyId = null } = {}) => <AgendaErrorBoundary><AgendaInner staffOnlyId={staffOnlyId} /></AgendaErrorBoundary>;
export default Agenda;
