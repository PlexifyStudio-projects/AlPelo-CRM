import { useState, useEffect, useCallback } from 'react';
import { formatCOP } from './financeConstants';
import financeService from '../../services/financeService';
import { useNotification } from '../../context/NotificationContext';

const formatDateLong = (iso) => {
  if (!iso) return '—';
  try {
    const safe = iso.length === 10 ? iso + 'T12:00:00' : iso;
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: '2-digit', year: '2-digit',
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
  paid: { label: 'Pagado', tone: 'paid' },
  sent: { label: 'Emitida', tone: 'sent' },
  draft: { label: 'Borrador', tone: 'draft' },
  cancelled: { label: 'Cancelada', tone: 'cancelled' },
};

const PAYMENT_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia bancaria',
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

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await financeService.cancelInvoice(invoiceId);
      addNotification('Factura anulada', 'success');
      setConfirmCancel(false);
      if (onCancelled) onCancelled();
      else load();
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

  // Aggregate payment methods (single for now, but structured for future split-pay)
  const payments = invoice.payment_method ? [
    { method: invoice.payment_method, amount: total },
  ] : [];

  // Derive commissions from items if available
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
      {/* Breadcrumb */}
      <nav className="invoice-detail__breadcrumb">
        <button className="invoice-detail__breadcrumb-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Historial de ventas
        </button>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        <span className="invoice-detail__breadcrumb-current">{invoice.invoice_number || `#${invoice.id}`}</span>
      </nav>

      <div className="invoice-detail__layout">
        {/* MAIN PANEL */}
        <section className="invoice-detail__main">
          <header className="invoice-detail__main-head">
            <div>
              <span className="invoice-detail__main-eyebrow">Detalle de la transacción</span>
              <h2 className="invoice-detail__main-title">{invoice.invoice_number || `#${invoice.id}`}</h2>
            </div>
            <button className="invoice-detail__icon-btn" title="Descargar / compartir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </header>

          {/* Status row */}
          <div className="invoice-detail__badges">
            <span className={`invoice-detail__badge invoice-detail__badge--${statusMeta.tone}`}>
              {status === 'paid' && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              {statusMeta.label}
            </span>
            {invoice.alegra_id && (
              <span className="invoice-detail__badge invoice-detail__badge--paid">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Facturado electrónicamente
              </span>
            )}
            {invoice.created_at && (
              <span className="invoice-detail__time" title={formatDateTime(invoice.created_at)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {formatDateTime(invoice.created_at)}
              </span>
            )}
          </div>

          {/* 3 info cards */}
          <div className="invoice-detail__cards">
            <div className="invoice-detail__card">
              <div className="invoice-detail__card-icon invoice-detail__card-icon--client">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="invoice-detail__card-body">
                <span className="invoice-detail__card-label">Cobrado a</span>
                <span className="invoice-detail__card-value">{invoice.client_name || '—'}</span>
                {invoice.client_document && (
                  <span className="invoice-detail__card-meta">{invoice.client_document_type || 'CC'} {invoice.client_document}</span>
                )}
              </div>
            </div>

            <div className="invoice-detail__card">
              <div className="invoice-detail__card-icon invoice-detail__card-icon--date">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div className="invoice-detail__card-body">
                <span className="invoice-detail__card-label">Fecha de la factura</span>
                <span className="invoice-detail__card-value">{formatDateLong(invoice.issued_date || invoice.created_at)}</span>
              </div>
            </div>

            <div className="invoice-detail__card">
              <div className="invoice-detail__card-icon invoice-detail__card-icon--money">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/><path d="M21 12h-4a2 2 0 0 0 0 4h4z"/></svg>
              </div>
              <div className="invoice-detail__card-body">
                <span className="invoice-detail__card-label">Valor final</span>
                <span className="invoice-detail__card-value invoice-detail__card-value--big">{formatCOP(total)}</span>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="invoice-detail__items">
            <div className="invoice-detail__items-head">
              <span>Nombre del item</span>
              <span className="invoice-detail__items-head--c">Cantidad</span>
              <span className="invoice-detail__items-head--r">Valor</span>
              <span className="invoice-detail__items-head--r">Valor final</span>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="invoice-detail__item">
                <div className="invoice-detail__item-info">
                  <span className="invoice-detail__item-name">{it.service_name || 'Servicio'}</span>
                  {it.staff_name && <span className="invoice-detail__item-meta">Colaborador: {it.staff_name}</span>}
                </div>
                <span className="invoice-detail__item-qty">{it.quantity || 1}</span>
                <span className="invoice-detail__item-price">{formatCOP(it.unit_price || 0)}</span>
                <span className="invoice-detail__item-total">{formatCOP(it.total || (it.quantity || 1) * (it.unit_price || 0))}</span>
              </div>
            ))}
          </div>

          {/* Notes & responsable */}
          <div className="invoice-detail__footer-info">
            <div>
              <span className="invoice-detail__field-label">Notas</span>
              <span className="invoice-detail__field-value">{invoice.notes || 'No registra'}</span>
            </div>
            <div>
              <span className="invoice-detail__field-label">Responsable de venta</span>
              <span className="invoice-detail__field-value invoice-detail__field-value--em">{invoice.created_by || invoice.responsible || '—'}</span>
            </div>
            <div>
              <span className="invoice-detail__field-label">Fuente</span>
              <span className="invoice-detail__field-value">{invoice.source || 'Administración'}</span>
            </div>
          </div>
        </section>

        {/* SIDEBAR */}
        <aside className="invoice-detail__sidebar">
          {/* Summary */}
          <div className="invoice-detail__panel">
            <h3 className="invoice-detail__panel-title">Resumen de la venta</h3>
            <div className="invoice-detail__sum-row">
              <span>Valor neto</span>
              <span>{formatCOP(subtotal)}</span>
            </div>
            <div className="invoice-detail__sum-row">
              <span>Total en propinas</span>
              <span>{formatCOP(tip)}</span>
            </div>
            <div className="invoice-detail__sum-row">
              <span>Valor ingresado</span>
              <span>{formatCOP(total)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="invoice-detail__sum-row invoice-detail__sum-row--neg">
                <span>Descuento</span>
                <span>−{formatCOP(invoice.discount_amount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="invoice-detail__sum-row">
                <span>Impuestos</span>
                <span>{formatCOP(tax)}</span>
              </div>
            )}
            <div className="invoice-detail__sum-row invoice-detail__sum-row--total">
              <span>Total</span>
              <span>{formatCOP(total)}</span>
            </div>

            {!isCancelled && (
              <button
                type="button"
                className="invoice-detail__cancel-btn"
                onClick={() => setConfirmCancel(true)}
              >
                Anular venta
              </button>
            )}
          </div>

          {/* Payment methods */}
          {payments.length > 0 && (
            <div className="invoice-detail__panel">
              <h3 className="invoice-detail__panel-title">Métodos de pago</h3>
              {payments.map((p, idx) => (
                <div key={idx} className="invoice-detail__sum-row">
                  <span className="invoice-detail__pay-method">
                    <span className={`invoice-detail__pay-dot invoice-detail__pay-dot--${p.method}`} />
                    {PAYMENT_LABELS[p.method] || p.method}
                  </span>
                  <span>{formatCOP(p.amount)}</span>
                </div>
              ))}
              <div className="invoice-detail__sum-row invoice-detail__sum-row--total">
                <span>Total</span>
                <span>{formatCOP(total)}</span>
              </div>
            </div>
          )}

          {/* Commissions */}
          {commissions.length > 0 && (
            <div className="invoice-detail__panel">
              <h3 className="invoice-detail__panel-title">Comisiones generadas</h3>
              <div className="invoice-detail__comm-head">
                <span>Item</span>
                <span className="invoice-detail__comm-head--c">Cant.</span>
                <span className="invoice-detail__comm-head--r">Comisión</span>
              </div>
              {commissions.map((c, idx) => (
                <div key={idx} className="invoice-detail__comm-row">
                  <div className="invoice-detail__comm-info">
                    <span className="invoice-detail__comm-svc">{c.service_name}</span>
                    <span className="invoice-detail__comm-staff">Colaborador: {c.staff_name}</span>
                  </div>
                  <span className="invoice-detail__comm-qty">{c.qty}</span>
                  <span className="invoice-detail__comm-amount">{formatCOP(c.commission)}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Confirm cancel */}
      {confirmCancel && (
        <div className="invoice-detail__confirm-backdrop" onClick={() => !cancelling && setConfirmCancel(false)}>
          <div className="invoice-detail__confirm" onClick={(e) => e.stopPropagation()}>
            <div className="invoice-detail__confirm-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h4>¿Anular esta venta?</h4>
            <p>La factura quedará marcada como cancelada y se revertirán las comisiones asociadas. Esta acción no se puede deshacer.</p>
            <div className="invoice-detail__confirm-actions">
              <button className="invoice-detail__confirm-ghost" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
                Cancelar
              </button>
              <button className="invoice-detail__confirm-danger" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Anulando...' : 'Sí, anular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetail;
