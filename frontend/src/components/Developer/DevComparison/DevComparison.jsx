import { useState, useEffect, useCallback, useMemo } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-comparison';

const formatCOP = (val) => `$${Number(val || 0).toLocaleString('es-CO')}`;
const formatNum = (n) => Number(n || 0).toLocaleString('es-CO');
const formatTokens = (n) => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
};

const METRICS = [
  { key: 'clients', label: 'Clientes', format: formatNum, color: '#3B82F6' },
  { key: 'revenue_month', label: 'Ingresos Mes', format: formatCOP, color: '#10B981' },
  { key: 'ai_tokens_month', label: 'Tokens IA', format: formatTokens, color: '#8B5CF6' },
  { key: 'messages_used', label: 'Mensajes', format: formatNum, color: '#F59E0B' },
  { key: 'appointments_month', label: 'Citas Mes', format: formatNum, color: '#EC4899' },
  { key: 'staff', label: 'Staff', format: formatNum, color: '#06B6D4' },
];

const DevComparison = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('clients');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/comparison`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setData({ tenants: [] });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const tenants = data?.tenants || [];
  const activeMetric = METRICS.find((m) => m.key === metric) || METRICS[0];
  const { sorted, maxVal } = useMemo(() => {
    const s = [...tenants].sort((a, b2) => (b2[metric] || 0) - (a[metric] || 0));
    return { sorted: s, maxVal: s.length ? (s[0][metric] || 1) : 1 };
  }, [tenants, metric]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Comparativa</h1></div>
        <p className={`${b}__loading`}>Cargando datos cross-tenant...</p>
      </div>
    );
  }

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Comparativa Cross-Tenant</h1>
          <p className={`${b}__subtitle`}>{tenants.length} agencias activas — Periodo: {data?.period}</p>
        </div>
        <button className={`${b}__refresh`} onClick={fetchData}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16"/></svg>
        </button>
      </div>

      <div className={`${b}__metrics`}>
        {METRICS.map((m) => (
          <button
            key={m.key}
            className={`${b}__metric ${metric === m.key ? `${b}__metric--active` : ''}`}
            onClick={() => setMetric(m.key)}
            style={metric === m.key ? { borderColor: m.color, color: m.color } : {}}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={`${b}__chart`}>
        <svg viewBox={`0 0 800 ${Math.max(sorted.length * 48, 100)}`} className={`${b}__svg`}>
          {sorted.map((t, i) => {
            const barWidth = Math.max((t[metric] / maxVal) * 560, 4);
            const y = i * 48 + 8;
            return (
              <g key={t.id}>
                <text x="0" y={y + 20} className={`${b}__bar-label`} fill="#475569" fontSize="13" fontWeight="600">
                  {t.name}
                </text>
                <rect x="180" y={y + 2} width={barWidth} height="28" rx="6" fill={activeMetric.color} opacity={1 - i * 0.08} />
                <text x={185 + barWidth} y={y + 21} fill="#0F172A" fontSize="12" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                  {activeMetric.format(t[metric])}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className={`${b}__table-wrap`}>
        <table className={`${b}__table`}>
          <thead>
            <tr>
              <th>#</th>
              <th>Agencia</th>
              <th>Clientes</th>
              <th>Staff</th>
              <th>Ingresos Mes</th>
              <th>Tokens IA</th>
              <th>Mensajes</th>
              <th>Citas</th>
              <th>Crecimiento</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.id}>
                <td className={`${b}__rank`}>
                  <span className={`${b}__rank-badge ${i < 3 ? `${b}__rank-badge--top` : ''}`}>{i + 1}</span>
                </td>
                <td>
                  <div className={`${b}__td-agency`}>
                    <span className={`${b}__td-name`}>{t.name}</span>
                    <span className={`${b}__td-slug`}>{t.slug}</span>
                  </div>
                </td>
                <td className={`${b}__td-mono`}>{formatNum(t.clients)}</td>
                <td className={`${b}__td-mono`}>{formatNum(t.staff)}</td>
                <td className={`${b}__td-mono`}>{formatCOP(t.revenue_month)}</td>
                <td className={`${b}__td-mono`}>{formatTokens(t.ai_tokens_month)}</td>
                <td className={`${b}__td-mono`}>
                  {formatNum(t.messages_used)}
                  <span className={`${b}__td-sub`}>/{formatNum(t.messages_limit)}</span>
                </td>
                <td className={`${b}__td-mono`}>{formatNum(t.appointments_month)}</td>
                <td>
                  <span className={`${b}__growth ${t.growth_rate >= 0 ? `${b}__growth--up` : `${b}__growth--down`}`}>
                    {t.growth_rate >= 0 ? '+' : ''}{t.growth_rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DevComparison;
