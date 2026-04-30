import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../../context/NotificationContext';
import financeService from '../../../services/financeService';
import {
  Icons, CATEGORY_COLORS, EXPENSE_CATEGORIES, RECURRING_OPTIONS, PAYMENT_METHODS, GASTOS_PERIODS, API_URL,
  formatCOP, SkeletonBlock,
} from '../financeConstants';

// ─── Animated number — vanilla requestAnimationFrame count-up ───
const Counter = ({ value, prefix = '$', className = '' }) => {
  const ref = useRef(null);
  const prev = useRef(0);
  const rafId = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const start = prev.current;
    const end = Number(value) || 0;
    if (start === end) {
      ref.current.textContent = `${prefix}${end.toLocaleString('es-CO')}`;
      return;
    }
    const t0 = performance.now();
    const dur = 800;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = Math.round(start + (end - start) * eased);
      if (ref.current) ref.current.textContent = `${prefix}${v.toLocaleString('es-CO')}`;
      if (p < 1) rafId.current = requestAnimationFrame(step);
      else prev.current = end;
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [value, prefix]);
  return <span ref={ref} className={className}>{prefix}0</span>;
};

// ─── Sub-tab definitions ───
const SUB_TABS = [
  { id: 'caja', label: 'Caja del dia', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4h-4z"/></svg> },
  { id: 'gastos', label: 'Gastos del negocio', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { id: 'pnl', label: 'Estado de resultados', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
];

// ─── Sub-tabs internos del cuadre (estilo Weibook) ───
const CUADRE_SUBS = [
  { id: 'gastos', label: 'Gastos' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'comisiones', label: 'Comisiones del dia' },
  { id: 'ingresos', label: 'Ingresos a caja' },
  { id: 'retiros', label: 'Retiros' },
  { id: 'multas', label: 'Multas' },
  { id: 'liquidacion', label: 'Liquidacion' },
];

// ─── Helpers ───
const fmtDt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z'));
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });
};
const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z'));
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });
};
const todayISO = () => new Date(Date.now() - 5 * 3600000).toISOString().split('T')[0];

// ─── CajaView: Cuadre de caja con apertura / cierre real ───
const CajaView = ({ period = 'today', dateFrom, dateTo }) => {
  const { addNotification } = useNotification();
  const [register, setRegister] = useState(null);             // /cash-register/today response
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);        // 'open' | 'close' | 'deposit' | 'withdrawal' | 'responsible' | 'expense' | null
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState('ventas');
  const [staff, setStaff] = useState([]);

  // Sub-tab payloads (lazy-loaded)
  const [subData, setSubData] = useState({ gastos: null, ventas: null, comisiones: null, ingresos: null, retiros: null, multas: null });

  const today = todayISO();

  // Resolve period from parent (Finanzas page) into ISO date range.
  const range = useMemo(() => {
    const t = new Date(Date.now() - 5 * 3600000);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (period === 'custom' && dateFrom && dateTo) return { from: dateFrom, to: dateTo, label: 'Personalizado' };
    if (period === 'week') {
      const m = new Date(t); m.setDate(t.getDate() - t.getDay() + 1);
      return { from: iso(m), to: iso(t), label: 'Esta semana' };
    }
    if (period === 'month') {
      return { from: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`, to: iso(t), label: 'Este mes' };
    }
    if (period === 'year') return { from: `${t.getFullYear()}-01-01`, to: iso(t), label: 'Este año' };
    return { from: iso(t), to: iso(t), label: 'Hoy' };
  }, [period, dateFrom, dateTo]);

  // Entrance animation orchestrated via CSS keyframes + animation-delay (no JS deps).
  // Each section gets a `cuadre2__rise` class; staggered delays come from --i CSS var on children.
  const heroRef = useRef(null);
  const actionsRef = useRef(null);
  const metricsRef = useRef(null);
  const bentoRef = useRef(null);
  const subsRef = useRef(null);

  const [payrollToday, setPayrollToday] = useState([]);

  const loadCore = useCallback(async () => {
    // Independent fetches: a failure on /staff/ must not kill the cuadre.
    let regErr = null;
    try {
      const r = await fetch(`${API_URL}/cash-register/today?date_from=${range.from}&date_to=${range.to}`, { credentials: 'include' });
      if (r.ok) setRegister(await r.json());
      else regErr = `HTTP ${r.status}`;
    } catch (err) { regErr = err.message; }

    try {
      const r = await fetch(`${API_URL}/staff/`, { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setStaff(Array.isArray(data) ? data : (data?.items || []));
      }
    } catch { /* staff list is optional — datalist just won't have suggestions */ }

    // Comisiones del período (lo que le debemos a todos)
    try {
      const r = await fetch(`${API_URL}/staff-payments/summary?period_from=${range.from}&period_to=${range.to}`, { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setPayrollToday(Array.isArray(data) ? data : []);
      }
    } catch { /* optional */ }

    if (regErr) addNotification('Error cargando caja: ' + regErr, 'error');
    setLoading(false);
  }, [addNotification, range.from, range.to]);

  const owedToday = useMemo(
    () => payrollToday.reduce((sum, s) => sum + Math.max(0, Number(s.balance) || 0), 0),
    [payrollToday]
  );

  // Invalidate sub-tab cache + reload core when range changes
  useEffect(() => {
    setSubData({ gastos: null, ventas: null, comisiones: null, ingresos: null, retiros: null, multas: null });
    loadCore();
  }, [loadCore]);

  // ── Lazy-load each sub-tab on first selection (scoped to current period) ──
  const loadSub = useCallback(async (kind) => {
    if (subData[kind] !== null) return;
    try {
      const f = range.from, t = range.to;
      let payload = null;
      if (kind === 'gastos') {
        const r = await fetch(`${API_URL}/expenses/?date_from=${f}&date_to=${t}`, { credentials: 'include' });
        payload = r.ok ? await r.json() : [];
      } else if (kind === 'ventas') {
        const r = await fetch(`${API_URL}/invoices/?date_from=${f}&date_to=${t}&limit=500`, { credentials: 'include' });
        payload = r.ok ? await r.json() : { items: [] };
      } else if (kind === 'comisiones') {
        const r = await fetch(`${API_URL}/staff-payments/summary?period_from=${f}&period_to=${t}`, { credentials: 'include' });
        payload = r.ok ? await r.json() : [];
      } else if (kind === 'ingresos') {
        const r = await fetch(`${API_URL}/finances/cash-register?date_from=${f}&date_to=${t}&type=deposit&limit=500`, { credentials: 'include' });
        payload = r.ok ? (await r.json()).movements : [];
      } else if (kind === 'retiros') {
        const r = await fetch(`${API_URL}/finances/cash-register?date_from=${f}&date_to=${t}&type=withdrawal&limit=500`, { credentials: 'include' });
        payload = r.ok ? (await r.json()).movements : [];
      } else if (kind === 'multas') {
        const r = await fetch(`${API_URL}/finances/fines?date_from=${f}&date_to=${t}`, { credentials: 'include' });
        payload = r.ok ? await r.json() : [];
      }
      setSubData(prev => ({ ...prev, [kind]: payload }));
    } catch (err) {
      addNotification(`Error cargando ${kind}: ${err.message}`, 'error');
    }
  }, [subData, range.from, range.to, addNotification]);

  useEffect(() => { if (register) loadSub(subTab); }, [subTab, register, loadSub]);

  const refresh = () => { setSubData({ gastos: null, ventas: null, comisiones: null, ingresos: null, retiros: null, multas: null }); loadCore(); };

  // ── Action handlers ──
  const openModal = (type, initial = {}) => { setActionModal(type); setForm(initial); };
  const closeModal = () => { if (!saving) { setActionModal(null); setForm({}); } };

  const submitOpen = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/cash-register/open`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ opening_amount: parseInt(form.opening_amount || 0, 10) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Error');
      addNotification('Caja abierta', 'success');
      closeModal();
      refresh();
    } catch (err) { addNotification('Error: ' + err.message, 'error'); }
    setSaving(false);
  };

  const submitClose = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/cash-register/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ counted_cash: parseInt(form.counted_cash || 0, 10), notes: form.notes || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Error');
      addNotification('Caja cerrada', 'success');
      closeModal();
      refresh();
    } catch (err) { addNotification('Error: ' + err.message, 'error'); }
    setSaving(false);
  };

  const submitMovement = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/finances/cash-register/movement`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type: actionModal, amount: parseInt(form.amount || 0, 10), description: (form.description || '').trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Error');
      addNotification(actionModal === 'deposit' ? 'Ingreso registrado' : 'Retiro registrado', 'success');
      closeModal();
      refresh();
    } catch (err) { addNotification('Error: ' + err.message, 'error'); }
    setSaving(false);
  };

  const submitResponsible = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/cash-register/responsible`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ opened_by: form.opened_by }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Error');
      addNotification('Responsable actualizado', 'success');
      closeModal();
      refresh();
    } catch (err) { addNotification('Error: ' + err.message, 'error'); }
    setSaving(false);
  };

  const submitExpense = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/expenses/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          category: form.category || 'otros',
          description: (form.description || '').trim(),
          amount: parseInt(form.amount || 0, 10),
          date: today,
          payment_method: form.payment_method || 'efectivo',
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Error');
      addNotification('Gasto registrado', 'success');
      closeModal();
      refresh();
    } catch (err) { addNotification('Error: ' + err.message, 'error'); }
    setSaving(false);
  };

  if (loading) return (
    <div className="gastos__skeleton">
      <SkeletonBlock width="100%" height="120px" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginTop: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} width="100%" height="90px" />)}
      </div>
      <SkeletonBlock width="100%" height="320px" />
    </div>
  );

  // ── Caja siempre abierta — backend auto-crea sesion si no existe ──
  // Defensive fallback: si por alguna razon llega null, mostramos placeholder.
  if (!register) return <div className="gastos__empty"><p>Cargando caja del dia...</p></div>;

  const cashReal = register.cash_real ?? 0;
  const totalSales = register.total_sales || 0;
  const totalMethodsBig = Math.max(register.total_cash, register.total_card, register.total_nequi, register.total_daviplata, register.total_transfer, 1);
  const fmtDate = (iso) => iso ? new Date(iso + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const totalOut = (register.expenses_total || 0) + (register.withdrawals_total || 0) + (register.payroll_total || 0);

  return (
    <>
      {/* ═══════════════════ HEADER (corporate, single line) ═══════════════════ */}
      <div ref={heroRef} className="cuadre2__head cuadre2__rise" style={{ '--delay': '0ms' }}>
        <div className="cuadre2__head-left">
          <h2 className="cuadre2__title">Cuadre de caja del periodo</h2>
          <div className="cuadre2__head-meta">
            <span><strong>{register.opened_by || 'Sin responsable'}</strong></span>
            <span className="cuadre2__sep">·</span>
            <span>Apertura {fmtTime(register.opened_at) || '—'}</span>
            <span className="cuadre2__sep">·</span>
            <span>Periodo: <strong>{range.label}</strong></span>
          </div>
        </div>
        <div className="cuadre2__head-right">
          <span className="cuadre2__head-cash-label">Total en caja</span>
          <Counter value={cashReal} className={`cuadre2__head-cash ${cashReal < 0 ? 'cuadre2__head-cash--neg' : ''}`} />
        </div>
      </div>

      {/* ═══════════════ 6 ACCIONES (estilo Weibook, monocromo) ═══════════════ */}
      <div ref={actionsRef} className="cuadre2__actions cuadre2__rise" style={{ '--delay': '80ms' }}>
        <button className="cuadre2__act cuadre2__act--primary" onClick={() => openModal('close', { counted_cash: cashReal, notes: '' })}>
          <span className="cuadre2__act-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
          </span>
          <div>
            <strong>{formatCOP(cashReal)}</strong>
            <small>Cerrar cuadre del dia</small>
          </div>
        </button>
        <button className="cuadre2__act" onClick={() => openModal('expense', { amount: '', description: '', category: 'otros', payment_method: 'efectivo' })}>
          <span className="cuadre2__act-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span>
          <span>Registrar nuevo gasto</span>
        </button>
        <button className="cuadre2__act" onClick={() => openModal('deposit', { amount: '', description: '' })}>
          <span className="cuadre2__act-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span>
          <span>Registrar ingreso a caja</span>
        </button>
        <button className="cuadre2__act" onClick={() => openModal('responsible', { opened_by: register.opened_by || '' })}>
          <span className="cuadre2__act-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg></span>
          <span>Cambiar responsable</span>
        </button>
        <button className="cuadre2__act" onClick={() => openModal('withdrawal', { amount: '', description: '' })}>
          <span className="cuadre2__act-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9h18l-1 12H4z"/><path d="M9 9V5a3 3 0 0 1 6 0v4"/></svg></span>
          <span>Retiro de dinero</span>
        </button>
      </div>

      {/* ═══════════════ RESUMEN BENTO (3 columnas + total ancho) ═══════════════ */}
      <div ref={metricsRef} className="cuadre2__bento cuadre2__rise" style={{ '--delay': '160ms' }}>

        {/* COL 1 — Sesion */}
        <div className="cuadre2__cell">
          <div className="cuadre2__cell-head">
            <h3>Sesion</h3>
            <span className="cuadre2__pill">{range.label}</span>
          </div>
          <div className="cuadre2__cell-body">
            <div className="cuadre2__line"><span>Responsable</span><strong>{register.opened_by || '—'}</strong></div>
            <div className="cuadre2__line"><span>Fecha apertura</span><strong>{fmtDate(register.date)}</strong></div>
            <div className="cuadre2__line">
              <span>
                Dinero base
                <button className="cuadre2__edit" onClick={() => openModal('base', { opening_amount: register.opening_amount || 0 })} title="Editar dinero base">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                </button>
              </span>
              <strong>{formatCOP(register.opening_amount || 0)}</strong>
            </div>
            <div className="cuadre2__line"><span>Otros ingresos</span><strong>{formatCOP(register.deposits_total || 0)}</strong></div>
            <div className="cuadre2__line cuadre2__line--em">
              <span>Total efectivo disponible</span>
              <strong>{formatCOP((register.opening_amount || 0) + (register.total_cash || 0) + (register.deposits_total || 0))}</strong>
            </div>
          </div>
        </div>

        {/* COL 2 — Métodos de pago */}
        <div className="cuadre2__cell">
          <div className="cuadre2__cell-head">
            <h3>Metodos de pago</h3>
            <span className="cuadre2__pill cuadre2__pill--green">{formatCOP(totalSales)}</span>
          </div>
          <div className="cuadre2__cell-body">
            <div className="cuadre2__line"><span>Efectivo</span><strong>{formatCOP(register.total_cash || 0)}</strong></div>
            <div className="cuadre2__line"><span>Datafono</span><strong>{formatCOP(register.total_card || 0)}</strong></div>
            <div className="cuadre2__line"><span>Nequi</span><strong>{formatCOP(register.total_nequi || 0)}</strong></div>
            <div className="cuadre2__line"><span>Daviplata</span><strong>{formatCOP(register.total_daviplata || 0)}</strong></div>
            <div className="cuadre2__line"><span>Transferencia</span><strong>{formatCOP(register.total_transfer || 0)}</strong></div>
            <div className="cuadre2__line cuadre2__line--em"><span>Total ventas</span><strong>{formatCOP(totalSales)}</strong></div>
          </div>
        </div>

        {/* COL 3 — Detalle de ventas */}
        <div className="cuadre2__cell">
          <div className="cuadre2__cell-head">
            <h3>Ventas del periodo</h3>
            <span className="cuadre2__pill">{register.transaction_count || 0} fact.</span>
          </div>
          <div className="cuadre2__cell-body">
            <div className="cuadre2__line"><span>Facturado en servicios</span><strong>{formatCOP(register.services_billed || 0)}</strong></div>
            <div className="cuadre2__line"><span>Facturado en productos</span><strong>{formatCOP(register.products_billed || 0)}</strong></div>
            <div className="cuadre2__line"><span>Cantidad servicios</span><strong>{register.services_count || 0}</strong></div>
            <div className="cuadre2__line"><span>Cantidad productos</span><strong>{register.products_count || 0}</strong></div>
            <div className="cuadre2__line"><span>Propinas</span><strong>{formatCOP(register.total_tips || 0)}</strong></div>
            <div className="cuadre2__line"><span>Descuentos</span><strong>{formatCOP(register.total_discounts || 0)}</strong></div>
          </div>
        </div>

        {/* WIDE — Salidas + Total */}
        <div className="cuadre2__cell cuadre2__cell--wide">
          <div className="cuadre2__cell-head">
            <h3>Cuadre final</h3>
            <span className="cuadre2__pill cuadre2__pill--red">−{formatCOP(totalOut)} salidas</span>
          </div>
          <div className="cuadre2__cell-body cuadre2__cell-body--row">
            <div className="cuadre2__outs">
              <div className="cuadre2__out"><span>Dinero en gastos</span><strong className="cuadre2__neg">−{formatCOP(register.expenses_total || 0)}</strong></div>
              <div className="cuadre2__out"><span>Dinero retirado</span><strong className="cuadre2__neg">−{formatCOP(register.withdrawals_total || 0)}</strong></div>
              <div className="cuadre2__out"><span>Pago de colaboradores</span><strong className="cuadre2__neg">−{formatCOP(register.payroll_total || 0)}</strong></div>
            </div>
            <div className="cuadre2__final">
              <span>Total en caja</span>
              <strong className={cashReal < 0 ? 'cuadre2__neg' : ''}>{formatCOP(cashReal)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ SUB-TABS PILL NAV + PANEL ═══════════════ */}
      <div ref={subsRef} className="cuadre2__nav cuadre2__rise" style={{ '--delay': '450ms' }}>
        {CUADRE_SUBS.map(s => (
          <button key={s.id} className={`cuadre2__nav-item ${subTab === s.id ? 'cuadre2__nav-item--active' : ''}`} onClick={() => setSubTab(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="cuadre2__nav-panel" key={subTab}>
        {subTab === 'liquidacion' ? (
          payrollToday.length > 0 ? (
            <PayrollPanel
              period={range}
              staffSummaries={payrollToday}
              onPaid={refresh}
              addNotification={addNotification}
            />
          ) : (
            <div className="gastos__empty"><p>No hay personal con saldo para liquidar en este periodo.</p></div>
          )
        ) : subTab === 'gastos' ? (
          <GastosView period={period} dateFrom={range.from} dateTo={range.to} />
        ) : (
          <SubTabContent kind={subTab} data={subData[subTab]} register={register} staff={staff} addNotification={addNotification} />
        )}
      </div>

      {/* MODALES */}
      {actionModal === 'base' && <BaseModal form={form} setForm={setForm} saving={saving} onClose={closeModal} onSubmit={submitOpen} />}
      {actionModal === 'close' && <CloseModal form={form} setForm={setForm} saving={saving} onClose={closeModal} onSubmit={submitClose} expected={register.opening_amount + (register.total_cash || 0)} />}
      {(actionModal === 'deposit' || actionModal === 'withdrawal') && <MovementModal kind={actionModal} form={form} setForm={setForm} saving={saving} onClose={closeModal} onSubmit={submitMovement} />}
      {actionModal === 'responsible' && <ResponsibleModal form={form} setForm={setForm} staff={staff} saving={saving} onClose={closeModal} onSubmit={submitResponsible} />}
      {actionModal === 'expense' && <ExpenseQuickModal form={form} setForm={setForm} saving={saving} onClose={closeModal} onSubmit={submitExpense} />}
    </>
  );
};

// ─── PayrollPanel: expandable staff cards with services list + Pagar action ───
const PayrollPanel = ({ period, staffSummaries, onPaid, addNotification }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [visitsByStaff, setVisitsByStaff] = useState({});  // {staff_id: [...visits]}
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [payTarget, setPayTarget] = useState(null);        // staff summary being paid
  const [payForm, setPayForm] = useState({ amount: 0, payment_method: 'efectivo', reference: '', concept: '' });
  const [paying, setPaying] = useState(false);

  const sorted = useMemo(
    () => staffSummaries.slice().sort((a, b) => (b.balance || 0) - (a.balance || 0)),
    [staffSummaries]
  );
  const owedCount = sorted.filter(s => (s.balance || 0) > 0).length;
  const totalOwed = sorted.reduce((s, x) => s + Math.max(0, Number(x.balance) || 0), 0);

  const toggleExpand = async (staffId) => {
    if (expandedId === staffId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(staffId);
    if (visitsByStaff[staffId]) return; // already loaded
    setLoadingVisits(true);
    try {
      const r = await fetch(`${API_URL}/staff-payments/visits?staff_id=${staffId}&date_from=${period.from}&date_to=${period.to}`, { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setVisitsByStaff(prev => ({ ...prev, [staffId]: Array.isArray(data) ? data : [] }));
      }
    } catch (err) {
      addNotification('Error cargando servicios: ' + err.message, 'error');
    } finally {
      setLoadingVisits(false);
    }
  };

  const openPayModal = (s) => {
    const balance = Math.max(0, Number(s.balance) || 0);
    setPayTarget(s);
    setPayForm({
      amount: balance,
      payment_method: s.preferred_payment_method || 'efectivo',
      reference: '',
      concept: `Comisiones ${period.label} (${period.from} a ${period.to})`,
    });
  };

  const submitPay = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      const res = await fetch(`${API_URL}/staff-payments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          staff_id: payTarget.staff_id,
          amount: parseInt(payForm.amount || 0, 10),
          period_from: period.from,
          period_to: period.to,
          concept: payForm.concept || `Comisiones ${period.label}`,
          payment_method: payForm.payment_method,
          reference: payForm.reference || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Error');
      addNotification(`Pago a ${payTarget.staff_name} registrado`, 'success');
      setPayTarget(null);
      onPaid && onPaid();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="cuadre2__owed cuadre2__rise" style={{ '--delay': '350ms' }}>
      <div className="cuadre2__panel-head">
        <span>Por pagar al equipo · {period.label}</span>
        <span className="cuadre2__panel-tag">{owedCount} con saldo · Total {formatCOP(totalOwed)}</span>
      </div>

      <div className="cuadre2__owed-grid">
        {sorted.map(s => {
          const balance = Number(s.balance) || 0;
          const earned = Number(s.total_earned) || 0;
          const isExpanded = expandedId === s.staff_id;
          const visits = visitsByStaff[s.staff_id] || [];
          return (
            <div key={s.staff_id} className={`cuadre2__owed-card ${balance > 0 ? 'cuadre2__owed-card--owed' : 'cuadre2__owed-card--ok'} ${isExpanded ? 'cuadre2__owed-card--expanded' : ''}`}>
              <button className="cuadre2__owed-toggle" onClick={() => toggleExpand(s.staff_id)}>
                <div className="cuadre2__owed-top">
                  <strong>{s.staff_name}</strong>
                  <small>{s.staff_role || 'Staff'}</small>
                </div>
                <div className="cuadre2__owed-vals">
                  <div>
                    <span>Generado</span>
                    <strong>{formatCOP(earned)}</strong>
                  </div>
                  <div className="cuadre2__owed-balance">
                    <span>Por pagar</span>
                    <strong>{formatCOP(Math.max(0, balance))}</strong>
                  </div>
                </div>
                <div className="cuadre2__owed-meta">
                  {s.services_count || 0} servicios · {s.unpaid_services_count || 0} sin pagar
                  <svg className={`cuadre2__owed-chevron ${isExpanded ? 'cuadre2__owed-chevron--up' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </button>

              {isExpanded && (
                <div className="cuadre2__owed-detail">
                  {loadingVisits && !visitsByStaff[s.staff_id] ? (
                    <SkeletonBlock width="100%" height="80px" />
                  ) : visits.length === 0 ? (
                    <p style={{ color: '#64748B', fontSize: 12, margin: '8px 0' }}>Sin servicios en este periodo</p>
                  ) : (
                    <ul className="cuadre2__owed-services">
                      {visits.map(v => (
                        <li key={v.id} className="cuadre2__owed-service">
                          <div>
                            <strong>{v.service_name}</strong>
                            <small>{new Date(v.visit_date + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {v.client_name}</small>
                          </div>
                          <div className="cuadre2__owed-service-amounts">
                            <span>{formatCOP(v.amount)}</span>
                            <small>comisión {formatCOP(v.commission)}</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Breakdown contable estilo Weibook */}
                  <div className="cuadre2__owed-breakdown">
                    <div><span>Cant. servicios</span><strong>{s.services_count || 0}</strong></div>
                    <div><span>Total facturado</span><strong>{formatCOP(s.total_revenue || 0)}</strong></div>
                    <div><span>Propinas</span><strong>{formatCOP(s.tips_total || 0)}</strong></div>
                    <div><span>Multas</span><strong style={{ color: '#DC2626' }}>−{formatCOP(s.fines_total || 0)}</strong></div>
                    <div><span>Pagado</span><strong>{formatCOP(s.total_paid || 0)}</strong></div>
                    <div className="cuadre2__owed-breakdown-total">
                      <span>Total a pagar</span>
                      <strong>{formatCOP(Math.max(0, balance))}</strong>
                    </div>
                  </div>

                  {balance > 0 && (
                    <button className="cuadre2__owed-pay-btn" onClick={() => openPayModal(s)}>
                      Pagar al colaborador {formatCOP(balance)}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PAY MODAL */}
      {payTarget && createPortal(
        <div className="gastos__overlay" onClick={() => !paying && setPayTarget(null)}>
          <div className="gastos__modal" onClick={e => e.stopPropagation()}>
            <div className="gastos__modal-header">
              <h3>Pagar a {payTarget.staff_name}</h3>
              <button className="gastos__modal-close" onClick={() => setPayTarget(null)} disabled={paying}>&times;</button>
            </div>
            <div className="gastos__modal-body">
              <label className="gastos__field">
                <span className="gastos__field-label">Monto a pagar (COP)</span>
                <input className="gastos__input" type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} autoFocus />
              </label>
              <label className="gastos__field">
                <span className="gastos__field-label">Metodo de pago</span>
                <select className="gastos__select" value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                  <option value="efectivo">Efectivo</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="bancolombia">Bancolombia</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </label>
              <label className="gastos__field">
                <span className="gastos__field-label">Referencia (opcional)</span>
                <input className="gastos__input" placeholder="Numero de transferencia, recibo..." value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} />
              </label>
              <label className="gastos__field">
                <span className="gastos__field-label">Concepto</span>
                <input className="gastos__input" value={payForm.concept} onChange={e => setPayForm(f => ({ ...f, concept: e.target.value }))} />
              </label>
            </div>
            <div className="gastos__modal-footer">
              <button className="gastos__btn gastos__btn--ghost" onClick={() => setPayTarget(null)} disabled={paying}>Cancelar</button>
              <button className="gastos__btn gastos__btn--primary" disabled={paying || !payForm.amount} onClick={submitPay}>
                {paying ? 'Pagando...' : `Confirmar pago ${formatCOP(parseInt(payForm.amount || 0, 10))}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── SubTabContent: renders the table for one of the 6 inline sub-tabs ───
const SubTabContent = ({ kind, data, register: _register, staff, addNotification: _notify }) => {
  if (data === null) return <div className="gastos__skeleton"><SkeletonBlock width="100%" height="160px" /></div>;
  const arr = Array.isArray(data) ? data : (data.items || data.movements || []);
  if (arr.length === 0) return <div className="gastos__empty"><p>Sin registros para hoy</p></div>;

  const staffName = (id) => staff.find(s => s.id === id)?.name || '';

  if (kind === 'gastos') {
    return (
      <table className="cuadre__table">
        <thead><tr><th>Hora</th><th>Categoria</th><th>Descripcion</th><th>Metodo</th><th className="cuadre__th-right">Monto</th></tr></thead>
        <tbody>
          {arr.map(e => (
            <tr key={e.id}>
              <td>{fmtTime(e.created_at)}</td>
              <td><span className="gastos__tag">{e.category}</span></td>
              <td>{e.description}</td>
              <td>{e.payment_method || '—'}</td>
              <td className="cuadre__td-amount" style={{ color: '#DC2626' }}>-{formatCOP(e.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (kind === 'ventas') {
    return (
      <table className="cuadre__table">
        <thead><tr><th>Factura</th><th>Hora</th><th>Cliente</th><th>Servicio/Producto</th><th>Metodo</th><th className="cuadre__th-right">Total</th></tr></thead>
        <tbody>
          {arr.map(inv => (
            <tr key={inv.id}>
              <td>{inv.invoice_number}</td>
              <td>{fmtTime(inv.created_at || inv.issued_date)}</td>
              <td>{inv.client_name}</td>
              <td>{(inv.items || []).map(i => i.service_name).join(', ') || '—'}</td>
              <td>{inv.payment_method || '—'}</td>
              <td className="cuadre__td-amount">{formatCOP(inv.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (kind === 'comisiones') {
    return (
      <div className="cuadre__commissions">
        {arr.map(s => (
          <div key={s.staff_id} className="cuadre__comm-card">
            <div className="cuadre__comm-head">
              <strong>{s.staff_name}</strong>
              <span>{s.staff_role}</span>
            </div>
            <div className="cuadre__row"><span>Servicios</span><span>{s.services_count}</span></div>
            <div className="cuadre__row"><span>Total facturado</span><span>{formatCOP(s.total_revenue)}</span></div>
            <div className="cuadre__row"><span>Propinas</span><span>{formatCOP(s.tips_total || 0)}</span></div>
            <div className="cuadre__row"><span>Multas</span><span style={{ color: '#DC2626' }}>-{formatCOP(s.fines_total || 0)}</span></div>
            <div className="cuadre__row"><span>Pagado</span><span>{formatCOP(s.total_paid || 0)}</span></div>
            <div className="cuadre__row cuadre__row--strong"><span>Por pagar</span><span style={{ color: s.balance > 0 ? '#DC2626' : '#059669' }}>{formatCOP(s.balance || 0)}</span></div>
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'ingresos' || kind === 'retiros') {
    return (
      <table className="cuadre__table">
        <thead><tr><th>Hora</th><th>Responsable</th><th>Descripcion</th><th className="cuadre__th-right">Monto</th></tr></thead>
        <tbody>
          {arr.map(m => (
            <tr key={m.id}>
              <td>{fmtTime(m.created_at)}</td>
              <td>{m.created_by || '—'}</td>
              <td>{m.description}</td>
              <td className="cuadre__td-amount" style={{ color: kind === 'ingresos' ? '#059669' : '#DC2626' }}>
                {kind === 'ingresos' ? '+' : '-'}{formatCOP(Math.abs(m.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (kind === 'multas') {
    return (
      <table className="cuadre__table">
        <thead><tr><th>Profesional</th><th>Razon</th><th>Notas</th><th className="cuadre__th-right">Monto</th></tr></thead>
        <tbody>
          {arr.map(f => (
            <tr key={f.id}>
              <td>{f.staff_name || staffName(f.staff_id)}</td>
              <td>{f.reason}</td>
              <td>{f.notes || '—'}</td>
              <td className="cuadre__td-amount" style={{ color: '#DC2626' }}>{formatCOP(f.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return null;
};

// ─── Modal components ───
const ModalShell = ({ title, children, footer, onClose, saving }) => createPortal(
  <div className="gastos__overlay" onClick={() => !saving && onClose()}>
    <div className="gastos__modal" onClick={e => e.stopPropagation()}>
      <div className="gastos__modal-header">
        <h3>{title}</h3>
        <button className="gastos__modal-close" onClick={onClose} disabled={saving}>&times;</button>
      </div>
      <div className="gastos__modal-body">{children}</div>
      <div className="gastos__modal-footer">{footer}</div>
    </div>
  </div>,
  document.body
);

const BaseModal = ({ form, setForm, saving, onClose, onSubmit }) => (
  <ModalShell title="Editar dinero base" onClose={onClose} saving={saving} footer={
    <>
      <button className="gastos__btn gastos__btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
      <button className="gastos__btn gastos__btn--primary" onClick={onSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Actualizar'}</button>
    </>
  }>
    <label className="gastos__field">
      <span className="gastos__field-label">Monto inicial en efectivo (COP)</span>
      <input className="gastos__input" type="number" placeholder="Ej: 200000" value={form.opening_amount || ''} onChange={e => setForm({ ...form, opening_amount: e.target.value })} autoFocus />
    </label>
    <small style={{ color: '#666', display: 'block', marginTop: 8 }}>El efectivo con el que arrancaste el dia. Se usa como base para calcular el total real en caja.</small>
  </ModalShell>
);

const CloseModal = ({ form, setForm, saving, onClose, onSubmit, expected }) => (
  <ModalShell title="Cerrar cuadre" onClose={onClose} saving={saving} footer={
    <>
      <button className="gastos__btn gastos__btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
      <button className="gastos__btn gastos__btn--danger" onClick={onSubmit} disabled={saving}>{saving ? 'Cerrando...' : 'Cerrar caja'}</button>
    </>
  }>
    <div className="gastos__field">
      <span className="gastos__field-label">Esperado en caja</span>
      <div className="gastos__input" style={{ background: '#F3F4F6', cursor: 'not-allowed' }}>{formatCOP(expected || 0)}</div>
    </div>
    <label className="gastos__field">
      <span className="gastos__field-label">Contado en caja (COP)</span>
      <input className="gastos__input" type="number" placeholder="Cuenta el efectivo y digita el total" value={form.counted_cash || ''} onChange={e => setForm({ ...form, counted_cash: e.target.value })} autoFocus />
    </label>
    <label className="gastos__field">
      <span className="gastos__field-label">Notas (opcional)</span>
      <input className="gastos__input" placeholder="Observaciones del cierre" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
    </label>
  </ModalShell>
);

const MovementModal = ({ kind, form, setForm, saving, onClose, onSubmit }) => (
  <ModalShell title={kind === 'deposit' ? 'Registrar ingreso a caja' : 'Retiro de dinero'} onClose={onClose} saving={saving} footer={
    <>
      <button className="gastos__btn gastos__btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
      <button className={`gastos__btn ${kind === 'deposit' ? 'gastos__btn--primary' : 'gastos__btn--danger'}`} disabled={saving || !form.amount || !(form.description || '').trim()} onClick={onSubmit}>
        {saving ? 'Guardando...' : kind === 'deposit' ? 'Depositar' : 'Retirar'}
      </button>
    </>
  }>
    <label className="gastos__field">
      <span className="gastos__field-label">Monto (COP)</span>
      <input className="gastos__input" type="number" placeholder="Ej: 50000" value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} autoFocus />
    </label>
    <label className="gastos__field">
      <span className="gastos__field-label">Descripcion</span>
      <input className="gastos__input" placeholder={kind === 'deposit' ? 'Ej: Cambio recibido, fondo extra...' : 'Ej: Pago a proveedor, prestamo...'} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
    </label>
  </ModalShell>
);

const ResponsibleModal = ({ form, setForm, staff, saving, onClose, onSubmit }) => (
  <ModalShell title="Cambiar responsable de caja" onClose={onClose} saving={saving} footer={
    <>
      <button className="gastos__btn gastos__btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
      <button className="gastos__btn gastos__btn--primary" disabled={saving || !(form.opened_by || '').trim()} onClick={onSubmit}>{saving ? 'Guardando...' : 'Actualizar'}</button>
    </>
  }>
    <label className="gastos__field">
      <span className="gastos__field-label">Nuevo responsable</span>
      <input className="gastos__input" list="staff-names" placeholder="Nombre o usuario" value={form.opened_by || ''} onChange={e => setForm({ ...form, opened_by: e.target.value })} autoFocus />
      <datalist id="staff-names">
        {staff.map(s => <option key={s.id} value={s.username || s.name}>{s.name}</option>)}
      </datalist>
    </label>
  </ModalShell>
);

const ExpenseQuickModal = ({ form, setForm, saving, onClose, onSubmit }) => (
  <ModalShell title="Registrar gasto" onClose={onClose} saving={saving} footer={
    <>
      <button className="gastos__btn gastos__btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
      <button className="gastos__btn gastos__btn--primary" disabled={saving || !form.amount || !(form.description || '').trim()} onClick={onSubmit}>{saving ? 'Guardando...' : 'Registrar'}</button>
    </>
  }>
    <label className="gastos__field">
      <span className="gastos__field-label">Categoria</span>
      <select className="gastos__select" value={form.category || 'otros'} onChange={e => setForm({ ...form, category: e.target.value })}>
        {Object.keys(EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
    <label className="gastos__field">
      <span className="gastos__field-label">Descripcion</span>
      <input className="gastos__input" placeholder="Ej: Compra de productos" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} autoFocus />
    </label>
    <label className="gastos__field">
      <span className="gastos__field-label">Monto (COP)</span>
      <input className="gastos__input" type="number" placeholder="0" value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} />
    </label>
    <label className="gastos__field">
      <span className="gastos__field-label">Metodo de pago</span>
      <select className="gastos__select" value={form.payment_method || 'efectivo'} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
        {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </label>
  </ModalShell>
);

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
        {subView === 'caja' && <CajaView period={period} dateFrom={dateFrom} dateTo={dateTo} />}
        {subView === 'gastos' && <GastosView period={period} dateFrom={dateFrom} dateTo={dateTo} />}
        {subView === 'pnl' && <PnLView period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      </div>
    </div>
  );
};

export default TabGastos;
