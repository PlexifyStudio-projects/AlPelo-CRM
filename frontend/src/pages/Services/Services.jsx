import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import servicesService from '../../services/servicesService';
import staffService from '../../services/staffService';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import EmptyState from '../../components/common/EmptyState/EmptyState';

const b = 'services';

const GenericServiceIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" />
  </svg>
);

const CATEGORY_META = {
  'Barbería': {
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V4h4l6 8-6 8H4z" /><path d="M14 20V4h4l4 8-4 8h-4z" /></svg>),
    color: '#2D5A3D',
    gradient: 'linear-gradient(135deg, #2D5A3D 0%, #3D7A52 100%)',
  },
  'Arte en Uñas': {
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6m0 8v6M2 12h6m8 0h6" /><circle cx="12" cy="12" r="3" /></svg>),
    color: '#E05292',
    gradient: 'linear-gradient(135deg, #E05292 0%, #F472B6 100%)',
  },
  'Peluquería': {
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C7 2 3 6 3 11c0 3 1.5 5.5 4 7v4h10v-4c2.5-1.5 4-4 4-7 0-5-4-9-9-9z" /><path d="M9 22h6" /></svg>),
    color: '#C9A84C',
    gradient: 'linear-gradient(135deg, #C9A84C 0%, #E4CC7A 100%)',
  },
  'Tratamientos Capilares': {
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7c3-2 6-3 9-3s6 1 9 3" /></svg>),
    color: '#60A5FA',
    gradient: 'linear-gradient(135deg, #60A5FA 0%, #93C5FD 100%)',
  },
  'Color': {
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /></svg>),
    color: '#A78BFA',
    gradient: 'linear-gradient(135deg, #A78BFA 0%, #C4B5FD 100%)',
  },
};

const generateCategoryColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  const color = `hsl(${hue}, 65%, 45%)`;
  const light = `hsl(${hue}, 65%, 55%)`;
  return { color, gradient: `linear-gradient(135deg, ${color} 0%, ${light} 100%)` };
};

const getCategoryMeta = (cat) => {
  if (CATEGORY_META[cat]) return CATEGORY_META[cat];
  const { color, gradient } = generateCategoryColor(cat || 'Sin categoría');
  return { icon: <GenericServiceIcon />, color, gradient };
};

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const formatDuration = (mins, serviceType) => {
  if (!mins) return '—';
  if (serviceType === 'paquete') {
    if (mins >= 365) return `${Math.round(mins / 365)} año${mins >= 730 ? 's' : ''}`;
    if (mins >= 30) return `${Math.round(mins / 30)} mes${mins >= 60 ? 'es' : ''}`;
    return `${mins} días`;
  }
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
};

const SERVICE_TYPE_META = {
  cita:    { label: 'Cita',    color: '#3B82F6', durationLabel: 'Duración (min)' },
  paquete: { label: 'Paquete', color: '#8B5CF6', durationLabel: 'Vigencia (días)' },
  reserva: { label: 'Reserva', color: '#F59E0B', durationLabel: 'Duración (min)' },
};

// Common time presets for fast picking (en minutos)
const TIME_PRESETS = [10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180];

const initialsOf = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const AVATAR_COLORS = ['#2D5A3D','#3B82F6','#E05292','#C9A84C','#8B5CF6','#F97316','#14B8A6','#06B6D4','#EF4444','#6366F1','#059669','#D946EF','#0EA5E9'];
const colorForName = (name) => AVATAR_COLORS[((name || '').charCodeAt(0) || 0) % AVATAR_COLORS.length];

const Services = () => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();

  // ─── DATA ────────────────────────────────────────────
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingActive, setTogglingActive] = useState(null);

  // ─── FILTERS ────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'inactive' | 'all'

  // ─── MODAL ──────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [modalTab, setModalTab] = useState('basic'); // basic | commissions | advanced
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', category: '', service_type: 'cita', price: '',
    duration_minutes: '', description: '', staff_ids: [], ai_mode: 'auto', is_active: true,
  });
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const photoInputRef = useRef(null);

  // ─── COMMISSIONS ────────────────────────────────────
  const [commData, setCommData] = useState([]);
  const [commLoading, setCommLoading] = useState(false);
  const [commSearch, setCommSearch] = useState('');
  const [commDirty, setCommDirty] = useState(false);

  // ─── DELETE CONFIRM ─────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ─── DISCARD CHANGES CONFIRM ────────────────────────
  const [discardConfirm, setDiscardConfirm] = useState(false);

  // ─── IMPORT ─────────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importInputRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const [svcList, staffList] = await Promise.all([
        servicesService.list(),
        staffService.list(),
      ]);
      setServices(svcList);
      setStaff(staffList);
    } catch (err) {
      addNotification('Error al cargar servicios: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { loadData(); }, [loadData]);

  // Deep-link from InvoiceDetail: open commissions tab on a specific service
  useEffect(() => {
    if (!services || services.length === 0) return;
    try {
      const raw = sessionStorage.getItem('services:open_commission');
      if (!raw) return;
      const data = JSON.parse(raw);
      sessionStorage.removeItem('services:open_commission');
      if (data.ts && Date.now() - data.ts > 120000) return;
      const target = services.find((s) => s.id === data.service_id);
      if (target) {
        openEditModal(target, 'commissions');
        if (data.highlight_staff_id) {
          setTimeout(() => {
            const el = document.querySelector(`[data-comm-staff-id="${data.highlight_staff_id}"]`);
            if (el) {
              el.classList.add(`${b}__comm-row--pulse`);
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => el.classList.remove(`${b}__comm-row--pulse`), 2400);
            }
          }, 350);
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const existingCategories = useMemo(() => [...new Set(services.map(s => s.category).filter(Boolean))], [services]);
  const categories = useMemo(() => ['Todos', ...existingCategories], [existingCategories]);

  const filtered = useMemo(() => {
    let list = services.slice();
    if (statusFilter === 'active') list = list.filter(s => s.is_active);
    else if (statusFilter === 'inactive') list = list.filter(s => !s.is_active);
    if (activeCategory !== 'Todos') list = list.filter(s => s.category === activeCategory);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.category || '').toLowerCase().includes(term) ||
        (s.staff_names || []).some(n => (n || '').toLowerCase().includes(term))
      );
    }
    return list;
  }, [services, activeCategory, searchTerm, statusFilter]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const key = s.category || 'Sin categoría';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    const order = Object.keys(CATEGORY_META);
    const sorted = {};
    order.forEach(cat => { if (groups[cat]) sorted[cat] = groups[cat]; });
    Object.keys(groups).sort().forEach(cat => { if (!sorted[cat]) sorted[cat] = groups[cat]; });
    return sorted;
  }, [filtered]);

  const stats = useMemo(() => {
    const active = services.filter(s => s.is_active);
    return {
      total: active.length,
      categories: [...new Set(active.map(s => s.category))].length,
      avgPrice: active.length ? Math.round(active.reduce((sum, s) => sum + (s.price || 0), 0) / active.length) : 0,
      priceRange: active.length
        ? { min: Math.min(...active.map(s => s.price || 0)), max: Math.max(...active.map(s => s.price || 0)) }
        : { min: 0, max: 0 },
      inactive: services.length - active.length,
    };
  }, [services]);

  // ─── MODAL HELPERS ───────────────────────────────────
  const resetModalState = () => {
    setEditingService(null);
    setModalTab('basic');
    setFormData({
      name: '', category: '', service_type: 'cita', price: '',
      duration_minutes: '', description: '', staff_ids: [], ai_mode: 'auto', is_active: true,
    });
    setNewCategoryMode(false);
    setPhotoPreview(null);
    setPendingPhotoFile(null);
    setCommData([]);
    setCommSearch('');
    setCommDirty(false);
  };

  const openCreateModal = () => {
    resetModalState();
    setShowModal(true);
  };

  const openEditModal = async (svc, tab = 'basic') => {
    resetModalState();
    setEditingService(svc);
    setFormData({
      name: svc.name || '',
      category: svc.category || '',
      service_type: svc.service_type || 'cita',
      price: String(svc.price ?? ''),
      duration_minutes: svc.duration_minutes ? String(svc.duration_minutes) : '',
      description: svc.description || '',
      staff_ids: svc.staff_ids || [],
      ai_mode: svc.ai_mode || 'auto',
      is_active: svc.is_active !== false,
    });
    setNewCategoryMode(svc.category && !existingCategories.includes(svc.category));
    setPhotoPreview(svc.photo_url || null);
    setModalTab(tab);
    setShowModal(true);
    await loadCommissions(svc.id);
  };

  const closeModal = () => {
    if (commDirty) {
      setDiscardConfirm(true);
      return;
    }
    setShowModal(false);
  };

  const confirmDiscard = () => {
    setDiscardConfirm(false);
    setShowModal(false);
  };

  const loadCommissions = async (svcId) => {
    setCommLoading(true);
    try {
      const data = await servicesService.getCommissions(svcId);
      const items = (data.commissions || []).map(c => ({
        staff_id: c.staff_id,
        staff_name: c.staff_name,
        staff_role: c.staff_role,
        staff_photo_url: c.staff_photo_url,
        is_enabled: !!c.is_enabled,
        commission_type: c.commission_type || 'percentage',
        commission_rate: c.commission_rate || 0,
        commission_amount: c.commission_amount || 0,
      }));
      setCommData(items);
      setCommDirty(false);
    } catch (err) {
      addNotification(err.message || 'Error al cargar comisiones', 'error');
      setCommData([]);
    } finally {
      setCommLoading(false);
    }
  };

  const updateComm = (staffId, patch) => {
    setCommData(prev => prev.map(c => c.staff_id === staffId ? { ...c, ...patch } : c));
    setCommDirty(true);
  };

  const handlePhotoSelect = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addNotification('Imagen muy grande (máx 2MB)', 'error');
      return;
    }
    setPendingPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setPhotoPreview(null);
    setPendingPhotoFile(null);
    if (editingService?.photo_url) {
      try { await servicesService.deletePhoto(editingService.id); } catch { /* silent */ }
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!formData.name?.trim()) { addNotification('Nombre requerido', 'error'); return; }
    if (!formData.category?.trim()) { addNotification('Categoría requerida', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        service_type: formData.service_type || 'cita',
        price: parseInt(formData.price) || 0,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        description: formData.description?.trim() || null,
        staff_ids: formData.staff_ids || [],
        ai_mode: formData.ai_mode || 'auto',
        is_active: !!formData.is_active,
      };
      let saved;
      if (editingService) {
        saved = await servicesService.update(editingService.id, payload);
      } else {
        saved = await servicesService.create(payload);
      }
      // Photo upload (after we have an ID)
      if (pendingPhotoFile && saved?.id) {
        try { await servicesService.uploadPhoto(saved.id, pendingPhotoFile); }
        catch (err) { addNotification('Servicio guardado pero la foto falló: ' + err.message, 'error'); }
      }
      // Save commissions if dirty
      if (commDirty && saved?.id) {
        const items = commData.map(c => ({
          staff_id: c.staff_id,
          is_enabled: c.is_enabled,
          commission_type: c.commission_type,
          commission_rate: c.commission_rate,
          commission_amount: c.commission_amount,
        }));
        try { await servicesService.saveCommissions(saved.id, items); }
        catch (err) { addNotification('Servicio guardado pero las comisiones fallaron: ' + err.message, 'error'); }
      }
      addNotification(editingService ? 'Servicio actualizado' : 'Servicio creado', 'success');
      setShowModal(false);
      loadData();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (svc, e) => {
    e?.stopPropagation?.();
    setTogglingActive(svc.id);
    try {
      await servicesService.update(svc.id, { is_active: !svc.is_active });
      setServices(prev => prev.map(s => s.id === svc.id ? { ...s, is_active: !svc.is_active } : s));
    } catch (err) {
      addNotification('Error al cambiar estado: ' + err.message, 'error');
    } finally {
      setTogglingActive(null);
    }
  };

  const handleDelete = (svc, e) => { e?.stopPropagation?.(); setDeleteConfirm(svc); };
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await servicesService.delete(deleteConfirm.id);
      addNotification('Servicio eliminado', 'success');
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };

  const handleExport = async () => {
    try {
      await servicesService.exportXlsx();
      addNotification('Catálogo descargado', 'success');
    } catch (err) {
      addNotification(err.message || 'Error al exportar', 'error');
    }
  };

  const handleImport = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await servicesService.importXlsx(file);
      setImportResult(result);
      if (result.imported > 0) loadData();
    } catch (err) {
      addNotification(err.message || 'Error al importar', 'error');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const filteredCommData = useMemo(() => {
    if (!commSearch.trim()) return commData;
    const t = commSearch.toLowerCase();
    return commData.filter(c => (c.staff_name || '').toLowerCase().includes(t) || (c.staff_role || '').toLowerCase().includes(t));
  }, [commData, commSearch]);

  const enabledCount = commData.filter(c => c.is_enabled).length;

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__loading`}>
          <div className={`${b}__spinner`} />
          <span>Cargando servicios...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={b}>
      {/* ── HEADER ─────────────────────────────────── */}
      <div className={`${b}__header`}>
        <div className={`${b}__header-left`}>
          <h1 className={`${b}__title`}>Servicios</h1>
          <p className={`${b}__subtitle`}>Catálogo completo de {tenant.name}</p>
        </div>
        <div className={`${b}__header-actions`}>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => handleImport(e.target.files?.[0])}
          />
          <button className={`${b}__action-btn`} onClick={() => importInputRef.current?.click()} disabled={importing}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            {importing ? 'Importando...' : 'Importar'}
          </button>
          <button className={`${b}__action-btn`} onClick={handleExport}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Exportar
          </button>
          <button className={`${b}__add-btn`} onClick={openCreateModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Nuevo servicio
          </button>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────── */}
      <div className={`${b}__stats`}>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{stats.total}</span>
          <span className={`${b}__stat-label`}>Servicios activos</span>
          {stats.inactive > 0 && <span className={`${b}__stat-sub`}>+{stats.inactive} inactivos</span>}
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{stats.categories}</span>
          <span className={`${b}__stat-label`}>Categorías</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{formatCurrency(stats.avgPrice)}</span>
          <span className={`${b}__stat-label`}>Precio promedio</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{formatCurrency(stats.priceRange.min)} — {formatCurrency(stats.priceRange.max)}</span>
          <span className={`${b}__stat-label`}>Rango de precios</span>
        </div>
      </div>

      {/* ── FILTERS ────────────────────────────────── */}
      <div className={`${b}__filters`}>
        <div className={`${b}__search`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            placeholder="Buscar servicio, categoría o profesional..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${b}__search-input`}
          />
        </div>
        <div className={`${b}__status-pills`}>
          {[
            { key: 'active', label: 'Activos', count: stats.total },
            { key: 'inactive', label: 'Inactivos', count: stats.inactive },
            { key: 'all', label: 'Todos', count: services.length },
          ].map(p => (
            <button key={p.key}
              className={`${b}__status-pill ${statusFilter === p.key ? `${b}__status-pill--active` : ''}`}
              onClick={() => setStatusFilter(p.key)}>
              {p.label} <span>{p.count}</span>
            </button>
          ))}
        </div>
        <div className={`${b}__tabs`}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`${b}__tab ${activeCategory === cat ? `${b}__tab--active` : ''}`}
              onClick={() => setActiveCategory(cat)}
              style={activeCategory === cat && cat !== 'Todos' ? { '--tab-color': getCategoryMeta(cat).color } : {}}
            >
              {cat === 'Todos' ? 'Todos' : cat}
              {cat !== 'Todos' && (
                <span className={`${b}__tab-count`}>
                  {services.filter(s => s.category === cat && (statusFilter === 'all' || (statusFilter === 'active' ? s.is_active : !s.is_active))).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIST ───────────────────────────────────── */}
      <div className={`${b}__content`}>
        {Object.keys(grouped).length === 0 ? (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8 15h8M9 9h.01M15 9h.01" /></svg>}
            title="No hay servicios"
            description="Empieza agregando tu primer servicio o importa un xlsx con todo el catálogo"
            actionLabel="Nuevo Servicio"
            onAction={openCreateModal}
          />
        ) : (
          Object.entries(grouped).map(([category, items]) => {
            const meta = getCategoryMeta(category);
            return (
              <div key={category} className={`${b}__category`}>
                <div className={`${b}__category-header`}>
                  <div className={`${b}__category-icon`} style={{ background: meta.gradient }}>{meta.icon}</div>
                  <div className={`${b}__category-info`}>
                    <h2 className={`${b}__category-name`}>{category}</h2>
                    <span className={`${b}__category-count`}>{items.length} servicio{items.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className={`${b}__list`}>
                  {items.map(svc => {
                    const staffCount = (svc.staff_ids || []).length;
                    return (
                      <div key={svc.id}
                        className={`${b}__row ${!svc.is_active ? `${b}__row--inactive` : ''}`}
                        style={{ '--row-accent': meta.color }}
                        onClick={() => openEditModal(svc)}>
                        <div className={`${b}__row-thumb`} style={svc.photo_url ? {} : { background: meta.gradient }}>
                          {svc.photo_url
                            ? <img src={svc.photo_url} alt={svc.name} />
                            : <span>{initialsOf(svc.name)}</span>}
                        </div>
                        <div className={`${b}__row-main`}>
                          <div className={`${b}__row-name`}>
                            {svc.name}
                            {svc.service_type && svc.service_type !== 'cita' && (
                              <span className={`${b}__row-type`} style={{ background: SERVICE_TYPE_META[svc.service_type]?.color }}>
                                {SERVICE_TYPE_META[svc.service_type]?.label}
                              </span>
                            )}
                          </div>
                          {svc.description && <span className={`${b}__row-desc`}>{svc.description}</span>}
                        </div>
                        <div className={`${b}__row-meta`}>
                          <span className={`${b}__row-price`}>{formatCurrency(svc.price)}</span>
                          <span className={`${b}__row-duration`}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            {formatDuration(svc.duration_minutes, svc.service_type)}
                          </span>
                        </div>
                        <div className={`${b}__row-staff`}>
                          {staffCount === 0
                            ? <span className={`${b}__row-staff-none`}>Sin personal</span>
                            : (
                              <>
                                {(svc.staff_names || []).slice(0, 3).map((name, i) => (
                                  <span key={i} className={`${b}__row-staff-tag`}
                                    style={{ background: colorForName(name) }}
                                    title={name}>{initialsOf(name)}</span>
                                ))}
                                {staffCount > 3 && <span className={`${b}__row-staff-more`}>+{staffCount - 3}</span>}
                              </>
                            )}
                        </div>
                        <div className={`${b}__row-actions`} onClick={(e) => e.stopPropagation()}>
                          <button
                            className={`${b}__toggle ${svc.is_active ? `${b}__toggle--on` : ''} ${togglingActive === svc.id ? `${b}__toggle--loading` : ''}`}
                            onClick={(e) => handleToggleActive(svc, e)}
                            disabled={togglingActive === svc.id}
                            title={svc.is_active ? 'Desactivar' : 'Activar'}>
                            <span className={`${b}__toggle-knob`} />
                          </button>
                          <button className={`${b}__row-icon`} onClick={() => openEditModal(svc, 'commissions')} title="Configurar comisiones">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          </button>
                          <button className={`${b}__row-icon`} onClick={() => openEditModal(svc)} title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <button className={`${b}__row-icon ${b}__row-icon--danger`} onClick={(e) => handleDelete(svc, e)} title="Eliminar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── DISCARD CHANGES CONFIRM ───────────────── */}
      {discardConfirm && createPortal(
        <div className={`${b}__confirm-overlay`} onClick={() => setDiscardConfirm(false)}>
          <div className={`${b}__confirm`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__confirm-icon ${b}__confirm-icon--warn`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 className={`${b}__confirm-title`}>Cambios sin guardar</h3>
            <p className={`${b}__confirm-text`}>
              Tienes cambios pendientes en las comisiones. Si cierras ahora se perderán.
            </p>
            <div className={`${b}__confirm-actions`}>
              <button className={`${b}__confirm-cancel`} onClick={() => setDiscardConfirm(false)}>Seguir editando</button>
              <button className={`${b}__confirm-delete`} onClick={confirmDiscard}>Descartar y cerrar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── DELETE CONFIRM ─────────────────────────── */}
      {deleteConfirm && createPortal(
        <div className={`${b}__confirm-overlay`} onClick={() => setDeleteConfirm(null)}>
          <div className={`${b}__confirm`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__confirm-icon`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </div>
            <h3 className={`${b}__confirm-title`}>Eliminar servicio</h3>
            <p className={`${b}__confirm-text`}>
              ¿Eliminar <strong>{deleteConfirm.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className={`${b}__confirm-actions`}>
              <button className={`${b}__confirm-cancel`} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className={`${b}__confirm-delete`} onClick={confirmDelete}>Sí, eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── IMPORT RESULT ──────────────────────────── */}
      {importResult && createPortal(
        <div className={`${b}__confirm-overlay`} onClick={() => setImportResult(null)}>
          <div className={`${b}__confirm`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__confirm-icon ${b}__confirm-icon--ok`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <h3 className={`${b}__confirm-title`}>Importación completada</h3>
            <div className={`${b}__import-summary`}>
              <div><strong>{importResult.imported}</strong> creados</div>
              <div><strong>{importResult.skipped}</strong> duplicados omitidos</div>
              <div><strong>{importResult.errors?.length || 0}</strong> errores</div>
            </div>
            {importResult.errors?.length > 0 && (
              <div className={`${b}__import-errors`}>
                {importResult.errors.slice(0, 5).map((e, i) => (
                  <div key={i}>Fila {e.row}: {e.reason}</div>
                ))}
                {importResult.errors.length > 5 && <div>... y {importResult.errors.length - 5} más</div>}
              </div>
            )}
            <div className={`${b}__confirm-actions`}>
              <button className={`${b}__confirm-cancel`} onClick={() => setImportResult(null)}>Cerrar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── EDIT/CREATE MODAL (sidebar layout) ─────── */}
      {showModal && createPortal(
        <div className={`${b}__modal-overlay`} onClick={closeModal}>
          <div className={`${b}__modal`} onClick={(e) => e.stopPropagation()}>

            {/* ───────── SIDEBAR (left rail) ───────── */}
            <aside className={`${b}__rail`}>
              <button className={`${b}__rail-close`} onClick={closeModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                <span>Volver</span>
              </button>

              <div className={`${b}__rail-id`}>
                <span className={`${b}__rail-eyebrow`}>{editingService ? 'Editar servicio' : 'Nuevo servicio'}</span>
                <h2 className={`${b}__rail-name`}>{formData.name || 'Sin nombre'}</h2>
                {formData.category && (
                  <span className={`${b}__rail-cat`}>{formData.category}</span>
                )}
              </div>

              <div className={`${b}__rail-preview`}>
                <div className={`${b}__rail-thumb`}
                  style={photoPreview
                    ? {}
                    : { background: getCategoryMeta(formData.category).gradient }}>
                  {photoPreview
                    ? <img src={photoPreview} alt="preview" />
                    : <span>{initialsOf(formData.name || '?')}</span>}
                </div>
                <div className={`${b}__rail-stats`}>
                  <div>
                    <span>Precio</span>
                    <strong>{formatCurrency(parseInt(formData.price) || 0)}</strong>
                  </div>
                  <div>
                    <span>Duración</span>
                    <strong>{formatDuration(parseInt(formData.duration_minutes) || 0, formData.service_type)}</strong>
                  </div>
                </div>
              </div>

              <nav className={`${b}__rail-nav`}>
                {[
                  { key: 'basic', label: 'General', sub: 'Nombre, foto, precio, tiempo',
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  },
                  { key: 'commissions', label: 'Comisiones', sub: `${enabledCount} de ${commData.length} activos`,
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  },
                  { key: 'advanced', label: 'Configuración', sub: 'Estado · IA · Eliminar',
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  },
                ].map(item => (
                  <button key={item.key}
                    className={`${b}__rail-nav-item ${modalTab === item.key ? `${b}__rail-nav-item--active` : ''}`}
                    onClick={() => setModalTab(item.key)}>
                    <span className={`${b}__rail-nav-icon`}>{item.icon}</span>
                    <span className={`${b}__rail-nav-text`}>
                      <strong>{item.label}</strong>
                      <span>{item.sub}</span>
                    </span>
                    <svg className={`${b}__rail-nav-arrow`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </nav>

              <div className={`${b}__rail-foot`}>
                <span>El estado activo/inactivo del servicio se controla con el switch de cada fila en el listado.</span>
              </div>
            </aside>

            {/* ───────── CONTENT (right) ───────── */}
            <div className={`${b}__panel`}>
              <header className={`${b}__panel-bar`}>
                <div>
                  <h3>{modalTab === 'basic' ? 'Información general' : modalTab === 'commissions' ? 'Comisiones por profesional' : 'Configuración avanzada'}</h3>
                  <span>
                    {modalTab === 'basic' && 'Datos visibles en el catálogo y para el cliente'}
                    {modalTab === 'commissions' && 'Define quién realiza el servicio y cuánto gana'}
                    {modalTab === 'advanced' && 'Estado, automatizaciones y zona de peligro'}
                  </span>
                </div>
                {commDirty && modalTab === 'commissions' && (
                  <span className={`${b}__panel-dirty`}>
                    <span className={`${b}__panel-dirty-dot`} />
                    Cambios sin guardar
                  </span>
                )}
              </header>

              <div className={`${b}__modal-body`}>
              {/* ─── TAB: INFORMACIÓN BÁSICA — premium card sections ─── */}
              {modalTab === 'basic' && (
                <div className={`${b}__basic`}>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
                  />

                  {/* ─── HERO MEDIA + IDENTITY ─── */}
                  <section className={`${b}__sec ${b}__sec--hero`}>
                    <div className={`${b}__hero-media`}>
                      {photoPreview ? (
                        <>
                          <img src={photoPreview} alt="Vista previa" />
                          <div className={`${b}__hero-media-actions`}>
                            <button type="button" className={`${b}__hero-media-btn`} onClick={() => photoInputRef.current?.click()}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                              Cambiar imagen
                            </button>
                            <button type="button" className={`${b}__hero-media-btn ${b}__hero-media-btn--del`} onClick={handleRemovePhoto}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </>
                      ) : (
                        <button type="button" className={`${b}__hero-media-empty`} onClick={() => photoInputRef.current?.click()}>
                          <div className={`${b}__hero-media-empty-icon`}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                          </div>
                          <strong>Subir foto del servicio</strong>
                          <span>1240×500 px · JPG / PNG / WEBP · máx 2 MB</span>
                          <em>Haz clic para seleccionar</em>
                        </button>
                      )}
                    </div>

                    <div className={`${b}__hero-identity`}>
                      <div className={`${b}__field ${b}__field--lg`}>
                        <label>Nombre del servicio *</label>
                        <input type="text" value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ej: Manicure semipermanente" />
                      </div>

                      <div className={`${b}__field`}>
                        <label>Categoría *</label>
                        {!newCategoryMode ? (
                          <select value={formData.category} onChange={e => {
                            if (e.target.value === '__new') { setNewCategoryMode(true); setFormData({ ...formData, category: '' }); }
                            else setFormData({ ...formData, category: e.target.value });
                          }}>
                            <option value="">Seleccionar...</option>
                            {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            <option value="__new">+ Nueva categoría</option>
                          </select>
                        ) : (
                          <div className={`${b}__inline-row`}>
                            <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Nombre de la categoría" autoFocus />
                            <button type="button" className={`${b}__inline-cancel`} onClick={() => setNewCategoryMode(false)}>×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* ─── TYPE PICKER as descriptive cards ─── */}
                  <section className={`${b}__sec`}>
                    <div className={`${b}__sec-head`}>
                      <div className={`${b}__sec-icon ${b}__sec-icon--type`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <div>
                        <h4>Tipo de servicio</h4>
                        <span>Define cómo se cobra y agenda</span>
                      </div>
                    </div>
                    <div className={`${b}__type-cards`}>
                      {[
                        { key: 'cita', label: 'Cita', desc: 'Reserva en agenda con duración fija. El cliente elige día y hora.', color: '#3B82F6',
                          icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        },
                        { key: 'paquete', label: 'Paquete / Bono', desc: 'Pago único con vigencia en días. Útil para promociones y mensualidades.', color: '#8B5CF6',
                          icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                        },
                        { key: 'reserva', label: 'Reserva', desc: 'Estancia o múltiples sesiones. Usa la duración como referencia.', color: '#F59E0B',
                          icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        },
                      ].map(t => (
                        <button key={t.key} type="button"
                          className={`${b}__type-card ${formData.service_type === t.key ? `${b}__type-card--active` : ''}`}
                          style={formData.service_type === t.key ? { '--type-color': t.color } : {}}
                          onClick={() => setFormData({ ...formData, service_type: t.key })}>
                          <span className={`${b}__type-card-icon`} style={{ background: t.color }}>{t.icon}</span>
                          <span className={`${b}__type-card-text`}>
                            <strong>{t.label}</strong>
                            <span>{t.desc}</span>
                          </span>
                          <span className={`${b}__type-card-radio`}>
                            {formData.service_type === t.key && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* ─── PRICE + DURATION (split cards) ─── */}
                  <div className={`${b}__split`}>
                    <section className={`${b}__sec ${b}__sec--price`}>
                      <div className={`${b}__sec-head`}>
                        <div className={`${b}__sec-icon ${b}__sec-icon--price`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                        <div>
                          <h4>Precio</h4>
                          <span>Valor fijo en pesos colombianos</span>
                        </div>
                      </div>
                      <div className={`${b}__price-input`}>
                        <span className={`${b}__price-currency`}>$</span>
                        <input type="number" value={formData.price}
                          onChange={e => setFormData({ ...formData, price: e.target.value })}
                          placeholder="40000"
                          className={`${b}__price-field`} />
                        <span className={`${b}__price-unit`}>COP</span>
                      </div>
                      <div className={`${b}__price-hint`}>
                        {formData.price
                          ? <>Se mostrará como <strong>{formatCurrency(parseInt(formData.price) || 0)}</strong></>
                          : 'Define cuánto cuesta este servicio'}
                      </div>
                    </section>

                    <section className={`${b}__sec ${b}__sec--duration`}>
                      <div className={`${b}__sec-head`}>
                        <div className={`${b}__sec-icon ${b}__sec-icon--time`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div>
                          <h4>{formData.service_type === 'paquete' ? 'Vigencia' : 'Duración'}</h4>
                          <span>{formData.service_type === 'paquete' ? 'Cuántos días dura el bono' : 'Cuánto tarda el servicio'}</span>
                        </div>
                      </div>
                      <div className={`${b}__time-input-wrap`}>
                        <input type="number" value={formData.duration_minutes}
                          onChange={e => setFormData({ ...formData, duration_minutes: e.target.value })}
                          placeholder={formData.service_type === 'paquete' ? '30' : '40'}
                          className={`${b}__time-field`} />
                        <span className={`${b}__time-unit`}>{formData.service_type === 'paquete' ? 'días' : 'min'}</span>
                      </div>
                      <div className={`${b}__time-presets`}>
                        {(formData.service_type === 'paquete' ? [7, 15, 30, 60, 90, 180, 365] : TIME_PRESETS).map(t => (
                          <button key={t} type="button"
                            className={`${b}__time-preset ${parseInt(formData.duration_minutes) === t ? `${b}__time-preset--active` : ''}`}
                            onClick={() => setFormData({ ...formData, duration_minutes: String(t) })}>
                            {formData.service_type === 'paquete' ? `${t}d` : (t < 60 ? `${t}m` : `${t / 60}h`)}
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* ─── DESCRIPTION ─── */}
                  <section className={`${b}__sec`}>
                    <div className={`${b}__sec-head`}>
                      <div className={`${b}__sec-icon ${b}__sec-icon--desc`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                      </div>
                      <div>
                        <h4>Descripción</h4>
                        <span>Texto visible para el cliente al reservar (opcional)</span>
                      </div>
                    </div>
                    <textarea value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Ej: Incluye limpieza, exfoliación e hidratación. Recomendado cada 3 semanas."
                      rows={3}
                      className={`${b}__desc-field`} />
                    <div className={`${b}__desc-count`}>{(formData.description || '').length} / 500</div>
                  </section>
                </div>
              )}

              {/* ─── TAB: COMISIONES ─── */}
              {modalTab === 'commissions' && (
                <div className={`${b}__tab-pane ${b}__tab-pane--comm`}>
                  <div className={`${b}__comm-head`}>
                    <div>
                      <h3>Configurar comisiones</h3>
                      <p>Activa quien realiza este servicio y define cuánto gana por venta. <strong>{enabledCount}</strong> de {commData.length} activos.</p>
                    </div>
                    <div className={`${b}__comm-search`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                      <input type="text" value={commSearch} onChange={e => setCommSearch(e.target.value)} placeholder="Buscar profesional..." />
                    </div>
                  </div>

                  {commLoading ? (
                    <div className={`${b}__comm-loading`}>Cargando comisiones...</div>
                  ) : !editingService ? (
                    <div className={`${b}__comm-empty`}>
                      Guarda el servicio primero para poder configurar comisiones.
                    </div>
                  ) : commData.length === 0 ? (
                    <div className={`${b}__comm-empty`}>No hay personal registrado en el negocio.</div>
                  ) : (
                    <div className={`${b}__comm-list`}>
                      {filteredCommData.map(c => {
                        const earn = c.commission_type === 'fixed'
                          ? (c.commission_amount || 0)
                          : Math.round((parseInt(formData.price) || 0) * (c.commission_rate || 0));
                        return (
                          <div key={c.staff_id}
                            className={`${b}__comm-row ${c.is_enabled ? `${b}__comm-row--on` : ''}`}
                            data-comm-staff-id={c.staff_id}>
                            <div className={`${b}__comm-staff`}>
                              <div className={`${b}__comm-avatar`} style={{ background: colorForName(c.staff_name) }}>
                                {c.staff_photo_url
                                  ? <img src={c.staff_photo_url} alt={c.staff_name} />
                                  : initialsOf(c.staff_name)}
                              </div>
                              <div>
                                <strong>{c.staff_name}</strong>
                                {c.staff_role && <span>{c.staff_role}</span>}
                              </div>
                            </div>

                            {c.is_enabled && (
                              <>
                                <div className={`${b}__comm-type`}>
                                  <button type="button"
                                    className={`${b}__comm-type-btn ${c.commission_type === 'percentage' ? `${b}__comm-type-btn--active` : ''}`}
                                    onClick={() => updateComm(c.staff_id, { commission_type: 'percentage' })}>%</button>
                                  <button type="button"
                                    className={`${b}__comm-type-btn ${c.commission_type === 'fixed' ? `${b}__comm-type-btn--active` : ''}`}
                                    onClick={() => updateComm(c.staff_id, { commission_type: 'fixed' })}>$</button>
                                </div>
                                <div className={`${b}__comm-input`}>
                                  {c.commission_type === 'percentage' ? (
                                    <>
                                      <input type="range" min="0" max="100" step="5"
                                        value={Math.round((c.commission_rate || 0) * 100)}
                                        onChange={e => updateComm(c.staff_id, { commission_rate: Number(e.target.value) / 100 })} />
                                      <input type="number" min="0" max="100" step="1"
                                        value={Math.round((c.commission_rate || 0) * 100)}
                                        onChange={e => updateComm(c.staff_id, { commission_rate: Math.min(100, Math.max(0, Number(e.target.value))) / 100 })} />
                                      <span>%</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>$</span>
                                      <input type="number" min="0" step="500"
                                        value={c.commission_amount || 0}
                                        onChange={e => updateComm(c.staff_id, { commission_amount: Math.max(0, Number(e.target.value)) })} />
                                    </>
                                  )}
                                </div>
                                <div className={`${b}__comm-earn`}>
                                  <span>Gana</span>
                                  <strong>{formatCurrency(earn)}</strong>
                                </div>
                              </>
                            )}
                            {!c.is_enabled && (
                              <div className={`${b}__comm-disabled-hint`}>No realiza este servicio</div>
                            )}

                            <button type="button"
                              className={`${b}__toggle ${c.is_enabled ? `${b}__toggle--on` : ''}`}
                              onClick={() => updateComm(c.staff_id, { is_enabled: !c.is_enabled })}
                              title={c.is_enabled ? 'Desactivar' : 'Activar'}>
                              <span className={`${b}__toggle-knob`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: AVANZADA — solo Modo Lina + Eliminar ─── */}
              {modalTab === 'advanced' && (
                <div className={`${b}__tab-pane ${b}__tab-pane--adv`}>
                  <div className={`${b}__adv-card`}>
                    <div className={`${b}__adv-row`}>
                      <div>
                        <strong>Modo Lina (IA)</strong>
                        <p>
                          <code>Auto</code>: Lina puede agendar este servicio sola.
                          <br /><code>Manual</code>: Lina pausa y notifica al admin antes de cualquier acción.
                        </p>
                      </div>
                      <div className={`${b}__adv-segment`}>
                        <button type="button"
                          className={`${b}__adv-seg-btn ${formData.ai_mode === 'auto' ? `${b}__adv-seg-btn--active` : ''}`}
                          onClick={() => setFormData({ ...formData, ai_mode: 'auto' })}>Auto</button>
                        <button type="button"
                          className={`${b}__adv-seg-btn ${formData.ai_mode === 'manual' ? `${b}__adv-seg-btn--active` : ''}`}
                          onClick={() => setFormData({ ...formData, ai_mode: 'manual' })}>Manual</button>
                      </div>
                    </div>
                  </div>

                  {editingService && (
                    <div className={`${b}__adv-card ${b}__adv-card--danger`}>
                      <div className={`${b}__adv-row`}>
                        <div>
                          <strong>Eliminar servicio</strong>
                          <p>Borra este servicio del catálogo de forma permanente.</p>
                        </div>
                        <button type="button" className={`${b}__adv-danger-btn`} onClick={() => { setShowModal(false); setDeleteConfirm(editingService); }}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>{/* /__modal-body */}

              {/* Footer total bar */}
              <div className={`${b}__modal-footer`}>
                <span>Precio fijo: <strong>{formatCurrency(parseInt(formData.price) || 0)}</strong></span>
                <div className={`${b}__modal-footer-actions`}>
                  <button className={`${b}__btn-cancel`} onClick={closeModal}>Cancelar</button>
                  <button className={`${b}__btn-save`} onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Guardando...' : (editingService ? 'Guardar cambios' : 'Crear servicio')}
                  </button>
                </div>
              </div>
            </div>{/* /__panel */}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Services;
