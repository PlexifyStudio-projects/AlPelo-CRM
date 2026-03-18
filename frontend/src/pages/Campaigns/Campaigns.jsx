import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../context/NotificationContext';
import EmptyState from '../../components/common/EmptyState/EmptyState';
import clientService from '../../services/clientService';
import whatsappService from '../../services/whatsappService';
import templateService from '../../services/templateService';

// Category display metadata (static — just names and colors)
const templateCategories = [
  { id: 'post_servicio', name: 'Post-Servicio', color: '#34D399' },
  { id: 'reactivacion', name: 'Reactivacion', color: '#FBBF24' },
  { id: 'recordatorio', name: 'Recordatorio', color: '#60A5FA' },
  { id: 'promocion', name: 'Promocion', color: '#8B5CF6' },
  { id: 'fidelizacion', name: 'Fidelizacion', color: '#EC4899' },
  { id: 'bienvenida', name: 'Bienvenida', color: '#22B07E' },
];

const B = 'campaigns';
const A = 'automations';

// ═══════════════════════════════════════════════
// SVG Icons
// ═══════════════════════════════════════════════
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const PlayIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>;
const PauseIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const UsersIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const TargetIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
const SendIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const WhatsAppIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
const ChartIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const ZapIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const MegaphoneIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const SaveIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>;

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════
// (Automations moved to dedicated Automations page)
const CAMPAIGN_TYPES = [
  { id: 'recovery', label: 'Recuperación', desc: 'Clientes inactivos (+30 dias)', color: '#FBBF24', icon: '🔄' },
  { id: 'vip', label: 'VIP', desc: 'Clientes VIP y frecuentes', color: '#8B5CF6', icon: '⭐' },
  { id: 'reactivation', label: 'Reactivación', desc: 'En riesgo de perderse', color: '#F87171', icon: '🔥' },
  { id: 'promo', label: 'Promoción', desc: 'Ofertas y descuentos', color: '#34D399', icon: '🎯' },
  { id: 'followup', label: 'Seguimiento', desc: 'Post-servicio y feedback', color: '#60A5FA', icon: '💬' },
];

const getDays = (c) => c.days_since_last_visit ?? c.days_since_visit ?? null;

const SEGMENT_FILTERS = [
  { id: 'inactive_30', label: '+30 días sin venir', filter: c => { const d = getDays(c); return d !== null && d >= 30; } },
  { id: 'inactive_60', label: '+60 días sin venir', filter: c => { const d = getDays(c); return d !== null && d >= 60; } },
  { id: 'inactive_90', label: '+90 días sin venir', filter: c => { const d = getDays(c); return d !== null && d >= 90; } },
  { id: 'vip', label: 'Clientes VIP', filter: c => c.status === 'vip' },
  { id: 'at_risk', label: 'En riesgo', filter: c => c.status === 'at_risk' || c.status === 'en_riesgo' },
  { id: 'inactive_all', label: 'Inactivos', filter: c => c.status === 'inactivo' || c.status === 'inactive' },
  { id: 'active', label: 'Activos', filter: c => c.status === 'active' || c.status === 'activo' },
  { id: 'new', label: 'Nuevos', filter: c => c.status === 'new' || c.status === 'nuevo' },
  { id: 'high_value', label: 'Alto valor (+$500k)', filter: c => (c.total_spent || 0) >= 500000 },
  { id: 'frequent', label: 'Frecuentes (+10 visitas)', filter: c => (c.total_visits || 0) >= 10 },
  { id: 'all', label: 'Todos los clientes', filter: () => true },
];

const STATUS_META = {
  draft: { label: 'Borrador', color: '#8E8E85' },
  active: { label: 'Activa', color: '#34D399' },
  paused: { label: 'Pausada', color: '#FBBF24' },
  completed: { label: 'Completada', color: '#60A5FA' },
};

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════
const getInitials = (name) => {
  const parts = (name || '').split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0] || '?').substring(0, 2).toUpperCase();
};

const getCategoryMeta = (categoryId) => {
  const cat = templateCategories.find(c => c.id === categoryId);
  return cat || { name: categoryId, color: '#6B6B63' };
};

const SAMPLE_VARS = {
  nombre: (c) => (c?.name || 'Cliente').split(' ')[0],
  servicio: (c) => c?.favorite_service || c?.favoriteService || 'tu servicio',
  dias: (c) => String(c?.days_since_visit || c?.days_since_last_visit || ''),
  visitas: (c) => String(c?.total_visits || 0),
  puntos: (c) => String(c?.loyaltyPoints || 0),
  profesional: () => 'Anderson',
  barbero: () => 'Anderson', // kept for backward compatibility with existing templates
  hora: () => '10:00 AM',
  fecha: () => '10 de marzo',
  dia: () => 'lunes',
  meses: () => '6',
  precio: () => '$45.000',
  producto: () => 'Producto Premium',
};

const resolveTemplate = (body, client) => {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const resolver = SAMPLE_VARS[key];
    return resolver ? resolver(client) : `{{${key}}}`;
  });
};

// ═══════════════════════════════════════════════
// Local storage for campaigns (no backend yet)
// ═══════════════════════════════════════════════
const STORAGE_KEY = 'alpelo_campaigns';
const loadCampaigns = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
};
const saveCampaigns = (campaigns) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
};

// Pre-built campaign suggestions (shown when no campaigns exist)
const SUGGESTED_CAMPAIGNS = [
  {
    name: 'Recuperar clientes +30 dias',
    type: 'recovery',
    segment: 'inactive_30',
    desc: 'Contactar clientes que llevan +30 dias sin venir',
    priority: 'alta',
  },
  {
    name: 'Rescate urgente +60 dias',
    type: 'reactivation',
    segment: 'inactive_60',
    desc: 'Clientes que casi perdemos — descuento agresivo para que vuelvan',
    priority: 'urgente',
  },
  {
    name: 'Fidelizacion VIP',
    type: 'vip',
    segment: 'vip',
    desc: 'Mantener contentos a los mejores clientes con seguimiento personalizado',
    priority: 'media',
  },
  {
    name: 'Promo de la semana',
    type: 'promo',
    segment: 'active',
    desc: 'Promocion semanal para clientes activos con descuento en servicios',
    priority: 'media',
  },
  {
    name: 'Clientes casi perdidos +90 dias',
    type: 'reactivation',
    segment: 'inactive_90',
    desc: 'Ultimo intento con clientes que llevan 3 meses sin venir',
    priority: 'urgente',
  },
];

// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════
const Campaigns = () => {
  const { addNotification } = useNotification();

  // Data
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState(loadCampaigns);

  // UI
  const [showCreate, setShowCreate] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [showDetail, setShowDetail] = useState(null); // campaign id
  const [filter, setFilter] = useState('all'); // all, active, draft, completed
  const [search, setSearch] = useState('');

  // Create/Edit form
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('recovery');
  const [formSegment, setFormSegment] = useState('inactive_30');
  const [formTemplate, setFormTemplate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Execution
  const [executing, setExecuting] = useState(null); // campaign id
  const [execProgress, setExecProgress] = useState({ sent: 0, failed: 0, total: 0 });

  const [templates, setTemplates] = useState([]);

  // Load clients + templates from API
  useEffect(() => {
    const load = async () => {
      try {
        const [clientData, templateData] = await Promise.all([
          clientService.list({}),
          templateService.getTemplates(),
        ]);
        setClients(Array.isArray(clientData) ? clientData : []);
        setTemplates(Array.isArray(templateData) ? templateData : []);
      } catch { setClients([]); setTemplates([]); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Persist campaigns
  useEffect(() => { saveCampaigns(campaigns); }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    let list = [...campaigns];
    if (filter !== 'all') list = list.filter(c => c.status === filter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(s));
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [campaigns, filter, search]);

  const getSegmentClients = useCallback((segId) => {
    const seg = SEGMENT_FILTERS.find(s => s.id === segId);
    if (!seg) return [];
    return clients.filter(c => c.phone && seg.filter(c));
  }, [clients]);

  // Quick stats
  const stats = useMemo(() => {
    const active = campaigns.filter(c => c.status === 'active').length;
    const totalSent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
    const totalResponded = campaigns.reduce((acc, c) => acc + (c.respondedCount || 0), 0);
    const withPhone = clients.filter(c => c.phone);
    const inactive30 = withPhone.filter(c => { const d = getDays(c); return d !== null && d >= 30; }).length;
    const inactive60 = withPhone.filter(c => { const d = getDays(c); return d !== null && d >= 60; }).length;
    const inactive90 = withPhone.filter(c => { const d = getDays(c); return d !== null && d >= 90; }).length;
    const vips = withPhone.filter(c => c.status === 'vip').length;
    const atRisk = withPhone.filter(c => c.status === 'at_risk' || c.status === 'en_riesgo').length;
    return { active, totalSent, totalResponded, inactive30, inactive60, inactive90, vips, atRisk, total: withPhone.length };
  }, [campaigns, clients]);

  // Create campaign from suggestion
  const createFromSuggestion = (suggestion) => {
    const tpl = templates.find(t => t.id === suggestion.templateId);
    const typeObj = CAMPAIGN_TYPES.find(t => t.id === suggestion.type);
    const segClients = getSegmentClients(suggestion.segment);

    const newCampaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: suggestion.name,
      type: suggestion.type,
      segment: suggestion.segment,
      templateId: suggestion.templateId,
      templateName: tpl?.name || '',
      templateBody: tpl?.body || '',
      notes: suggestion.desc,
      typeLabel: typeObj?.label || '',
      typeColor: typeObj?.color || '#6B6B63',
      status: 'draft',
      clientCount: segClients.length,
      sentCount: 0,
      respondedCount: 0,
      sentClients: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCampaigns(prev => [newCampaign, ...prev]);
    addNotification(`Campaña "${suggestion.name}" creada. Revísala y ejecútala.`, 'success');
  };

  // ─── Actions ──────────────────────────────────
  const openCreate = () => {
    setEditingCampaign(null);
    setFormName('');
    setFormType('recovery');
    setFormSegment('inactive_30');
    setFormTemplate('');
    setFormNotes('');
    setShowCreate(true);
  };

  const openEdit = (campaign) => {
    setEditingCampaign(campaign);
    setFormName(campaign.name);
    setFormType(campaign.type);
    setFormSegment(campaign.segment);
    setFormTemplate(campaign.templateId);
    setFormNotes(campaign.notes || '');
    setShowCreate(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { addNotification('Dale un nombre a la campaña', 'error'); return; }
    if (!formTemplate) { addNotification('Selecciona una plantilla', 'error'); return; }

    const segClients = getSegmentClients(formSegment);
    const tpl = templates.find(t => t.id === formTemplate);
    const typeObj = CAMPAIGN_TYPES.find(t => t.id === formType);

    if (editingCampaign) {
      setCampaigns(prev => prev.map(c => c.id === editingCampaign.id ? {
        ...c,
        name: formName.trim(),
        type: formType,
        segment: formSegment,
        templateId: formTemplate,
        templateName: tpl?.name || '',
        templateBody: tpl?.body || '',
        notes: formNotes,
        typeLabel: typeObj?.label || '',
        typeColor: typeObj?.color || '#6B6B63',
        clientCount: segClients.length,
        updatedAt: new Date().toISOString(),
      } : c));
      addNotification('Campaña actualizada', 'success');
    } else {
      const newCampaign = {
        id: `camp_${Date.now()}`,
        name: formName.trim(),
        type: formType,
        segment: formSegment,
        templateId: formTemplate,
        templateName: tpl?.name || '',
        templateBody: tpl?.body || '',
        notes: formNotes,
        typeLabel: typeObj?.label || '',
        typeColor: typeObj?.color || '#6B6B63',
        status: 'draft',
        clientCount: segClients.length,
        sentCount: 0,
        respondedCount: 0,
        sentClients: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCampaigns(prev => [newCampaign, ...prev]);
      addNotification('Campaña creada. Revísala y ejecútala cuando estés listo.', 'success');
    }
    setShowCreate(false);
  };

  const deleteCampaign = (id) => {
    if (!window.confirm('¿Eliminar esta campaña? Esta acción no se puede deshacer.')) return;
    setCampaigns(prev => prev.filter(c => c.id !== id));
    setShowDetail(null);
    addNotification('Campaña eliminada', 'info');
  };

  const togglePause = (id) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id !== id) return c;
      const next = c.status === 'active' ? 'paused' : c.status === 'paused' ? 'active' : c.status;
      return { ...c, status: next };
    }));
  };

  // ─── Execute campaign ─────────────────────────
  const executeCampaign = async (campaign) => {
    const segClients = getSegmentClients(campaign.segment);
    const unsent = segClients.filter(c => !(campaign.sentClients || []).includes(c.id));

    if (unsent.length === 0) {
      addNotification('Ya se contacto a todos los clientes de esta campaña', 'info');
      return;
    }

    setExecuting(campaign.id);
    setExecProgress({ sent: 0, failed: 0, total: unsent.length });

    // Mark as active
    setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: 'active' } : c));

    let sent = 0;
    let failed = 0;
    const sentIds = [...(campaign.sentClients || [])];

    for (const client of unsent) {
      try {
        const resolvedText = resolveTemplate(campaign.templateBody, client);

        // Create or get conversation, then send
        const conv = await whatsappService.createConversation(client.phone, client.name);
        await whatsappService.sendMessage(conv.id, resolvedText);

        sent++;
        sentIds.push(client.id);
      } catch (err) {
        console.error(`Campaign send failed for ${client.name}:`, err);
        failed++;
      }

      setExecProgress({ sent, failed, total: unsent.length });

      // Natural delay between messages (3-6 seconds)
      if (sent + failed < unsent.length) {
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
      }
    }

    // Update campaign
    setCampaigns(prev => prev.map(c => {
      if (c.id !== campaign.id) return c;
      const allSent = sentIds.length >= getSegmentClients(c.segment).length;
      return {
        ...c,
        sentCount: (c.sentCount || 0) + sent,
        sentClients: sentIds,
        status: allSent ? 'completed' : 'active',
        lastExecutedAt: new Date().toISOString(),
      };
    }));

    setExecuting(null);
    addNotification(`Campaña ejecutada: ${sent} enviados, ${failed} fallidos`, sent > 0 ? 'success' : 'error');
  };

  // ─── Render ────────────────────────────────────
  const detailCampaign = campaigns.find(c => c.id === showDetail);

  return (
    <div className={B}>
      {/* ── Header ── */}
      <div className={`${B}__header`}>
        <div className={`${B}__header-left`}>
          <h1 className={`${B}__title`}>Campañas</h1>
          <span className={`${B}__subtitle`}>Recuperacion y retencion de clientes</span>
        </div>
        <button className={`${B}__btn-create`} onClick={openCreate}>
          <PlusIcon /> Nueva campaña
        </button>
      </div>

      {/* ══════════════════════════════════════════
          CAMPAIGNS CONTENT
         ══════════════════════════════════════════ */}
      <>

      {/* ── Health Dashboard ── */}
      <div className={`${B}__health`}>
        <div className={`${B}__health-card ${B}__health-card--danger`}>
          <div className={`${B}__health-icon`}>🚨</div>
          <div className={`${B}__health-info`}>
            <span className={`${B}__health-value`}>{stats.inactive90}</span>
            <span className={`${B}__health-label`}>+90 días sin venir</span>
            <span className={`${B}__health-hint`}>Casi perdidos</span>
          </div>
        </div>
        <div className={`${B}__health-card ${B}__health-card--warning`}>
          <div className={`${B}__health-icon`}>⚠️</div>
          <div className={`${B}__health-info`}>
            <span className={`${B}__health-value`}>{stats.inactive60}</span>
            <span className={`${B}__health-label`}>+60 días sin venir</span>
            <span className={`${B}__health-hint`}>En peligro</span>
          </div>
        </div>
        <div className={`${B}__health-card ${B}__health-card--alert`}>
          <div className={`${B}__health-icon`}>🔔</div>
          <div className={`${B}__health-info`}>
            <span className={`${B}__health-value`}>{stats.inactive30}</span>
            <span className={`${B}__health-label`}>+30 días sin venir</span>
            <span className={`${B}__health-hint`}>Recuperables</span>
          </div>
        </div>
        <div className={`${B}__health-card ${B}__health-card--vip`}>
          <div className={`${B}__health-icon`}>⭐</div>
          <div className={`${B}__health-info`}>
            <span className={`${B}__health-value`}>{stats.vips}</span>
            <span className={`${B}__health-label`}>Clientes VIP</span>
            <span className={`${B}__health-hint`}>Fidelizar</span>
          </div>
        </div>
        <div className={`${B}__health-card ${B}__health-card--info`}>
          <div className={`${B}__health-icon`}>📊</div>
          <div className={`${B}__health-info`}>
            <span className={`${B}__health-value`}>{stats.totalSent}</span>
            <span className={`${B}__health-label`}>Mensajes enviados</span>
            <span className={`${B}__health-hint`}>{stats.active} campañas activas</span>
          </div>
        </div>
      </div>

      {/* ── Suggested Campaigns ── */}
      {!loading && clients.length > 0 && (
        <div className={`${B}__suggestions`}>
          <div className={`${B}__suggestions-head`}>
            <h3>Campañas sugeridas para ti</h3>
            <p>Basadas en el estado actual de tus clientes. Haz clic para crearla al instante.</p>
          </div>
          <div className={`${B}__suggestions-grid`}>
            {SUGGESTED_CAMPAIGNS.map((s, i) => {
              const count = getSegmentClients(s.segment).length;
              const typeObj = CAMPAIGN_TYPES.find(t => t.id === s.type);
              return (
                <button key={i} className={`${B}__suggestion ${count === 0 ? `${B}__suggestion--empty` : ''}`}
                  style={{ '--sc': typeObj?.color }}
                  onClick={() => count > 0 ? createFromSuggestion(s) : null}
                  disabled={count === 0}>
                  <div className={`${B}__suggestion-top`}>
                    <span className={`${B}__suggestion-priority ${B}__suggestion-priority--${s.priority}`}>
                      {s.priority === 'urgente' ? '🔥 Urgente' : s.priority === 'alta' ? '⚡ Alta' : '📌 Media'}
                    </span>
                    <span className={`${B}__suggestion-count`}>{count} clientes</span>
                  </div>
                  <span className={`${B}__suggestion-name`}>{s.name}</span>
                  <span className={`${B}__suggestion-desc`}>{s.desc}</span>
                  <span className={`${B}__suggestion-action`}><PlusIcon /> Crear campaña</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className={`${B}__toolbar`}>
        <div className={`${B}__search`}>
          <SearchIcon />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar campaña..." />
        </div>
        <div className={`${B}__filters`}>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'draft', label: 'Borradores' },
            { id: 'active', label: 'Activas' },
            { id: 'paused', label: 'Pausadas' },
            { id: 'completed', label: 'Completadas' },
          ].map(f => (
            <button key={f.id}
              className={`${B}__filter-btn ${filter === f.id ? `${B}__filter-btn--on` : ''}`}
              onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Campaign list ── */}
      {loading ? (
        <div className={`${B}__loading`}>Cargando clientes...</div>
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={<TargetIcon />}
          title={campaigns.length === 0 ? 'No hay campañas creadas' : 'Sin resultados'}
          description={campaigns.length === 0
            ? 'Crea tu primera campaña para recuperar clientes inactivos, fidelizar VIPs o lanzar promociones.'
            : 'Intenta con otro filtro o búsqueda.'}
          actionLabel={campaigns.length === 0 ? 'Nueva Campaña' : undefined}
          onAction={campaigns.length === 0 ? openCreate : undefined}
        />
      ) : (
        <div className={`${B}__grid`}>
          {filteredCampaigns.map(camp => {
            const statusMeta = STATUS_META[camp.status] || STATUS_META.draft;
            const isExec = executing === camp.id;
            const segClients = getSegmentClients(camp.segment);
            const sentPct = segClients.length > 0 ? Math.round(((camp.sentClients || []).length / segClients.length) * 100) : 0;
            const segLabel = SEGMENT_FILTERS.find(s => s.id === camp.segment)?.label || '';

            return (
              <div key={camp.id} className={`${B}__card`} onClick={() => setShowDetail(camp.id)}>
                <div className={`${B}__card-accent`} style={{ background: camp.typeColor }} />
                <div className={`${B}__card-top`}>
                  <span className={`${B}__card-type`} style={{ color: camp.typeColor }}>{camp.typeLabel}</span>
                  <span className={`${B}__card-status`} style={{ '--sc': statusMeta.color }}>
                    <span className={`${B}__card-status-dot`} style={{ background: statusMeta.color }} />
                    {statusMeta.label}
                  </span>
                </div>
                <h3 className={`${B}__card-name`}>{camp.name}</h3>
                <div className={`${B}__card-meta`}>
                  <span><UsersIcon /> {segClients.length} clientes ({segLabel})</span>
                  <span><WhatsAppIcon /> {camp.templateName}</span>
                </div>
                {/* Progress bar */}
                {(camp.sentCount > 0 || isExec) && (
                  <div className={`${B}__card-progress`}>
                    <div className={`${B}__card-bar`}>
                      <div className={`${B}__card-bar-fill`}
                        style={{ width: `${isExec ? Math.round((execProgress.sent / Math.max(execProgress.total, 1)) * 100) : sentPct}%` }} />
                    </div>
                    <span className={`${B}__card-bar-text`}>
                      {isExec
                        ? `Enviando ${execProgress.sent}/${execProgress.total}...`
                        : `${(camp.sentClients || []).length}/${segClients.length} contactados (${sentPct}%)`}
                    </span>
                  </div>
                )}
                <div className={`${B}__card-foot`}>
                  <span className={`${B}__card-date`}>
                    {new Date(camp.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className={`${B}__card-actions`} onClick={e => e.stopPropagation()}>
                    {camp.status === 'draft' && (
                      <button className={`${B}__card-btn ${B}__card-btn--go`} onClick={() => executeCampaign(camp)} disabled={isExec} title="Ejecutar">
                        <PlayIcon /> Ejecutar
                      </button>
                    )}
                    {(camp.status === 'active' || camp.status === 'paused') && (
                      <>
                        <button className={`${B}__card-btn`} onClick={() => togglePause(camp.id)} title={camp.status === 'active' ? 'Pausar' : 'Reanudar'}>
                          {camp.status === 'active' ? <PauseIcon /> : <PlayIcon />}
                        </button>
                        {camp.status === 'active' && (
                          <button className={`${B}__card-btn ${B}__card-btn--go`} onClick={() => executeCampaign(camp)} disabled={isExec} title="Continuar enviando">
                            <SendIcon /> Continuar
                          </button>
                        )}
                      </>
                    )}
                    <button className={`${B}__card-btn`} onClick={() => openEdit(camp)} title="Editar"><EditIcon /></button>
                    <button className={`${B}__card-btn ${B}__card-btn--del`} onClick={() => deleteCampaign(camp.id)} title="Eliminar"><TrashIcon /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>

      {/* ══════════════════════════════════════════
          DETAIL MODAL
         ══════════════════════════════════════════ */}
      {detailCampaign && createPortal(
        <div className={`${B}__overlay`} onClick={() => setShowDetail(null)}>
          <div className={`${B}__detail`} onClick={e => e.stopPropagation()}>
            <div className={`${B}__detail-head`}>
              <div>
                <span className={`${B}__detail-type`} style={{ color: detailCampaign.typeColor }}>{detailCampaign.typeLabel}</span>
                <h2>{detailCampaign.name}</h2>
              </div>
              <button className={`${B}__modal-x`} onClick={() => setShowDetail(null)}><CloseIcon /></button>
            </div>

            {/* Template preview */}
            <div className={`${B}__detail-section`}>
              <span className={`${B}__detail-label`}>Plantilla: {detailCampaign.templateName}</span>
              <div className={`${B}__detail-preview`}>
                {resolveTemplate(detailCampaign.templateBody, { name: 'Carlos', favorite_service: 'tu servicio favorito', days_since_visit: 35, total_visits: 8 })}
              </div>
            </div>

            {/* Client list */}
            <div className={`${B}__detail-section`}>
              <span className={`${B}__detail-label`}>
                <UsersIcon /> Clientes en esta campaña ({getSegmentClients(detailCampaign.segment).length})
              </span>
              <div className={`${B}__detail-clients`}>
                {getSegmentClients(detailCampaign.segment).slice(0, 30).map(c => {
                  const wasSent = (detailCampaign.sentClients || []).includes(c.id);
                  const days = c.days_since_visit || c.days_since_last_visit || 0;
                  return (
                    <div key={c.id} className={`${B}__detail-client ${wasSent ? `${B}__detail-client--sent` : ''}`}>
                      <div className={`${B}__detail-client-avatar`}>{getInitials(c.name)}</div>
                      <div className={`${B}__detail-client-info`}>
                        <span className={`${B}__detail-client-name`}>{c.name}</span>
                        <span className={`${B}__detail-client-meta`}>
                          {days > 0 ? `${days} días sin venir` : 'Activo'} · {c.total_visits || 0} visitas
                        </span>
                      </div>
                      {wasSent && <span className={`${B}__detail-client-check`}><CheckIcon /> Enviado</span>}
                    </div>
                  );
                })}
                {getSegmentClients(detailCampaign.segment).length > 30 && (
                  <span className={`${B}__detail-more`}>
                    y {getSegmentClients(detailCampaign.segment).length - 30} clientes mas...
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className={`${B}__detail-foot`}>
              <button className={`${B}__btn--danger`} onClick={() => deleteCampaign(detailCampaign.id)}>
                <TrashIcon /> Eliminar
              </button>
              <div className={`${B}__detail-foot-right`}>
                <button className={`${B}__btn--ghost`} onClick={() => openEdit(detailCampaign)}>
                  <EditIcon /> Editar
                </button>
                {detailCampaign.status !== 'completed' && (
                  <button className={`${B}__btn--primary`} onClick={() => { setShowDetail(null); executeCampaign(detailCampaign); }}
                    disabled={executing === detailCampaign.id}>
                    <SendIcon /> {(detailCampaign.sentClients || []).length > 0 ? 'Continuar enviando' : 'Ejecutar campaña'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════
          CREATE / EDIT MODAL
         ══════════════════════════════════════════ */}
      {showCreate && createPortal(
        <div className={`${B}__overlay`} onClick={() => setShowCreate(false)}>
          <div className={`${B}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${B}__modal-head`}>
              <h2>{editingCampaign ? 'Editar campaña' : 'Nueva campaña'}</h2>
              <button className={`${B}__modal-x`} onClick={() => setShowCreate(false)}><CloseIcon /></button>
            </div>

            <div className={`${B}__modal-body`}>
              {/* Name */}
              <div className={`${B}__field`}>
                <label>Nombre de la campaña</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder='Ej: "Recuperar clientes marzo"' autoFocus />
              </div>

              {/* Type */}
              <div className={`${B}__field`}>
                <label>Tipo de campaña</label>
                <div className={`${B}__types`}>
                  {CAMPAIGN_TYPES.map(t => (
                    <button key={t.id} type="button"
                      className={`${B}__type-btn ${formType === t.id ? `${B}__type-btn--on` : ''}`}
                      style={{ '--tc': t.color }}
                      onClick={() => setFormType(t.id)}>
                      <span className={`${B}__type-icon`}>{t.icon}</span>
                      <span className={`${B}__type-label`}>{t.label}</span>
                      <span className={`${B}__type-desc`}>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Segment */}
              <div className={`${B}__field`}>
                <label>Segmento de clientes</label>
                <div className={`${B}__segments`}>
                  {SEGMENT_FILTERS.map(s => {
                    const count = getSegmentClients(s.id).length;
                    return (
                      <button key={s.id} type="button"
                        className={`${B}__seg-btn ${formSegment === s.id ? `${B}__seg-btn--on` : ''}`}
                        onClick={() => setFormSegment(s.id)}>
                        <span className={`${B}__seg-label`}>{s.label}</span>
                        <span className={`${B}__seg-count`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Template */}
              <div className={`${B}__field`}>
                <label>Plantilla de mensaje</label>
                <div className={`${B}__templates`}>
                  {templates.map(t => {
                    const cat = getCategoryMeta(t.category);
                    const active = formTemplate === t.id;
                    return (
                      <button key={t.id} type="button"
                        className={`${B}__tpl-btn ${active ? `${B}__tpl-btn--on` : ''}`}
                        onClick={() => setFormTemplate(t.id)}>
                        <div className={`${B}__tpl-top`}>
                          <span className={`${B}__tpl-cat`} style={{ color: cat.color }}>{cat.name}</span>
                          {active && <CheckIcon />}
                        </div>
                        <span className={`${B}__tpl-name`}>{t.name}</span>
                        <span className={`${B}__tpl-body`}>{t.body.length > 80 ? t.body.slice(0, 80) + '...' : t.body}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              {formTemplate && (() => {
                const tpl = templates.find(t => t.id === formTemplate);
                const sampleClient = getSegmentClients(formSegment)[0] || { name: 'Carlos', favorite_service: 'tu servicio', days_since_visit: 35 };
                return (
                  <div className={`${B}__field`}>
                    <label><EyeIcon /> Vista previa (ejemplo con {sampleClient.name?.split(' ')[0]})</label>
                    <div className={`${B}__preview`}>
                      <div className={`${B}__preview-bubble`}>
                        {resolveTemplate(tpl?.body || '', sampleClient)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              <div className={`${B}__field`}>
                <label>Notas internas (opcional)</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)}
                  placeholder="Notas sobre el objetivo de esta campaña..." rows={2} />
              </div>
            </div>

            <div className={`${B}__modal-foot`}>
              <button className={`${B}__btn--ghost`} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className={`${B}__btn--primary`} onClick={handleSave}>
                {editingCampaign ? 'Guardar cambios' : 'Crear campaña'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Campaigns;
