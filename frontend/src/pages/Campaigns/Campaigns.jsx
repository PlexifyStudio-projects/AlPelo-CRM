import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../context/NotificationContext';
import EmptyState from '../../components/common/EmptyState/EmptyState';
import campaignService from '../../services/campaignService';
import clientService from '../../services/clientService';
import staffService from '../../services/staffService';
import servicesService from '../../services/servicesService';
import templateService from '../../services/templateService';
import aiService from '../../services/aiService';

// Category display metadata
const templateCategories = [
  { id: 'post_servicio', name: 'Post-Servicio', color: '#34D399' },
  { id: 'reactivacion', name: 'Reactivacion', color: '#FBBF24' },
  { id: 'recordatorio', name: 'Recordatorio', color: '#60A5FA' },
  { id: 'promocion', name: 'Promocion', color: '#8B5CF6' },
  { id: 'fidelizacion', name: 'Fidelizacion', color: '#EC4899' },
  { id: 'bienvenida', name: 'Bienvenida', color: '#22B07E' },
];

const B = 'campaigns';

// ═══════════════════════════════════════════════
// SVG Icons
// ═══════════════════════════════════════════════
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const PlayIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>;
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
const RefreshIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>;
const SparkleIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" /></svg>;

// ═══════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════
const CAMPAIGN_TYPES = [
  { id: 'recovery', label: 'Recuperacion', desc: 'Clientes inactivos (+30 dias)', color: '#FBBF24', icon: '🔄' },
  { id: 'vip', label: 'VIP', desc: 'Clientes VIP y frecuentes', color: '#8B5CF6', icon: '⭐' },
  { id: 'reactivation', label: 'Reactivacion', desc: 'En riesgo de perderse', color: '#F87171', icon: '🔥' },
  { id: 'promo', label: 'Promocion', desc: 'Ofertas y descuentos', color: '#34D399', icon: '🎯' },
  { id: 'followup', label: 'Seguimiento', desc: 'Post-servicio y feedback', color: '#60A5FA', icon: '💬' },
];

const SEGMENT_OPTIONS = [
  { id: 'inactive_30', label: '+30 dias sin venir', filters: { days_inactive: 30 } },
  { id: 'inactive_60', label: '+60 dias sin venir', filters: { days_inactive: 60 } },
  { id: 'inactive_90', label: '+90 dias sin venir', filters: { days_inactive: 90 } },
  { id: 'vip', label: 'Clientes VIP', filters: { status: 'vip' } },
  { id: 'at_risk', label: 'En riesgo', filters: { status: 'en_riesgo' } },
  { id: 'inactive_all', label: 'Inactivos', filters: { status: 'inactivo' } },
  { id: 'active', label: 'Activos', filters: { status: 'activo' } },
  { id: 'new', label: 'Nuevos', filters: { status: 'nuevo' } },
  { id: 'high_value', label: 'Alto valor (+$500k)', filters: { min_spent: 500000 } },
  { id: 'frequent', label: 'Frecuentes (+10 visitas)', filters: { min_visits: 10 } },
];

const STATUS_META = {
  draft: { label: 'Borrador', color: '#8E8E85' },
  pending_meta: { label: 'Pendiente Meta', color: '#FBBF24' },
  approved: { label: 'Aprobada', color: '#34D399' },
  rejected: { label: 'Rechazada', color: '#F87171' },
  sending: { label: 'Enviando...', color: '#60A5FA' },
  sent: { label: 'Enviada', color: '#8B5CF6' },
  paused: { label: 'Pausada', color: '#FBBF24' },
};

const SUGGESTED_CAMPAIGNS = [
  { name: 'Recuperar clientes +30 dias', type: 'recovery', segment: 'inactive_30', desc: 'Contactar clientes que llevan +30 dias sin venir', priority: 'alta' },
  { name: 'Rescate urgente +60 dias', type: 'reactivation', segment: 'inactive_60', desc: 'Clientes que casi perdemos — descuento agresivo', priority: 'urgente' },
  { name: 'Fidelizacion VIP', type: 'vip', segment: 'vip', desc: 'Mantener contentos a los mejores clientes', priority: 'media' },
  { name: 'Promo de la semana', type: 'promo', segment: 'active', desc: 'Promocion semanal con descuento en servicios', priority: 'media' },
  { name: 'Clientes casi perdidos +90 dias', type: 'reactivation', segment: 'inactive_90', desc: 'Ultimo intento con clientes de 3 meses', priority: 'urgente' },
];

const SAMPLE_VARS = {
  nombre: (c) => (c?.name || 'Cliente').split(' ')[0],
  servicio: (c) => c?.favorite_service || 'tu servicio',
  dias: (c) => String(c?.days_since_last_visit || ''),
  negocio: () => 'Tu Negocio',
  profesional: () => 'Tu profesional',
};

const resolveTemplate = (body, client) => {
  if (!body) return '';
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const resolver = SAMPLE_VARS[key];
    return resolver ? resolver(client) : `{{${key}}}`;
  });
};

// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════
const Campaigns = () => {
  const { addNotification } = useNotification();

  // Data
  const [campaigns, setCampaigns] = useState([]);
  const [clients, setClients] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [showDetail, setShowDetail] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Wizard form
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('recovery');
  const [formBody, setFormBody] = useState('');
  const [formSegment, setFormSegment] = useState('inactive_30');
  const [formStaffFilter, setFormStaffFilter] = useState('');
  const [formServiceFilter, setFormServiceFilter] = useState('');
  const [editingId, setEditingId] = useState(null);

  // AI
  const [aiVariants, setAiVariants] = useState([]);
  const [generatingAI, setGeneratingAI] = useState(false);

  // Lina chat (Step 2)
  const [linaPrompt, setLinaPrompt] = useState('');
  const [linaResponse, setLinaResponse] = useState('');
  const [linaLoading, setLinaLoading] = useState(false);

  // Audience
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [loadingAudience, setLoadingAudience] = useState(false);

  // Actions
  const [actionLoading, setActionLoading] = useState(null);

  // Confirm modal (replaces native confirm())
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }

  // ─── Load all data ──────────────────────────
  const loadCampaigns = useCallback(async () => {
    try {
      const data = await campaignService.list();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error loading campaigns:', e);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    // Load supporting data for filters + context
    clientService.list({}).then(d => setClients(Array.isArray(d) ? d : [])).catch(() => {});
    staffService.list({}).then(d => setStaffList(Array.isArray(d) ? d : [])).catch(() => {});
    servicesService.list({}).then(d => setServicesList(Array.isArray(d) ? d : [])).catch(() => {});
    templateService.getTemplates().then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {});
  }, [loadCampaigns]);

  // ─── Filtered list ───────────────────────────
  const filteredCampaigns = useMemo(() => {
    let list = [...campaigns];
    if (filter !== 'all') list = list.filter(c => c.status === filter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(s));
    }
    return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [campaigns, filter, search]);

  // ─── Stats (real data from clients + campaigns) ────
  const stats = useMemo(() => {
    const getDays = c => c.days_since_last_visit ?? null;
    const withPhone = clients.filter(c => c.phone);
    return {
      total: campaigns.length,
      drafts: campaigns.filter(c => c.status === 'draft').length,
      pending: campaigns.filter(c => c.status === 'pending_meta').length,
      approved: campaigns.filter(c => c.status === 'approved').length,
      sent: campaigns.filter(c => c.status === 'sent').length,
      totalSent: campaigns.reduce((a, c) => a + (c.sent_count || 0), 0),
      totalFailed: campaigns.reduce((a, c) => a + (c.failed_count || 0), 0),
      // Client segments (real data)
      totalClients: withPhone.length,
      inactive30: withPhone.filter(c => { const d = getDays(c); return d !== null && d >= 30; }).length,
      inactive60: withPhone.filter(c => { const d = getDays(c); return d !== null && d >= 60; }).length,
      vips: withPhone.filter(c => c.status === 'vip').length,
      atRisk: withPhone.filter(c => c.status === 'en_riesgo' || c.status === 'at_risk').length,
      approvedTemplates: templates.filter(t => t.status === 'approved').length,
    };
  }, [campaigns, clients, templates]);

  // ─── Wizard actions ──────────────────────────
  const openWizard = (suggestion = null) => {
    setEditingId(null);
    setWizardStep(1);
    setAiVariants([]);
    setAudiencePreview(null);
    setFormStaffFilter('');
    setFormServiceFilter('');
    setLinaPrompt('');
    setLinaResponse('');
    if (suggestion) {
      setFormName(suggestion.name);
      setFormType(suggestion.type);
      setFormSegment(suggestion.segment);
      setFormBody('');
    } else {
      setFormName('');
      setFormType('recovery');
      setFormSegment('inactive_30');
      setFormBody('');
    }
    setShowWizard(true);
  };

  const openEdit = (campaign) => {
    setEditingId(campaign.id);
    setWizardStep(1);
    setFormName(campaign.name);
    setFormType(campaign.campaign_type || 'recovery');
    setFormBody(campaign.message_body || '');
    setAiVariants(campaign.ai_variants || []);
    setAudiencePreview(null);
    setLinaPrompt('');
    setLinaResponse('');
    const seg = SEGMENT_OPTIONS.find(s => {
      const f = campaign.segment_filters || {};
      return JSON.stringify(s.filters) === JSON.stringify(f);
    });
    setFormSegment(seg?.id || 'inactive_30');
    setShowWizard(true);
  };

  const handleSaveStep1 = async () => {
    if (!formName.trim()) {
      addNotification('Dale un nombre a la campana', 'error');
      return;
    }
    const seg = SEGMENT_OPTIONS.find(s => s.id === formSegment);
    const payload = {
      name: formName,
      campaign_type: formType,
      segment_filters: seg?.filters || {},
      message_body: formBody || null,
    };

    try {
      if (editingId) {
        const updated = await campaignService.update(editingId, payload);
        setCampaigns(prev => prev.map(c => c.id === editingId ? updated : c));
      } else {
        const created = await campaignService.create(payload);
        setCampaigns(prev => [created, ...prev]);
        setEditingId(created.id);
      }
      setWizardStep(2);
    } catch (e) {
      addNotification(e.message, 'error');
    }
  };

  const handleGenerateAI = async () => {
    if (!editingId) return;
    setGeneratingAI(true);
    try {
      const res = await campaignService.generateCopy(editingId);
      setAiVariants(res.variants || []);
      if (res.variants?.length && !formBody) {
        setFormBody(res.variants[0].body);
      }
      addNotification('Lina IA genero 3 variantes de copy', 'success');
    } catch (e) {
      addNotification(`Error generando copy: ${e.message}`, 'error');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAskLina = async () => {
    if (!linaPrompt.trim()) return;
    setLinaLoading(true);
    try {
      const campaignContext = `Estoy creando una campana de marketing tipo "${CAMPAIGN_TYPES.find(t => t.id === formType)?.label || formType}" llamada "${formName}". `;
      const fullPrompt = campaignContext + linaPrompt;
      const res = await aiService.chat(fullPrompt);
      setLinaResponse(res.response || '');
    } catch (e) {
      setLinaResponse('Error consultando a Lina: ' + e.message);
    } finally {
      setLinaLoading(false);
    }
  };

  const handleSaveStep2 = async () => {
    if (!formBody.trim()) {
      addNotification('Escribe o genera un mensaje', 'error');
      return;
    }
    try {
      const updated = await campaignService.update(editingId, { message_body: formBody });
      setCampaigns(prev => prev.map(c => c.id === editingId ? updated : c));
      setWizardStep(3);
    } catch (e) {
      addNotification(e.message, 'error');
    }
  };

  const handlePreviewAudience = async () => {
    if (!editingId) return;
    setLoadingAudience(true);
    try {
      const res = await campaignService.previewAudience(editingId);
      setAudiencePreview(res);
    } catch (e) {
      addNotification(`Error: ${e.message}`, 'error');
    } finally {
      setLoadingAudience(false);
    }
  };

  const handleFinishWizard = () => {
    setShowWizard(false);
    loadCampaigns();
    addNotification('Campana guardada. Enviala a Meta para aprobacion.', 'success');
  };

  // ─── Campaign actions ────────────────────────
  const handleSubmitMeta = async (id) => {
    setActionLoading(id);
    try {
      const res = await campaignService.submitToMeta(id);
      setCampaigns(prev => prev.map(c => c.id === id ? res.campaign : c));
      addNotification(`Enviada a Meta (estado: ${res.meta_status})`, 'success');
    } catch (e) {
      addNotification(e.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckStatus = async (id) => {
    setActionLoading(id);
    try {
      const res = await campaignService.checkMetaStatus(id);
      setCampaigns(prev => prev.map(c => c.id === id ? res.campaign : c));
      addNotification(`Estado Meta: ${res.meta_status}`, 'info');
    } catch (e) {
      addNotification(e.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const requestConfirm = (message, onConfirm) => {
    setConfirmModal({ message, onConfirm });
  };

  const handleSend = (id) => {
    requestConfirm('Enviar esta campana a todos los clientes del segmento?', async () => {
      setConfirmModal(null);
      setActionLoading(id);
      try {
        const res = await campaignService.send(id);
        setCampaigns(prev => prev.map(c => c.id === id ? res.campaign : c));
        addNotification(`Enviados: ${res.sent} | Fallidos: ${res.failed} de ${res.total}`, 'success');
      } catch (e) {
        addNotification(e.message, 'error');
      } finally {
        setActionLoading(null);
      }
    });
  };

  const handleDelete = (id) => {
    requestConfirm('Eliminar esta campana?', async () => {
      setConfirmModal(null);
      try {
        await campaignService.delete(id);
        setCampaigns(prev => prev.filter(c => c.id !== id));
        addNotification('Campana eliminada', 'success');
      } catch (e) {
        addNotification(e.message, 'error');
      }
    });
  };

  // ─── Render helpers ──────────────────────────
  const statusBadge = (status) => {
    const meta = STATUS_META[status] || STATUS_META.draft;
    return (
      <span className={`${B}__status-badge`} style={{ background: meta.color + '18', color: meta.color, borderColor: meta.color + '30' }}>
        {meta.label}
      </span>
    );
  };

  const typeBadge = (type) => {
    const t = CAMPAIGN_TYPES.find(ct => ct.id === type);
    if (!t) return null;
    return (
      <span className={`${B}__type-badge`} style={{ background: t.color + '18', color: t.color }}>
        {t.icon} {t.label}
      </span>
    );
  };

  // ─── Loading state ───────────────────────────
  if (loading) {
    return (
      <div className={B}>
        <div className={`${B}__loading`}>Cargando campanas...</div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className={B}>
      {/* ─── Header ─── */}
      <div className={`${B}__header`}>
        <div className={`${B}__header-left`}>
          <h1 className={`${B}__title`}>Campanas</h1>
          <span className={`${B}__subtitle`}>Marketing & WhatsApp masivo</span>
        </div>
        <button className={`${B}__btn-create`} onClick={() => openWizard()}>
          <PlusIcon /> Nueva Campana
        </button>
      </div>

      {/* ─── Health Dashboard ─── */}
      <div className={`${B}__health`}>
        <div className={`${B}__health-card`}>
          <div className={`${B}__health-card-value`}>{stats.totalClients}</div>
          <div className={`${B}__health-card-label`}>Clientes con WhatsApp</div>
        </div>
        <div className={`${B}__health-card`}>
          <div className={`${B}__health-card-value`} style={{ color: '#F59E0B' }}>{stats.inactive30}</div>
          <div className={`${B}__health-card-label`}>Inactivos +30 dias</div>
        </div>
        <div className={`${B}__health-card`}>
          <div className={`${B}__health-card-value`} style={{ color: '#EF4444' }}>{stats.atRisk}</div>
          <div className={`${B}__health-card-label`}>En riesgo</div>
        </div>
        <div className={`${B}__health-card`}>
          <div className={`${B}__health-card-value`} style={{ color: '#34D399' }}>{stats.totalSent}</div>
          <div className={`${B}__health-card-label`}>Mensajes enviados</div>
        </div>
        <div className={`${B}__health-card`}>
          <div className={`${B}__health-card-value`} style={{ color: '#8B5CF6' }}>{stats.total}</div>
          <div className={`${B}__health-card-label`}>Campanas creadas</div>
        </div>
      </div>

      {/* ─── Toolbar ─── */}
      <div className={`${B}__toolbar`}>
        <div className={`${B}__search`}>
          <SearchIcon />
          <input
            type="text"
            placeholder="Buscar campana..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${B}__search-input`}
          />
        </div>
        <div className={`${B}__filters`}>
          {['all', 'draft', 'pending_meta', 'approved', 'sent'].map(f => (
            <button
              key={f}
              className={`${B}__filter-btn ${filter === f ? `${B}__filter-btn--active` : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Todas' : STATUS_META[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Suggested Campaigns (when empty or always as inspiration) ─── */}
      {campaigns.length === 0 && (
        <div className={`${B}__suggested`}>
          <h3 className={`${B}__suggested-title`}>
            <ZapIcon /> Campanas sugeridas para tu negocio
          </h3>
          <p className={`${B}__suggested-subtitle`}>
            Basado en tus {stats.totalClients} clientes — {stats.inactive30} inactivos, {stats.vips} VIP, {stats.atRisk} en riesgo
          </p>
          <div className={`${B}__suggested-grid`}>
            {SUGGESTED_CAMPAIGNS.map((s, i) => {
              const t = CAMPAIGN_TYPES.find(ct => ct.id === s.type);
              // Show real client count for each segment
              const getDays = c => c.days_since_last_visit ?? null;
              const segCounts = {
                inactive_30: clients.filter(c => c.phone && getDays(c) !== null && getDays(c) >= 30).length,
                inactive_60: clients.filter(c => c.phone && getDays(c) !== null && getDays(c) >= 60).length,
                inactive_90: clients.filter(c => c.phone && getDays(c) !== null && getDays(c) >= 90).length,
                vip: clients.filter(c => c.phone && c.status === 'vip').length,
                active: clients.filter(c => c.phone && (c.status === 'activo' || c.status === 'active')).length,
              };
              const count = segCounts[s.segment] || 0;
              return (
                <div key={i} className={`${B}__suggested-card`} onClick={() => openWizard(s)}>
                  <div className={`${B}__suggested-card-icon`} style={{ color: t?.color }}>{t?.icon}</div>
                  <div className={`${B}__suggested-card-name`}>{s.name}</div>
                  <div className={`${B}__suggested-card-desc`}>{s.desc}</div>
                  <div className={`${B}__suggested-card-footer`}>
                    <span className={`${B}__suggested-card-priority`} data-priority={s.priority}>
                      {s.priority}
                    </span>
                    {count > 0 && (
                      <span className={`${B}__suggested-card-count`}>
                        <UsersIcon /> {count}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Campaign List ─── */}
      {filteredCampaigns.length > 0 && (
        <div className={`${B}__list`}>
          {filteredCampaigns.map(c => (
            <div key={c.id} className={`${B}__card`}>
              <div className={`${B}__card-header`}>
                <div className={`${B}__card-title-row`}>
                  <h3 className={`${B}__card-name`}>{c.name}</h3>
                  {statusBadge(c.status)}
                </div>
                {typeBadge(c.campaign_type)}
              </div>

              {c.message_body && (
                <div className={`${B}__card-preview`}>
                  <WhatsAppIcon />
                  <span>{c.message_body.length > 100 ? c.message_body.slice(0, 100) + '...' : c.message_body}</span>
                </div>
              )}

              <div className={`${B}__card-stats`}>
                <span><UsersIcon /> {c.audience_count || 0} destinatarios</span>
                {c.sent_count > 0 && <span><SendIcon /> {c.sent_count} enviados</span>}
                {c.failed_count > 0 && <span className={`${B}__card-stat--error`}>✗ {c.failed_count} fallidos</span>}
              </div>

              <div className={`${B}__card-actions`}>
                {c.status === 'draft' && (
                  <>
                    <button className={`${B}__btn-action ${B}__btn-action--edit`} onClick={() => openEdit(c)} title="Editar">
                      <EditIcon /> Editar
                    </button>
                    <button className={`${B}__btn-action ${B}__btn-action--meta`} onClick={() => handleSubmitMeta(c.id)} disabled={actionLoading === c.id || !c.message_body} title="Enviar a Meta">
                      <SendIcon /> {actionLoading === c.id ? 'Enviando...' : 'Enviar a Meta'}
                    </button>
                    <button className={`${B}__btn-action ${B}__btn-action--delete`} onClick={() => handleDelete(c.id)} title="Eliminar">
                      <TrashIcon />
                    </button>
                  </>
                )}
                {c.status === 'pending_meta' && (
                  <button className={`${B}__btn-action ${B}__btn-action--check`} onClick={() => handleCheckStatus(c.id)} disabled={actionLoading === c.id}>
                    <RefreshIcon /> {actionLoading === c.id ? 'Verificando...' : 'Verificar estado'}
                  </button>
                )}
                {c.status === 'approved' && (
                  <>
                    <button className={`${B}__btn-action ${B}__btn-action--send`} onClick={() => handleSend(c.id)} disabled={actionLoading === c.id}>
                      <PlayIcon /> {actionLoading === c.id ? 'Enviando...' : 'Enviar campana'}
                    </button>
                    <button className={`${B}__btn-action ${B}__btn-action--delete`} onClick={() => handleDelete(c.id)}>
                      <TrashIcon />
                    </button>
                  </>
                )}
                {c.status === 'sent' && (
                  <button className={`${B}__btn-action ${B}__btn-action--stats`} onClick={() => setShowDetail(c)}>
                    <ChartIcon /> Ver resultados
                  </button>
                )}
                {c.status === 'rejected' && (
                  <>
                    <button className={`${B}__btn-action ${B}__btn-action--edit`} onClick={() => openEdit(c)}>
                      <EditIcon /> Editar y reenviar
                    </button>
                    <button className={`${B}__btn-action ${B}__btn-action--delete`} onClick={() => handleDelete(c.id)}>
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredCampaigns.length === 0 && campaigns.length > 0 && (
        <EmptyState
          icon={<MegaphoneIcon />}
          title="Sin resultados"
          description="No hay campanas que coincidan con tu busqueda"
        />
      )}

      {/* ═══════════════════════════════════════════════
          WIZARD MODAL — 3-step creation flow
          ═══════════════════════════════════════════════ */}
      {showWizard && createPortal(
        <div className={`${B}__modal-overlay`} onClick={() => setShowWizard(false)}>
          <div className={`${B}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${B}__modal-header`}>
              <h2 className={`${B}__modal-title`}>
                {editingId ? 'Editar Campana' : 'Nueva Campana'}
              </h2>
              <button className={`${B}__modal-close`} onClick={() => setShowWizard(false)}>
                <CloseIcon />
              </button>
            </div>

            {/* Stepper */}
            <div className={`${B}__stepper`}>
              {[1, 2, 3].map(step => (
                <div key={step} className={`${B}__stepper-step ${wizardStep >= step ? `${B}__stepper-step--active` : ''} ${wizardStep === step ? `${B}__stepper-step--current` : ''}`}>
                  <div className={`${B}__stepper-dot`}>{wizardStep > step ? <CheckIcon /> : step}</div>
                  <span className={`${B}__stepper-label`}>
                    {step === 1 ? 'Tipo' : step === 2 ? 'Mensaje' : 'Audiencia'}
                  </span>
                </div>
              ))}
            </div>

            <div className={`${B}__modal-body`}>
              {/* ─── Step 1: Name + Type ─── */}
              {wizardStep === 1 && (
                <div className={`${B}__wizard-step`}>
                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Nombre de la campana</label>
                    <input
                      type="text"
                      className={`${B}__input`}
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Ej: Recuperar clientes de marzo"
                    />
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Tipo de campana</label>
                    <div className={`${B}__type-grid`}>
                      {CAMPAIGN_TYPES.map(t => (
                        <div
                          key={t.id}
                          className={`${B}__type-option ${formType === t.id ? `${B}__type-option--selected` : ''}`}
                          style={{ '--type-color': t.color }}
                          onClick={() => setFormType(t.id)}
                        >
                          <span className={`${B}__type-option-icon`}>{t.icon}</span>
                          <span className={`${B}__type-option-label`}>{t.label}</span>
                          <span className={`${B}__type-option-desc`}>{t.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`${B}__wizard-actions`}>
                    <button className={`${B}__btn-secondary`} onClick={() => setShowWizard(false)}>
                      Cancelar
                    </button>
                    <button className={`${B}__btn-primary`} onClick={handleSaveStep1}>
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Step 2: Message / AI + Lina ─── */}
              {wizardStep === 2 && (
                <div className={`${B}__wizard-step`}>
                  {/* AI Generate section */}
                  <div className={`${B}__ai-section`}>
                    <div className={`${B}__ai-section-top`}>
                      <div className={`${B}__ai-section-info`}>
                        <SparkleIcon />
                        <span className={`${B}__ai-section-title`}>Generar con IA</span>
                      </div>
                      <button
                        className={`${B}__btn-ai`}
                        onClick={handleGenerateAI}
                        disabled={generatingAI}
                      >
                        {generatingAI ? 'Generando...' : 'Generar'}
                      </button>
                    </div>
                    <span className={`${B}__ai-hint`}>Lina analiza tus datos reales y genera 3 variantes</span>
                  </div>

                  {aiVariants.length > 0 && (
                    <div className={`${B}__variants`}>
                      {aiVariants.map((v, i) => (
                        <div
                          key={i}
                          className={`${B}__variant ${formBody === v.body ? `${B}__variant--selected` : ''}`}
                          onClick={() => setFormBody(v.body)}
                        >
                          <div className={`${B}__variant-header`}>
                            <span className={`${B}__variant-tag`}>
                              <SparkleIcon /> Variante {i + 1} {formBody === v.body ? '(seleccionada)' : ''}
                            </span>
                            {formBody === v.body && <CheckIcon />}
                          </div>
                          <div className={`${B}__variant-body`}>{v.body}</div>
                          <div className={`${B}__variant-reason`}>{v.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={`${B}__divider`}>
                    <span>o escribe tu propio mensaje</span>
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Mensaje (usa {"{{nombre}}"} para personalizar)</label>
                    <textarea
                      className={`${B}__textarea`}
                      value={formBody}
                      onChange={e => setFormBody(e.target.value)}
                      placeholder="Hola {{nombre}}, te extranamos en..."
                      rows={4}
                      maxLength={500}
                    />
                    <div className={`${B}__char-count`}>{formBody.length}/500</div>
                  </div>

                  {/* ── Consultar a Lina ── */}
                  <div className={`${B}__lina-section`}>
                    <div className={`${B}__lina-header`}>
                      <SparkleIcon /> Consultar a Lina
                    </div>
                    <p className={`${B}__lina-hint`}>Preguntale a Lina sobre tu campana, audiencia o estrategia</p>
                    <div className={`${B}__lina-input-row`}>
                      <input
                        type="text"
                        className={`${B}__input`}
                        value={linaPrompt}
                        onChange={e => setLinaPrompt(e.target.value)}
                        placeholder="Ej: que mensaje funciona mejor para clientes VIP?"
                        onKeyDown={e => e.key === 'Enter' && handleAskLina()}
                      />
                      <button className={`${B}__btn-ai`} onClick={handleAskLina} disabled={linaLoading || !linaPrompt.trim()}>
                        {linaLoading ? '...' : 'Preguntar'}
                      </button>
                    </div>
                    {linaResponse && (
                      <div className={`${B}__lina-response`}>
                        <div className={`${B}__lina-response-label`}>
                          <SparkleIcon /> Lina dice:
                        </div>
                        <div className={`${B}__lina-response-text`}>{linaResponse}</div>
                        <button
                          className={`${B}__btn-use-text`}
                          onClick={() => {
                            const clean = linaResponse.replace(/\n+/g, ' ').trim();
                            setFormBody(clean.length > 300 ? clean.slice(0, 300) : clean);
                            addNotification('Texto de Lina aplicado al mensaje', 'success');
                          }}
                        >
                          Usar este texto
                        </button>
                      </div>
                    )}
                  </div>

                  {/* WhatsApp preview */}
                  {formBody && (
                    <div className={`${B}__preview-bubble`}>
                      <div className={`${B}__preview-bubble-label`}>Vista previa WhatsApp</div>
                      <div className={`${B}__preview-bubble-msg`}>
                        {resolveTemplate(formBody)}
                      </div>
                    </div>
                  )}

                  <div className={`${B}__wizard-actions`}>
                    <button className={`${B}__btn-secondary`} onClick={() => setWizardStep(1)}>
                      Atras
                    </button>
                    <button className={`${B}__btn-primary`} onClick={handleSaveStep2}>
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Step 3: Audience ─── */}
              {wizardStep === 3 && (
                <div className={`${B}__wizard-step`}>
                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Segmento de audiencia</label>
                    <div className={`${B}__segment-grid`}>
                      {SEGMENT_OPTIONS.map(s => (
                        <button
                          key={s.id}
                          className={`${B}__segment-btn ${formSegment === s.id ? `${B}__segment-btn--selected` : ''}`}
                          onClick={async () => {
                            setFormSegment(s.id);
                            // Build composite filters
                            const baseFilters = { ...s.filters };
                            if (formStaffFilter) baseFilters.staff_id = Number(formStaffFilter);
                            if (formServiceFilter) baseFilters.service_name = formServiceFilter;
                            if (editingId) {
                              try {
                                await campaignService.update(editingId, { segment_filters: baseFilters });
                              } catch {}
                            }
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced filters: Staff + Service */}
                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Filtros avanzados (opcional)</label>
                    <div className={`${B}__advanced-filters`}>
                      <select
                        className={`${B}__input`}
                        value={formStaffFilter}
                        onChange={async (e) => {
                          setFormStaffFilter(e.target.value);
                          const seg = SEGMENT_OPTIONS.find(s => s.id === formSegment);
                          const filters = { ...(seg?.filters || {}) };
                          if (e.target.value) filters.staff_id = Number(e.target.value);
                          if (formServiceFilter) filters.service_name = formServiceFilter;
                          if (editingId) {
                            try { await campaignService.update(editingId, { segment_filters: filters }); } catch {}
                          }
                        }}
                      >
                        <option value="">Todos los profesionales</option>
                        {staffList.filter(s => s.is_active).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>

                      <select
                        className={`${B}__input`}
                        value={formServiceFilter}
                        onChange={async (e) => {
                          setFormServiceFilter(e.target.value);
                          const seg = SEGMENT_OPTIONS.find(s => s.id === formSegment);
                          const filters = { ...(seg?.filters || {}) };
                          if (formStaffFilter) filters.staff_id = Number(formStaffFilter);
                          if (e.target.value) filters.service_name = e.target.value;
                          if (editingId) {
                            try { await campaignService.update(editingId, { segment_filters: filters }); } catch {}
                          }
                        }}
                      >
                        <option value="">Todos los servicios</option>
                        {servicesList.filter(s => s.is_active).map(s => (
                          <option key={s.id} value={s.name}>{s.name} (${s.price?.toLocaleString('es-CO')})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    className={`${B}__btn-preview-audience`}
                    onClick={handlePreviewAudience}
                    disabled={loadingAudience}
                  >
                    <TargetIcon />
                    {loadingAudience ? 'Calculando...' : 'Ver audiencia'}
                  </button>

                  {audiencePreview && (
                    <div className={`${B}__audience-result`}>
                      <div className={`${B}__audience-count`}>
                        <UsersIcon />
                        <strong>{audiencePreview.count}</strong> clientes coinciden
                      </div>
                      {audiencePreview.sample?.length > 0 && (
                        <div className={`${B}__audience-sample`}>
                          {audiencePreview.sample.slice(0, 8).map(cl => (
                            <div key={cl.id} className={`${B}__audience-client`}>
                              <span>{cl.name}</span>
                              <span className={`${B}__audience-phone`}>{cl.phone}</span>
                            </div>
                          ))}
                          {audiencePreview.count > 8 && (
                            <div className={`${B}__audience-more`}>
                              +{audiencePreview.count - 8} mas
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`${B}__wizard-actions`}>
                    <button className={`${B}__btn-secondary`} onClick={() => setWizardStep(2)}>
                      Atras
                    </button>
                    <button className={`${B}__btn-primary`} onClick={handleFinishWizard}>
                      <CheckIcon /> Guardar campana
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══════════════════════════════════════════════
          DETAIL MODAL — Campaign stats
          ═══════════════════════════════════════════════ */}
      {showDetail && createPortal(
        <div className={`${B}__modal-overlay`} onClick={() => setShowDetail(null)}>
          <div className={`${B}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${B}__modal-header`}>
              <h2 className={`${B}__modal-title`}>{showDetail.name}</h2>
              <button className={`${B}__modal-close`} onClick={() => setShowDetail(null)}>
                <CloseIcon />
              </button>
            </div>
            <div className={`${B}__modal-body`}>
              <div className={`${B}__detail-row`}>
                {statusBadge(showDetail.status)}
                {typeBadge(showDetail.campaign_type)}
              </div>

              {showDetail.message_body && (
                <div className={`${B}__preview-bubble`}>
                  <div className={`${B}__preview-bubble-label`}>Mensaje enviado</div>
                  <div className={`${B}__preview-bubble-msg`}>{showDetail.message_body}</div>
                </div>
              )}

              <div className={`${B}__detail-stats`}>
                <div className={`${B}__detail-stat`}>
                  <div className={`${B}__detail-stat-value`}>{showDetail.audience_count || 0}</div>
                  <div className={`${B}__detail-stat-label`}>Audiencia</div>
                </div>
                <div className={`${B}__detail-stat`}>
                  <div className={`${B}__detail-stat-value`} style={{ color: '#34D399' }}>{showDetail.sent_count || 0}</div>
                  <div className={`${B}__detail-stat-label`}>Enviados</div>
                </div>
                <div className={`${B}__detail-stat`}>
                  <div className={`${B}__detail-stat-value`} style={{ color: '#F87171' }}>{showDetail.failed_count || 0}</div>
                  <div className={`${B}__detail-stat-label`}>Fallidos</div>
                </div>
                <div className={`${B}__detail-stat`}>
                  <div className={`${B}__detail-stat-value`} style={{ color: '#60A5FA' }}>{showDetail.responded_count || 0}</div>
                  <div className={`${B}__detail-stat-label`}>Respondidos</div>
                </div>
              </div>

              {showDetail.sent_count > 0 && (
                <div className={`${B}__detail-progress`}>
                  <div className={`${B}__detail-progress-bar`}>
                    <div
                      className={`${B}__detail-progress-fill ${B}__detail-progress-fill--success`}
                      style={{ width: `${(showDetail.sent_count / (showDetail.audience_count || 1)) * 100}%` }}
                    />
                    <div
                      className={`${B}__detail-progress-fill ${B}__detail-progress-fill--error`}
                      style={{ width: `${(showDetail.failed_count / (showDetail.audience_count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className={`${B}__detail-meta`}>
                {showDetail.meta_template_name && (
                  <div><strong>Template Meta:</strong> {showDetail.meta_template_name}</div>
                )}
                {showDetail.meta_status && (
                  <div><strong>Estado Meta:</strong> {showDetail.meta_status}</div>
                )}
                {showDetail.segment_filters && Object.keys(showDetail.segment_filters).length > 0 && (
                  <div><strong>Filtros:</strong> {Object.entries(showDetail.segment_filters).map(([k, v]) => `${k}: ${v}`).join(', ')}</div>
                )}
                {showDetail.created_at && (
                  <div><strong>Creada:</strong> {new Date(showDetail.created_at).toLocaleDateString('es-CO')}</div>
                )}
                {showDetail.updated_at && (
                  <div><strong>Ultima actualizacion:</strong> {new Date(showDetail.updated_at).toLocaleDateString('es-CO')}</div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══════════════════════════════════════════════
          CONFIRM MODAL — Replaces native confirm()
          ═══════════════════════════════════════════════ */}
      {confirmModal && createPortal(
        <div className={`${B}__modal-overlay`} onClick={() => setConfirmModal(null)}>
          <div className={`${B}__confirm`} onClick={e => e.stopPropagation()}>
            <div className={`${B}__confirm-icon`}>
              <SendIcon />
            </div>
            <p className={`${B}__confirm-text`}>{confirmModal.message}</p>
            <div className={`${B}__confirm-actions`}>
              <button className={`${B}__btn-secondary`} onClick={() => setConfirmModal(null)}>
                Cancelar
              </button>
              <button className={`${B}__btn-primary`} onClick={confirmModal.onConfirm}>
                Confirmar
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
