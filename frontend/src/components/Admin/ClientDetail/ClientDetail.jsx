import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../common/Button/Button';
import { formatCurrency, formatDate, formatPhone } from '../../../utils/formatters';
import { STATUS_META } from '../../../utils/clientStatus';
import clientService from '../../../services/clientService';
import subscriptionService from '../../../services/subscriptionService';
import orderService from '../../../services/orderService';
import appointmentService from '../../../services/appointmentService';
import servicesService from '../../../services/servicesService';
import staffService from '../../../services/staffService';
import { useTenant } from '../../../context/TenantContext';
import { useNotification } from '../../../context/NotificationContext';

const COUNTRY_PREFIXES = {
  CO: '+57', CL: '+56', AR: '+54', PE: '+51', VE: '+58', EC: '+593',
  US: '+1', BR: '+55', MX: '+52', PA: '+507', CR: '+506', GT: '+502',
  HN: '+504', SV: '+503', NI: '+505', DO: '+1', PY: '+595', UY: '+598',
  BO: '+591', CU: '+53', PR: '+1',
};

const _API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const TIER_CONFIG = {
  bronze: { label: 'Bronze', color: '#CD7F32', bg: 'rgba(205,127,50,0.10)', next: 'silver', minPoints: 0 },
  silver: { label: 'Silver', color: '#6B7280', bg: 'rgba(107,114,128,0.10)', next: 'gold', minPoints: 100 },
  gold:   { label: 'Gold',   color: '#D97706', bg: 'rgba(217,119,6,0.10)', next: 'vip', minPoints: 300 },
  vip:    { label: 'VIP',    color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', next: null, minPoints: 500 },
};

const TIER_ORDER = ['bronze', 'silver', 'gold', 'vip'];

const TX_TYPE_LABELS = {
  earn_visit: { label: 'Puntos por visita', icon: '🏷️' },
  earn_referral: { label: 'Referido', icon: '🤝' },
  earn_birthday: { label: 'Bono cumpleaños', icon: '🎂' },
  earn_review: { label: 'Reseña', icon: '⭐' },
  earn_streak: { label: 'Racha de visitas', icon: '🔥' },
  redeem: { label: 'Canje de puntos', icon: '🎁' },
  adjustment: { label: 'Ajuste manual', icon: '✏️' },
  expire: { label: 'Puntos expirados', icon: '⏰' },
};

const STATUS_OPTIONS = [
  { value: null, label: 'Automático' },
  { value: 'activo', label: 'Activo' },
  { value: 'vip', label: 'VIP' },
  { value: 'en_riesgo', label: 'En riesgo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'nuevo', label: 'Nuevo' },
];

const stripPhonePrefix = (raw) => {
  if (!raw) return '';
  const stripped = raw.replace(/[\s()\-]/g, '');
  // Try with + first (e.g. +573001234567)
  for (const pfx of Object.values(COUNTRY_PREFIXES)) {
    if (stripped.startsWith(pfx)) return stripped.slice(pfx.length);
  }
  // Try without + (e.g. 573001234567)
  for (const pfx of Object.values(COUNTRY_PREFIXES)) {
    const digits = pfx.replace('+', '');
    if (stripped.startsWith(digits)) return stripped.slice(digits.length);
  }
  if (stripped.startsWith('+')) return stripped.replace(/^\+\d{1,3}/, '');
  return stripped;
};

const HOURS_START = 7, HOURS_END = 21, SLOT_MIN = 15;
const pad2 = (n) => String(n).padStart(2, '0');
const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minToTime = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const formatTime12 = (t) => { if (!t) return ''; const [h, mn] = t.split(':').map(Number); return `${h % 12 || 12}:${pad2(mn)} ${h >= 12 ? 'p.m.' : 'a.m.'}`; };
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const ClientDetail = ({ client: clientProp, onClose, onEdit, onRefresh, onDelete, onSell }) => {
  const { tenant } = useTenant();
  const { addNotification } = useNotification();
  const countryPrefix = COUNTRY_PREFIXES[tenant?.country] || '+57';
  const [localClient, setLocalClient] = useState(clientProp);
  const [activeTab, setActiveTab] = useState('overview');
  const [visits, setVisits] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [loyalty, setLoyalty] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [subsLoaded, setSubsLoaded] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeemDesc, setRedeemDesc] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  // Services tab state
  const [svcCatalog, setSvcCatalog] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [svcItems, setSvcItems] = useState([]);
  const [svcSearch, setSvcSearch] = useState('');
  const [svcDate, setSvcDate] = useState(toISO(new Date()));
  const [svcNotes, setSvcNotes] = useState('');
  const [svcSubmitting, setSvcSubmitting] = useState(false);
  const [staffSchedules, setStaffSchedules] = useState({});
  const [dayApts, setDayApts] = useState([]);
  const [svcTicket, setSvcTicket] = useState('');

  const statusBtnRef = useRef(null);
  const b = 'client-detail';

  useEffect(() => { setLocalClient(clientProp); }, [clientProp]);

  const client = localClient;

  const startEditing = useCallback(() => {
    setEditForm({
      name: client.name || '',
      phone: stripPhonePrefix(client.phone),
      email: client.email || '',
      document_type: client.document_type || 'CC',
      document_number: client.document_number || '',
      birthday: client.birthday || '',
      visit_code: client.visit_code || '',
      accepts_whatsapp: client.accepts_whatsapp ?? true,
    });
    setIsEditing(true);
  }, [client]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditForm({});
  }, []);

  const saveEditing = useCallback(async () => {
    setSaving(true);
    try {
      const fullPhone = countryPrefix.replace('+', '') + editForm.phone.replace(/\D/g, '');
      const payload = {
        name: editForm.name,
        phone: fullPhone,
        email: editForm.email || null,
        document_type: editForm.document_type || null,
        document_number: editForm.document_number || null,
        birthday: editForm.birthday || null,
        visit_code: editForm.visit_code || null,
        accepts_whatsapp: editForm.accepts_whatsapp,
      };
      const updated = await clientService.update(client.id, payload);
      setLocalClient(updated);
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error al guardar: ' + (err.message || 'Error desconocido'));
    }
    setSaving(false);
  }, [client?.id, editForm, onRefresh]);

  const loadLoyalty = useCallback(async (clientId) => {
    try {
      const res = await fetch(`${_API}/loyalty/client/${clientId}`, { credentials: 'include' });
      if (res.ok) {
        setLoyalty(await res.json());
      } else {
        setLoyalty(null);
      }
    } catch {
      setLoyalty(null);
    }
  }, []);

  const loadVisits = useCallback(async () => {
    try {
      const data = await clientService.listVisits(client.id);
      setVisits(data);
    } catch { setVisits([]); }
    // Also load all appointments for this client
    try {
      const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
      const res = await fetch(`${API}/appointments/?client_id=${client.id}`, { credentials: 'include' });
      if (res.ok) {
        const apts = await res.json();
        setAllAppointments(apts.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)));
      }
    } catch { setAllAppointments([]); }
  }, [client?.id]);

  const loadNotes = useCallback(async () => {
    try {
      const data = await clientService.listNotes(client.id);
      setNotes(data);
    } catch { setNotes([]); }
  }, [client?.id]);

  useEffect(() => {
    if (client) {
      setActiveTab('overview');
      setNewNote('');
      setAddingNote(false);
      setShowStatusMenu(false);
      setSvcTicket(client?.visit_code || '');
      loadVisits();
      loadNotes();
      loadLoyalty(client.id);
    }
  }, [client, loadVisits, loadNotes, loadLoyalty]);

  useEffect(() => {
    if (!client) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isEditing) { cancelEditing(); return; }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [client, onClose, isEditing, cancelEditing]);

  useEffect(() => {
    if (!client) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [client]);

  const toggleStatusMenu = useCallback(() => {
    if (!showStatusMenu && statusBtnRef.current) {
      const rect = statusBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowStatusMenu(v => !v);
  }, [showStatusMenu]);

  useEffect(() => {
    if (!showStatusMenu) return;
    const handler = (e) => {
      if (statusBtnRef.current?.contains(e.target)) return;
      if (e.target.closest(`.${b}__status-menu`)) return;
      setShowStatusMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusMenu]);

  const handleStatusChange = useCallback(async (newStatus) => {
    setShowStatusMenu(false);
    try {
      const updated = await clientService.update(client.id, { status_override: newStatus });
      setLocalClient(updated);
      if (onRefresh) onRefresh();
    } catch {}
  }, [client?.id, onRefresh]);

  useEffect(() => {
    if (client?.id) {
      subscriptionService.list(client.id).then(setSubscriptions).catch(() => {}).finally(() => setSubsLoaded(true));
    }
  }, [client?.id]);

  const handleUseSession = useCallback(async (subId) => {
    try {
      const updated = await subscriptionService.useSession(subId);
      setSubscriptions(prev => prev.map(s => s.id === subId ? updated : s));
    } catch (err) { alert(err.message); }
  }, []);

  const handleCancelSub = useCallback(async (subId) => {
    if (!window.confirm('¿Cancelar esta suscripción?')) return;
    try {
      const updated = await subscriptionService.update(subId, { status: 'cancelled' });
      setSubscriptions(prev => prev.map(s => s.id === subId ? updated : s));
    } catch (err) { alert(err.message); }
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (!newNote.trim()) return;
    try {
      await clientService.createNote({
        client_id: client.id,
        content: newNote.trim(),
        created_by: 'Admin',
      });
      setNewNote('');
      setAddingNote(false);
      loadNotes();
    } catch {}
  }, [newNote, client?.id, loadNotes]);

  const handleDeleteNote = useCallback(async (noteId) => {
    try {
      await clientService.deleteNote(noteId);
      loadNotes();
    } catch {}
  }, [loadNotes]);

  // ── Services tab logic ──
  useEffect(() => {
    if (activeTab === 'services' && !svcCatalog.length) {
      Promise.all([servicesService.list(), staffService.list()])
        .then(([svcs, staff]) => { setSvcCatalog(svcs); setStaffList(staff); })
        .catch(() => {});
    }
  }, [activeTab, svcCatalog.length]);

  useEffect(() => {
    if (activeTab !== 'services' || !svcDate) return;
    appointmentService.list({ date_from: svcDate, date_to: svcDate })
      .then(list => setDayApts(Array.isArray(list) ? list : []))
      .catch(() => setDayApts([]));
  }, [activeTab, svcDate]);

  // Auto-load staff schedules when items change
  useEffect(() => {
    svcItems.forEach(item => {
      if (item.staff_id && !staffSchedules[item.staff_id]) {
        fetch(`${_API}/staff/${item.staff_id}/schedule`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) setStaffSchedules(prev => ({ ...prev, [item.staff_id]: data.schedule || data })); })
          .catch(() => {});
      }
    });
  }, [svcItems, staffSchedules]);

  const loadStaffSchedule = useCallback(async (staffId) => {
    if (staffSchedules[staffId]) return;
    try {
      const res = await fetch(`${_API}/staff/${staffId}/schedule`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStaffSchedules(prev => ({ ...prev, [staffId]: data.schedule || data }));
      }
    } catch {}
  }, [staffSchedules]);

  const computeSlots = useCallback((staffId, serviceId, itemIndex) => {
    const svc = svcCatalog.find(s => s.id === serviceId);
    const dur = svc?.duration_minutes || 30;
    const dateObj = new Date(svcDate + 'T12:00:00');
    const dow = dateObj.getDay();
    const bdow = dow === 0 ? 6 : dow - 1;
    let schedStart = HOURS_START * 60, schedEnd = HOURS_END * 60;
    let breakStart = -1, breakEnd = -1, isWorking = true;
    const sched = staffSchedules[staffId];
    if (Array.isArray(sched)) {
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
    svcItems.forEach((other, j) => {
      if (j === itemIndex || !other.time) return;
      const otherDur = svcCatalog.find(s => s.id === other.service_id)?.duration_minutes || 30;
      busy.push({ s: timeToMin(other.time), e: timeToMin(other.time) + otherDur });
    });
    const isToday = svcDate === toISO(new Date());
    const now = new Date();
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : 0;
    const slots = [];
    for (let m = Math.max(HOURS_START * 60, schedStart); m < Math.min(HOURS_END * 60, schedEnd); m += SLOT_MIN) {
      if (isToday && m < nowMin) continue;
      const end = m + dur;
      if (end > schedEnd) break;
      if (breakStart >= 0 && m < breakEnd && end > breakStart) continue;
      if (!busy.some(bb => m < bb.e && end > bb.s)) slots.push(m);
    }
    return { slots, closed: false };
  }, [svcCatalog, staffSchedules, dayApts, svcItems, svcDate]);

  const addSvcItem = useCallback((svc) => {
    setSvcItems(prev => [...prev, { service_id: svc.id, service_name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, staff_id: '', time: '', staff_ids: svc.staff_ids || [] }]);
    setSvcSearch('');
  }, []);

  const updateSvcItem = useCallback((idx, field, val) => {
    setSvcItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }, []);

  const removeSvcItem = useCallback((idx) => {
    setSvcItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const svcSubtotal = useMemo(() => svcItems.reduce((s, i) => s + (i.price || 0), 0), [svcItems]);

  const handleCreateOrder = useCallback(async () => {
    if (!svcTicket.trim()) { addNotification('El ticket es obligatorio', 'error'); return; }
    if (!svcItems.length) { addNotification('Agrega al menos un servicio', 'error'); return; }
    setSvcSubmitting(true);
    try {
      const mainStaff = svcItems.find(it => it.staff_id)?.staff_id || null;
      const firstTime = svcItems.find(it => it.time)?.time || null;
      const payload = {
        client_id: client.id,
        client_name: client.name,
        client_phone: client.phone || '',
        client_email: client.email || '',
        staff_id: mainStaff ? parseInt(mainStaff) : null,
        service_date: svcDate,
        service_time: firstTime,
        notes: svcNotes,
        ticket_number: svcTicket.trim(),
        items: svcItems.map(it => ({ service_id: it.service_id, service_name: it.service_name, price: it.price, duration_minutes: it.duration_minutes, staff_id: it.staff_id ? parseInt(it.staff_id) : null })),
        products: [],
      };
      await orderService.create(payload);

      // Create appointment for each service item that has staff assigned
      for (const item of svcItems) {
        const itemStaff = item.staff_id ? parseInt(item.staff_id) : (mainStaff ? parseInt(mainStaff) : null);
        if (itemStaff) {
          try {
            await appointmentService.create({
              client_id: client.id,
              client_name: client.name,
              client_phone: client.phone || '',
              staff_id: itemStaff,
              service_id: item.service_id,
              date: svcDate,
              time: item.time || firstTime || '09:00',
              duration_minutes: item.duration_minutes,
              price: item.price,
              status: 'confirmed',
              visit_code: svcTicket.trim(),
              notes: svcNotes,
            });
          } catch {}
        }
      }

      addNotification('Orden creada y cita agendada', 'success');
      setSvcItems([]);
      setSvcNotes('');
      if (onRefresh) onRefresh();
    } catch (err) {
      addNotification(err.message || 'Error al crear orden', 'error');
    } finally {
      setSvcSubmitting(false);
    }
  }, [svcItems, svcDate, svcNotes, svcTicket, client, addNotification, onRefresh]);

  if (!client) return null;

  const getInitials = (name) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const activeSubCount = subscriptions.filter(s => s.status === 'active').length;
  const tabs = [
    { id: 'overview', label: 'Resumen' },
    { id: 'services', label: 'Servicios' },
    { id: 'subscriptions', label: `Planes${activeSubCount ? ` (${activeSubCount})` : ''}` },
    { id: 'history', label: 'Historial' },
    { id: 'notes', label: 'Notas' },
  ];

  const statusMeta = STATUS_META[client.status] || { label: client.status, color: 'default' };
  const daysAgo = client.days_since_last_visit;

  const statItems = [
    {
      label: 'Total Visitas', value: client.total_visits, accent: 'primary',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
    },
    {
      label: 'Total Gastado', value: formatCurrency(client.total_spent), accent: 'accent',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    },
    {
      label: 'Ticket Promedio', value: formatCurrency(client.avg_ticket || 0), accent: 'info',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
    },
    {
      label: 'Días sin Visitar', value: daysAgo ?? '—',
      accent: daysAgo > 60 ? 'danger' : daysAgo > 45 ? 'warning' : daysAgo > 20 ? 'warning' : 'success',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    },
    {
      label: 'No-Shows', value: client.no_show_count ?? 0,
      accent: (client.no_show_count ?? 0) > 0 ? 'danger' : 'success',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
    },
    {
      label: 'Cliente Desde', value: client.created_at ? formatDate(client.created_at.split('T')[0]) : '—', accent: 'primary',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    },
  ];

  const contactItems = [
    {
      label: 'Teléfono', value: formatPhone(client.phone),
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
    },
    {
      label: 'Email', value: client.email || '\u2014',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
    },
    {
      label: 'Documento', value: client.document_type && client.document_number ? `${client.document_type}: ${client.document_number}` : '\u2014',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="13" y2="12" /></svg>,
    },
    {
      label: 'Cumpleaños', value: client.birthday ? formatDate(client.birthday) : '\u2014',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    },
    {
      label: 'Ticket', value: client.visit_code || '\u2014',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 0 0-8 0v2" /><line x1="12" y1="11" x2="12" y2="15" /></svg>,
    },
    {
      label: 'WhatsApp',
      value: client.accepts_whatsapp ? 'Acepta mensajes' : 'No acepta',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
    },
  ];

  const visitStatusLabels = { completed: 'Completada', no_show: 'No asistió', cancelled: 'Cancelada' };

  // ── Quick actions handlers ──
  const handleWhatsApp = () => {
    if (client.phone) {
      window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}`, '_blank');
    }
  };

  const handleSellClick = () => {
    if (onSell) onSell(client);
  };

  const handleEditClick = () => {
    if (isEditing) return;
    setActiveTab('overview');
    startEditing();
  };

  const handleDeleteClick = () => {
    if (onDelete) onDelete(client);
  };

  return createPortal(
    <div className={`${b}__wrapper`}>
      <div className={`${b}__overlay`} onClick={onClose} />

      <div className={b}>
        <button className={`${b}__close`} onClick={onClose} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={`${b}__hero ${b}__hero--${client.status}`}>
          <div className={`${b}__hero-glow`} />
          <div className={`${b}__hero-top`}>
            <div className={`${b}__avatar-wrap`}>
              <div className={`${b}__avatar ${b}__avatar--${client.status}`}>
                {getInitials(client.name)}
              </div>
              <span className={`${b}__avatar-ring`} aria-hidden="true" />
            </div>
            <div className={`${b}__hero-info`}>
              <h2 className={`${b}__name`}>{client.name}</h2>
              <div className={`${b}__hero-meta`}>
                <span className={`${b}__client-id`}>{client.client_id}</span>
                <span className={`${b}__hero-dot`} />
                <button
                  ref={statusBtnRef}
                  className={`${b}__status ${b}__status--${client.status}`}
                  onClick={toggleStatusMenu}
                  title="Cambiar estado"
                >
                  {client.status === 'vip' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                    </svg>
                  )}
                  {statusMeta.label}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {showStatusMenu && createPortal(
                  <div
                    className={`${b}__status-menu`}
                    style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 99999 }}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value ?? 'auto'}
                        className={`${b}__status-menu-item ${client.status === opt.value ? `${b}__status-menu-item--active` : ''}`}
                        onClick={() => handleStatusChange(opt.value)}
                      >
                        {opt.value && <span className={`${b}__status-dot ${b}__status-dot--${opt.value}`} />}
                        {opt.label}
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
                {client.email && (
                  <>
                    <span className={`${b}__hero-dot`} />
                    <span className={`${b}__hero-email`} title={client.email}>{client.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className={`${b}__quick-actions`}>
            <button
              type="button"
              className={`${b}__qa ${b}__qa--wa`}
              onClick={handleWhatsApp}
              disabled={!client.phone}
              title="Contactar por WhatsApp"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 0 1-4.243-1.214l-.257-.154-2.849.846.846-2.849-.154-.257A8 8 0 1 1 12 20z"/></svg>
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              className={`${b}__qa ${b}__qa--sell`}
              onClick={handleSellClick}
              disabled={!onSell}
              title="Crear nueva orden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span>Vender</span>
            </button>

            <button
              type="button"
              className={`${b}__qa ${b}__qa--edit`}
              onClick={handleEditClick}
              title="Editar información"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>Editar</span>
            </button>

            <button
              type="button"
              className={`${b}__qa ${b}__qa--delete`}
              onClick={handleDeleteClick}
              disabled={!onDelete}
              title="Eliminar cliente"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        <div className={`${b}__tabs`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${b}__tab ${activeTab === tab.id ? `${b}__tab--active` : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={`${b}__content`}>
          {activeTab === 'overview' && (
            <div className={`${b}__overview`}>
              {/* 1. Información de Contacto — primera */}
              <div className={`${b}__info-section`}>
                <div className={`${b}__section-header`}>
                  <h4 className={`${b}__section-title`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Información de Contacto
                  </h4>
                  {isEditing ? (
                    <div className={`${b}__section-actions`}>
                      <button className={`${b}__btn-cancel`} onClick={cancelEditing} disabled={saving}>Cancelar</button>
                      <button className={`${b}__btn-save`} onClick={saveEditing} disabled={saving || !editForm.name?.trim() || !editForm.phone?.trim()}>
                        {saving ? (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`${b}__spin`}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Guardar
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button className={`${b}__btn-edit`} onClick={startEditing}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Editar
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className={`${b}__edit-form`}>
                    <div className={`${b}__edit-row`}>
                      <div className={`${b}__edit-field`}>
                        <label className={`${b}__edit-label`}>Nombre completo</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className={`${b}__edit-input`}
                          placeholder="Nombre del cliente"
                        />
                      </div>
                      <div className={`${b}__edit-field`}>
                        <label className={`${b}__edit-label`}>Ticket</label>
                        <input
                          type="text"
                          value={editForm.visit_code}
                          onChange={e => setEditForm(f => ({ ...f, visit_code: e.target.value }))}
                          className={`${b}__edit-input`}
                          placeholder="Ej: 1213"
                        />
                      </div>
                    </div>
                    <div className={`${b}__edit-row`}>
                      <div className={`${b}__edit-field`}>
                        <label className={`${b}__edit-label`}>Telefono (WhatsApp)</label>
                        <div className={`${b}__edit-phone`}>
                          <span className={`${b}__edit-phone-prefix`}>{countryPrefix}</span>
                          <input
                            type="text"
                            value={editForm.phone}
                            onChange={e => {
                              const el = e.target;
                              const pos = el.selectionStart;
                              const prev = editForm.phone;
                              const digits = el.value.replace(/\D/g, '').slice(0, 10);
                              setEditForm(f => ({ ...f, phone: digits }));
                              requestAnimationFrame(() => {
                                const diff = digits.length - prev.length;
                                const newPos = Math.max(0, pos + diff);
                                el.setSelectionRange(newPos, newPos);
                              });
                            }}
                            className={`${b}__edit-input`}
                            placeholder="3001234567"
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                      <div className={`${b}__edit-field`}>
                        <label className={`${b}__edit-label`}>Email</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                          className={`${b}__edit-input`}
                          placeholder="correo@ejemplo.com"
                        />
                      </div>
                    </div>
                    <div className={`${b}__edit-row`}>
                      <div className={`${b}__edit-field`}>
                        <label className={`${b}__edit-label`}>Documento</label>
                        <div className={`${b}__edit-doc`}>
                          <select
                            value={editForm.document_type}
                            onChange={e => setEditForm(f => ({ ...f, document_type: e.target.value }))}
                            className={`${b}__edit-select`}
                          >
                            <option value="CC">CC</option>
                            <option value="CE">CE</option>
                            <option value="TI">TI</option>
                            <option value="NIT">NIT</option>
                            <option value="Pasaporte">Pasaporte</option>
                          </select>
                          <input
                            type="text"
                            value={editForm.document_number}
                            onChange={e => setEditForm(f => ({ ...f, document_number: e.target.value }))}
                            className={`${b}__edit-input`}
                            placeholder="Numero de documento"
                          />
                        </div>
                      </div>
                      <div className={`${b}__edit-field`}>
                        <label className={`${b}__edit-label`}>Cumpleanos</label>
                        <input
                          type="date"
                          value={editForm.birthday}
                          onChange={e => setEditForm(f => ({ ...f, birthday: e.target.value }))}
                          className={`${b}__edit-input`}
                        />
                      </div>
                    </div>
                    <div className={`${b}__edit-row`}>
                      <div className={`${b}__edit-field`}>
                        <label className={`${b}__edit-label`}>WhatsApp</label>
                        <label className={`${b}__edit-toggle`}>
                          <input
                            type="checkbox"
                            checked={editForm.accepts_whatsapp}
                            onChange={e => setEditForm(f => ({ ...f, accepts_whatsapp: e.target.checked }))}
                          />
                          <span className={`${b}__edit-toggle-slider`} />
                          <span className={`${b}__edit-toggle-text`}>{editForm.accepts_whatsapp ? 'Acepta mensajes' : 'No acepta'}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`${b}__info-grid`}>
                    {contactItems.map((item) => (
                      <div key={item.label} className={`${b}__info-item`}>
                        <div className={`${b}__info-icon`}>{item.icon}</div>
                        <div className={`${b}__info-text`}>
                          <span className={`${b}__info-label`}>{item.label}</span>
                          <span className={`${b}__info-value`}>{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Stats Grid — segundo */}
              <div className={`${b}__stats-grid`}>
                {statItems.map((stat) => (
                  <div key={stat.label} className={`${b}__stat ${b}__stat--${stat.accent}`}>
                    <div className={`${b}__stat-icon`}>{stat.icon}</div>
                    <span className={`${b}__stat-label`}>{stat.label}</span>
                    <span className={`${b}__stat-value`}>{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* 3. Programa de Lealtad — rediseñado */}
              {loyalty?.account && (() => {
                const tierKey = (loyalty.account.tier || 'bronze').toLowerCase();
                const tier = TIER_CONFIG[tierKey] || TIER_CONFIG.bronze;
                const currentIdx = TIER_ORDER.indexOf(tierKey);
                const nextTierKey = tier.next;
                const nextTier = nextTierKey ? TIER_CONFIG[nextTierKey] : null;
                const totalPts = loyalty.account.total_points ?? 0;
                const availPts = loyalty.account.available_points ?? 0;
                const progressPct = nextTier
                  ? Math.min(100, Math.round(((totalPts - tier.minPoints) / (nextTier.minPoints - tier.minPoints)) * 100))
                  : 100;

                return (
                  <div className={`${b}__info-section`}>
                    <h4 className={`${b}__section-title`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                      </svg>
                      Programa de Lealtad
                    </h4>
                    <div className={`${b}__loyalty-card`} style={{ '--tier-accent': tier.color, '--tier-bg': tier.bg }}>
                      {/* Header con puntos y nivel */}
                      <div className={`${b}__loyalty-header`}>
                        <div className={`${b}__loyalty-points-block`}>
                          <span className={`${b}__loyalty-pts-number`}>{availPts.toLocaleString('es-CO')}</span>
                          <span className={`${b}__loyalty-pts-label`}>puntos disponibles</span>
                        </div>
                        <div className={`${b}__loyalty-tier-badge`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                          </svg>
                          {tier.label}
                        </div>
                      </div>

                      {/* Barra de progreso hacia siguiente nivel */}
                      <div className={`${b}__loyalty-progress`}>
                        <div className={`${b}__loyalty-progress-info`}>
                          <span>{totalPts.toLocaleString('es-CO')} pts acumulados</span>
                          {nextTier ? (
                            <span>{nextTier.minPoints - totalPts > 0 ? `${(nextTier.minPoints - totalPts).toLocaleString('es-CO')} pts para ${nextTier.label}` : `${nextTier.label} desbloqueado`}</span>
                          ) : (
                            <span>Nivel máximo alcanzado</span>
                          )}
                        </div>
                        <div className={`${b}__loyalty-progress-bar`}>
                          <div className={`${b}__loyalty-progress-fill`} style={{ width: `${progressPct}%` }} />
                        </div>
                        {/* Tier milestones */}
                        <div className={`${b}__loyalty-tiers-row`}>
                          {TIER_ORDER.map((tk, i) => {
                            const tc = TIER_CONFIG[tk];
                            const reached = i <= currentIdx;
                            return (
                              <span key={tk} className={`${b}__loyalty-tier-dot ${reached ? `${b}__loyalty-tier-dot--reached` : ''}`} style={{ '--dot-color': tc.color }}>
                                {tc.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Botón canjear */}
                      {availPts > 0 && !showRedeem && (
                        <button className={`${b}__loyalty-redeem-btn`} onClick={() => { setShowRedeem(true); setRedeemPoints(''); setRedeemDesc(''); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                          </svg>
                          Canjear puntos
                        </button>
                      )}

                      {/* Panel canjear */}
                      {showRedeem && (
                        <div className={`${b}__loyalty-redeem-panel`}>
                          <div className={`${b}__loyalty-redeem-header`}>
                            <strong>Canjear puntos</strong>
                            <span>Disponibles: {availPts.toLocaleString('es-CO')}</span>
                          </div>
                          <div className={`${b}__loyalty-redeem-form`}>
                            <input
                              type="number"
                              min="1"
                              max={availPts}
                              placeholder="Puntos a canjear"
                              value={redeemPoints}
                              onChange={e => setRedeemPoints(e.target.value)}
                              className={`${b}__input`}
                            />
                            <input
                              type="text"
                              placeholder="Motivo (ej: Descuento en servicio)"
                              value={redeemDesc}
                              onChange={e => setRedeemDesc(e.target.value)}
                              className={`${b}__input`}
                            />
                          </div>
                          <div className={`${b}__loyalty-redeem-actions`}>
                            <button className={`${b}__btn-ghost`} onClick={() => setShowRedeem(false)}>Cancelar</button>
                            <button
                              className={`${b}__btn-primary`}
                              disabled={redeeming || !redeemPoints || parseInt(redeemPoints) <= 0 || parseInt(redeemPoints) > availPts}
                              onClick={async () => {
                                setRedeeming(true);
                                try {
                                  const res = await fetch(`${_API}/loyalty/redeem`, {
                                    method: 'POST', credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ client_id: client.id, points: parseInt(redeemPoints), description: redeemDesc || 'Canje de puntos' }),
                                  });
                                  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error'); }
                                  setShowRedeem(false);
                                  loadLoyalty(client.id);
                                } catch (err) {
                                  alert(err.message);
                                }
                                setRedeeming(false);
                              }}
                            >
                              {redeeming ? 'Canjeando...' : `Canjear ${redeemPoints || 0} puntos`}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Transacciones recientes */}
                      {loyalty.transactions?.length > 0 && (
                        <div className={`${b}__loyalty-txns`}>
                          <span className={`${b}__loyalty-txns-title`}>Últimas transacciones</span>
                          {loyalty.transactions.slice(0, 5).map((tx, idx) => {
                            const isPositive = tx.points > 0;
                            const txMeta = TX_TYPE_LABELS[tx.type] || { label: tx.type || tx.description || 'Transacción', icon: '📌' };
                            return (
                              <div key={tx.id || idx} className={`${b}__loyalty-txn`}>
                                <div className={`${b}__loyalty-txn-icon`}>{txMeta.icon}</div>
                                <div className={`${b}__loyalty-txn-left`}>
                                  <span className={`${b}__loyalty-txn-type`}>{txMeta.label}</span>
                                  <span className={`${b}__loyalty-txn-date`}>{tx.created_at ? formatDate(tx.created_at.split('T')[0]) : ''}</span>
                                </div>
                                <span className={`${b}__loyalty-txn-points ${b}__loyalty-txn-points--${isPositive ? 'positive' : 'negative'}`}>
                                  {isPositive ? '+' : ''}{tx.points}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {(client.favorite_service || client.preferred_barber_name) && (
                <div className={`${b}__info-section`}>
                  <h4 className={`${b}__section-title`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                    </svg>
                    Preferencias (basado en historial)
                  </h4>
                  <div className={`${b}__pref-grid`}>
                    {client.favorite_service && (
                      <div className={`${b}__pref-item`}>
                        <span className={`${b}__pref-label`}>Servicio frecuente</span>
                        <span className={`${b}__pref-value`}>{client.favorite_service}</span>
                      </div>
                    )}
                    {client.preferred_barber_name && (
                      <div className={`${b}__pref-item`}>
                        <span className={`${b}__pref-label`}>Profesional frecuente</span>
                        <span className={`${b}__pref-value`}>{client.preferred_barber_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {client.tags?.length > 0 && (
                <div className={`${b}__info-section`}>
                  <div className={`${b}__tags`}>
                    {client.tags.map((tag, idx) => {
                      const colors = ['primary', 'accent', 'info', 'success', 'warning'];
                      return (
                        <span key={tag} className={`${b}__tag ${b}__tag--${colors[idx % colors.length]}`}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div className={`${b}__services-tab`}>
              {/* Ticket number (required) */}
              <div className={`${b}__svc-ticket-row`}>
                <label className={`${b}__svc-label`}>Ticket *</label>
                <div className={`${b}__svc-ticket-input`}>
                  <span className={`${b}__svc-ticket-prefix`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>
                  </span>
                  <input type="text" value={svcTicket} onChange={e => setSvcTicket(e.target.value)} placeholder="Ej: T-001" className={`${b}__svc-ticket-field`} />
                </div>
              </div>

              {/* Date picker */}
              <div className={`${b}__svc-date-row`}>
                <label className={`${b}__svc-label`}>Fecha</label>
                <div className={`${b}__svc-date-input`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`${b}__svc-date-icon`}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <input type="date" value={svcDate} onChange={e => { setSvcDate(e.target.value); setSvcItems(prev => prev.map(it => ({ ...it, time: '' }))); }} className={`${b}__svc-date-field`} min={toISO(new Date())} />
                </div>
              </div>

              {/* Quick services chips */}
              {svcCatalog.length > 0 && (
                <div className={`${b}__svc-quick`}>
                  <label className={`${b}__svc-label`}>Acceso rapido</label>
                  <div className={`${b}__svc-quick-list`}>
                    {svcCatalog.slice(0, 6).map(s => (
                      <button key={s.id} type="button" className={`${b}__svc-quick-chip`} onClick={() => addSvcItem(s)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        <span>{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search */}
              <div className={`${b}__svc-search-wrap`}>
                <div className={`${b}__svc-search-inner`}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`${b}__svc-search-icon`}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    value={svcSearch}
                    onChange={e => setSvcSearch(e.target.value)}
                    placeholder="Buscar servicio..."
                    className={`${b}__svc-search-field`}
                  />
                </div>
                {svcSearch.trim() && (
                  <div className={`${b}__svc-dropdown`}>
                    {svcCatalog.filter(s => s.name.toLowerCase().includes(svcSearch.toLowerCase())).slice(0, 8).map(s => (
                      <button key={s.id} type="button" className={`${b}__svc-dropdown-item`} onClick={() => addSvcItem(s)}>
                        <span>{s.name}</span>
                        <span className={`${b}__svc-dropdown-price`}>{formatCOP(s.price)}</span>
                      </button>
                    ))}
                    {svcCatalog.filter(s => s.name.toLowerCase().includes(svcSearch.toLowerCase())).length === 0 && (
                      <div className={`${b}__svc-dropdown-empty`}>Sin resultados</div>
                    )}
                  </div>
                )}
              </div>

              {/* Added services */}
              {svcItems.length > 0 && (
                <div className={`${b}__svc-items`}>
                  {svcItems.map((item, idx) => {
                    const eligibleStaff = item.staff_ids?.length
                      ? staffList.filter(st => item.staff_ids.includes(st.id))
                      : staffList;

                    const slotData = item.staff_id && staffSchedules[item.staff_id] ? computeSlots(parseInt(item.staff_id), item.service_id, idx) : null;

                    return (
                      <div key={idx} className={`${b}__svc-item`}>
                        <div className={`${b}__svc-item-header`}>
                          <div className={`${b}__svc-item-info`}>
                            <span className={`${b}__svc-item-name`}>{item.service_name}</span>
                            <span className={`${b}__svc-item-price`}>{formatCOP(item.price)}</span>
                          </div>
                          <button type="button" className={`${b}__svc-item-remove`} onClick={() => removeSvcItem(idx)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <div className={`${b}__svc-item-meta`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          <span>{item.duration_minutes} min</span>
                        </div>
                        <div className={`${b}__svc-item-fields`}>
                          <div className={`${b}__edit-field`}>
                            <label className={`${b}__edit-label`}>Profesional (opcional)</label>
                            <select
                              value={item.staff_id}
                              onChange={e => { updateSvcItem(idx, 'staff_id', e.target.value); updateSvcItem(idx, 'time', ''); if (e.target.value) loadStaffSchedule(e.target.value); }}
                              className={`${b}__edit-select`}
                            >
                              <option value="">Sin asignar</option>
                              {eligibleStaff.map(st => (
                                <option key={st.id} value={st.id}>{st.name}</option>
                              ))}
                            </select>
                          </div>
                          {item.staff_id && slotData && (
                            <div className={`${b}__edit-field`}>
                              <label className={`${b}__edit-label`}>Hora</label>
                              {slotData.closed ? (
                                <span className={`${b}__svc-closed`}>No disponible este dia</span>
                              ) : slotData.slots.length === 0 ? (
                                <span className={`${b}__svc-closed`}>Sin horarios disponibles</span>
                              ) : (
                                <div className={`${b}__svc-slots`}>
                                  {slotData.slots.map(m => {
                                    const t = minToTime(m);
                                    return (
                                      <button key={m} type="button" className={`${b}__svc-slot ${item.time === t ? `${b}__svc-slot--active` : ''}`} onClick={() => updateSvcItem(idx, 'time', t)}>
                                        {formatTime12(t)}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notes */}
              {svcItems.length > 0 && (
                <div className={`${b}__svc-notes`}>
                  <label className={`${b}__svc-label`}>Notas (opcional)</label>
                  <textarea value={svcNotes} onChange={e => setSvcNotes(e.target.value)} className={`${b}__edit-input`} rows={2} placeholder="Observaciones..." />
                </div>
              )}

              {/* Summary footer */}
              {svcItems.length > 0 && (
                <div className={`${b}__svc-footer`}>
                  <div className={`${b}__svc-summary`}>
                    <span className={`${b}__svc-count`}>{svcItems.length} servicio{svcItems.length !== 1 ? 's' : ''}</span>
                    <span className={`${b}__svc-total-amount`}>{formatCOP(svcSubtotal)}</span>
                  </div>
                  <button
                    type="button"
                    className={`${b}__svc-submit`}
                    disabled={svcSubmitting}
                    onClick={handleCreateOrder}
                  >
                    {svcSubmitting ? (
                      'Creando...'
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                        Crear orden y agendar
                      </>
                    )}
                  </button>
                </div>
              )}

              {svcItems.length === 0 && !svcSearch.trim() && (
                <div className={`${b}__svc-empty`}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.4 }}>
                    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 0 0-8 0v2" />
                  </svg>
                  <p>Selecciona servicios desde el acceso rapido o busca arriba</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className={`${b}__subscriptions`}>
              {!subsLoaded ? (
                <p style={{ color: '#94A3B8', fontSize: 13, padding: 16 }}>Cargando planes...</p>
              ) : subscriptions.length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: 13, padding: 16 }}>Este cliente no tiene planes o paquetes activos.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
                  {subscriptions.map(sub => {
                    const isActive = sub.status === 'active';
                    const daysLeft = sub.expires_at ? Math.ceil((new Date(sub.expires_at) - new Date()) / 86400000) : null;
                    const sessionPct = sub.sessions_total ? Math.round((sub.sessions_used / sub.sessions_total) * 100) : null;
                    const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;
                    const isExpired = daysLeft !== null && daysLeft <= 0;

                    return (
                      <div key={sub.id} style={{
                        padding: '14px 16px', borderRadius: 12,
                        background: isActive ? '#fff' : '#f8fafc',
                        border: `1px solid ${isExpiringSoon ? '#F59E0B' : isExpired ? '#EF4444' : isActive ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)'}`,
                        opacity: isActive ? 1 : 0.6,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{sub.service_name}</span>
                            <span style={{
                              marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
                              background: sub.status === 'active' ? '#DCFCE7' : sub.status === 'completed' ? '#DBEAFE' : sub.status === 'cancelled' ? '#FEE2E2' : '#FEF3C7',
                              color: sub.status === 'active' ? '#166534' : sub.status === 'completed' ? '#1E40AF' : sub.status === 'cancelled' ? '#991B1B' : '#92400E',
                            }}>
                              {sub.status === 'active' ? 'Activo' : sub.status === 'completed' ? 'Completado' : sub.status === 'cancelled' ? 'Cancelado' : sub.status === 'expired' ? 'Vencido' : sub.status}
                            </span>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#3B82F6' }}>
                            {formatCurrency(sub.amount_paid)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748B', marginBottom: sub.sessions_total ? 10 : 0 }}>
                          {sub.expires_at && (
                            <span style={{ color: isExpired ? '#EF4444' : isExpiringSoon ? '#F59E0B' : '#64748B' }}>
                              {isExpired ? `Venció hace ${Math.abs(daysLeft)} días` : `Vence en ${daysLeft} días`}
                            </span>
                          )}
                          {sub.sessions_total && (
                            <span>{sub.sessions_used}/{sub.sessions_total} sesiones</span>
                          )}
                          {sub.payment_method && <span>{sub.payment_method}</span>}
                          {sub.purchased_at && <span>Comprado: {new Date(sub.purchased_at).toLocaleDateString('es-CO')}</span>}
                        </div>

                        {sub.sessions_total && (
                          <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3, transition: 'width 0.3s ease',
                              width: `${sessionPct}%`,
                              background: sessionPct >= 90 ? '#EF4444' : sessionPct >= 70 ? '#F59E0B' : '#10B981',
                            }} />
                          </div>
                        )}

                        {isActive && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            {sub.sessions_total && sub.sessions_used < sub.sessions_total && (
                              <button onClick={() => handleUseSession(sub.id)} style={{
                                padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                                border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)',
                                color: '#10B981', cursor: 'pointer',
                              }}>
                                + Registrar sesión
                              </button>
                            )}
                            <button onClick={() => handleCancelSub(sub.id)} style={{
                              padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                              border: '1px solid rgba(239,68,68,0.2)', background: 'transparent',
                              color: '#EF4444', cursor: 'pointer',
                            }}>
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className={`${b}__history`}>
              {allAppointments.length === 0 ? (
                <div className={`${b}__empty`}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <p>No hay historial disponible</p>
                </div>
              ) : (
                <div className={`${b}__history-section`}>
                  <h4 className={`${b}__history-section-title`}>Todas las visitas ({allAppointments.length})</h4>
                  <div className={`${b}__history-table`}>
                    <div className={`${b}__history-thead`}>
                      <span>Ticket</span>
                      <span>Servicio</span>
                      <span>Fecha</span>
                      <span>Horario</span>
                      <span>Profesional</span>
                      <span>Estado</span>
                      <span className={`${b}__history-thead-right`}>Valor</span>
                    </div>
                    {allAppointments.map((apt, idx) => {
                      const statusColors = { confirmed: '#3B82F6', completed: '#10B981', paid: '#8B5CF6', cancelled: '#EF4444', no_show: '#F59E0B' };
                      const statusLabels = { confirmed: 'Confirmada', completed: 'Completada', paid: 'Pagada', cancelled: 'Cancelada', no_show: 'No asistió' };
                      const sc = statusColors[apt.status] || '#6B7280';
                      const dur = apt.duration_minutes || 30;
                      const [h, m] = (apt.time || '0:0').split(':').map(Number);
                      const endMin = h * 60 + m + dur;
                      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
                      return (
                        <div key={apt.id} className={`${b}__history-row ${b}__history-row--${apt.status}`} style={{ animationDelay: `${idx * 0.02}s` }}>
                          <span className={`${b}__history-cell ${b}__history-cell--code`}>
                            {apt.visit_code ? `#${apt.visit_code}` : '—'}
                          </span>
                          <span className={`${b}__history-cell ${b}__history-cell--service`}>
                            {apt.service_name || 'Servicio'}
                          </span>
                          <span className={`${b}__history-cell`}>
                            {formatDate(apt.date)}
                          </span>
                          <span className={`${b}__history-cell ${b}__history-cell--time`}>
                            {apt.time} — {endTime}
                            <small>{dur} min</small>
                          </span>
                          <span className={`${b}__history-cell`}>
                            {apt.staff_name || '—'}
                          </span>
                          <span className={`${b}__history-cell`}>
                            <span className={`${b}__history-badge`} style={{ color: sc, background: `${sc}12` }}>
                              {statusLabels[apt.status] || apt.status}
                            </span>
                          </span>
                          <span className={`${b}__history-cell ${b}__history-cell--price`}>
                            {formatCurrency(apt.price)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className={`${b}__notes`}>
              {addingNote ? (
                <div className={`${b}__notes-edit`}>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Escribe una nota sobre este cliente..."
                    autoFocus
                  />
                  <div className={`${b}__notes-actions`}>
                    <Button variant="ghost" size="sm" onClick={() => { setAddingNote(false); setNewNote(''); }}>
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveNote} disabled={!newNote.trim()}>
                      Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={`${b}__notes-edit-btn`}>
                  <Button variant="ghost" size="sm" onClick={() => setAddingNote(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Agregar nota
                  </Button>
                </div>
              )}

              {notes.length === 0 && !addingNote ? (
                <div className={`${b}__empty`}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <p>Sin notas registradas</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className={`${b}__notes-card`}>
                    <div className={`${b}__notes-card-header`}>
                      <span className={`${b}__notes-author`}>{note.created_by || 'Sistema'}</span>
                      <span className={`${b}__notes-date`}>
                        {note.created_at ? formatDate(note.created_at.split('T')[0]) : ''}
                      </span>
                      <button
                        className={`${b}__notes-delete`}
                        onClick={() => handleDeleteNote(note.id)}
                        aria-label="Eliminar nota"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <p className={`${b}__notes-text`}>{note.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
};

export default ClientDetail;
