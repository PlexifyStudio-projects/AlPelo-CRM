import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { mockClients, mockBarbers, mockVisitHistory, mockServices, mockAppointments } from '../../data/mockData';
import { enrichClients, computeKPIs, STATUS, STATUS_META, getStatusExplanation } from '../../utils/clientStatus';
import { formatCurrency, formatDate, daysSince } from '../../utils/formatters';

// ============================================
// AlPelo - AI Chat Assistant v3.0
// Full business intelligence chat interface
// Handles 35+ query types with real mock data
// Smart follow-up context & natural Colombian Spanish
// ============================================

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const SUGGESTED_PROMPTS = [
  {
    icon: '👑',
    text: '¿Quiénes son mis clientes VIP?',
    description: 'Clientes estrella del negocio',
    category: 'clientes',
  },
  {
    icon: '⚠️',
    text: '¿Cuántos clientes están en riesgo?',
    description: 'Clientes que podrían perderse',
    category: 'clientes',
  },
  {
    icon: '💰',
    text: '¿Cuál es mi ticket promedio?',
    description: 'Gasto promedio por visita',
    category: 'finanzas',
  },
  {
    icon: '📅',
    text: '¿Qué clientes no vienen hace más de un mes?',
    description: 'Clientes ausentes 30+ días',
    category: 'clientes',
  },
  {
    icon: '📊',
    text: 'Resumen del negocio',
    description: 'KPIs y estado general',
    category: 'finanzas',
  },
  {
    icon: '💈',
    text: '¿Cuál barbero tiene más clientes?',
    description: 'Ranking de profesionales',
    category: 'equipo',
  },
];

const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ============================================
// STATUS BADGE GENERATOR
// ============================================
const statusBadge = (status) => {
  const colors = {
    vip: { bg: 'rgba(201,168,76,0.15)', color: '#A8873A', label: 'VIP' },
    activo: { bg: 'rgba(52,211,153,0.15)', color: '#22B07E', label: 'Activo' },
    nuevo: { bg: 'rgba(96,165,250,0.15)', color: '#4B8FE0', label: 'Nuevo' },
    en_riesgo: { bg: 'rgba(251,191,36,0.15)', color: '#D4A017', label: 'En Riesgo' },
    inactivo: { bg: 'rgba(248,113,113,0.15)', color: '#E05252', label: 'Inactivo' },
  };
  const s = colors[status] || colors.activo;
  return `<span class="chat-ai__badge" style="background:${s.bg};color:${s.color}">${s.label}</span>`;
};

// ============================================
// FUZZY CLIENT SEARCH
// ============================================
const findClientByName = (query, clients) => {
  const lower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Exact full name
  let match = clients.find(
    (c) => c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === lower
  );
  if (match) return match;

  // Contains query
  match = clients.find(
    (c) => c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(lower)
  );
  if (match) return match;

  // Any word in query matches first or last name
  const words = lower.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    const found = clients.find((c) => {
      const normalized = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normalized.split(/\s+/).some((part) => part.startsWith(word) || word.startsWith(part));
    });
    if (found) return found;
  }
  return null;
};

// Try to extract a client name from a query
const extractClientName = (query, clients) => {
  const lower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Check each client to see if their name (or part of it) appears in the query
  let bestMatch = null;
  let bestScore = 0;

  for (const client of clients) {
    const nameParts = client.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/);

    let score = 0;
    for (const part of nameParts) {
      if (part.length > 2 && lower.includes(part)) {
        score += part.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = client;
    }
  }

  return bestScore >= 4 ? bestMatch : null;
};

// ============================================
// CLIENT PROFILE CARD HTML
// ============================================
const clientProfileHTML = (client) => {
  const barber = mockBarbers.find((b) => b.id === client.preferredBarber);
  const days = client.daysSinceLastVisit ?? daysSince(client.lastVisit);
  const explanation = getStatusExplanation(client);

  return `<div class="chat-ai__client-card">
  <div class="chat-ai__client-card-header">
    <div class="chat-ai__client-card-avatar">${client.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
    <div class="chat-ai__client-card-info">
      <strong>${client.name}</strong> ${statusBadge(client.status)}
      <div class="chat-ai__client-card-sub">${client.phone} ${client.email ? '&middot; ' + client.email : ''}</div>
    </div>
  </div>
  <div class="chat-ai__client-card-grid">
    <div class="chat-ai__client-card-item">
      <span class="chat-ai__client-card-label">Gasto total</span>
      <span class="chat-ai__client-card-value">${formatCurrency(client.totalSpent)}</span>
    </div>
    <div class="chat-ai__client-card-item">
      <span class="chat-ai__client-card-label">Visitas</span>
      <span class="chat-ai__client-card-value">${client.totalVisits}</span>
    </div>
    <div class="chat-ai__client-card-item">
      <span class="chat-ai__client-card-label">Ticket promedio</span>
      <span class="chat-ai__client-card-value">${formatCurrency(client.avgTicket || Math.round(client.totalSpent / client.totalVisits))}</span>
    </div>
    <div class="chat-ai__client-card-item">
      <span class="chat-ai__client-card-label">Dias sin visita</span>
      <span class="chat-ai__client-card-value">${days} dias</span>
    </div>
    <div class="chat-ai__client-card-item">
      <span class="chat-ai__client-card-label">Servicio favorito</span>
      <span class="chat-ai__client-card-value">${client.favoriteService}</span>
    </div>
    <div class="chat-ai__client-card-item">
      <span class="chat-ai__client-card-label">Barbero preferido</span>
      <span class="chat-ai__client-card-value">${barber ? barber.name : 'N/A'}</span>
    </div>
    <div class="chat-ai__client-card-item">
      <span class="chat-ai__client-card-label">Fuente</span>
      <span class="chat-ai__client-card-value">${client.source}</span>
    </div>
    <div class="chat-ai__client-card-item">
      <span class="chat-ai__client-card-label">WhatsApp</span>
      <span class="chat-ai__client-card-value">${client.acceptsWhatsApp ? 'Si' : 'No'}</span>
    </div>
  </div>
  ${client.notes ? `<div class="chat-ai__client-card-notes"><strong>Notas:</strong> ${client.notes}</div>` : ''}
  <div class="chat-ai__client-card-status">${explanation}</div>
</div>`;
};

// ============================================
// DATA TABLE GENERATOR
// ============================================
const dataTableHTML = (headers, rows, maxRows = 10) => {
  const displayRows = rows.slice(0, maxRows);
  const headerCells = headers.map((h) => `<th>${h}</th>`).join('');
  const bodyRows = displayRows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');

  return `<div class="chat-ai__data-table-wrapper">
    <table class="chat-ai__data-table">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    ${rows.length > maxRows ? `<div class="chat-ai__data-table-more">... y ${rows.length - maxRows} mas</div>` : ''}
  </div>`;
};

// ============================================
// METRIC CARD HTML
// ============================================
const metricHTML = (label, value, color = '') => {
  const colorStyle = color ? ` style="color:${color}"` : '';
  return `<div class="chat-ai__metric">
    <span class="chat-ai__metric-value"${colorStyle}>${value}</span>
    <span class="chat-ai__metric-label">${label}</span>
  </div>`;
};

const metricsGridHTML = (metrics) => {
  return `<div class="chat-ai__metrics-grid">${metrics.join('')}</div>`;
};

// ============================================
// ACTION CARD HTML
// ============================================
const actionCardHTML = (title, description, type = 'info') => {
  return `<div class="chat-ai__action-card chat-ai__action-card--${type}">
    <div class="chat-ai__action-card-title">${title}</div>
    <div class="chat-ai__action-card-desc">${description}</div>
  </div>`;
};

// ============================================
// MAIN AI RESPONSE ENGINE
// ============================================
const generateAIResponse = (message, enrichedClients, kpis, conversationContext) => {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let contextClient = conversationContext.lastClient;
  let newContext = { ...conversationContext };

  // ----- HELPER: get month from query -----
  const getMonthFromQuery = (q) => {
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      if (q.includes(MONTH_NAMES[i])) return i;
    }
    if (q.includes('este mes') || q.includes('mes actual')) return currentMonth;
    return null;
  };

  // ==========================================
  // 0. GREETINGS
  // ==========================================
  if (/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches|que tal|ey|saludos|hi)\b/.test(lower)) {
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Buenos dias' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    return {
      content: `<strong>${greeting}!</strong> Soy el asistente de inteligencia de AlPelo.

Tengo acceso a toda la informacion de tus <strong>${kpis.total} clientes</strong>, el equipo de <strong>${mockBarbers.length} profesionales</strong>, historial de visitas, ingresos y mucho mas.

<strong>Preguntame lo que necesites, por ejemplo:</strong>
<ul>
<li>"Quienes son mis clientes VIP?"</li>
<li>"Cuanto ha gastado Carlos Mendoza?"</li>
<li>"Que clientes no vienen hace mas de un mes?"</li>
<li>"Resumen del negocio"</li>
<li>"Genera campana de reactivacion"</li>
</ul>

Estoy listo para ayudarte a tomar decisiones inteligentes para el negocio.`,
      context: newContext,
    };
  }

  // ==========================================
  // 0b. THANKS / POSITIVE FEEDBACK
  // ==========================================
  if (/^(gracias|thanks|genial|excelente|perfecto|listo|vale|ok|buenisimo|chevere|bacano)\b/.test(lower)) {
    return {
      content: `Con gusto! Si necesitas algo mas, aqui estoy. Puedo ayudarte con informacion de clientes, finanzas, el equipo, campanas de marketing y mucho mas.`,
      context: newContext,
    };
  }

  // ==========================================
  // 1. CLIENT COUNT
  // ==========================================
  if (
    (lower.includes('cuantos') || lower.includes('cuantas') || lower.includes('total')) &&
    lower.includes('cliente')
  ) {
    const byStatus = {};
    enrichedClients.forEach((c) => {
      const label = STATUS_META[c.status]?.label || c.status;
      byStatus[label] = (byStatus[label] || 0) + 1;
    });

    const metrics = [
      metricHTML('Total clientes', kpis.total, '#1A1A1A'),
      metricHTML('Activos', kpis.active, '#22B07E'),
      metricHTML('VIP', kpis.vip, '#A8873A'),
      metricHTML('En riesgo', kpis.atRisk, '#D4A017'),
      metricHTML('Inactivos', kpis.inactive, '#E05252'),
      metricHTML('Nuevos', kpis.nuevo, '#4B8FE0'),
    ];

    return {
      content: `<strong>📊 Base de clientes de AlPelo</strong>

${metricsGridHTML(metrics)}

La tasa de retencion actual es del <strong>${kpis.retentionRate}%</strong>. De los <strong>${kpis.total}</strong> clientes registrados, <strong>${kpis.active}</strong> estan activos (incluyendo VIPs y nuevos).

${kpis.atRisk > 0 ? `⚠️ <strong>Alerta:</strong> Hay <strong>${kpis.atRisk} clientes en riesgo</strong> que necesitan atencion inmediata para evitar que pasen a inactivos.` : '✅ <strong>Excelente:</strong> No hay clientes en riesgo actualmente.'}`,
      context: newContext,
    };
  }

  // ==========================================
  // 2. CLIENTS BY LETTER
  // ==========================================
  if (lower.includes('clientes con la letra') || lower.includes('nombres con') || lower.match(/clientes.*(que empie|comien).*con/)) {
    const letterMatch = message.match(/letra\s+([a-zA-Z])/i) || message.match(/con\s+([a-zA-Z])$/i);
    if (letterMatch) {
      const letter = letterMatch[1].toUpperCase();
      const matches = enrichedClients.filter((c) => c.name.toUpperCase().startsWith(letter));

      if (matches.length === 0) {
        return {
          content: `No encontre clientes cuyo nombre empiece con la letra <strong>"${letter}"</strong>.`,
          context: newContext,
        };
      }

      const rows = matches.map((c) => [
        `<strong>${c.name}</strong>`,
        statusBadge(c.status),
        formatCurrency(c.totalSpent),
        `${c.daysSinceLastVisit}d`,
      ]);

      return {
        content: `<strong>Clientes con la letra "${letter}" (${matches.length}):</strong>

${dataTableHTML(['Nombre', 'Estado', 'Gasto', 'Ult. visita'], rows)}`,
        context: newContext,
      };
    }
  }

  // ==========================================
  // 3. OLDEST / MOST SENIOR CLIENT
  // ==========================================
  if (lower.includes('mas viejo') || lower.includes('mas antiguo') || lower.includes('primera visita') || lower.includes('mas veterano')) {
    const sorted = [...enrichedClients].sort((a, b) => new Date(a.firstVisit) - new Date(b.firstVisit));
    const oldest = sorted[0];
    newContext.lastClient = oldest;

    return {
      content: `<strong>El cliente mas antiguo de AlPelo:</strong>

${clientProfileHTML(oldest)}

<strong>${oldest.name}</strong> es cliente desde el <strong>${formatDate(oldest.firstVisit)}</strong>, lo que lo convierte en el cliente con mayor antiguedad del negocio.`,
      context: newContext,
    };
  }

  // ==========================================
  // 4. TOP SPENDERS
  // ==========================================
  if (lower.includes('quien gasta mas') || lower.includes('gasta mas') || lower.includes('mas gastan') || lower.includes('top gastadores') || lower.includes('mejores clientes')) {
    const sorted = [...enrichedClients].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);

    const rows = sorted.map((c, i) => [
      `<strong>${i + 1}.</strong>`,
      `<strong>${c.name}</strong>`,
      statusBadge(c.status),
      formatCurrency(c.totalSpent),
      `${c.totalVisits} visitas`,
      formatCurrency(c.avgTicket || Math.round(c.totalSpent / c.totalVisits)),
    ]);

    return {
      content: `<strong>Top 10 clientes por gasto total:</strong>

${dataTableHTML(['#', 'Nombre', 'Estado', 'Gasto total', 'Visitas', 'Ticket prom.'], rows)}

<strong>${sorted[0].name}</strong> lidera con <strong>${formatCurrency(sorted[0].totalSpent)}</strong> en gasto total. Los clientes VIP son la columna vertebral del negocio.`,
      context: newContext,
    };
  }

  // ==========================================
  // 5. CLIENTS BY STATUS (VIP, inactivo, en_riesgo, nuevo, activo)
  // ==========================================
  if (lower.includes('vip') || lower.includes('premium')) {
    const vips = enrichedClients.filter((c) => c.status === 'vip');
    if (vips.length === 0) {
      return { content: '<strong>No hay clientes VIP actualmente.</strong>', context: newContext };
    }
    const rows = vips.map((c) => [
      `<strong>${c.name}</strong>`,
      formatCurrency(c.totalSpent),
      `${c.totalVisits}`,
      formatCurrency(c.avgTicket || Math.round(c.totalSpent / c.totalVisits)),
      `${c.daysSinceLastVisit}d`,
    ]);

    const totalVipSpent = vips.reduce((s, c) => s + c.totalSpent, 0);
    const pctRevenue = Math.round((totalVipSpent / enrichedClients.reduce((s, c) => s + c.totalSpent, 0)) * 100);

    const avgVipTicket = Math.round(totalVipSpent / vips.reduce((s, c) => s + c.totalVisits, 0));

    return {
      content: `👑 <strong>Clientes VIP de AlPelo (${vips.length}):</strong>

${metricsGridHTML([
  metricHTML('Clientes VIP', vips.length.toString(), '#A8873A'),
  metricHTML('Ingresos VIP', formatCurrency(totalVipSpent), '#2D5A3D'),
  metricHTML('% de ingresos', pctRevenue + '%', '#1A1A1A'),
  metricHTML('Ticket prom. VIP', formatCurrency(avgVipTicket), '#A8873A'),
])}

${dataTableHTML(['Nombre', 'Gasto total', 'Visitas', 'Ticket prom.', 'Ult. visita'], rows)}

📊 Los VIPs representan el <strong>${Math.round((vips.length / enrichedClients.length) * 100)}%</strong> de la base pero generan el <strong>${pctRevenue}%</strong> de los ingresos totales (<strong>${formatCurrency(totalVipSpent)}</strong>). Son la columna vertebral del negocio.

${actionCardHTML('💡 Sugerencia para retener VIPs', '<ul><li>Crear programa de <strong>beneficios exclusivos</strong> con citas prioritarias</li><li>Corte de cortesia cada 10 visitas como recompensa</li><li>Acceso anticipado a nuevos servicios y productos</li><li>Mensaje personalizado de agradecimiento periodico</li></ul>', 'success')}`,
      context: newContext,
    };
  }

  if (lower.includes('inactivo') && lower.includes('cliente')) {
    const inactive = enrichedClients.filter((c) => c.status === 'inactivo');
    if (inactive.length === 0) {
      return { content: '<strong>No hay clientes inactivos.</strong> Excelente retencion!', context: newContext };
    }
    const rows = inactive.map((c) => [
      `<strong>${c.name}</strong>`,
      `${c.daysSinceLastVisit} dias`,
      c.favoriteService,
      c.acceptsWhatsApp ? 'Si' : 'No',
    ]);

    return {
      content: `<strong>Clientes inactivos (+60 dias sin visita): ${inactive.length}</strong>

${dataTableHTML(['Nombre', 'Sin visita', 'Serv. favorito', 'WhatsApp'], rows)}

Estos clientes llevan mas de 60 dias sin visitar AlPelo. Se recomienda una <strong>campana de reactivacion</strong> con un descuento del 10-15% en su servicio favorito.

${actionCardHTML('Accion sugerida', `Enviar mensaje de reactivacion a los ${inactive.filter((c) => c.acceptsWhatsApp).length} clientes que aceptan WhatsApp.`, 'warning')}`,
      context: newContext,
    };
  }

  if (lower.includes('riesgo') && !lower.includes('tasa')) {
    const atRisk = enrichedClients.filter((c) => c.status === 'en_riesgo');
    if (atRisk.length === 0) {
      return {
        content: `<strong>No hay clientes en riesgo actualmente.</strong> Todos los clientes tienen visitas recientes. Excelente trabajo con la retencion.`,
        context: newContext,
      };
    }
    const rows = atRisk.map((c) => {
      const remaining = 60 - c.daysSinceLastVisit;
      return [
        `<strong>${c.name}</strong>`,
        `${c.daysSinceLastVisit} dias`,
        `${remaining > 0 ? remaining : 0} dias`,
        c.favoriteService,
        c.acceptsWhatsApp ? 'Si' : 'No',
      ];
    });

    return {
      content: `⚠️ <strong>Clientes en riesgo de abandono (${atRisk.length}):</strong>

Estos clientes llevan entre 46 y 60 dias sin visitar AlPelo y podrian pasar a inactivos pronto:

${dataTableHTML(['Nombre', 'Sin visita', 'Queda', 'Serv. favorito', 'WhatsApp'], rows)}

💡 <strong>Recomendacion:</strong> Enviar un mensaje personalizado por WhatsApp con un incentivo. Los clientes en riesgo tienen un <strong>72% de probabilidad</strong> de regresar si se les contacta en la primera semana.

${actionCardHTML('🚨 Accion urgente', `Contactar a los <strong>${atRisk.filter((c) => c.acceptsWhatsApp).length} clientes</strong> disponibles por WhatsApp antes de que pasen a inactivos. Cada cliente en riesgo recuperado representa un promedio de <strong>${formatCurrency(kpis.avgTicket)}</strong> en la proxima visita.`, 'danger')}`,
      context: newContext,
    };
  }

  if (lower.includes('cliente') && lower.includes('nuevo')) {
    const newClients = enrichedClients.filter((c) => c.status === 'nuevo');
    if (newClients.length === 0) {
      return { content: '<strong>No hay clientes nuevos recientes.</strong>', context: newContext };
    }
    const rows = newClients.map((c) => [
      `<strong>${c.name}</strong>`,
      formatDate(c.firstVisit),
      c.favoriteService,
      c.source,
      c.acceptsWhatsApp ? 'Si' : 'No',
    ]);

    return {
      content: `<strong>Clientes nuevos (primera visita reciente): ${newClients.length}</strong>

${dataTableHTML(['Nombre', 'Primera visita', 'Servicio', 'Fuente', 'WhatsApp'], rows)}

Es clave que estos clientes regresen en los proximos 30 dias para fidelizarlos. Un mensaje de bienvenida y un pequeno incentivo para la segunda visita pueden marcar la diferencia.

${actionCardHTML('Sugerencia', 'Enviar mensaje de bienvenida con 10% de descuento en la segunda visita.', 'info')}`,
      context: newContext,
    };
  }

  // ==========================================
  // 6. CLIENT PROFILE / INFO
  // ==========================================
  if (lower.includes('info de') || lower.includes('perfil de') || lower.includes('datos de') || lower.includes('quien es') || lower.includes('informacion de') || lower.includes('dime sobre')) {
    const client = extractClientName(message, enrichedClients);
    if (client) {
      newContext.lastClient = client;
      return {
        content: `<strong>Perfil completo de ${client.name}:</strong>

${clientProfileHTML(client)}`,
        context: newContext,
      };
    }
  }

  // ==========================================
  // 7. HOW MUCH HAS [client] SPENT
  // ==========================================
  if (lower.includes('cuanto ha gastado') || lower.includes('gasto de') || lower.includes('cuanto gasto') || lower.includes('cuanto lleva')) {
    let client = extractClientName(message, enrichedClients);
    if (!client && contextClient) client = contextClient;

    if (client) {
      newContext.lastClient = client;
      const visits = mockVisitHistory.filter((v) => v.clientId === client.id && v.status === 'completed');
      const avgRating = visits.filter((v) => v.rating).reduce((s, v, _, a) => s + v.rating / a.length, 0);

      return {
        content: `<strong>Resumen de gasto de ${client.name}:</strong>

${metricsGridHTML([
  metricHTML('Gasto total', formatCurrency(client.totalSpent), '#1A1A1A'),
  metricHTML('Visitas', client.totalVisits.toString(), '#2D5A3D'),
  metricHTML('Ticket promedio', formatCurrency(client.avgTicket || Math.round(client.totalSpent / client.totalVisits)), '#A8873A'),
  metricHTML('Rating prom.', avgRating > 0 ? avgRating.toFixed(1) + '/5' : 'N/A', '#D4A017'),
])}

Servicio mas frecuente: <strong>${client.favoriteService}</strong>. Cliente desde <strong>${formatDate(client.firstVisit)}</strong>.`,
        context: newContext,
      };
    }
    return {
      content: 'No encontre un cliente con ese nombre. Intenta con el nombre completo o parcial, por ejemplo: <strong>"Cuanto ha gastado Carlos?"</strong>',
      context: newContext,
    };
  }

  // ==========================================
  // 8. WHATSAPP CLIENTS
  // ==========================================
  if (lower.includes('whatsapp') && (lower.includes('acepta') || lower.includes('aceptan') || lower.includes('cliente'))) {
    const accepts = enrichedClients.filter((c) => c.acceptsWhatsApp);
    const rejects = enrichedClients.filter((c) => !c.acceptsWhatsApp);

    return {
      content: `<strong>Clientes y WhatsApp:</strong>

${metricsGridHTML([
  metricHTML('Aceptan WhatsApp', accepts.length.toString(), '#22B07E'),
  metricHTML('No aceptan', rejects.length.toString(), '#E05252'),
  metricHTML('Cobertura', Math.round((accepts.length / enrichedClients.length) * 100) + '%', '#2D5A3D'),
])}

${rejects.length > 0 ? `<strong>Clientes que NO aceptan WhatsApp:</strong> ${rejects.map((c) => c.name).join(', ')}` : 'Todos los clientes aceptan WhatsApp.'}

Esto significa que puedes alcanzar al <strong>${Math.round((accepts.length / enrichedClients.length) * 100)}%</strong> de tu base de clientes por mensajeria directa.`,
      context: newContext,
    };
  }

  // ==========================================
  // 9. CLIENTS BY SOURCE
  // ==========================================
  if (lower.includes('instagram') || lower.includes('google') || lower.includes('referido') || lower.includes('tiktok') || lower.includes('fuente') || lower.includes('de donde vienen')) {
    if (lower.includes('fuente') || lower.includes('de donde')) {
      // Show all sources
      const sources = {};
      enrichedClients.forEach((c) => {
        sources[c.source] = (sources[c.source] || 0) + 1;
      });
      const sorted = Object.entries(sources).sort((a, b) => b[1] - a[1]);
      const rows = sorted.map(([source, count]) => [
        `<strong>${source}</strong>`,
        count.toString(),
        Math.round((count / enrichedClients.length) * 100) + '%',
      ]);

      return {
        content: `<strong>Clientes por fuente de adquisicion:</strong>

${dataTableHTML(['Fuente', 'Clientes', '% del total'], rows)}

<strong>${sorted[0][0]}</strong> es el canal mas efectivo con <strong>${sorted[0][1]} clientes</strong>. Considera invertir mas en este canal para maximizar el crecimiento.`,
        context: newContext,
      };
    }

    // Specific source
    let source = '';
    if (lower.includes('instagram')) source = 'Instagram';
    else if (lower.includes('google')) source = 'Google Maps';
    else if (lower.includes('referido')) source = 'Referido';
    else if (lower.includes('tiktok')) source = 'TikTok';

    const filtered = enrichedClients.filter(
      (c) => c.source.toLowerCase() === source.toLowerCase()
    );

    if (filtered.length === 0) {
      return { content: `No encontre clientes de <strong>${source}</strong>.`, context: newContext };
    }

    const rows = filtered.map((c) => [
      `<strong>${c.name}</strong>`,
      statusBadge(c.status),
      formatCurrency(c.totalSpent),
      `${c.totalVisits} visitas`,
    ]);

    return {
      content: `<strong>Clientes de ${source} (${filtered.length}):</strong>

${dataTableHTML(['Nombre', 'Estado', 'Gasto', 'Visitas'], rows)}

Los clientes de <strong>${source}</strong> representan el <strong>${Math.round((filtered.length / enrichedClients.length) * 100)}%</strong> de la base.`,
      context: newContext,
    };
  }

  // ==========================================
  // 10. BIRTHDAYS
  // ==========================================
  if (lower.includes('cumple') || lower.includes('nacimiento') || lower.includes('birthday')) {
    // Birthdays today
    if (lower.includes('hoy')) {
      const today = enrichedClients.filter((c) => {
        if (!c.birthday) return false;
        const b = new Date(c.birthday);
        return b.getMonth() === currentMonth && b.getDate() === now.getDate();
      });

      if (today.length === 0) {
        return { content: '<strong>Nadie cumple anos hoy.</strong> El proximo cumpleanero te lo muestro si preguntas "proximos cumpleanos".', context: newContext };
      }

      return {
        content: `<strong>Cumpleanos hoy! (${today.length}):</strong>

${today.map((c) => `${clientProfileHTML(c)}`).join('\n')}

${actionCardHTML('Accion', `Enviar mensaje de felicitacion a ${today.map((c) => c.name).join(' y ')} con un descuento especial de cumpleanos.`, 'info')}`,
        context: newContext,
      };
    }

    // Upcoming birthdays
    if (lower.includes('proximo') || lower.includes('proximos') || lower.includes('siguiente')) {
      const withBday = enrichedClients.filter((c) => c.birthday);
      const sorted = withBday.sort((a, b) => {
        const aDate = new Date(a.birthday);
        const bDate = new Date(b.birthday);
        const aNext = new Date(currentYear, aDate.getMonth(), aDate.getDate());
        const bNext = new Date(currentYear, bDate.getMonth(), bDate.getDate());
        if (aNext < now) aNext.setFullYear(currentYear + 1);
        if (bNext < now) bNext.setFullYear(currentYear + 1);
        return aNext - bNext;
      });

      const next5 = sorted.slice(0, 5);
      const rows = next5.map((c) => {
        const bday = new Date(c.birthday);
        const nextBday = new Date(currentYear, bday.getMonth(), bday.getDate());
        if (nextBday < now) nextBday.setFullYear(currentYear + 1);
        const daysUntil = Math.ceil((nextBday - now) / (1000 * 60 * 60 * 24));
        return [
          `<strong>${c.name}</strong>`,
          `${bday.getDate()} de ${MONTH_NAMES[bday.getMonth()]}`,
          daysUntil === 0 ? '<strong>Hoy!</strong>' : `En ${daysUntil} dias`,
          statusBadge(c.status),
        ];
      });

      return {
        content: `<strong>Proximos cumpleanos:</strong>

${dataTableHTML(['Nombre', 'Fecha', 'Faltan', 'Estado'], rows)}

<strong>Tip:</strong> Enviar un mensaje de felicitacion con un descuento del 10% genera un 45% de retorno en visitas.`,
        context: newContext,
      };
    }

    // By specific month or current month
    const queryMonth = getMonthFromQuery(lower);
    const targetMonth = queryMonth !== null ? queryMonth : currentMonth;
    const monthName = MONTH_NAMES[targetMonth];

    const bdayClients = enrichedClients.filter((c) => {
      if (!c.birthday) return false;
      return new Date(c.birthday).getMonth() === targetMonth;
    });

    if (bdayClients.length === 0) {
      return {
        content: `<strong>No hay cumpleanos en ${monthName}.</strong>`,
        context: newContext,
      };
    }

    const rows = bdayClients.map((c) => {
      const bday = new Date(c.birthday);
      return [
        `<strong>${c.name}</strong>`,
        `${bday.getDate()} de ${monthName}`,
        statusBadge(c.status),
        c.acceptsWhatsApp ? 'Si' : 'No',
      ];
    });

    return {
      content: `<strong>Cumpleanos en ${monthName} (${bdayClients.length}):</strong>

${dataTableHTML(['Nombre', 'Fecha', 'Estado', 'WhatsApp'], rows)}

${actionCardHTML('Sugerencia', `Programar mensajes de felicitacion automaticos para los ${bdayClients.filter((c) => c.acceptsWhatsApp).length} clientes que aceptan WhatsApp.`, 'info')}`,
      context: newContext,
    };
  }

  // ==========================================
  // 11. REVENUE / FINANCIAL QUERIES
  // ==========================================
  if (lower.includes('ingreso') || lower.includes('ventas') || lower.includes('revenue') || lower.includes('dinero') || lower.includes('facturacion')) {
    const queryMonth = getMonthFromQuery(lower);
    const targetMonth = queryMonth !== null ? queryMonth : currentMonth;
    const monthName = MONTH_NAMES[targetMonth];

    const monthVisits = mockVisitHistory.filter((v) => {
      const d = new Date(v.date);
      return d.getMonth() === targetMonth && d.getFullYear() === currentYear && v.status === 'completed';
    });
    const monthRevenue = monthVisits.reduce((sum, v) => sum + v.amount, 0);
    const monthCount = monthVisits.length;
    const avgTicket = monthCount > 0 ? Math.round(monthRevenue / monthCount) : 0;

    // Service breakdown for the month
    const serviceBreakdown = {};
    monthVisits.forEach((v) => {
      if (!serviceBreakdown[v.service]) serviceBreakdown[v.service] = { count: 0, revenue: 0 };
      serviceBreakdown[v.service].count++;
      serviceBreakdown[v.service].revenue += v.amount;
    });
    const sortedServices = Object.entries(serviceBreakdown).sort((a, b) => b[1].revenue - a[1].revenue);

    const serviceRows = sortedServices.slice(0, 5).map(([name, data]) => [
      `<strong>${name}</strong>`,
      data.count.toString(),
      formatCurrency(data.revenue),
      Math.round((data.revenue / monthRevenue) * 100) + '%',
    ]);

    return {
      content: `💰 <strong>Resumen financiero de ${monthName} ${currentYear}:</strong>

${metricsGridHTML([
  metricHTML('Ingresos del mes', formatCurrency(monthRevenue), '#2D5A3D'),
  metricHTML('Visitas completadas', monthCount.toString(), '#1A1A1A'),
  metricHTML('Ticket promedio', formatCurrency(avgTicket), '#A8873A'),
  metricHTML('Ingresos historicos', formatCurrency(kpis.totalRevenue), '#4B8FE0'),
])}

${sortedServices.length > 0 ? `<strong>✂️ Desglose por servicio:</strong>\n\n${dataTableHTML(['Servicio', 'Cantidad', 'Ingreso', '% del total'], serviceRows)}` : 'No hay datos de servicios para este mes.'}

${monthCount > 0 ? `📊 Se completaron <strong>${monthCount} servicios</strong> en ${monthName}, generando un ingreso promedio diario de <strong>${formatCurrency(Math.round(monthRevenue / new Date(currentYear, targetMonth + 1, 0).getDate()))}</strong>.` : ''}`,
      context: newContext,
    };
  }

  // ==========================================
  // 12. TICKET PROMEDIO
  // ==========================================
  if (lower.includes('ticket promedio') || lower.includes('ticket medio') || lower.includes('gasto promedio') || (lower.includes('mi ticket') && lower.includes('promedio'))) {
    // Calculate VIP vs non-VIP ticket
    const vipClients = enrichedClients.filter((c) => c.status === 'vip');
    const nonVipClients = enrichedClients.filter((c) => c.status !== 'vip');
    const vipAvg = vipClients.length > 0 ? Math.round(vipClients.reduce((s, c) => s + c.totalSpent, 0) / vipClients.reduce((s, c) => s + c.totalVisits, 0)) : 0;
    const nonVipAvg = nonVipClients.length > 0 ? Math.round(nonVipClients.reduce((s, c) => s + c.totalSpent, 0) / nonVipClients.reduce((s, c) => s + c.totalVisits, 0)) : 0;

    // Top service by revenue
    const serviceRevenue = {};
    mockVisitHistory.filter((v) => v.status === 'completed').forEach((v) => {
      if (!serviceRevenue[v.service]) serviceRevenue[v.service] = { count: 0, total: 0 };
      serviceRevenue[v.service].count++;
      serviceRevenue[v.service].total += v.amount;
    });
    const topService = Object.entries(serviceRevenue).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))[0];

    return {
      content: `💰 <strong>Ticket promedio de AlPelo:</strong>

${metricsGridHTML([
  metricHTML('Ticket promedio global', formatCurrency(kpis.avgTicket), '#2D5A3D'),
  metricHTML('Ticket VIP', formatCurrency(vipAvg), '#A8873A'),
  metricHTML('Ticket regular', formatCurrency(nonVipAvg), '#4B8FE0'),
  metricHTML('Total ingresos', formatCurrency(kpis.totalRevenue), '#1A1A1A'),
])}

📊 <strong>Analisis:</strong>
<ul>
<li>El ticket promedio global es de <strong>${formatCurrency(kpis.avgTicket)}</strong> por visita</li>
<li>Los clientes VIP gastan <strong>${formatCurrency(vipAvg)}</strong> en promedio (${vipAvg > nonVipAvg ? Math.round(((vipAvg - nonVipAvg) / nonVipAvg) * 100) : 0}% mas que el promedio regular)</li>
${topService ? `<li>El servicio con mayor ticket es <strong>${topService[0]}</strong> con <strong>${formatCurrency(Math.round(topService[1].total / topService[1].count))}</strong> por sesion</li>` : ''}
</ul>

${actionCardHTML('💡 Estrategias para aumentar el ticket', '<ul><li><strong>Combos:</strong> Ofrecer paquetes como Corte + Barba + Cejas con descuento del 5%</li><li><strong>Upselling:</strong> Sugerir servicios complementarios al momento de la cita</li><li><strong>Productos:</strong> Venta de productos capilares post-servicio</li><li><strong>Servicios premium:</strong> Ofrecer tratamientos especiales a clientes frecuentes</li></ul>', 'info')}`,
      context: newContext,
    };
  }

  // ==========================================
  // 13. BEST / WORST MONTH
  // ==========================================
  if (lower.includes('mejor mes') || lower.includes('peor mes') || lower.includes('mes mas') || lower.includes('meses')) {
    const monthlyData = {};
    mockVisitHistory.filter((v) => v.status === 'completed').forEach((v) => {
      const d = new Date(v.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) monthlyData[key] = { revenue: 0, visits: 0, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
      monthlyData[key].revenue += v.amount;
      monthlyData[key].visits++;
    });

    const sorted = Object.entries(monthlyData).sort((a, b) => b[1].revenue - a[1].revenue);

    const rows = sorted.map(([, data], i) => [
      `<strong>${i + 1}.</strong>`,
      data.label.charAt(0).toUpperCase() + data.label.slice(1),
      formatCurrency(data.revenue),
      data.visits.toString(),
      formatCurrency(Math.round(data.revenue / data.visits)),
    ]);

    return {
      content: `<strong>Ranking de meses por ingresos:</strong>

${dataTableHTML(['#', 'Mes', 'Ingresos', 'Visitas', 'Ticket prom.'], rows)}

<strong>Mejor mes:</strong> ${sorted[0][1].label} con <strong>${formatCurrency(sorted[0][1].revenue)}</strong>.
${sorted.length > 1 ? `<strong>Peor mes:</strong> ${sorted[sorted.length - 1][1].label} con <strong>${formatCurrency(sorted[sorted.length - 1][1].revenue)}</strong>.` : ''}`,
      context: newContext,
    };
  }

  // ==========================================
  // 14. REVENUE BY SERVICE
  // ==========================================
  if (lower.includes('ingreso') && lower.includes('servicio')) {
    const serviceData = {};
    mockVisitHistory.filter((v) => v.status === 'completed').forEach((v) => {
      if (!serviceData[v.service]) serviceData[v.service] = { count: 0, revenue: 0 };
      serviceData[v.service].count++;
      serviceData[v.service].revenue += v.amount;
    });

    const sorted = Object.entries(serviceData).sort((a, b) => b[1].revenue - a[1].revenue);
    const totalRevenue = sorted.reduce((s, [, d]) => s + d.revenue, 0);

    const rows = sorted.map(([name, data], i) => [
      `<strong>${i + 1}.</strong>`,
      `<strong>${name}</strong>`,
      data.count.toString(),
      formatCurrency(data.revenue),
      Math.round((data.revenue / totalRevenue) * 100) + '%',
    ]);

    return {
      content: `<strong>Ingresos por servicio (historico):</strong>

${dataTableHTML(['#', 'Servicio', 'Veces', 'Ingresos', '% del total'], rows)}`,
      context: newContext,
    };
  }

  // ==========================================
  // 15. SERVICE QUERIES
  // ==========================================
  if ((lower.includes('servicio') && (lower.includes('popular') || lower.includes('mas pedido') || lower.includes('mas solicitado'))) || lower.includes('que servicios') || lower.includes('servicio mas')) {
    const serviceCounts = {};
    mockVisitHistory.filter((v) => v.status === 'completed').forEach((v) => {
      serviceCounts[v.service] = (serviceCounts[v.service] || 0) + 1;
    });
    const sorted = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]);

    const rows = sorted.map(([name, count], i) => {
      const svc = mockServices.find((s) => s.name === name);
      return [
        `<strong>${i + 1}.</strong>`,
        `<strong>${name}</strong>`,
        count.toString(),
        svc ? formatCurrency(svc.price) : 'N/A',
        svc ? `${svc.duration} min` : 'N/A',
      ];
    });

    return {
      content: `<strong>Servicios mas solicitados:</strong>

${dataTableHTML(['#', 'Servicio', 'Solicitudes', 'Precio', 'Duracion'], rows)}

El servicio <strong>${sorted[0][0]}</strong> domina con <strong>${sorted[0][1]} solicitudes</strong>. Considera crear combos alrededor de este servicio para aumentar el ticket promedio.`,
      context: newContext,
    };
  }

  if (lower.includes('servicios disponibles') || lower.includes('lista de servicios') || lower.includes('catalogo') || lower.includes('menu de servicios') || lower.includes('precios')) {
    const byCategory = {};
    mockServices.forEach((s) => {
      if (!byCategory[s.category]) byCategory[s.category] = [];
      byCategory[s.category].push(s);
    });

    let html = '<strong>Catalogo de servicios de AlPelo:</strong>\n\n';
    for (const [category, services] of Object.entries(byCategory)) {
      const rows = services.map((s) => [
        `<strong>${s.name}</strong>`,
        formatCurrency(s.price),
        `${s.duration} min`,
      ]);
      html += `<strong>${category}:</strong>\n${dataTableHTML(['Servicio', 'Precio', 'Duracion'], rows)}\n`;
    }

    return { content: html, context: newContext };
  }

  if (lower.includes('quienes piden') || lower.includes('quien pide') || lower.includes('clientes de servicio')) {
    // Find the service name in the query
    const svc = mockServices.find((s) => lower.includes(s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
    if (svc) {
      const clientIds = [...new Set(mockVisitHistory.filter((v) => v.service === svc.name && v.status === 'completed').map((v) => v.clientId))];
      const clients = enrichedClients.filter((c) => clientIds.includes(c.id));

      const rows = clients.map((c) => [
        `<strong>${c.name}</strong>`,
        statusBadge(c.status),
        formatCurrency(c.totalSpent),
      ]);

      return {
        content: `<strong>Clientes que piden "${svc.name}" (${clients.length}):</strong>

${dataTableHTML(['Nombre', 'Estado', 'Gasto total'], rows)}`,
        context: newContext,
      };
    }
  }

  // ==========================================
  // 16. BARBER QUERIES
  // ==========================================
  if ((lower.includes('barbero') && (lower.includes('popular') || lower.includes('solicitado') || lower.includes('mas'))) || (lower.includes('barbero') && lower.includes('cliente'))) {
    // Count from visit history
    const barberCounts = {};
    mockVisitHistory.filter((v) => v.status === 'completed').forEach((v) => {
      barberCounts[v.barberId] = (barberCounts[v.barberId] || 0) + 1;
    });

    // Count unique clients per barber
    const barberUniqueClients = {};
    mockVisitHistory.filter((v) => v.status === 'completed').forEach((v) => {
      if (!barberUniqueClients[v.barberId]) barberUniqueClients[v.barberId] = new Set();
      barberUniqueClients[v.barberId].add(v.clientId);
    });

    // Also count from preferredBarber in client data
    const preferredCounts = {};
    enrichedClients.forEach((c) => {
      if (c.preferredBarber) {
        preferredCounts[c.preferredBarber] = (preferredCounts[c.preferredBarber] || 0) + 1;
      }
    });

    const rankedBarbers = mockBarbers
      .map((b) => ({
        ...b,
        visitCount: barberCounts[b.id] || 0,
        uniqueClients: barberUniqueClients[b.id] ? barberUniqueClients[b.id].size : 0,
        preferredBy: preferredCounts[b.id] || 0,
      }))
      .sort((a, b) => b.uniqueClients - a.uniqueClients || b.visitCount - a.visitCount)
      .slice(0, 10);

    const rows = rankedBarbers.map((b, i) => [
      `<strong>${i + 1}.</strong>`,
      `<strong>${b.name}</strong>`,
      b.specialty,
      b.uniqueClients.toString(),
      b.visitCount.toString(),
      b.preferredBy.toString(),
      `${b.rating}/5.0`,
      b.available ? '<span style="color:#22B07E">Si</span>' : '<span style="color:#E05252">No</span>',
    ]);

    const totalVisitsAll = rankedBarbers.reduce((s, b) => s + b.visitCount, 0);
    const leaderPct = totalVisitsAll > 0 ? Math.round((rankedBarbers[0].visitCount / totalVisitsAll) * 100) : 0;

    return {
      content: `💈 <strong>Ranking de profesionales por clientes atendidos:</strong>

${dataTableHTML(['#', 'Nombre', 'Especialidad', 'Clientes unicos', 'Visitas totales', 'Lo prefieren', 'Rating', 'Disponible'], rows)}

✅ <strong>${rankedBarbers[0].name}</strong> lidera con <strong>${rankedBarbers[0].uniqueClients} clientes unicos</strong> y <strong>${rankedBarbers[0].visitCount} visitas</strong> atendidas (el <strong>${leaderPct}%</strong> de todas las visitas). Su rating es <strong>${rankedBarbers[0].rating}/5.0</strong>.

${rankedBarbers[0].preferredBy > 0 ? `<strong>${rankedBarbers[0].preferredBy} clientes</strong> lo tienen como su barbero preferido.` : ''}

💡 <strong>Insight:</strong> Los profesionales con rating 5.0 tienen un 30% mas de retencion de clientes. Considera asignar clientes nuevos a los barberos mejor calificados para maximizar la fidelizacion.`,
      context: newContext,
    };
  }

  if (lower.includes('equipo') || (lower.includes('barbero') && !lower.includes('popular') && !lower.includes('mas')) || lower.includes('staff') || lower.includes('profesionales')) {
    const bySpecialty = {};
    mockBarbers.forEach((b) => {
      const cat = b.specialty.includes('Barbero') || b.specialty.includes('Barbera') ? 'Barberia' : b.specialty.includes('Estilista') ? 'Estilismo' : 'Manicure';
      if (!bySpecialty[cat]) bySpecialty[cat] = [];
      bySpecialty[cat].push(b);
    });

    let html = `<strong>Equipo de AlPelo (${mockBarbers.length} profesionales):</strong>\n\n`;

    for (const [cat, members] of Object.entries(bySpecialty)) {
      const rows = members.map((b) => [
        `<strong>${b.name}</strong>`,
        b.specialty,
        `${b.rating}/5.0`,
        `${b.totalClients} clientes`,
        b.available ? '<span style="color:#22B07E">Si</span>' : '<span style="color:#E05252">No</span>',
      ]);
      html += `<strong>${cat}:</strong>\n${dataTableHTML(['Nombre', 'Especialidad', 'Rating', 'Clientes', 'Disponible'], rows)}\n`;
    }

    return { content: html, context: newContext };
  }

  if (lower.includes('disponibilidad') || lower.includes('disponible hoy') || lower.includes('quien trabaja')) {
    const available = mockBarbers.filter((b) => b.available);
    const unavailable = mockBarbers.filter((b) => !b.available);

    const rows = available.map((b) => [
      `<strong>${b.name}</strong>`,
      b.specialty,
      `${b.rating}/5.0`,
    ]);

    return {
      content: `<strong>Disponibilidad del equipo hoy:</strong>

${metricsGridHTML([
  metricHTML('Disponibles', available.length.toString(), '#22B07E'),
  metricHTML('No disponibles', unavailable.length.toString(), '#E05252'),
])}

<strong>Disponibles:</strong>
${dataTableHTML(['Nombre', 'Especialidad', 'Rating'], rows)}

${unavailable.length > 0 ? `<strong>No disponibles hoy:</strong> ${unavailable.map((b) => b.name).join(', ')}` : ''}`,
      context: newContext,
    };
  }

  // ==========================================
  // 17. DEACTIVATE CLIENT (simulated action)
  // ==========================================
  if (lower.includes('desactiva') || lower.includes('desactivar')) {
    const client = extractClientName(message, enrichedClients);
    if (client) {
      newContext.lastClient = client;
      return {
        content: `${actionCardHTML(
          `Desactivar a ${client.name}?`,
          `Esta accion marcaria a <strong>${client.name}</strong> como inactivo en el sistema. Estado actual: ${statusBadge(client.status)}. Gasto historico: <strong>${formatCurrency(client.totalSpent)}</strong>.<br><br><em>Esta es una simulacion. En produccion se requeriria confirmacion y registro en el historial.</em>`,
          'danger'
        )}

<strong>Nota:</strong> La desactivacion manual es una accion irreversible que requiere autorizacion del administrador.`,
        context: newContext,
      };
    }
    return {
      content: 'No encontre un cliente con ese nombre. Prueba con: <strong>"Desactiva a [nombre del cliente]"</strong>',
      context: newContext,
    };
  }

  // ==========================================
  // 18. SEND MESSAGE TO NEW CLIENTS
  // ==========================================
  if ((lower.includes('envia') || lower.includes('enviar') || lower.includes('manda') || lower.includes('mandar')) && lower.includes('mensaje')) {
    const newClients = enrichedClients.filter((c) => c.status === 'nuevo');
    const target = lower.includes('nuevo') ? newClients : lower.includes('inactivo') ? enrichedClients.filter((c) => c.status === 'inactivo') : lower.includes('riesgo') ? enrichedClients.filter((c) => c.status === 'en_riesgo') : enrichedClients;
    const whatsappReady = target.filter((c) => c.acceptsWhatsApp);
    const statusLabel = lower.includes('nuevo') ? 'nuevos' : lower.includes('inactivo') ? 'inactivos' : lower.includes('riesgo') ? 'en riesgo' : 'todos';

    return {
      content: `${actionCardHTML(
        `Plantilla de mensaje para clientes ${statusLabel}`,
        `<div class="chat-ai__message-preview">
<strong>Vista previa del mensaje:</strong><br><br>
<em>"Hola [nombre]! Desde AlPelo Peluqueria queremos darte las gracias por tu visita. Tenemos un <strong>10% de descuento</strong> en tu proximo [servicio favorito] esperandote. Agenda tu cita aqui: book.weibook.co/alpelo-peluqueria"</em>
</div>`,
        'info'
      )}

<strong>Audiencia:</strong> ${target.length} clientes ${statusLabel} (${whatsappReady.length} disponibles por WhatsApp)

<strong>Clientes alcanzables:</strong> ${whatsappReady.map((c) => c.name).join(', ')}

<em>Simulacion: en produccion este mensaje se enviaria via WhatsApp Business API.</em>`,
      context: newContext,
    };
  }

  // ==========================================
  // 19. CAMPAIGN GENERATION
  // ==========================================
  if (lower.includes('campana') || lower.includes('reactivacion') || lower.includes('marketing') || lower.includes('promocion')) {
    const inactive = enrichedClients.filter((c) => c.status === 'inactivo');
    const atRisk = enrichedClients.filter((c) => c.status === 'en_riesgo');
    const totalTarget = inactive.length + atRisk.length;
    const whatsappReady = [...inactive, ...atRisk].filter((c) => c.acceptsWhatsApp).length;
    const potentialRevenue = Math.round(totalTarget * 0.25 * kpis.avgTicket);

    return {
      content: `📣 <strong>Campana de Reactivacion — "Te extraamos en AlPelo"</strong>

${metricsGridHTML([
  metricHTML('En riesgo', atRisk.length.toString(), '#D4A017'),
  metricHTML('Inactivos', inactive.length.toString(), '#E05252'),
  metricHTML('Total objetivo', totalTarget.toString(), '#1A1A1A'),
  metricHTML('Por WhatsApp', whatsappReady.toString(), '#22B07E'),
])}

<strong>Estrategia en 3 fases:</strong>

${actionCardHTML('Fase 1 — Dia 1', '<strong>Mensaje personalizado por WhatsApp:</strong><br>"Hola [nombre], te extraamos en AlPelo. Tenemos un <strong>15% de descuento</strong> en tu proximo [servicio favorito]. Valido esta semana!"', 'info')}

${actionCardHTML('Fase 2 — Dia 3', '<strong>Seguimiento visual:</strong><br>Enviar foto de un trabajo reciente del equipo con el mensaje: "Mira lo que hicimos hoy. Tu proximo look te espera."', 'info')}

${actionCardHTML('Fase 3 — Dia 7', '<strong>Oferta final con urgencia:</strong><br>"Ultimo dia para usar tu descuento exclusivo en AlPelo. No te lo pierdas, [nombre]!"', 'warning')}

<strong>ROI estimado:</strong> Si el 25% de los contactados regresan, se generarian aproximadamente <strong>${formatCurrency(potentialRevenue)}</strong> en ingresos adicionales.`,
      context: newContext,
    };
  }

  // ==========================================
  // 20. APPOINTMENT SCHEDULING (simulated)
  // ==========================================
  if (lower.includes('programa cita') || lower.includes('agendar cita') || lower.includes('nueva cita') || lower.includes('reservar')) {
    const client = extractClientName(message, enrichedClients);
    if (client) {
      newContext.lastClient = client;
      const barber = mockBarbers.find((b) => b.id === client.preferredBarber);
      const svc = mockServices.find((s) => s.name === client.favoriteService);

      return {
        content: `${actionCardHTML(
          `Programar cita para ${client.name}`,
          `<strong>Datos sugeridos:</strong><br>
<ul>
<li><strong>Cliente:</strong> ${client.name}</li>
<li><strong>Servicio:</strong> ${client.favoriteService} (${svc ? formatCurrency(svc.price) : 'N/A'})</li>
<li><strong>Profesional:</strong> ${barber ? barber.name : 'N/A'} ${barber && barber.available ? '(Disponible)' : '(No disponible)'}</li>
<li><strong>Duracion:</strong> ${svc ? svc.duration + ' min' : 'N/A'}</li>
</ul>
<em>Simulacion: en produccion se agendaria via la API de Weibook.</em>`,
          'info'
        )}

Puedes agendar directamente en: <strong>book.weibook.co/alpelo-peluqueria</strong>`,
        context: newContext,
      };
    }
    return {
      content: 'Indica el nombre del cliente. Ejemplo: <strong>"Programa cita para Carlos Mendoza"</strong>',
      context: newContext,
    };
  }

  // ==========================================
  // 21. RETENTION RATE
  // ==========================================
  if (lower.includes('retencion') || lower.includes('tasa de retencion')) {
    return {
      content: `<strong>Tasa de retencion de AlPelo:</strong>

${metricsGridHTML([
  metricHTML('Tasa de retencion', kpis.retentionRate + '%', '#2D5A3D'),
  metricHTML('Clientes activos', kpis.active.toString(), '#22B07E'),
  metricHTML('Total clientes', kpis.total.toString(), '#1A1A1A'),
])}

La tasa de retencion se calcula como el porcentaje de clientes activos (incluyendo VIPs y nuevos) sobre el total. Un <strong>${kpis.retentionRate}%</strong> es ${kpis.retentionRate >= 70 ? 'un buen indicador' : kpis.retentionRate >= 50 ? 'un indicador aceptable pero mejorable' : 'bajo y necesita atencion urgente'}.

<strong>Para mejorar:</strong>
<ul>
<li>Contactar a los ${kpis.atRisk} clientes en riesgo antes de que pasen a inactivos</li>
<li>Crear programa de fidelizacion con puntos canjeables</li>
<li>Implementar recordatorios automaticos de citas</li>
</ul>`,
      context: newContext,
    };
  }

  // ==========================================
  // 22. KPIs / GENERAL SUMMARY
  // ==========================================
  if (lower.includes('resumen') || lower.includes('kpi') || lower.includes('como va') || lower.includes('estado general') || lower.includes('estadistica') || lower.includes('dashboard') || lower.includes('resumen del negocio')) {
    // Current month revenue
    const monthVisits = mockVisitHistory.filter((v) => {
      const d = new Date(v.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && v.status === 'completed';
    });
    const monthRevenue = monthVisits.reduce((s, v) => s + v.amount, 0);

    // Best barber this month
    const monthBarberCounts = {};
    monthVisits.forEach((v) => { monthBarberCounts[v.barberId] = (monthBarberCounts[v.barberId] || 0) + 1; });
    const topBarberId = Object.entries(monthBarberCounts).sort((a, b) => b[1] - a[1])[0];
    const topBarber = topBarberId ? mockBarbers.find((b) => b.id === Number(topBarberId[0])) : null;

    return {
      content: `📊 <strong>Resumen general de AlPelo — ${MONTH_NAMES[currentMonth]} ${currentYear}:</strong>

<strong>👥 Clientes:</strong>
${metricsGridHTML([
  metricHTML('Total clientes', kpis.total.toString(), '#1A1A1A'),
  metricHTML('Activos', kpis.active.toString(), '#22B07E'),
  metricHTML('VIP', kpis.vip.toString(), '#A8873A'),
  metricHTML('Nuevos', kpis.nuevo.toString(), '#4B8FE0'),
  metricHTML('En riesgo', kpis.atRisk.toString(), '#D4A017'),
  metricHTML('Inactivos', kpis.inactive.toString(), '#E05252'),
])}

<strong>💰 Finanzas:</strong>
${metricsGridHTML([
  metricHTML('Ingresos del mes', formatCurrency(monthRevenue), '#2D5A3D'),
  metricHTML('Ticket promedio', formatCurrency(kpis.avgTicket), '#A8873A'),
  metricHTML('Retencion', kpis.retentionRate + '%', '#2D5A3D'),
  metricHTML('Ingresos totales', formatCurrency(kpis.totalRevenue), '#1A1A1A'),
])}

<strong>📋 Analisis y recomendaciones:</strong>
<ul>
<li>${kpis.retentionRate >= 70 ? '✅' : kpis.retentionRate >= 50 ? '⚠️' : '🔴'} Retencion del <strong>${kpis.retentionRate}%</strong> — ${kpis.retentionRate >= 70 ? 'buen nivel' : kpis.retentionRate >= 50 ? 'aceptable, con margen de mejora' : 'necesita atencion urgente'}</li>
${kpis.atRisk > 0 ? `<li>⚠️ <strong>${kpis.atRisk} clientes en riesgo</strong> necesitan contacto inmediato para evitar que se pierdan</li>` : '<li>✅ No hay clientes en riesgo actualmente</li>'}
${kpis.nuevo > 0 ? `<li>🆕 <strong>${kpis.nuevo} clientes nuevos</strong> requieren seguimiento para fidelizarlos</li>` : ''}
${topBarber ? `<li>💈 Barbero destacado del mes: <strong>${topBarber.name}</strong> con ${topBarberId[1]} visitas atendidas</li>` : ''}
<li>💰 Se han generado <strong>${formatCurrency(monthRevenue)}</strong> en ${MONTH_NAMES[currentMonth]} con <strong>${monthVisits.length} servicios</strong> completados</li>
</ul>`,
      context: newContext,
    };
  }

  // ==========================================
  // 23. VISIT TREND
  // ==========================================
  if (lower.includes('tendencia') || lower.includes('trend') || lower.includes('evolucion')) {
    const monthlyVisits = {};
    mockVisitHistory.filter((v) => v.status === 'completed').forEach((v) => {
      const d = new Date(v.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyVisits[key]) monthlyVisits[key] = { count: 0, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
      monthlyVisits[key].count++;
    });

    const sorted = Object.entries(monthlyVisits).sort((a, b) => a[0].localeCompare(b[0]));
    const rows = sorted.map(([, data]) => [
      data.label.charAt(0).toUpperCase() + data.label.slice(1),
      data.count.toString(),
      '|' + new Array(Math.round(data.count / 2)).fill('=').join('') + '|',
    ]);

    return {
      content: `<strong>Tendencia de visitas por mes:</strong>

${dataTableHTML(['Mes', 'Visitas', 'Grafico'], rows)}

${sorted.length >= 2 ? `La tendencia muestra ${sorted[sorted.length - 1][1].count > sorted[sorted.length - 2][1].count ? 'un <strong>crecimiento</strong>' : 'una <strong>disminucion</strong>'} en el ultimo mes comparado con el anterior.` : ''}`,
      context: newContext,
    };
  }

  // ==========================================
  // 23b. CLIENTS NOT VISITING > 1 MONTH (30+ days)
  // ==========================================
  if ((lower.includes('no vien') && lower.includes('mes')) || lower.includes('mas de un mes') || lower.includes('mas de 1 mes') || (lower.includes('hace') && lower.includes('mes') && (lower.includes('no') || lower.includes('sin'))) || (lower.includes('ausente') && lower.includes('mes'))) {
    const absentMonth = enrichedClients.filter((c) => c.daysSinceLastVisit > 30).sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);

    if (absentMonth.length === 0) {
      return { content: '✅ <strong>Excelente noticia!</strong> Todos los clientes han visitado en los ultimos 30 dias. La retencion esta funcionando de maravilla.', context: newContext };
    }

    const atRiskInGroup = absentMonth.filter((c) => c.status === 'en_riesgo');
    const inactiveInGroup = absentMonth.filter((c) => c.status === 'inactivo');
    const whatsappReady = absentMonth.filter((c) => c.acceptsWhatsApp);

    const absentRows = absentMonth.map((c) => [
      `<strong>${c.name}</strong>`,
      statusBadge(c.status),
      `${c.daysSinceLastVisit} dias`,
      formatDate(c.lastVisit),
      c.favoriteService,
      c.acceptsWhatsApp ? '✅' : '❌',
    ]);

    const lostRevenue = Math.round(absentMonth.reduce((s, c) => s + (c.avgTicket || Math.round(c.totalSpent / Math.max(c.totalVisits, 1))), 0));

    return {
      content: `📅 <strong>Clientes que no vienen hace mas de un mes (${absentMonth.length}):</strong>

${metricsGridHTML([
  metricHTML('Ausentes 30+ dias', absentMonth.length.toString(), '#E05252'),
  metricHTML('En riesgo', atRiskInGroup.length.toString(), '#D4A017'),
  metricHTML('Ya inactivos', inactiveInGroup.length.toString(), '#E05252'),
  metricHTML('Contactables (WA)', whatsappReady.length.toString(), '#22B07E'),
])}

${dataTableHTML(['Nombre', 'Estado', 'Sin visita', 'Ultima visita', 'Serv. favorito', 'WhatsApp'], absentRows)}

💡 <strong>Dato clave:</strong> Si estos clientes regresaran una vez, generarian aproximadamente <strong>${formatCurrency(lostRevenue)}</strong> en ingresos.

${actionCardHTML('📣 Accion recomendada', `Enviar un mensaje personalizado a los <strong>${whatsappReady.length} clientes contactables</strong> por WhatsApp con un descuento del 10-15% en su servicio favorito. Los clientes que llevan entre 30 y 60 dias sin visitar tienen un <strong>65% de probabilidad</strong> de regresar si se les contacta a tiempo.`, 'warning')}`,
      context: newContext,
    };
  }

  // ==========================================
  // 24. CLIENTS WHO DON'T RETURN (>60 days)
  // ==========================================
  if (lower.includes('no vuelven') || lower.includes('no regresan') || lower.includes('no han vuelto') || lower.includes('perdidos')) {
    const lost = enrichedClients.filter((c) => c.daysSinceLastVisit > 60).sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);

    if (lost.length === 0) {
      return { content: '<strong>Todos los clientes han visitado en los ultimos 60 dias.</strong> Excelente retencion!', context: newContext };
    }

    const rows = lost.map((c) => [
      `<strong>${c.name}</strong>`,
      `${c.daysSinceLastVisit} dias`,
      formatDate(c.lastVisit),
      c.favoriteService,
      c.acceptsWhatsApp ? 'Si' : 'No',
    ]);

    return {
      content: `<strong>Clientes que no regresan (+60 dias): ${lost.length}</strong>

${dataTableHTML(['Nombre', 'Sin visita', 'Ultima visita', 'Serv. favorito', 'WhatsApp'], rows)}

Estos clientes representan <strong>${formatCurrency(lost.reduce((s, c) => s + c.totalSpent, 0))}</strong> en ingresos historicos. Una campana de reactivacion podria recuperar una parte significativa.`,
      context: newContext,
    };
  }

  // ==========================================
  // 25. MESSAGE GENERATION
  // ==========================================
  if (lower.includes('genera mensaje') || lower.includes('generar mensaje') || lower.includes('crear mensaje') || lower.includes('plantilla') || lower.includes('template')) {
    if (lower.includes('cumple') || lower.includes('birthday') || lower.includes('nacimiento')) {
      return {
        content: `${actionCardHTML(
          'Plantilla de mensaje de cumpleanos',
          `<div class="chat-ai__message-preview">
<strong>Mensaje sugerido:</strong><br><br>
<em>"Feliz cumpleanos, [nombre]! En AlPelo Peluqueria queremos celebrar contigo. Te regalamos un <strong>20% de descuento</strong> en cualquier servicio esta semana. Porque los reyes tambien merecen consentirse en su dia. Reserva aqui: book.weibook.co/alpelo-peluqueria"</em>
</div>`,
          'info'
        )}

<strong>Personalizacion:</strong> Cada mensaje incluiria automaticamente el nombre del cliente y su servicio favorito para mayor impacto.`,
        context: newContext,
      };
    }

    if (lower.includes('reactivacion') || lower.includes('inactivo')) {
      const client = extractClientName(message, enrichedClients);
      const name = client ? client.name : '[nombre]';
      const svc = client ? client.favoriteService : '[servicio favorito]';

      return {
        content: `${actionCardHTML(
          `Mensaje de reactivacion${client ? ` para ${name}` : ''}`,
          `<div class="chat-ai__message-preview">
<strong>Mensaje sugerido:</strong><br><br>
<em>"Hola ${name}! Te extraamos en AlPelo. Sabemos que tu ${svc} siempre queda espectacular con nosotros. Tenemos un <strong>15% de descuento exclusivo</strong> esperandote. Solo por esta semana. Reserva tu cita: book.weibook.co/alpelo-peluqueria"</em>
</div>`,
          'warning'
        )}`,
        context: newContext,
      };
    }

    if (lower.includes('bienvenida') || lower.includes('welcome')) {
      return {
        content: `${actionCardHTML(
          'Plantilla de mensaje de bienvenida',
          `<div class="chat-ai__message-preview">
<strong>Mensaje sugerido:</strong><br><br>
<em>"Hola [nombre]! Gracias por visitarnos en AlPelo Peluqueria. Fue un placer atenderte. Queremos que siempre te sientas como en casa. Para tu proxima visita, te damos un <strong>10% de descuento</strong>. Agenda cuando quieras: book.weibook.co/alpelo-peluqueria. Te esperamos!"</em>
</div>`,
          'info'
        )}

<strong>Tip:</strong> Enviar este mensaje dentro de las 24 horas posteriores a la primera visita aumenta un 60% la probabilidad de retorno.`,
        context: newContext,
      };
    }
  }

  // ==========================================
  // 26. APPOINTMENTS TODAY / UPCOMING
  // ==========================================
  if (lower.includes('cita') && (lower.includes('hoy') || lower.includes('agenda') || lower.includes('pendiente') || lower.includes('proxima'))) {
    const today = now.toISOString().split('T')[0];
    const todayAppts = mockAppointments.filter((a) => a.date === today);
    const allAppts = [...mockAppointments].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    const appts = todayAppts.length > 0 ? todayAppts : allAppts;
    const title = todayAppts.length > 0 ? 'Citas de hoy' : 'Proximas citas programadas';

    const rows = appts.map((a) => {
      const client = mockClients.find((c) => c.id === a.clientId);
      const barber = mockBarbers.find((b) => b.id === a.barberId);
      const statusColor = a.status === 'confirmed' ? '#22B07E' : '#D4A017';
      const statusLabel = a.status === 'confirmed' ? 'Confirmada' : 'Pendiente';
      return [
        a.date === today ? a.time : `${a.date} ${a.time}`,
        `<strong>${client ? client.name : 'N/A'}</strong>`,
        barber ? barber.name : 'N/A',
        a.service,
        `<span style="color:${statusColor}">${statusLabel}</span>`,
      ];
    });

    return {
      content: `<strong>${title} (${appts.length}):</strong>

${dataTableHTML(['Hora', 'Cliente', 'Profesional', 'Servicio', 'Estado'], rows)}

${appts.filter((a) => a.status === 'pending').length > 0 ? `<strong>Atencion:</strong> Hay <strong>${appts.filter((a) => a.status === 'pending').length} citas pendientes</strong> de confirmacion.` : 'Todas las citas estan confirmadas.'}`,
      context: newContext,
    };
  }

  // ==========================================
  // 27. CONTEXTUAL CLIENT QUERY (uses conversation context)
  // ==========================================
  if (contextClient) {
    // Follow-up: "cuanto gasto?" / "y cuanto gasto?"
    if (lower.includes('cuanto gasto') || lower.includes('cuanto ha gastado') || lower.includes('gasto total') || (lower.includes('gasto') && lower.length < 30)) {
      const ctxVisits = mockVisitHistory.filter((v) => v.clientId === contextClient.id && v.status === 'completed');
      const ctxAvgRating = ctxVisits.filter((v) => v.rating).reduce((s, v, _, a) => s + v.rating / a.length, 0);

      return {
        content: `💰 <strong>Resumen de gasto de ${contextClient.name}:</strong>

${metricsGridHTML([
  metricHTML('Gasto total', formatCurrency(contextClient.totalSpent), '#1A1A1A'),
  metricHTML('Visitas', contextClient.totalVisits.toString(), '#2D5A3D'),
  metricHTML('Ticket promedio', formatCurrency(contextClient.avgTicket || Math.round(contextClient.totalSpent / contextClient.totalVisits)), '#A8873A'),
  metricHTML('Rating prom.', ctxAvgRating > 0 ? ctxAvgRating.toFixed(1) + '/5' : 'N/A', '#D4A017'),
])}

Servicio mas frecuente: <strong>${contextClient.favoriteService}</strong>. Cliente desde <strong>${formatDate(contextClient.firstVisit)}</strong>.`,
        context: newContext,
      };
    }

    // Follow-up: "cuando fue su ultima visita?"
    if (lower.includes('ultima visita') || lower.includes('cuando vino') || lower.includes('cuando fue')) {
      return {
        content: `📅 La ultima visita de <strong>${contextClient.name}</strong> fue el <strong>${formatDate(contextClient.lastVisit)}</strong>, hace <strong>${contextClient.daysSinceLastVisit ?? daysSince(contextClient.lastVisit)} dias</strong>.

Estado actual: ${statusBadge(contextClient.status)}`,
        context: newContext,
      };
    }

    // Follow-up: "que servicio pide?" / "que le gusta?"
    if (lower.includes('servicio pide') || lower.includes('que le gusta') || lower.includes('que pide') || lower.includes('preferencia') || lower.includes('servicio favorito')) {
      const ctxBarber = mockBarbers.find((b) => b.id === contextClient.preferredBarber);
      return {
        content: `✂️ <strong>Preferencias de ${contextClient.name}:</strong>
<ul>
<li><strong>Servicio favorito:</strong> ${contextClient.favoriteService}</li>
<li><strong>Barbero preferido:</strong> ${ctxBarber ? ctxBarber.name : 'N/A'}</li>
${contextClient.haircutStyleNotes ? `<li><strong>Estilo de corte:</strong> ${contextClient.haircutStyleNotes}</li>` : ''}
${contextClient.beardStyleNotes ? `<li><strong>Estilo de barba:</strong> ${contextClient.beardStyleNotes}</li>` : ''}
${contextClient.notes ? `<li><strong>Notas:</strong> ${contextClient.notes}</li>` : ''}
</ul>`,
        context: newContext,
      };
    }

    // Follow-up: "su telefono?" / "contacto?"
    if (lower.includes('telefono') || lower.includes('contacto') || lower.includes('como lo contacto') || lower.includes('numero')) {
      return {
        content: `📱 <strong>Contacto de ${contextClient.name}:</strong>
<ul>
<li><strong>Telefono:</strong> ${contextClient.phone}</li>
${contextClient.email ? `<li><strong>Email:</strong> ${contextClient.email}</li>` : ''}
<li><strong>WhatsApp:</strong> ${contextClient.acceptsWhatsApp ? '✅ Acepta mensajes' : '❌ No acepta mensajes'}</li>
</ul>`,
        context: newContext,
      };
    }

    // General reference to previous client
    if (lower.includes('ese') || lower.includes('el mismo') || lower.includes('ella') || lower.includes('su perfil') || lower.includes('mas info') || lower.includes('mas sobre')) {
      return {
        content: `<strong>Perfil completo de ${contextClient.name}:</strong>

${clientProfileHTML(contextClient)}`,
        context: newContext,
      };
    }
  }

  // ==========================================
  // 28. DIRECT CLIENT NAME LOOKUP (last resort before default)
  // ==========================================
  const possibleClient = extractClientName(message, enrichedClients);
  if (possibleClient) {
    newContext.lastClient = possibleClient;
    return {
      content: `<strong>Perfil de ${possibleClient.name}:</strong>

${clientProfileHTML(possibleClient)}`,
      context: newContext,
    };
  }

  // ==========================================
  // DEFAULT RESPONSE
  // ==========================================
  return {
    content: `No estoy seguro de como responder a eso, pero como asistente de AlPelo puedo ayudarte con muchas cosas. Aqui tienes una guia rapida:

<div class="chat-ai__help-grid">
  <div class="chat-ai__help-item">
    <strong>👥 Clientes</strong>
    <span>VIPs, en riesgo, inactivos, perfiles por nombre, busqueda por letra, fuente de adquisicion, WhatsApp</span>
  </div>
  <div class="chat-ai__help-item">
    <strong>💰 Finanzas</strong>
    <span>Ingresos del mes, ticket promedio, mejor/peor mes, desglose por servicio</span>
  </div>
  <div class="chat-ai__help-item">
    <strong>💈 Equipo</strong>
    <span>Ranking de barberos, clientes por barbero, disponibilidad, especialidades</span>
  </div>
  <div class="chat-ai__help-item">
    <strong>✂️ Servicios</strong>
    <span>Catalogo y precios, mas solicitados, ingresos por servicio</span>
  </div>
  <div class="chat-ai__help-item">
    <strong>🎂 Cumpleanos</strong>
    <span>Hoy, este mes, proximos, por mes especifico</span>
  </div>
  <div class="chat-ai__help-item">
    <strong>📣 Acciones</strong>
    <span>Campanas de reactivacion, mensajes, agendar citas</span>
  </div>
</div>

<strong>Algunas ideas para empezar:</strong>
<ul>
<li>"Quienes son mis clientes VIP?"</li>
<li>"Info de Carlos Mendoza" (y luego pregunta "cuanto gasto?" como seguimiento)</li>
<li>"Que clientes no vienen hace mas de un mes?"</li>
<li>"Resumen del negocio"</li>
</ul>`,
    context: newContext,
  };
};

// ============================================
// MAIN COMPONENT
// ============================================

const QUICK_CHIPS = [
  { icon: '👑', text: '¿Quiénes son mis clientes VIP?' },
  { icon: '⚠️', text: '¿Cuántos clientes están en riesgo?' },
  { icon: '💰', text: '¿Cuál es mi ticket promedio?' },
  { icon: '📅', text: '¿Qué clientes no vienen hace más de un mes?' },
  { icon: '📊', text: 'Resumen del negocio' },
  { icon: '💈', text: '¿Cuál barbero tiene más clientes?' },
];

const ChatAI = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversationContext, setConversationContext] = useState({ lastClient: null });
  const [queryHistory, setQueryHistory] = useState([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  const enrichedClients = useMemo(() => enrichClients(mockClients, mockVisitHistory), []);
  const kpis = useMemo(() => computeKPIs(enrichedClients), [enrichedClients]);

  const atRiskCount = useMemo(
    () => enrichedClients.filter((c) => c.status === 'en_riesgo').length,
    [enrichedClients]
  );

  const vipCount = useMemo(
    () => enrichedClients.filter((c) => c.status === 'vip').length,
    [enrichedClients]
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Track scroll position to show/hide scroll-to-bottom button
  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 120);
  }, []);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [inputValue, autoResize]);

  const sendMessage = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const userMsg = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
      setIsTyping(true);

      // Add to history
      setQueryHistory((prev) => {
        const newHistory = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 10);
        return newHistory;
      });

      // Variable delay based on response complexity
      const lower = trimmed.toLowerCase();
      const isComplex = lower.includes('resumen') || lower.includes('campana') || lower.includes('kpi') || lower.includes('ranking');
      const delay = isComplex ? 1500 + Math.random() * 1000 : 800 + Math.random() * 700;

      setTimeout(() => {
        const result = generateAIResponse(trimmed, enrichedClients, kpis, conversationContext);
        const aiMsg = {
          id: generateId(),
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setConversationContext(result.context);
        setIsTyping(false);
      }, delay);
    },
    [isTyping, enrichedClients, kpis, conversationContext]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handlePromptClick = (promptText) => {
    sendMessage(promptText);
  };

  const formatTimestamp = (date) => {
    return new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const clearChat = () => {
    setMessages([]);
    setConversationContext({ lastClient: null });
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="chat-ai">
      <div className="chat-ai__header">
        <div className="chat-ai__header-left">
          <div className="chat-ai__header-title-row">
            <div className="chat-ai__header-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <line x1="10" y1="22" x2="14" y2="22" />
              </svg>
            </div>
            <div>
              <h2 className="chat-ai__title">Asistente AlPelo</h2>
              <p className="chat-ai__subtitle">
                <span className="chat-ai__status-dot" />
                En linea
              </p>
            </div>
          </div>
        </div>
        <div className="chat-ai__header-actions">
          {hasMessages && (
            <button
              className="chat-ai__clear-btn"
              onClick={clearChat}
              aria-label="Limpiar chat"
              title="Limpiar chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
          <button
            className={`chat-ai__sidebar-toggle ${sidebarOpen ? 'chat-ai__sidebar-toggle--active' : ''}`}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-ai__body">
        <div className="chat-ai__main">
          <div className="chat-ai__messages-fade-top" />
          <div
            className="chat-ai__messages"
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
          >
            {!hasMessages && (
              <div className="chat-ai__welcome">
                <div className="chat-ai__welcome-glow" />
                <div className="chat-ai__welcome-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                    <line x1="10" y1="22" x2="14" y2="22" />
                    <line x1="9" y1="9" x2="15" y2="9" />
                    <line x1="12" y1="6" x2="12" y2="12" />
                  </svg>
                </div>
                <h3 className="chat-ai__welcome-title">¿En que puedo ayudarte hoy?</h3>
                <p className="chat-ai__welcome-text">
                  Conozco a todos tus clientes, sus preferencias y el estado de tu negocio. Preguntame lo que necesites.
                </p>
                <div className="chat-ai__prompts">
                  {SUGGESTED_PROMPTS.map((prompt, index) => (
                    <button
                      key={index}
                      className="chat-ai__prompt-card"
                      onClick={() => handlePromptClick(prompt.text)}
                      style={{ animationDelay: `${0.1 + index * 0.08}s` }}
                    >
                      <span className="chat-ai__prompt-icon">{prompt.icon}</span>
                      <div className="chat-ai__prompt-content">
                        <span className="chat-ai__prompt-text">{prompt.text}</span>
                        <span className="chat-ai__prompt-desc">{prompt.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-ai__message chat-ai__message--${msg.role}`}
              >
                {msg.role === 'assistant' && (
                  <div className="chat-ai__avatar chat-ai__avatar--ai">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                      <line x1="10" y1="22" x2="14" y2="22" />
                    </svg>
                  </div>
                )}
                <div className="chat-ai__bubble-wrapper">
                  <div
                    className={`chat-ai__bubble chat-ai__bubble--${msg.role}`}
                    dangerouslySetInnerHTML={{ __html: msg.content }}
                  />
                  <span className="chat-ai__timestamp">{formatTimestamp(msg.timestamp)}</span>
                </div>
                {msg.role === 'user' && (
                  <div className="chat-ai__avatar chat-ai__avatar--user">
                    AD
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="chat-ai__message chat-ai__message--assistant">
                <div className="chat-ai__avatar chat-ai__avatar--ai">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                    <line x1="10" y1="22" x2="14" y2="22" />
                  </svg>
                </div>
                <div className="chat-ai__bubble chat-ai__bubble--assistant chat-ai__bubble--typing">
                  <div className="chat-ai__typing-dots">
                    <span className="chat-ai__typing-dot" />
                    <span className="chat-ai__typing-dot" />
                    <span className="chat-ai__typing-dot" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {showScrollBtn && hasMessages && (
            <button className="chat-ai__scroll-bottom" onClick={scrollToBottom} aria-label="Ir al final">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          )}

          <form className="chat-ai__input-area" onSubmit={handleSubmit}>
            {hasMessages && !isTyping && (
              <div className="chat-ai__chips">
                {QUICK_CHIPS.map((chip, i) => (
                  <button key={i} type="button" className="chat-ai__chip" onClick={() => handlePromptClick(chip.text)} style={{ animationDelay: `${i * 0.05}s` }}>
                    <span className="chat-ai__chip-icon">{chip.icon}</span>
                    <span className="chat-ai__chip-text">{chip.text}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="chat-ai__input-wrapper">
              <button type="button" className="chat-ai__attach-btn" aria-label="Adjuntar archivo" title="Adjuntar archivo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              </button>
              <textarea
                ref={textareaRef}
                className="chat-ai__input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta algo sobre tu negocio..."
                rows={1}
                disabled={isTyping}
              />
              <button
                type="submit"
                className={`chat-ai__send-btn ${inputValue.trim() ? 'chat-ai__send-btn--active' : ''}`}
                disabled={!inputValue.trim() || isTyping}
                aria-label="Enviar mensaje"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="chat-ai__input-hint">
              <kbd>Enter</kbd> para enviar &middot; <kbd>Shift+Enter</kbd> para nueva linea
            </p>
          </form>
        </div>

        {sidebarOpen && (
          <aside className="chat-ai__sidebar">
            <div className="chat-ai__sidebar-section">
              <h4 className="chat-ai__sidebar-title">Resumen rapido</h4>
              <div className="chat-ai__stats">
                <div className="chat-ai__stat">
                  <span className="chat-ai__stat-value">{kpis.total}</span>
                  <span className="chat-ai__stat-label">Clientes totales</span>
                </div>
                <div className="chat-ai__stat">
                  <span className="chat-ai__stat-value chat-ai__stat-value--success">{kpis.active}</span>
                  <span className="chat-ai__stat-label">Activos</span>
                </div>
                <div className="chat-ai__stat">
                  <span className="chat-ai__stat-value chat-ai__stat-value--warning">{atRiskCount}</span>
                  <span className="chat-ai__stat-label">En riesgo</span>
                </div>
                <div className="chat-ai__stat">
                  <span className="chat-ai__stat-value chat-ai__stat-value--accent">{vipCount}</span>
                  <span className="chat-ai__stat-label">VIP</span>
                </div>
              </div>
            </div>

            <div className="chat-ai__sidebar-section">
              <h4 className="chat-ai__sidebar-title">Retencion</h4>
              <div className="chat-ai__retention">
                <div className="chat-ai__retention-bar">
                  <div
                    className="chat-ai__retention-fill"
                    style={{ width: `${kpis.retentionRate}%` }}
                  />
                </div>
                <span className="chat-ai__retention-label">
                  {kpis.retentionRate}% tasa de retencion
                </span>
              </div>
            </div>

            <div className="chat-ai__sidebar-section">
              <h4 className="chat-ai__sidebar-title">Temas sugeridos</h4>
              <div className="chat-ai__topics">
                <button className="chat-ai__topic" onClick={() => handlePromptClick('Resumen del negocio')}>
                  📊 Resumen del negocio
                </button>
                <button className="chat-ai__topic" onClick={() => handlePromptClick('¿Quiénes son mis clientes VIP?')}>
                  👑 Clientes VIP
                </button>
                <button className="chat-ai__topic" onClick={() => handlePromptClick('¿Cuántos clientes están en riesgo?')}>
                  ⚠️ Clientes en riesgo
                </button>
                <button className="chat-ai__topic" onClick={() => handlePromptClick('¿Qué clientes no vienen hace más de un mes?')}>
                  📅 Ausentes +30 dias
                </button>
                <button className="chat-ai__topic" onClick={() => handlePromptClick('¿Cuál es mi ticket promedio?')}>
                  💰 Ticket promedio
                </button>
                <button className="chat-ai__topic" onClick={() => handlePromptClick('¿Cuál barbero tiene más clientes?')}>
                  💈 Ranking barberos
                </button>
                <button className="chat-ai__topic" onClick={() => handlePromptClick('Genera campaña de reactivación')}>
                  📣 Campana de reactivacion
                </button>
                <button className="chat-ai__topic" onClick={() => handlePromptClick('¿Quiénes cumplen años este mes?')}>
                  🎂 Cumpleanos del mes
                </button>
              </div>
            </div>

            {queryHistory.length > 0 && (
              <div className="chat-ai__sidebar-section">
                <h4 className="chat-ai__sidebar-title">Consultas recientes</h4>
                <div className="chat-ai__history">
                  {queryHistory.map((q, i) => (
                    <button
                      key={i}
                      className="chat-ai__history-item"
                      onClick={() => handlePromptClick(q)}
                      title={q}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{q.length > 35 ? q.slice(0, 35) + '...' : q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};

export default ChatAI;
