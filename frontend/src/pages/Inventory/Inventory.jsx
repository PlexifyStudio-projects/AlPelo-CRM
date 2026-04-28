import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import inventoryService from '../../services/inventoryService';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import EmptyState from '../../components/common/EmptyState/EmptyState';

const b = 'inventory';

const formatCurrency = (n) => {
  if (!n && n !== 0) return '-';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};

const initialsOf = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const generateCategoryColor = (name) => {
  let hash = 0;
  const s = name || 'Sin categoría';
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  const color = `hsl(${hue}, 60%, 45%)`;
  const light = `hsl(${hue}, 60%, 55%)`;
  return { color, gradient: `linear-gradient(135deg, ${color} 0%, ${light} 100%)` };
};

const fmtDateTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const MOVEMENT_META = {
  purchase:    { label: 'Entrada',     color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' },
  sale:        { label: 'Venta',       color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.1)' },
  consumption: { label: 'Uso interno', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' },
  adjustment:  { label: 'Ajuste',      color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' },
  return:      { label: 'Devolución',  color: '#22C55E', bg: 'rgba(34, 197, 94, 0.1)' },
  loss:        { label: 'Pérdida',     color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
};

const Inventory = () => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();

  // ─── DATA ────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({ total_products: 0, total_stock_value: 0, total_retail_value: 0, potential_profit: 0, low_stock_count: 0 });
  const [loading, setLoading] = useState(true);
  const [togglingActive, setTogglingActive] = useState(null);
  const [stockBusy, setStockBusy] = useState(null);

  // ─── FILTERS ────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('active');

  // ─── MODAL ──────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productDetail, setProductDetail] = useState(null);
  const [modalTab, setModalTab] = useState('basic');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', sku: '', category: '', description: '', price: '', cost: '',
    stock: '', min_stock: '5', supplier: '', is_active: true,
  });
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const photoInputRef = useRef(null);

  // ─── STOCK ADJUSTMENT IN MOVEMENTS TAB ──────────────
  const [stockAdjust, setStockAdjust] = useState({ type: 'purchase', quantity: '', unit_cost: '', note: '' });
  const [adjusting, setAdjusting] = useState(false);

  // ─── DELETE CONFIRM ─────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ─── IMPORT ─────────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importInputRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const data = await inventoryService.list();
      setProducts(data.products || []);
      setSummary(data.summary || {});
    } catch (err) {
      addNotification('Error al cargar inventario: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { loadData(); }, [loadData]);

  const existingCategories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const categories = useMemo(() => ['Todos', ...existingCategories], [existingCategories]);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (statusFilter === 'active') list = list.filter(p => p.is_active);
    else if (statusFilter === 'inactive') list = list.filter(p => !p.is_active);
    else if (statusFilter === 'low') list = list.filter(p => p.is_low_stock);
    if (activeCategory !== 'Todos') list = list.filter(p => (p.category || 'Sin categoría') === activeCategory);
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(t) ||
        (p.sku || '').toLowerCase().includes(t) ||
        (p.category || '').toLowerCase().includes(t) ||
        (p.supplier || '').toLowerCase().includes(t)
      );
    }
    return list;
  }, [products, activeCategory, searchTerm, statusFilter]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(p => {
      const key = p.category || 'Sin categoría';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [filtered]);

  const resetModalState = () => {
    setEditingProduct(null);
    setProductDetail(null);
    setModalTab('basic');
    setFormData({
      name: '', sku: '', category: '', description: '', price: '', cost: '',
      stock: '', min_stock: '5', supplier: '', is_active: true,
    });
    setNewCategoryMode(false);
    setPhotoPreview(null);
    setPendingPhotoFile(null);
    setStockAdjust({ type: 'purchase', quantity: '', unit_cost: '', note: '' });
  };

  const openCreateModal = () => {
    resetModalState();
    setShowModal(true);
  };

  const openEditModal = async (p, tab = 'basic') => {
    resetModalState();
    setEditingProduct(p);
    setFormData({
      name: p.name || '',
      sku: p.sku || '',
      category: p.category || '',
      description: p.description || '',
      price: String(p.price ?? ''),
      cost: String(p.cost ?? ''),
      stock: String(p.stock ?? ''),
      min_stock: String(p.min_stock ?? 5),
      supplier: p.supplier || '',
      is_active: p.is_active !== false,
    });
    setNewCategoryMode(p.category && !existingCategories.includes(p.category));
    setPhotoPreview(p.image_url || null);
    setModalTab(tab);
    setShowModal(true);
    try {
      const full = await inventoryService.get(p.id);
      setProductDetail(full);
    } catch (err) {
      addNotification(err.message || 'Error al cargar detalle', 'error');
    }
  };

  const closeModal = () => setShowModal(false);

  const handlePhotoSelect = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addNotification('Imagen muy grande (máx 2MB)', 'error');
      return;
    }
    setPendingPhotoFile(file);
    const r = new FileReader();
    r.onload = (e) => setPhotoPreview(e.target.result);
    r.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setPhotoPreview(null);
    setPendingPhotoFile(null);
    if (editingProduct?.image_url) {
      try { await inventoryService.deletePhoto(editingProduct.id); } catch { /* silent */ }
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!formData.name?.trim()) { addNotification('Nombre requerido', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku?.trim() || null,
        category: formData.category?.trim() || null,
        description: formData.description?.trim() || null,
        price: parseFloat(formData.price) || 0,
        cost: parseFloat(formData.cost) || 0,
        min_stock: parseInt(formData.min_stock) || 5,
        supplier: formData.supplier?.trim() || null,
        is_active: !!formData.is_active,
      };
      if (!editingProduct) payload.stock = parseInt(formData.stock) || 0;
      let saved;
      if (editingProduct) saved = await inventoryService.update(editingProduct.id, payload);
      else saved = await inventoryService.create(payload);
      if (pendingPhotoFile && (saved?.id || editingProduct?.id)) {
        try { await inventoryService.uploadPhoto(saved?.id || editingProduct.id, pendingPhotoFile); }
        catch (err) { addNotification('Producto guardado pero la foto falló: ' + err.message, 'error'); }
      }
      addNotification(editingProduct ? 'Producto actualizado' : 'Producto creado', 'success');
      setShowModal(false);
      loadData();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (p, e) => {
    e?.stopPropagation?.();
    setTogglingActive(p.id);
    try {
      await inventoryService.update(p.id, { is_active: !p.is_active });
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
    } catch (err) {
      addNotification('Error al cambiar estado: ' + err.message, 'error');
    } finally {
      setTogglingActive(null);
    }
  };

  const handleQuickStock = async (p, delta, e) => {
    e?.stopPropagation?.();
    setStockBusy(p.id);
    try {
      await inventoryService.adjustStock(p.id, {
        type: delta > 0 ? 'purchase' : 'consumption',
        quantity: delta,
        unit_cost: p.cost,
        note: delta > 0 ? 'Reposición rápida' : 'Uso interno (rápido)',
      });
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock: (x.stock || 0) + delta, is_low_stock: ((x.stock || 0) + delta) <= (x.min_stock || 0) } : x));
    } catch (err) {
      addNotification(err.message || 'Error al ajustar stock', 'error');
    } finally {
      setStockBusy(null);
    }
  };

  const handleDelete = (p, e) => { e?.stopPropagation?.(); setDeleteConfirm(p); };
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await inventoryService.delete(deleteConfirm.id);
      addNotification('Producto eliminado', 'success');
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };

  const handleAdjustStockFromModal = async () => {
    if (!editingProduct) return;
    const qty = parseInt(stockAdjust.quantity);
    if (!qty || qty === 0) { addNotification('Ingresa una cantidad', 'error'); return; }
    setAdjusting(true);
    try {
      const signed = ['loss'].includes(stockAdjust.type)
        ? -Math.abs(qty)
        : qty;
      await inventoryService.adjustStock(editingProduct.id, {
        type: stockAdjust.type,
        quantity: signed,
        unit_cost: parseFloat(stockAdjust.unit_cost) || editingProduct.cost,
        note: stockAdjust.note || null,
      });
      addNotification('Movimiento registrado', 'success');
      setStockAdjust({ type: 'purchase', quantity: '', unit_cost: '', note: '' });
      const full = await inventoryService.get(editingProduct.id);
      setProductDetail(full);
      setProducts(prev => prev.map(x => x.id === editingProduct.id ? { ...x, stock: full.stock, is_low_stock: full.stock <= full.min_stock } : x));
    } catch (err) {
      addNotification(err.message || 'Error al registrar movimiento', 'error');
    } finally {
      setAdjusting(false);
    }
  };

  const handleExport = async () => {
    try {
      await inventoryService.exportXlsx();
      addNotification('Inventario descargado', 'success');
    } catch (err) {
      addNotification(err.message || 'Error al exportar', 'error');
    }
  };

  const handleImport = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await inventoryService.importXlsx(file);
      setImportResult(result);
      if (result.imported > 0) loadData();
    } catch (err) {
      addNotification(err.message || 'Error al importar', 'error');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const movementStats = useMemo(() => {
    if (!productDetail?.movements) return { entradas: 0, vendidas: 0, perdidas: 0 };
    let entradas = 0, vendidas = 0, perdidas = 0;
    productDetail.movements.forEach(m => {
      const q = Math.abs(m.quantity || 0);
      if (m.type === 'purchase' || m.type === 'return') entradas += q;
      else if (m.type === 'sale' || m.type === 'consumption') vendidas += q;
      else if (m.type === 'loss') perdidas += q;
      // adjustment counts in neither bucket — it's a manual correction
    });
    return { entradas, vendidas, perdidas };
  }, [productDetail]);

  const margin = useMemo(() => {
    const p = parseFloat(formData.price) || 0;
    const c = parseFloat(formData.cost) || 0;
    if (!p || p === 0) return { abs: 0, pct: 0 };
    return { abs: Math.round(p - c), pct: Math.round(((p - c) / p) * 100) };
  }, [formData.price, formData.cost]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__loading`}>
          <div className={`${b}__spinner`} />
          <span>Cargando inventario...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={b}>
      {/* ── HERO HEADER ─────────────────────────────── */}
      <div className={`${b}__header`}>
        <div className={`${b}__header-left`}>
          <h1 className={`${b}__title`}>Inventario</h1>
          <p className={`${b}__subtitle`}>Productos · Stock · Movimientos · {tenant?.name}</p>
        </div>
        <div className={`${b}__header-actions`}>
          <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => handleImport(e.target.files?.[0])} />
          <button className={`${b}__action-btn`} onClick={() => importInputRef.current?.click()} disabled={importing}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {importing ? 'Importando...' : 'Importar'}
          </button>
          <button className={`${b}__action-btn`} onClick={handleExport}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>
          <button className={`${b}__add-btn`} onClick={openCreateModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo producto
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ───────────────────────────────── */}
      <div className={`${b}__stats`}>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{summary.total_products || 0}</span>
          <span className={`${b}__stat-label`}>Productos</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{formatCurrency(summary.total_stock_value || 0)}</span>
          <span className={`${b}__stat-label`}>Valor en stock (costo)</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{formatCurrency(summary.total_retail_value || 0)}</span>
          <span className={`${b}__stat-label`}>Valor en stock (venta)</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-value`}>{formatCurrency(summary.potential_profit || 0)}</span>
          <span className={`${b}__stat-label`}>Ganancia potencial</span>
        </div>
        <div className={`${b}__stat ${b}__stat--alert`}>
          <span className={`${b}__stat-value`}>{summary.low_stock_count || 0}</span>
          <span className={`${b}__stat-label`}>Stock bajo</span>
        </div>
      </div>

      {/* ── FILTERS ────────────────────────────────── */}
      <div className={`${b}__filters`}>
        <div className={`${b}__search`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Buscar por nombre, SKU, categoría o proveedor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className={`${b}__status-pills`}>
          {[
            { key: 'active', label: 'Activos', count: products.filter(p => p.is_active).length },
            { key: 'low', label: 'Stock bajo', count: products.filter(p => p.is_low_stock).length },
            { key: 'inactive', label: 'Inactivos', count: products.filter(p => !p.is_active).length },
            { key: 'all', label: 'Todos', count: products.length },
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
            <button key={cat}
              className={`${b}__tab ${activeCategory === cat ? `${b}__tab--active` : ''}`}
              onClick={() => setActiveCategory(cat)}
              style={activeCategory === cat && cat !== 'Todos' ? { '--tab-color': generateCategoryColor(cat).color } : {}}>
              {cat}
              {cat !== 'Todos' && (
                <span className={`${b}__tab-count`}>{products.filter(p => (p.category || 'Sin categoría') === cat).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIST ───────────────────────────────────── */}
      <div className={`${b}__content`}>
        {Object.keys(grouped).length === 0 ? (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
            title="No hay productos"
            description="Empieza agregando tu primer producto o importa un xlsx con todo el inventario"
            actionLabel="Nuevo producto"
            onAction={openCreateModal}
          />
        ) : (
          Object.entries(grouped).map(([category, items]) => {
            const meta = generateCategoryColor(category);
            return (
              <div key={category} className={`${b}__category`}>
                <div className={`${b}__category-header`}>
                  <div className={`${b}__category-icon`} style={{ background: meta.gradient }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  </div>
                  <div className={`${b}__category-info`}>
                    <h2 className={`${b}__category-name`}>{category}</h2>
                    <span className={`${b}__category-count`}>{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className={`${b}__list`}>
                  {items.map(p => (
                    <div key={p.id}
                      className={`${b}__row ${!p.is_active ? `${b}__row--inactive` : ''} ${p.is_low_stock ? `${b}__row--low` : ''}`}
                      style={{ '--row-accent': meta.color }}
                      onClick={() => openEditModal(p)}>
                      <div className={`${b}__row-thumb`} style={p.image_url ? {} : { background: meta.gradient }}>
                        {p.image_url ? <img src={p.image_url} alt={p.name} /> : <span>{initialsOf(p.name)}</span>}
                      </div>
                      <div className={`${b}__row-main`}>
                        <div className={`${b}__row-name`}>
                          {p.name}
                          {p.sku && <span className={`${b}__row-sku`}>{p.sku}</span>}
                        </div>
                        <div className={`${b}__row-meta-line`}>
                          <span><strong>Costo</strong> {formatCurrency(p.cost)}</span>
                          <span><strong>Margen</strong> <em style={{ color: p.margin_pct >= 30 ? '#10B981' : p.margin_pct >= 15 ? '#F59E0B' : '#EF4444' }}>{p.margin_pct}%</em></span>
                          {p.supplier && <span><strong>Proveedor</strong> {p.supplier}</span>}
                        </div>
                      </div>
                      <div className={`${b}__row-stock`} onClick={e => e.stopPropagation()}>
                        <button className={`${b}__row-stock-btn`} disabled={stockBusy === p.id || p.stock <= 0} onClick={(e) => handleQuickStock(p, -1, e)}>−</button>
                        <div className={`${b}__row-stock-val`}>
                          <strong className={p.is_low_stock ? `${b}__row-stock-low` : ''}>{p.stock}</strong>
                          <span>Min {p.min_stock}</span>
                        </div>
                        <button className={`${b}__row-stock-btn ${b}__row-stock-btn--add`} disabled={stockBusy === p.id} onClick={(e) => handleQuickStock(p, 1, e)}>+</button>
                      </div>
                      <div className={`${b}__row-price`}>
                        <strong>{formatCurrency(p.price)}</strong>
                        <span>Valor: {formatCurrency((p.stock || 0) * (p.price || 0))}</span>
                      </div>
                      <div className={`${b}__row-actions`} onClick={e => e.stopPropagation()}>
                        <button
                          className={`${b}__toggle ${p.is_active ? `${b}__toggle--on` : ''} ${togglingActive === p.id ? `${b}__toggle--loading` : ''}`}
                          onClick={(e) => handleToggleActive(p, e)}
                          disabled={togglingActive === p.id}
                          title={p.is_active ? 'Desactivar' : 'Activar'}>
                          <span className={`${b}__toggle-knob`} />
                        </button>
                        <button className={`${b}__row-icon`} onClick={() => openEditModal(p, 'movements')} title="Ver movimientos">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        </button>
                        <button className={`${b}__row-icon`} onClick={() => openEditModal(p)} title="Editar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className={`${b}__row-icon ${b}__row-icon--danger`} onClick={(e) => handleDelete(p, e)} title="Eliminar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── DELETE CONFIRM ─────────────────────────── */}
      {deleteConfirm && createPortal(
        <div className={`${b}__confirm-overlay`} onClick={() => setDeleteConfirm(null)}>
          <div className={`${b}__confirm`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__confirm-icon`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <h3 className={`${b}__confirm-title`}>Eliminar producto</h3>
            <p className={`${b}__confirm-text`}>¿Eliminar <strong>{deleteConfirm.name}</strong>? Esta acción no se puede deshacer.</p>
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h3 className={`${b}__confirm-title`}>Importación completada</h3>
            <div className={`${b}__import-summary`}>
              <div><strong>{importResult.imported}</strong> creados</div>
              <div><strong>{importResult.skipped}</strong> duplicados omitidos</div>
              <div><strong>{importResult.errors?.length || 0}</strong> errores</div>
            </div>
            {importResult.errors?.length > 0 && (
              <div className={`${b}__import-errors`}>
                {importResult.errors.slice(0, 5).map((e, i) => (<div key={i}>Fila {e.row}: {e.reason}</div>))}
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

            <aside className={`${b}__rail`}>
              <button className={`${b}__rail-close`} onClick={closeModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                <span>Volver</span>
              </button>
              <div className={`${b}__rail-id`}>
                <span className={`${b}__rail-eyebrow`}>{editingProduct ? 'Editar producto' : 'Nuevo producto'}</span>
                <h2 className={`${b}__rail-name`}>{formData.name || 'Sin nombre'}</h2>
                {formData.category && <span className={`${b}__rail-cat`}>{formData.category}</span>}
              </div>
              <div className={`${b}__rail-preview`}>
                <div className={`${b}__rail-thumb`} style={photoPreview ? {} : { background: generateCategoryColor(formData.category).gradient }}>
                  {photoPreview ? <img src={photoPreview} alt="preview" /> : <span>{initialsOf(formData.name || '?')}</span>}
                </div>
                <div className={`${b}__rail-stats`}>
                  <div><span>Precio</span><strong>{formatCurrency(parseFloat(formData.price) || 0)}</strong></div>
                  <div><span>Stock</span><strong>{editingProduct ? (productDetail?.stock ?? editingProduct.stock) : (parseInt(formData.stock) || 0)}</strong></div>
                  <div><span>Margen</span><strong style={{ color: margin.pct >= 30 ? '#10B981' : margin.pct >= 15 ? '#F59E0B' : '#EF4444' }}>{margin.pct}%</strong></div>
                </div>
              </div>
              <nav className={`${b}__rail-nav`}>
                {[
                  { key: 'basic', label: 'Información general', sub: 'Nombre, foto, precio, stock',
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  },
                  { key: 'movements', label: 'Movimientos', sub: editingProduct ? `${(productDetail?.movements || []).length} registros` : 'Disponible al guardar',
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  },
                ].map(item => (
                  <button key={item.key}
                    className={`${b}__rail-nav-item ${modalTab === item.key ? `${b}__rail-nav-item--active` : ''}`}
                    onClick={() => setModalTab(item.key)}
                    disabled={item.key === 'movements' && !editingProduct}>
                    <span className={`${b}__rail-nav-icon`}>{item.icon}</span>
                    <span className={`${b}__rail-nav-text`}>
                      <strong>{item.label}</strong>
                      <span>{item.sub}</span>
                    </span>
                    <svg className={`${b}__rail-nav-arrow`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </nav>
              {editingProduct && (
                <button className={`${b}__rail-danger`} onClick={() => { setShowModal(false); setDeleteConfirm(editingProduct); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Eliminar producto
                </button>
              )}
            </aside>

            <div className={`${b}__panel`}>
              <header className={`${b}__panel-bar`}>
                <div>
                  <h3>{modalTab === 'basic' ? 'Información del producto' : 'Movimientos de inventario'}</h3>
                  <span>
                    {modalTab === 'basic' && 'Datos visibles para venta y reportes'}
                    {modalTab === 'movements' && 'Historial completo de entradas, ventas y ajustes'}
                  </span>
                </div>
              </header>

              <div className={`${b}__modal-body`}>
                {modalTab === 'basic' && (
                  <div className={`${b}__basic`}>
                    <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoSelect(e.target.files?.[0])} />

                    <section className={`${b}__sec ${b}__sec--hero`}>
                      <div className={`${b}__hero-media`}>
                        {photoPreview ? (
                          <>
                            <img src={photoPreview} alt="preview" />
                            <div className={`${b}__hero-media-actions`}>
                              <button type="button" className={`${b}__hero-media-btn`} onClick={() => photoInputRef.current?.click()}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                Cambiar
                              </button>
                              <button type="button" className={`${b}__hero-media-btn ${b}__hero-media-btn--del`} onClick={handleRemovePhoto}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </div>
                          </>
                        ) : (
                          <button type="button" className={`${b}__hero-media-empty`} onClick={() => photoInputRef.current?.click()}>
                            <div className={`${b}__hero-media-empty-icon`}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            </div>
                            <strong>Subir foto del producto</strong>
                            <span>JPG · PNG · WEBP · máx 2 MB</span>
                            <em>Haz clic para seleccionar</em>
                          </button>
                        )}
                      </div>
                      <div className={`${b}__hero-identity`}>
                        <div className={`${b}__field ${b}__field--lg`}>
                          <label>Nombre del producto *</label>
                          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Shampoo profesional 250ml" />
                        </div>
                        <div className={`${b}__field-row`}>
                          <div className={`${b}__field`}>
                            <label>SKU / Código</label>
                            <input type="text" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="SHA-001" />
                          </div>
                          <div className={`${b}__field`}>
                            <label>Categoría</label>
                            {!newCategoryMode ? (
                              <select value={formData.category} onChange={e => {
                                if (e.target.value === '__new') { setNewCategoryMode(true); setFormData({ ...formData, category: '' }); }
                                else setFormData({ ...formData, category: e.target.value });
                              }}>
                                <option value="">Sin categoría</option>
                                {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                <option value="__new">+ Nueva categoría</option>
                              </select>
                            ) : (
                              <div className={`${b}__inline-row`}>
                                <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Cuidado capilar" autoFocus />
                                <button type="button" className={`${b}__inline-cancel`} onClick={() => setNewCategoryMode(false)}>×</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    <div className={`${b}__split-3`}>
                      <section className={`${b}__sec ${b}__sec--price`}>
                        <div className={`${b}__sec-head`}>
                          <div className={`${b}__sec-icon ${b}__sec-icon--price`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          </div>
                          <div>
                            <h4>Precio venta</h4>
                            <span>Lo que paga el cliente</span>
                          </div>
                        </div>
                        <div className={`${b}__price-input`}>
                          <span className={`${b}__price-currency`}>$</span>
                          <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="40000" className={`${b}__price-field`} />
                          <span className={`${b}__price-unit`}>COP</span>
                        </div>
                      </section>

                      <section className={`${b}__sec ${b}__sec--cost`}>
                        <div className={`${b}__sec-head`}>
                          <div className={`${b}__sec-icon ${b}__sec-icon--cost`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          </div>
                          <div>
                            <h4>Costo</h4>
                            <span>Lo que te cuesta a ti</span>
                          </div>
                        </div>
                        <div className={`${b}__cost-input`}>
                          <span className={`${b}__cost-currency`}>$</span>
                          <input type="number" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} placeholder="20000" className={`${b}__cost-field`} />
                          <span className={`${b}__cost-unit`}>COP</span>
                        </div>
                      </section>

                      <section className={`${b}__sec ${b}__sec--margin`}>
                        <div className={`${b}__sec-head`}>
                          <div className={`${b}__sec-icon ${b}__sec-icon--margin`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                          </div>
                          <div>
                            <h4>Margen</h4>
                            <span>Calculado en vivo</span>
                          </div>
                        </div>
                        <div className={`${b}__margin-display`}>
                          <strong style={{ color: margin.pct >= 30 ? '#10B981' : margin.pct >= 15 ? '#F59E0B' : '#EF4444' }}>{margin.pct}%</strong>
                          <span>{formatCurrency(margin.abs)} / unidad</span>
                        </div>
                      </section>
                    </div>

                    <section className={`${b}__sec`}>
                      <div className={`${b}__sec-head`}>
                        <div className={`${b}__sec-icon ${b}__sec-icon--stock`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                        </div>
                        <div>
                          <h4>Inventario</h4>
                          <span>{editingProduct ? 'El stock se modifica desde la pestaña Movimientos' : 'Cantidad inicial al crear el producto'}</span>
                        </div>
                      </div>
                      <div className={`${b}__field-row`}>
                        {!editingProduct && (
                          <div className={`${b}__field`}>
                            <label>Stock inicial</label>
                            <input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} placeholder="0" />
                          </div>
                        )}
                        <div className={`${b}__field`}>
                          <label>Stock mínimo (alerta)</label>
                          <input type="number" value={formData.min_stock} onChange={e => setFormData({ ...formData, min_stock: e.target.value })} placeholder="5" />
                        </div>
                        <div className={`${b}__field`}>
                          <label>Proveedor</label>
                          <input type="text" value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} placeholder="Nombre del proveedor" />
                        </div>
                      </div>
                    </section>

                    <section className={`${b}__sec`}>
                      <div className={`${b}__sec-head`}>
                        <div className={`${b}__sec-icon ${b}__sec-icon--desc`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                        </div>
                        <div>
                          <h4>Descripción</h4>
                          <span>Notas internas o descripción para venta (opcional)</span>
                        </div>
                      </div>
                      <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Descripción del producto..." rows={3} className={`${b}__desc-field`} />
                    </section>
                  </div>
                )}

                {modalTab === 'movements' && (
                  <div className={`${b}__movements`}>
                    <div className={`${b}__mv-stats`}>
                      <div className={`${b}__mv-stat ${b}__mv-stat--in`}>
                        <span className={`${b}__mv-stat-label`}>Entradas</span>
                        <strong>{movementStats.entradas}</strong>
                      </div>
                      <div className={`${b}__mv-stat ${b}__mv-stat--sold`}>
                        <span className={`${b}__mv-stat-label`}>Vendidas / Usadas</span>
                        <strong>{movementStats.vendidas}</strong>
                      </div>
                      <div className={`${b}__mv-stat ${b}__mv-stat--out`}>
                        <span className={`${b}__mv-stat-label`}>Pérdidas</span>
                        <strong>{movementStats.perdidas}</strong>
                      </div>
                    </div>

                    <section className={`${b}__sec ${b}__mv-add`}>
                      <div className={`${b}__sec-head`}>
                        <div className={`${b}__sec-icon ${b}__sec-icon--stock`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                        <div>
                          <h4>Registrar movimiento</h4>
                          <span>Entradas, ajustes, pérdidas o devoluciones</span>
                        </div>
                      </div>
                      <div className={`${b}__mv-form`}>
                        <div className={`${b}__mv-type-picker`}>
                          {Object.entries(MOVEMENT_META).filter(([k]) => k !== 'sale').map(([key, meta]) => (
                            <button key={key} type="button"
                              className={`${b}__mv-type-btn ${stockAdjust.type === key ? `${b}__mv-type-btn--active` : ''}`}
                              style={stockAdjust.type === key ? { background: meta.bg, color: meta.color, borderColor: meta.color } : {}}
                              onClick={() => setStockAdjust({ ...stockAdjust, type: key })}>
                              {meta.label}
                            </button>
                          ))}
                        </div>
                        <div className={`${b}__mv-form-row`}>
                          <input type="number" value={stockAdjust.quantity} onChange={e => setStockAdjust({ ...stockAdjust, quantity: e.target.value })} placeholder="Cantidad" />
                          <input type="number" value={stockAdjust.unit_cost} onChange={e => setStockAdjust({ ...stockAdjust, unit_cost: e.target.value })} placeholder={`Costo/u (${formatCurrency(editingProduct?.cost || 0)})`} />
                          <input type="text" value={stockAdjust.note} onChange={e => setStockAdjust({ ...stockAdjust, note: e.target.value })} placeholder="Nota (opcional)" />
                          <button type="button" className={`${b}__mv-add-btn`} onClick={handleAdjustStockFromModal} disabled={adjusting}>
                            {adjusting ? 'Guardando...' : 'Registrar'}
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className={`${b}__sec ${b}__mv-timeline-wrap`}>
                      <div className={`${b}__sec-head`}>
                        <div className={`${b}__sec-icon ${b}__sec-icon--time`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div>
                          <h4>Historial de movimientos</h4>
                          <span>{(productDetail?.movements || []).length} registros</span>
                        </div>
                      </div>
                      {!productDetail?.movements?.length ? (
                        <div className={`${b}__mv-empty`}>Aún no hay movimientos registrados</div>
                      ) : (
                        <div className={`${b}__mv-timeline`}>
                          {productDetail.movements.map((m, idx) => {
                            const meta = MOVEMENT_META[m.type] || { label: m.type, color: '#64748B', bg: 'rgba(100,116,139,0.1)' };
                            const qty = Math.abs(m.quantity || 0);
                            const sign = (m.quantity || 0) >= 0 ? '+' : '−';
                            return (
                              <div key={m.id || idx} className={`${b}__mv-item`}>
                                <div className={`${b}__mv-dot`} style={{ background: meta.color }} />
                                <div className={`${b}__mv-card`}>
                                  <div className={`${b}__mv-card-head`}>
                                    <span className={`${b}__mv-tag`} style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                                    <strong className={`${b}__mv-qty`} style={{ color: meta.color }}>{sign}{qty}</strong>
                                  </div>
                                  <div className={`${b}__mv-card-meta`}>
                                    <span>📅 {fmtDateTime(m.created_at)}</span>
                                    {(m.created_by_name || m.created_by) && <span>👤 {m.created_by_name || m.created_by}</span>}
                                    {m.staff_name && m.staff_name !== m.created_by_name && <span>✂️ {m.staff_name}</span>}
                                    {m.client_name && <span>🧑 {m.client_name}</span>}
                                    {m.unit_cost > 0 && <span>💰 {formatCurrency(m.unit_cost)}/u</span>}
                                  </div>
                                  {m.note && <div className={`${b}__mv-note`}>{m.note}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>

              <div className={`${b}__modal-footer`}>
                <span>Margen: <strong style={{ color: margin.pct >= 30 ? '#10B981' : margin.pct >= 15 ? '#F59E0B' : '#EF4444' }}>{margin.pct}%</strong></span>
                <div className={`${b}__modal-footer-actions`}>
                  <button className={`${b}__btn-cancel`} onClick={closeModal}>Cancelar</button>
                  <button className={`${b}__btn-save`} onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Guardando...' : (editingProduct ? 'Guardar cambios' : 'Crear producto')}
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

export default Inventory;
