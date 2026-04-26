import { useState, useEffect, useCallback } from 'react';
import { formatCOP } from './financeConstants';
import financeService from '../../services/financeService';
import { useNotification } from '../../context/NotificationContext';

const formatDateLong = (iso) => {
  if (!iso) return '—';
  try {
    const safe = iso.length === 10 ? iso + 'T12:00:00' : iso;
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(safe));
  } catch { return iso; }
};

const formatDateTime = (iso) => {
  if (!iso) return '';
  try {
    const safe = iso.endsWith('Z') ? iso : `${iso}Z`;
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'America/Bogota',
    }).format(new Date(safe));
  } catch { return iso; }
};

const STATUS_BADGES = {
  paid:     { label: 'Pagado',    tone: 'paid' },
  sent:     { label: 'Emitida',   tone: 'sent' },
  draft:    { label: 'Borrador',  tone: 'draft' },
  cancelled:{ label: 'Cancelada', tone: 'cancelled' },
};

const PAYMENT_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bancolombia: 'Bancolombia',
};

const InvoiceDetail = ({ invoiceId, onBack, onCancelled }) => {
  const { addNotification } = useNotification();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeService.getInvoice(invoiceId);
      setInvoice(data);
    } catch (err) {
      addNotification('No se pudo cargar la factura: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleOpenReceipt = useCallback(() => {
    if (!invoice) return;
    // Public receipt page (already styled like the desired layout) with auto-print.
    // The user can either print it physically or "Save as PDF" from the dialog.
    const base = window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    const url = `${base}/receipt/${invoice.id}?print=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [invoice]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await financeService.cancelInvoice(invoiceId);
      addNotification(`Factura ${invoice?.invoice_number || ''} anulada`, 'success');
      setConfirmCancel(false);
      // Reload locally so the badge flips to "Cancelada" without going back to the list
      await load();
      // Also notify parent so the list reload runs in the background
      if (onCancelled) onCancelled({ silent: true });
    } catch (err) {
      addNotification('No se pudo anular: ' + err.message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="invoice-detail">
        <div className="invoice-detail__loader">
          <div className="invoice-detail__spinner" />
          <p>Cargando factura...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="invoice-detail">
        <div className="invoice-detail__empty">
          <p>Factura no encontrada.</p>
          <button className="invoice-detail__back" onClick={onBack}>← Volver</button>
        </div>
      </div>
    );
  }

  const status = (invoice.status || '').toLowerCase();
  const statusMeta = STATUS_BADGES[status] || STATUS_BADGES.sent;
  const items = invoice.items || [];
  const subtotal = invoice.subtotal || items.reduce((s, i) => s + (i.total || (i.quantity || 1) * (i.unit_price || 0)), 0);
  const tax = invoice.tax_amount || 0;
  const tip = invoice.tip_amount || 0;
  const total = invoice.total || (subtotal + tax + tip);
  const isCancelled = status === 'cancelled';

  const payments = invoice.payment_method ? [
    { method: invoice.payment_method, amount: total },
  ] : [];

  const commissions = items
    .filter(it => it.staff_id || it.staff_name)
    .map(it => ({
      service_name: it.service_name,
      qty: it.quantity || 1,
      staff_name: it.staff_name || '—',
      commission: it.commission_amount || 0,
    }));

  return (
    <div className="invoice-detail">
      {/* TOP BAR — back button always visible */}
      <header className="invoice-detail__topbar">
        <button className="invoice-detail__back-pill" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Volver al historial
        </button>
        <div className="invoice-detail__topbar-actions">
          <button className="invoice-detail__top-action" title="Abrir e imprimir / guardar PDF" onClick={handleOpenReceipt}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar recibo
          </button>
          {!isCancelled && (
            <button
              className="invoice-detail__top-action invoice-detail__top-action--danger"
              onClick={() => setConfirmCancel(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              Anular
            </button>
          )}
        </div>
      </header>

      {/* HERO STRIP — number + status + total + key meta */}
      <section className={`invoice-detail__hero ${isCancelled ? 'invoice-detail__hero--cancelled' : ''}`}>
        <div className="invoice-detail__hero-left">
          <span className="invoice-detail__hero-eyebrow">Factura</span>
          <div className="invoice-detail__hero-num-row">
            <h1 className="invoice-detail__hero-num">{invoice.invoice_number || `#${invoice.id}`}</h1>
            <span className={`invoice-detail__chip invoice-detail__chip--${statusMeta.tone}`}>
              {status === 'paid' && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              {statusMeta.label}
            </span>
            {invoice.alegra_id && (
              <span className="invoice-detail__chip invoice-detail__chip--electronic">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Electrónica
              </span>
            )}
          </div>
          <div className="invoice-detail__hero-meta">
            <span className="invoice-detail__meta-pill">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {formatDateTime(invoice.created_at)}
            </span>
            <span className="invoice-detail__meta-pill">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {invoice.client_name || '—'}
            </span>
            {invoice.payment_method && (
              <span className="invoice-detail__meta-pill">
                <span className={`invoice-detail__pay-dot invoice-detail__pay-dot--${invoice.payment_method}`} />
                {PAYMENT_LABELS[invoice.payment_method] || invoice.payment_method}
              </span>
            )}
          </div>
        </div>
        <div className="invoice-detail__hero-right">
          <span className="invoice-detail__hero-total-label">Valor final</span>
          <span className="invoice-detail__hero-total">{formatCOP(total)}</span>
          {tip > 0 && (
            <span className="invoice-detail__hero-tip">incluye {formatCOP(tip)} de propina</span>
          )}
        </div>
      </section>

      {/* MAIN GRID — different layout: items take full width, sidebar info below */}
      <div className="invoice-detail__grid">
        {/* CLIENT CARD */}
        <div className="invoice-detail__panel invoice-detail__panel--client">
          <span className="invoice-detail__panel-eyebrow">Cliente</span>
          <h3 className="invoice-detail__client-name">{invoice.client_name || '—'}</h3>
          <ul className="invoice-detail__client-list">
            {invoice.client_document && (
              <li>
                <span>Documento</span>
                <span>{invoice.client_document_type || 'CC'} {invoice.client_document}</span>
              </li>
            )}
            {invoice.client_phone && (
              <li>
                <span>Teléfono</span>
                <span>{invoice.client_phone}</span>
              </li>
            )}
            {invoice.client_email && (
              <li>
                <span>Email</span>
                <span className="invoice-detail__truncate">{invoice.client_email}</span>
              </li>
            )}
            {invoice.client_address && (
              <li>
                <span>Dirección</span>
                <span>{invoice.client_address}</span>
              </li>
            )}
            <li>
              <span>Emitida</span>
              <span>{formatDateLong(invoice.issued_date || invoice.created_at)}</span>
            </li>
            <li>
              <span>Responsable</span>
              <span>{invoice.created_by || '—'}</span>
            </li>
          </ul>
        </div>

        {/* ITEMS — full-width with stripe header */}
        <div className="invoice-detail__panel invoice-detail__panel--items">
          <div className="invoice-detail__items-strip">
            <span className="invoice-detail__panel-eyebrow">Items facturados</span>
            <span className="invoice-detail__items-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
          </div>

          <div className="invoice-detail__items-table">
            <div className="invoice-detail__items-thead">
              <span>Servicio / Producto</span>
              <span className="invoice-detail__align-c">Cant.</span>
              <span className="invoice-detail__align-r">P. unitario</span>
              <span className="invoice-detail__align-r">Total</span>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="invoice-detail__items-tr">
                <div className="invoice-detail__items-svc">
                  <span className="invoice-detail__items-svc-name">{it.service_name || 'Servicio'}</span>
                  {it.staff_name && (
                    <span className="invoice-detail__items-svc-staff">
                      <span className="invoice-detail__staff-avatar">{it.staff_name[0]?.toUpperCase()}</span>
                      {it.staff_name}
                    </span>
                  )}
                </div>
                <span className="invoice-detail__align-c invoice-detail__items-qty">{it.quantity || 1}</span>
                <span className="invoice-detail__align-r invoice-detail__items-unit">{formatCOP(it.unit_price || 0)}</span>
                <span className="invoice-detail__align-r invoice-detail__items-total">{formatCOP(it.total || (it.quantity || 1) * (it.unit_price || 0))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TOTALS panel */}
        <div className="invoice-detail__panel invoice-detail__panel--totals">
          <span className="invoice-detail__panel-eyebrow">Resumen</span>
          <div className="invoice-detail__totals-list">
            <div className="invoice-detail__totals-line">
              <span>Subtotal</span>
              <span>{formatCOP(subtotal)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="invoice-detail__totals-line invoice-detail__totals-line--neg">
                <span>Descuento</span>
                <span>−{formatCOP(invoice.discount_amount)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="invoice-detail__totals-line">
                <span>Propinas</span>
                <span>{formatCOP(tip)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="invoice-detail__totals-line">
                <span>Impuestos</span>
                <span>{formatCOP(tax)}</span>
              </div>
            )}
            <div className="invoice-detail__totals-grand">
              <span>Total</span>
              <span>{formatCOP(total)}</span>
            </div>
          </div>
        </div>

        {/* PAYMENT METHODS */}
        {payments.length > 0 && (
          <div className="invoice-detail__panel invoice-detail__panel--payments">
            <span className="invoice-detail__panel-eyebrow">Métodos de pago</span>
            <ul className="invoice-detail__pay-list">
              {payments.map((p, idx) => (
                <li key={idx}>
                  <span className="invoice-detail__pay-method">
                    <span className={`invoice-detail__pay-dot invoice-detail__pay-dot--${p.method}`} />
                    {PAYMENT_LABELS[p.method] || p.method}
                  </span>
                  <span>{formatCOP(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* COMMISSIONS */}
        {commissions.length > 0 && (
          <div className="invoice-detail__panel invoice-detail__panel--commissions">
            <span className="invoice-detail__panel-eyebrow">Comisiones generadas</span>
            <ul className="invoice-detail__comm-list">
              {commissions.map((c, idx) => (
                <li key={idx}>
                  <div className="invoice-detail__comm-line">
                    <span className="invoice-detail__staff-avatar">{c.staff_name[0]?.toUpperCase()}</span>
                    <div className="invoice-detail__comm-text">
                      <span className="invoice-detail__comm-name">{c.staff_name}</span>
                      <span className="invoice-detail__comm-svc">{c.service_name} × {c.qty}</span>
                    </div>
                  </div>
                  <span className="invoice-detail__comm-amount">{formatCOP(c.commission)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* NOTES */}
        {invoice.notes && (
          <div className="invoice-detail__panel invoice-detail__panel--notes">
            <span className="invoice-detail__panel-eyebrow">Notas</span>
            <p className="invoice-detail__notes">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Confirm cancel */}
      {confirmCancel && (
        <div className="invoice-detail__confirm-backdrop" onClick={() => !cancelling && setConfirmCancel(false)}>
          <div className="invoice-detail__confirm" onClick={(e) => e.stopPropagation()}>
            <div className="invoice-detail__confirm-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            </div>
            <h4>¿Anular esta venta?</h4>
            <p>La factura <strong>{invoice.invoice_number}</strong> quedará marcada como <strong>cancelada</strong>, como si nunca se hubiera realizado. Las comisiones asociadas se revertirán y no contará en los reportes financieros. Esta acción no se puede deshacer.</p>
            <div className="invoice-detail__confirm-actions">
              <button className="invoice-detail__confirm-ghost" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
                Cancelar
              </button>
              <button className="invoice-detail__confirm-danger" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Anulando...' : 'Sí, anular venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetail;
