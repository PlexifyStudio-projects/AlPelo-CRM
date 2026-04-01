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
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dev/usage?period=${period}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setData({ period, total_messages: 0, total_tokens: 0, estimated_cost_usd: 0, tenants: [] });
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const formatTokens = (n) => {
    if (!n) return '0';
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

  const d = data || {};

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Consumo</h1>
          <p className={`${b}__subtitle`}>Tokens, mensajes y costos por agencia — Precios Anthropic (Sonnet: $3/$15 MTok)</p>
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

      <div className={`${b}__summary`}>
        <div className={`${b}__summary-card`}>
          <span className={`${b}__summary-value`}>{(d.total_messages || 0).toLocaleString('es-CO')}</span>
          <span className={`${b}__summary-label`}>Total mensajes</span>
        </div>
        <div className={`${b}__summary-card`}>
          <span className={`${b}__summary-value`}>{formatTokens(d.total_tokens)}</span>
          <span className={`${b}__summary-label`}>Tokens consumidos</span>
        </div>
        <div className={`${b}__summary-card`}>
          <span className={`${b}__summary-value`}>${(d.estimated_cost_usd || 0).toFixed(2)}</span>
          <span className={`${b}__summary-label`}>Costo estimado (USD)</span>
        </div>
      </div>

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
              {(d.tenants || []).length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#8896AB' }}>Sin datos para este periodo</td></tr>
              ) : (
                (d.tenants || []).map((t) => (
                  <tr key={t.slug}>
                    <td>
                      <div className={`${b}__tenant-cell`}>
                        <span className={`${b}__tenant-slug`}>{t.slug}</span>
                        <span className={`${b}__tenant-name`}>{t.name}</span>
                      </div>
                    </td>
                    <td className={`${b}__td-mono`}>{(t.messages_sent || 0).toLocaleString('es-CO')}</td>
                    <td className={`${b}__td-mono`}>{(t.messages_received || 0).toLocaleString('es-CO')}</td>
                    <td className={`${b}__td-mono`}>{formatTokens(t.ai_tokens)}</td>
                    <td className={`${b}__td-mono`}>${(t.cost_usd || 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DevUsage;
