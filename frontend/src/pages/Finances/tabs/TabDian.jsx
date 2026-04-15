import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNotification } from '../../../context/NotificationContext';
import financeService from '../../../services/financeService';
import { API_URL, DIAN_STATUS_META, SkeletonBlock, formatCOP } from '../financeConstants';

const TabDian = () => {
  const [posStatus, setPosStatus] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [assigning, setAssigning] = useState(false);
  const [filter, setFilter] = useState('all'); // all, no_pos, pending, sent, accepted
  const [voidingId, setVoidingId] = useState(null);
  const { addNotification } = useNotification();

  const loadData = useCallback(async () => {
    try {
      const [statusRes, invData] = await Promise.all([
        fetch(`${API_URL}/invoices/pos-status`, { credentials: 'include' }),
        financeService.listInvoices(),
      ]);
      if (!statusRes.ok) throw new Error('Error obteniendo estado POS');
      const statusData = await statusRes.json();
      setPosStatus(statusData);
      setInvoices(Array.isArray(invData) ? invData : []);
    } catch (err) {
      addNotification(err.message || 'Error cargando datos DIAN', 'error');
    }
    finally { setLoading(false); }
  }, [addNotification]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredInvoices = useMemo(() => {
    // DIAN tab only shows invoices that have been sent here (is_pos = true)
    let list = invoices.filter(i => i.status !== 'cancelled' && i.is_pos);
    if (filter === 'pending') list = list.filter(i => i.dian_status === 'pending');
    else if (filter === 'sent') list = list.filter(i => i.dian_status === 'sent' || i.dian_status === 'accepted');
    else if (filter === 'voided') list = list.filter(i => i.dian_status === 'voided');
    return list.sort((a, b) => (b.issued_date || '').localeCompare(a.issued_date || ''));
  }, [invoices, filter]);

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    const eligible = filteredInvoices.filter(i => !i.is_pos);
    if (selected.size === eligible.length) setSelected(new Set());
    else setSelected(new Set(eligible.map(i => i.id)));
  };

  const handleAssignPOS = async () => {
    if (selected.size === 0) return;
    setAssigning(true);
    try {
      const res = await fetch(`${API_URL}/invoices/assign-pos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: [...selected] }),
      });
      if (!res.ok) { const err2 = await res.json().catch(() => ({})); throw new Error(err2.detail || 'Error asignando POS'); }
      const data = await res.json();
      addNotification(`${data.count} factura(s) con POS asignado`, 'success');
      setSelected(new Set());
      loadData();
    } catch (err) { addNotification(err.message, 'error'); }
    finally { setAssigning(false); }
  };

  const handleVoid = async (id) => {
    setVoidingId(id);
    try {
      const res = await fetch(`${API_URL}/invoices/${id}/void-pos`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (!res.ok) { const err2 = await res.json().catch(() => ({})); throw new Error(err2.detail || 'Error anulando POS'); }
      addNotification('Factura POS anulada', 'success');
      loadData();
    } catch (err) { addNotification(err.message, 'error'); }
    finally { setVoidingId(null); }
  };


  if (loading) return <div className="finances__comm-skeleton"><SkeletonBlock width="100%" height="200px" /></div>;

  const pctUsed = posStatus ? Math.round((posStatus.used / posStatus.total_range) * 100) : 0;

  return (
    <>
      {/* KPIs */}
      <div className="finances__kpis">
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{posStatus?.used || 0}</span>
            <span className="finances__kpi-label">POS emitidas</span>
          </div>
        </div>
        <div className={`finances__kpi-card ${(posStatus?.remaining || 0) <= 100 ? 'finances__kpi-card--warning' : ''}`}>
          <div className="finances__kpi-icon" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{posStatus?.remaining ?? '—'}</span>
            <span className="finances__kpi-label">Restantes</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon" style={{ background: posStatus?.completeness === 100 ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.1)', color: posStatus?.completeness === 100 ? '#059669' : '#D97706' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          </div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{posStatus?.completeness || 0}%</span>
            <span className="finances__kpi-label">Config DIAN</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {posStatus?.alerts?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {posStatus.alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', fontSize: 13, color: '#92400E' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {a}
            </div>
          ))}
        </div>
      )}

      {/* Range progress */}
      {posStatus && (
        <div className="finances__card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rango POS: {posStatus.prefix}-{posStatus.range_from} a {posStatus.prefix}-{posStatus.range_to}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: pctUsed > 90 ? '#DC2626' : pctUsed > 70 ? '#D97706' : '#059669' }}>{posStatus.used}/{posStatus.total_range}</span>
            </div>
            <div style={{ height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4 }}>
              <div style={{ width: `${pctUsed}%`, height: '100%', borderRadius: 4, background: pctUsed > 90 ? '#DC2626' : pctUsed > 70 ? '#D97706' : '#6366F1', transition: 'width 400ms' }} />
            </div>
            {posStatus.resolution_number && (
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 8 }}>
                Resolucion: {posStatus.resolution_number} {posStatus.resolution_valid_to ? `| Vigente hasta: ${posStatus.resolution_valid_to}` : ''}
                {posStatus.nit && ` | NIT: ${posStatus.nit}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toolbar: filters + assign button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            { v: 'all', l: 'Todas', c: invoices.filter(i => i.is_pos && i.status !== 'cancelled').length },
            { v: 'pending', l: 'Listas para enviar', c: invoices.filter(i => i.dian_status === 'pending').length },
            { v: 'sent', l: 'Enviadas DIAN', c: invoices.filter(i => i.dian_status === 'sent' || i.dian_status === 'accepted').length },
          ].map(f => (
            <button key={f.v} onClick={() => { setFilter(f.v); setSelected(new Set()); }}
              style={{ padding: '6px 14px', borderRadius: 20, border: filter === f.v ? '1.5px solid #6366F1' : '1px solid rgba(0,0,0,0.1)', background: filter === f.v ? 'rgba(99,102,241,0.06)' : 'white', fontSize: 12, fontWeight: 600, color: filter === f.v ? '#6366F1' : 'rgba(0,0,0,0.5)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {f.l} {f.c > 0 && <span style={{ opacity: 0.6 }}>({f.c})</span>}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <button onClick={handleAssignPOS} disabled={assigning}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: assigning ? 0.5 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            {assigning ? 'Asignando...' : `Asignar POS (${selected.size})`}
          </button>
        )}
      </div>

      {/* Select all for no_pos filter */}
      {filter === 'no_pos' && filteredInvoices.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 8, borderRadius: 8, background: 'rgba(0,0,0,0.02)', fontSize: 13, cursor: 'pointer' }} onClick={toggleAll}>
          <input type="checkbox" checked={selected.size === filteredInvoices.filter(i => !i.is_pos).length && selected.size > 0} readOnly style={{ cursor: 'pointer' }} />
          <span style={{ color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}>Seleccionar todas ({filteredInvoices.filter(i => !i.is_pos).length})</span>
        </div>
      )}

      {/* Invoice list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredInvoices.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(0,0,0,0.3)', fontSize: 14 }}>
            No hay facturas en esta categoria
          </div>
        )}
        {filteredInvoices.map(inv => {
          const ds = inv.dian_status ? DIAN_STATUS_META[inv.dian_status] : null;
          const isNoPOS = !inv.is_pos;
          return (
            <div key={inv.id} className="finances__card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px' }}>
                {/* Checkbox for unassigned */}
                {isNoPOS && (
                  <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)}
                    style={{ marginTop: 4, cursor: 'pointer', width: 18, height: 18, accentColor: '#6366F1' }} />
                )}
                {!isNoPOS && <div style={{ width: 18 }} />}

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Header row: invoice # + POS badge + status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>{inv.pos_full_number || inv.invoice_number}</span>
                      {inv.pos_full_number && inv.pos_full_number !== inv.invoice_number && (
                        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>({inv.invoice_number})</span>
                      )}
                    </div>
                    {ds ? (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: ds.color, background: ds.bg, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ds.label}</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: '#94A3B8', background: 'rgba(0,0,0,0.04)', textTransform: 'uppercase' }}>Sin POS</span>
                    )}
                  </div>

                  {/* Client info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <strong>{inv.client_name}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/></svg>
                      {inv.client_document_type || 'CC'}: {inv.client_document || '—'}
                    </div>
                    {inv.client_email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        {inv.client_email}
                      </div>
                    )}
                    {inv.client_phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>
                        {inv.client_phone}
                      </div>
                    )}
                  </div>

                  {/* Footer: payment + amount + date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#64748B' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.04)', fontWeight: 500, textTransform: 'capitalize' }}>{inv.payment_method || '—'}</span>
                      <span>{inv.issued_date}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 15, color: '#1E293B' }}>{formatCOP(inv.total)}</strong>
                      {inv.is_pos && inv.dian_status === 'pending' && (
                        <button onClick={() => handleVoid(inv.id)} disabled={voidingId === inv.id}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)', fontSize: 11, fontWeight: 600, color: '#DC2626', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {voidingId === inv.id ? '...' : 'Anular'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default TabDian;
