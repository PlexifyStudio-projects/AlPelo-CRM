import { useEffect, useState, useMemo } from 'react';
// Public receipt is rendered OUTSIDE CRMShell so it doesn't get the global
// stylesheet. Import the styles bundle here so the page is fully themed.
import '../../styles/main.scss';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const formatCOP = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(n || 0);

const formatDateTime = (iso) => {
  if (!iso) return '';
  try {
    const safe = iso.endsWith('Z') ? iso : `${iso}Z`;
    const d = new Date(safe);
    if (isNaN(d)) return iso;
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'America/Bogota',
    }).format(d);
  } catch { return iso; }
};

const PublicReceipt = ({ receiptId }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const isPrintMode = useMemo(() => {
    return new URLSearchParams(window.location.search).get('print') === '1';
  }, []);

  useEffect(() => {
    if (!receiptId) {
      setError('Recibo no especificado');
      setLoading(false);
      return;
    }
    fetch(`${API}/public/receipt/${receiptId}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.detail || `Error ${r.status}`);
        }
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message || 'No se pudo cargar el recibo'); setLoading(false); });
  }, [receiptId]);

  // Auto-trigger print dialog when ?print=1 and data is loaded
  useEffect(() => {
    if (isPrintMode && data) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [isPrintMode, data]);

  if (loading) {
    return (
      <div className="public-receipt__shell">
        <div className="public-receipt__loader">
          <div className="public-receipt__spin" />
          <p>Cargando recibo...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="public-receipt__shell">
        <div className="public-receipt__error">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h1>Recibo no disponible</h1>
          <p>{error || 'Es posible que el enlace haya expirado o sea incorrecto.'}</p>
        </div>
      </div>
    );
  }

  const isPaid = (data.status || '').toLowerCase().includes('pag');
  const tenantName = data.tenant?.name || 'Plexify Studio';
  const accentColor = data.tenant?.brand_color || '#1E40AF';

  return (
    <div className="public-receipt__shell" style={{ '--accent': accentColor }}>
      {!isPrintMode && (
        <header className="public-receipt__topbar">
          <div className="public-receipt__brand">
            {data.tenant?.logo_url ? (
              <img src={data.tenant.logo_url} alt={tenantName} className="public-receipt__brand-logo" />
            ) : (
              <span className="public-receipt__brand-mono">{tenantName[0] || 'P'}</span>
            )}
            <span className="public-receipt__brand-name">{tenantName}</span>
          </div>
          <div className="public-receipt__actions">
            <button
              type="button"
              className="public-receipt__btn"
              onClick={() => window.print()}
              title="Imprimir o guardar como PDF"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Descargar
            </button>
          </div>
        </header>
      )}

      <main className="public-receipt__page">
        <div className="public-receipt__card">
          <div className="public-receipt__card-head">
            <div>
              <span className="public-receipt__doc-label">Recibo</span>
              <h1 className="public-receipt__doc-num">{data.number}</h1>
            </div>
            <span className={`public-receipt__status ${isPaid ? 'public-receipt__status--paid' : ''}`}>
              {isPaid && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              {data.status}
            </span>
          </div>

          <div className="public-receipt__meta">
            <div className="public-receipt__meta-row">
              <span className="public-receipt__meta-label">Cliente</span>
              <span className="public-receipt__meta-value">{data.client_name || '—'}</span>
            </div>
            <div className="public-receipt__meta-row">
              <span className="public-receipt__meta-label">Emitido</span>
              <span className="public-receipt__meta-value">{formatDateTime(data.issued_at)}</span>
            </div>
            {data.payment_method && (
              <div className="public-receipt__meta-row">
                <span className="public-receipt__meta-label">Método de pago</span>
                <span className="public-receipt__meta-value public-receipt__meta-value--cap">{data.payment_method}</span>
              </div>
            )}
          </div>

          <div className="public-receipt__items">
            <div className="public-receipt__items-head">
              <span>Detalle</span>
              <span className="public-receipt__items-head-right">Total</span>
            </div>
            {(data.items || []).map((it, idx) => (
              <div key={idx} className="public-receipt__item">
                <div className="public-receipt__item-info">
                  <span className="public-receipt__item-name">{it.name}{it.qty > 1 ? <span className="public-receipt__item-qty"> × {it.qty}</span> : null}</span>
                  {it.staff_name && <span className="public-receipt__item-meta">por {it.staff_name}</span>}
                </div>
                <span className="public-receipt__item-amount">{formatCOP(it.total)}</span>
              </div>
            ))}
          </div>

          <div className="public-receipt__totals">
            <div className="public-receipt__totals-row">
              <span>Subtotal</span>
              <span>{formatCOP(data.subtotal)}</span>
            </div>
            {data.tax > 0 && (
              <div className="public-receipt__totals-row">
                <span>Impuestos</span>
                <span>{formatCOP(data.tax)}</span>
              </div>
            )}
            <div className="public-receipt__totals-row public-receipt__totals-row--grand">
              <span>Total</span>
              <span>{formatCOP(data.total)}</span>
            </div>
          </div>

          {(data.tenant?.address || data.tenant?.phone) && (
            <div className="public-receipt__tenant-info">
              {data.tenant.address && <p>{data.tenant.address}</p>}
              {data.tenant.phone && <p>{data.tenant.phone}</p>}
            </div>
          )}
        </div>

        <p className="public-receipt__footer">
          Generado por <strong>{tenantName}</strong> con <a href="https://plexifystudio.com" target="_blank" rel="noreferrer">Plexify Studio</a>
        </p>
      </main>
    </div>
  );
};

export default PublicReceipt;
