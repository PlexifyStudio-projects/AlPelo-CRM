import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-usage';

const DevUsage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/usage?period=${period}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      if (!json.tenants || json.tenants.length === 0) throw new Error('Empty');
      setData(json);
    } catch {
      // Mock data
      setData({
        period,
        total_messages: 347,
        total_tokens: 2450000,
        estimated_cost_usd: 42.50,
        tenants: [
          {
            slug: 'alpelo',
            name: 'AlPelo Peluqueria',
            messages_sent: 198,
            messages_received: 149,
            ai_tokens: 2450000,
            cost_usd: 42.50,
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const formatTokens = (n) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}>
          <h1 className={`${b}__title`}>Consumo</h1>
        </div>
        <p className={`${b}__loading`}>Cargando datos de consumo...</p>
      </div>
    );
  }

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Consumo</h1>
          <p className={`${b}__subtitle`}>Tokens y mensajes por agencia</p>
        </div>
        <div className={`${b}__period-selector`}>
          <input
            type="month"
            className={`${b}__period-input`}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className={`${b}__summary`}>
        <div className={`${b}__summary-card`}>
          <span className={`${b}__summary-value`}>{data?.total_messages?.toLocaleString('es-CO') || 0}</span>
          <span className={`${b}__summary-label`}>Mensajes IA</span>
        </div>
        <div className={`${b}__summary-card`}>
          <span className={`${b}__summary-value`}>{formatTokens(data?.total_tokens || 0)}</span>
          <span className={`${b}__summary-label`}>Tokens consumidos</span>
        </div>
        <div className={`${b}__summary-card`}>
          <span className={`${b}__summary-value`}>${data?.estimated_cost_usd?.toFixed(2) || '0.00'}</span>
          <span className={`${b}__summary-label`}>Costo estimado (USD)</span>
        </div>
      </div>

      {/* Per-tenant table */}
      <div className={`${b}__section`}>
        <h2 className={`${b}__section-title`}>Detalle por agencia</h2>
        <div className={`${b}__table-wrap`}>
          <table className={`${b}__table`}>
            <thead>
              <tr>
                <th>Agencia</th>
                <th>Msgs enviados</th>
                <th>Msgs recibidos</th>
                <th>Tokens IA</th>
                <th>Costo USD</th>
              </tr>
            </thead>
            <tbody>
              {(data?.tenants || []).map((t) => (
                <tr key={t.slug}>
                  <td>
                    <div className={`${b}__tenant-cell`}>
                      <span className={`${b}__tenant-slug`}>{t.slug}</span>
                      <span className={`${b}__tenant-name`}>{t.name}</span>
                    </div>
                  </td>
                  <td className={`${b}__td-mono`}>{t.messages_sent.toLocaleString('es-CO')}</td>
                  <td className={`${b}__td-mono`}>{t.messages_received.toLocaleString('es-CO')}</td>
                  <td className={`${b}__td-mono`}>{formatTokens(t.ai_tokens)}</td>
                  <td className={`${b}__td-mono`}>${t.cost_usd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DevUsage;
