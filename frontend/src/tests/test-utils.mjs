// ============================================
// AlPelo CRM - Utility & Data Integrity Tests
// Run: node --experimental-vm-modules src/tests/test-utils.mjs
// ============================================

// --- Inline implementations (no bundler needed) ---

// Re-implement daysSince to avoid ESM import issues with bare imports
const daysSince = (date) => Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));

// Re-implement formatCurrency
const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

const formatDate = (date) =>
  new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(date));

const formatTime = (date) =>
  new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));

// --- Re-implement clientStatus.js functions using local daysSince ---

const STATUS = {
  NUEVO: 'nuevo',
  ACTIVO: 'activo',
  EN_RIESGO: 'en_riesgo',
  INACTIVO: 'inactivo',
  VIP: 'vip',
};

const STATUS_META = {
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

const computeClientStatus = (client, allClients = [], visitHistory = []) => {
  const days = daysSince(client.lastVisit);
  const daysSinceFirst = daysSince(client.firstVisit);

  const visitsYear = countVisitsLastYear(client, visitHistory);
  const threshold = computeTop20Threshold(allClients);
  if (visitsYear >= 8 && client.totalSpent >= threshold && (client.noShowCount ?? 0) <= 1 && days <= 45) {
    return STATUS.VIP;
  }

  if (client.totalVisits === 1 && daysSinceFirst <= 30) {
    return STATUS.NUEVO;
  }

  if (days <= 45) {
    return STATUS.ACTIVO;
  }

  if (days > 45 && days <= 60) {
    return STATUS.EN_RIESGO;
  }

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

const enrichClients = (clients, visitHistory = []) => {
  return clients.map((client) => ({
    ...client,
    status: computeClientStatus(client, clients, visitHistory),
    avgTicket: client.totalVisits > 0 ? Math.round(client.totalSpent / client.totalVisits) : 0,
    avgVisitInterval: computeAvgInterval(client, visitHistory),
    daysSinceLastVisit: daysSince(client.lastVisit),
  }));
};

const computeKPIs = (enrichedClients) => {
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

const getStatusExplanation = (client) => {
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

// ============================================
// Test Harness
// ============================================

let passed = 0;
let failed = 0;
const failures = [];
const bugs = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${testName}`);
  } else {
    failed++;
    failures.push(testName);
    console.log(`  FAIL: ${testName}`);
  }
}

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${testName}`);
  } else {
    failed++;
    failures.push(`${testName} (expected: ${expected}, got: ${actual})`);
    console.log(`  FAIL: ${testName} (expected: ${expected}, got: ${actual})`);
  }
}

function assertIncludes(str, substr, testName) {
  if (typeof str === 'string' && str.includes(substr)) {
    passed++;
    console.log(`  PASS: ${testName}`);
  } else {
    failed++;
    failures.push(`${testName} (string does not include "${substr}")`);
    console.log(`  FAIL: ${testName} (string does not include "${substr}", got: "${str}")`);
  }
}

// ============================================
// Load mock data from file
// ============================================

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mockDataPath = join(__dirname, '..', 'data', 'mockData.js');
const mockDataContent = readFileSync(mockDataPath, 'utf-8');

// Replace export statements to make it evaluable via Function constructor
const evalCode = mockDataContent
  .replace(/export const /g, 'const ')
  .replace(/export /g, '');

const mockDataFn = new Function(`
  ${evalCode}
  return { mockClients, mockVisitHistory, mockBarbers, mockServices, mockAppointments, mockBusinessInfo, mockNotifications };
`);

const { mockClients, mockVisitHistory, mockBarbers, mockServices, mockAppointments, mockBusinessInfo } = mockDataFn();

// ============================================
// TEST SUITE 1: formatters.js
// ============================================

console.log('\n========================================');
console.log('TEST SUITE 1: formatters.js');
console.log('========================================\n');

console.log('--- formatCurrency ---');
{
  const result = formatCurrency(25000);
  assert(result.includes('25.000') || result.includes('25,000'), 'formatCurrency(25000) includes formatted number');
  assert(result.includes('COP') || result.includes('$'), 'formatCurrency(25000) includes COP or $');

  const zero = formatCurrency(0);
  assert(zero.includes('0'), 'formatCurrency(0) includes 0');

  const large = formatCurrency(1000000);
  assert(large.includes('1.000.000') || large.includes('1,000,000'), 'formatCurrency(1000000) formats large number');

  const noDecimals = formatCurrency(55000);
  assert(!noDecimals.includes('.00') && !noDecimals.includes(',00'), 'formatCurrency has no decimal places');
}

console.log('\n--- daysSince ---');
{
  const today = new Date().toISOString().split('T')[0];
  assertEqual(daysSince(today), 0, 'daysSince(today) = 0');

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  assertEqual(daysSince(yesterday), 1, 'daysSince(yesterday) = 1');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  assertEqual(daysSince(thirtyDaysAgo), 30, 'daysSince(30 days ago) = 30');
}

console.log('\n--- formatDate ---');
{
  const result = formatDate('2026-02-28');
  assert(typeof result === 'string' && result.length > 0, 'formatDate returns non-empty string');
  assert(result.includes('28') && result.includes('2026'), 'formatDate includes day and year');
  assertIncludes(result.toLowerCase(), 'febrero', 'formatDate includes month name in Spanish');
}

console.log('\n--- formatTime ---');
{
  const result = formatTime('2026-02-28T10:30:00');
  assert(typeof result === 'string' && result.length > 0, 'formatTime returns non-empty string');
}

// ============================================
// TEST SUITE 2: mockData.js - Data Integrity
// ============================================

console.log('\n========================================');
console.log('TEST SUITE 2: mockData.js - Data Integrity');
console.log('========================================\n');

console.log('--- Client Count ---');
assertEqual(mockClients.length, 30, 'Exactly 30 clients');

console.log('\n--- Required Fields ---');
const REQUIRED_FIELDS = [
  'id', 'name', 'phone', 'email', 'lastVisit', 'firstVisit',
  'totalVisits', 'totalSpent', 'favoriteService', 'gender',
  'source', 'haircutStyleNotes', 'beardStyleNotes', 'noShowCount',
  'cancellationCount', 'loyaltyPoints', 'acceptsWhatsApp'
];

let allFieldsPresent = true;
const missingFields = [];
for (const client of mockClients) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in client)) {
      allFieldsPresent = false;
      missingFields.push(`Client ${client.id} (${client.name}) missing field: ${field}`);
    }
  }
}
assert(allFieldsPresent, `All clients have all ${REQUIRED_FIELDS.length} required fields`);
if (missingFields.length > 0) {
  missingFields.forEach(m => console.log(`    -> ${m}`));
  bugs.push(...missingFields);
}

console.log('\n--- No Duplicate Client IDs ---');
{
  const ids = mockClients.map(c => c.id);
  const uniqueIds = new Set(ids);
  assertEqual(uniqueIds.size, ids.length, 'No duplicate client IDs');
}

console.log('\n--- Visit History Coverage ---');
{
  const clientIdsWithHistory = new Set(mockVisitHistory.map(v => v.clientId));
  const clientIdsAll = new Set(mockClients.map(c => c.id));
  const coverage = clientIdsWithHistory.size / clientIdsAll.size;
  assert(coverage >= 0.9, `Visit history coverage >= 90% (actual: ${Math.round(coverage * 100)}%)`);

  const missing = [...clientIdsAll].filter(id => !clientIdsWithHistory.has(id));
  if (missing.length > 0) {
    console.log(`    -> Clients without visit history: ${missing.join(', ')}`);
  }
}

console.log('\n--- Valid Visit Statuses ---');
{
  const validStatuses = new Set(['completed', 'no_show', 'cancelled']);
  let allValid = true;
  const invalidEntries = [];
  for (const visit of mockVisitHistory) {
    if (!validStatuses.has(visit.status)) {
      allValid = false;
      invalidEntries.push(`Visit ${visit.id}: invalid status "${visit.status}"`);
    }
  }
  assert(allValid, 'All visit statuses are valid (completed/no_show/cancelled)');
  if (invalidEntries.length > 0) {
    invalidEntries.forEach(e => console.log(`    -> ${e}`));
    bugs.push(...invalidEntries);
  }
}

console.log('\n--- No Duplicate Visit IDs ---');
{
  const visitIds = mockVisitHistory.map(v => v.id);
  const uniqueVisitIds = new Set(visitIds);
  assertEqual(uniqueVisitIds.size, visitIds.length, 'No duplicate visit history IDs');
  if (uniqueVisitIds.size !== visitIds.length) {
    const seen = new Set();
    const dupes = [];
    for (const id of visitIds) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    console.log(`    -> Duplicate visit IDs: ${dupes.join(', ')}`);
    bugs.push(`Duplicate visit IDs: ${dupes.join(', ')}`);
  }
}

console.log('\n--- Data Consistency: totalSpent vs visit history ---');
{
  let mismatchCount = 0;
  for (const client of mockClients) {
    const completedVisits = mockVisitHistory.filter(v => v.clientId === client.id && v.status === 'completed');
    const historySum = completedVisits.reduce((sum, v) => sum + v.amount, 0);
    if (historySum !== client.totalSpent) {
      mismatchCount++;
      console.log(`    -> Client ${client.id} (${client.name}): totalSpent=${client.totalSpent}, history sum=${historySum}`);
      bugs.push(`Client ${client.id} totalSpent mismatch: declared=${client.totalSpent}, computed=${historySum}`);
    }
  }
  assert(mismatchCount === 0, 'All clients totalSpent matches sum of completed visit amounts');
}

console.log('\n--- Data Consistency: totalVisits vs visit history ---');
{
  let mismatchCount = 0;
  for (const client of mockClients) {
    const countedVisits = mockVisitHistory.filter(
      v => v.clientId === client.id && (v.status === 'completed' || v.status === 'no_show')
    ).length;
    if (countedVisits !== client.totalVisits) {
      mismatchCount++;
      console.log(`    -> Client ${client.id} (${client.name}): totalVisits=${client.totalVisits}, counted=${countedVisits}`);
      bugs.push(`Client ${client.id} totalVisits mismatch: declared=${client.totalVisits}, counted=${countedVisits}`);
    }
  }
  assert(mismatchCount === 0, 'All clients totalVisits matches count of completed+no_show visit entries');
}

console.log('\n--- Data Consistency: noShowCount vs visit history ---');
{
  let mismatchCount = 0;
  for (const client of mockClients) {
    const noShows = mockVisitHistory.filter(v => v.clientId === client.id && v.status === 'no_show').length;
    if (noShows !== client.noShowCount) {
      mismatchCount++;
      console.log(`    -> Client ${client.id} (${client.name}): noShowCount=${client.noShowCount}, history no_shows=${noShows}`);
      bugs.push(`Client ${client.id} noShowCount mismatch: declared=${client.noShowCount}, counted=${noShows}`);
    }
  }
  assert(mismatchCount === 0, 'All clients noShowCount matches count of no_show visit entries');
}

console.log('\n--- Data Consistency: loyaltyPoints = Math.round(totalSpent / 1000) ---');
{
  let mismatchCount = 0;
  for (const client of mockClients) {
    const expected = Math.round(client.totalSpent / 1000);
    if (client.loyaltyPoints !== expected) {
      mismatchCount++;
      console.log(`    -> Client ${client.id} (${client.name}): loyaltyPoints=${client.loyaltyPoints}, expected=${expected}`);
      bugs.push(`Client ${client.id} loyaltyPoints mismatch: declared=${client.loyaltyPoints}, expected=${expected}`);
    }
  }
  assert(mismatchCount === 0, 'All clients loyaltyPoints = Math.round(totalSpent / 1000)');
}

// ============================================
// TEST SUITE 3: clientStatus.js
// ============================================

console.log('\n========================================');
console.log('TEST SUITE 3: clientStatus.js');
console.log('========================================\n');

const enriched = enrichClients(mockClients, mockVisitHistory);

console.log('--- enrichClients adds required fields ---');
{
  let allHaveFields = true;
  for (const ec of enriched) {
    if (!('status' in ec) || !('avgTicket' in ec) || !('daysSinceLastVisit' in ec)) {
      allHaveFields = false;
    }
  }
  assert(allHaveFields, 'All enriched clients have status, avgTicket, daysSinceLastVisit');
}

console.log('\n--- computeClientStatus - VIP ---');
{
  const expectedVIPs = [1, 3, 5, 13, 15];
  const actualVIPs = enriched.filter(c => c.status === STATUS.VIP).map(c => c.id).sort((a,b) => a-b);
  console.log(`    Expected VIPs: ${expectedVIPs.join(', ')}`);
  console.log(`    Actual VIPs:   ${actualVIPs.join(', ')}`);

  for (const vipId of expectedVIPs) {
    const client = enriched.find(c => c.id === vipId);
    assertEqual(client.status, STATUS.VIP, `Client ${vipId} (${client.name}) should be VIP`);
  }
}

console.log('\n--- computeClientStatus - Nuevo ---');
{
  const expectedNuevo = [17, 18];
  const actualNuevo = enriched.filter(c => c.status === STATUS.NUEVO).map(c => c.id).sort((a,b) => a-b);
  console.log(`    Expected Nuevo: ${expectedNuevo.join(', ')}`);
  console.log(`    Actual Nuevo:   ${actualNuevo.join(', ')}`);

  for (const id of expectedNuevo) {
    const client = enriched.find(c => c.id === id);
    assertEqual(client.status, STATUS.NUEVO, `Client ${id} (${client.name}) should be Nuevo`);
  }
}

console.log('\n--- computeClientStatus - Activo ---');
{
  const expectedActivo = [6, 7, 9, 10, 12, 16, 26, 27, 28, 29, 30];
  const actualActivo = enriched.filter(c => c.status === STATUS.ACTIVO).map(c => c.id).sort((a,b) => a-b);
  console.log(`    Expected Activo: ${expectedActivo.join(', ')}`);
  console.log(`    Actual Activo:   ${actualActivo.join(', ')}`);

  for (const id of expectedActivo) {
    const client = enriched.find(c => c.id === id);
    assertEqual(client.status, STATUS.ACTIVO, `Client ${id} (${client.name}) should be Activo`);
  }
}

console.log('\n--- computeClientStatus - En Riesgo ---');
{
  const expectedEnRiesgo = [2, 11, 19, 20, 21];
  const actualEnRiesgo = enriched.filter(c => c.status === STATUS.EN_RIESGO).map(c => c.id).sort((a,b) => a-b);
  console.log(`    Expected En Riesgo: ${expectedEnRiesgo.join(', ')}`);
  console.log(`    Actual En Riesgo:   ${actualEnRiesgo.join(', ')}`);

  for (const id of expectedEnRiesgo) {
    const client = enriched.find(c => c.id === id);
    const days = daysSince(client.lastVisit);
    if (client.status !== STATUS.EN_RIESGO) {
      console.log(`    -> Client ${id}: days since last visit = ${days}, got status: ${client.status}`);
    }
    assertEqual(client.status, STATUS.EN_RIESGO, `Client ${id} (${client.name}) should be En Riesgo`);
  }
}

console.log('\n--- computeClientStatus - Inactivo ---');
{
  const expectedInactivo = [4, 8, 14, 22, 23, 24, 25];
  const actualInactivo = enriched.filter(c => c.status === STATUS.INACTIVO).map(c => c.id).sort((a,b) => a-b);
  console.log(`    Expected Inactivo: ${expectedInactivo.join(', ')}`);
  console.log(`    Actual Inactivo:   ${actualInactivo.join(', ')}`);

  for (const id of expectedInactivo) {
    const client = enriched.find(c => c.id === id);
    assertEqual(client.status, STATUS.INACTIVO, `Client ${id} (${client.name}) should be Inactivo`);
  }
}

console.log('\n--- computeClientStatus - Edge Cases ---');
{
  const today = new Date().toISOString().split('T')[0];

  const d45 = new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0];
  const client45 = { id: 100, lastVisit: d45, firstVisit: '2025-01-01', totalVisits: 5, totalSpent: 100000, noShowCount: 0 };
  assertEqual(computeClientStatus(client45), STATUS.ACTIVO, '45 days -> Activo');

  const d46 = new Date(Date.now() - 46 * 86400000).toISOString().split('T')[0];
  const client46 = { id: 101, lastVisit: d46, firstVisit: '2025-01-01', totalVisits: 5, totalSpent: 100000, noShowCount: 0 };
  assertEqual(computeClientStatus(client46), STATUS.EN_RIESGO, '46 days -> En Riesgo');

  const d60 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
  const client60 = { id: 102, lastVisit: d60, firstVisit: '2025-01-01', totalVisits: 5, totalSpent: 100000, noShowCount: 0 };
  assertEqual(computeClientStatus(client60), STATUS.EN_RIESGO, '60 days -> En Riesgo');

  const d61 = new Date(Date.now() - 61 * 86400000).toISOString().split('T')[0];
  const client61 = { id: 103, lastVisit: d61, firstVisit: '2025-01-01', totalVisits: 5, totalSpent: 100000, noShowCount: 0 };
  assertEqual(computeClientStatus(client61), STATUS.INACTIVO, '61 days -> Inactivo');

  const clientNew = { id: 104, lastVisit: today, firstVisit: today, totalVisits: 1, totalSpent: 40000, noShowCount: 0 };
  assertEqual(computeClientStatus(clientNew), STATUS.NUEVO, '1 visit + firstVisit today -> Nuevo');

  const d31 = new Date(Date.now() - 31 * 86400000).toISOString().split('T')[0];
  const clientOldNew = { id: 105, lastVisit: d31, firstVisit: d31, totalVisits: 1, totalSpent: 40000, noShowCount: 0 };
  assertEqual(computeClientStatus(clientOldNew), STATUS.ACTIVO, '1 visit + 31 days since first -> Activo (not Nuevo)');

  const clientNotVIP = {
    id: 106, lastVisit: today, firstVisit: '2024-01-01',
    totalVisits: 20, totalSpent: 9999999, noShowCount: 2
  };
  const result = computeClientStatus(clientNotVIP, [clientNotVIP], []);
  assert(result !== STATUS.VIP, 'High spender with 2 no-shows -> NOT VIP');
}

console.log('\n--- avgTicket computation ---');
{
  const client = enriched.find(c => c.id === 1);
  const expectedAvg = Math.round(client.totalSpent / client.totalVisits);
  assertEqual(client.avgTicket, expectedAvg, `Client 1 avgTicket = ${expectedAvg}`);

  const zeroVisitClient = { id: 999, totalVisits: 0, totalSpent: 0, lastVisit: '2026-02-28', firstVisit: '2026-02-28' };
  const enrichedZero = enrichClients([zeroVisitClient])[0];
  assertEqual(enrichedZero.avgTicket, 0, 'avgTicket = 0 when totalVisits = 0');
}

console.log('\n--- computeKPIs ---');
{
  const kpis = computeKPIs(enriched);

  assertEqual(kpis.total, 30, 'KPI total = 30');
  assert(typeof kpis.active === 'number' && kpis.active > 0, 'KPI active is a positive number');
  assert(typeof kpis.retentionRate === 'number' && kpis.retentionRate >= 0 && kpis.retentionRate <= 100, 'KPI retentionRate is 0-100');
  assert(typeof kpis.vip === 'number' && kpis.vip >= 0, 'KPI vip is non-negative');
  assert(typeof kpis.nuevo === 'number' && kpis.nuevo >= 0, 'KPI nuevo is non-negative');
  assert(typeof kpis.atRisk === 'number' && kpis.atRisk >= 0, 'KPI atRisk is non-negative');
  assert(typeof kpis.inactive === 'number' && kpis.inactive >= 0, 'KPI inactive is non-negative');
  assert(typeof kpis.totalRevenue === 'number' && kpis.totalRevenue > 0, 'KPI totalRevenue is positive');
  assert(typeof kpis.avgTicket === 'number' && kpis.avgTicket > 0, 'KPI avgTicket is positive');

  assertEqual(kpis.active + kpis.atRisk + kpis.inactive, kpis.total,
    'KPI active + atRisk + inactive = total');

  const expectedRetention = Math.round((kpis.active / kpis.total) * 100);
  assertEqual(kpis.retentionRate, expectedRetention, 'KPI retentionRate = Math.round(active/total * 100)');

  const expectedRevenue = enriched.reduce((s, c) => s + c.totalSpent, 0);
  assertEqual(kpis.totalRevenue, expectedRevenue, 'KPI totalRevenue matches sum of all totalSpent');

  console.log(`    KPIs: total=${kpis.total}, active=${kpis.active}, vip=${kpis.vip}, nuevo=${kpis.nuevo}, atRisk=${kpis.atRisk}, inactive=${kpis.inactive}`);
  console.log(`    Revenue: $${kpis.totalRevenue.toLocaleString()} COP, AvgTicket: $${kpis.avgTicket.toLocaleString()} COP, Retention: ${kpis.retentionRate}%`);
}

console.log('\n--- getStatusExplanation ---');
{
  const vipClient = enriched.find(c => c.status === STATUS.VIP);
  if (vipClient) {
    const explanation = getStatusExplanation(vipClient);
    assertIncludes(explanation, 'premium', 'VIP explanation mentions premium');
    assertIncludes(explanation, 'COP', 'VIP explanation mentions COP');
  }

  const nuevoClient = enriched.find(c => c.status === STATUS.NUEVO);
  if (nuevoClient) {
    const explanation = getStatusExplanation(nuevoClient);
    assertIncludes(explanation, 'Primera visita', 'Nuevo explanation mentions Primera visita');
    assertIncludes(explanation, '30 días', 'Nuevo explanation mentions 30 dias');
  }

  const activoClient = enriched.find(c => c.status === STATUS.ACTIVO);
  if (activoClient) {
    const explanation = getStatusExplanation(activoClient);
    assertIncludes(explanation, 'Última visita', 'Activo explanation mentions Ultima visita');
    assertIncludes(explanation, 'regular', 'Activo explanation mentions regular');
  }

  const enRiesgoClient = enriched.find(c => c.status === STATUS.EN_RIESGO);
  if (enRiesgoClient) {
    const explanation = getStatusExplanation(enRiesgoClient);
    assertIncludes(explanation, 'sin visitar', 'En Riesgo explanation mentions sin visitar');
    assertIncludes(explanation, 'WhatsApp', 'En Riesgo explanation mentions WhatsApp');
  }

  const inactivoClient = enriched.find(c => c.status === STATUS.INACTIVO);
  if (inactivoClient) {
    const explanation = getStatusExplanation(inactivoClient);
    assertIncludes(explanation, 'sin visitar', 'Inactivo explanation mentions sin visitar');
    assertIncludes(explanation, 'reactivación', 'Inactivo explanation mentions reactivacion');
  }

  const unknownClient = { status: 'unknown', daysSinceLastVisit: 5 };
  const unknownExplanation = getStatusExplanation(unknownClient);
  assertEqual(unknownExplanation, '', 'Unknown status returns empty string');
}

console.log('\n--- STATUS_META ---');
{
  assertEqual(Object.keys(STATUS_META).length, 5, 'STATUS_META has 5 entries');
  assert(STATUS_META[STATUS.VIP].priority < STATUS_META[STATUS.INACTIVO].priority, 'VIP has higher priority than Inactivo');
  assertEqual(STATUS_META[STATUS.VIP].label, 'VIP', 'VIP label is VIP');
  assertEqual(STATUS_META[STATUS.NUEVO].label, 'Nuevo', 'Nuevo label is Nuevo');
  assertEqual(STATUS_META[STATUS.ACTIVO].label, 'Activo', 'Activo label is Activo');
  assertEqual(STATUS_META[STATUS.EN_RIESGO].label, 'En Riesgo', 'En Riesgo label is En Riesgo');
  assertEqual(STATUS_META[STATUS.INACTIVO].label, 'Inactivo', 'Inactivo label is Inactivo');
}

// ============================================
// Status Distribution (for debugging)
// ============================================
console.log('\n========================================');
console.log('STATUS DISTRIBUTION (as of today)');
console.log('========================================');
const statusGroups = {};
for (const c of enriched) {
  if (!statusGroups[c.status]) statusGroups[c.status] = [];
  statusGroups[c.status].push(`${c.id}(${c.name.split(' ')[0]},${c.daysSinceLastVisit}d)`);
}
for (const [status, clients] of Object.entries(statusGroups)) {
  console.log(`  ${status}: ${clients.join(', ')}`);
}

// ============================================
// FINAL REPORT
// ============================================

console.log('\n========================================');
console.log('FINAL REPORT');
console.log('========================================');
console.log(`  Total tests: ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failures.length > 0) {
  console.log('\n  FAILURES:');
  failures.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
}

if (bugs.length > 0) {
  console.log('\n  BUGS FOUND:');
  bugs.forEach((b, i) => console.log(`    ${i + 1}. ${b}`));
}

if (failed === 0 && bugs.length === 0) {
  console.log('\n  ALL TESTS PASSED. No bugs found.');
}

process.exit(failed > 0 ? 1 : 0);
