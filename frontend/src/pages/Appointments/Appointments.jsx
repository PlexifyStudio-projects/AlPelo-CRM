import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Modal from '../../components/common/Modal/Modal';
import Button from '../../components/common/Button/Button';
import { mockAppointments, mockClients, mockBarbers, mockServices } from '../../data/mockData';
import { formatCurrency } from '../../utils/formatters';

// ============================================
// Helpers
// ============================================
const STORAGE_KEY = 'alpelo_appointments';
const FIXED_NOW = new Date(2026, 2, 2, 10, 0);

const loadAppointments = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : mockAppointments;
  } catch {
    return mockAppointments;
  }
};

const saveAppointments = (appointments) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
};

const getClient = (clientId) => mockClients.find((c) => c.id === clientId);
const getClientName = (clientId) => getClient(clientId)?.name || 'Cliente desconocido';
const getClientPhone = (clientId) => getClient(clientId)?.phone || '';

const getBarber = (barberId) => mockBarbers.find((b) => b.id === barberId);
const getBarberName = (barberId) => getBarber(barberId)?.name || 'Sin asignar';

const getServiceData = (serviceName) => {
  const service = mockServices.find((s) => s.name === serviceName);
  return service || { duration: 30, price: 0 };
};

const getInitials = (name) => {
  const parts = name.split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
};

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmada', color: 'success' },
  pending: { label: 'Pendiente', color: 'warning' },
  completed: { label: 'Completada', color: 'primary' },
  cancelled: { label: 'Cancelada', color: 'error' },
};

const STATUS_CYCLE = ['pending', 'confirmed', 'completed', 'cancelled'];

const formatDateDisplay = (dateStr) => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatDateFull = (dateStr) => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const formatMonthYear = (dateStr) => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
};

const formatWeekDayShort = (dateStr) => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-CO', { weekday: 'short' }).toUpperCase().replace('.', '');
};

const formatWeekDayNum = (dateStr) => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.getDate();
};

const getTodayStr = () => FIXED_NOW.toISOString().split('T')[0];

const getWeekDates = (baseDate) => {
  const base = baseDate ? new Date(baseDate + 'T12:00:00') : new Date(FIXED_NOW);
  const dayOfWeek = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
];

const getCurrentTimeSlot = () => {
  const h = FIXED_NOW.getHours();
  const m = FIXED_NOW.getMinutes();
  return `${String(h).padStart(2, '0')}:${m < 30 ? '00' : '30'}`;
};

const MONTH_DAY_NAMES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

// ============================================
// SVG Icons
// ============================================
const CalendarIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ClockIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const UserIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ScissorsIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const DollarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const CheckCircleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const LayersIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const StarIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const SunIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const GridIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const ListIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const CalendarGridIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

const FilterIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

// ============================================
// StatusIcon sub-component
// ============================================
const StatusIcon = ({ status, size = 12 }) => {
  switch (status) {
    case 'confirmed':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'pending':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'completed':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'cancelled':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    default:
      return null;
  }
};

// ============================================
// Appointments Page
// ============================================
const Appointments = () => {
  const [appointments, setAppointments] = useState(loadAppointments);
  const [view, setView] = useState('day');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [barberFilter, setBarberFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [showBarberDropdown, setShowBarberDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [statusMenu, setStatusMenu] = useState(null);
  const [currentTime] = useState(getCurrentTimeSlot());
  const barberDropdownRef = useRef(null);
  const serviceDropdownRef = useRef(null);

  // New appointment form
  const [formData, setFormData] = useState({
    clientId: '',
    barberId: '',
    serviceId: '',
    date: getTodayStr(),
    time: '10:00',
  });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Persist
  useEffect(() => {
    saveAppointments(appointments);
  }, [appointments]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (statusMenu !== null) setStatusMenu(null);
      if (showBarberDropdown && barberDropdownRef.current && !barberDropdownRef.current.contains(e.target)) {
        setShowBarberDropdown(false);
      }
      if (showServiceDropdown && serviceDropdownRef.current && !serviceDropdownRef.current.contains(e.target)) {
        setShowServiceDropdown(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [statusMenu, showBarberDropdown, showServiceDropdown]);

  // ---- Derived data ----
  const todayStr = getTodayStr();
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  const filteredAppointments = useMemo(() => {
    let result = appointments;
    if (view === 'day') {
      result = result.filter((a) => a.date === selectedDate);
    } else if (view === 'week') {
      result = result.filter((a) => weekDates.includes(a.date));
    } else {
      const d = new Date(selectedDate + 'T12:00:00');
      const year = d.getFullYear();
      const month = d.getMonth();
      result = result.filter((a) => {
        const ad = new Date(a.date + 'T12:00:00');
        return ad.getFullYear() === year && ad.getMonth() === month;
      });
    }
    if (barberFilter !== 'all') {
      result = result.filter((a) => a.barberId === Number(barberFilter));
    }
    if (serviceFilter !== 'all') {
      result = result.filter((a) => {
        const svc = mockServices.find((s) => s.name === a.service);
        return svc && svc.category === serviceFilter;
      });
    }
    return result.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  }, [appointments, view, barberFilter, serviceFilter, selectedDate, weekDates]);

  // ---- Stats for selected day ----
  const stats = useMemo(() => {
    const dayAppts = appointments.filter((a) => a.date === selectedDate);
    const confirmed = dayAppts.filter((a) => a.status === 'confirmed').length;
    const pending = dayAppts.filter((a) => a.status === 'pending').length;
    const completed = dayAppts.filter((a) => a.status === 'completed').length;
    const revenue = dayAppts.reduce((sum, a) => sum + getServiceData(a.service).price, 0);
    return { total: dayAppts.length, confirmed, pending, completed, revenue };
  }, [appointments, selectedDate]);

  // ---- Next appointment ID (for day view highlight) ----
  const nextApptId = useMemo(() => {
    if (view !== 'day' || selectedDate !== todayStr) return null;
    const upcoming = filteredAppointments.find((a) => a.time >= currentTime);
    return upcoming?.id || null;
  }, [filteredAppointments, view, selectedDate, todayStr, currentTime]);

  // ---- Month view data ----
  const monthData = useMemo(() => {
    if (view !== 'month') return [];
    const d = new Date(selectedDate + 'T12:00:00');
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const totalDays = lastDay.getDate();
    const weeks = [];
    let currentWeek = [];

    for (let i = 0; i < startOffset; i++) {
      currentWeek.push({ day: null, dateStr: null, appointments: [] });
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAppts = filteredAppointments.filter((a) => a.date === dateStr);
      currentWeek.push({ day, dateStr, appointments: dayAppts });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ day: null, dateStr: null, appointments: [] });
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [view, selectedDate, filteredAppointments]);

  // ---- Week view grouping ----
  const groupedByDate = useMemo(() => {
    if (view !== 'week') return {};
    const groups = {};
    weekDates.forEach((d) => { groups[d] = []; });
    filteredAppointments.forEach((a) => {
      if (groups[a.date]) groups[a.date].push(a);
    });
    return groups;
  }, [filteredAppointments, view, weekDates]);

  // ---- Actions ----
  const handleStatusChange = useCallback((appointmentId, newStatus) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a))
    );
    setStatusMenu(null);
  }, []);

  const handleCreateAppointment = useCallback(() => {
    if (!formData.clientId || !formData.barberId || !formData.serviceId) return;
    const service = mockServices.find((s) => s.id === Number(formData.serviceId));
    const newAppt = {
      id: Date.now(),
      clientId: Number(formData.clientId),
      barberId: Number(formData.barberId),
      service: service?.name || '',
      date: formData.date,
      time: formData.time,
      status: 'pending',
    };
    setAppointments((prev) => [...prev, newAppt]);
    setShowModal(false);
    setFormData({ clientId: '', barberId: '', serviceId: '', date: getTodayStr(), time: '10:00' });
    setClientSearch('');
  }, [formData]);

  const handleSelectClient = useCallback((client) => {
    setFormData((prev) => ({ ...prev, clientId: String(client.id) }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  }, []);

  const navigateDate = useCallback((direction) => {
    const d = new Date(selectedDate + 'T12:00:00');
    if (view === 'day') {
      d.setDate(d.getDate() + direction);
    } else if (view === 'week') {
      d.setDate(d.getDate() + direction * 7);
    } else {
      d.setMonth(d.getMonth() + direction);
    }
    setSelectedDate(d.toISOString().split('T')[0]);
  }, [selectedDate, view]);

  const goToToday = useCallback(() => {
    setSelectedDate(getTodayStr());
  }, []);

  // ---- Client search filtering ----
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return mockClients.slice(0, 8);
    const q = clientSearch.toLowerCase();
    return mockClients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 8);
  }, [clientSearch]);

  // ---- Unique barbers ----
  const activeBarbers = useMemo(() => {
    const barberIds = [...new Set(appointments.map((a) => a.barberId))];
    return mockBarbers.filter((b) => barberIds.includes(b.id));
  }, [appointments]);

  const selectedBarber = barberFilter !== 'all' ? getBarber(Number(barberFilter)) : null;

  // ---- Selected service info ----
  const selectedService = formData.serviceId
    ? mockServices.find((s) => s.id === Number(formData.serviceId))
    : null;

  // ---- Group services by category ----
  const servicesByCategory = useMemo(() => {
    const groups = {};
    mockServices.forEach((s) => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, []);

  const serviceCategories = useMemo(() => Object.keys(servicesByCategory), [servicesByCategory]);

  // ---- View toggle slider position ----
  const sliderTransform = view === 'day' ? 'translateX(0)' : view === 'week' ? 'translateX(100%)' : 'translateX(200%)';

  // ---- Date nav label ----
  const dateNavLabel = useMemo(() => {
    if (view === 'day') return formatDateDisplay(selectedDate);
    if (view === 'week') return `${formatDateDisplay(weekDates[0])} — ${formatDateDisplay(weekDates[6])}`;
    return formatMonthYear(selectedDate);
  }, [view, selectedDate, weekDates]);

  // ---- Status dropdown renderer ----
  const renderStatusDropdown = (apptId) => (
    <div className="appointments__status-dropdown" onClick={(e) => e.stopPropagation()}>
      <div className="appointments__status-dropdown-header">Cambiar estado</div>
      {STATUS_CYCLE.map((s) => (
        <button
          key={s}
          className={`appointments__status-option appointments__status-option--${s} ${s === appointments.find((a) => a.id === apptId)?.status ? 'appointments__status-option--current' : ''}`}
          onClick={() => handleStatusChange(apptId, s)}
        >
          <StatusIcon status={s} size={13} />
          <span>{STATUS_CONFIG[s].label}</span>
          {s === appointments.find((a) => a.id === apptId)?.status && <span className="appointments__status-check">&#10003;</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="appointments">
      {/* ===== HEADER ===== */}
      <header className="appointments__header">
        <div className="appointments__header-content">
          <div className="appointments__header-text">
            <h1 className="appointments__title">
              <CalendarIcon size={28} />
              <span>Agenda de Citas</span>
            </h1>
            <p className="appointments__subtitle">
              <SunIcon size={16} />
              <span className="appointments__today-date">{formatDateFull(todayStr)}</span>
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => setShowModal(true)} className="appointments__new-btn">
            <PlusIcon />
            Nueva Cita
          </Button>
        </div>
      </header>

      {/* ===== STATS PILLS ===== */}
      <div className="appointments__stats">
        <div className="appointments__stat-pill appointments__stat-pill--total">
          <div className="appointments__stat-pill-icon">
            <CalendarIcon size={20} />
          </div>
          <div className="appointments__stat-pill-data">
            <span className="appointments__stat-pill-number">{stats.total}</span>
            <span className="appointments__stat-pill-label">Citas Hoy</span>
          </div>
        </div>

        <div className="appointments__stat-pill appointments__stat-pill--confirmed">
          <div className="appointments__stat-pill-icon">
            <CheckCircleIcon size={20} />
          </div>
          <div className="appointments__stat-pill-data">
            <span className="appointments__stat-pill-number">{stats.confirmed}</span>
            <span className="appointments__stat-pill-label">Confirmadas</span>
          </div>
        </div>

        <div className="appointments__stat-pill appointments__stat-pill--pending">
          <div className="appointments__stat-pill-icon">
            <AlertCircleIcon size={20} />
          </div>
          <div className="appointments__stat-pill-data">
            <span className="appointments__stat-pill-number">{stats.pending}</span>
            <span className="appointments__stat-pill-label">Pendientes</span>
          </div>
        </div>

        <div className="appointments__stat-pill appointments__stat-pill--revenue">
          <div className="appointments__stat-pill-icon">
            <DollarIcon />
          </div>
          <div className="appointments__stat-pill-data">
            <span className="appointments__stat-pill-number">{formatCurrency(stats.revenue)}</span>
            <span className="appointments__stat-pill-label">Ingresos Est.</span>
          </div>
        </div>
      </div>

      {/* ===== TOOLBAR ===== */}
      <div className="appointments__toolbar">
        <div className="appointments__toolbar-left">
          {/* View Toggle — 3 buttons */}
          <div className="appointments__view-toggle">
            <div
              className="appointments__view-slider"
              style={{ transform: sliderTransform }}
            />
            <button
              className={`appointments__view-btn ${view === 'day' ? 'appointments__view-btn--active' : ''}`}
              onClick={() => setView('day')}
            >
              <ListIcon size={14} />
              <span>D&iacute;a</span>
            </button>
            <button
              className={`appointments__view-btn ${view === 'week' ? 'appointments__view-btn--active' : ''}`}
              onClick={() => setView('week')}
            >
              <GridIcon size={14} />
              <span>Semana</span>
            </button>
            <button
              className={`appointments__view-btn ${view === 'month' ? 'appointments__view-btn--active' : ''}`}
              onClick={() => setView('month')}
            >
              <CalendarGridIcon size={14} />
              <span>Mes</span>
            </button>
          </div>

          {/* Date Navigation */}
          <div className="appointments__date-nav">
            <button className="appointments__date-nav-btn" onClick={() => navigateDate(-1)}>
              <ChevronLeftIcon />
            </button>
            <button className="appointments__date-nav-today" onClick={goToToday}>
              Hoy
            </button>
            <button className="appointments__date-nav-btn" onClick={() => navigateDate(1)}>
              <ChevronRightIcon />
            </button>
            <span className="appointments__date-nav-label">{dateNavLabel}</span>
          </div>
        </div>

        <div className="appointments__toolbar-right">
          {/* Service Filter */}
          <div className="appointments__service-filter" ref={serviceDropdownRef}>
            <button
              className={`appointments__service-filter-trigger ${serviceFilter !== 'all' ? 'appointments__service-filter-trigger--active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowServiceDropdown(!showServiceDropdown);
              }}
            >
              <FilterIcon size={14} />
              <span>{serviceFilter === 'all' ? 'Servicios' : serviceFilter}</span>
              <ChevronDownIcon />
            </button>
            {showServiceDropdown && (
              <div className="appointments__service-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="appointments__service-dropdown-header">Filtrar por servicio</div>
                <button
                  className={`appointments__service-dropdown-item ${serviceFilter === 'all' ? 'appointments__service-dropdown-item--active' : ''}`}
                  onClick={() => { setServiceFilter('all'); setShowServiceDropdown(false); }}
                >
                  <LayersIcon size={14} />
                  <span>Todos los servicios</span>
                </button>
                {serviceCategories.map((cat) => (
                  <button
                    key={cat}
                    className={`appointments__service-dropdown-item ${serviceFilter === cat ? 'appointments__service-dropdown-item--active' : ''}`}
                    onClick={() => { setServiceFilter(cat); setShowServiceDropdown(false); }}
                  >
                    <ScissorsIcon size={13} />
                    <span>{cat}</span>
                    <span className="appointments__service-dropdown-count">
                      {servicesByCategory[cat].length}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Barber Filter */}
          <div className="appointments__barber-filter" ref={barberDropdownRef}>
            <button
              className="appointments__barber-filter-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setShowBarberDropdown(!showBarberDropdown);
              }}
            >
              <div className="appointments__barber-filter-avatar">
                {selectedBarber ? (
                  <span>{getInitials(selectedBarber.name)}</span>
                ) : (
                  <UserIcon size={14} />
                )}
              </div>
              <span className="appointments__barber-filter-text">
                {selectedBarber ? selectedBarber.name : 'Todos'}
              </span>
              <ChevronDownIcon />
            </button>
            {showBarberDropdown && (
              <div className="appointments__barber-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="appointments__barber-dropdown-header">Filtrar por profesional</div>
                <button
                  className={`appointments__barber-dropdown-item ${barberFilter === 'all' ? 'appointments__barber-dropdown-item--active' : ''}`}
                  onClick={() => { setBarberFilter('all'); setShowBarberDropdown(false); }}
                >
                  <div className="appointments__barber-dropdown-avatar">
                    <LayersIcon size={14} />
                  </div>
                  <div className="appointments__barber-dropdown-info">
                    <span className="appointments__barber-dropdown-name">Todos los profesionales</span>
                    <span className="appointments__barber-dropdown-meta">{appointments.filter(a => a.date === selectedDate).length} citas</span>
                  </div>
                </button>
                {activeBarbers.map((b) => {
                  const barberAppts = appointments.filter(a => a.barberId === b.id && a.date === selectedDate).length;
                  return (
                    <button
                      key={b.id}
                      className={`appointments__barber-dropdown-item ${barberFilter === String(b.id) ? 'appointments__barber-dropdown-item--active' : ''}`}
                      onClick={() => { setBarberFilter(String(b.id)); setShowBarberDropdown(false); }}
                    >
                      <div className="appointments__barber-dropdown-avatar">
                        <span>{getInitials(b.name)}</span>
                      </div>
                      <div className="appointments__barber-dropdown-info">
                        <span className="appointments__barber-dropdown-name">{b.name}</span>
                        <span className="appointments__barber-dropdown-meta">
                          {b.specialty} &middot; {barberAppts} cita{barberAppts !== 1 ? 's' : ''}
                          {b.rating && (
                            <>
                              {' '}&middot;{' '}
                              <StarIcon size={10} /> {b.rating}
                            </>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== DAY VIEW: Dense Rows ===== */}
      {view === 'day' && filteredAppointments.length > 0 && (
        <div className="appointments__day">
          <div className="appointments__day-header">
            <div className="appointments__day-header-left">
              <CalendarIcon size={16} />
              <span>Agenda &mdash; {formatDateDisplay(selectedDate)}</span>
            </div>
            <span className="appointments__day-count">
              {filteredAppointments.length} cita{filteredAppointments.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="appointments__day-body">
            {filteredAppointments.map((appt, index) => {
              const svc = getServiceData(appt.service);
              const clientName = getClientName(appt.clientId);
              const barberName = getBarberName(appt.barberId);
              const statusCfg = STATUS_CONFIG[appt.status];
              const isNext = appt.id === nextApptId;

              return (
                <div
                  key={appt.id}
                  className={`appointments__day-row ${isNext ? 'appointments__day-row--next' : ''}`}
                  style={{ animationDelay: `${0.03 * index}s` }}
                >
                  <span className="appointments__day-time">{appt.time}</span>
                  <div className={`appointments__day-avatar appointments__day-avatar--${appt.status}`}>
                    {getInitials(clientName)}
                  </div>
                  <div className="appointments__day-info">
                    <span className="appointments__day-name">{clientName}</span>
                    <span className="appointments__day-service">
                      {appt.service} &middot; {svc.duration} min
                    </span>
                  </div>
                  <span className="appointments__day-barber">{barberName}</span>
                  <span className="appointments__day-price">{formatCurrency(svc.price)}</span>
                  <div className="appointments__day-status-wrap">
                    <button
                      className={`appointments__day-status appointments__day-status--${appt.status}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusMenu(statusMenu === appt.id ? null : appt.id);
                      }}
                    >
                      <StatusIcon status={appt.status} size={11} />
                      <span>{statusCfg?.label}</span>
                    </button>
                    {statusMenu === appt.id && renderStatusDropdown(appt.id)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== WEEK VIEW ===== */}
      {view === 'week' && (
        <div className="appointments__week">
          {weekDates.map((dateStr, idx) => {
            const dayAppts = groupedByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            return (
              <div
                key={dateStr}
                className={`appointments__week-col ${isToday ? 'appointments__week-col--today' : ''} ${isSelected ? 'appointments__week-col--selected' : ''}`}
                style={{ animationDelay: `${0.04 * idx}s` }}
              >
                <button
                  className="appointments__week-col-header"
                  onClick={() => { setSelectedDate(dateStr); setView('day'); }}
                >
                  <span className="appointments__week-col-dayname">{formatWeekDayShort(dateStr)}</span>
                  <span className={`appointments__week-col-daynum ${isToday ? 'appointments__week-col-daynum--today' : ''}`}>
                    {formatWeekDayNum(dateStr)}
                  </span>
                  <span className="appointments__week-col-count">
                    {dayAppts.length} cita{dayAppts.length !== 1 ? 's' : ''}
                  </span>
                </button>
                <div className="appointments__week-col-body">
                  {dayAppts.length > 0 ? (
                    dayAppts.map((appt) => (
                      <div
                        key={appt.id}
                        className={`appointments__week-pill appointments__week-pill--${appt.status}`}
                        title={`${appt.time} - ${getClientName(appt.clientId)} - ${appt.service}`}
                      >
                        <span className="appointments__week-pill-time">{appt.time}</span>
                        <span className="appointments__week-pill-name">{getClientName(appt.clientId)}</span>
                        <span className="appointments__week-pill-service">{appt.service}</span>
                      </div>
                    ))
                  ) : (
                    <div className="appointments__week-empty">
                      <span>Sin citas</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== MONTH VIEW ===== */}
      {view === 'month' && (
        <div className="appointments__month">
          <div className="appointments__month-header">
            {MONTH_DAY_NAMES.map((name) => (
              <span key={name} className="appointments__month-dayname">{name}</span>
            ))}
          </div>
          <div className="appointments__month-grid">
            {monthData.map((week, wi) => (
              <div key={wi} className="appointments__month-week">
                {week.map((cell, ci) => {
                  const isToday = cell.dateStr === todayStr;
                  const hasAppts = cell.appointments.length > 0;
                  return (
                    <button
                      key={ci}
                      className={`appointments__month-cell ${!cell.day ? 'appointments__month-cell--empty' : ''} ${isToday ? 'appointments__month-cell--today' : ''} ${hasAppts ? 'appointments__month-cell--has-appts' : ''}`}
                      onClick={() => {
                        if (cell.dateStr) {
                          setSelectedDate(cell.dateStr);
                          setView('day');
                        }
                      }}
                      disabled={!cell.day}
                    >
                      {cell.day && (
                        <>
                          <span className="appointments__month-cell-day">{cell.day}</span>
                          {hasAppts && (
                            <>
                              <span className="appointments__month-cell-count">{cell.appointments.length}</span>
                              <div className="appointments__month-cell-dots">
                                {cell.appointments.some((a) => a.status === 'confirmed') && <span className="appointments__month-dot appointments__month-dot--confirmed" />}
                                {cell.appointments.some((a) => a.status === 'pending') && <span className="appointments__month-dot appointments__month-dot--pending" />}
                                {cell.appointments.some((a) => a.status === 'completed') && <span className="appointments__month-dot appointments__month-dot--completed" />}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== EMPTY STATE ===== */}
      {filteredAppointments.length === 0 && (
        <div className="appointments__empty">
          <div className="appointments__empty-icon">
            <CalendarIcon size={48} />
          </div>
          <h3 className="appointments__empty-title">
            No hay citas {view === 'day' ? 'para este d\u00EDa' : view === 'week' ? 'esta semana' : 'este mes'}
          </h3>
          <p className="appointments__empty-text">
            {barberFilter !== 'all' || serviceFilter !== 'all'
              ? 'Intenta cambiar los filtros aplicados'
              : 'Crea una nueva cita para empezar'}
          </p>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <PlusIcon />
            Crear Cita
          </Button>
        </div>
      )}

      {/* ===== NEW APPOINTMENT MODAL ===== */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Cita" className="modal--lg">
        <div className="appointments__modal">
          {/* Client search */}
          <div className="appointments__modal-section">
            <label className="appointments__modal-label">
              <UserIcon size={14} />
              <span>Cliente</span>
            </label>
            <div className="appointments__modal-search">
              <SearchIcon />
              <input
                type="text"
                className="appointments__modal-input"
                placeholder="Buscar por nombre o tel&eacute;fono..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientDropdown(true);
                  if (!e.target.value) setFormData((prev) => ({ ...prev, clientId: '' }));
                }}
                onFocus={() => setShowClientDropdown(true)}
              />
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="appointments__modal-dropdown">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      className={`appointments__modal-dropdown-item ${formData.clientId === String(c.id) ? 'appointments__modal-dropdown-item--selected' : ''}`}
                      onClick={() => handleSelectClient(c)}
                    >
                      <div className="appointments__modal-dropdown-avatar">{getInitials(c.name)}</div>
                      <div className="appointments__modal-dropdown-info">
                        <span className="appointments__modal-dropdown-name">{c.name}</span>
                        <span className="appointments__modal-dropdown-meta">
                          {c.phone}
                          {c.tags && c.tags.length > 0 && (
                            <>
                              {' '}&middot;{' '}
                              {c.tags.map((tag) => (
                                <span key={tag} className="appointments__modal-dropdown-tag">{tag}</span>
                              ))}
                            </>
                          )}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Service Selection */}
          <div className="appointments__modal-section">
            <label className="appointments__modal-label">
              <ScissorsIcon size={14} />
              <span>Servicio</span>
            </label>
            <div className="appointments__modal-services">
              {Object.entries(servicesByCategory).map(([category, services]) => (
                <div key={category} className="appointments__modal-service-group">
                  <span className="appointments__modal-service-category">{category}</span>
                  <div className="appointments__modal-service-options">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        className={`appointments__modal-service-chip ${formData.serviceId === String(s.id) ? 'appointments__modal-service-chip--selected' : ''}`}
                        onClick={() => setFormData((prev) => ({ ...prev, serviceId: String(s.id) }))}
                      >
                        <span className="appointments__modal-service-chip-name">{s.name}</span>
                        <span className="appointments__modal-service-chip-meta">
                          {formatCurrency(s.price)} &middot; {s.duration} min
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Barber selection */}
          <div className="appointments__modal-section">
            <label className="appointments__modal-label">
              <UserIcon size={14} />
              <span>Profesional</span>
            </label>
            <div className="appointments__modal-barbers">
              {mockBarbers.filter((b) => b.available).map((b) => (
                <button
                  key={b.id}
                  className={`appointments__modal-barber-card ${formData.barberId === String(b.id) ? 'appointments__modal-barber-card--selected' : ''}`}
                  onClick={() => setFormData((prev) => ({ ...prev, barberId: String(b.id) }))}
                >
                  <div className="appointments__modal-barber-avatar">{getInitials(b.name)}</div>
                  <span className="appointments__modal-barber-name">{b.name}</span>
                  <span className="appointments__modal-barber-specialty">{b.specialty}</span>
                  {b.rating && (
                    <span className="appointments__modal-barber-rating">
                      <StarIcon size={10} /> {b.rating}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Date and Time */}
          <div className="appointments__modal-row">
            <div className="appointments__modal-section appointments__modal-section--half">
              <label className="appointments__modal-label">
                <CalendarIcon size={14} />
                <span>Fecha</span>
              </label>
              <input
                type="date"
                className="appointments__modal-input appointments__modal-input--date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="appointments__modal-section appointments__modal-section--half">
              <label className="appointments__modal-label">
                <ClockIcon size={14} />
                <span>Hora</span>
              </label>
              <div className="appointments__modal-time-grid">
                {TIME_SLOTS.filter((_, i) => i % 2 === 0).map((t) => (
                  <button
                    key={t}
                    className={`appointments__modal-time-slot ${formData.time === t ? 'appointments__modal-time-slot--selected' : ''}`}
                    onClick={() => setFormData((prev) => ({ ...prev, time: t }))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          {formData.clientId && formData.barberId && formData.serviceId && (
            <div className="appointments__modal-summary">
              <div className="appointments__modal-summary-header">
                <ScissorsIcon size={16} />
                <span>Resumen de la cita</span>
              </div>
              <div className="appointments__modal-summary-body">
                <div className="appointments__modal-summary-row">
                  <span>Cliente</span>
                  <strong>{getClientName(Number(formData.clientId))}</strong>
                </div>
                <div className="appointments__modal-summary-row">
                  <span>Profesional</span>
                  <strong>{getBarberName(Number(formData.barberId))}</strong>
                </div>
                <div className="appointments__modal-summary-row">
                  <span>Servicio</span>
                  <strong>{selectedService?.name}</strong>
                </div>
                <div className="appointments__modal-summary-row">
                  <span>Fecha y hora</span>
                  <strong>{formatDateDisplay(formData.date)} &middot; {formData.time}</strong>
                </div>
                <div className="appointments__modal-summary-row">
                  <span>Duraci&oacute;n</span>
                  <strong>{selectedService?.duration} minutos</strong>
                </div>
                <div className="appointments__modal-summary-divider" />
                <div className="appointments__modal-summary-row appointments__modal-summary-row--total">
                  <span>Total</span>
                  <strong>{formatCurrency(selectedService?.price || 0)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="appointments__modal-actions">
            <Button variant="secondary" size="md" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateAppointment}
              disabled={!formData.clientId || !formData.barberId || !formData.serviceId}
            >
              <PlusIcon />
              Crear Cita
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Appointments;
