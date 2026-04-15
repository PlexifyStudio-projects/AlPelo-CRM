import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../../context/NotificationContext';
import financeService from '../../../services/financeService';
import {
  Icons, CATEGORY_COLORS, EXPENSE_CATEGORIES, RECURRING_OPTIONS, PAYMENT_METHODS, GASTOS_PERIODS, API_URL,
  formatCOP, AnimatedNumber, SkeletonBlock,
} from '../financeConstants';

// ─── Sub-tab definitions ───
const SUB_TABS = [
  { id: 'caja', label: 'Caja del dia', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4h-4z"/></svg> },
  { id: 'gastos', label: 'Gastos del negocio', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { id: 'pnl', label: 'Estado de resultados', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
];

const MOVEMENT_COLORS = { sale: '#059669', deposit: '#3B82F6', withdrawal: '#DC2626', expense: '#F59E0B', adjustment: '#8B5CF6', nomina: '#F59E0B' };
const MOVEMENT_LABELS = { sale: 'Venta', deposit: 'Deposito', withdrawal: 'Retiro', expense: 'Gasto', adjustment: 'Ajuste', nomina: 'Nomina' };
const MOVEMENT_ICONS = {
  sale: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  deposit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  withdrawal: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  expense: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  adjustment: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

const CAJA_PERIODS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'last_week', label: 'Semana Pasada' },
  { value: 'month', label: 'Este Mes' },
  { value: 'custom', label: 'Personalizado' },
];

// ─── CajaView: Cuadre de caja del dia ───
const CajaView = () => {
  const { addNotification } = useNotification();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [cajaPeriod, setCajaPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [payMethods, setPayMethods] = useState(null);
  const [cajaSum, setCajaSum] = useState(null);

  const periodParams = useMemo(() => {
    const today = new Date(Date.now() - 5 * 3600000);
    const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = toStr(today);
    if (cajaPeriod === 'custom' && customFrom && customTo) return { period: 'custom', date_from: customFrom, date_to: customTo };
    if (cajaPeriod === 'yesterday') {
      const y = new Date(today); y.setDate(today.getDate() - 1);
      return { period: 'custom', date_from: toStr(y), date_to: toStr(y) };
    }
    if (cajaPeriod === 'last_week') {
      const end = new Date(today); end.setDate(today.getDate() - today.getDay());
      const start = new Date(end); start.setDate(end.getDate() - 6);
      return { period: 'custom', date_from: toStr(start), date_to: toStr(end) };
    }
    return { period: cajaPeriod };
  }, [cajaPeriod, customFrom, customTo]);

  const periodLabel = useMemo(() => {
    if (cajaPeriod === 'today') return 'Hoy';
    if (cajaPeriod === 'yesterday') return 'Ayer';
    if (periodParams.date_from && periodParams.date_to) {
      const f = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      return `${f(periodParams.date_from)} — ${f(periodParams.date_to)}`;
    }
    return CAJA_PERIODS.find(p => p.value === cajaPeriod)?.label || '';
  }, [cajaPeriod, periodParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(periodParams).toString();
      const [cajaRes, pmRes, sumRes] = await Promise.all([
        fetch(`${API_URL}/finances/cash-register`, { credentials: 'include' }),
        fetch(`${API_URL}/finances/payment-methods?${qs}`, { credentials: 'include' }),
        fetch(`${API_URL}/finances/summary?${qs}`, { credentials: 'include' }),
      ]);
      if (cajaRes.ok) setData(await cajaRes.json());
      if (pmRes.ok) setPayMethods(await pmRes.json());
      if (sumRes.ok) setCajaSum(await sumRes.json());
    } catch (err) {
      if (err.message !== 'Failed to fetch') addNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, periodParams]);

  useEffect(() => { load(); }, [load]);

  const handleMovement = async () => {
    if (!formAmount || !formDesc.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/finances/cash-register/movement`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type: actionModal, amount: parseInt(formAmount), description: formDesc.trim() }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error'); }
      addNotification(actionModal === 'deposit' ? 'Dinero agregado a la caja' : 'Retiro registrado', 'success');
      setActionModal(null);
      setFormAmount('');
      setFormDesc('');
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="gastos__skeleton">
      <SkeletonBlock width="100%" height="120px" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <SkeletonBlock width="100%" height="200px" />
        <SkeletonBlock width="100%" height="200px" />
      </div>
    </div>
  );

  const balance = data?.balance || 0;
  const movements = data?.movements || [];
  const salesTotal = data?.sales_today || 0;
  const depositsTotal = data?.deposits_today || 0;
  const withdrawalsTotal = data?.withdrawals_today || 0;

  // Payment methods breakdown (from /finances/payment-methods?period=today)
  const pmItems = payMethods?.items || [];
  const getMethodTotal = (method) => pmItems.find(p => p.method === method)?.total || 0;
  const totalCash = getMethodTotal('efectivo');
  const totalCard = getMethodTotal('tarjeta') + getMethodTotal('tarjeta_debito') + getMethodTotal('tarjeta_credito');
  const totalNequi = getMethodTotal('nequi');
  const totalDaviplata = getMethodTotal('daviplata');
  const totalTransfer = getMethodTotal('transferencia') + getMethodTotal('bancolombia');
  const totalSales = pmItems.reduce((s, p) => s + (p.total || 0), 0);
  const txCount = cajaSum?.total_visits || pmItems.reduce((s, p) => s + (p.count || 0), 0);

  // Summary data
  const totalRevenue = cajaSum?.total_revenue || totalSales;

  const fmtDt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z'));
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });
  };
  const fmtDateOnly = (iso) => {
    if (!iso) return '';
    const d = new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z'));
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
  };
  const fmtTimeOnly = (iso) => {
    if (!iso) return '';
    const d = new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z'));
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });
  };

  // Calculate gastos + retiros + nomina from movements
  const todayMovements = movements.filter(m => {
    if (!m.created_at) return false;
    const d = new Date(m.created_at + (m.created_at.includes('Z') ? '' : 'Z'));
    return d.toDateString() === new Date().toDateString();
  });
  const gastosHoy = todayMovements.filter(m => m.type === 'expense').reduce((s, m) => s + Math.abs(m.amount), 0);
  const retirosHoy = todayMovements.filter(m => m.type === 'withdrawal').reduce((s, m) => s + Math.abs(m.amount), 0);
  const nominaHoy = todayMovements.filter(m => m.type === 'nomina').reduce((s, m) => s + Math.abs(m.amount), 0);
  const otrosIngresos = depositsTotal;

  return (
    <>
      {/* ─── Period selector ─── */}
      <div className="gastos__controls">
        <div className="gastos__periods">
          {CAJA_PERIODS.map(p => (
            <button key={p.value} className={`gastos__period ${cajaPeriod === p.value ? 'gastos__period--active' : ''}`} onClick={() => setCajaPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {cajaPeriod === 'custom' && (
          <div className="gastos__custom-dates">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <span>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
        )}
        <span className="gastos__date-label">{Icons.calendar} {periodLabel}</span>
      </div>

      {/* ─── Hero: Saldo + Acciones ─── */}
      <div className="gastos__bento">
        <div className="gastos__hero-card">
          <div className="gastos__hero-label">Cuadre de caja del dia</div>
          <div className={`gastos__hero-value ${balance < 0 ? 'gastos__hero-value--negative' : ''}`}>
            <AnimatedNumber value={balance} prefix="$" />
          </div>
          <div className="gastos__hero-sub">Corte cuadre de caja actual</div>
        </div>

        <div className="gastos__kpi-card gastos__kpi-card--income" style={{ cursor: 'pointer' }} onClick={() => { setActionModal('deposit'); setFormAmount(''); setFormDesc(''); }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <div className="gastos__kpi-data">
            <span className="gastos__action-label" style={{ color: '#059669' }}>Registrar ingreso</span>
            <span className="gastos__action-hint">Depositar efectivo</span>
          </div>
        </div>

        <div className="gastos__kpi-card gastos__kpi-card--expense" style={{ cursor: 'pointer' }} onClick={() => { setActionModal('withdrawal'); setFormAmount(''); setFormDesc(''); }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <div className="gastos__kpi-data">
            <span className="gastos__action-label" style={{ color: '#DC2626' }}>Retiro de dinero</span>
            <span className="gastos__action-hint">Sacar efectivo</span>
          </div>
        </div>
      </div>

      {/* ─── Resumen detallado (estilo cuadre de caja) ─── */}
      <div className="gastos__card" style={{ marginBottom: 16 }}>
        <div className="gastos__card-header">
          <span className="gastos__card-title">Resumen</span>
          <span className="gastos__card-badge">{cajaPeriod === 'today' ? new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : periodLabel}</span>
        </div>
        <div className="gastos__cuadre">
          {/* Info general del dia */}
          <div className="gastos__cuadre-row">
            <span className="gastos__cuadre-label">Ingresos del periodo</span>
            <span className="gastos__cuadre-value" style={{ fontWeight: 700, color: '#059669' }}>{formatCOP(totalRevenue)}</span>
          </div>
          <div className="gastos__cuadre-row">
            <span className="gastos__cuadre-label">Servicios realizados</span>
            <span className="gastos__cuadre-value">{txCount}</span>
          </div>

          <div className="gastos__cuadre-divider" />

          {/* Dinero por metodo de pago */}
          <div className="gastos__cuadre-section-label">Dinero por metodo de pago</div>
          <div className="gastos__cuadre-row">
            <span className="gastos__cuadre-label">Dinero en efectivo</span>
            <span className="gastos__cuadre-value">{formatCOP(totalCash)}</span>
          </div>
          <div className="gastos__cuadre-row">
            <span className="gastos__cuadre-label">Dinero en datafono (tarjeta)</span>
            <span className="gastos__cuadre-value">{formatCOP(totalCard)}</span>
          </div>
          <div className="gastos__cuadre-row">
            <span className="gastos__cuadre-label">Nequi</span>
            <span className="gastos__cuadre-value">{formatCOP(totalNequi)}</span>
          </div>
          <div className="gastos__cuadre-row">
            <span className="gastos__cuadre-label">Daviplata</span>
            <span className="gastos__cuadre-value">{formatCOP(totalDaviplata)}</span>
          </div>
          <div className="gastos__cuadre-row">
            <span className="gastos__cuadre-label">Transferencia</span>
            <span className="gastos__cuadre-value">{formatCOP(totalTransfer)}</span>
          </div>
          <div className="gastos__cuadre-row" style={{ fontWeight: 700, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8, marginTop: 4 }}>
            <span className="gastos__cuadre-label">Total en ventas</span>
            <span className="gastos__cuadre-value">{formatCOP(totalSales)}</span>
          </div>

          <div className="gastos__cuadre-divider" />

          {/* Otros ingresos y egresos */}
          <div className="gastos__cuadre-section-label">Otros movimientos del dia</div>
          {otrosIngresos > 0 && (
            <div className="gastos__cuadre-row">
              <span className="gastos__cuadre-label">Otro tipo de dinero ingresado</span>
              <span className="gastos__cuadre-value" style={{ color: '#059669' }}>{formatCOP(otrosIngresos)}</span>
            </div>
          )}
          <div className="gastos__cuadre-row" style={{ fontWeight: 700, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8, marginTop: 4 }}>
            <span className="gastos__cuadre-label">Total de dinero en efectivo</span>
            <span className="gastos__cuadre-value">{formatCOP(totalCash + otrosIngresos)}</span>
          </div>

          <div className="gastos__cuadre-divider" />

          {gastosHoy > 0 && (
            <div className="gastos__cuadre-row">
              <span className="gastos__cuadre-label">Dinero en gastos</span>
              <span className="gastos__cuadre-value" style={{ color: '#DC2626' }}>-{formatCOP(gastosHoy)}</span>
            </div>
          )}
          {retirosHoy > 0 && (
            <div className="gastos__cuadre-row">
              <span className="gastos__cuadre-label">Dinero extraido</span>
              <span className="gastos__cuadre-value" style={{ color: '#DC2626' }}>-{formatCOP(retirosHoy)}</span>
            </div>
          )}
          {nominaHoy > 0 && (
            <div className="gastos__cuadre-row">
              <span className="gastos__cuadre-label">Pago de colaboradores</span>
              <span className="gastos__cuadre-value" style={{ color: '#DC2626' }}>-{formatCOP(nominaHoy)}</span>
            </div>
          )}

          {/* TOTAL EN CAJA */}
          <div className="gastos__cuadre-total">
            <span>Total en caja</span>
            <span className={balance >= 0 ? '' : 'gastos__cuadre-total--negative'}>{formatCOP(balance)}</span>
          </div>
        </div>
      </div>

      {/* ─── Timeline de movimientos ─── */}
      <div className="gastos__card">
        <div className="gastos__card-header">
          <span className="gastos__card-title">Movimientos de caja</span>
          <span className="gastos__card-badge">Ultimos 50</span>
        </div>
        {movements.length > 0 ? (
          <div className="gastos__timeline">
            {movements.map((m, i) => {
              const color = MOVEMENT_COLORS[m.type] || '#8E8E85';
              const icon = MOVEMENT_ICONS[m.type] || MOVEMENT_ICONS.adjustment;
              return (
                <div key={m.id} className="gastos__timeline-item" style={{ animationDelay: `${i * 0.03}s` }}>
                  <div className="gastos__timeline-line">
                    <div className="gastos__timeline-dot" style={{ background: color, boxShadow: `0 0 0 4px ${color}15` }}>
                      {icon}
                    </div>
                    {i < movements.length - 1 && <div className="gastos__timeline-connector" />}
                  </div>
                  <div className="gastos__timeline-content">
                    <div className="gastos__timeline-header">
                      <span className="gastos__timeline-type" style={{ color }}>{MOVEMENT_LABELS[m.type] || m.type}</span>
                      <span className="gastos__timeline-time">{fmtDt(m.created_at)}</span>
                    </div>
                    <div className="gastos__timeline-body">
                      <span className="gastos__timeline-desc">{m.description}{m.created_by ? <small> — {m.created_by}</small> : ''}</span>
                      <div className="gastos__timeline-amounts">
                        <span className={`gastos__timeline-amount ${m.amount >= 0 ? 'gastos__timeline-amount--positive' : 'gastos__timeline-amount--negative'}`}>
                          {m.amount >= 0 ? '+' : ''}{formatCOP(m.amount)}
                        </span>
                        <span className="gastos__timeline-balance">Saldo: {formatCOP(m.balance_after)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="gastos__empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4h-4z"/></svg>
            <p>Sin movimientos registrados</p>
            <small>Los cobros en efectivo aparecen automaticamente</small>
          </div>
        )}
      </div>

      {/* ─── Modal deposito / retiro ─── */}
      {actionModal && createPortal(
        <div className="gastos__overlay" onClick={() => !saving && setActionModal(null)}>
          <div className="gastos__modal" onClick={e => e.stopPropagation()}>
            <div className="gastos__modal-header">
              <h3>{actionModal === 'deposit' ? 'Depositar dinero' : 'Retirar dinero'}</h3>
              <button className="gastos__modal-close" onClick={() => setActionModal(null)} disabled={saving}>&times;</button>
            </div>
            <div className="gastos__modal-body">
              <label className="gastos__field">
                <span className="gastos__field-label">Monto (COP)</span>
                <input className="gastos__input" type="number" placeholder="Ej: 50000" value={formAmount} onChange={e => setFormAmount(e.target.value)} autoFocus />
              </label>
              <label className="gastos__field">
                <span className="gastos__field-label">Descripcion</span>
                <input className="gastos__input" placeholder={actionModal === 'deposit' ? 'Ej: Fondo inicial, cambio...' : 'Ej: Pago proveedor, gastos...'} value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </label>
            </div>
            <div className="gastos__modal-footer">
              <button className="gastos__btn gastos__btn--ghost" onClick={() => setActionModal(null)} disabled={saving}>Cancelar</button>
              <button className={`gastos__btn ${actionModal === 'deposit' ? 'gastos__btn--primary' : 'gastos__btn--danger'}`} disabled={saving || !formAmount || !formDesc.trim()} onClick={handleMovement}>
                {saving ? 'Guardando...' : actionModal === 'deposit' ? 'Depositar' : 'Retirar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// ─── GastosView: CRUD gastos del negocio ───
const GastosView = ({ period: parentPeriod, dateFrom: parentFrom, dateTo: parentTo }) => {
  const { addNotification } = useNotification();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [localPeriod, setLocalPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const computedDates = useMemo(() => {
    const today = new Date(Date.now() - 5 * 3600000);
    const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (localPeriod === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    if (localPeriod === 'last_month') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toStr(first), to: toStr(last) };
    }
    if (localPeriod === 'week') {
      const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
      return { from: toStr(mon), to: toStr(today) };
    }
    if (localPeriod === 'year') return { from: `${today.getFullYear()}-01-01`, to: toStr(today) };
    return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to: toStr(today) };
  }, [localPeriod, customFrom, customTo]);

  const dateFrom = computedDates.from;
  const dateTo = computedDates.to;

  const periodLabel = useMemo(() => {
    const f = (d) => { const p = d.split('-'); return new Date(+p[0], +p[1]-1, +p[2], 12).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }); };
    return `${f(dateFrom)} — ${f(dateTo)}`;
  }, [dateFrom, dateTo]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const todayStr = new Date(Date.now() - 5 * 3600000).toISOString().split('T')[0];
  const emptyForm = { category: '', subcategory: '', description: '', amount: '', date: todayStr, payment_method: '', vendor: '', is_recurring: false, recurring_frequency: '' };
  const [form, setForm] = useState(emptyForm);

  const buildParams = useCallback(() => {
    const d = new Date(dateTo + 'T23:59:59');
    d.setDate(d.getDate() + 1);
    const extTo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { period: 'custom', date_from: dateFrom, date_to: extTo };
  }, [dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [exp, sum] = await Promise.all([
        financeService.listExpenses(params),
        financeService.expensesSummary(params),
      ]);
      setExpenses(exp);
      setSummary(sum);
    } catch (err) {
      addNotification('Error cargando gastos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [buildParams, addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.description || !form.amount || !form.date) return;
    try {
      const payload = { ...form, amount: Number(form.amount), is_recurring: form.is_recurring || false };
      if (!payload.subcategory) delete payload.subcategory;
      if (!payload.vendor) delete payload.vendor;
      if (!payload.recurring_frequency) delete payload.recurring_frequency;
      if (editingId) {
        await financeService.updateExpense(editingId, payload);
        addNotification('Gasto actualizado', 'success');
      } else {
        await financeService.createExpense(payload);
        addNotification('Gasto registrado', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const handleEdit = (exp) => {
    setForm({
      category: exp.category, subcategory: exp.subcategory || '', description: exp.description,
      amount: exp.amount.toString(), date: exp.date, payment_method: exp.payment_method || '',
      vendor: exp.vendor || '', is_recurring: exp.is_recurring || false, recurring_frequency: exp.recurring_frequency || '',
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este gasto?')) return;
    try {
      await financeService.deleteExpense(id);
      addNotification('Gasto eliminado', 'success');
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const currentCatInfo = EXPENSE_CATEGORIES[form.category];
  const availableSubs = currentCatInfo?.subs || [];
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  if (loading) return <div className="gastos__skeleton"><SkeletonBlock width="100%" height="48px" /><SkeletonBlock width="100%" height="48px" /><SkeletonBlock width="100%" height="48px" /></div>;

  return (
    <>
      {/* Period selector */}
      <div className="gastos__controls">
        <div className="gastos__periods">
          {GASTOS_PERIODS.map(p => (
            <button key={p.value} className={`gastos__period ${localPeriod === p.value ? 'gastos__period--active' : ''}`} onClick={() => setLocalPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {localPeriod === 'custom' && (
          <div className="gastos__custom-dates">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <span>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
        )}
        <span className="gastos__date-label">{Icons.calendar} {periodLabel}</span>
      </div>

      {/* Summary strip */}
      <div className="gastos__summary-strip">
        <div className="gastos__summary-item">
          <span className="gastos__summary-value">{formatCOP(totalExpenses)}</span>
          <span className="gastos__summary-label">Total gastos</span>
        </div>
        <div className="gastos__summary-item">
          <span className="gastos__summary-value">{expenses.length}</span>
          <span className="gastos__summary-label">Registros</span>
        </div>
        {summary?.by_category?.length > 0 && (
          <div className="gastos__summary-bar">
            {summary.by_category.map((cat, i) => (
              <div key={i} className="gastos__summary-segment" style={{ width: `${Math.max(cat.pct_of_total, 3)}%`, background: CATEGORY_COLORS[cat.category] || '#8B6914' }} title={`${cat.category}: ${formatCOP(cat.total)} (${cat.pct_of_total}%)`} />
            ))}
          </div>
        )}
      </div>

      {/* Categories legend */}
      {summary?.by_category?.length > 0 && (
        <div className="gastos__categories">
          {summary.by_category.map((cat, i) => (
            <div key={i} className="gastos__category-chip">
              <span className="gastos__category-dot" style={{ background: CATEGORY_COLORS[cat.category] || '#8B6914' }} />
              <span className="gastos__category-name">{cat.category}</span>
              <span className="gastos__category-amount">{formatCOP(cat.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="gastos__action-bar">
        <h3 className="gastos__section-title">Gastos del periodo</h3>
        <button className="gastos__add-btn" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}>
          {Icons.plus} Nuevo Gasto
        </button>
      </div>

      {/* Expense form */}
      {showForm && (
        <form className="gastos__form" onSubmit={handleSubmit}>
          <div className="gastos__form-section">Detalle del gasto</div>
          <div className="gastos__form-grid">
            <select className="gastos__select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: '' })} required>
              <option value="">Categoria *</option>
              {Object.entries(EXPENSE_CATEGORIES).map(([cat, info]) => (
                <option key={cat} value={cat}>{info.icon} {cat}</option>
              ))}
            </select>
            {availableSubs.length > 0 && (
              <select className="gastos__select" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })}>
                <option value="">Subcategoria</option>
                {availableSubs.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            )}
            <input className="gastos__input" placeholder="Descripcion *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            <input className="gastos__input" placeholder="Proveedor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </div>
          <div className="gastos__form-section">Pago</div>
          <div className="gastos__form-grid">
            <input className="gastos__input" type="number" placeholder="Monto (COP) *" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            <input className="gastos__input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <select className="gastos__select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="">Metodo de pago</option>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <div className="gastos__recurring">
              <label className="gastos__checkbox-label">
                <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked, recurring_frequency: e.target.checked ? 'mensual' : '' })} />
                <span>Recurrente</span>
              </label>
              {form.is_recurring && (
                <select className="gastos__select gastos__select--sm" value={form.recurring_frequency} onChange={(e) => setForm({ ...form, recurring_frequency: e.target.value })}>
                  {RECURRING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="gastos__form-actions">
            <button type="button" className="gastos__btn gastos__btn--ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</button>
            <button type="submit" className="gastos__btn gastos__btn--primary">{Icons.check} {editingId ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </form>
      )}

      {/* Expenses table */}
      <div className="gastos__table-wrap">
        <table className="gastos__table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Categoria</th>
              <th>Descripcion</th>
              <th className="gastos__hide-mobile">Proveedor</th>
              <th className="gastos__hide-mobile">Metodo</th>
              <th className="gastos__th-right">Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td className="gastos__td-date">{new Date(exp.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</td>
                <td>
                  <span className="gastos__tag">{exp.category}</span>
                  {exp.subcategory && <span className="gastos__tag gastos__tag--sub">{exp.subcategory}</span>}
                </td>
                <td>{exp.description}</td>
                <td className="gastos__hide-mobile">{exp.vendor || '—'}</td>
                <td className="gastos__hide-mobile">{exp.payment_method || '—'}</td>
                <td className="gastos__td-amount">{formatCOP(exp.amount)}</td>
                <td>
                  <div className="gastos__row-actions">
                    <button className="gastos__icon-btn" onClick={() => handleEdit(exp)} title="Editar">{Icons.edit}</button>
                    <button className="gastos__icon-btn gastos__icon-btn--danger" onClick={() => handleDelete(exp.id)} title="Eliminar">{Icons.trash}</button>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={7}>
                <div className="gastos__empty">
                  {Icons.receipt}
                  <p>Sin gastos registrados</p>
                  <small>Registra arriendo, nomina, productos y otros gastos</small>
                  <button className="gastos__add-btn" style={{ marginTop: 12 }} onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>
                    {Icons.plus} Registrar primer gasto
                  </button>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ─── PnLView: Estado de resultados ───
const PnLView = ({ period: parentPeriod, dateFrom: parentFrom, dateTo: parentTo }) => {
  const { addNotification } = useNotification();
  const [pnl, setPnl] = useState(null);
  const [summary, setSummary] = useState(null);
  const [localPeriod, setLocalPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);

  const computedDates = useMemo(() => {
    const today = new Date(Date.now() - 5 * 3600000);
    const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (localPeriod === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    if (localPeriod === 'last_month') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toStr(first), to: toStr(last) };
    }
    if (localPeriod === 'week') {
      const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
      return { from: toStr(mon), to: toStr(today) };
    }
    if (localPeriod === 'year') return { from: `${today.getFullYear()}-01-01`, to: toStr(today) };
    return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to: toStr(today) };
  }, [localPeriod, customFrom, customTo]);

  const dateFrom = computedDates.from;
  const dateTo = computedDates.to;

  const periodLabel = useMemo(() => {
    const f = (d) => { const p = d.split('-'); return new Date(+p[0], +p[1]-1, +p[2], 12).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }); };
    return `${f(dateFrom)} — ${f(dateTo)}`;
  }, [dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = new Date(dateTo + 'T23:59:59');
      d.setDate(d.getDate() + 1);
      const extTo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const params = { period: 'custom', date_from: dateFrom, date_to: extTo };
      const [p, s] = await Promise.all([
        financeService.getPnL(params),
        financeService.expensesSummary(params),
      ]);
      setPnl(p);
      setSummary(s);
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, addNotification]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="gastos__skeleton"><SkeletonBlock width="100%" height="200px" /></div>;
  if (!pnl) return <div className="gastos__empty"><p>Sin datos para este periodo</p></div>;

  const totalIngresos = pnl.total_revenue + (pnl.total_fines || 0);
  const totalEgresos = pnl.total_expenses + pnl.total_commissions + (pnl.total_tips || 0);

  return (
    <>
      {/* Period selector */}
      <div className="gastos__controls">
        <div className="gastos__periods">
          {GASTOS_PERIODS.map(p => (
            <button key={p.value} className={`gastos__period ${localPeriod === p.value ? 'gastos__period--active' : ''}`} onClick={() => setLocalPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {localPeriod === 'custom' && (
          <div className="gastos__custom-dates">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <span>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
        )}
        <span className="gastos__date-label">{Icons.calendar} {periodLabel}</span>
      </div>

      {/* P&L Bento */}
      <div className="gastos__pnl-grid">
        {/* Ganancia neta — hero */}
        <div className={`gastos__pnl-hero ${pnl.net_profit < 0 ? 'gastos__pnl-hero--loss' : ''}`}>
          <div className="gastos__pnl-hero-label">Ganancia Neta</div>
          <div className="gastos__pnl-hero-value">{formatCOP(pnl.net_profit)}</div>
          <div className="gastos__pnl-hero-margin">
            <div className="gastos__pnl-margin-track">
              <div className="gastos__pnl-margin-fill" style={{ width: `${Math.max(Math.min(pnl.margin_pct, 100), 0)}%` }} />
            </div>
            <span>Margen {pnl.margin_pct}%</span>
          </div>
        </div>

        {/* Ingresos */}
        <div className="gastos__pnl-card gastos__pnl-card--income">
          <div className="gastos__pnl-card-label">Ingresos</div>
          <div className="gastos__pnl-card-value">{formatCOP(totalIngresos)}</div>
          <div className="gastos__pnl-rows">
            <div className="gastos__pnl-row"><span>Servicios y productos</span><span>{formatCOP(pnl.total_revenue)}</span></div>
            {(pnl.total_fines || 0) > 0 && <div className="gastos__pnl-row"><span>Multas cobradas</span><span>{formatCOP(pnl.total_fines)}</span></div>}
          </div>
        </div>

        {/* Egresos */}
        <div className="gastos__pnl-card gastos__pnl-card--expense">
          <div className="gastos__pnl-card-label">Egresos</div>
          <div className="gastos__pnl-card-value">{formatCOP(totalEgresos)}</div>
          <div className="gastos__pnl-rows">
            <div className="gastos__pnl-row"><span>Gastos operativos</span><span>{formatCOP(pnl.total_expenses)}</span></div>
            <div className="gastos__pnl-row"><span>Comisiones equipo</span><span>{formatCOP(pnl.total_commissions)}</span></div>
            {(pnl.total_tips || 0) > 0 && <div className="gastos__pnl-row"><span>Propinas</span><span>{formatCOP(pnl.total_tips)}</span></div>}
          </div>
        </div>
      </div>

      {/* Distribucion visual */}
      {pnl.total_revenue > 0 && (
        <div className="gastos__card" style={{ marginTop: 16 }}>
          <div className="gastos__card-header">
            <span className="gastos__card-title">Distribucion de ingresos</span>
          </div>
          <div className="gastos__dist-bar">
            <div className="gastos__dist-seg gastos__dist-seg--profit" style={{ width: `${Math.max((pnl.net_profit / pnl.total_revenue) * 100, 0)}%` }} title={`Ganancia: ${formatCOP(pnl.net_profit)}`} />
            <div className="gastos__dist-seg gastos__dist-seg--comm" style={{ width: `${(pnl.total_commissions / pnl.total_revenue) * 100}%` }} title={`Comisiones: ${formatCOP(pnl.total_commissions)}`} />
            <div className="gastos__dist-seg gastos__dist-seg--expense" style={{ width: `${(pnl.total_expenses / pnl.total_revenue) * 100}%` }} title={`Gastos: ${formatCOP(pnl.total_expenses)}`} />
          </div>
          <div className="gastos__dist-legend">
            <span><span className="gastos__dist-dot" style={{ background: '#059669' }} /> Ganancia</span>
            <span><span className="gastos__dist-dot" style={{ background: '#3B82F6' }} /> Comisiones</span>
            <span><span className="gastos__dist-dot" style={{ background: '#DC2626' }} /> Gastos</span>
          </div>
        </div>
      )}

      {/* Gastos por categoria */}
      {summary?.by_category?.length > 0 && (
        <div className="gastos__card" style={{ marginTop: 16 }}>
          <div className="gastos__card-header">
            <span className="gastos__card-title">Gastos por categoria</span>
            <span className="gastos__card-badge">Total: {formatCOP(summary.total)}</span>
          </div>
          <div className="gastos__categories" style={{ padding: '0 20px 16px' }}>
            {summary.by_category.map((cat, i) => (
              <div key={i} className="gastos__category-chip">
                <span className="gastos__category-dot" style={{ background: CATEGORY_COLORS[cat.category] || '#8B6914' }} />
                <span className="gastos__category-name">{cat.category}</span>
                <span className="gastos__category-amount">{formatCOP(cat.total)}</span>
                <span className="gastos__category-pct">{cat.pct_of_total}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main Component ───
const TabGastos = ({ period, dateFrom, dateTo }) => {
  const [subView, setSubView] = useState('caja');

  return (
    <div className="gastos">
      {/* Sub-tab selector */}
      <div className="gastos__sub-tabs">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            className={`gastos__sub-tab ${subView === tab.id ? 'gastos__sub-tab--active' : ''}`}
            onClick={() => setSubView(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="gastos__content">
        {subView === 'caja' && <CajaView />}
        {subView === 'gastos' && <GastosView period={period} dateFrom={dateFrom} dateTo={dateTo} />}
        {subView === 'pnl' && <PnLView period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      </div>
    </div>
  );
};

export default TabGastos;
