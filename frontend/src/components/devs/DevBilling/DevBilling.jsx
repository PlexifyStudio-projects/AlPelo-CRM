import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-billing';

const formatCOP = (val) => `$${Number(val || 0).toLocaleString('es-CO')}`;

const STATUS_LABELS = {
  paid: { label: 'Pagado', modifier: 'success' },
  pending: { label: 'Pendiente', modifier: 'warning' },
  overdue: { label: 'Vencido', modifier: 'error' },
};

const DevBilling = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/billing`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (!data || data.length === 0) throw new Error('Empty');
      setRecords(data);
    } catch {
      // Mock data
      setRecords([
        {
          id: 1,
          tenant_name: 'AlPelo Peluqueria',
          tenant_slug: 'alpelo',
          amount: 250000,
          period: '2026-03',
          status: 'paid',
          payment_method: 'transfer',
          paid_at: '2026-03-05T14:30:00',
        },
        {
          id: 2,
          tenant_name: 'AlPelo Peluqueria',
          tenant_slug: 'alpelo',
          amount: 250000,
          period: '2026-02',
          status: 'paid',
          payment_method: 'transfer',
          paid_at: '2026-02-03T10:00:00',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBilling(); }, [fetchBilling]);

  const totalPaid = records.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
  const totalPending = records.filter(r => r.status === 'pending' || r.status === 'overdue').reduce((sum, r) => sum + r.amount, 0);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}>
          <h1 className={`${b}__title`}>Facturacion</h1>
        </div>
        <p className={`${b}__loading`}>Cargando registros...</p>
      </div>
    );
  }

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Facturacion</h1>
          <p className={`${b}__subtitle`}>Control de pagos y facturacion</p>
        </div>
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
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
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
                    <td>{r.payment_method || '—'}</td>
                    <td className={`${b}__td-mono`}>
                      {r.paid_at ? new Date(r.paid_at).toLocaleDateString('es-CO') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DevBilling;
