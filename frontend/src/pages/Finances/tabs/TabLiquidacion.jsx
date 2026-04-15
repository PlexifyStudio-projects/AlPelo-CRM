import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../../context/NotificationContext';
import {
  Icons, PAYMENT_METHODS, NOMINA_PERIODS, CATEGORY_COLORS, API_URL,
  formatCOP, parseProducts, AnimatedNumber, SkeletonBlock,
} from '../financeConstants';

/* ───────────────────── helper: _fetch ───────────────────── */
const _fetch = async (url, opts = {}) => {
  const res = await fetch(`${API_URL}${url}`, { credentials: 'include', ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.detail === 'string'
        ? err.detail
        : Array.isArray(err.detail)
          ? err.detail.map(e => e.msg || JSON.stringify(e)).join(', ')
          : `Error ${res.status}`
    );
  }
  return res.json();
};

/* ══════════════════════════════════════════════════════════
   StaffVisitsList — copied from TabNomina
   ══════════════════════════════════════════════════════════ */
const StaffVisitsList = ({ staffId, dateFrom: parentFrom, dateTo: parentTo, commissionRate, finesTotal = 0, tipsTotal = 0, selectable = false, selectedIds, onSelectionChange, onVisitsLoaded, isStaffView = false }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [localFrom, setLocalFrom] = useState(parentFrom);
  const [localTo, setLocalTo] = useState(parentTo);
  const [voidConfirm, setVoidConfirm] = useState(null);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => { setLocalFrom(parentFrom); setLocalTo(parentTo); }, [parentFrom, parentTo]);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await _fetch(`/staff-payments/visits?staff_id=${staffId}&date_from=${localFrom}&date_to=${localTo}`);
      const rows = (Array.isArray(data) ? data : []).map(v => ({
        id: v.id,
        date: v.visit_date,
        time: v.time || (v.created_at ? new Date(v.created_at + 'Z').toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }) : ''),
        client_name: v.client_name,
        client_id: v.client_id,
        service_name: v.service_name,
        price: v.amount,
        tip: v.tip || 0,
        payment_method: v.payment_method || '',
        commission_amount: v.commission,
        product_commission: v.product_commission || 0,
        service_breakdown: v.service_breakdown || [],
        staff_payment_id: v.payment_id,
        notes: v.notes,
        visit_code: v.visit_code || null,
      }));
      setVisits(rows);
      if (onVisitsLoaded) onVisitsLoaded(rows);
    } catch (err) {
      console.error('Error loading visits:', err);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [staffId, localFrom, localTo]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  const [filter, setFilter] = useState('all');

  if (loading) return <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', padding: 8 }}>Cargando visitas...</p>;
  if (!visits.length) return <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', padding: 8 }}>Sin servicios completados en este periodo</p>;

  const isPaidVisit = (v) => typeof v.staff_payment_id === 'number' && v.staff_payment_id > 0;
  const paidCount = visits.filter(isPaidVisit).length;
  const unpaidCount = visits.length - paidCount;

  const byStatus = filter === 'paid' ? visits.filter(isPaidVisit)
    : filter === 'unpaid' ? visits.filter(v => !isPaidVisit(v))
    : visits;

  const filtered = search ? byStatus.filter(v => {
    const q = search.toLowerCase();
    return [v.client_name, v.service_name, String(v.id), String(v.price), v.date, v.visit_code].some(x => x?.toLowerCase().includes(q));
  }) : byStatus;

  const getCommission = (v) => {
    if (v.commission_amount != null) return v.commission_amount;
    if (v.commission_rate != null) return Math.round((v.price || 0) * v.commission_rate);
    return Math.round((v.price || 0) * commissionRate);
  };

  const isSelected = (id) => selectedIds && selectedIds.includes(id);
  const toggleSelect = (id) => {
    if (!onSelectionChange) return;
    const next = isSelected(id) ? selectedIds.filter(x => x !== id) : [...(selectedIds || []), id];
    onSelectionChange(next);
  };
  const selectAllUnpaid = () => {
    if (!onSelectionChange) return;
    onSelectionChange(filtered.filter(v => !isPaidVisit(v)).map(v => v.id));
  };
  const selectNone = () => onSelectionChange && onSelectionChange([]);

  return (
    <div className="finances__vl">
      <div className="finances__vl-dates">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <input type="date" value={localFrom} onChange={e => setLocalFrom(e.target.value)} />
        <span className="finances__vl-dates-sep">hasta</span>
        <input type="date" value={localTo} onChange={e => setLocalTo(e.target.value)} />
      </div>

      <div className="finances__vl-controls">
        <div className="finances__vl-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Buscar cliente, servicio, ticket..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="finances__vl-filters">
          {[
            { id: 'all', label: 'Todas', icon: null },
            { id: 'unpaid', label: 'Sin pagar', count: unpaidCount, color: '#D97706' },
            { id: 'paid', label: 'Pagadas', count: paidCount, color: '#10B981' },
          ].map(f => (
            <button key={f.id} className={`finances__vl-filter ${filter === f.id ? 'finances__vl-filter--active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
              {f.count > 0 && <span className="finances__vl-filter-badge" style={filter === f.id ? {} : { background: `${f.color}15`, color: f.color }}>{f.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {selectable && (
        <div className="finances__vl-actions">
          <button className="finances__vl-action" onClick={selectAllUnpaid}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
            Seleccionar pendientes
          </button>
          {selectedIds && selectedIds.length > 0 && (
            <>
              <button className="finances__vl-action finances__vl-action--clear" onClick={selectNone}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Limpiar
              </button>
              <span className="finances__vl-selected-count">{selectedIds.length} seleccionadas</span>
            </>
          )}
        </div>
      )}

      <div className="finances__vl-table">
        <div className="finances__vl-thead">
          {selectable && <span style={{ width: 32 }} />}
          <span style={{ width: 60 }}>Ticket</span>
          <span style={{ width: 110 }}>Fecha</span>
          <span style={{ width: 45 }}>Hora</span>
          <span style={{ flex: 1 }}>Cliente / Servicio</span>
          {!isStaffView && <span className="finances__vl-thead-r" style={{ width: 80 }}>Valor</span>}
          <span className="finances__vl-thead-r" style={{ width: 80 }}>{isStaffView ? 'Ganancia' : 'Comision'}</span>
          {!isStaffView && <span className="finances__vl-thead-r" style={{ width: 75 }}>Negocio</span>}
          <span className="finances__vl-thead-r" style={{ width: 60 }}>Propina</span>
          <span style={{ width: 80 }}>Metodo</span>
          <span style={{ width: 80 }}>Estado</span>
        </div>
        {filtered.map(v => {
          const commission = getCommission(v);
          const products = parseProducts(v.notes);
          const dur = v.duration_minutes;
          const paid = isPaidVisit(v);
          return (
            <div key={v.id}>
              <div className={`finances__vl-row ${paid ? 'finances__vl-row--paid' : ''} ${selectable && isSelected(v.id) ? 'finances__vl-row--selected' : ''}`}
                onClick={selectable && !paid ? () => toggleSelect(v.id) : undefined}
                style={selectable && !paid ? { cursor: 'pointer' } : undefined}>
                {selectable && (
                  <span className="finances__vl-check" style={{ width: 32 }}>
                    {paid
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      : <span className={`finances__vl-checkbox ${isSelected(v.id) ? 'finances__vl-checkbox--on' : ''}`}>
                          {isSelected(v.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </span>
                    }
                  </span>
                )}
                <span className="finances__vl-ticket" style={{ width: 60 }}>{v.visit_code ? `#${v.visit_code}` : <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: 10 }}>#{v.id}</span>}</span>
                <span className="finances__vl-date" style={{ width: 110 }}>{new Date(v.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="finances__vl-time" style={{ width: 45 }}>{v.time}</span>
                <span className="finances__vl-client" style={{ flex: 1 }}>
                  <strong>{v.client_name}</strong>
                  <small>{v.service_name}{dur ? ` · ${dur}min` : ''}</small>
                </span>
                {!isStaffView && <span className="finances__vl-price" style={{ width: 80 }}>{formatCOP(v.price || 0)}</span>}
                <span className="finances__vl-comm" style={{ width: 80 }}>{formatCOP(commission)}</span>
                {!isStaffView && <span className="finances__vl-price" style={{ width: 75, color: '#2D5A3D' }}>{formatCOP((v.price || 0) - commission)}</span>}
                <span style={{ width: 60, fontSize: 12, color: v.tip > 0 ? '#8B5CF6' : 'rgba(0,0,0,0.2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v.tip > 0 ? formatCOP(v.tip) : '—'}</span>
                <span style={{ width: 80, fontSize: 11, textTransform: 'capitalize', color: '#64748B' }}>{v.payment_method || '—'}</span>
                <span style={{ width: 80 }}>
                  {paid ? (
                    <div className="finances__vl-status-wrap">
                      <span className="finances__vl-badge finances__vl-badge--paid">Pagada</span>
                      {!isStaffView && <button className="finances__vl-return" title="Devolver a pendiente" onClick={(e) => {
                        e.stopPropagation();
                        setVoidConfirm(v.id);
                      }}>↩</button>}
                    </div>
                  ) : (
                    <span className="finances__vl-badge finances__vl-badge--pending">Pendiente</span>
                  )}
                </span>
              </div>
              {products.length > 0 && (
                <div className="finances__vl-products">
                  {products.map((p, i) => (
                    <span key={i} className="finances__vl-product">{p.name} x{p.qty} {formatCOP((p.sale || 0) * (p.qty || 1))}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary — only when visits are selected */}
      {selectedIds && selectedIds.length > 0 && (() => {
        const sel = filtered.filter(v => selectedIds.includes(v.id));
        const selTotalAmount = sel.reduce((s, v) => s + (v.price || 0), 0);
        const selProductItems = sel.flatMap(v => parseProducts(v.notes));
        const selProducts = selProductItems.reduce((s, p) => s + ((p.sale || 0) * (p.qty || 1)), 0);
        const selProductQty = selProductItems.reduce((s, p) => s + (p.qty || 1), 0);
        const selServiceRevenue = selTotalAmount - selProducts;
        const selComm = sel.reduce((s, v) => s + getCommission(v), 0);
        const selProdComm = sel.reduce((s, v) => s + (v.product_commission || 0), 0);
        const selSvcComm = selComm - selProdComm;
        const prodsWithComm = selProductItems.filter(p => (p.comm || 0) > 0);
        const realProdComm = prodsWithComm.reduce((s, p) => s + (p.comm || 0), 0);
        const selTips = sel.reduce((s, v) => s + (v.tip || 0), 0);
        const selStaffTotal = selSvcComm + realProdComm + selTips - finesTotal;
        const selBusinessServices = selServiceRevenue - selSvcComm;
        const selBusinessProducts = selProducts - realProdComm;
        const selBusinessTotal = selBusinessServices + selBusinessProducts + finesTotal;
        return (
          <div className="finances__vl-summary">
            <div className="finances__vl-summary-row"><span>{sel.flatMap(v => v.service_breakdown || []).length || sel.length} servicios</span><span>{formatCOP(selServiceRevenue)}</span></div>
            {selProducts > 0 && <div className="finances__vl-summary-row"><span>Productos vendidos ({selProductQty} uds)</span><span>{formatCOP(selProducts)}</span></div>}
            {selTips > 0 && <div className="finances__vl-summary-row" style={{ color: '#059669' }}><span>Propinas recibidas</span><span>{formatCOP(selTips)}</span></div>}
            <div className="finances__vl-summary-row" style={{ fontWeight: 700, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 8, marginTop: 4 }}><span>Total ingresos</span><span>{formatCOP(selServiceRevenue + selProducts + selTips)}</span></div>

            <div className="finances__vl-summary-row" style={{ borderTop: '1px dashed rgba(0,0,0,0.08)', paddingTop: 8, marginTop: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(0,0,0,0.3)' }}><span>Profesional</span><span></span></div>
            <div className="finances__vl-summary-row" style={{ fontWeight: 600 }}><span>Comision servicios</span><span>{formatCOP(selSvcComm)}</span></div>
            {sel.flatMap(v => (v.service_breakdown || []).map(sb => ({ ...sb, visitId: v.id }))).map((sb, i) => (
              <div key={i} className="finances__vl-summary-row" style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', paddingLeft: 12 }}>
                <span>{sb.name} <span style={{ color: '#2D5A3D', fontWeight: 600 }}>({(sb.rate * 100).toFixed(0)}%)</span></span>
                <span>{formatCOP(sb.price)} → {formatCOP(sb.commission)}</span>
              </div>
            ))}
            {realProdComm > 0 && <div className="finances__vl-summary-row"><span>Comision por ventas</span><span>{formatCOP(realProdComm)}</span></div>}
            {prodsWithComm.map((p, i) => (
              <div key={i} className="finances__vl-summary-row" style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', paddingLeft: 12 }}>
                <span>{p.name} x{p.qty}</span>
                <span>{formatCOP(p.comm)}</span>
              </div>
            ))}
            {selTips > 0 && <div className="finances__vl-summary-row" style={{ color: '#059669' }}><span>Propinas</span><span>+{formatCOP(selTips)}</span></div>}
            {finesTotal > 0 && <div className="finances__vl-summary-row" style={{ color: '#DC2626' }}><span>Multas</span><span>-{formatCOP(finesTotal)}</span></div>}
            <div className="finances__vl-summary-total"><span>Total a pagar al profesional</span><span>{formatCOP(selStaffTotal)}</span></div>

            {!isStaffView && (<>
              <div className="finances__vl-summary-row" style={{ borderTop: '1px dashed rgba(0,0,0,0.08)', paddingTop: 8, marginTop: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(0,0,0,0.3)' }}><span>Negocio</span><span></span></div>
              <div className="finances__vl-summary-row"><span>Ganancia servicios</span><span>{formatCOP(selBusinessServices)}</span></div>
              {selProducts > 0 && <div className="finances__vl-summary-row"><span>Ganancia productos</span><span>{formatCOP(selBusinessProducts)}</span></div>}
              {finesTotal > 0 && <div className="finances__vl-summary-row"><span>Multas cobradas</span><span>+{formatCOP(finesTotal)}</span></div>}
              <div className="finances__vl-summary-row" style={{ color: '#2D5A3D', fontWeight: 700, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 6, marginTop: 4 }}><span>Total ganancia del negocio</span><span>{formatCOP(selBusinessTotal)}</span></div>
            </>)}
          </div>
        );
      })()}

      {voidConfirm && createPortal(
        <div className="finances__confirm-overlay" onClick={() => !voiding && setVoidConfirm(null)}>
          <div className="finances__confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="finances__confirm-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
            <h3>Devolver a pendiente</h3>
            <p>Este servicio volvera a aparecer como "Sin pagar" para que pueda ser incluido en un pago futuro.</p>
            <div className="finances__confirm-actions">
              <button className="finances__confirm-btn finances__confirm-btn--cancel" onClick={() => setVoidConfirm(null)} disabled={voiding}>Cancelar</button>
              <button className="finances__confirm-btn finances__confirm-btn--primary" disabled={voiding} onClick={async () => {
                setVoiding(true);
                try {
                  await _fetch(`/staff-payments/visits/${voidConfirm}/unlink`, { method: 'PUT' });
                  setVoidConfirm(null);
                  loadVisits();
                } catch (err) {
                  console.error('Error unlinking visit:', err);
                } finally {
                  setVoiding(false);
                }
              }}>
                {voiding ? 'Procesando...' : 'Devolver'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   openPaymentReceipt — copied from TabNomina
   ══════════════════════════════════════════════════════════ */
const openPaymentReceipt = (paymentId, _unused, staffOnly = false) => {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write('<html><head><title>Comprobante de Pago</title></head><body style="font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#1a1a1a;max-width:700px;margin:0 auto"><p style="text-align:center;color:#888">Cargando comprobante...</p></body></html>');
  _fetch(`/staff-payments/${paymentId}/detail`)
    .then(d => {
      const visits = d.visits || [];
      const commRate = d.commission_total && visits.length ? (d.commission_total / visits.reduce((s, v) => s + (v.amount || 0), 0) || 0.4) : 0.4;
      const visitRows = visits.map(v => {
        const comm = Math.round((v.amount || 0) * commRate);
        const code = v.visit_code || (v.notes || '').match(/\[CODIGO:([^\]]+)\]/)?.[1] || `${v.id}`;
        const td = (c, s = '') => `<td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;${s}">${c}</td>`;
        return `<tr>${td(new Date(v.visit_date + 'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'short'}))}${td(v.service_name)}${td(v.client_name||'')}${td('#'+code,'text-align:center')}${staffOnly ? '' : td('$'+(v.amount||0).toLocaleString('es-CO'),'text-align:right')}${td('$'+comm.toLocaleString('es-CO'),'text-align:right;color:#059669;font-weight:600')}</tr>`;
      }).join('');
      const bank = d.staff_bank;
      const bankLine = bank ? (bank.preferred_payment_method === 'nequi' && bank.nequi_phone_masked ? `Nequi ${bank.nequi_phone_masked}` : bank.preferred_payment_method === 'daviplata' && bank.daviplata_phone_masked ? `Daviplata ${bank.daviplata_phone_masked}` : bank.bank_name && bank.bank_account_number_masked ? `${bank.bank_name} ${bank.bank_account_type||''} ${bank.bank_account_number_masked}` : d.payment_method) : d.payment_method;
      const periodFrom = new Date(d.period_from+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'long'});
      const periodTo = new Date(d.period_to+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});
      w.document.open();
      w.document.write(`<!DOCTYPE html><html><head><title>Comprobante ${d.receipt_number||'CP'}</title><style>@media print{.no-print{display:none!important}body{padding:20px!important}}body{font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#1a1a1a;max-width:700px;margin:0 auto;line-height:1.5}table{width:100%;border-collapse:collapse}.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2D5A3D}.logo-area{display:flex;align-items:center;gap:12px}.biz-info{font-size:12px;color:#666;text-align:right}.title{text-align:center;background:#f8f9fa;padding:12px;border-radius:8px;margin:16px 0}.staff-info{background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px}.staff-info dt{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px}.staff-info dd{font-size:14px;font-weight:600;margin:0 0 8px}.totals{margin-top:16px;border-top:2px solid #e5e7eb;padding-top:12px}.totals .row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}.totals .total{font-size:16px;font-weight:700;border-top:2px solid #1a1a1a;padding-top:8px;margin-top:4px}.footer{margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center}</style></head><body>
      <div class="hdr"><div class="logo-area">${d.tenant_logo_url?`<img src="${d.tenant_logo_url}" style="width:48px;height:48px;border-radius:8px;object-fit:cover">`:''}<div><strong style="font-size:18px">${d.tenant_name||'Negocio'}</strong>${d.tenant_nit?`<br><span style="font-size:12px;color:#666">NIT: ${d.tenant_nit}</span>`:''}</div></div><div class="biz-info">${d.tenant_address||''}${d.tenant_phone?`<br>${d.tenant_phone}`:''}</div></div>
      <div class="title"><strong style="font-size:15px;color:#2D5A3D">COMPROBANTE DE PAGO DE NOMINA</strong><br><span style="font-size:13px;color:#666">No. ${d.receipt_number||'—'}</span></div>
      <div class="staff-info"><div><dt>Beneficiario</dt><dd>${d.staff_name}</dd></div><div><dt>Cargo</dt><dd>${d.staff_role||'—'}</dd></div><div><dt>Documento</dt><dd>${bank?.document_type||''} ${bank?.document_number_masked||'—'}</dd></div><div><dt>Cuenta destino</dt><dd>${bankLine}</dd></div><div><dt>Periodo</dt><dd>${periodFrom} — ${periodTo}</dd></div><div><dt>Fecha de pago</dt><dd>${d.paid_at?new Date(d.paid_at+'Z').toLocaleDateString('es-CO',{timeZone:'America/Bogota',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</dd></div></div>
      ${visits.length?`<h4 style="font-size:13px;color:#666;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px">Detalle de servicios</h4><table><thead><tr style="background:#f8f9fa"><th style="padding:8px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Fecha</th><th style="padding:8px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Servicio</th><th style="padding:8px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Cliente</th><th style="padding:8px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Codigo</th>${staffOnly?'':'<th style="padding:8px;text-align:right;font-size:11px;color:#666;text-transform:uppercase">Precio</th>'}<th style="padding:8px;text-align:right;font-size:11px;color:#666;text-transform:uppercase">${staffOnly?'Tu ganancia':'Comision'}</th></tr></thead><tbody>${visitRows}</tbody></table>`:''}
      <div class="totals"><div class="row"><span>Comisiones servicios</span><strong>$${(d.commission_total||0).toLocaleString('es-CO')}</strong></div>${d.tips_total?`<div class="row"><span>Propinas</span><strong>$${d.tips_total.toLocaleString('es-CO')}</strong></div>`:''}${d.product_commissions?`<div class="row"><span>Comisiones productos</span><strong>$${d.product_commissions.toLocaleString('es-CO')}</strong></div>`:''}${d.deductions?`<div class="row" style="color:#DC2626"><span>Deducciones</span><strong>-$${d.deductions.toLocaleString('es-CO')}</strong></div>`:''}
      <div class="row total"><span>TOTAL PAGADO</span><span style="color:#2D5A3D">$${(d.amount||0).toLocaleString('es-CO')}</span></div></div>
      <div style="margin-top:20px;font-size:13px;color:#444"><strong>Metodo:</strong> ${d.payment_method}${d.reference?` &nbsp;|&nbsp; <strong>Ref:</strong> ${d.reference}`:''}${d.paid_by?` &nbsp;|&nbsp; <strong>Pagado por:</strong> ${d.paid_by}`:''}</div>
      <div class="footer">Comprobante generado por Plexify Studio<br>${new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'})}</div>
      <div class="no-print" style="text-align:center;margin-top:24px"><button onclick="window.print()" style="background:#2D5A3D;color:#fff;border:none;padding:10px 32px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">Imprimir</button></div>
      </body></html>`);
      w.document.close();
    })
    .catch((err) => { w.document.body.innerHTML = `<p style="color:red;text-align:center">Error cargando comprobante</p><p style="color:#888;text-align:center;font-size:12px">${err?.message || err || 'Error desconocido'}</p>`; });
};


/* ══════════════════════════════════════════════════════════
   TabLiquidacion — main component
   ══════════════════════════════════════════════════════════ */
const TabLiquidacion = ({ period, dateFrom, dateTo, isStaffView = false, staffUser = null }) => {
  const { addNotification } = useNotification();

  /* ── Period selector (own) ── */
  const [liqPeriod, setLiqPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const computedDates = useMemo(() => {
    const today = new Date();
    const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const to = toStr(today);
    if (liqPeriod === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    if (liqPeriod === 'last_month') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toStr(first), to: toStr(last) };
    }
    if (liqPeriod === 'fortnight') {
      const fort = new Date(today); fort.setDate(today.getDate() - 15);
      return { from: toStr(fort), to };
    }
    if (liqPeriod === 'year') {
      return { from: `${today.getFullYear()}-01-01`, to };
    }
    // Default: month
    return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to };
  }, [liqPeriod, customFrom, customTo]);

  const effDateFrom = computedDates.from;
  const effDateTo = computedDates.to;

  /* ── State ── */
  const [perfData, setPerfData] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [detailTab, setDetailTab] = useState({});
  const [filterStaff, setFilterStaff] = useState('');
  const [sortBy, setSortBy] = useState('revenue');

  // Pay modal
  const [showPayModal, setShowPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', concept: '', payment_method: 'efectivo', reference: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [selectedVisitIds, setSelectedVisitIds] = useState([]);
  const [bankInfo, setBankInfo] = useState(null);
  const [staffVisitsMap, setStaffVisitsMap] = useState({});

  // Bulk modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSelections, setBulkSelections] = useState({});
  const [bulkPaying, setBulkPaying] = useState(false);

  // Fine modal
  const [fineModal, setFineModal] = useState(null);
  const [fineForm, setFineForm] = useState({ reason: '', amount: '', notes: '' });
  const [savingFine, setSavingFine] = useState(false);

  /* ── useMemo BEFORE conditional returns ── */
  const filtered = useMemo(() =>
    filterStaff ? perfData.filter(s => s.staff_name.toLowerCase().includes(filterStaff.toLowerCase())) : perfData,
    [perfData, filterStaff]
  );

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'services') return b.services_count - a.services_count;
    if (sortBy === 'clients') return b.unique_clients - a.unique_clients;
    if (sortBy === 'ticket') return b.avg_ticket - a.avg_ticket;
    if (sortBy === 'growth') return b.revenue_growth - a.revenue_growth;
    return b.revenue - a.revenue;
  }), [filtered, sortBy]);

  /* Merge perfData + payrollSummary into staffList */
  const staffList = useMemo(() => {
    const payMap = {};
    payrollSummary.forEach(ps => { payMap[ps.staff_id] = ps; });
    return sorted.map(perf => {
      const pay = payMap[perf.staff_id] || {};
      return {
        ...perf,
        total_paid: pay.total_paid || 0,
        balance: pay.balance || 0,
        unpaid_services_count: pay.unpaid_services_count || 0,
        tips_total: pay.tips_total || 0,
        preferred_payment_method: pay.preferred_payment_method || 'efectivo',
        has_bank_info: pay.has_bank_info || false,
        total_earned: pay.total_earned || perf.commission_amount || 0,
        total_revenue: pay.total_revenue || perf.revenue || 0,
        commission_rate: pay.commission_rate || 0.4,
        services_count_pay: pay.services_count || 0,
        staff_role: perf.staff_role || pay.staff_role || '',
        photo_url: perf.photo_url || pay.photo_url || null,
        fines_total: perf.fines_total || pay.fines_total || 0,
      };
    });
  }, [sorted, payrollSummary]);

  const kpis = useMemo(() => ({
    totalRevenue: staffList.reduce((s, st) => s + (st.revenue || 0), 0),
    totalCommissions: staffList.reduce((s, st) => s + (st.commission_amount || 0), 0),
    totalOwed: staffList.reduce((s, st) => s + Math.max(0, st.balance), 0),
    totalPaid: staffList.reduce((s, st) => s + st.total_paid, 0),
    totalFines: staffList.reduce((s, st) => s + (st.fines_total || 0), 0),
    totalStaff: staffList.length,
  }), [staffList]);

  const totalBusinessProfit = useMemo(() =>
    kpis.totalRevenue - kpis.totalCommissions + kpis.totalFines,
    [kpis]
  );

  /* ── Data loading ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const p = liqPeriod || 'month';
      let perfUrl = `/finances/staff-performance?period=${p}`;
      if (p === 'custom' && effDateFrom && effDateTo) {
        perfUrl += `&date_from=${effDateFrom}&date_to=${effDateTo}`;
      }
      const [perf, summ, pays] = await Promise.all([
        fetch(`${API_URL}${perfUrl}`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
        _fetch(`/staff-payments/summary?period_from=${effDateFrom}&period_to=${effDateTo}`),
        _fetch(`/staff-payments/`),
      ]);

      if (isStaffView && staffUser?.name) {
        const sn = staffUser.name.toLowerCase();
        setPerfData((Array.isArray(perf) ? perf : []).filter(s => s.staff_name?.toLowerCase().includes(sn)));
        setPayrollSummary(summ.filter(s => s.staff_name?.toLowerCase().includes(sn)));
        setPayments(pays.filter(p => p.staff_name?.toLowerCase().includes(sn)));
      } else {
        setPerfData(Array.isArray(perf) ? perf : []);
        setPayrollSummary(summ);
        setPayments(pays);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.message !== 'Failed to fetch') {
        addNotification('Error cargando liquidacion: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [liqPeriod, effDateFrom, effDateTo, isStaffView, staffUser]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Helpers ── */
  const fmtDate = (d) => {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
    return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };
  const fmtDateFull = (d) => {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
    return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getDetailTab = (staffId) => detailTab[staffId] || 'liquidacion';

  /* ── Fine handlers ── */
  const handleAddFine = async () => {
    if (!fineModal || !fineForm.reason.trim() || !fineForm.amount) return;
    setSavingFine(true);
    try {
      const res = await fetch(`${API_URL}/finances/fines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          staff_id: fineModal,
          reason: fineForm.reason.trim(),
          amount: parseInt(fineForm.amount),
          fine_date: new Date().toISOString().slice(0, 10),
          notes: fineForm.notes.trim(),
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error'); }
      setFineModal(null);
      setFineForm({ reason: '', amount: '', notes: '' });
      loadData();
    } catch (err) { addNotification('Error: ' + err.message, 'error'); }
    setSavingFine(false);
  };

  const handleDeleteFine = async (fineId) => {
    if (!confirm('¿Eliminar esta multa?')) return;
    try {
      const res = await fetch(`${API_URL}/finances/fines/${fineId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error'); }
      loadData();
    } catch (err) { addNotification('Error: ' + err.message, 'error'); }
  };

  /* ── Pay handlers ── */
  const openPayModal = async (staff, keepSelection = false) => {
    setShowPayModal(staff);
    if (!keepSelection) setSelectedVisitIds([]);
    setBankInfo(null);

    let amount = Math.max(0, staff.balance);
    const currentSelected = keepSelection ? selectedVisitIds : [];
    if (currentSelected.length > 0) {
      const visits = staffVisitsMap[staff.staff_id] || [];
      const selected = visits.filter(v => currentSelected.includes(v.id));
      const svcComm = selected.reduce((s, v) => {
        return s + (v.service_breakdown || []).reduce((ss, sb) => ss + (sb.commission || 0), 0);
      }, 0);
      const prodComm = selected.flatMap(v => parseProducts(v.notes)).filter(p => (p.comm || 0) > 0).reduce((s, p) => s + (p.comm || 0), 0);
      const selTips = selected.reduce((s, v) => s + (v.tip || 0), 0);
      amount = Math.max(0, svcComm + prodComm + selTips - (staff.fines_total || 0));
    }

    setPayForm({
      amount: String(amount),
      concept: `Pago por servicios realizados — ${fmtDate(effDateFrom)} a ${fmtDateFull(effDateTo)}`,
      payment_method: staff.preferred_payment_method || 'efectivo',
      reference: '',
      notes: '',
    });
    try {
      const info = await _fetch(`/staff-payments/bank-info/${staff.staff_id}`);
      setBankInfo(info);
    } catch (err) {
      console.error('Error loading bank info:', err);
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!showPayModal || !payForm.amount) return;
    if (selectedVisitIds.length === 0 && !window.confirm(`No seleccionaste visitas especificas. Se enlazaran TODAS las visitas del periodo (${showPayModal.unpaid_services_count || '?'} pendientes). ¿Continuar?`)) return;
    setSubmitting(true);
    try {
      await _fetch(`/staff-payments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: showPayModal.staff_id,
          amount: parseInt(payForm.amount) || 0,
          period_from: effDateFrom,
          period_to: effDateTo,
          concept: payForm.concept,
          payment_method: payForm.payment_method,
          reference: payForm.reference || null,
          notes: payForm.notes || null,
          commission_total: showPayModal.total_earned,
          tips_total: 0,
          product_commissions: 0,
          deductions: 0,
          appointment_ids: selectedVisitIds.length > 0 ? selectedVisitIds : null,
        }),
      });
      addNotification(`Pago registrado para ${showPayModal.staff_name}`, 'success');

      // Send WhatsApp notification
      try {
        const staffData = await _fetch(`/staff/${showPayModal.staff_id}`);
        const phone = staffData.phone || staffData.personal_phone;
        if (phone) {
          const amt = formatCOP(parseInt(payForm.amount) || 0);
          const msg = `Hola ${showPayModal.staff_name.split(' ')[0]}, se ha registrado un pago de ${amt} por concepto de: ${payForm.concept}. Metodo: ${payForm.payment_method}${payForm.reference ? '. Ref: ' + payForm.reference : ''}. Gracias por tu trabajo.`;
          await _fetch(`/whatsapp/send-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, message: msg }) });
        }
      } catch (err) {
        console.error('Error sending WA notification:', err);
      }

      setShowPayModal(null);
      setSelectedVisitIds([]);
      loadData();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (id) => {
    try {
      await _fetch(`/staff-payments/${id}`, { method: 'DELETE' });
      addNotification('Pago eliminado', 'success');
      loadData();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const staffWithBalance = staffList.filter(st => st.balance > 0);

  const openBulkModal = () => {
    const sel = {};
    staffWithBalance.forEach(st => { sel[st.staff_id] = true; });
    setBulkSelections(sel);
    setShowBulkModal(true);
  };

  const bulkTotal = staffWithBalance.filter(st => bulkSelections[st.staff_id]).reduce((s, st) => s + st.balance, 0);

  const handleBulkPay = async () => {
    setBulkPaying(true);
    const toPay = staffWithBalance.filter(st => bulkSelections[st.staff_id]);
    let ok = 0;
    let fail = 0;
    for (const st of toPay) {
      try {
        await _fetch(`/staff-payments/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: st.staff_id,
            amount: Math.max(0, st.balance),
            period_from: effDateFrom,
            period_to: effDateTo,
            concept: `Comisiones ${fmtDate(effDateFrom)} — ${fmtDateFull(effDateTo)}${(st.fines_total || 0) > 0 ? ` (multas: ${formatCOP(st.fines_total)})` : ''}`,
            payment_method: st.preferred_payment_method || 'efectivo',
            commission_total: st.total_earned,
            tips_total: 0,
            product_commissions: 0,
            deductions: st.fines_total || 0,
          }),
        });
        ok++;
        // WA notification
        try {
          const staffData = await _fetch(`/staff/${st.staff_id}`);
          const phone = staffData.phone;
          if (phone) {
            await _fetch(`/whatsapp/send-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, message: `Hola ${st.staff_name.split(' ')[0]}, se ha registrado un pago de ${formatCOP(st.balance)}. Gracias por tu trabajo.` }) });
          }
        } catch (err) {
          console.error('Error sending WA notification:', err);
        }
      } catch (err) { console.error('Bulk pay error:', err); fail++; }
    }
    addNotification(`Nomina liquidada: ${ok} pagos registrados${fail ? `, ${fail} fallidos` : ''}`, ok > 0 ? 'success' : 'error');
    setShowBulkModal(false);
    setBulkPaying(false);
    loadData();
  };

  /* ── Render ── */

  if (loading) return <div className="finances__comm-skeleton">{[...Array(3)].map((_, i) => <div key={i} className="finances__card" style={{ padding: 20 }}><SkeletonBlock width="100%" height="80px" /></div>)}</div>;
  if (!staffList.length) return <div className="finances__empty">Sin datos de liquidacion para este periodo</div>;

  const maxRev = staffList[0]?.revenue || 1;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <>
      {/* ── KPIs ── */}
      <div className="finances__nom-stats">
        {/* 1. Ganancia negocio — admin only */}
        {!isStaffView && kpis.totalRevenue > 0 && (
          <div className="finances__nom-stat">
            <div className="finances__nom-stat-icon" style={{ background: 'linear-gradient(135deg, #2D5A3D, #059669)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div className="finances__nom-stat-data">
              <span className="finances__nom-stat-value" style={{ color: '#2D5A3D' }}><AnimatedNumber value={totalBusinessProfit} prefix="$" /></span>
              <span className="finances__nom-stat-label">Ganancia negocio</span>
            </div>
          </div>
        )}
        {/* 2. Comisiones personal */}
        <div className="finances__nom-stat">
          <div className="finances__nom-stat-icon" style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="finances__nom-stat-data">
            <span className="finances__nom-stat-value"><AnimatedNumber value={kpis.totalCommissions} prefix="$" /></span>
            <span className="finances__nom-stat-label">{isStaffView ? 'Total ganado' : 'Comisiones personal'}</span>
          </div>
        </div>
        {/* 3. Por pagar */}
        <div className={`finances__nom-stat${kpis.totalOwed > 0 ? ' finances__nom-stat--alert' : ''}`}>
          <div className="finances__nom-stat-icon" style={{ background: kpis.totalOwed > 0 ? 'linear-gradient(135deg, #DC2626, #EF4444)' : 'linear-gradient(135deg, #10B981, #34D399)' }}>
            {kpis.totalOwed > 0
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            }
          </div>
          <div className="finances__nom-stat-data">
            <span className="finances__nom-stat-value" style={{ color: kpis.totalOwed > 0 ? '#DC2626' : '#059669' }}>{kpis.totalOwed > 0 ? <AnimatedNumber value={kpis.totalOwed} prefix="$" /> : 'Al dia'}</span>
            <span className="finances__nom-stat-label">{isStaffView ? 'Te deben' : 'Por pagar'}</span>
          </div>
        </div>
        {/* 4. Pagado */}
        <div className="finances__nom-stat">
          <div className="finances__nom-stat-icon" style={{ background: 'linear-gradient(135deg, #3B82F6, #60A5FA)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="finances__nom-stat-data">
            <span className="finances__nom-stat-value"><AnimatedNumber value={kpis.totalPaid} prefix="$" /></span>
            <span className="finances__nom-stat-label">Pagado</span>
          </div>
        </div>
        {/* 5. Multas */}
        <div className="finances__nom-stat">
          <div className="finances__nom-stat-icon" style={{ background: kpis.totalFines > 0 ? 'linear-gradient(135deg, #F59E0B, #FBBF24)' : 'linear-gradient(135deg, #94A3B8, #CBD5E1)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="finances__nom-stat-data">
            <span className="finances__nom-stat-value" style={{ color: kpis.totalFines > 0 ? '#D97706' : '#94A3B8' }}>{kpis.totalFines > 0 ? <AnimatedNumber value={kpis.totalFines} prefix="$" /> : 'Saldado'}</span>
            <span className="finances__nom-stat-label">Multas</span>
          </div>
        </div>
        {/* 6. Profesionales — admin only */}
        {!isStaffView && (
          <div className="finances__nom-stat">
            <div className="finances__nom-stat-icon" style={{ background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div className="finances__nom-stat-data">
              <span className="finances__nom-stat-value">{kpis.totalStaff}</span>
              <span className="finances__nom-stat-label">Profesionales</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Period selector + controls ── */}
      <div className="finances__nom-controls">
        <div className="finances__nom-periods">
          {NOMINA_PERIODS.map(p => (
            <button key={p.value} className={`finances__nom-period ${liqPeriod === p.value ? 'finances__nom-period--active' : ''}`} onClick={() => setLiqPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {liqPeriod === 'custom' && (
          <div className="finances__nom-custom-dates">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <span>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
        )}
        <div className="finances__nom-controls-right">
          <span className="finances__nom-date-range">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {fmtDate(effDateFrom)} — {fmtDateFull(effDateTo)}
          </span>
          {!isStaffView && staffWithBalance.length > 0 && (
            <button className="finances__nom-pay-all" onClick={openBulkModal}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Liquidar nomina ({staffWithBalance.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Filter + sort bar ── */}
      <div className="finances__perf-filters">
        <input className="finances__input" style={{ maxWidth: 220 }} placeholder="Buscar profesional..." value={filterStaff} onChange={e => setFilterStaff(e.target.value)} />
        <div className="finances__perf-sort">
          {[
            { value: 'revenue', label: 'Ingresos' },
            { value: 'services', label: 'Servicios' },
            { value: 'clients', label: 'Clientes' },
            { value: 'ticket', label: 'Ticket' },
            { value: 'growth', label: 'Crecimiento' },
          ].map(opt => (
            <button key={opt.value} className={`finances__visit-filter-chip ${sortBy === opt.value ? 'finances__visit-filter-chip--active' : ''}`} onClick={() => setSortBy(opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Staff leaderboard cards ── */}
      <div className="finances__perf-list">
        {staffList.map((st, i) => {
          const pct = Math.round((st.revenue / maxRev) * 100);
          const sharePct = kpis.totalRevenue > 0 ? Math.round((st.revenue / kpis.totalRevenue) * 100) : 0;
          const isExpanded = expandedId === st.staff_id;
          const netEarnings = st.commission_amount - (st.fines_total || 0);
          const activeTab = getDetailTab(st.staff_id);
          const staffPayments = payments.filter(p => p.staff_id === st.staff_id);

          return (
            <div key={st.staff_id} className={`finances__perf-card ${isExpanded ? 'finances__perf-card--expanded' : ''}`}>
              <div className="finances__perf-item" onClick={() => { setExpandedId(isExpanded ? null : st.staff_id); setSelectedVisitIds([]); }}>
                <span className="finances__perf-pos">{i < 3 ? medals[i] : i + 1}</span>
                <div className="finances__perf-avatar" style={{ background: st.photo_url ? 'transparent' : '#2D5A3D' }}>
                  {st.photo_url ? <img src={st.photo_url} alt="" /> : st.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div className="finances__perf-info">
                  <div className="finances__perf-header">
                    <div>
                      <strong className="finances__perf-name">{st.staff_name}</strong>
                      <span className="finances__perf-role">{st.staff_role}</span>
                      {st.has_bank_info && <span className="finances__nom-bank-dot" title="Datos bancarios">$</span>}
                    </div>
                    <div className="finances__perf-stats">
                      <span className="finances__perf-revenue">{formatCOP(st.revenue)}</span>
                      <span className="finances__perf-share">{sharePct}%</span>
                      {st.revenue_growth !== 0 && (
                        <span className={`finances__perf-growth ${st.revenue_growth > 0 ? 'finances__perf-growth--up' : 'finances__perf-growth--down'}`}>
                          {st.revenue_growth > 0 ? '↑' : '↓'}{Math.abs(st.revenue_growth)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="finances__perf-bar-bg">
                    <div className="finances__perf-bar" style={{ width: `${pct}%`, background: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : '#2D5A3D' }} />
                  </div>
                  <div className="finances__perf-meta">
                    <span>{st.services_count} servicios</span>
                    <span>{st.unique_clients} clientes</span>
                    <span>Ticket: {formatCOP(st.avg_ticket)}</span>
                    <span>Comision: {formatCOP(st.commission_amount)}</span>
                    {(st.fines_total || 0) > 0 && <span style={{ color: '#DC2626' }}>Multas: {formatCOP(st.fines_total)}</span>}
                    <span style={{ fontWeight: 700, color: netEarnings >= 0 ? '#059669' : '#DC2626' }}>Neto: {formatCOP(netEarnings)}</span>
                  </div>
                </div>
                {/* Pay button */}
                {!isStaffView && st.balance > 0 && (
                  <button className="finances__nom-pay-btn" onClick={(e) => { e.stopPropagation(); openPayModal(st); }} style={{ marginRight: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Pagar
                  </button>
                )}
                <svg className={`finances__inv-chevron ${isExpanded ? 'finances__inv-chevron--open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </div>

              {/* ── Expanded detail ── */}
              {isExpanded && (
                <div className="finances__perf-detail">
                  {/* Detail sub-tabs */}
                  <div className="finances__perf-tabs">
                    {['liquidacion', 'servicios', 'pagos'].map(tab => (
                      <button
                        key={tab}
                        className={`finances__perf-tab ${activeTab === tab ? 'finances__perf-tab--active' : ''}`}
                        onClick={() => setDetailTab(p => ({ ...p, [st.staff_id]: tab }))}
                      >
                        {tab === 'liquidacion' ? 'Liquidacion' : tab === 'servicios' ? 'Servicios' : 'Pagos'}
                      </button>
                    ))}
                  </div>

                  {/* ── LIQUIDACION TAB ── */}
                  {activeTab === 'liquidacion' && (
                    <div className="finances__perf-comm">
                      {/* Commission breakdown table — 7 cols */}
                      <div className="finances__perf-comm-table">
                        <div className="finances__perf-comm-row finances__perf-comm-row--header finances__perf-comm-row--7col">
                          <span>Servicio</span>
                          <span>Precio</span>
                          <span>Cant.</span>
                          <span>Ingreso</span>
                          <span>Tasa</span>
                          <span>Negocio</span>
                          <span>Profesional</span>
                        </div>
                        {(st.commission_breakdown || []).map((cb, j) => {
                          const businessKeeps = cb.revenue - cb.commission;
                          return (
                            <div key={j} className={`finances__perf-comm-row finances__perf-comm-row--7col ${cb.count === 0 ? 'finances__perf-comm-row--inactive' : ''}`}>
                              <span className="finances__perf-comm-svc">{cb.service}</span>
                              <span>{formatCOP(cb.price)}</span>
                              <span>{cb.count || '—'}</span>
                              <span>{cb.count > 0 ? formatCOP(cb.revenue) : '—'}</span>
                              <span className="finances__perf-comm-rate">{(cb.rate * 100).toFixed(0)}%</span>
                              <span>{cb.count > 0 ? formatCOP(businessKeeps) : '—'}</span>
                              <span className="finances__perf-comm-amount">{cb.count > 0 ? formatCOP(cb.commission) : '—'}</span>
                            </div>
                          );
                        })}
                        {/* Subtotal servicios */}
                        <div className="finances__perf-comm-row finances__perf-comm-row--7col finances__perf-comm-row--subtotal">
                          <span>Subtotal servicios</span>
                          <span></span>
                          <span>{(st.commission_breakdown || []).reduce((s, c) => s + c.count, 0)}</span>
                          <span>{formatCOP(st.revenue)}</span>
                          <span></span>
                          <span>{formatCOP(st.revenue - st.commission_amount)}</span>
                          <span className="finances__perf-comm-amount">{formatCOP(st.commission_amount)}</span>
                        </div>
                      </div>

                      {/* Fines section */}
                      <div className="finances__perf-fines-section">
                        <div className="finances__perf-fines-header">
                          <h4>Multas y descuentos</h4>
                          {!isStaffView && (
                            <button className="finances__perf-fine-add-btn" onClick={() => { setFineModal(st.staff_id); setFineForm({ reason: '', amount: '', notes: '' }); }}>
                              + Agregar multa
                            </button>
                          )}
                        </div>
                        {st.fines && st.fines.length > 0 ? (
                          <div className="finances__perf-fines-list">
                            {st.fines.map(f => (
                              <div key={f.id} className="finances__perf-fine-item">
                                <div className="finances__perf-fine-info">
                                  <strong>{f.reason}</strong>
                                  <span className="finances__perf-fine-date">
                                    {new Date(f.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  {f.notes && <small className="finances__perf-fine-notes">{f.notes}</small>}
                                </div>
                                <div className="finances__perf-fine-actions">
                                  <span className="finances__perf-fine-amount">-{formatCOP(f.amount)}</span>
                                  {!isStaffView && (
                                    <button className="finances__perf-fine-del" onClick={() => handleDeleteFine(f.id)} title="Eliminar">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="finances__perf-fines-empty">Sin multas en este periodo</div>
                        )}
                      </div>

                      {/* Payroll summary row */}
                      {st.balance !== undefined && (
                        <div className="finances__perf-comm-totals" style={{ marginTop: 12, borderTop: '1px dashed rgba(0,0,0,0.08)', paddingTop: 12 }}>
                          <div className="finances__perf-comm-total-row">
                            <span>Pagado hasta ahora</span>
                            <span style={{ color: '#3B82F6', fontWeight: 600 }}>{formatCOP(st.total_paid)}</span>
                          </div>
                          {(st.tips_total || 0) > 0 && (
                            <div className="finances__perf-comm-total-row">
                              <span>Propinas</span>
                              <span style={{ color: '#059669', fontWeight: 600 }}>+{formatCOP(st.tips_total)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Final totals */}
                      <div className="finances__perf-comm-totals">
                        <div className="finances__perf-comm-total-row">
                          <span>Comisiones ganadas</span>
                          <span style={{ color: '#059669', fontWeight: 700 }}>{formatCOP(st.commission_amount)}</span>
                        </div>
                        {(st.fines_total || 0) > 0 && (
                          <div className="finances__perf-comm-total-row">
                            <span>Multas ({st.fines_count || st.fines?.length || 0})</span>
                            <span style={{ color: '#DC2626', fontWeight: 700 }}>-{formatCOP(st.fines_total)}</span>
                          </div>
                        )}
                        <div className="finances__perf-comm-total-row finances__perf-comm-total-row--final">
                          <span>Neto a pagar</span>
                          <span style={{ color: netEarnings >= 0 ? '#059669' : '#DC2626', fontWeight: 800, fontSize: 18 }}>{formatCOP(netEarnings)}</span>
                        </div>
                        {st.balance > 0 && (
                          <div className="finances__perf-comm-total-row" style={{ marginTop: 4 }}>
                            <span style={{ color: '#DC2626' }}>Saldo pendiente</span>
                            <span style={{ color: '#DC2626', fontWeight: 700 }}>{formatCOP(st.balance)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── SERVICIOS TAB ── */}
                  {activeTab === 'servicios' && (
                    <div className="finances__nom-expand">
                      <div className="finances__nom-expand-head">
                        <div className="finances__nom-expand-title">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                          Servicios realizados
                        </div>
                        {selectedVisitIds.length > 0 && !isStaffView && (
                          <button className="finances__nom-pay-selected" onClick={() => openPayModal(st, true)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Pagar {selectedVisitIds.length} seleccionadas
                          </button>
                        )}
                      </div>
                      <StaffVisitsList
                        staffId={st.staff_id}
                        dateFrom={effDateFrom}
                        dateTo={effDateTo}
                        commissionRate={st.commission_rate}
                        finesTotal={st.fines_total || 0}
                        tipsTotal={st.tips_total || 0}
                        selectable={!isStaffView}
                        selectedIds={selectedVisitIds}
                        onSelectionChange={setSelectedVisitIds}
                        isStaffView={isStaffView}
                        onVisitsLoaded={(v) => setStaffVisitsMap(prev => ({ ...prev, [st.staff_id]: v }))}
                      />
                    </div>
                  )}

                  {/* ── PAGOS TAB ── */}
                  {activeTab === 'pagos' && (
                    <div className="finances__nom-expand">
                      <div className="finances__nom-expand-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Historial de pagos
                        {staffPayments.length > 0 && <span className="finances__nom-expand-count">{staffPayments.length}</span>}
                      </div>
                      {staffPayments.length > 0 ? (
                        <div className="finances__nom-payments">
                          {staffPayments.map(p => (
                            <div key={p.id} className="finances__nom-payment-card">
                              <div className="finances__nom-payment-top">
                                <div className="finances__nom-payment-info">
                                  <span className="finances__nom-payment-date">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                                    {new Date(p.paid_at + 'Z').toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  <span className="finances__nom-payment-concept">{p.concept}</span>
                                </div>
                                <div className="finances__nom-payment-right">
                                  <span className="finances__nom-payment-method">{p.payment_method}</span>
                                  <span className="finances__nom-payment-amount">{formatCOP(p.amount)}</span>
                                </div>
                              </div>
                              <div className="finances__nom-payment-bottom">
                                {p.receipt_number && <span className="finances__nom-receipt-tag">{p.receipt_number}</span>}
                                {p.paid_by && <span className="finances__nom-payment-by">Por: {p.paid_by}</span>}
                                {p.reference && <span className="finances__nom-payment-ref">Ref: {p.reference}</span>}
                                <div className="finances__nom-payment-actions">
                                  {p.receipt_number && (
                                    <button className="finances__nom-action-btn" onClick={() => openPaymentReceipt(p.id, null, isStaffView)} title="Ver comprobante">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </button>
                                  )}
                                  {!isStaffView && (
                                    <button className="finances__nom-action-btn finances__nom-action-btn--danger" onClick={() => handleDeletePayment(p.id)} title="Eliminar">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="finances__nom-empty-payments">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                          <p>Sin pagos registrados</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pay Modal ── */}
      {showPayModal && createPortal(
        <div className="finances__pay-overlay" onClick={() => { setShowPayModal(null); setSelectedVisitIds([]); }}>
          <form className="finances__pay-modal" onClick={e => e.stopPropagation()} onSubmit={handlePay}>
            <div className="finances__pay-header">
              <h2>Registrar pago</h2>
              <button type="button" onClick={() => { setShowPayModal(null); setSelectedVisitIds([]); }} className="finances__modal-close">&times;</button>
            </div>

            <div className="finances__pay-staff">
              <span className="finances__nomina-avatar" style={{ background: showPayModal.photo_url ? 'transparent' : '#2D5A3D', width: 44, height: 44, fontSize: 15 }}>
                {showPayModal.photo_url ? <img src={showPayModal.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : showPayModal.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </span>
              <div>
                <strong>{showPayModal.staff_name}</strong>
                <small style={{ display: 'block', color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                  {showPayModal.staff_role} · {(showPayModal.commission_rate * 100).toFixed(0)}%
                </small>
                <small style={{ display: 'block', color: 'rgba(0,0,0,0.5)', fontSize: 12, marginTop: 2 }}>
                  Comisiones: {formatCOP(showPayModal.total_earned)}
                  {(showPayModal.fines_total || 0) > 0 && <span style={{ color: '#DC2626' }}> · Multas: -{formatCOP(showPayModal.fines_total)}</span>}
                  {' '}· Pagado: {formatCOP(showPayModal.total_paid)} · <strong style={{ color: showPayModal.balance > 0 ? '#DC2626' : '#059669' }}>Saldo: {formatCOP(showPayModal.balance)}</strong>
                </small>
              </div>
            </div>

            {/* Bank info */}
            {bankInfo && (bankInfo.bank_account_number || bankInfo.nequi_phone || bankInfo.daviplata_phone) && (
              <div className="finances__pay-bank">
                <span className="finances__pay-bank-label">Cuenta destino</span>
                <div className="finances__pay-bank-info">
                  {(bankInfo.preferred_payment_method === 'nequi' && bankInfo.nequi_phone) ? (
                    <span>Nequi: <strong>{bankInfo.nequi_phone.replace(/(\d{3})(\d+)(\d{4})/, '$1-***-$3')}</strong></span>
                  ) : (bankInfo.preferred_payment_method === 'daviplata' && bankInfo.daviplata_phone) ? (
                    <span>Daviplata: <strong>{bankInfo.daviplata_phone.replace(/(\d{3})(\d+)(\d{4})/, '$1-***-$3')}</strong></span>
                  ) : ((bankInfo.preferred_payment_method === 'transferencia' || bankInfo.preferred_payment_method === 'bancolombia') && bankInfo.bank_name && bankInfo.bank_account_number) ? (
                    <span>{bankInfo.bank_name} · {bankInfo.bank_account_type} · <strong>****{bankInfo.bank_account_number.slice(-4)}</strong></span>
                  ) : (
                    <span style={{ color: '#999' }}>Metodo: {bankInfo.preferred_payment_method || '—'}</span>
                  )}
                  {bankInfo.document_type && bankInfo.document_number && (
                    <small style={{ display: 'block', color: 'rgba(0,0,0,0.4)', fontSize: 11, marginTop: 2 }}>
                      {bankInfo.document_type}: ****{bankInfo.document_number.slice(-4)}
                    </small>
                  )}
                </div>
              </div>
            )}

            {selectedVisitIds.length > 0 && (
              <div className="finances__pay-selected-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D5A3D" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>{selectedVisitIds.length} servicios seleccionados — Total a pagar: {formatCOP(parseInt(payForm.amount) || 0)}</span>
              </div>
            )}

            <div className="finances__pay-fields">
              <div className="finances__pay-field">
                <label>Monto a pagar *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'rgba(0,0,0,0.35)', fontWeight: 600 }}>$</span>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required className="finances__input" />
                </div>
              </div>
              <div className="finances__pay-field">
                <label>Concepto *</label>
                <input value={payForm.concept} onChange={e => setPayForm(f => ({ ...f, concept: e.target.value }))} required className="finances__input" />
              </div>
              <div className="finances__pay-field">
                <label>Metodo de pago *</label>
                <select value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))} className="finances__select">
                  <option value="efectivo">Efectivo</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="transferencia">Transferencia bancaria</option>
                </select>
              </div>
              <div className="finances__pay-field">
                <label>Referencia / Nro. transferencia</label>
                <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} className="finances__input" placeholder="Opcional" />
              </div>
              <div className="finances__pay-field">
                <label>Notas</label>
                <textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} className="finances__input" rows={2} placeholder="Opcional" />
              </div>
            </div>
            <div className="finances__pay-actions">
              <button type="button" className="finances__btn-ghost" onClick={() => { setShowPayModal(null); setSelectedVisitIds([]); }}>Cancelar</button>
              <button type="submit" className="finances__btn-primary" disabled={submitting}>
                {submitting ? 'Procesando...' : `Pagar ${formatCOP(parseInt(payForm.amount) || 0)}`}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* ── Bulk Pay Modal ── */}
      {showBulkModal && createPortal(
        <div className="finances__pay-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="finances__pay-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="finances__pay-header">
              <h2>Liquidar nomina</h2>
              <button type="button" onClick={() => setShowBulkModal(false)} className="finances__modal-close">&times;</button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', marginBottom: 16 }}>
                Selecciona los profesionales a pagar. Se creara un pago individual para cada uno.
              </p>
              <div className="finances__bulk-list">
                {staffWithBalance.map(st => (
                  <label key={st.staff_id} className={`finances__bulk-item ${bulkSelections[st.staff_id] ? 'finances__bulk-item--selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!bulkSelections[st.staff_id]}
                      onChange={() => setBulkSelections(prev => ({ ...prev, [st.staff_id]: !prev[st.staff_id] }))}
                    />
                    <span className="finances__nomina-avatar" style={{ background: st.photo_url ? 'transparent' : '#2D5A3D', width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>
                      {st.photo_url ? <img src={st.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : st.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </span>
                    <span style={{ flex: 1 }}>
                      <strong style={{ fontSize: 13 }}>{st.staff_name}</strong>
                      <small style={{ display: 'block', fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{st.staff_role} · {(st.commission_rate * 100).toFixed(0)}%</small>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#DC2626' }}>{formatCOP(st.balance)}</span>
                  </label>
                ))}
              </div>
              <div className="finances__bulk-total">
                <span>Total a dispersar ({staffWithBalance.filter(st => bulkSelections[st.staff_id]).length} profesionales)</span>
                <strong>{formatCOP(bulkTotal)}</strong>
              </div>
            </div>
            <div className="finances__pay-actions">
              <button className="finances__btn-ghost" onClick={() => setShowBulkModal(false)}>Cancelar</button>
              <button className="finances__btn-primary" onClick={handleBulkPay} disabled={bulkPaying || bulkTotal === 0}>
                {bulkPaying ? 'Procesando...' : `Liquidar ${formatCOP(bulkTotal)}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Fine Modal ── */}
      {fineModal && createPortal(
        <div className="finances__perf-fine-overlay" onClick={() => setFineModal(null)}>
          <div className="finances__perf-fine-modal" onClick={e => e.stopPropagation()}>
            <h3>Agregar multa</h3>
            <p className="finances__perf-fine-modal-staff">
              {staffList.find(s => s.staff_id === fineModal)?.staff_name || ''}
            </p>
            <label className="finances__perf-fine-label">
              Motivo *
              <input
                className="finances__input"
                placeholder="Ej: Llegada tarde, Ausencia sin aviso..."
                value={fineForm.reason}
                onChange={e => setFineForm(p => ({ ...p, reason: e.target.value }))}
              />
            </label>
            <label className="finances__perf-fine-label">
              Monto (COP) *
              <input
                className="finances__input"
                type="number"
                placeholder="Ej: 20000"
                value={fineForm.amount}
                onChange={e => setFineForm(p => ({ ...p, amount: e.target.value }))}
              />
            </label>
            <label className="finances__perf-fine-label">
              Notas adicionales
              <textarea
                className="finances__input"
                rows={2}
                placeholder="Detalles adicionales..."
                value={fineForm.notes}
                onChange={e => setFineForm(p => ({ ...p, notes: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </label>
            <div className="finances__perf-fine-modal-actions">
              <button className="finances__btn finances__btn--ghost" onClick={() => setFineModal(null)}>Cancelar</button>
              <button
                className="finances__btn finances__btn--danger"
                disabled={savingFine || !fineForm.reason.trim() || !fineForm.amount}
                onClick={handleAddFine}
              >
                {savingFine ? 'Guardando...' : 'Registrar multa'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default TabLiquidacion;
