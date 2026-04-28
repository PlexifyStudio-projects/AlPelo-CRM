import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import staffService from '../../services/staffService';
import servicesService from '../../services/servicesService';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import EmptyState from '../../components/common/EmptyState/EmptyState';

const b = 'team';

const ROLES = ['Dueño', 'Recepcionista', 'Profesional', 'Bartender', 'Contador'];
const ROLE_META = {
  'Dueño':         { color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)' },
  'Recepcionista': { color: '#06B6D4', gradient: 'linear-gradient(135deg, #06B6D4, #22D3EE)' },
  'Profesional':   { color: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #34D399)' },
  'Bartender':     { color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)' },
  'Contador':      { color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #60A5FA)' },
};
const roleMeta = (r) => ROLE_META[r] || { color: '#64748B', gradient: 'linear-gradient(135deg, #64748B, #94A3B8)' };

const BRE_B_TYPES = [
  { value: 'phone',    label: 'Teléfono' },
  { value: 'document', label: 'Cédula' },
  { value: 'email',    label: 'Correo' },
  { value: 'account',  label: 'Cuenta bancaria' },
];

const DAYS = [
  { id: 0, name: 'Lunes' },
  { id: 1, name: 'Martes' },
  { id: 2, name: 'Miércoles' },
  { id: 3, name: 'Jueves' },
  { id: 4, name: 'Viernes' },
  { id: 5, name: 'Sábado' },
  { id: 6, name: 'Domingo' },
];

const initialsOf = (n) => (n || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};
const fmtTime = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hh = parseInt(h);
  return `${hh % 12 || 12}:${m} ${hh >= 12 ? 'p.m.' : 'a.m.'}`;
};

const Team = () => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('active');

  // Drawer state
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState(null);   // member object
  const [drawerTab, setDrawerTab] = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const photoInputRef = useRef(null);

  // Form data — single source of truth across tabs
  const [form, setForm] = useState({
    name: '', phone: '', email: '', role: 'Profesional', specialty: '',
    bio: '', hire_date: '', is_active: true, color: '#06B6D4',
    skills: [], salary_base: '', bookable_online: true,
  });
  const [skillInput, setSkillInput] = useState('');

  // Credentials
  const [creds, setCreds] = useState({ username: '', password: '' });

  // Bank info
  const [bank, setBank] = useState({
    document_type: 'CC', document_number: '',
    bank_name: '', bank_account_type: 'Ahorros', bank_account_number: '',
    nequi_phone: '', daviplata_phone: '',
    bre_b_key: '', bre_b_key_type: 'phone',
    preferred_payment_method: 'nequi',
  });

  // Schedule + days off
  const [schedule, setSchedule] = useState([]);
  const [daysOff, setDaysOff] = useState([]);
  const [newDayOff, setNewDayOff] = useState({ start_date: '', end_date: '', reason: '' });

  // Loans
  const [loans, setLoans] = useState({ loans: [], summary: { balance: 0, total_pendiente: 0 } });
  const [newLoan, setNewLoan] = useState({ type: 'prestamo', amount: '', date: new Date().toISOString().slice(0, 10), note: '' });

  // Commissions per-service
  const [services, setServices] = useState([]);
  const [serviceCommissions, setServiceCommissions] = useState({}); // { service_id: { is_enabled, commission_type, commission_rate, commission_amount } }
  const [commSummary, setCommSummary] = useState({ services: [], summary: { total_earned: 0, total_revenue: 0, total_visits: 0 } });

  // Clients attended
  const [clientsDetail, setClientsDetail] = useState({ items: [], summary: { total_amount: 0, total_visits: 0, unique_clients: 0 } });
  const [clientsRange, setClientsRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to:   new Date().toISOString().slice(0, 10),
  });

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadList = useCallback(async () => {
    try {
      const data = await staffService.list();
      setMembers(Array.isArray(data) ? data : (data.staff || data.items || []));
    } catch (err) {
      addNotification('Error al cargar equipo: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { loadList(); }, [loadList]);

  // Load services list once for commissions tab
  useEffect(() => {
    servicesService.list().then(setServices).catch(() => setServices([]));
  }, []);

  const filtered = useMemo(() => {
    let list = members.slice();
    if (statusFilter === 'active') list = list.filter(m => m.is_active);
    else if (statusFilter === 'inactive') list = list.filter(m => !m.is_active);
    if (roleFilter !== 'Todos') list = list.filter(m => (m.role || '').toLowerCase() === roleFilter.toLowerCase());
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      list = list.filter(m =>
        (m.name || '').toLowerCase().includes(t) ||
        (m.role || '').toLowerCase().includes(t) ||
        (m.specialty || '').toLowerCase().includes(t) ||
        (m.skills || []).some(s => (s || '').toLowerCase().includes(t))
      );
    }
    return list;
  }, [members, statusFilter, roleFilter, searchTerm]);

  const stats = useMemo(() => {
    const active = members.filter(m => m.is_active);
    const byRole = {};
    active.forEach(m => { const r = m.role || 'Sin rol'; byRole[r] = (byRole[r] || 0) + 1; });
    const ratings = active.map(m => m.rating).filter(Boolean);
    return {
      total: active.length,
      inactive: members.length - active.length,
      byRole,
      avgRating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—',
    };
  }, [members]);

  // ─── DRAWER OPEN / CLOSE ────────────────────────────
  const resetDrawer = () => {
    setEditing(null);
    setDrawerTab('general');
    setForm({
      name: '', phone: '', email: '', role: 'Profesional', specialty: '',
      bio: '', hire_date: '', is_active: true, color: '#06B6D4',
      skills: [], salary_base: '', bookable_online: true,
    });
    setSkillInput('');
    setCreds({ username: '', password: '' });
    setBank({
      document_type: 'CC', document_number: '',
      bank_name: '', bank_account_type: 'Ahorros', bank_account_number: '',
      nequi_phone: '', daviplata_phone: '',
      bre_b_key: '', bre_b_key_type: 'phone',
      preferred_payment_method: 'nequi',
    });
    setSchedule([]);
    setDaysOff([]);
    setLoans({ loans: [], summary: { balance: 0, total_pendiente: 0 } });
    setServiceCommissions({});
    setCommSummary({ services: [], summary: { total_earned: 0, total_revenue: 0, total_visits: 0 } });
    setClientsDetail({ items: [], summary: { total_amount: 0, total_visits: 0, unique_clients: 0 } });
    setPhotoPreview(null);
    setPendingPhoto(null);
  };

  const openCreate = () => {
    resetDrawer();
    setShowDrawer(true);
  };

  const openEdit = async (m, tab = 'general') => {
    resetDrawer();
    setEditing(m);
    setForm({
      name: m.name || '',
      phone: m.phone || '',
      email: m.email || '',
      role: m.role || 'Profesional',
      specialty: m.specialty || '',
      bio: m.bio || '',
      hire_date: m.hire_date || '',
      is_active: m.is_active !== false,
      color: m.color || '#06B6D4',
      skills: m.skills || [],
      salary_base: m.salary_base != null ? String(m.salary_base) : '',
      bookable_online: m.bookable_online !== false,
    });
    setCreds({ username: m.username || '', password: '' });
    setPhotoPreview(m.photo_url || null);
    setDrawerTab(tab);
    setShowDrawer(true);

    // Background fetch additional data
    try {
      const [bankData, sched, off, loanData] = await Promise.allSettled([
        staffService.getBankInfo(m.id),
        staffService.getSchedule(m.id).catch(() => null),
        staffService.getDaysOff(m.id).catch(() => null),
        staffService.getLoans(m.id),
      ]);
      if (bankData.status === 'fulfilled') {
        setBank(prev => ({ ...prev, ...(bankData.value || {}) }));
      }
      if (sched.status === 'fulfilled' && sched.value) {
        setSchedule(sched.value.schedule || sched.value || []);
      }
      if (off.status === 'fulfilled' && off.value) {
        setDaysOff(off.value.days_off || off.value || []);
      }
      if (loanData.status === 'fulfilled' && loanData.value) {
        setLoans(loanData.value);
      }
    } catch { /* silent */ }
  };

  // Lazy-load tab data on demand
  useEffect(() => {
    if (!editing || !showDrawer) return;
    if (drawerTab === 'commissions') {
      // Service-level commission config per staff
      Promise.all(services.map(s =>
        fetch(`${import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api'}/services/${s.id}/commissions`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )).then(results => {
        const map = {};
        results.forEach((data, i) => {
          if (!data) return;
          const svcId = services[i].id;
          const mine = (data.commissions || []).find(c => c.staff_id === editing.id);
          if (mine) map[svcId] = {
            is_enabled: !!mine.is_enabled,
            commission_type: mine.commission_type || 'percentage',
            commission_rate: mine.commission_rate || 0,
            commission_amount: mine.commission_amount || 0,
          };
        });
        setServiceCommissions(map);
      });

      // Earnings summary
      staffService.getCommissionsSummary(editing.id).then(setCommSummary).catch(() => {});
    }
    if (drawerTab === 'clients') {
      staffService.getClientsDetail(editing.id, clientsRange)
        .then(setClientsDetail)
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerTab, editing?.id, showDrawer, services.length]);

  const reloadClients = async () => {
    if (!editing) return;
    try {
      const d = await staffService.getClientsDetail(editing.id, clientsRange);
      setClientsDetail(d);
    } catch (err) { addNotification(err.message, 'error'); }
  };

  // ─── PHOTO ──────────────────────────────────────────
  const handlePhotoSelect = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { addNotification('Imagen muy grande (máx 2MB)', 'error'); return; }
    setPendingPhoto(file);
    const r = new FileReader();
    r.onload = (e) => setPhotoPreview(e.target.result);
    r.readAsDataURL(file);
  };

  // ─── SAVE ───────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name?.trim()) { addNotification('Nombre requerido', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        role: form.role,
        specialty: form.specialty?.trim() || null,
        bio: form.bio?.trim() || null,
        hire_date: form.hire_date || null,
        is_active: !!form.is_active,
        color: form.color,
        skills: form.skills,
        salary_base: form.salary_base ? parseInt(form.salary_base) : null,
        bookable_online: !!form.bookable_online,
      };
      let saved;
      if (editing) saved = await staffService.update(editing.id, payload);
      else saved = await staffService.create(payload);
      const id = saved?.id || editing?.id;

      // Photo (if pending)
      if (pendingPhoto && id) {
        try { await staffService.uploadPhoto(id, pendingPhoto); }
        catch (err) { addNotification('Guardado pero la foto falló: ' + err.message, 'error'); }
      }

      // Credentials (if filled)
      if (creds.username && id) {
        try {
          const credPayload = { username: creds.username };
          if (creds.password) credPayload.password = creds.password;
          await staffService.updateCredentials(id, credPayload);
        } catch (err) { addNotification('Datos básicos guardados, credenciales fallaron: ' + err.message, 'error'); }
      }

      // Bank info (always save what's in state)
      if (id) {
        try { await staffService.updateBankInfo(id, bank); }
        catch (err) { /* silent — partial save */ }
      }

      addNotification(editing ? 'Miembro actualizado' : 'Miembro creado', 'success');
      setShowDrawer(false);
      loadList();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── SKILLS ─────────────────────────────────────────
  const addSkill = () => {
    const s = (skillInput || '').trim();
    if (!s) return;
    if ((form.skills || []).includes(s)) return;
    setForm(prev => ({ ...prev, skills: [...(prev.skills || []), s] }));
    setSkillInput('');
  };
  const removeSkill = (s) => setForm(prev => ({ ...prev, skills: (prev.skills || []).filter(x => x !== s) }));

  // ─── COMMISSION TOGGLE/EDIT ─────────────────────────
  const updateCommissionForService = async (serviceId, patch) => {
    if (!editing) return;
    setServiceCommissions(prev => ({ ...prev, [serviceId]: { ...(prev[serviceId] || { is_enabled: true, commission_type: 'percentage', commission_rate: 0, commission_amount: 0 }), ...patch } }));
    // Save to backend
    const next = { ...(serviceCommissions[serviceId] || {}), ...patch };
    try {
      const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
      // Build payload: must include all enabled staff for this service so we don't wipe others
      const fullRes = await fetch(`${API}/services/${serviceId}/commissions`, { credentials: 'include' });
      const full = fullRes.ok ? await fullRes.json() : { commissions: [] };
      const items = (full.commissions || []).map(c => ({
        staff_id: c.staff_id,
        is_enabled: c.staff_id === editing.id ? next.is_enabled : !!c.is_enabled,
        commission_type: c.staff_id === editing.id ? next.commission_type : c.commission_type,
        commission_rate: c.staff_id === editing.id ? (next.commission_rate || 0) : c.commission_rate,
        commission_amount: c.staff_id === editing.id ? (next.commission_amount || 0) : c.commission_amount,
      }));
      // Make sure our staff is in the list
      if (!items.some(i => i.staff_id === editing.id)) {
        items.push({
          staff_id: editing.id,
          is_enabled: next.is_enabled,
          commission_type: next.commission_type || 'percentage',
          commission_rate: next.commission_rate || 0,
          commission_amount: next.commission_amount || 0,
        });
      }
      await fetch(`${API}/services/${serviceId}/commissions`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
    } catch (err) {
      addNotification('Error al guardar comisión: ' + err.message, 'error');
    }
  };

  // ─── LOANS ──────────────────────────────────────────
  const submitLoan = async () => {
    if (!editing || !newLoan.amount) return;
    try {
      await staffService.addLoan(editing.id, {
        type: newLoan.type,
        amount: parseInt(newLoan.amount),
        date: newLoan.date,
        note: newLoan.note,
      });
      const d = await staffService.getLoans(editing.id);
      setLoans(d);
      setNewLoan({ type: 'prestamo', amount: '', date: new Date().toISOString().slice(0, 10), note: '' });
      addNotification('Movimiento registrado', 'success');
    } catch (err) { addNotification(err.message, 'error'); }
  };

  const deleteLoan = async (loanId) => {
    if (!editing) return;
    try {
      await staffService.removeLoan(editing.id, loanId);
      const d = await staffService.getLoans(editing.id);
      setLoans(d);
    } catch (err) { addNotification(err.message, 'error'); }
  };

  // ─── DAYS OFF ───────────────────────────────────────
  const addDayOff = async () => {
    if (!editing || !newDayOff.start_date) return;
    try {
      await staffService.addDayOff(editing.id, {
        start_date: newDayOff.start_date,
        end_date: newDayOff.end_date || newDayOff.start_date,
        reason: newDayOff.reason || 'Día libre',
      });
      const d = await staffService.getDaysOff(editing.id);
      setDaysOff(d.days_off || d || []);
      setNewDayOff({ start_date: '', end_date: '', reason: '' });
      addNotification('Día libre programado', 'success');
    } catch (err) { addNotification(err.message, 'error'); }
  };

  const removeDayOff = async (dayOffId) => {
    if (!editing) return;
    try {
      await staffService.removeDayOff(editing.id, dayOffId);
      const d = await staffService.getDaysOff(editing.id);
      setDaysOff(d.days_off || d || []);
    } catch (err) { addNotification(err.message, 'error'); }
  };

  // ─── SCHEDULE ───────────────────────────────────────
  const updateScheduleDay = (dayIdx, patch) => {
    setSchedule(prev => {
      const list = [...prev];
      const idx = list.findIndex(s => s.day_of_week === dayIdx);
      if (idx >= 0) list[idx] = { ...list[idx], ...patch };
      else list.push({ day_of_week: dayIdx, is_working: true, start_time: '08:00', end_time: '18:00', ...patch });
      return list;
    });
  };

  const saveScheduleDirect = async () => {
    if (!editing) return;
    try {
      await staffService.saveSchedule(editing.id, schedule);
      addNotification('Horario guardado', 'success');
    } catch (err) { addNotification(err.message, 'error'); }
  };

  // ─── DELETE ─────────────────────────────────────────
  const confirmDeleteAction = async () => {
    if (!deleteConfirm) return;
    try {
      await staffService.remove(deleteConfirm.id);
      addNotification('Miembro eliminado', 'success');
      setDeleteConfirm(null);
      loadList();
    } catch (err) { addNotification(err.message, 'error'); }
  };

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__loading`}>
          <div className={`${b}__spinner`} />
          <span>Cargando equipo...</span>
        </div>
      </div>
    );
  }

  const closeDrawer = () => setShowDrawer(false);

  return (
    <div className={b}>
      {/* ── HERO HEADER ─────────────────────────────── */}
      <div className={`${b}__header`}>
        <div className={`${b}__header-left`}>
          <h1 className={`${b}__title`}>Equipo</h1>
          <p className={`${b}__subtitle`}>{stats.total} activos · {members.length} miembros · {tenant?.name}</p>
        </div>
        <div className={`${b}__header-actions`}>
          <button className={`${b}__add-btn`} onClick={openCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo miembro
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ───────────────────────────────── */}
      <div className={`${b}__stats`}>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{stats.total}</span>
          <span className={`${b}__stat-label`}>Activos</span>
          {stats.inactive > 0 && <span className={`${b}__stat-sub`}>+{stats.inactive} inactivos</span>}
        </div>
        {ROLES.map(role => stats.byRole[role] ? (
          <div key={role} className={`${b}__stat`}>
            <span className={`${b}__stat-value`} style={{ color: roleMeta(role).color }}>{stats.byRole[role]}</span>
            <span className={`${b}__stat-label`}>{role}{stats.byRole[role] !== 1 ? 's' : ''}</span>
          </div>
        ) : null)}
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>★ {stats.avgRating}</span>
          <span className={`${b}__stat-label`}>Rating promedio</span>
        </div>
      </div>

      {/* ── FILTERS ────────────────────────────────── */}
      <div className={`${b}__filters`}>
        <div className={`${b}__search`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Buscar por nombre, rol, especialidad o habilidad..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className={`${b}__status-pills`}>
          {[
            { key: 'active', label: 'Activos', count: stats.total },
            { key: 'inactive', label: 'Inactivos', count: stats.inactive },
            { key: 'all', label: 'Todos', count: members.length },
          ].map(p => (
            <button key={p.key}
              className={`${b}__status-pill ${statusFilter === p.key ? `${b}__status-pill--active` : ''}`}
              onClick={() => setStatusFilter(p.key)}>
              {p.label} <span>{p.count}</span>
            </button>
          ))}
        </div>
        <div className={`${b}__role-tabs`}>
          {['Todos', ...ROLES].map(r => (
            <button key={r}
              className={`${b}__role-tab ${roleFilter === r ? `${b}__role-tab--active` : ''}`}
              style={roleFilter === r && r !== 'Todos' ? { '--role-color': roleMeta(r).color } : {}}
              onClick={() => setRoleFilter(r)}>
              {r}
              {r !== 'Todos' && <span className={`${b}__role-tab-count`}>{stats.byRole[r] || 0}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── GRID ───────────────────────────────────── */}
      <div className={`${b}__content`}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            title="No hay miembros"
            description="Agrega el primer miembro de tu equipo"
            actionLabel="Nuevo miembro"
            onAction={openCreate}
          />
        ) : (
          <div className={`${b}__grid`}>
            {filtered.map(m => {
              const meta = roleMeta(m.role);
              return (
                <div key={m.id}
                  className={`${b}__card ${!m.is_active ? `${b}__card--inactive` : ''}`}
                  onClick={() => openEdit(m)}>
                  <div className={`${b}__card-photo`}>
                    {m.photo_url
                      ? <img src={m.photo_url} alt={m.name} />
                      : <div className={`${b}__card-initials`} style={{ background: meta.gradient }}>{initialsOf(m.name)}</div>}
                    <span className={`${b}__card-status-dot ${m.is_active ? `${b}__card-status-dot--on` : ''}`} title={m.is_active ? 'Activo' : 'Inactivo'} />
                  </div>
                  <div className={`${b}__card-body`}>
                    <h3 className={`${b}__card-name`}>{m.name}</h3>
                    <span className={`${b}__card-role`} style={{ background: `${meta.color}1A`, color: meta.color }}>{m.role}</span>
                    {m.specialty && <span className={`${b}__card-specialty`}>{m.specialty}</span>}
                    <div className={`${b}__card-meta`}>
                      {typeof m.rating === 'number' && (
                        <span className={`${b}__card-rating`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          {m.rating.toFixed(1)}
                        </span>
                      )}
                      {(m.skills || []).length > 0 && (
                        <span className={`${b}__card-skill-count`}>{m.skills.length} habilidad{m.skills.length !== 1 ? 'es' : ''}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DELETE CONFIRM ─────────────────────────── */}
      {deleteConfirm && createPortal(
        <div className={`${b}__confirm-overlay`} onClick={() => setDeleteConfirm(null)}>
          <div className={`${b}__confirm`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__confirm-icon`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <h3 className={`${b}__confirm-title`}>Eliminar miembro</h3>
            <p className={`${b}__confirm-text`}>¿Eliminar <strong>{deleteConfirm.name}</strong>? Esta acción no se puede deshacer.</p>
            <div className={`${b}__confirm-actions`}>
              <button className={`${b}__confirm-cancel`} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className={`${b}__confirm-delete`} onClick={confirmDeleteAction}>Sí, eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── DRAWER ──────────────────────────────────── */}
      {showDrawer && createPortal(
        <div className={`${b}__modal-overlay`} onClick={closeDrawer}>
          <div className={`${b}__modal`} onClick={e => e.stopPropagation()}>

            {/* RAIL */}
            <aside className={`${b}__rail`}>
              <button className={`${b}__rail-close`} onClick={closeDrawer}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                Volver
              </button>
              <div className={`${b}__rail-id`}>
                <span className={`${b}__rail-eyebrow`}>{editing ? 'Editar miembro' : 'Nuevo miembro'}</span>
                <h2 className={`${b}__rail-name`}>{form.name || 'Sin nombre'}</h2>
                <span className={`${b}__rail-role`} style={{ background: roleMeta(form.role).color, color: 'white' }}>{form.role}</span>
              </div>

              <div className={`${b}__rail-preview`}>
                <div className={`${b}__rail-avatar`} style={photoPreview ? {} : { background: roleMeta(form.role).gradient }}>
                  {photoPreview ? <img src={photoPreview} alt="preview" /> : initialsOf(form.name || '?')}
                </div>
                <div className={`${b}__rail-stats`}>
                  <div><span>Estado</span><strong>{form.is_active ? 'Activo' : 'Inactivo'}</strong></div>
                  <div><span>Habilidades</span><strong>{(form.skills || []).length}</strong></div>
                  <div><span>Rating</span><strong>★ {editing?.rating?.toFixed?.(1) || '—'}</strong></div>
                </div>
              </div>

              <nav className={`${b}__rail-nav`}>
                {[
                  { key: 'general',     label: 'General',          sub: 'Datos básicos y acceso', icon: '👤' },
                  { key: 'skills',      label: 'Habilidades',      sub: `${(form.skills || []).length} registradas`, icon: '✨' },
                  { key: 'commissions', label: 'Comisiones',       sub: 'Por servicio + ganancias', icon: '%' },
                  { key: 'schedule',    label: 'Horario y descansos', sub: 'Días, horas y libres', icon: '📅' },
                  { key: 'clients',     label: 'Clientes atendidos', sub: 'Detalle por reserva',  icon: '👥' },
                  { key: 'loans',       label: 'Préstamos y abonos', sub: `Saldo: ${formatCOP(loans?.summary?.balance || 0)}`, icon: '$' },
                  { key: 'bank',        label: 'Datos bancarios',  sub: 'Cuenta · Bre-B · Nequi', icon: '🏦' },
                ].map(item => (
                  <button key={item.key}
                    className={`${b}__rail-nav-item ${drawerTab === item.key ? `${b}__rail-nav-item--active` : ''}`}
                    onClick={() => setDrawerTab(item.key)}>
                    <span className={`${b}__rail-nav-icon`}>{item.icon}</span>
                    <span className={`${b}__rail-nav-text`}>
                      <strong>{item.label}</strong>
                      <span>{item.sub}</span>
                    </span>
                    <svg className={`${b}__rail-nav-arrow`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </nav>

              {editing && (
                <button className={`${b}__rail-danger`} onClick={() => { setShowDrawer(false); setDeleteConfirm(editing); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Eliminar miembro
                </button>
              )}
            </aside>

            {/* PANEL */}
            <div className={`${b}__panel`}>
              <header className={`${b}__panel-bar`}>
                <div>
                  <h3>{
                    drawerTab === 'general' ? 'Información general' :
                    drawerTab === 'skills' ? 'Habilidades y especialidad' :
                    drawerTab === 'commissions' ? 'Comisiones por servicio' :
                    drawerTab === 'schedule' ? 'Horario y descansos' :
                    drawerTab === 'clients' ? 'Clientes atendidos' :
                    drawerTab === 'loans' ? 'Préstamos y abonos' :
                    'Datos bancarios y Bre-B'
                  }</h3>
                  <span>{
                    drawerTab === 'general' ? 'Identidad, foto, rol y acceso a la plataforma' :
                    drawerTab === 'skills' ? 'Define qué sabe hacer este miembro' :
                    drawerTab === 'commissions' ? `${commSummary?.summary?.total_visits || 0} servicios completados · ${formatCOP(commSummary?.summary?.total_earned || 0)} ganados` :
                    drawerTab === 'schedule' ? 'Horario semanal y días libres programados' :
                    drawerTab === 'clients' ? `${clientsDetail?.summary?.total_visits || 0} servicios · ${clientsDetail?.summary?.unique_clients || 0} clientes únicos · ${formatCOP(clientsDetail?.summary?.total_amount || 0)}` :
                    drawerTab === 'loans' ? `Saldo pendiente: ${formatCOP(loans?.summary?.balance || 0)}` :
                    'Información para transferencias y nómina'
                  }</span>
                </div>
              </header>

              <div className={`${b}__modal-body`}>
                {/* ─── GENERAL ─── */}
                {drawerTab === 'general' && (
                  <div className={`${b}__sec-stack`}>
                    <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoSelect(e.target.files?.[0])} />

                    {/* Hero */}
                    <section className={`${b}__sec ${b}__sec--hero`}>
                      <div className={`${b}__hero-photo`}>
                        {photoPreview ? (
                          <>
                            <img src={photoPreview} alt="preview" />
                            <button type="button" className={`${b}__hero-photo-edit`} onClick={() => photoInputRef.current?.click()}>Cambiar foto</button>
                          </>
                        ) : (
                          <button type="button" className={`${b}__hero-photo-empty`} onClick={() => photoInputRef.current?.click()}>
                            <div className={`${b}__hero-photo-empty-icon`} style={{ background: roleMeta(form.role).gradient }}>
                              {form.name ? initialsOf(form.name) : '+'}
                            </div>
                            <strong>Subir foto</strong>
                            <span>Cuadrada · máx 2MB</span>
                          </button>
                        )}
                      </div>
                      <div className={`${b}__hero-form`}>
                        <div className={`${b}__field ${b}__field--lg`}>
                          <label>Nombre completo *</label>
                          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Juan Pérez" />
                        </div>
                        <div className={`${b}__field-row`}>
                          <div className={`${b}__field`}>
                            <label>Rol *</label>
                            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div className={`${b}__field`}>
                            <label>Especialidad</label>
                            <input type="text" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="Ej: Color, barba, manicure..." />
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Contact + dates */}
                    <section className={`${b}__sec`}>
                      <h4 className={`${b}__sec-title`}>Contacto</h4>
                      <div className={`${b}__field-row`}>
                        <div className={`${b}__field`}><label>Teléfono</label><input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="3001234567" /></div>
                        <div className={`${b}__field`}><label>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" /></div>
                        <div className={`${b}__field`}><label>Fecha de ingreso</label><input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} /></div>
                      </div>
                    </section>

                    {/* Salary + bookable + status */}
                    <section className={`${b}__sec`}>
                      <h4 className={`${b}__sec-title`}>Configuración</h4>
                      <div className={`${b}__field-row`}>
                        <div className={`${b}__field`}>
                          <label>Salario base (COP)</label>
                          <input type="number" value={form.salary_base} onChange={e => setForm({ ...form, salary_base: e.target.value })} placeholder="0 = sin asignar" />
                        </div>
                        <div className={`${b}__field`}>
                          <label>Color (calendario)</label>
                          <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ height: '42px' }} />
                        </div>
                      </div>
                      <div className={`${b}__toggle-row`}>
                        <div>
                          <strong>Activo</strong>
                          <p>Aparece en agenda, pagos y reportes.</p>
                        </div>
                        <button type="button" className={`${b}__toggle ${form.is_active ? `${b}__toggle--on` : ''}`}
                          onClick={() => setForm({ ...form, is_active: !form.is_active })}>
                          <span className={`${b}__toggle-knob`} />
                        </button>
                      </div>
                      <div className={`${b}__toggle-row`}>
                        <div>
                          <strong>Reservas online</strong>
                          <p>Si está apagado no aparece en el booking público.</p>
                        </div>
                        <button type="button" className={`${b}__toggle ${form.bookable_online ? `${b}__toggle--on` : ''}`}
                          onClick={() => setForm({ ...form, bookable_online: !form.bookable_online })}>
                          <span className={`${b}__toggle-knob`} />
                        </button>
                      </div>
                    </section>

                    {/* Bio */}
                    <section className={`${b}__sec`}>
                      <h4 className={`${b}__sec-title`}>Biografía</h4>
                      <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Texto visible en booking online (opcional)..." rows={3} className={`${b}__textarea`} />
                    </section>

                    {/* Acceso plataforma */}
                    <section className={`${b}__sec ${b}__sec--credentials`}>
                      <h4 className={`${b}__sec-title`}>Acceso a la plataforma</h4>
                      <p className={`${b}__sec-hint`}>Si llenas estos campos, el miembro podrá entrar al portal con sus propias credenciales.</p>
                      <div className={`${b}__field-row`}>
                        <div className={`${b}__field`}>
                          <label>Usuario</label>
                          <input type="text" value={creds.username} onChange={e => setCreds({ ...creds, username: e.target.value })} placeholder="ej: juanperez" />
                        </div>
                        <div className={`${b}__field`}>
                          <label>{editing && editing.username ? 'Cambiar contraseña' : 'Contraseña'}</label>
                          <input type="password" value={creds.password} onChange={e => setCreds({ ...creds, password: e.target.value })} placeholder={editing && editing.username ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'} />
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {/* ─── SKILLS ─── */}
                {drawerTab === 'skills' && (
                  <div className={`${b}__sec-stack`}>
                    <section className={`${b}__sec`}>
                      <h4 className={`${b}__sec-title`}>Habilidades</h4>
                      <p className={`${b}__sec-hint`}>Etiquetas que ayudan a filtrar y mostrar lo que sabe hacer.</p>
                      <div className={`${b}__skill-input`}>
                        <input type="text" value={skillInput} onChange={e => setSkillInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                          placeholder="Ej: degradado, color, manicure japonés..." />
                        <button type="button" onClick={addSkill}>+ Agregar</button>
                      </div>
                      <div className={`${b}__skill-list`}>
                        {(form.skills || []).length === 0
                          ? <span className={`${b}__skill-empty`}>Sin habilidades registradas</span>
                          : (form.skills || []).map(s => (
                            <span key={s} className={`${b}__skill-chip`}>
                              {s}
                              <button type="button" onClick={() => removeSkill(s)}>×</button>
                            </span>
                          ))}
                      </div>
                    </section>
                  </div>
                )}

                {/* ─── COMMISSIONS ─── */}
                {drawerTab === 'commissions' && (
                  <div className={`${b}__sec-stack`}>
                    {!editing ? (
                      <section className={`${b}__sec`}>
                        <p className={`${b}__sec-hint`}>Guarda el miembro primero para configurar comisiones.</p>
                      </section>
                    ) : (
                      <>
                        <section className={`${b}__sec ${b}__sec--earnings`}>
                          <div className={`${b}__earn-grid`}>
                            <div className={`${b}__earn-card`}>
                              <span>Ganado este mes</span>
                              <strong>{formatCOP(commSummary?.summary?.total_earned || 0)}</strong>
                            </div>
                            <div className={`${b}__earn-card`}>
                              <span>Servicios</span>
                              <strong>{commSummary?.summary?.total_visits || 0}</strong>
                            </div>
                            <div className={`${b}__earn-card`}>
                              <span>Ingresos generados</span>
                              <strong>{formatCOP(commSummary?.summary?.total_revenue || 0)}</strong>
                            </div>
                          </div>
                        </section>

                        <section className={`${b}__sec`}>
                          <h4 className={`${b}__sec-title`}>Comisión por servicio</h4>
                          <p className={`${b}__sec-hint`}>Activa los servicios que realiza y define el porcentaje o monto fijo.</p>
                          <div className={`${b}__comm-list`}>
                            {services.length === 0 && <div className={`${b}__skill-empty`}>No hay servicios registrados</div>}
                            {services.map(svc => {
                              const cfg = serviceCommissions[svc.id] || { is_enabled: false, commission_type: 'percentage', commission_rate: 0, commission_amount: 0 };
                              const earn = cfg.commission_type === 'fixed'
                                ? (cfg.commission_amount || 0)
                                : Math.round((svc.price || 0) * (cfg.commission_rate || 0));
                              return (
                                <div key={svc.id} className={`${b}__comm-row ${cfg.is_enabled ? `${b}__comm-row--on` : ''}`}>
                                  <div className={`${b}__comm-svc`}>
                                    <strong>{svc.name}</strong>
                                    <span>{formatCOP(svc.price)} · {svc.category || 'Sin categoría'}</span>
                                  </div>
                                  {cfg.is_enabled && (
                                    <>
                                      <div className={`${b}__comm-type`}>
                                        <button type="button" className={cfg.commission_type === 'percentage' ? `${b}__comm-type-btn--active` : ''}
                                          onClick={() => updateCommissionForService(svc.id, { commission_type: 'percentage' })}>%</button>
                                        <button type="button" className={cfg.commission_type === 'fixed' ? `${b}__comm-type-btn--active` : ''}
                                          onClick={() => updateCommissionForService(svc.id, { commission_type: 'fixed' })}>$</button>
                                      </div>
                                      <div className={`${b}__comm-input`}>
                                        {cfg.commission_type === 'percentage' ? (
                                          <>
                                            <input type="number" min="0" max="100" value={Math.round((cfg.commission_rate || 0) * 100)}
                                              onChange={e => updateCommissionForService(svc.id, { commission_rate: Math.min(100, Math.max(0, Number(e.target.value))) / 100 })} />
                                            <span>%</span>
                                          </>
                                        ) : (
                                          <>
                                            <span>$</span>
                                            <input type="number" min="0" value={cfg.commission_amount || 0}
                                              onChange={e => updateCommissionForService(svc.id, { commission_amount: Math.max(0, Number(e.target.value)) })} />
                                          </>
                                        )}
                                      </div>
                                      <div className={`${b}__comm-earn`}>
                                        <span>Gana</span>
                                        <strong>{formatCOP(earn)}</strong>
                                      </div>
                                    </>
                                  )}
                                  {!cfg.is_enabled && <span className={`${b}__comm-disabled`}>No realiza este servicio</span>}
                                  <button type="button" className={`${b}__toggle ${cfg.is_enabled ? `${b}__toggle--on` : ''}`}
                                    onClick={() => updateCommissionForService(svc.id, { is_enabled: !cfg.is_enabled })}>
                                    <span className={`${b}__toggle-knob`} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      </>
                    )}
                  </div>
                )}

                {/* ─── SCHEDULE ─── */}
                {drawerTab === 'schedule' && (
                  <div className={`${b}__sec-stack`}>
                    {!editing ? (
                      <section className={`${b}__sec`}><p className={`${b}__sec-hint`}>Guarda el miembro primero.</p></section>
                    ) : (
                      <>
                        <section className={`${b}__sec`}>
                          <div className={`${b}__sec-head-row`}>
                            <div>
                              <h4 className={`${b}__sec-title`}>Horario semanal</h4>
                              <p className={`${b}__sec-hint`}>Configura los días y horas en que trabaja.</p>
                            </div>
                            <button type="button" className={`${b}__btn-primary`} onClick={saveScheduleDirect}>Guardar horario</button>
                          </div>
                          <div className={`${b}__sched-list`}>
                            {DAYS.map(day => {
                              const s = schedule.find(x => x.day_of_week === day.id) || { day_of_week: day.id, is_working: false, start_time: '08:00', end_time: '18:00' };
                              return (
                                <div key={day.id} className={`${b}__sched-row ${s.is_working ? `${b}__sched-row--on` : ''}`}>
                                  <span className={`${b}__sched-day`}>{day.name}</span>
                                  <button type="button" className={`${b}__toggle ${s.is_working ? `${b}__toggle--on` : ''}`}
                                    onClick={() => updateScheduleDay(day.id, { is_working: !s.is_working })}>
                                    <span className={`${b}__toggle-knob`} />
                                  </button>
                                  {s.is_working && (
                                    <>
                                      <input type="time" value={s.start_time || ''} onChange={e => updateScheduleDay(day.id, { start_time: e.target.value })} />
                                      <span className={`${b}__sched-arrow`}>→</span>
                                      <input type="time" value={s.end_time || ''} onChange={e => updateScheduleDay(day.id, { end_time: e.target.value })} />
                                    </>
                                  )}
                                  {!s.is_working && <span className={`${b}__sched-off`}>Día libre</span>}
                                </div>
                              );
                            })}
                          </div>
                        </section>

                        <section className={`${b}__sec`}>
                          <h4 className={`${b}__sec-title`}>Días libres programados</h4>
                          <p className={`${b}__sec-hint`}>Vacaciones, citas médicas o cualquier ausencia puntual.</p>
                          <div className={`${b}__day-off-form`}>
                            <input type="date" value={newDayOff.start_date} onChange={e => setNewDayOff({ ...newDayOff, start_date: e.target.value })} placeholder="Inicio" />
                            <input type="date" value={newDayOff.end_date} onChange={e => setNewDayOff({ ...newDayOff, end_date: e.target.value })} placeholder="Fin (opcional)" />
                            <input type="text" value={newDayOff.reason} onChange={e => setNewDayOff({ ...newDayOff, reason: e.target.value })} placeholder="Motivo (opcional)" />
                            <button type="button" className={`${b}__btn-primary`} onClick={addDayOff}>Programar</button>
                          </div>
                          <div className={`${b}__day-off-list`}>
                            {daysOff.length === 0 && <span className={`${b}__skill-empty`}>Sin días libres registrados</span>}
                            {daysOff.map(d => (
                              <div key={d.id} className={`${b}__day-off-item`}>
                                <span>{fmtDate(d.start_date)}{d.end_date && d.end_date !== d.start_date ? ` → ${fmtDate(d.end_date)}` : ''}</span>
                                <span className={`${b}__day-off-reason`}>{d.reason || 'Sin motivo'}</span>
                                <button type="button" onClick={() => removeDayOff(d.id)}>×</button>
                              </div>
                            ))}
                          </div>
                        </section>
                      </>
                    )}
                  </div>
                )}

                {/* ─── CLIENTS ATENDIDOS ─── */}
                {drawerTab === 'clients' && (
                  <div className={`${b}__sec-stack`}>
                    {!editing ? (
                      <section className={`${b}__sec`}><p className={`${b}__sec-hint`}>Guarda el miembro primero.</p></section>
                    ) : (
                      <>
                        <section className={`${b}__sec`}>
                          <div className={`${b}__sec-head-row`}>
                            <div>
                              <h4 className={`${b}__sec-title`}>Filtrar por fecha</h4>
                            </div>
                            <div className={`${b}__date-range`}>
                              <input type="date" value={clientsRange.from} onChange={e => setClientsRange({ ...clientsRange, from: e.target.value })} />
                              <span>→</span>
                              <input type="date" value={clientsRange.to} onChange={e => setClientsRange({ ...clientsRange, to: e.target.value })} />
                              <button type="button" className={`${b}__btn-primary`} onClick={reloadClients}>Aplicar</button>
                            </div>
                          </div>
                        </section>

                        <section className={`${b}__sec`}>
                          <div className={`${b}__earn-grid`}>
                            <div className={`${b}__earn-card`}><span>Servicios</span><strong>{clientsDetail?.summary?.total_visits || 0}</strong></div>
                            <div className={`${b}__earn-card`}><span>Clientes únicos</span><strong>{clientsDetail?.summary?.unique_clients || 0}</strong></div>
                            <div className={`${b}__earn-card`}><span>Ingresos</span><strong>{formatCOP(clientsDetail?.summary?.total_amount || 0)}</strong></div>
                          </div>
                        </section>

                        <section className={`${b}__sec`}>
                          <h4 className={`${b}__sec-title`}>Detalle de servicios</h4>
                          <div className={`${b}__clients-table`}>
                            <div className={`${b}__clients-thead`}>
                              <span>Fecha</span><span>Cliente</span><span>Ticket</span><span>Servicio</span><span>Visitas</span><span>Total</span>
                            </div>
                            {(clientsDetail?.items || []).length === 0 && <div className={`${b}__skill-empty`}>Sin servicios en este rango</div>}
                            {(clientsDetail?.items || []).map(it => (
                              <div key={it.id} className={`${b}__clients-row`}>
                                <span>{fmtDate(it.date)}</span>
                                <span><strong>{it.client_name}</strong>{it.client_phone && <em>{it.client_phone}</em>}</span>
                                <span className={`${b}__client-ticket`}>{it.client_ticket || '—'}</span>
                                <span>{it.service_name}</span>
                                <span>{it.client_visits || 1}</span>
                                <span className={`${b}__client-amount`}>{formatCOP(it.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      </>
                    )}
                  </div>
                )}

                {/* ─── LOANS ─── */}
                {drawerTab === 'loans' && (
                  <div className={`${b}__sec-stack`}>
                    {!editing ? (
                      <section className={`${b}__sec`}><p className={`${b}__sec-hint`}>Guarda el miembro primero.</p></section>
                    ) : (
                      <>
                        <section className={`${b}__sec`}>
                          <div className={`${b}__earn-grid`}>
                            <div className={`${b}__earn-card`}><span>Pendientes</span><strong style={{ color: '#EF4444' }}>{formatCOP(loans?.summary?.total_pendiente || 0)}</strong></div>
                            <div className={`${b}__earn-card`}><span>Abonos</span><strong style={{ color: '#10B981' }}>{formatCOP(loans?.summary?.total_abonos || 0)}</strong></div>
                            <div className={`${b}__earn-card`}><span>Saldo</span><strong>{formatCOP(loans?.summary?.balance || 0)}</strong></div>
                          </div>
                        </section>

                        <section className={`${b}__sec`}>
                          <h4 className={`${b}__sec-title`}>Registrar movimiento</h4>
                          <div className={`${b}__loan-form`}>
                            <select value={newLoan.type} onChange={e => setNewLoan({ ...newLoan, type: e.target.value })}>
                              <option value="prestamo">Préstamo (le doy)</option>
                              <option value="abono">Abono (descuenta)</option>
                            </select>
                            <input type="number" value={newLoan.amount} onChange={e => setNewLoan({ ...newLoan, amount: e.target.value })} placeholder="Monto COP" />
                            <input type="date" value={newLoan.date} onChange={e => setNewLoan({ ...newLoan, date: e.target.value })} />
                            <input type="text" value={newLoan.note} onChange={e => setNewLoan({ ...newLoan, note: e.target.value })} placeholder="Nota (opcional)" />
                            <button type="button" className={`${b}__btn-primary`} onClick={submitLoan}>Registrar</button>
                          </div>
                        </section>

                        <section className={`${b}__sec`}>
                          <h4 className={`${b}__sec-title`}>Historial</h4>
                          <div className={`${b}__loan-list`}>
                            {(loans?.loans || []).length === 0 && <span className={`${b}__skill-empty`}>Sin movimientos</span>}
                            {(loans?.loans || []).map(l => (
                              <div key={l.id} className={`${b}__loan-item`}>
                                <span className={`${b}__loan-tag`} style={{ background: l.type === 'prestamo' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: l.type === 'prestamo' ? '#EF4444' : '#10B981' }}>
                                  {l.type === 'prestamo' ? 'Préstamo' : 'Abono'}
                                </span>
                                <span className={`${b}__loan-amount`} style={{ color: l.type === 'prestamo' ? '#EF4444' : '#10B981' }}>
                                  {l.type === 'prestamo' ? '−' : '+'}{formatCOP(l.amount)}
                                </span>
                                <span>{fmtDate(l.date)}</span>
                                <span className={`${b}__loan-note`}>{l.note || '—'}</span>
                                <button type="button" onClick={() => deleteLoan(l.id)}>×</button>
                              </div>
                            ))}
                          </div>
                        </section>
                      </>
                    )}
                  </div>
                )}

                {/* ─── BANK ─── */}
                {drawerTab === 'bank' && (
                  <div className={`${b}__sec-stack`}>
                    <section className={`${b}__sec`}>
                      <h4 className={`${b}__sec-title`}>Identificación</h4>
                      <div className={`${b}__field-row`}>
                        <div className={`${b}__field`}>
                          <label>Tipo de documento</label>
                          <select value={bank.document_type || 'CC'} onChange={e => setBank({ ...bank, document_type: e.target.value })}>
                            <option value="CC">CC</option><option value="CE">CE</option><option value="NIT">NIT</option>
                          </select>
                        </div>
                        <div className={`${b}__field`}>
                          <label>Número de documento</label>
                          <input type="text" value={bank.document_number || ''} onChange={e => setBank({ ...bank, document_number: e.target.value })} />
                        </div>
                      </div>
                    </section>

                    <section className={`${b}__sec ${b}__sec--breb`}>
                      <h4 className={`${b}__sec-title`}>Bre-B (transferencia instantánea)</h4>
                      <p className={`${b}__sec-hint`}>La forma más rápida de transferir. Define la llave y su tipo.</p>
                      <div className={`${b}__field-row`}>
                        <div className={`${b}__field`}>
                          <label>Tipo de llave</label>
                          <select value={bank.bre_b_key_type || 'phone'} onChange={e => setBank({ ...bank, bre_b_key_type: e.target.value })}>
                            {BRE_B_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div className={`${b}__field`}>
                          <label>Llave Bre-B</label>
                          <input type="text" value={bank.bre_b_key || ''} onChange={e => setBank({ ...bank, bre_b_key: e.target.value })} placeholder="3001234567 / 1234567890 / correo@ejemplo.com" />
                        </div>
                      </div>
                    </section>

                    <section className={`${b}__sec`}>
                      <h4 className={`${b}__sec-title`}>Cuenta bancaria</h4>
                      <div className={`${b}__field-row`}>
                        <div className={`${b}__field`}>
                          <label>Banco</label>
                          <input type="text" value={bank.bank_name || ''} onChange={e => setBank({ ...bank, bank_name: e.target.value })} placeholder="Bancolombia, Davivienda..." />
                        </div>
                        <div className={`${b}__field`}>
                          <label>Tipo de cuenta</label>
                          <select value={bank.bank_account_type || 'Ahorros'} onChange={e => setBank({ ...bank, bank_account_type: e.target.value })}>
                            <option value="Ahorros">Ahorros</option><option value="Corriente">Corriente</option>
                          </select>
                        </div>
                        <div className={`${b}__field`}>
                          <label>Número de cuenta</label>
                          <input type="text" value={bank.bank_account_number || ''} onChange={e => setBank({ ...bank, bank_account_number: e.target.value })} />
                        </div>
                      </div>
                    </section>

                    <section className={`${b}__sec`}>
                      <h4 className={`${b}__sec-title`}>Billeteras digitales</h4>
                      <div className={`${b}__field-row`}>
                        <div className={`${b}__field`}>
                          <label>Nequi (teléfono)</label>
                          <input type="tel" value={bank.nequi_phone || ''} onChange={e => setBank({ ...bank, nequi_phone: e.target.value })} placeholder="3001234567" />
                        </div>
                        <div className={`${b}__field`}>
                          <label>Daviplata (teléfono)</label>
                          <input type="tel" value={bank.daviplata_phone || ''} onChange={e => setBank({ ...bank, daviplata_phone: e.target.value })} placeholder="3001234567" />
                        </div>
                      </div>
                    </section>

                    <section className={`${b}__sec`}>
                      <h4 className={`${b}__sec-title`}>Método preferido para nómina</h4>
                      <div className={`${b}__pref-pills`}>
                        {[
                          { v: 'bre_b', label: 'Bre-B' },
                          { v: 'nequi', label: 'Nequi' },
                          { v: 'daviplata', label: 'Daviplata' },
                          { v: 'bancolombia', label: 'Banco' },
                          { v: 'efectivo', label: 'Efectivo' },
                        ].map(p => (
                          <button key={p.v} type="button"
                            className={`${b}__pref-pill ${bank.preferred_payment_method === p.v ? `${b}__pref-pill--active` : ''}`}
                            onClick={() => setBank({ ...bank, preferred_payment_method: p.v })}>{p.label}</button>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </div>

              <div className={`${b}__modal-footer`}>
                <span>{form.role}{form.salary_base && ` · Salario base ${formatCOP(parseInt(form.salary_base))}`}</span>
                <div className={`${b}__modal-footer-actions`}>
                  <button className={`${b}__btn-cancel`} onClick={closeDrawer}>Cancelar</button>
                  <button className={`${b}__btn-save`} onClick={handleSave} disabled={submitting}>
                    {submitting ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear miembro')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Team;
