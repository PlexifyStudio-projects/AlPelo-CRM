import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import appointmentService from '../../services/appointmentService';
import staffService from '../../services/staffService';
import servicesService from '../../services/servicesService';
import clientService from '../../services/clientService';
import { useNotification } from '../../context/NotificationContext';
import CheckoutModal from '../../components/common/CheckoutModal/CheckoutModal';

const b = 'agenda';

// ─── Constants ───────────────────────────────────────
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const HOURS_START = 7;
const HOURS_END = 21;
const TOTAL_HOURS = HOURS_END - HOURS_START;
const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => HOURS_START + i);
const SLOT_MIN = 15; // each slot = 15 minutes
const SLOTS_PER_HOUR = 60 / SLOT_MIN;
const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR;
const CARD_H = 30; // px per event card (including gap)
const STAFF_COLORS = ['#2D5A3D', '#3B82F6', '#E05292', '#C9A84C', '#8B5CF6', '#F97316', '#14B8A6', '#EC4899', '#06B6D4', '#EF4444'];

const STATUS_META = {
  confirmed: { label: 'Confirmada', color: '#2D5A3D', icon: 'check' },
  completed: { label: 'Completada', color: '#22B07E', icon: 'done' },
  paid: { label: 'Pagada', color: '#3B82F6', icon: 'done' },
  cancelled: { label: 'Cancelada', color: '#E05252', icon: 'x' },
  no_show: { label: 'No asistió', color: '#D4A017', icon: 'alert' },
};

// ─── Helpers ─────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
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

// ─── Slot index: which 15-min slot does this time fall in? ──
const getSlotIndex = (time) => {
  const m = timeToMin(time);
  return Math.max(0, Math.min(Math.floor((m - HOURS_START * 60) / SLOT_MIN), TOTAL_SLOTS - 1));
};

// ─── Icons ───────────────────────────────────────────
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

// ─── Error boundary wrapper ──────────────────────────
class AgendaErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Agenda crash:', error, info); }
  render() {
    if (this.state.error) return <div style={{ padding: 40, color: 'red' }}><h2>Error en Agenda</h2><pre>{this.state.error.message}{'\n'}{this.state.error.stack}</pre></div>;
    return this.props.children;
  }
}

// ═════════════════════════════════════════════════════
const AgendaInner = ({ staffOnlyId = null }) => {
  const isStaffMode = !!staffOnlyId;
  // ── Calendar states ──
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffFilter, setStaffFilter] = useState(staffOnlyId ? String(staffOnlyId) : '');
  const [showStaffDrop, setShowStaffDrop] = useState(false);
  const staffDropRef = useRef(null);

  // ── Modal states ──
  const [showModal, setShowModal] = useState(false);
  const [editingApt, setEditingApt] = useState(null);
  const [formData, setFormData] = useState({ date: toISO(new Date()), notes: '', status: 'confirmed' });
  const [submitting, setSubmitting] = useState(false);

  // ── Modal: client ──
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [searchingClients, setSearchingClients] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // ── Modal: services + per-service assignments ──
  const [serviceAssignments, setServiceAssignments] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [modalDayApts, setModalDayApts] = useState([]);

  const { addNotification } = useNotification();
  const scrollRef = useRef(null);

  // ── Staff completion modal ──
  const [staffCompleteApt, setStaffCompleteApt] = useState(null);
  const [checkoutApt, setCheckoutApt] = useState(null);
  const [staffPaymentCode, setStaffPaymentCode] = useState('');
  const [staffCompleting, setStaffCompleting] = useState(false);

  // ─── Calendar derived ──────────────────────────────
  const weekDays = useMemo(() => getWeekDays(getMonday(currentDate)), [currentDate]);
  const columns = view === 'week' ? weekDays : [currentDate];
  const baseSlotH = view === 'week' ? 18 : 24; // base height per 15-min slot
  const gridCols = view === 'week' ? '56px repeat(7, 1fr)' : '56px 1fr';

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

  // ─── Modal derived ─────────────────────────────────
  const selectedServiceIds = serviceAssignments.map(a => a.serviceId);

  const totalDuration = useMemo(() =>
    serviceAssignments.reduce((sum, a) => sum + (serviceMap[a.serviceId]?.duration_minutes || 0), 0),
    [serviceAssignments, serviceMap]
  );

  const totalPrice = useMemo(() =>
    serviceAssignments.reduce((sum, a) => sum + (serviceMap[a.serviceId]?.price || 0), 0),
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

  // Quick date buttons (next 7 days)
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

  // ─── Load data ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const monday = getMonday(currentDate);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const [aptList, staffList, svcList] = await Promise.all([
        appointmentService.list({ date_from: toISO(monday), date_to: toISO(sunday) }),
        staffService.list(),
        servicesService.list(),
      ]);
      setAppointments(aptList);
      setStaff(staffList.filter(s => s.is_active !== false));
      setServices(svcList.filter(s => s.is_active));
    } catch (err) {
      addNotification('Error al cargar agenda: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentDate, addNotification]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Close staff dropdown on outside click ────────
  useEffect(() => {
    if (!showStaffDrop) return;
    const handler = (e) => {
      // Check if click is inside the trigger button or the portal menu
      if (staffDropRef.current && staffDropRef.current.contains(e.target)) return;
      if (e.target.closest(`.${b}__staff-drop-menu`)) return;
      setShowStaffDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStaffDrop]);

  // ─── Client search (debounced) ─────────────────────
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

  // ─── Load appointments for modal date ──────────────
  useEffect(() => {
    if (!showModal || !formData.date) return;
    // Immediately use locally-loaded appointments (no blank flash)
    const local = appointments.filter(a => a.date === formData.date && a.status !== 'cancelled');
    setModalDayApts(local);
    // Then refresh from API for any changes by other users / Lina
    const load = async () => {
      try {
        const apts = await appointmentService.list({ date_from: formData.date, date_to: formData.date });
        setModalDayApts(apts.filter(a => a.status !== 'cancelled'));
      } catch { /* keep local data */ }
    };
    load();
  }, [showModal, formData.date, appointments]);

  // ─── Per-service availability computation ──────────
  const computeSlots = useCallback((staffId, serviceId, assignmentIndex) => {
    const svc = serviceMap[serviceId];
    const dur = svc?.duration_minutes || 30;

    const busy = modalDayApts
      .filter(a => a.staff_id === staffId && (!editingApt || a.id !== editingApt.id))
      .map(a => ({ s: timeToMin(a.time), e: timeToMin(a.time) + (a.duration_minutes || 30) }));

    // Block times from OTHER assignments using same staff
    serviceAssignments.forEach((other, j) => {
      if (j === assignmentIndex || !other.staffId || !other.time) return;
      if (parseInt(other.staffId) !== staffId) return;
      const otherSvc = serviceMap[other.serviceId];
      busy.push({ s: timeToMin(other.time), e: timeToMin(other.time) + (otherSvc?.duration_minutes || 30) });
    });

    const now = new Date();
    const isTodayDate = formData.date === toISO(now);
    const nowMin = isTodayDate ? now.getHours() * 60 + now.getMinutes() : 0;

    // When editing, always include the original appointment time so user can save without changes
    const editOriginalMin = editingApt ? timeToMin(editingApt.time) : null;

    const slots = [];
    for (let m = HOURS_START * 60; m < HOURS_END * 60; m += 15) {
      // Allow past times only for the editing appointment's original time
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

  // ─── Calendar filtered & laid out ──────────────────
  const filtered = useMemo(() => {
    let list = [...appointments];
    const activeFilter = isStaffMode ? String(staffOnlyId) : staffFilter;
    if (activeFilter) list = list.filter(a => a.staff_id === parseInt(activeFilter));
    return list;
  }, [appointments, staffFilter, isStaffMode, staffOnlyId]);

  // ─── Per-column appointments ─────────────────────
  const colApts = useMemo(() => {
    return columns.map(day => {
      const dayStr = toISO(day);
      return filtered.filter(a => a.date === dayStr).sort((x, y) => x.time.localeCompare(y.time));
    });
  }, [columns, filtered]);

  // ─── Slot-based layout (15-min slots, each grows to fit) ──
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

  // Hour boundary positions (for labels & grid lines)
  const hourTop = (h) => slotTops[(h - HOURS_START) * SLOTS_PER_HOUR];
  const hourHeight = (h) => {
    const si = (h - HOURS_START) * SLOTS_PER_HOUR;
    return slotTops[si + SLOTS_PER_HOUR] - slotTops[si];
  };

  // Minute to px (for now-line)
  const minToPx = (m) => {
    const si = Math.max(0, Math.min(Math.floor((m - HOURS_START * 60) / SLOT_MIN), TOTAL_SLOTS - 1));
    const slotStart = HOURS_START * 60 + si * SLOT_MIN;
    const frac = (m - slotStart) / SLOT_MIN;
    return slotTops[si] + frac * slotHeights[si];
  };

  // ─── Scroll to current time on load ────────────────
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const now = new Date();
      const targetHour = isToday(currentDate) ? Math.max(now.getHours() - 1, HOURS_START) : 9;
      scrollRef.current.scrollTop = hourTop(targetHour);
    }
  }, [loading, view, currentDate, slotTops]);

  // ─── Stats ─────────────────────────────────────────
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

  // ─── Navigation ────────────────────────────────────
  const navLabel = useMemo(() => {
    if (view === 'day') {
      const d = currentDate;
      return `${DAYS_FULL[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
    }
    const s = weekDays[0], e = weekDays[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} — ${e.getDate()} de ${MONTHS[s.getMonth()]}`;
    }
    return `${s.getDate()} ${MONTHS[s.getMonth()].substring(0, 3)} — ${e.getDate()} ${MONTHS[e.getMonth()].substring(0, 3)}`;
  }, [view, currentDate, weekDays]);

  const navYear = useMemo(() => {
    return view === 'day' ? currentDate.getFullYear() : weekDays[0].getFullYear();
  }, [view, currentDate, weekDays]);

  const navigate = (dir) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (view === 'week' ? dir * 7 : dir));
      return d;
    });
  };

  const goToday = () => setCurrentDate(new Date());
  const switchToDay = (date) => { setCurrentDate(date); setView('day'); };

  // ─── Column appointment counts ─────────────────────
  const colCounts = useMemo(() => {
    return colApts.map(apts => apts.length);
  }, [colApts]);

  // ─── Total appointments this week ──────────────────
  const weekTotal = useMemo(() => {
    return filtered.length;
  }, [filtered]);

  // ─── Modal open/close ──────────────────────────────
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
  };

  const openCreate = (date, time) => {
    setEditingApt(null);
    resetModal();
    setFormData({ date: date ? toISO(date) : toISO(currentDate), notes: '', status: 'confirmed' });
    setShowModal(true);
  };

  const openEdit = (apt) => {
    setEditingApt(apt);
    resetModal();
    setSelectedClient({ id: apt.client_id, name: apt.client_name, phone: apt.client_phone });
    setServiceAssignments([{ serviceId: apt.service_id, staffId: String(apt.staff_id), time: apt.time }]);
    setFormData({ date: apt.date, notes: apt.notes || '', status: apt.status });
    setShowModal(true);
  };

  const handleDateChange = (newDate) => {
    setFormData(prev => ({ ...prev, date: newDate }));
    setServiceAssignments(prev => prev.map(a => ({ ...a, time: '' })));
  };

  // ─── Submit ────────────────────────────────────────
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
        // Only send fields that changed to avoid Pydantic coercion issues
        const updateData = {};
        if (clientName !== editingApt.client_name) updateData.client_name = clientName;
        if (clientPhone !== editingApt.client_phone) updateData.client_phone = clientPhone;
        if ((clientId || null) !== (editingApt.client_id || null)) updateData.client_id = clientId || null;
        if (parseInt(first.staffId) !== editingApt.staff_id) updateData.staff_id = parseInt(first.staffId);
        if (first.serviceId !== editingApt.service_id) updateData.service_id = first.serviceId;
        if (formData.date !== editingApt.date) updateData.date = formData.date;
        if (first.time !== editingApt.time) updateData.time = first.time;
        if ((formData.notes || null) !== (editingApt.notes || null)) updateData.notes = formData.notes || null;
        if (formData.status !== editingApt.status) updateData.status = formData.status;
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
          await appointmentService.create({
            client_name: clientName, client_phone: clientPhone, client_id: clientId || null,
            staff_id: parseInt(a.staffId), service_id: a.serviceId,
            date: formData.date, time: a.time,
            notes: formData.notes || null, status: formData.status, created_by: 'admin',
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

  // ─── Now line ──────────────────────────────────────
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = nowMin >= HOURS_START * 60 && nowMin < HOURS_END * 60;
  const nowTop = minToPx(nowMin);

  // ─── Loading state ─────────────────────────────────
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

  // ═══════════════════════════════════════════════════
  return (
    <div className={b}>

      {/* ── TOPBAR ── */}
      <div className={`${b}__topbar`}>
        <div className={`${b}__topbar-left`}>
          <h1 className={`${b}__title`}>Agenda</h1>
          <span className={`${b}__subtitle`}>{navYear} &middot; {weekTotal} cita{weekTotal !== 1 ? 's' : ''} esta semana</span>
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

      {/* ── OVERVIEW BAR ── */}
      <div className={`${b}__overview`}>
        <div className={`${b}__ov-stats`}>
          <div className={`${b}__ov-stat`}>
            <div className={`${b}__ov-stat-icon ${b}__ov-stat-icon--primary`}><CalendarIcon /></div>
            <div className={`${b}__ov-stat-content`}>
              <span className={`${b}__ov-num`}>{stats.total}</span>
              <span className={`${b}__ov-label`}>Citas hoy</span>
            </div>
          </div>
          <div className={`${b}__ov-divider`} />
          <div className={`${b}__ov-stat`}>
            <div className={`${b}__ov-stat-icon ${b}__ov-stat-icon--accent`}><DollarIcon /></div>
            <div className={`${b}__ov-stat-content`}>
              <span className={`${b}__ov-num`}>{formatCOP(stats.revenue)}</span>
              <span className={`${b}__ov-label`}>Ingresos</span>
            </div>
          </div>
          <div className={`${b}__ov-divider`} />
          <div className={`${b}__ov-stat`}>
            <div className={`${b}__ov-stat-icon ${b}__ov-stat-icon--success`}><CheckCircleIcon /></div>
            <div className={`${b}__ov-stat-content`}>
              <span className={`${b}__ov-num`}>{stats.completed}</span>
              <span className={`${b}__ov-label`}>Completadas</span>
            </div>
          </div>
          <div className={`${b}__ov-divider`} />
          <div className={`${b}__ov-stat`}>
            <div className={`${b}__ov-stat-icon ${b}__ov-stat-icon--warning`}><AlertIcon /></div>
            <div className={`${b}__ov-stat-content`}>
              <span className={`${b}__ov-num`}>{stats.pending}</span>
              <span className={`${b}__ov-label`}>Pendientes</span>
            </div>
          </div>
        </div>

        <div className={`${b}__ov-right`}>
          {/* Staff color legend — hidden in staff mode */}
          {!isStaffMode && staff.length > 0 && (
            <div className={`${b}__staff-legend`}>
              {staff.slice(0, 5).map((s, i) => (
                <div key={s.id} className={`${b}__staff-dot`} title={s.name}>
                  <span className={`${b}__staff-dot-circle`} style={{ background: staffColorMap[s.id] || STAFF_COLORS[i % STAFF_COLORS.length] }} />
                  <span className={`${b}__staff-dot-name`}>{s.name.split(' ')[0]}</span>
                </div>
              ))}
              {staff.length > 5 && <span className={`${b}__staff-dot-more`}>+{staff.length - 5}</span>}
            </div>
          )}
          <div className={`${b}__staff-drop`} ref={staffDropRef} style={isStaffMode ? { display: 'none' } : undefined}>
            <button type="button" className={`${b}__staff-drop-btn`} onClick={() => setShowStaffDrop(p => !p)}>
              {staffFilter ? (
                <>
                  <span className={`${b}__staff-drop-dot`} style={{ background: staffColorMap[parseInt(staffFilter)] || '#6B6B63' }} />
                  <span className={`${b}__staff-drop-text`}>{staff.find(s => s.id === parseInt(staffFilter))?.name || 'Todos'}</span>
                </>
              ) : (
                <span className={`${b}__staff-drop-text`}>Todos los profesionales</span>
              )}
              <ChevronDown />
            </button>
            {showStaffDrop && createPortal(
              <div className={`${b}__staff-drop-menu`}
                ref={el => {
                  if (el && staffDropRef.current) {
                    const rect = staffDropRef.current.getBoundingClientRect();
                    el.style.position = 'fixed';
                    el.style.top = `${rect.bottom + 6}px`;
                    el.style.right = `${window.innerWidth - rect.right}px`;
                    el.style.zIndex = '9999';
                  }
                }}>
                <button type="button" className={`${b}__staff-drop-item ${!staffFilter ? `${b}__staff-drop-item--on` : ''}`}
                  onClick={() => { setStaffFilter(''); setShowStaffDrop(false); }}>
                  <span className={`${b}__staff-drop-item-name`}>Todos los profesionales</span>
                </button>
                {staff.map((s, i) => (
                  <button key={s.id} type="button"
                    className={`${b}__staff-drop-item ${staffFilter === String(s.id) ? `${b}__staff-drop-item--on` : ''}`}
                    onClick={() => { setStaffFilter(String(s.id)); setShowStaffDrop(false); }}>
                    <span className={`${b}__staff-drop-item-dot`} style={{ background: staffColorMap[s.id] || STAFF_COLORS[i % STAFF_COLORS.length] }} />
                    <span className={`${b}__staff-drop-item-name`}>{s.name}</span>
                    {staffFilter === String(s.id) && <span className={`${b}__staff-drop-item-check`}>✓</span>}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* ── CALENDAR ── */}
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
                  {count > 0 && (
                    <span className={`${b}__col-badge`}>{count}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className={`${b}__cal-grid`} style={{ gridTemplateColumns: gridCols }}>
            {/* ── Time column ── */}
            <div className={`${b}__time-col`} style={{ height: `${totalH}px` }}>
              {HOURS.map(h => (
                <div key={h} className={`${b}__time-cell`} style={{ top: `${hourTop(h)}px`, height: `${hourHeight(h)}px` }}>
                  <span className={`${b}__time-text`}>{formatHourLabel(h)}</span>
                </div>
              ))}
            </div>

            {/* ── Day columns ── */}
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
                  {/* Hour grid lines */}
                  {HOURS.map(h => (
                    <div key={`hl-${h}`} className={`${b}__hour-line`} style={{ top: `${hourTop(h)}px` }} />
                  ))}
                  {/* Half-hour grid lines */}
                  {HOURS.map(h => {
                    const si = (h - HOURS_START) * SLOTS_PER_HOUR + 2;
                    return <div key={`hh-${h}`} className={`${b}__half-line`} style={{ top: `${slotTops[si]}px` }} />;
                  })}

                  {/* Empty state for the column */}
                  {apts.length === 0 && today && (
                    <div className={`${b}__empty-col`}>
                      <EmptyCalIcon />
                      <span>Sin citas</span>
                    </div>
                  )}

                  {/* Event stacks per slot */}
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
                            className={`${b}__event ${(apt.status === 'completed' || apt.status === 'paid') ? (isStaffMode ? `${b}__event--done-staff` : `${b}__event--done`) : ''} ${apt.status === 'cancelled' ? `${b}__event--cancel` : ''}`}
                            style={{ '--c': staffColor, '--sc': statusColor, animationDelay: `${evIdx * 30}ms` }}
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
                  {/* Now line */}
                  {today && showNow && (
                    <div className={`${b}__now`} style={{ top: `${nowTop}px` }}>
                      <div className={`${b}__now-dot`} />
                      <div className={`${b}__now-line`} />
                    </div>
                  )}
                  {/* Clickable slots (30-min each) — hidden for staff */}
                  {!isStaffMode && HOURS.map(h => [
                    <div key={`a${h}`} className={`${b}__slot`}
                      style={{ top: `${hourTop(h)}px`, height: `${slotTops[(h - HOURS_START) * SLOTS_PER_HOUR + 2] - hourTop(h)}px` }}
                      onClick={() => openCreate(day, `${pad2(h)}:00`)} />,
                    <div key={`b${h}`} className={`${b}__slot`}
                      style={{ top: `${slotTops[(h - HOURS_START) * SLOTS_PER_HOUR + 2]}px`, height: `${hourTop(h) + hourHeight(h) - slotTops[(h - HOURS_START) * SLOTS_PER_HOUR + 2]}px` }}
                      onClick={() => openCreate(day, `${pad2(h)}:30`)} />,
                  ])}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MODAL — Appointment Create / Edit
         ══════════════════════════════════════════════ */}
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
              <button className={`${b}__modal-x`} onClick={() => setShowModal(false)}><CloseIcon /></button>
            </div>

            <form onSubmit={handleSubmit} className={`${b}__modal-body`}>

              {/* ── CLIENT ── */}
              <div className={`${b}__section`}>
                <span className={`${b}__section-label`}>Cliente</span>
                {selectedClient && !isNewClient ? (
                  <div className={`${b}__client-chip`}>
                    <div className={`${b}__client-avatar`}>
                      {selectedClient.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className={`${b}__client-chip-info`}>
                      <span className={`${b}__client-chip-name`}>{selectedClient.name}</span>
                      <span className={`${b}__client-chip-phone`}>{selectedClient.phone}</span>
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
                              <span className={`${b}__search-item-phone`}>{c.phone}</span>
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

              {/* ── SERVICES (multi) ── */}
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
                            <span className={`${b}__svc-chip-meta`}>{svc.category} &middot; {formatDur(svc.duration_minutes)} &middot; {formatCOP(svc.price)}</span>
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
                                    setServiceAssignments(prev => [...prev, { serviceId: s.id, staffId: '', time: '' }]);
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

              {/* ── DATE (quick-pick + input) ── */}
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

              {/* ── PER-SERVICE AVAILABILITY ── */}
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
                                  if (active) return; // don't clear time if same staff
                                  // Try to keep current time if available for new staff
                                  const keepTime = assignment.time && s.availableSlots.includes(timeToMin(assignment.time)) ? assignment.time : '';
                                  updateAssignment(aIdx, { staffId: String(s.id), time: keepTime });
                                }}
                                disabled={freeSlots === 0}>
                                <span className={`${b}__avail-avatar`} style={{ background: color }}>
                                  {s.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
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

                          // Compute ALL busy ranges for this staff (including current apt) for visual display
                          const busyRanges = modalDayApts
                            .filter(a => a.staff_id === selStaffId && a.status !== 'cancelled')
                            .map(a => ({
                              s: timeToMin(a.time),
                              e: timeToMin(a.time) + (a.duration_minutes || 30),
                              isCurrent: editingApt && a.id === editingApt.id,
                              clientName: a.client_name,
                              type: 'staff',
                            }));

                          // Client busy ranges — show when the SELECTED CLIENT has appointments with OTHER staff
                          const clientBusyRanges = selectedClient ? modalDayApts
                            .filter(a => a.client_id === selectedClient.id && a.staff_id !== selStaffId && a.status !== 'cancelled')
                            .map(a => ({
                              s: timeToMin(a.time),
                              e: timeToMin(a.time) + (a.duration_minutes || 30),
                              clientName: `${selectedClient.name} (con ${a.staff_name || 'otro'})`,
                              type: 'client',
                            })) : [];

                          const allBusyRanges = [...busyRanges, ...clientBusyRanges];

                          // Generate ALL time slots for display (available + busy)
                          const allSlots = [];
                          for (let m = HOURS_START * 60; m < HOURS_END * 60; m += 15) {
                            const staffOverlap = busyRanges.find(r => m >= r.s && m < r.e);
                            const clientOverlap = clientBusyRanges.find(r => m >= r.s && m < r.e);
                            const visualOverlap = staffOverlap || clientOverlap;
                            const isAvailable = slots.includes(m) && !clientOverlap;
                            const isCurrent = staffOverlap?.isCurrent || false;
                            const isBusy = !!staffOverlap && !isCurrent;
                            const isClientBusy = !!clientOverlap;
                            allSlots.push({ m, isAvailable, isBusy, isCurrent, isClientBusy, busyClient: visualOverlap?.clientName });
                          }
                          const availCount = allSlots.filter(s => s.isAvailable || s.isCurrent).length;
                          const busyCount = allSlots.filter(s => s.isBusy).length;

                          return (
                            <div className={`${b}__slots`}>
                              <span className={`${b}__slots-label`}>
                                Horarios — {selStaff?.name}
                                {busyCount > 0 && <span className={`${b}__slots-count`}> ({availCount} libres, {busyCount} ocupados)</span>}
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

              {/* ── STATUS (edit) ── */}
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

              {/* ── NOTES ── */}
              <div className={`${b}__section`}>
                <span className={`${b}__section-label`}>Notas (opcional)</span>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Preferencias, indicaciones especiales..." rows={2} />
              </div>

              {/* ── FOOTER ── */}
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
                          <button type="button" className={`${b}__btn--primary`} style={{ background: '#059669' }} onClick={() => { setShowModal(false); setCheckoutApt(editingApt); }}>
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

      {/* ── STAFF COMPLETION MODAL ── */}
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
      {/* ── CHECKOUT MODAL ── */}
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
