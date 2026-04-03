import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatPhone } from '../../../utils/formatters';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const b = 'checkout-modal';

const fmt = (n) => `$${(n || 0).toLocaleString('es-CO')}`;

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CashIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><line x1="6" y1="12" x2="6.01" y2="12" /><line x1="18" y1="12" x2="18.01" y2="12" />
  </svg>
);
const TransferIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M2 12h20M2 12l4-4M2 12l4 4M22 6H2M22 6l-4-4M22 6l-4 4" />
  </svg>
);
const CardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);
const MixedIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="8" cy="12" r="6" /><circle cx="16" cy="12" r="6" />
  </svg>
);

const STEPS = ['Servicios', 'Descuento y propina', 'Pago', 'Confirmar'];

const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: CashIcon, color: '#10B981' },
  { id: 'nequi', label: 'Nequi', icon: null, color: '#6B21A8' },
  { id: 'daviplata', label: 'Daviplata', icon: null, color: '#DC2626' },
  { id: 'transferencia', label: 'Bancolombia', icon: null, color: '#FDDA24', letter: 'B' },
  { id: 'tarjeta', label: 'Tarjeta', icon: CardIcon, color: '#64748B' },
  { id: 'mixto', label: 'Mixto', icon: MixedIcon, color: null },
];

const DISCOUNT_PERCENTAGES = [5, 10, 15, 20];

const PRODUCTS_TAG = '<!--PRODUCTS:';
const PRODUCTS_TAG_END = ':PRODUCTS-->';
const deserializeProducts = (notes) => {
  if (!notes) return [];
  const start = notes.indexOf(PRODUCTS_TAG);
  if (start === -1) return [];
  const end = notes.indexOf(PRODUCTS_TAG_END);
  if (end === -1) return [];
  try {
    const data = JSON.parse(notes.substring(start + PRODUCTS_TAG.length, end));
    return data.map(p => ({ productId: p.id, name: p.name, basePrice: p.base, salePrice: p.sale, qty: p.qty, commission: p.comm }));
  } catch { return []; }
};

const CheckoutModal = ({ appointment, onClose, onCompleted }) => {
  const [step, setStep] = useState(0);

  const [items, setItems] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);

  const [discountType, setDiscountType] = useState('none');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountFixed, setDiscountFixed] = useState('');
  const [tipAmount, setTipAmount] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [mixedRows, setMixedRows] = useState([{ method: '', amount: '' }]);

  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [productItems, setProductItems] = useState([]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (!appointment) return;
    setClientName(appointment.client_name || 'Cliente');
    setSelectedClientId(appointment.client_id);
    setItems([{
      id: crypto.randomUUID(),
      service_id: appointment.service_id,
      service_name: appointment.service_name || 'Servicio',
      staff_name: appointment.staff_name || 'Staff',
      staff_id: appointment.staff_id,
      price: appointment.price || 0,
    }]);
    setProductItems(deserializeProducts(appointment.notes));
  }, [appointment]);

  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/clients/?search=${encodeURIComponent(clientSearch)}&limit=6`, { credentials: 'include' });
        if (res.ok) setClientResults(await res.json());
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  useEffect(() => {
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const res = await fetch(`${API_URL}/services/?active=true`, { credentials: 'include' });
        if (res.ok) setAllServices(await res.json());
      } catch {}
      setLoadingServices(false);
    };
    fetchServices();
  }, []);

  const servicesTotal = useMemo(() => items.reduce((s, i) => s + (i.price || 0), 0), [items]);
  const productsTotal = useMemo(() => productItems.reduce((s, p) => s + (p.salePrice || 0) * (p.qty || 1), 0), [productItems]);
  const subtotal = useMemo(() => servicesTotal + productsTotal, [servicesTotal, productsTotal]);
  const [staffCommissionRate, setStaffCommissionRate] = useState(40);

  useEffect(() => {
    if (!appointment?.staff_id) return;
    fetch(`${API_URL}/finances/commissions/config`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const staffConfig = data.find(c => c.staff_id === appointment.staff_id);
        if (staffConfig?.default_rate) {
          setStaffCommissionRate(Math.round(staffConfig.default_rate * 100));
        }
      })
      .catch(() => {});
  }, [appointment?.staff_id]);

  const commissionAmount = useMemo(() => Math.round(subtotal * (staffCommissionRate / 100)), [subtotal, staffCommissionRate]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') return Math.round(subtotal * (discountPercent / 100));
    if (discountType === 'fixed') return parseInt(discountFixed, 10) || 0;
    return 0;
  }, [discountType, discountPercent, discountFixed, subtotal]);

  const tip = useMemo(() => parseInt(tipAmount, 10) || 0, [tipAmount]);
  const total = useMemo(() => Math.max(0, subtotal - discountAmount + tip), [subtotal, discountAmount, tip]);

  const cashChange = useMemo(() => {
    const received = parseInt(cashReceived, 10) || 0;
    return Math.max(0, received - total);
  }, [cashReceived, total]);

  const mixedTotal = useMemo(
    () => mixedRows.reduce((s, r) => s + (parseInt(r.amount, 10) || 0), 0),
    [mixedRows]
  );

  const filteredAddServices = useMemo(() => {
    if (!serviceSearch.trim()) return allServices;
    const q = serviceSearch.toLowerCase();
    return allServices.filter(s => s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q));
  }, [allServices, serviceSearch]);

  const canProceed = useMemo(() => {
    if (step === 0) return items.length > 0;
    if (step === 1) return true;
    if (step === 2) {
      if (!paymentMethod) return false;
      if (paymentMethod === 'efectivo') return (parseInt(cashReceived, 10) || 0) >= total;
      if (paymentMethod === 'mixto') return mixedTotal === total && mixedRows.every(r => r.method && r.amount);
      return true;
    }
    return true;
  }, [step, items, paymentMethod, cashReceived, total, mixedTotal, mixedRows]);

  const addServiceItem = useCallback((svc) => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      service_id: svc.id,
      service_name: svc.name,
      staff_name: appointment?.staff_name || 'Staff',
      staff_id: appointment?.staff_id,
      price: svc.price || 0,
    }]);
    setShowAddService(false);
    setServiceSearch('');
  }, [appointment]);

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const addMixedRow = useCallback(() => {
    setMixedRows(prev => [...prev, { method: '', amount: '' }]);
  }, []);

  const updateMixedRow = useCallback((idx, field, value) => {
    setMixedRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, []);

  const removeMixedRow = useCallback((idx) => {
    setMixedRows(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const payload = {
        appointment_id: appointment.id,
        client_id: selectedClientId || appointment.client_id,
        client_name: clientName || appointment.client_name,
        items: items.map(i => ({
          service_id: i.service_id || null,
          service_name: i.name || i.service_name || 'Servicio',
          quantity: 1,
          unit_price: i.price || 0,
          staff_id: i.staff_id || null,
          staff_name: i.staff_name || null,
        })),
        subtotal,
        discount_type: discountType === 'none' ? null : discountType,
        discount_value: discountType === 'percent' ? discountPercent : (discountType === 'fixed' ? (parseInt(discountFixed, 10) || 0) : 0),
        discount_amount: discountAmount,
        tip,
        total,
        payment_method: paymentMethod,
        payment_details: paymentMethod === 'efectivo'
          ? { received: parseInt(cashReceived, 10) || 0, change: cashChange }
          : paymentMethod === 'mixto'
            ? { splits: mixedRows.map(r => ({ method: r.method, amount: parseInt(r.amount, 10) || 0 })) }
            : null,
        send_whatsapp_receipt: false,
      };

      const res = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail = errData.detail;
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
          : JSON.stringify(detail);
        throw new Error(msg || 'Error al procesar el cobro');
      }

      const result = await res.json();
      onCompleted?.(result);
    } catch (err) {
      setCheckoutError(typeof err.message === 'string' ? err.message : 'Error al procesar el cobro');
    }
    setSubmitting(false);
  }, [appointment, selectedClientId, clientName, items, subtotal, discountType, discountPercent, discountFixed, discountAmount, tip, total, paymentMethod, cashReceived, cashChange, mixedRows, onCompleted]);

  if (!appointment) return null;

  const getPaymentLabel = (id) => PAYMENT_METHODS.find(p => p.id === id)?.label || id;

  const renderServices = () => (
    <div className={`${b}__step`}>
      <div className={`${b}__client-section`}>
        {showClientSearch ? (
          <div className={`${b}__client-search-wrap`}>
            <div className={`${b}__client-search-box`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                type="text"
                placeholder="Buscar cliente por nombre o telefono..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                autoFocus
              />
              <button type="button" onClick={() => { setShowClientSearch(false); setClientSearch(''); setClientResults([]); }}>
                <CloseIcon />
              </button>
            </div>
            {clientResults.length > 0 && (
              <div className={`${b}__client-results`}>
                {clientResults.map(c => (
                  <button key={c.id} className={`${b}__client-option`} onClick={() => {
                    setClientName(c.name);
                    setSelectedClientId(c.id);
                    setShowClientSearch(false);
                    setClientSearch('');
                    setClientResults([]);
                  }} type="button">
                    <span className={`${b}__client-option-name`}>{c.name}</span>
                    <span className={`${b}__client-option-phone`}>{formatPhone(c.phone)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={`${b}__client-display`}>
            <div className={`${b}__client-avatar`}>{clientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
            <span className={`${b}__client-name-text`}>{clientName}</span>
            <button className={`${b}__client-change`} onClick={() => setShowClientSearch(true)} type="button">Cambiar</button>
          </div>
        )}
      </div>

      <div className={`${b}__items`}>
        {items.map((item) => (
          <div key={item.id} className={`${b}__item`}>
            <div className={`${b}__item-info`}>
              <span className={`${b}__item-name`}>{item.service_name}</span>
              <span className={`${b}__item-staff`}>{item.staff_name}</span>
            </div>
            <div className={`${b}__item-actions`}>
              <span className={`${b}__item-price`}>{fmt(item.price)}</span>
              {items.length > 1 && (
                <button className={`${b}__item-remove`} onClick={() => removeItem(item.id)} type="button" title="Eliminar">
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddService ? (
        <div className={`${b}__add-service`}>
          <input
            className={`${b}__add-service-search`}
            type="text"
            placeholder="Buscar servicio..."
            value={serviceSearch}
            onChange={(e) => setServiceSearch(e.target.value)}
            autoFocus
          />
          <div className={`${b}__add-service-list`}>
            {loadingServices ? (
              <div className={`${b}__add-service-loading`}>Cargando...</div>
            ) : filteredAddServices.length === 0 ? (
              <div className={`${b}__add-service-empty`}>Sin resultados</div>
            ) : (
              filteredAddServices.map(svc => (
                <button key={svc.id} className={`${b}__add-service-option`} onClick={() => addServiceItem(svc)} type="button">
                  <span className={`${b}__add-service-option-name`}>{svc.name}</span>
                  <span className={`${b}__add-service-option-price`}>{fmt(svc.price)}</span>
                </button>
              ))
            )}
          </div>
          <button className={`${b}__add-service-cancel`} onClick={() => { setShowAddService(false); setServiceSearch(''); }} type="button">
            Cancelar
          </button>
        </div>
      ) : (
        <button className={`${b}__add-btn`} onClick={() => setShowAddService(true)} type="button">
          <PlusIcon /> Agregar servicio
        </button>
      )}

      {productItems.length > 0 && (
        <div className={`${b}__products-section`}>
          <label className={`${b}__section-label`}>Productos utilizados</label>
          {productItems.map((p, i) => (
            <div key={i} className={`${b}__product-row`}>
              <div className={`${b}__product-info`}>
                <span className={`${b}__product-name`}>{p.name}</span>
                <span className={`${b}__product-meta`}>{fmt(p.salePrice)} x{p.qty}{p.commission ? ` · Comision: ${fmt(p.commission)}` : ''}</span>
              </div>
              <span className={`${b}__product-total`}>{fmt(p.salePrice * p.qty)}</span>
            </div>
          ))}
        </div>
      )}

      <div className={`${b}__subtotal`}>
        {productItems.length > 0 && (
          <>
            <div className={`${b}__subtotal-line`}><span>Servicios</span><span>{fmt(servicesTotal)}</span></div>
            <div className={`${b}__subtotal-line`}><span>Productos</span><span>{fmt(productsTotal)}</span></div>
          </>
        )}
        <div className={`${b}__subtotal-main`}><span>Subtotal</span><span className={`${b}__subtotal-value`}>{fmt(subtotal)}</span></div>
      </div>
    </div>
  );

  const renderDiscount = () => (
    <div className={`${b}__step`}>
      <div className={`${b}__section`}>
        <label className={`${b}__section-label`}>Descuento</label>
        <div className={`${b}__discount-tabs`}>
          {[
            { id: 'none', label: 'Sin descuento' },
            { id: 'percent', label: 'Porcentaje' },
            { id: 'fixed', label: 'Monto fijo' },
          ].map(t => (
            <button
              key={t.id}
              className={`${b}__discount-tab ${discountType === t.id ? `${b}__discount-tab--active` : ''}`}
              onClick={() => { setDiscountType(t.id); setDiscountPercent(0); setDiscountFixed(''); }}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>

        {discountType === 'percent' && (
          <div className={`${b}__discount-percent`}>
            <div className={`${b}__discount-presets`}>
              {DISCOUNT_PERCENTAGES.map(p => (
                <button
                  key={p}
                  className={`${b}__discount-preset ${discountPercent === p ? `${b}__discount-preset--active` : ''}`}
                  onClick={() => setDiscountPercent(p)}
                  type="button"
                >
                  {p}%
                </button>
              ))}
            </div>
            <div className={`${b}__discount-custom`}>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Otro %"
                value={discountPercent && !DISCOUNT_PERCENTAGES.includes(discountPercent) ? discountPercent : ''}
                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                className={`${b}__input`}
              />
              <span className={`${b}__input-suffix`}>%</span>
            </div>
          </div>
        )}

        {discountType === 'fixed' && (
          <div className={`${b}__discount-fixed`}>
            <span className={`${b}__input-prefix`}>$</span>
            <input
              type="number"
              min="0"
              placeholder="Monto del descuento"
              value={discountFixed}
              onChange={(e) => setDiscountFixed(e.target.value)}
              className={`${b}__input`}
            />
          </div>
        )}
      </div>

      <div className={`${b}__section`}>
        <label className={`${b}__section-label`}>Propina (opcional)</label>
        <div className={`${b}__tip-input`}>
          <span className={`${b}__input-prefix`}>$</span>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={tipAmount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 999999)) {
                setTipAmount(val);
              }
            }}
            className={`${b}__input`}
          />
        </div>
      </div>

      <div className={`${b}__summary-lines`}>
        <div className={`${b}__summary-line`}>
          <span>Subtotal</span><span>{fmt(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className={`${b}__summary-line ${b}__summary-line--discount`}>
            <span>Descuento{discountType === 'percent' ? ` (${discountPercent}%)` : ''}</span>
            <span>-{fmt(discountAmount)}</span>
          </div>
        )}
        {tip > 0 && (
          <div className={`${b}__summary-line ${b}__summary-line--tip`}>
            <span>Propina</span><span>+{fmt(tip)}</span>
          </div>
        )}
        <div className={`${b}__summary-line ${b}__summary-line--total`}>
          <span>Total</span><span>{fmt(total)}</span>
        </div>
      </div>
    </div>
  );

  const renderPayment = () => (
    <div className={`${b}__step`}>
      <div className={`${b}__payment-grid`}>
        {PAYMENT_METHODS.map(pm => {
          const Icon = pm.icon;
          const isSelected = paymentMethod === pm.id;
          return (
            <button
              key={pm.id}
              className={`${b}__payment-card ${isSelected ? `${b}__payment-card--selected` : ''}`}
              onClick={() => { setPaymentMethod(pm.id); setCashReceived(''); setMixedRows([{ method: '', amount: '' }]); }}
              type="button"
              data-method={pm.id}
            >
              <div className={`${b}__payment-card-icon`}>
                {Icon ? <Icon /> : <span className={`${b}__payment-card-letter`} style={pm.color ? { background: pm.color, color: pm.id === 'transferencia' ? '#003DA5' : '#fff' } : {}}>{pm.letter || pm.label[0]}</span>}
              </div>
              <span className={`${b}__payment-card-label`}>{pm.label}</span>
              {isSelected && <div className={`${b}__payment-card-check`}><CheckIcon /></div>}
            </button>
          );
        })}
      </div>

      {paymentMethod === 'efectivo' && (
        <div className={`${b}__cash-section`}>
          <label className={`${b}__section-label`}>Monto recibido</label>
          <div className={`${b}__cash-row`}>
            <div className={`${b}__cash-input`}>
              <span className={`${b}__input-prefix`}>$</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className={`${b}__input`}
                autoFocus
              />
            </div>
            <button type="button" className={`${b}__cash-exact`} onClick={() => setCashReceived(String(total))}>
              Monto completo
            </button>
          </div>
          {(parseInt(cashReceived, 10) || 0) >= total && (parseInt(cashReceived, 10) || 0) > 0 && (
            <div className={`${b}__cash-change`}>
              <span>Cambio</span>
              <span className={`${b}__cash-change-value`}>{fmt(cashChange)}</span>
            </div>
          )}
        </div>
      )}

      {['nequi', 'daviplata', 'transferencia'].includes(paymentMethod) && (
        <div className={`${b}__receipt-section`}>
          <label className={`${b}__section-label`}>Comprobante de pago (opcional)</label>
          <div className={`${b}__receipt-upload`}>
            {receiptFile ? (
              <div className={`${b}__receipt-preview`}>
                <img src={URL.createObjectURL(receiptFile)} alt="Comprobante" />
                <button type="button" className={`${b}__receipt-remove`} onClick={() => setReceiptFile(null)}>
                  <CloseIcon />
                </button>
              </div>
            ) : (
              <label className={`${b}__receipt-drop`}>
                <input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} hidden />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Subir foto o PDF del comprobante</span>
              </label>
            )}
          </div>
        </div>
      )}

      {paymentMethod === 'mixto' && (
        <div className={`${b}__mixed-section`}>
          <label className={`${b}__section-label`}>Dividir pago ({fmt(total)})</label>
          {mixedRows.map((row, idx) => (
            <div key={idx} className={`${b}__mixed-row`}>
              <select
                className={`${b}__mixed-select`}
                value={row.method}
                onChange={(e) => updateMixedRow(idx, 'method', e.target.value)}
              >
                <option value="">Metodo...</option>
                {PAYMENT_METHODS.filter(p => p.id !== 'mixto').map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <div className={`${b}__mixed-amount`}>
                <span className={`${b}__input-prefix`}>$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={row.amount}
                  onChange={(e) => updateMixedRow(idx, 'amount', e.target.value)}
                  className={`${b}__input`}
                />
              </div>
              {mixedRows.length > 1 && (
                <button className={`${b}__mixed-remove`} onClick={() => removeMixedRow(idx)} type="button">
                  <TrashIcon />
                </button>
              )}
            </div>
          ))}
          <button className={`${b}__add-btn`} onClick={addMixedRow} type="button">
            <PlusIcon /> Agregar metodo
          </button>
          <div className={`${b}__mixed-status ${mixedTotal === total ? `${b}__mixed-status--ok` : `${b}__mixed-status--pending`}`}>
            <span>{fmt(mixedTotal)} / {fmt(total)}</span>
            {mixedTotal === total && <CheckIcon />}
          </div>
        </div>
      )}

      <div className={`${b}__payment-total`}>
        <span>Total a cobrar</span>
        <span className={`${b}__payment-total-value`}>{fmt(total)}</span>
      </div>
    </div>
  );

  const renderConfirm = () => (
    <div className={`${b}__step`}>
      <div className={`${b}__receipt`}>
        <div className={`${b}__receipt-header`}>
          <span className={`${b}__receipt-title`}>Resumen de cobro</span>
          <span className={`${b}__receipt-client`}>{clientName}</span>
        </div>

        <div className={`${b}__receipt-items`}>
          {items.map(item => (
            <div key={item.id} className={`${b}__receipt-item`}>
              <span>{item.service_name}</span>
              <span>{fmt(item.price)}</span>
            </div>
          ))}
          {productItems.length > 0 && (
            <>
              <div className={`${b}__receipt-divider`} />
              {productItems.map((p, i) => (
                <div key={`p-${i}`} className={`${b}__receipt-item`}>
                  <span>{p.name} x{p.qty}</span>
                  <span>{fmt(p.salePrice * p.qty)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className={`${b}__receipt-totals`}>
          <div className={`${b}__receipt-line`}>
            <span>Subtotal</span><span>{fmt(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className={`${b}__receipt-line ${b}__receipt-line--discount`}>
              <span>Descuento{discountType === 'percent' ? ` (${discountPercent}%)` : ''}</span>
              <span>-{fmt(discountAmount)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className={`${b}__receipt-line ${b}__receipt-line--tip`}>
              <span>Propina</span><span>+{fmt(tip)}</span>
            </div>
          )}
          <div className={`${b}__receipt-line ${b}__receipt-line--grand`}>
            <span>TOTAL</span><span>{fmt(total)}</span>
          </div>
        </div>

        <div className={`${b}__receipt-payment`}>
          <span>Pago:</span>
          <span>{paymentMethod === 'mixto'
            ? mixedRows.map(r => `${getPaymentLabel(r.method)} ${fmt(parseInt(r.amount, 10) || 0)}`).join(' + ')
            : getPaymentLabel(paymentMethod)
          }</span>
        </div>
        {paymentMethod === 'efectivo' && (parseInt(cashReceived, 10) || 0) > total && (
          <div className={`${b}__receipt-payment`}>
            <span>Cambio:</span>
            <span>{fmt(cashChange)}</span>
          </div>
        )}

        <div className={`${b}__receipt-breakdown`}>
          <div className={`${b}__receipt-breakdown-title`}>Desglose</div>
          <div className={`${b}__receipt-breakdown-row`}>
            <span>Profesional</span>
            <span className={`${b}__receipt-breakdown-value`}>{appointment.staff_name}</span>
          </div>
          <div className={`${b}__receipt-breakdown-row`}>
            <span>Comision staff ({staffCommissionRate}%)</span>
            <span className={`${b}__receipt-breakdown-value`} style={{ color: '#059669' }}>{fmt(commissionAmount)}</span>
          </div>
          <div className={`${b}__receipt-breakdown-row`}>
            <span>Ganancia negocio</span>
            <span className={`${b}__receipt-breakdown-value`} style={{ color: '#2563EB' }}>{fmt(total - commissionAmount)}</span>
          </div>
          {productItems.length > 0 && productItems.some(p => p.commission > 0) && (
            <div className={`${b}__receipt-breakdown-row`}>
              <span>Comision productos</span>
              <span className={`${b}__receipt-breakdown-value`} style={{ color: '#D97706' }}>{fmt(productItems.reduce((s, p) => s + (p.commission || 0), 0))}</span>
            </div>
          )}
        </div>
      </div>

      {checkoutError && (
        <div className={`${b}__error-msg`}>
          {checkoutError}
          <button type="button" onClick={() => setCheckoutError('')}><CloseIcon /></button>
        </div>
      )}

      <button
        className={`${b}__cta`}
        onClick={handleSubmit}
        disabled={submitting}
        type="button"
      >
        {submitting ? 'Procesando...' : `Cobrar ${fmt(total)}`}
      </button>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return renderServices();
      case 1: return renderDiscount();
      case 2: return renderPayment();
      case 3: return renderConfirm();
      default: return null;
    }
  };

  return createPortal(
    <div className={`${b}__overlay`} onClick={onClose}>
      <div className={`${b}`} onClick={(e) => e.stopPropagation()}>
        <div className={`${b}__header`}>
          <h2 className={`${b}__title`}>Cobrar</h2>
          <button className={`${b}__close`} onClick={onClose} type="button" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>

        <div className={`${b}__steps`}>
          {STEPS.map((label, idx) => (
            <div
              key={idx}
              className={`${b}__step-dot ${idx === step ? `${b}__step-dot--active` : ''} ${idx < step ? `${b}__step-dot--done` : ''}`}
              title={label}
            >
              <div className={`${b}__step-dot-circle`}>{idx < step ? <CheckIcon /> : idx + 1}</div>
              <span className={`${b}__step-dot-label`}>{label}</span>
            </div>
          ))}
        </div>

        <div className={`${b}__body`}>
          {renderStep()}
        </div>

        {step < 3 && (
          <div className={`${b}__footer`}>
            {step > 0 && (
              <button className={`${b}__nav-btn ${b}__nav-btn--back`} onClick={() => setStep(s => s - 1)} type="button">
                <ChevronLeft /> Atras
              </button>
            )}
            <button
              className={`${b}__nav-btn ${b}__nav-btn--next`}
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed}
              type="button"
            >
              Siguiente <ChevronRight />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CheckoutModal;
