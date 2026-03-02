import { daysSince } from './formatters';

// ============================================
// AlPelo - Client Status Engine
// Automatic lifecycle management for clients
// ============================================

export const STATUS = {
  NUEVO: 'nuevo',
  ACTIVO: 'activo',
  EN_RIESGO: 'en_riesgo',
  INACTIVO: 'inactivo',
  VIP: 'vip',
};

export const STATUS_META = {
  [STATUS.VIP]: { label: 'VIP', color: 'accent', priority: 0 },
  [STATUS.NUEVO]: { label: 'Nuevo', color: 'info', priority: 1 },
  [STATUS.ACTIVO]: { label: 'Activo', color: 'success', priority: 2 },
  [STATUS.EN_RIESGO]: { label: 'En Riesgo', color: 'warning', priority: 3 },
  [STATUS.INACTIVO]: { label: 'Inactivo', color: 'danger', priority: 4 },
};

const computeTop20Threshold = (allClients) => {
  if (!allClients.length) return Infinity;
  const sorted = allClients.map((c) => c.totalSpent).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.8)] ?? Infinity;
};

const countVisitsLastYear = (client, visitHistory) => {
  if (visitHistory.length > 0) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return visitHistory.filter(
      (v) => v.clientId === client.id && new Date(v.date) >= oneYearAgo && v.status === 'completed'
    ).length;
  }
  const span = daysSince(client.firstVisit);
  if (span === 0) return client.totalVisits;
  return Math.round((client.totalVisits / span) * Math.min(365, span));
};

export const computeClientStatus = (client, allClients = [], visitHistory = []) => {
  const days = daysSince(client.lastVisit);
  const daysSinceFirst = daysSince(client.firstVisit);

  // 1. VIP: 8+ visits/year, top 20% spender, <=1 no-show
  const visitsYear = countVisitsLastYear(client, visitHistory);
  const threshold = computeTop20Threshold(allClients);
  if (visitsYear >= 8 && client.totalSpent >= threshold && (client.noShowCount ?? 0) <= 1 && days <= 45) {
    return STATUS.VIP;
  }

  // 2. Nuevo: 1 visit, within 30 days of first visit
  if (client.totalVisits === 1 && daysSinceFirst <= 30) {
    return STATUS.NUEVO;
  }

  // 3. Activo: last visit within 45 days
  if (days <= 45) {
    return STATUS.ACTIVO;
  }

  // 4. En Riesgo: 46-60 days
  if (days > 45 && days <= 60) {
    return STATUS.EN_RIESGO;
  }

  // 5. Inactivo: >60 days
  return STATUS.INACTIVO;
};

const computeAvgInterval = (client, visitHistory) => {
  const history = visitHistory
    .filter((v) => v.clientId === client.id && v.status === 'completed')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (history.length >= 2) {
    const first = new Date(history[0].date);
    const last = new Date(history[history.length - 1].date);
    const span = Math.floor((last - first) / (1000 * 60 * 60 * 24));
    return Math.round(span / (history.length - 1));
  }

  if (client.totalVisits > 1) {
    const span = daysSince(client.firstVisit);
    return Math.round(span / (client.totalVisits - 1));
  }

  return null;
};

export const enrichClients = (clients, visitHistory = []) => {
  return clients.map((client) => ({
    ...client,
    status: computeClientStatus(client, clients, visitHistory),
    avgTicket: client.totalVisits > 0 ? Math.round(client.totalSpent / client.totalVisits) : 0,
    avgVisitInterval: computeAvgInterval(client, visitHistory),
    daysSinceLastVisit: daysSince(client.lastVisit),
  }));
};

export const computeKPIs = (enrichedClients) => {
  const total = enrichedClients.length;
  const byStatus = (s) => enrichedClients.filter((c) => c.status === s).length;

  const activeCount = byStatus(STATUS.ACTIVO) + byStatus(STATUS.VIP) + byStatus(STATUS.NUEVO);
  const atRisk = byStatus(STATUS.EN_RIESGO);
  const inactive = byStatus(STATUS.INACTIVO);
  const vip = byStatus(STATUS.VIP);
  const nuevo = byStatus(STATUS.NUEVO);

  const totalRevenue = enrichedClients.reduce((s, c) => s + c.totalSpent, 0);
  const totalVisits = enrichedClients.reduce((s, c) => s + c.totalVisits, 0);
  const avgTicket = totalVisits > 0 ? Math.round(totalRevenue / totalVisits) : 0;
  const retentionRate = total > 0 ? Math.round((activeCount / total) * 100) : 0;

  return { total, active: activeCount, retentionRate, vip, nuevo, atRisk, inactive, totalRevenue, avgTicket };
};

export const getStatusExplanation = (client) => {
  const days = client.daysSinceLastVisit ?? daysSince(client.lastVisit);

  switch (client.status) {
    case STATUS.VIP:
      return `Cliente premium con alto volumen de visitas y gasto. Ticket promedio: $${(client.avgTicket || 0).toLocaleString('es-CO')} COP.`;
    case STATUS.NUEVO:
      return `Primera visita hace ${days} ${days === 1 ? 'día' : 'días'}. Es clave que regrese en los próximos 30 días para fidelizarlo.`;
    case STATUS.ACTIVO:
      return `Última visita hace ${days} ${days === 1 ? 'día' : 'días'}. Cliente regular con buen ritmo de visitas.`;
    case STATUS.EN_RIESGO: {
      const remaining = 60 - days;
      return `Lleva ${days} días sin visitar. Si no regresa en ${remaining > 0 ? remaining : 0} días, pasará a Inactivo. Considerar contacto por WhatsApp.`;
    }
    case STATUS.INACTIVO:
      return `Lleva ${days} días sin visitar (más de 2 meses). Se recomienda campaña de reactivación con descuento del 10-15%.`;
    default:
      return '';
  }
};
