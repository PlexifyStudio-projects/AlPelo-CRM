import { useState, useEffect, useMemo, useCallback } from 'react';
import orderService from '../../services/orderService';
import servicesService from '../../services/servicesService';
import staffService from '../../services/staffService';
import { useNotification } from '../../context/NotificationContext';

const b = 'orders';

const STATUS_META = {
  pending:     { label: 'Pendiente',   color: '#D4A017', bg: 'rgba(212,160,23,0.08)' },
  in_progress: { label: 'En proceso',  color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  completed:   { label: 'Completada',  color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  cancelled:   { label: 'Cancelada',   color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
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
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
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

const Orders = () => {
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);

  // Form state
  const [form, setForm] = useState({
    client_name: '', client_phone: '', client_email: '',
    client_doc_type: '', client_doc_number: '',
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
      const [orderList, svcList, staffData, invData] = await Promise.all([
        orderService.list(),
        servicesService.list(),
        staffService.list(),
        fetch(`${API}/inventory/products`, { credentials: 'include' }).then(r => r.ok ? r.json() : { products: [] }).catch(() => ({ products: [] })),
      ]);
      setOrders(orderList);
      setServices(svcList.filter(s => s.is_active));
      setStaffList(staffData.filter(s => s.is_active !== false));
      setProducts(invData?.products || []);
    } catch (err) {
      addNotification('Error al cargar órdenes: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = [...orders];
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      list = list.filter(o => {
        if (o.ticket_number.toLowerCase().includes(q)) return true;
        if (o.client_name.toLowerCase().includes(q)) return true;
        if (qDigits && o.client_phone) {
          const ph = o.client_phone.replace(/\D/g, '');
          if (ph.includes(qDigits)) return true;
        }
        return false;
      });
    }
    return list;
  }, [orders, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { all: orders.length, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    orders.forEach(o => { if (c[o.status] !== undefined) c[o.status]++; });
    return c;
  }, [orders]);

  const openCreate = () => {
    setEditOrder(null);
    setForm({ client_name: '', client_phone: '', client_email: '', client_doc_type: '', client_doc_number: '', staff_id: '', notes: '' });
    setFormItems([]);
    setFormProducts([]);
    setShowModal(true);
  };

  const openEdit = (o) => {
    setEditOrder(o);
    setForm({
      client_name: o.client_name || '', client_phone: o.client_phone || '',
      client_email: o.client_email || '', client_doc_type: o.client_doc_type || '',
      client_doc_number: o.client_doc_number || '', staff_id: o.staff_id || '',
      notes: o.notes || '',
    });
    setFormItems(o.items?.map(i => ({ service_id: i.service_id, service_name: i.service_name, price: i.price, duration_minutes: i.duration_minutes, staff_id: i.staff_id })) || []);
    setFormProducts(o.products?.map(p => ({ product_id: p.product_id, product_name: p.product_name, quantity: p.quantity, unit_price: p.unit_price, charged_to: p.charged_to })) || []);
    setShowModal(true);
  };

  const addService = (svc) => {
    setFormItems(prev => [...prev, { service_id: svc.id, service_name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, staff_id: '' }]);
    setSvcSearch('');
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

  const handleSave = async () => {
    if (!form.client_name.trim()) { addNotification('Nombre del cliente requerido', 'error'); return; }
    if (!formItems.length) { addNotification('Agrega al menos un servicio', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        staff_id: form.staff_id ? parseInt(form.staff_id) : null,
        items: formItems,
        products: formProducts,
      };
      if (editOrder) {
        await orderService.update(editOrder.id, payload);
        addNotification('Orden actualizada', 'success');
      } else {
        await orderService.create(payload);
        addNotification('Orden creada', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    try {
      await orderService.update(order.id, { status: newStatus });
      addNotification(`Orden ${STATUS_META[newStatus]?.label || newStatus}`, 'success');
      loadData();
    } catch (err) { addNotification(err.message, 'error'); }
  };

  const handlePay = async (order) => {
    try {
      await orderService.update(order.id, { payment_status: 'paid', status: 'completed' });
      addNotification('Pago registrado', 'success');
      loadData();
    } catch (err) { addNotification(err.message, 'error'); }
  };

  const filteredSvc = svcSearch.length >= 2
    ? services.filter(s => s.name.toLowerCase().includes(svcSearch.toLowerCase()) && !formItems.some(fi => fi.service_id === s.id))
    : [];

  const filteredProd = prodSearch.length >= 2
    ? products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()) && !formProducts.some(fp => fp.product_id === p.id))
    : [];

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div className={`${b}__header-left`}>
          <h1 className={`${b}__title`}>Órdenes</h1>
          <span className={`${b}__subtitle`}>{orders.length} total</span>
        </div>
        <button className={`${b}__create-btn`} onClick={openCreate}>
          <PlusIcon /> Nueva orden
        </button>
      </div>

      <div className={`${b}__toolbar`}>
        <div className={`${b}__search`}>
          <SearchIcon />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ticket, teléfono o nombre..." />
        </div>
        <div className={`${b}__filters`}>
          {[
            { key: 'all', label: 'Todas' },
            { key: 'pending', label: 'Pendientes' },
            { key: 'in_progress', label: 'En proceso' },
            { key: 'completed', label: 'Completadas' },
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
        <div className={`${b}__loading`}>Cargando órdenes...</div>
      ) : filtered.length === 0 ? (
        <div className={`${b}__empty`}>
          <TicketIcon />
          <p>No hay órdenes{statusFilter !== 'all' ? ` ${STATUS_META[statusFilter]?.label?.toLowerCase() || ''}s` : ''}</p>
          <button onClick={openCreate}><PlusIcon /> Crear primera orden</button>
        </div>
      ) : (
        <div className={`${b}__grid`}>
          {filtered.map(o => {
            const st = STATUS_META[o.status] || STATUS_META.pending;
            const py = PAYMENT_META[o.payment_status] || PAYMENT_META.unpaid;
            return (
              <div key={o.id} className={`${b}__card`} onClick={() => openEdit(o)}>
                <div className={`${b}__card-top`}>
                  <div className={`${b}__card-ticket`}>
                    <TicketIcon /> {o.ticket_number}
                  </div>
                  <span className={`${b}__card-status`} style={{ color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                </div>

                <div className={`${b}__card-client`}>
                  <strong>{o.client_name}</strong>
                  {o.client_phone && <span>{o.client_phone}</span>}
                </div>

                <div className={`${b}__card-services`}>
                  {o.items?.slice(0, 3).map((item, i) => (
                    <span key={i} className={`${b}__card-svc`}>{item.service_name}</span>
                  ))}
                  {(o.items?.length || 0) > 3 && <span className={`${b}__card-svc ${b}__card-svc--more`}>+{o.items.length - 3} más</span>}
                </div>

                <div className={`${b}__card-staff`}>
                  {o.staff_name
                    ? <span className={`${b}__card-assigned`}>{o.staff_name}</span>
                    : <span className={`${b}__card-unassigned`}>Sin asignar</span>
                  }
                </div>

                <div className={`${b}__card-bottom`}>
                  <div className={`${b}__card-time`}>
                    <ClockIcon /> {fmtTime(o.arrival_time)}
                  </div>
                  <div className={`${b}__card-total`}>
                    {formatCOP(o.total)}
                  </div>
                </div>

                <div className={`${b}__card-pay`} style={{ color: py.color }}>
                  {py.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL ────────────────────────────────────── */}
      {showModal && (
        <div className={`${b}__overlay`} onClick={() => setShowModal(false)}>
          <div className={`${b}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__modal-header`}>
              <h2>{editOrder ? `Orden ${editOrder.ticket_number}` : 'Nueva orden'}</h2>
              <div className={`${b}__modal-header-actions`}>
                {editOrder && editOrder.status === 'pending' && (
                  <button className={`${b}__modal-action ${b}__modal-action--start`}
                    onClick={() => { handleStatusChange(editOrder, 'in_progress'); setShowModal(false); }}>
                    Iniciar servicio
                  </button>
                )}
                {editOrder && editOrder.payment_status === 'unpaid' && editOrder.status !== 'cancelled' && (
                  <button className={`${b}__modal-action ${b}__modal-action--pay`}
                    onClick={() => { handlePay(editOrder); setShowModal(false); }}>
                    Registrar pago
                  </button>
                )}
                <button className={`${b}__modal-close`} onClick={() => setShowModal(false)}><XIcon /></button>
              </div>
            </div>

            <div className={`${b}__modal-body`}>
              {/* Client info */}
              <div className={`${b}__section`}>
                <h3 className={`${b}__section-title`}>Cliente</h3>
                <div className={`${b}__form-grid`}>
                  <div className={`${b}__field`}>
                    <label>Nombre completo *</label>
                    <input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} />
                  </div>
                  <div className={`${b}__field`}>
                    <label>Teléfono</label>
                    <input value={form.client_phone} onChange={e => setForm(p => ({ ...p, client_phone: e.target.value }))} />
                  </div>
                  <div className={`${b}__field`}>
                    <label>Correo</label>
                    <input value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} />
                  </div>
                  <div className={`${b}__field ${b}__field--half`}>
                    <label>Tipo doc.</label>
                    <select value={form.client_doc_type} onChange={e => setForm(p => ({ ...p, client_doc_type: e.target.value }))}>
                      <option value="">—</option>
                      <option value="CC">CC</option>
                      <option value="CE">CE</option>
                      <option value="TI">TI</option>
                      <option value="PP">Pasaporte</option>
                      <option value="NIT">NIT</option>
                    </select>
                  </div>
                  <div className={`${b}__field ${b}__field--half`}>
                    <label>Documento</label>
                    <input value={form.client_doc_number} onChange={e => setForm(p => ({ ...p, client_doc_number: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Staff */}
              <div className={`${b}__section`}>
                <h3 className={`${b}__section-title`}>Personal <span className={`${b}__optional`}>(opcional)</span></h3>
                <select className={`${b}__staff-select`} value={form.staff_id} onChange={e => setForm(p => ({ ...p, staff_id: e.target.value }))}>
                  <option value="">Sin asignar por ahora</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role_category || 'Staff'}</option>)}
                </select>
              </div>

              {/* Services */}
              <div className={`${b}__section`}>
                <h3 className={`${b}__section-title`}>Servicios</h3>
                {formItems.length > 0 && (
                  <div className={`${b}__item-list`}>
                    {formItems.map((item, i) => (
                      <div key={i} className={`${b}__item-row`}>
                        <span className={`${b}__item-name`}>{item.service_name}</span>
                        <span className={`${b}__item-dur`}>{item.duration_minutes}min</span>
                        <span className={`${b}__item-price`}>{formatCOP(item.price)}</span>
                        <button className={`${b}__item-remove`} onClick={() => removeService(i)}><TrashIcon /></button>
                      </div>
                    ))}
                  </div>
                )}
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

              {/* Products */}
              <div className={`${b}__section`}>
                <h3 className={`${b}__section-title`}>Productos gastados <span className={`${b}__optional`}>(opcional)</span></h3>
                {formProducts.length > 0 && (
                  <div className={`${b}__item-list`}>
                    {formProducts.map((prod, i) => (
                      <div key={i} className={`${b}__item-row ${b}__item-row--product`}>
                        <span className={`${b}__item-name`}>{prod.product_name}</span>
                        <div className={`${b}__prod-fields`}>
                          <label>Cant.
                            <input type="number" min="1" value={prod.quantity} onChange={e => updateProduct(i, 'quantity', parseInt(e.target.value) || 1)} />
                          </label>
                          <label>Precio
                            <input type="number" value={prod.unit_price} onChange={e => updateProduct(i, 'unit_price', parseInt(e.target.value) || 0)} />
                          </label>
                          <label>Cobra a
                            <select value={prod.charged_to} onChange={e => updateProduct(i, 'charged_to', e.target.value)}>
                              <option value="client">Cliente</option>
                              <option value="staff">Personal</option>
                            </select>
                          </label>
                        </div>
                        <span className={`${b}__item-price`}>{formatCOP(prod.quantity * prod.unit_price)}</span>
                        <button className={`${b}__item-remove`} onClick={() => removeProduct(i)}><TrashIcon /></button>
                      </div>
                    ))}
                  </div>
                )}
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

              {/* Notes */}
              <div className={`${b}__section`}>
                <h3 className={`${b}__section-title`}>Notas <span className={`${b}__optional`}>(opcional)</span></h3>
                <textarea className={`${b}__notes`} rows="2" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Indicaciones, preferencias..." />
              </div>
            </div>

            <div className={`${b}__modal-footer`}>
              <div className={`${b}__modal-total`}>
                <span>Subtotal</span>
                <strong>{formatCOP(formSubtotal)}</strong>
              </div>
              <div className={`${b}__modal-actions`}>
                <button className={`${b}__btn-cancel`} onClick={() => setShowModal(false)}>Cancelar</button>
                <button className={`${b}__btn-save`} onClick={handleSave} disabled={submitting}>
                  {submitting ? 'Guardando...' : editOrder ? 'Guardar cambios' : 'Crear orden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
