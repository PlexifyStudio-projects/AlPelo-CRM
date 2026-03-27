import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../context/NotificationContext';
import EmptyState from '../../components/common/EmptyState/EmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'inventory';

const fetchApi = async (url, options = {}) => {
  const resp = await fetch(`${API_URL}${url}`, { credentials: 'include', ...options });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${resp.status}`);
  }
  return resp.json();
};

const MOVEMENT_LABELS = {
  purchase: { label: 'Compra', color: '#059669', icon: '+' },
  sale: { label: 'Venta', color: '#DC2626', icon: '-' },
  adjustment: { label: 'Ajuste', color: '#2563EB', icon: '~' },
  return: { label: 'Devolución', color: '#D97706', icon: '↩' },
  loss: { label: 'Pérdida', color: '#7C3AED', icon: '!' },
};

const formatCOP = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

const Inventory = () => {
  const { addNotification } = useNotification();
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [showStockModal, setShowStockModal] = useState(null);
  const [showDetail, setShowDetail] = useState(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCategory) params.append('category', filterCategory);
      if (filterLowStock) params.append('low_stock', 'true');
      if (search) params.append('search', search);
      const data = await fetchApi(`/inventory/products?${params}`);
      setProducts(data.products || []);
      setSummary(data.summary || {});
    } catch (e) {
      addNotification('Error cargando inventario: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterLowStock, search, addNotification]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchApi('/inventory/categories');
      setCategories(data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleSave = async (formData) => {
    try {
      if (editProduct) {
        await fetchApi(`/inventory/products/${editProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        addNotification('Producto actualizado', 'success');
      } else {
        await fetchApi('/inventory/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        addNotification('Producto creado', 'success');
      }
      setShowModal(false);
      setEditProduct(null);
      loadProducts();
      loadCategories();
    } catch (e) {
      addNotification('Error: ' + e.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Desactivar este producto?')) return;
    try {
      await fetchApi(`/inventory/products/${id}`, { method: 'DELETE' });
      addNotification('Producto desactivado', 'success');
      loadProducts();
    } catch (e) {
      addNotification('Error: ' + e.message, 'error');
    }
  };

  const handleStockAdjust = async (productId, data) => {
    try {
      await fetchApi(`/inventory/products/${productId}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      addNotification(`Stock ${data.type === 'purchase' ? 'agregado' : 'ajustado'}`, 'success');
      setShowStockModal(null);
      loadProducts();
    } catch (e) {
      addNotification('Error: ' + e.message, 'error');
    }
  };

  const lowStockProducts = useMemo(() => products.filter(p => p.is_low_stock), [products]);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Inventario</h1>
          <p className={`${b}__subtitle`}>Productos, stock y movimientos</p>
        </div>
        <button className={`${b}__add-btn`} onClick={() => { setEditProduct(null); setShowModal(true); }}>
          + Nuevo producto
        </button>
      </div>

      {/* KPI Cards */}
      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{summary.total_products || 0}</span>
          <span className={`${b}__kpi-label`}>Productos</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{formatCOP(summary.total_stock_value)}</span>
          <span className={`${b}__kpi-label`}>Valor en stock (costo)</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{formatCOP(summary.total_retail_value)}</span>
          <span className={`${b}__kpi-label`}>Valor en stock (venta)</span>
        </div>
        <div className={`${b}__kpi`}>
          <span className={`${b}__kpi-value`}>{formatCOP(summary.potential_profit)}</span>
          <span className={`${b}__kpi-label`}>Ganancia potencial</span>
        </div>
        <div className={`${b}__kpi ${lowStockProducts.length > 0 ? `${b}__kpi--alert` : ''}`}>
          <span className={`${b}__kpi-value`}>{summary.low_stock_count || 0}</span>
          <span className={`${b}__kpi-label`}>Stock bajo</span>
        </div>
      </div>

      {/* Low stock alert banner */}
      {lowStockProducts.length > 0 && (
        <div className={`${b}__alert-banner`}>
          <span className={`${b}__alert-icon`}>!</span>
          <span>{lowStockProducts.length} producto{lowStockProducts.length > 1 ? 's' : ''} con stock bajo: {lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}{lowStockProducts.length > 3 ? ` y ${lowStockProducts.length - 3} mas` : ''}</span>
          <button onClick={() => setFilterLowStock(true)}>Ver todos</button>
        </div>
      )}

      {/* Filters */}
      <div className={`${b}__filters`}>
        <input
          className={`${b}__search`}
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${b}__filter-select`}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">Todas las categorias</option>
          {categories.map(c => (
            <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
          ))}
        </select>
        <label className={`${b}__filter-check`}>
          <input type="checkbox" checked={filterLowStock} onChange={(e) => setFilterLowStock(e.target.checked)} />
          Solo stock bajo
        </label>
      </div>

      {/* Product table */}
      {loading ? (
        <div className={`${b}__loading`}>Cargando...</div>
      ) : products.length === 0 ? (
        <EmptyState
          title="Sin productos"
          description="Agrega tu primer producto para empezar a gestionar tu inventario"
          actionLabel="Agregar producto"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className={`${b}__table-wrap`}>
          <table className={`${b}__table`}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoria</th>
                <th>Precio</th>
                <th>Costo</th>
                <th>Margen</th>
                <th>Stock</th>
                <th>Valor</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className={p.is_low_stock ? `${b}__row--low-stock` : ''}>
                  <td>
                    <div className={`${b}__product-name`}>
                      <strong>{p.name}</strong>
                      {p.sku && <span className={`${b}__sku`}>{p.sku}</span>}
                    </div>
                  </td>
                  <td><span className={`${b}__category-chip`}>{p.category || '-'}</span></td>
                  <td>{formatCOP(p.price)}</td>
                  <td>{formatCOP(p.cost)}</td>
                  <td>
                    <span className={`${b}__margin ${p.margin_pct > 40 ? `${b}__margin--high` : p.margin_pct > 20 ? `${b}__margin--mid` : `${b}__margin--low`}`}>
                      {p.margin_pct}%
                    </span>
                  </td>
                  <td>
                    <span className={`${b}__stock ${p.is_low_stock ? `${b}__stock--low` : `${b}__stock--ok`}`}>
                      {p.stock}
                    </span>
                    {p.is_low_stock && <span className={`${b}__stock-warning`}>Min: {p.min_stock}</span>}
                  </td>
                  <td>{formatCOP(p.stock * p.price)}</td>
                  <td>
                    <div className={`${b}__actions`}>
                      <button className={`${b}__action-btn ${b}__action-btn--stock`} title="Ajustar stock" onClick={() => setShowStockModal(p)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      </button>
                      <button className={`${b}__action-btn`} title="Editar" onClick={() => { setEditProduct(p); setShowModal(true); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className={`${b}__action-btn ${b}__action-btn--delete`} title="Desactivar" onClick={() => handleDelete(p.id)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Modal */}
      {showModal && createPortal(
        <ProductModal
          product={editProduct}
          categories={categories.map(c => c.category)}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditProduct(null); }}
        />,
        document.body
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && createPortal(
        <StockModal
          product={showStockModal}
          onSave={(data) => handleStockAdjust(showStockModal.id, data)}
          onClose={() => setShowStockModal(null)}
        />,
        document.body
      )}
    </div>
  );
};


// ============================================================================
// PRODUCT MODAL — Create/Edit
// ============================================================================

const ProductModal = ({ product, categories, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    category: product?.category || '',
    description: product?.description || '',
    price: product?.price || '',
    cost: product?.cost || '',
    stock: product?.stock ?? '',
    min_stock: product?.min_stock ?? 5,
    supplier: product?.supplier || '',
  });
  const [newCategory, setNewCategory] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseInt(form.stock) || 0,
      min_stock: parseInt(form.min_stock) || 5,
      category: newCategory || form.category || null,
    };
    onSave(data);
  };

  const margin = form.price && form.cost ? ((form.price - form.cost) / form.price * 100).toFixed(1) : 0;

  return (
    <div className={`${b}__modal-overlay`} onClick={onClose}>
      <div className={`${b}__modal`} onClick={(e) => e.stopPropagation()}>
        <div className={`${b}__modal-header`}>
          <h2>{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button className={`${b}__modal-close`} onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className={`${b}__modal-form`}>
          <div className={`${b}__form-row`}>
            <div className={`${b}__form-group`}>
              <label>Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className={`${b}__form-group`}>
              <label>SKU / Codigo</label>
              <input type="text" value={form.sku} onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <div className={`${b}__form-row`}>
            <div className={`${b}__form-group`}>
              <label>Categoria</label>
              <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Sin categoria</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Nueva categoria</option>
              </select>
              {form.category === '__new__' && (
                <input type="text" className={`${b}__new-cat`} placeholder="Nombre de la categoria" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} autoFocus />
              )}
            </div>
            <div className={`${b}__form-group`}>
              <label>Proveedor</label>
              <input type="text" value={form.supplier} onChange={(e) => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <div className={`${b}__form-row ${b}__form-row--prices`}>
            <div className={`${b}__form-group`}>
              <label>Precio venta (COP)</label>
              <input type="number" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} min="0" />
            </div>
            <div className={`${b}__form-group`}>
              <label>Costo compra (COP)</label>
              <input type="number" value={form.cost} onChange={(e) => setForm(f => ({ ...f, cost: e.target.value }))} min="0" />
            </div>
            <div className={`${b}__form-group`}>
              <label>Margen</label>
              <div className={`${b}__margin-display`}>{margin}%</div>
            </div>
          </div>
          <div className={`${b}__form-row`}>
            <div className={`${b}__form-group`}>
              <label>{product ? 'Stock actual' : 'Stock inicial'}</label>
              <input type="number" value={form.stock} onChange={(e) => setForm(f => ({ ...f, stock: e.target.value }))} min="0" disabled={!!product} />
              {product && <small>Usa el boton de ajustar stock para modificar</small>}
            </div>
            <div className={`${b}__form-group`}>
              <label>Stock minimo (alerta)</label>
              <input type="number" value={form.min_stock} onChange={(e) => setForm(f => ({ ...f, min_stock: e.target.value }))} min="0" />
            </div>
          </div>
          <div className={`${b}__form-group`}>
            <label>Descripcion</label>
            <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Opcional" />
          </div>
          <div className={`${b}__modal-actions`}>
            <button type="button" className={`${b}__btn-cancel`} onClick={onClose}>Cancelar</button>
            <button type="submit" className={`${b}__btn-save`}>{product ? 'Guardar cambios' : 'Crear producto'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ============================================================================
// STOCK ADJUSTMENT MODAL
// ============================================================================

const StockModal = ({ product, onSave, onClose }) => {
  const [type, setType] = useState('purchase');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState(product.cost || '');
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      type,
      quantity: parseInt(quantity) || 0,
      unit_cost: type === 'purchase' ? parseFloat(unitCost) || 0 : undefined,
      note,
    });
  };

  const previewStock = (product.stock || 0) + (type === 'purchase' || type === 'return' ? Math.abs(parseInt(quantity) || 0) : -Math.abs(parseInt(quantity) || 0));

  return (
    <div className={`${b}__modal-overlay`} onClick={onClose}>
      <div className={`${b}__modal ${b}__modal--stock`} onClick={(e) => e.stopPropagation()}>
        <div className={`${b}__modal-header`}>
          <h2>Ajustar stock: {product.name}</h2>
          <button className={`${b}__modal-close`} onClick={onClose}>&times;</button>
        </div>
        <div className={`${b}__stock-current`}>
          Stock actual: <strong>{product.stock}</strong> unidades
        </div>
        <form onSubmit={handleSubmit} className={`${b}__modal-form`}>
          <div className={`${b}__stock-types`}>
            {[
              { value: 'purchase', label: 'Compra (+)', desc: 'Recibir mercancia' },
              { value: 'adjustment', label: 'Ajuste (+/-)', desc: 'Corregir cantidad' },
              { value: 'loss', label: 'Pérdida (-)', desc: 'Producto dañado/perdido' },
              { value: 'return', label: 'Devolución (+)', desc: 'Cliente devolvio' },
            ].map(t => (
              <button
                key={t.value}
                type="button"
                className={`${b}__stock-type ${type === t.value ? `${b}__stock-type--active` : ''}`}
                onClick={() => setType(t.value)}
              >
                <strong>{t.label}</strong>
                <small>{t.desc}</small>
              </button>
            ))}
          </div>
          <div className={`${b}__form-row`}>
            <div className={`${b}__form-group`}>
              <label>Cantidad</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" required autoFocus />
            </div>
            {type === 'purchase' && (
              <div className={`${b}__form-group`}>
                <label>Costo unitario (COP)</label>
                <input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} min="0" />
              </div>
            )}
          </div>
          {quantity && (
            <div className={`${b}__stock-preview`}>
              Stock resultante: <strong className={previewStock < 0 ? `${b}__stock-preview--negative` : ''}>{previewStock}</strong>
            </div>
          )}
          <div className={`${b}__form-group`}>
            <label>Nota (opcional)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Pedido proveedor #123" />
          </div>
          <div className={`${b}__modal-actions`}>
            <button type="button" className={`${b}__btn-cancel`} onClick={onClose}>Cancelar</button>
            <button type="submit" className={`${b}__btn-save`}>Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Inventory;
