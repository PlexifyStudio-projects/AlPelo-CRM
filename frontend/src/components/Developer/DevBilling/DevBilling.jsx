import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-billing';

const formatCOP = (val) => `$${Number(val || 0).toLocaleString('es-CO')}`;

const STATUS_LABELS = {
  paid: { label: 'Pagado', modifier: 'success' },
  pending: { label: 'Pendiente', modifier: 'warning' },
  overdue: { label: 'Vencido', modifier: 'error' },
};

const METHODS = [
  { value: 'transfer', label: 'Transferencia' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
];

const MONTHS_OPTIONS = [1, 2, 3, 6, 12];

const DevBilling = () => {
  const [records, setRecords] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tenant_id: '',
    period: '',
    amount: '',
    months: 1,
    status: 'pending',
    payment_method: 'transfer',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchBilling = useCallback(async () => {
    try {
      const [billingRes, tenantsRes] = await Promise.all([
        fetch(`${API_URL}/dev/billing`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
        fetch(`${API_URL}/dev/tenants`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
      ]);
      if (billingRes.ok) setRecords(await billingRes.json());
      if (tenantsRes.ok) setTenants(await tenantsRes.json());
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBilling(); }, [fetchBilling]);

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const handleOpenCreate = () => {
    setFormData({
      tenant_id: tenants.length > 0 ? tenants[0].id : '',
      period: currentPeriod,
      amount: tenants.length > 0 ? (tenants[0].monthly_price || 0) : '',
      status: 'pending',
      payment_method: 'transfer',
      notes: '',
    });
    setShowForm(true);
  };

  const handleTenantChange = (tid) => {
    const t = tenants.find(x => x.id === parseInt(tid));
    setFormData({
      ...formData,
      tenant_id: tid,
      amount: t?.monthly_price || formData.amount,
    });
  };

  const handleSave = async () => {
    if (!formData.tenant_id || !formData.amount) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/dev/billing`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tenant_id: parseInt(formData.tenant_id),
          amount: parseInt(formData.amount),
          months: parseInt(formData.months),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        fetchBilling();
      }
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleMarkPaid = async (record) => {
    setActionLoading(`pay-${record.id}`);
    try {
      await fetch(`${API_URL}/dev/billing/${record.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      fetchBilling();
    } catch { /* silent */ }
    setActionLoading(null);
  };

  const handleMarkOverdue = async (record) => {
    setActionLoading(`overdue-${record.id}`);
    try {
      await fetch(`${API_URL}/dev/billing/${record.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'overdue' }),
      });
      fetchBilling();
    } catch { /* silent */ }
    setActionLoading(null);
  };

  const handleDelete = async (record) => {
    if (!confirm(`Eliminar factura de ${record.tenant_name} (${record.period})?`)) return;
    setActionLoading(`del-${record.id}`);
    try {
      await fetch(`${API_URL}/dev/billing/${record.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchBilling();
    } catch { /* silent */ }
    setActionLoading(null);
  };

  const totalPaid = records.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
  const totalPending = records.filter(r => r.status === 'pending' || r.status === 'overdue').reduce((sum, r) => sum + r.amount, 0);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Facturacion</h1></div>
        <p className={`${b}__loading`}>Cargando registros...</p>
      </div>
    );
  }

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Facturacion</h1>
          <p className={`${b}__subtitle`}>Control de pagos y facturacion de agencias</p>
        </div>
        <button className={`${b}__btn-create`} onClick={handleOpenCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nueva factura
        </button>
      </div>

      {/* Summary */}
      <div className={`${b}__summary`}>
        <div className={`${b}__summary-card ${b}__summary-card--success`}>
          <span className={`${b}__summary-value`}>{formatCOP(totalPaid)}</span>
          <span className={`${b}__summary-label`}>Total cobrado</span>
        </div>
        <div className={`${b}__summary-card ${b}__summary-card--warning`}>
          <span className={`${b}__summary-value`}>{formatCOP(totalPending)}</span>
          <span className={`${b}__summary-label`}>Pendiente de cobro</span>
        </div>
        <div className={`${b}__summary-card`}>
          <span className={`${b}__summary-value`}>{records.length}</span>
          <span className={`${b}__summary-label`}>Total registros</span>
        </div>
      </div>

      {/* Tenant billing status */}
      {tenants.length > 0 && (
        <div className={`${b}__section`}>
          <h2 className={`${b}__section-title`}>Estado de agencias</h2>
          <div className={`${b}__tenants-grid`}>
            {tenants.map(t => {
              const days = t.days_remaining;
              const isUrgent = days !== null && days <= 5;
              const isExpired = days !== null && days <= 0;
              return (
                <div key={t.id} className={`${b}__tenant-card ${isExpired ? `${b}__tenant-card--expired` : isUrgent ? `${b}__tenant-card--urgent` : ''}`}>
                  <div className={`${b}__tenant-card-header`}>
                    <strong>{t.name}</strong>
                    <span className={`${b}__tenant-card-plan`}>{t.plan}</span>
                  </div>
                  <div className={`${b}__tenant-card-price`}>{formatCOP(t.monthly_price)}/mes</div>
                  {days !== null ? (
                    <div className={`${b}__tenant-card-days ${isExpired ? `${b}__tenant-card-days--expired` : isUrgent ? `${b}__tenant-card-days--urgent` : ''}`}>
                      {isExpired ? `Vencido hace ${Math.abs(days)} dias` : `${days} dias restantes`}
                    </div>
                  ) : (
                    <div className={`${b}__tenant-card-days`}>Sin fecha de cobro</div>
                  )}
                  {t.paid_until && (
                    <div className={`${b}__tenant-card-date`}>Pagado hasta: {new Date(t.paid_until + 'T12:00:00').toLocaleDateString('es-CO')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Records table */}
      <div className={`${b}__section`}>
        <h2 className={`${b}__section-title`}>Historial de pagos</h2>
        <div className={`${b}__table-wrap`}>
          <table className={`${b}__table`}>
            <thead>
              <tr>
                <th>Agencia</th>
                <th>Periodo</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Metodo</th>
                <th>Fecha pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#8896AB' }}>Sin registros de facturacion</td></tr>
              ) : (
                records.map((r) => {
                  const st = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className={`${b}__tenant-cell`}>
                          <span className={`${b}__tenant-slug`}>{r.tenant_slug}</span>
                          <span className={`${b}__tenant-name`}>{r.tenant_name}</span>
                        </div>
                      </td>
                      <td className={`${b}__td-mono`}>{r.period}</td>
                      <td className={`${b}__td-mono ${b}__td-amount`}>{formatCOP(r.amount)}</td>
                      <td>
                        <span className={`${b}__status ${b}__status--${st.modifier}`}>
                          {st.label}
                        </span>
                      </td>
                      <td>{METHODS.find(m => m.value === r.payment_method)?.label || r.payment_method || '—'}</td>
                      <td className={`${b}__td-mono`}>
                        {r.paid_at ? new Date(r.paid_at).toLocaleDateString('es-CO') : '—'}
                      </td>
                      <td>
                        <div className={`${b}__actions`}>
                          {r.status !== 'paid' && (
                            <button
                              className={`${b}__action-btn ${b}__action-btn--pay`}
                              onClick={() => handleMarkPaid(r)}
                              disabled={actionLoading === `pay-${r.id}`}
                              title="Marcar como pagado"
                            >
                              Pagar
                            </button>
                          )}
                          {r.status === 'pending' && (
                            <button
                              className={`${b}__action-btn ${b}__action-btn--overdue`}
                              onClick={() => handleMarkOverdue(r)}
                              disabled={actionLoading === `overdue-${r.id}`}
                              title="Marcar como vencido"
                            >
                              Vencido
                            </button>
                          )}
                          <button
                            className={`${b}__action-btn ${b}__action-btn--delete`}
                            onClick={() => handleDelete(r)}
                            disabled={!!actionLoading}
                            title="Eliminar"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showForm && (
        <div className={`${b}__modal-overlay`} onClick={() => setShowForm(false)}>
          <div className={`${b}__modal`} onClick={(e) => e.stopPropagation()}>
            <div className={`${b}__modal-header`}>
              <h3 className={`${b}__modal-title`}>Nueva factura</h3>
              <button className={`${b}__modal-close`} onClick={() => setShowForm(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className={`${b}__modal-body`}>
              <div className={`${b}__form-field`}>
                <label className={`${b}__form-label`}>Agencia</label>
                <select
                  className={`${b}__form-select`}
                  value={formData.tenant_id}
                  onChange={(e) => handleTenantChange(e.target.value)}
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Periodo</label>
                  <input
                    className={`${b}__form-input`}
                    type="month"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  />
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Monto (COP)</label>
                  <input
                    className={`${b}__form-input`}
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="250000"
                  />
                </div>
              </div>

              <div className={`${b}__form-field`}>
                <label className={`${b}__form-label`}>Meses pagados</label>
                <select
                  className={`${b}__form-select`}
                  value={formData.months}
                  onChange={(e) => {
                    const m = parseInt(e.target.value);
                    const t = tenants.find(x => x.id === parseInt(formData.tenant_id));
                    setFormData({ ...formData, months: m, amount: (t?.monthly_price || 0) * m });
                  }}
                >
                  {MONTHS_OPTIONS.map(m => (
                    <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}{m === 12 ? ' (anual)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className={`${b}__form-row`}>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Estado</label>
                  <select
                    className={`${b}__form-select`}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="pending">Pendiente</option>
                    <option value="paid">Pagado</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </div>
                <div className={`${b}__form-field`}>
                  <label className={`${b}__form-label`}>Metodo de pago</label>
                  <select
                    className={`${b}__form-select`}
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  >
                    {METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`${b}__form-field`}>
                <label className={`${b}__form-label`}>Notas</label>
                <input
                  className={`${b}__form-input`}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className={`${b}__modal-footer`}>
              <button className={`${b}__modal-btn ${b}__modal-btn--cancel`} onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className={`${b}__modal-btn ${b}__modal-btn--save`} onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear factura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevBilling;
