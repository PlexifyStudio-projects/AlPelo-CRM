import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, Tooltip,
} from 'recharts';
import { useNotification } from '../../../context/NotificationContext';
import {
  Icons, CATEGORY_COLORS, API_URL,
  formatCOP, AnimatedNumber, RechartsTooltip, SkeletonBlock,
} from '../financeConstants';

const TabRendimiento = ({ period, dateFrom, dateTo }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filterStaff, setFilterStaff] = useState('');
  const [sortBy, setSortBy] = useState('revenue');
  const [fineModal, setFineModal] = useState(null); // staff_id or null
  const [fineForm, setFineForm] = useState({ reason: '', amount: '', notes: '' });
  const [savingFine, setSavingFine] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [detailTab, setDetailTab] = useState({}); // {staff_id: 'comisiones' | 'multas' | 'metricas'}
  const { addNotification } = useNotification();

  const loadData = async () => {
    setLoading(true);
    try {
      const p = period || 'month';
      let url = `${API_URL}/finances/staff-performance?period=${p}`;
      if (p === 'custom' && dateFrom && dateTo) {
        url += `&date_from=${dateFrom}&date_to=${dateTo}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Error cargando rendimiento');
      const d = await res.json();
      setData(Array.isArray(d) ? d : []);
    } catch (err) {
      if (err.name !== 'AbortError' && err.message !== 'Failed to fetch') {
        addNotification('Error: ' + err.message, 'error');
      }
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [period, dateFrom, dateTo]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch(`${API_URL}/staff`, { credentials: 'include' });
        if (!res.ok) throw new Error('Error cargando staff');
        const d = await res.json();
        setStaffList(Array.isArray(d) ? d : d.staff || []);
      } catch (err) {
        if (err.name !== 'AbortError' && err.message !== 'Failed to fetch') {
          addNotification('Error: ' + err.message, 'error');
        }
      }
    };
    fetchStaff();
  }, []);

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

  const filtered = useMemo(() => filterStaff ? data.filter(s => s.staff_name.toLowerCase().includes(filterStaff.toLowerCase())) : data, [data, filterStaff]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'services') return b.services_count - a.services_count;
    if (sortBy === 'clients') return b.unique_clients - a.unique_clients;
    if (sortBy === 'ticket') return b.avg_ticket - a.avg_ticket;
    if (sortBy === 'growth') return b.revenue_growth - a.revenue_growth;
    return b.revenue - a.revenue;
  }), [filtered, sortBy]);

  const { totalRevenue, totalServices, totalClients, totalCommissions, totalFines } = useMemo(() => ({
    totalRevenue: data.reduce((s, st) => s + st.revenue, 0),
    totalServices: data.reduce((s, st) => s + st.services_count, 0),
    totalClients: data.reduce((s, st) => s + st.unique_clients, 0),
    totalCommissions: data.reduce((s, st) => s + st.commission_amount, 0),
    totalFines: data.reduce((s, st) => s + (st.fines_total || 0), 0),
  }), [data]);

  if (loading) return <div className="finances__comm-skeleton">{[...Array(3)].map((_, i) => <div key={i} className="finances__card" style={{ padding: 20 }}><SkeletonBlock width="100%" height="80px" /></div>)}</div>;
  if (!data.length) return <div className="finances__empty">Sin datos de rendimiento para este periodo</div>;
  const maxRev = sorted[0]?.revenue || 1;
  const medals = ['🥇', '🥈', '🥉'];

  const getDetailTab = (staffId) => detailTab[staffId] || 'liquidacion';

  return (
    <>
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.users}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{data.length}</span>
            <span className="finances__kpi-label">Profesionales</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalRevenue} prefix="$" /></span>
            <span className="finances__kpi-label">Ingresos totales</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalCommissions} prefix="$" /></span>
            <span className="finances__kpi-label">Comisiones totales</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--danger">{Icons.receipt}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalFines} prefix="$" /></span>
            <span className="finances__kpi-label">Multas totales</span>
          </div>
        </div>
      </div>

      {/* Filters */}
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

      {/* Leaderboard */}
      <div className="finances__perf-list">
        {sorted.map((st, i) => {
          const pct = Math.round((st.revenue / maxRev) * 100);
          const sharePct = totalRevenue > 0 ? Math.round((st.revenue / totalRevenue) * 100) : 0;
          const isExpanded = expandedId === st.staff_id;
          const netEarnings = st.commission_amount - (st.fines_total || 0);
          const activeTab = getDetailTab(st.staff_id);
          return (
            <div key={st.staff_id} className={`finances__perf-card ${isExpanded ? 'finances__perf-card--expanded' : ''}`}>
              <div className="finances__perf-item" onClick={() => setExpandedId(isExpanded ? null : st.staff_id)}>
                <span className="finances__perf-pos">{i < 3 ? medals[i] : i + 1}</span>
                <div className="finances__perf-avatar" style={{ background: st.photo_url ? 'transparent' : '#2D5A3D' }}>
                  {st.photo_url ? <img src={st.photo_url} alt="" /> : st.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div className="finances__perf-info">
                  <div className="finances__perf-header">
                    <div>
                      <strong className="finances__perf-name">{st.staff_name}</strong>
                      <span className="finances__perf-role">{st.staff_role}</span>
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
                <svg className={`finances__inv-chevron ${isExpanded ? 'finances__inv-chevron--open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </div>

              {isExpanded && (
                <div className="finances__perf-detail">
                  {/* Detail sub-tabs */}
                  <div className="finances__perf-tabs">
                    {['liquidacion', 'metricas'].map(tab => (
                      <button
                        key={tab}
                        className={`finances__perf-tab ${activeTab === tab ? 'finances__perf-tab--active' : ''}`}
                        onClick={() => setDetailTab(p => ({ ...p, [st.staff_id]: tab }))}
                      >
                        {tab === 'liquidacion' ? 'Liquidacion' : 'Metricas'}
                      </button>
                    ))}
                  </div>

                  {/* ── LIQUIDACION TAB — unified: services + fines + totals ── */}
                  {activeTab === 'liquidacion' && (
                    <div className="finances__perf-comm">
                      {/* Services commission table */}
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
                          <button className="finances__perf-fine-add-btn" onClick={() => { setFineModal(st.staff_id); setFineForm({ reason: '', amount: '', notes: '' }); }}>
                            + Agregar multa
                          </button>
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
                                  <button className="finances__perf-fine-del" onClick={() => handleDeleteFine(f.id)} title="Eliminar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="finances__perf-fines-empty">Sin multas en este periodo</div>
                        )}
                      </div>

                      {/* Final totals */}
                      <div className="finances__perf-comm-totals">
                        <div className="finances__perf-comm-total-row">
                          <span>Comisiones ganadas</span>
                          <span style={{ color: '#059669', fontWeight: 700 }}>{formatCOP(st.commission_amount)}</span>
                        </div>
                        {(st.fines_total || 0) > 0 && (
                          <div className="finances__perf-comm-total-row">
                            <span>Multas ({st.fines_count})</span>
                            <span style={{ color: '#DC2626', fontWeight: 700 }}>-{formatCOP(st.fines_total)}</span>
                          </div>
                        )}
                        <div className="finances__perf-comm-total-row finances__perf-comm-total-row--final">
                          <span>Neto a pagar</span>
                          <span style={{ color: netEarnings >= 0 ? '#059669' : '#DC2626', fontWeight: 800, fontSize: 18 }}>{formatCOP(netEarnings)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── METRICAS TAB ── */}
                  {activeTab === 'metricas' && (
                    <>
                      <div className="finances__perf-detail-grid">
                        <div className="finances__perf-compare">
                          <h4>Comparacion vs periodo anterior</h4>
                          <div className="finances__perf-compare-cards">
                            <div className="finances__perf-compare-card">
                              <span className="finances__perf-compare-label">Ingresos</span>
                              <strong>{formatCOP(st.revenue)}</strong>
                              <small>Anterior: {formatCOP(st.prev_revenue)}</small>
                              <span className={st.revenue_growth >= 0 ? 'finances__perf-growth--up' : 'finances__perf-growth--down'}>{st.revenue_growth > 0 ? '+' : ''}{st.revenue_growth}%</span>
                            </div>
                            <div className="finances__perf-compare-card">
                              <span className="finances__perf-compare-label">Servicios</span>
                              <strong>{st.services_count}</strong>
                              <small>Anterior: {st.prev_services}</small>
                              <span className={st.services_growth >= 0 ? 'finances__perf-growth--up' : 'finances__perf-growth--down'}>{st.services_growth > 0 ? '+' : ''}{st.services_growth}%</span>
                            </div>
                            <div className="finances__perf-compare-card">
                              <span className="finances__perf-compare-label">Clientes unicos</span>
                              <strong>{st.unique_clients}</strong>
                            </div>
                            <div className="finances__perf-compare-card">
                              <span className="finances__perf-compare-label">Mejor dia</span>
                              <strong>{st.best_day ? formatCOP(st.best_day.revenue) : '—'}</strong>
                              {st.best_day && <small>{new Date(st.best_day.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</small>}
                            </div>
                          </div>
                        </div>

                        <div className="finances__perf-categories">
                          <h4>Ingresos por categoria</h4>
                          {Object.entries(st.category_breakdown || {}).sort((a, b) => b[1] - a[1]).map(([cat, rev]) => (
                            <div key={cat} className="finances__perf-cat-row">
                              <span className="finances__perf-cat-name" style={{ color: CATEGORY_COLORS[cat] || '#666' }}>{cat}</span>
                              <div className="finances__perf-cat-bar-bg">
                                <div className="finances__perf-cat-bar" style={{ width: `${Math.round((rev / st.revenue) * 100)}%`, background: CATEGORY_COLORS[cat] || '#999' }} />
                              </div>
                              <span className="finances__perf-cat-value">{formatCOP(rev)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {st.top_services && st.top_services.length > 0 && (
                        <div className="finances__perf-top-services">
                          <h4>Servicios mas realizados</h4>
                          <div className="finances__perf-service-chips">
                            {st.top_services.map((svc, j) => (
                              <span key={j} className="finances__perf-service-chip">{svc.name} <strong>{svc.count}</strong></span>
                            ))}
                          </div>
                        </div>
                      )}

                      {st.daily_revenue && st.daily_revenue.length > 1 && (
                        <div className="finances__perf-daily">
                          <h4>Ingresos por dia</h4>
                          <ResponsiveContainer width="100%" height={120}>
                            <BarChart data={st.daily_revenue.map(d => ({ ...d, label: new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) }))}>
                              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} />
                              <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
                              <Bar dataKey="revenue" name="Ingresos" fill={i === 0 ? '#F59E0B' : '#2D5A3D'} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fine modal — portal to body */}
      {fineModal && createPortal(
        <div className="finances__perf-fine-overlay" onClick={() => setFineModal(null)}>
          <div className="finances__perf-fine-modal" onClick={e => e.stopPropagation()}>
            <h3>Agregar multa</h3>
            <p className="finances__perf-fine-modal-staff">
              {data.find(s => s.staff_id === fineModal)?.staff_name || staffList.find(s => s.id === fineModal)?.name || ''}
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

export default TabRendimiento;
