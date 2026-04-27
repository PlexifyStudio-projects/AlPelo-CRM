import { useState, useEffect, useMemo, useCallback } from 'react';
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
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V4h4l6 8-6 8H4z" /><path d="M14 20V4h4l4 8-4 8h-4z" />
      </svg>
    ),
    color: '#2D5A3D',
    gradient: 'linear-gradient(135deg, #2D5A3D 0%, #3D7A52 100%)',
  },
  'Arte en Uñas': {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6m0 8v6M2 12h6m8 0h6" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
    color: '#E05292',
    gradient: 'linear-gradient(135deg, #E05292 0%, #F472B6 100%)',
  },
  'Peluquería': {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C7 2 3 6 3 11c0 3 1.5 5.5 4 7v4h10v-4c2.5-1.5 4-4 4-7 0-5-4-9-9-9z" />
        <path d="M9 22h6" />
      </svg>
    ),
    color: '#C9A84C',
    gradient: 'linear-gradient(135deg, #C9A84C 0%, #E4CC7A 100%)',
  },
  'Tratamientos Capilares': {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7c3-2 6-3 9-3s6 1 9 3" /><path d="M5 11c2.5-1.5 5-2 7-2s4.5.5 7 2" />
      </svg>
    ),
    color: '#60A5FA',
    gradient: 'linear-gradient(135deg, #60A5FA 0%, #93C5FD 100%)',
  },
  'Color': {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
      </svg>
    ),
    color: '#A78BFA',
    gradient: 'linear-gradient(135deg, #A78BFA 0%, #C4B5FD 100%)',
  },
  'Consulta': {
    icon: <GenericServiceIcon />,
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
  },
  'Tratamiento': {
    icon: <GenericServiceIcon />,
    color: '#14B8A6',
    gradient: 'linear-gradient(135deg, #14B8A6 0%, #5EEAD4 100%)',
  },
  'Bienestar': {
    icon: <GenericServiceIcon />,
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
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
  const { color, gradient } = generateCategoryColor(cat);
  return { icon: <GenericServiceIcon />, color, gradient };
};

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const formatDuration = (mins, serviceType) => {
  if (!mins) return '-';
  if (serviceType === 'paquete') {
    if (mins >= 365) return `${Math.round(mins / 365)} año${mins >= 730 ? 's' : ''}`;
    if (mins >= 30) return `${Math.round(mins / 30)} mes${mins >= 60 ? 'es' : ''}`;
    return `${mins} días`;
  }
  if (serviceType === 'reserva') {
    if (mins >= 1440) return `${Math.round(mins / 1440)} noche${mins >= 2880 ? 's' : ''}`;
  }
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
};

const SERVICE_TYPE_META = {
  cita: { label: 'Cita', color: '#3B82F6', icon: '📅', durationLabel: 'Duración (min)' },
  paquete: { label: 'Paquete', color: '#8B5CF6', icon: '📦', durationLabel: 'Vigencia (días)' },
  reserva: { label: 'Reserva', color: '#F59E0B', icon: '🏷️', durationLabel: 'Duración (min)' },
};

const Services = () => {
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingAiMode, setTogglingAiMode] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const { tenant } = useTenant();
  const [formData, setFormData] = useState({
    name: '', category: '', service_type: 'cita', price: '', duration_minutes: '', description: '', staff_ids: [],
  });
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const { addNotification } = useNotification();
  const [expandedCommission, setExpandedCommission] = useState(null); // service id
  const [commissionData, setCommissionData] = useState([]); // [{staff_id, staff_name, commission_rate}]
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionSaving, setCommissionSaving] = useState(false);

  const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

  const toggleCommission = async (svcId) => {
    if (expandedCommission === svcId) {
      setExpandedCommission(null);
      return;
    }
    setExpandedCommission(svcId);
    setCommissionLoading(true);
    try {
      const res = await fetch(`${API}/services/${svcId}/commissions`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCommissionData(data.commissions || []);
      }
    } catch { setCommissionData([]); }
    finally { setCommissionLoading(false); }
  };

  const updateCommissionRate = (staffId, rate) => {
    setCommissionData(prev => prev.map(c => c.staff_id === staffId ? { ...c, commission_rate: rate } : c));
  };

  const saveCommissions = async () => {
    setCommissionSaving(true);
    try {
      const res = await fetch(`${API}/services/${expandedCommission}/commissions`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commissionData.map(c => ({ staff_id: c.staff_id, commission_rate: c.commission_rate }))),
      });
      if (!res.ok) throw new Error('Error al guardar');
      addNotification('Comisiones guardadas', 'success');
    } catch (err) { addNotification(err.message, 'error'); }
    finally { setCommissionSaving(false); }
  };

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

  // Open the commission editor for a specific service when navigated from
  // InvoiceDetail (sessionStorage handoff). Highlights the staff row that
  // triggered the request so the admin can configure it directly.
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
        toggleCommission(target.id);
        // Highlight pulse on the relevant staff row
        if (data.highlight_staff_id) {
          setTimeout(() => {
            const el = document.querySelector(`[data-comm-staff-id="${data.highlight_staff_id}"]`);
            if (el) {
              el.classList.add('services__comm-row--pulse');
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => el.classList.remove('services__comm-row--pulse'), 2400);
            }
          }, 300);
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const existingCategories = useMemo(() => [...new Set(services.map(s => s.category).filter(Boolean))], [services]);
  const categories = useMemo(() => ['Todos', ...existingCategories], [existingCategories]);

  const filtered = useMemo(() => {
    let list = services.filter(s => s.is_active);
    if (activeCategory !== 'Todos') list = list.filter(s => s.category === activeCategory);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        (s.staff_names || []).some(n => n.toLowerCase().includes(term))
      );
    }
    return list;
  }, [services, activeCategory, searchTerm]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    const order = Object.keys(CATEGORY_META);
    const sorted = {};
    order.forEach(cat => { if (groups[cat]) sorted[cat] = groups[cat]; });
    Object.keys(groups).forEach(cat => { if (!sorted[cat]) sorted[cat] = groups[cat]; });
    return sorted;
  }, [filtered]);

  const stats = useMemo(() => {
    const active = services.filter(s => s.is_active);
    return {
      total: active.length,
      categories: [...new Set(active.map(s => s.category))].length,
      avgPrice: active.length ? Math.round(active.reduce((sum, s) => sum + s.price, 0) / active.length) : 0,
      priceRange: active.length ? { min: Math.min(...active.map(s => s.price)), max: Math.max(...active.map(s => s.price)) } : { min: 0, max: 0 },
    };
  }, [services]);

  const openCreateModal = () => {
    setEditingService(null);
    setFormData({ name: '', category: '', service_type: 'cita', price: '', duration_minutes: '', description: '', staff_ids: [] });
    setNewCategoryMode(false);
    setShowModal(true);
  };

  const openEditModal = (svc) => {
    setEditingService(svc);
    setFormData({
      name: svc.name,
      category: svc.category,
      service_type: svc.service_type || 'cita',
      price: String(svc.price),
      duration_minutes: svc.duration_minutes ? String(svc.duration_minutes) : '',
      description: svc.description || '',
      staff_ids: svc.staff_ids || [],
    });
    setNewCategoryMode(!existingCategories.includes(svc.category));
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      price: parseInt(formData.price) || 0,
      duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
      description: formData.description || null,
      service_type: formData.service_type || 'cita',
    };
    try {
      if (editingService) {
        await servicesService.update(editingService.id, payload);
        addNotification('Servicio actualizado', 'success');
      } else {
        await servicesService.create(payload);
        addNotification('Servicio creado', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };

  const handleDelete = (svc) => setDeleteConfirm(svc);

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

  const toggleStaffId = (id) => {
    setFormData(prev => ({
      ...prev,
      staff_ids: prev.staff_ids.includes(id) ? prev.staff_ids.filter(x => x !== id) : [...prev.staff_ids, id],
    }));
  };

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
      <div className={`${b}__header`}>
        <div className={`${b}__header-left`}>
          <h1 className={`${b}__title`}>Servicios</h1>
          <p className={`${b}__subtitle`}>Catálogo completo de {tenant.name}</p>
        </div>
        <button className={`${b}__add-btn`} onClick={openCreateModal}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nuevo servicio
        </button>
      </div>
      <div className={`${b}__stats`}>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{stats.total}</span>
          <span className={`${b}__stat-label`}>Servicios activos</span>
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
                <span className={`${b}__tab-count`}>{services.filter(s => s.category === cat && s.is_active).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={`${b}__content`}>
        {Object.keys(grouped).length === 0 ? (
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8 15h8M9 9h.01M15 9h.01" /></svg>
            }
            title="No hay servicios configurados"
            description="Agrega tu primer servicio para empezar a gestionar tu catálogo"
            actionLabel="Nuevo Servicio"
            onAction={openCreateModal}
          />
        ) : (
          Object.entries(grouped).map(([category, items]) => {
            const meta = getCategoryMeta(category);
            return (
              <div key={category} className={`${b}__category`}>
                <div className={`${b}__category-header`}>
                  <div className={`${b}__category-icon`} style={{ background: meta.gradient }}>
                    {meta.icon}
                  </div>
                  <div className={`${b}__category-info`}>
                    <h2 className={`${b}__category-name`}>{category}</h2>
                    <span className={`${b}__category-count`}>{items.length} servicio{items.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className={`${b}__list`}>
                  {items.map(svc => (
                    <div key={svc.id} className={`${b}__row-wrap`}>
                    <div className={`${b}__row`} style={{ '--row-accent': meta.color }} onClick={() => openEditModal(svc)}>
                      <div className={`${b}__row-accent`} />
                      <div className={`${b}__row-main`}>
                        <div className={`${b}__row-name`}>
                          {svc.name}
                          {svc.service_type && svc.service_type !== 'cita' && (
                            <span className={`${b}__row-type`} style={{ background: SERVICE_TYPE_META[svc.service_type]?.color || '#64748B' }}>
                              {SERVICE_TYPE_META[svc.service_type]?.label || svc.service_type}
                            </span>
                          )}
                        </div>
                        {svc.description && <span className={`${b}__row-desc`}>{svc.description}</span>}
                      </div>
                      <div className={`${b}__row-meta`}>
                        <span className={`${b}__row-price`}>{formatCurrency(svc.price)}</span>
                        <span className={`${b}__row-duration`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          {formatDuration(svc.duration_minutes, svc.service_type)}
                        </span>
                      </div>
                      {(svc.staff_names || []).length > 0 && (
                        <div className={`${b}__row-staff`}>
                          {svc.staff_names.slice(0, 3).map((name, i) => (
                            <span key={i} className={`${b}__row-staff-tag`}>{name.split(' ')[0]}</span>
                          ))}
                          {svc.staff_names.length > 3 && <span className={`${b}__row-staff-more`}>+{svc.staff_names.length - 3}</span>}
                        </div>
                      )}
                      <button
                        type="button"
                        className={`${b}__row-ai ${(svc.ai_mode || 'auto') === 'manual' ? `${b}__row-ai--manual` : ''} ${togglingAiMode === svc.id ? `${b}__row-ai--loading` : ''}`}
                        disabled={togglingAiMode === svc.id}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const newMode = (svc.ai_mode || 'auto') === 'auto' ? 'manual' : 'auto';
                          setTogglingAiMode(svc.id);
                          try {
                            await servicesService.update(svc.id, { ai_mode: newMode });
                            await loadData();
                          } catch (err) {
                            addNotification('Error al cambiar modo IA: ' + (err.message || 'Error'), 'error');
                          } finally {
                            setTogglingAiMode(null);
                          }
                        }}>
                        {togglingAiMode === svc.id ? (
                          <span className={`${b}__row-ai-spinner`} />
                        ) : (
                          <span className={`${b}__row-ai-dot`} />
                        )}
                        {togglingAiMode === svc.id ? 'Cambiando...' : (svc.ai_mode || 'auto') === 'auto' ? 'Auto' : 'Manual'}
                      </button>
                      <button className={`${b}__row-commission ${expandedCommission === svc.id ? `${b}__row-commission--active` : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleCommission(svc.id); }}
                        title="Comisiones por profesional">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        %
                      </button>
                      <button className={`${b}__row-delete`} onClick={(e) => { e.stopPropagation(); handleDelete(svc); }} title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                    {expandedCommission === svc.id && (
                      <div className={`${b}__commission`} onClick={e => e.stopPropagation()}>
                        <div className={`${b}__commission-header`}>
                          <h4>Comisiones — {svc.name}</h4>
                          <span className={`${b}__commission-hint`}>Precio base: {formatCurrency(svc.price)}</span>
                        </div>
                        {commissionLoading ? (
                          <div className={`${b}__commission-loading`}>Cargando...</div>
                        ) : commissionData.length === 0 ? (
                          <div className={`${b}__commission-empty`}>No hay personal asignado a este servicio</div>
                        ) : (
                          <>
                            <div className={`${b}__commission-grid`}>
                              <div className={`${b}__commission-grid-head`}>
                                <span>Profesional</span>
                                <span>Tasa (%)</span>
                                <span>Gana por servicio</span>
                              </div>
                              {commissionData.map(c => {
                                const amount = Math.round(svc.price * c.commission_rate);
                                return (
                                  <div key={c.staff_id} className={`${b}__commission-row`} data-comm-staff-id={c.staff_id}>
                                    <span className={`${b}__commission-name`}>{c.staff_name}</span>
                                    <div className={`${b}__commission-input-wrap`}>
                                      <input
                                        type="number"
                                        min="0" max="100" step="1"
                                        value={Math.round(c.commission_rate * 100)}
                                        onChange={e => updateCommissionRate(c.staff_id, Math.min(100, Math.max(0, Number(e.target.value))) / 100)}
                                        className={`${b}__commission-input`}
                                      />
                                      <span>%</span>
                                    </div>
                                    <span className={`${b}__commission-amount`}>{formatCurrency(amount)}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <button className={`${b}__commission-save`} onClick={saveCommissions} disabled={commissionSaving}>
                              {commissionSaving ? 'Guardando...' : 'Guardar comisiones'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      {deleteConfirm && createPortal(
        <div className={`${b}__confirm-overlay`} onClick={() => setDeleteConfirm(null)}>
          <div className={`${b}__confirm`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__confirm-icon`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <h3 className={`${b}__confirm-title`}>Eliminar servicio</h3>
            <p className={`${b}__confirm-text`}>
              ¿Estás seguro de eliminar <strong>{deleteConfirm.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className={`${b}__confirm-actions`}>
              <button className={`${b}__confirm-cancel`} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className={`${b}__confirm-delete`} onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showModal && createPortal(
        <div className={`${b}__modal-overlay`} onClick={() => setShowModal(false)}>
          <div className={`${b}__modal`} onClick={(e) => e.stopPropagation()}>
            <div className={`${b}__modal-header`}>
              <h2>{editingService ? 'Editar servicio' : 'Nuevo servicio'}</h2>
              <button className={`${b}__modal-close`} onClick={() => setShowModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className={`${b}__modal-form`}>
              <div className={`${b}__form-group`}>
                <label>Nombre del servicio</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Ej: Servicio Premium" />
              </div>

              <div className={`${b}__form-group`}>
                <label>Tipo de servicio</label>
                <div className={`${b}__type-picker`}>
                  {Object.entries(SERVICE_TYPE_META).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      className={`${b}__type-btn ${formData.service_type === key ? `${b}__type-btn--active` : ''}`}
                      onClick={() => setFormData({ ...formData, service_type: key })}
                      style={formData.service_type === key ? { '--type-color': meta.color } : {}}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-group`}>
                  <label>Categoría</label>
                  {!newCategoryMode ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select value={formData.category} onChange={(e) => {
                        if (e.target.value === '__new') {
                          setNewCategoryMode(true);
                          setFormData({ ...formData, category: '' });
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }} style={{ flex: 1 }}>
                        <option value="">Seleccionar...</option>
                        {existingCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="__new">+ Nueva categoria...</option>
                      </select>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="Ej: Manicure, Facial, Cortes..."
                        autoFocus
                        style={{ flex: 1 }}
                      />
                      <button type="button" onClick={() => setNewCategoryMode(false)} style={{ padding: '4px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
                <div className={`${b}__form-group`}>
                  <label>Precio (COP)</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required placeholder="40000" />
                </div>
                <div className={`${b}__form-group`}>
                  <label>{SERVICE_TYPE_META[formData.service_type]?.durationLabel || 'Duración (min)'}</label>
                  <input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })} placeholder={formData.service_type === 'paquete' ? '30' : '40'} />
                </div>
              </div>

              <div className={`${b}__form-group`}>
                <label>Descripción (opcional)</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripción del servicio..." rows={2} />
              </div>

              <div className={`${b}__form-group`}>
                <label>Profesionales que lo realizan</label>
                <div className={`${b}__staff-picker`}>
                  {staff.filter(s => s.is_active).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className={`${b}__staff-chip ${formData.staff_ids.includes(s.id) ? `${b}__staff-chip--selected` : ''}`}
                      onClick={() => toggleStaffId(s.id)}
                    >
                      <span className={`${b}__staff-chip-name`}>{s.name}</span>
                      <span className={`${b}__staff-chip-role`}>{s.role}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${b}__modal-actions`}>
                <button type="button" className={`${b}__btn-cancel`} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className={`${b}__btn-save`}>
                  {editingService ? 'Guardar cambios' : 'Crear servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Services;
