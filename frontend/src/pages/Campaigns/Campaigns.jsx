import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import EmptyState from '../../components/common/EmptyState/EmptyState';
import campaignService from '../../services/campaignService';
import staffService from '../../services/staffService';
import servicesService from '../../services/servicesService';
import templateService from '../../services/templateService';
import { formatPhone } from '../../utils/formatters';

const B = 'campaigns';
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const SendIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const UsersIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const WhatsAppIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
const RefreshIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>;
const FilterIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>;
const ChevronDown = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>;
const ChevronRight = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>;
const ArrowLeft = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
const MegaphoneIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const TemplateIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>;
const RocketIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>;
const UserCheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>;
const XCircleIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
const CheckCircleIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const AlertIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'Todas' },
  { id: 'recordatorio', name: 'Recordatorio' },
  { id: 'post_servicio', name: 'Post-Servicio' },
  { id: 'reactivacion', name: 'Reactivacion' },
  { id: 'fidelizacion', name: 'Fidelizacion' },
  { id: 'promocion', name: 'Promocion' },
  { id: 'bienvenida', name: 'Bienvenida' },
];

const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: '#64748B', bg: 'rgba(100,116,139,0.08)', icon: EditIcon },
  pending: { label: 'En revision', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: ClockIcon },
  approved: { label: 'Aprobada', color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: CheckCircleIcon },
  rejected: { label: 'Rechazada', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: XCircleIcon },
};
const FilterGroupIcons = {
  status: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8 12l2 2 4-4" /></svg>,
  activity: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  service: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
  financial: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  personal: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  dates: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  payment: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
};
const FILTER_GROUPS = [
  {
    id: 'staff',
    label: 'Profesional',
    icon: 'service',
    filters: [
      { key: 'staff_ids', type: 'staff_multi', label: 'Atendido por' },
    ],
  },
  {
    id: 'service',
    label: 'Servicio',
    icon: 'service',
    filters: [
      { key: 'service_names', type: 'service_multi', label: 'Servicio utilizado' },
    ],
  },
  {
    id: 'financial',
    label: 'Gasto',
    icon: 'financial',
    filters: [
      { key: 'min_spent', type: 'number', label: 'Gasto mínimo (COP)', placeholder: 'Ej: 100000' },
      { key: 'max_spent', type: 'number', label: 'Gasto máximo (COP)', placeholder: 'Ej: 1000000' },
    ],
  },
  {
    id: 'dates',
    label: 'Periodo',
    icon: 'dates',
    filters: [
      { key: 'last_visit_from', type: 'date', label: 'Desde' },
      { key: 'last_visit_to', type: 'date', label: 'Hasta' },
    ],
  },
];

const QUICK_SEGMENTS = [
  { label: 'Todos los clientes', filters: {}, desc: 'Sin filtros, todos los contactos' },
  { label: 'Clientes VIP', filters: { status: 'vip' }, desc: 'Tus mejores clientes por frecuencia y gasto' },
  { label: 'En riesgo', filters: { status: 'en_riesgo' }, desc: 'Pueden dejar de venir pronto' },
  { label: 'Inactivos +30 dias', filters: { days_inactive: 30 }, desc: 'No han venido en el ultimo mes' },
  { label: 'Inactivos +60 dias', filters: { days_inactive: 60 }, desc: 'No han venido en 2 meses' },
  { label: 'Inactivos +90 dias', filters: { days_inactive: 90 }, desc: 'No han venido en 3 meses' },
  { label: 'Nuevos (1 visita)', filters: { max_visits: 1 }, desc: 'Solo han venido una vez' },
  { label: 'Frecuentes (5+)', filters: { min_visits: 5 }, desc: 'Han venido 5 o mas veces' },
  { label: 'Cumpleaneros', filters: { birthday_month: true }, desc: 'Cumplen anos este mes' },
  { label: 'Alto valor (top 20%)', filters: { top_spenders_pct: 20 }, desc: 'El 20% que mas gasta' },
  { label: 'Mejores clientes', filters: { rfm_segment: 'vip' }, desc: 'Frecuentes, recientes y alto gasto' },
  { label: 'Clientes fieles', filters: { rfm_segment: 'leal' }, desc: 'Vienen seguido y hace poco' },
  { label: 'Se nos estan yendo', filters: { rfm_segment: 'prioritario' }, desc: 'Eran frecuentes pero dejaron de venir' },
  { label: 'Pueden gastar mas', filters: { rfm_segment: 'potencial' }, desc: 'Gastan bien, pueden venir mas seguido' },
];

const SendDetailCollapsible = ({ sendLog, sendingActive, sendCurrent, logEndRef }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${B}__sending-detail`}>
      <button className={`${B}__sending-detail-toggle`} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown /> : <ChevronRight />}
        {open ? 'Ocultar detalle' : 'Ver detalle'}
        {sendLog.length > 0 && <span className={`${B}__sending-detail-count`}>{sendLog.length}</span>}
      </button>
      {open && (
        <div className={`${B}__sending-log-entries`}>
          {sendLog.map((entry, i) => (
            <div key={i} className={`${B}__log-entry ${B}__log-entry--${entry.status}`}>
              <span className={`${B}__log-icon`}>
                {entry.status === 'sent' ? <CheckCircleIcon /> : <XCircleIcon />}
              </span>
              <span className={`${B}__log-name`}>{entry.name}</span>
              {entry.status === 'sent' ? (
                <span className={`${B}__log-result ${B}__log-result--ok`}>Enviado</span>
              ) : (
                <span className={`${B}__log-result ${B}__log-result--fail`}>No se pudo enviar</span>
              )}
            </div>
          ))}
          {sendingActive && sendCurrent && (
            <div className={`${B}__log-entry ${B}__log-entry--active`}>
              <div className={`${B}__queue-spinner`} />
              <span className={`${B}__log-name`}>{sendCurrent.name}</span>
              <span className={`${B}__log-result ${B}__log-result--sending`}>Enviando...</span>
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
};

const ConfirmWithCountdown = ({ modal, onClose }) => {
  const [countdown, setCountdown] = useState(modal.countdown || 0);
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);
  const label = modal.confirmLabel || 'Confirmar';
  return (
    <div className={`${B}__overlay`} onClick={onClose}>
      <div className={`${B}__confirm`} onClick={e => e.stopPropagation()}>
        <p>{modal.message}</p>
        <div className={`${B}__confirm-actions`}>
          <button className={`${B}__btn-secondary`} onClick={onClose}>Cancelar</button>
          <button className={`${B}__btn-primary`} disabled={countdown > 0} onClick={() => { onClose(); modal.onConfirm(); }}>
            {countdown > 0 ? `${label} (${countdown})` : label}
          </button>
        </div>
      </div>
    </div>
  );
};

const formatCOP = (n) => {
  if (!n) return '$0';
  return '$' + Number(n).toLocaleString('es-CO');
};
const Campaigns = () => {
  const { addNotification } = useNotification();

  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mainTab, setMainTab] = useState('templates');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const [showEditor, setShowEditor] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('promocion');
  const [editBody, setEditBody] = useState('');
  const [editHeaderType, setEditHeaderType] = useState('');
  const [editHeaderMedia, setEditHeaderMedia] = useState(null); // { file, preview }
  const [editHeaderText, setEditHeaderText] = useState('');

  const [sendStep, setSendStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [filters, setFilters] = useState({});
  const [staffFilterSearch, setStaffFilterSearch] = useState('');
  const [serviceFilterSearch, setServiceFilterSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(['status']);
  const [audienceResults, setAudienceResults] = useState(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [contactSearch, setContactSearch] = useState('');

  const { tenant } = useTenant();
  const waConnected = !!(tenant?.wa_access_token);

  const [sendingActive, setSendingActive] = useState(false);
  const [sendQueue, setSendQueue] = useState([]);
  const [sendCurrent, setSendCurrent] = useState(null);
  const [sendLog, setSendLog] = useState([]);
  const [sendStats, setSendStats] = useState({ sent: 0, failed: 0, total: 0 });
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const sendingRef = useRef(false);
  const logEndRef = useRef(null);

  const [confirmModal, setConfirmModal] = useState(null);
  const editBodyRef = useRef(null);

  const insertEditVar = (v) => {
    const ta = editBodyRef.current;
    const ins = `{{${v}}}`;
    if (!ta) { setEditBody(prev => prev + ins); return; }
    const s = ta.selectionStart, e = ta.selectionEnd;
    setEditBody(editBody.slice(0, s) + ins + editBody.slice(e));
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + ins.length; ta.focus(); }, 0);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [tpls, camps, staff, svcs] = await Promise.all([
          templateService.getTemplates(),
          campaignService.list(),
          staffService.list({}).catch(() => []),
          servicesService.list({}).catch(() => []),
        ]);
        setTemplates(Array.isArray(tpls) ? tpls : []);
        setCampaigns(Array.isArray(camps) ? camps : []);
        setStaffList(Array.isArray(staff) ? staff : []);
        setServicesList(Array.isArray(svcs) ? svcs : []);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const reloadTemplates = useCallback(async () => {
    try {
      const tpls = await templateService.getTemplates();
      setTemplates(Array.isArray(tpls) ? tpls : []);
    } catch {}
  }, []);

  const openNewTemplate = () => {
    setEditId(null);
    setEditName('');
    setEditCategory('promocion');
    setEditBody('');
    setEditHeaderType('');
    setEditHeaderMedia(null);
    setEditHeaderText('');
    setShowEditor(true);
  };

  const openEditTemplate = (t) => {
    setEditId(t.id);
    setEditName(t.name);
    setEditCategory(t.category || 'promocion');
    setEditBody(t.body || '');
    setEditHeaderType(t.header_type || '');
    setEditHeaderMedia(t.header_media_url ? { preview: t.header_media_url } : null);
    setEditHeaderText(t.header_text || '');
    setShowEditor(true);
  };

  const handleSaveTemplate = async () => {
    if (!editName.trim() || !editBody.trim()) {
      addNotification('Nombre y mensaje son requeridos', 'error');
      return;
    }
    // Convert header image to base64 data URI if provided
    let headerMediaUrl = null;
    if ((editHeaderType === 'IMAGE' || editHeaderType === 'VIDEO') && editHeaderMedia?.file) {
      headerMediaUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(editHeaderMedia.file);
      });
    } else if (editHeaderMedia?.preview && !editHeaderMedia?.file) {
      headerMediaUrl = editHeaderMedia.preview; // Already stored URL from edit
    }

    const payload = {
      name: editName, category: editCategory, body: editBody, status: 'draft',
      header_type: editHeaderType || null,
      header_media_url: headerMediaUrl,
      header_text: editHeaderType === 'TEXT' ? editHeaderText : null,
    };

    try {
      if (editId) {
        await templateService.updateTemplate(editId, payload);
        addNotification('Plantilla actualizada — debes enviarla a Meta de nuevo para aprobacion', 'success');
      } else {
        await templateService.createTemplate(payload);
        addNotification('Plantilla creada como borrador', 'success');
      }
      setShowEditor(false);
      reloadTemplates();
    } catch (e) {
      addNotification(e.message || 'Error guardando plantilla', 'error');
    }
  };

  const handleDeleteTemplate = (id) => {
    setConfirmModal({
      message: 'Eliminar esta plantilla? Se eliminará también de Meta si fue enviada.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await templateService.deleteTemplate(id);
          if (res?.meta_deleted) {
            addNotification('Plantilla eliminada de Meta y del sistema', 'success');
          } else if (res?.meta_error) {
            addNotification(`Eliminada localmente, pero falló en Meta: ${res.meta_error}`, 'warning');
          } else {
            addNotification('Plantilla eliminada', 'success');
          }
          reloadTemplates();
        } catch (e) {
          addNotification(e.message, 'error');
        }
      },
    });
  };

  const handleSubmitToMeta = async (id) => {
    setActionLoading(id);
    try {
      await templateService.submitToMeta(id);
      addNotification('Plantilla enviada a Meta para revision', 'success');
      reloadTemplates();
    } catch (e) {
      addNotification(e.message || 'Error enviando a Meta', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckStatus = async (id) => {
    setActionLoading(id);
    try {
      const res = await templateService.checkMetaStatus(id);
      addNotification(`Estado: ${res.status || 'sin cambios'}`, 'info');
      reloadTemplates();
    } catch (e) {
      addNotification(e.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredTemplates = useMemo(() => {
    let list = [...templates];
    if (templateFilter !== 'all') {
      list = list.filter(t => t.category === templateFilter);
    }
    if (templateSearch) {
      const s = templateSearch.toLowerCase();
      list = list.filter(t => (t.name || '').toLowerCase().includes(s) || (t.body || '').toLowerCase().includes(s));
    }
    return list;
  }, [templates, templateFilter, templateSearch]);

  const stats = useMemo(() => ({
    total: templates.length,
    approved: templates.filter(t => t.status === 'approved').length,
    pending: templates.filter(t => t.status === 'pending').length,
    drafts: templates.filter(t => t.status === 'draft').length,
    totalSent: campaigns.reduce((a, c) => a + (c.sent_count || 0), 0),
  }), [templates, campaigns]);

  const handleSearchAudience = async () => {
    setAudienceLoading(true);
    try {
      const cleanFilters = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined && v !== false) cleanFilters[k] = v;
      });
      const res = await campaignService.searchAudience(cleanFilters);
      setAudienceResults(res);
      const ids = new Set((res.contacts || []).map(c => c.id));
      setSelectedContacts(ids);
    } catch (e) {
      addNotification(e.message || 'Error buscando audiencia', 'error');
    } finally {
      setAudienceLoading(false);
    }
  };

  const handleApplyQuickSegment = (seg) => {
    setFilters(seg.filters);
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev =>
      prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
    );
  };

  const updateFilter = (key, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value === '' || value === null || value === undefined || value === false) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const activeFilterCount = useMemo(() => {
    return Object.keys(filters).filter(k => filters[k] !== '' && filters[k] !== null && filters[k] !== undefined).length;
  }, [filters]);

  const startSending = async () => {
    if (!selectedTemplate || selectedContacts.size === 0) return;

    let campId = null;
    try {
      const camp = await campaignService.create({
        name: `${selectedTemplate.name} — ${new Date().toLocaleString('es-CO')}`,
        campaign_type: 'custom',
        message_body: selectedTemplate.body,
        meta_template_name: selectedTemplate.slug,
        segment_filters: filters,
      });
      campId = camp.id;
      setActiveCampaignId(campId);
    } catch {}

    const seenIds = new Set();
    const contacts = (audienceResults?.contacts || []).filter(c => {
      if (!selectedContacts.has(c.id) || seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });
    const queue = contacts.map(c => ({ id: c.id, name: c.name, phone: c.phone, status: 'pending' }));
    setSendQueue(queue);
    setSendLog([]);
    setSendStats({ sent: 0, failed: 0, total: queue.length });
    setSendingActive(true);
    setSendStep(3);
    sendingRef.current = true;

    for (let i = 0; i < queue.length; i++) {
      if (!sendingRef.current) break;
      const contact = queue[i];

      setSendCurrent(contact);
      setSendQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'sending' } : q));

      try {
        const res = await campaignService.sendOne({
          client_id: contact.id,
          template_slug: selectedTemplate.slug,
          message_body: selectedTemplate.body,
          campaign_id: campId,
        });

        const newStatus = res.success ? 'sent' : 'failed';
        const logEntry = {
          ...contact,
          status: newStatus,
          time: new Date().toLocaleTimeString('es-CO'),
          error: res.error || null,
        };

        setSendQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: newStatus } : q));
        setSendLog(prev => [...prev, logEntry]);
        setSendStats(prev => ({
          ...prev,
          sent: prev.sent + (res.success ? 1 : 0),
          failed: prev.failed + (res.success ? 0 : 1),
        }));
      } catch (e) {
        const logEntry = { ...contact, status: 'failed', time: new Date().toLocaleTimeString('es-CO'), error: e.message };
        setSendQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'failed' } : q));
        setSendLog(prev => [...prev, logEntry]);
        setSendStats(prev => ({ ...prev, failed: prev.failed + 1 }));
      }

      await new Promise(r => setTimeout(r, 300));
    }

    setSendCurrent(null);
    setSendingActive(false);
    sendingRef.current = false;
  };

  const stopSending = () => {
    sendingRef.current = false;
    setSendingActive(false);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sendLog]);

  const resetSendFlow = () => {
    setSendStep(0);
    setSelectedTemplate(null);
    setFilters({});
    setAudienceResults(null);
    setSelectedContacts(new Set());
    setContactSearch('');
    setSendQueue([]);
    setSendLog([]);
    setSendStats({ sent: 0, failed: 0, total: 0 });
    setSendingActive(false);
    setActiveCampaignId(null);
  };

  const filteredContacts = useMemo(() => {
    if (!audienceResults?.contacts) return [];
    if (!contactSearch) return audienceResults.contacts;
    const s = contactSearch.toLowerCase();
    return audienceResults.contacts.filter(c =>
      (c.name || '').toLowerCase().includes(s) || (c.phone || '').includes(s)
    );
  }, [audienceResults, contactSearch]);

  if (loading) {
    return <div className={B}><div className={`${B}__loading`}><div className={`${B}__loading-spinner`} /><span>Cargando sistema de campañas...</span></div></div>;
  }

  return (
    <div className={B}>
      <div className={`${B}__header`}>
        <div className={`${B}__header-left`}>
          <h1 className={`${B}__title`}>Campañas</h1>
          <span className={`${B}__subtitle`}>CENTRO DE MARKETING · WHATSAPP BUSINESS</span>
        </div>
        <div className={`${B}__header-actions`}>
          {mainTab === 'templates' && (
            <button className={`${B}__btn-create`} onClick={openNewTemplate} disabled={!waConnected}>
              <PlusIcon /> Nueva plantilla
            </button>
          )}
        </div>
      </div>
      {!waConnected && (
        <div className={`${B}__wa-disconnected`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>
            <strong>WhatsApp no conectado</strong>
            <p>Conecta tu cuenta de WhatsApp Business en Configuración para ver y enviar plantillas de campañas.</p>
          </div>
        </div>
      )}
      <div className={`${B}__kpis`}>
        {[
          { value: waConnected ? stats.total : 0, label: 'Total plantillas', color: '#1E40AF' },
          { value: waConnected ? stats.approved : 0, label: 'Aprobadas', color: '#10B981' },
          { value: waConnected ? stats.pending : 0, label: 'En revision', color: '#F59E0B' },
          { value: stats.totalSent, label: 'Mensajes enviados', color: '#6366F1' },
        ].map((kpi, i) => (
          <div key={i} className={`${B}__kpi`}>
            <div className={`${B}__kpi-indicator`} style={{ background: kpi.color }} />
            <div className={`${B}__kpi-content`}>
              <span className={`${B}__kpi-value`}>{kpi.value}</span>
              <span className={`${B}__kpi-label`}>{kpi.label}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={`${B}__tabs`}>
        <button className={`${B}__tab ${B}__tab--active`}>
          <TemplateIcon /> Plantillas
          <span className={`${B}__tab-badge`}>{templates.length}</span>
        </button>
      </div>
      {mainTab === 'templates' && (
        <div className={`${B}__templates`}>
          <div className={`${B}__toolbar`}>
            <div className={`${B}__search-box`}>
              <SearchIcon />
              <input
                type="text"
                placeholder="Buscar plantilla..."
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
              />
            </div>
            <div className={`${B}__category-pills`}>
              {TEMPLATE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`${B}__pill ${templateFilter === cat.id ? `${B}__pill--active` : ''}`}
                  onClick={() => setTemplateFilter(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
          {filteredTemplates.length === 0 ? (
            <EmptyState
              icon={<MegaphoneIcon />}
              title="Sin plantillas"
              description="Crea tu primera plantilla para enviar mensajes masivos por WhatsApp"
            />
          ) : (
            <div className={`${B}__tpl-grid`}>
              {filteredTemplates.map(t => {
                const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.draft;
                const StatusIcon = st.icon;
                return (
                  <div key={t.id} className={`${B}__tpl-card ${!waConnected ? `${B}__tpl-card--disabled` : ''}`}>
                    <div className={`${B}__tpl-card-top`}>
                      <div className={`${B}__tpl-card-meta`}>
                        <span className={`${B}__tpl-card-category`}>{t.category || 'general'}</span>
                        <span className={`${B}__tpl-card-status`} style={{ color: st.color, background: st.bg }}>
                          <StatusIcon /> {st.label}
                        </span>
                      </div>
                      <h3 className={`${B}__tpl-card-name`}>{t.name}</h3>
                    </div>

                    <div className={`${B}__tpl-card-body`}>
                      <div className={`${B}__tpl-card-preview`}>
                        <WhatsAppIcon />
                        <p>{(t.body || '').length > 140 ? t.body.slice(0, 140) + '...' : t.body}</p>
                      </div>
                    </div>

                    <div className={`${B}__tpl-card-footer`}>
                      {t.status === 'draft' && (
                        <>
                          <button className={`${B}__tpl-btn ${B}__tpl-btn--meta`} onClick={() => handleSubmitToMeta(t.id)} disabled={actionLoading === t.id}>
                            <SendIcon /> {actionLoading === t.id ? 'Enviando...' : 'Enviar a Meta'}
                          </button>
                          <button className={`${B}__tpl-btn ${B}__tpl-btn--edit`} onClick={() => openEditTemplate(t)}>
                            <EditIcon />
                          </button>
                          <button className={`${B}__tpl-btn ${B}__tpl-btn--delete`} onClick={() => handleDeleteTemplate(t.id)}>
                            <TrashIcon />
                          </button>
                        </>
                      )}
                      {t.status === 'pending' && (
                        <button className={`${B}__tpl-btn ${B}__tpl-btn--check`} onClick={() => handleCheckStatus(t.id)} disabled={actionLoading === t.id}>
                          <RefreshIcon /> {actionLoading === t.id ? 'Verificando...' : 'Verificar estado'}
                        </button>
                      )}
                      {t.status === 'approved' && (
                        <>
                          <button className={`${B}__tpl-btn ${B}__tpl-btn--send`} onClick={() => { setMainTab('send'); setSelectedTemplate(t); setSendStep(1); }}>
                            <RocketIcon /> Usar en campaña
                          </button>
                          <button className={`${B}__tpl-btn ${B}__tpl-btn--edit`} onClick={() => openEditTemplate(t)}>
                            <EditIcon />
                          </button>
                          <button className={`${B}__tpl-btn ${B}__tpl-btn--delete`} onClick={() => handleDeleteTemplate(t.id)}>
                            <TrashIcon />
                          </button>
                        </>
                      )}
                      {t.status === 'rejected' && (
                        <>
                          <button className={`${B}__tpl-btn ${B}__tpl-btn--meta`} onClick={() => handleSubmitToMeta(t.id)} disabled={actionLoading === t.id}>
                            <RefreshIcon /> Reenviar a Meta
                          </button>
                          <button className={`${B}__tpl-btn ${B}__tpl-btn--edit`} onClick={() => openEditTemplate(t)}>
                            <EditIcon />
                          </button>
                          <button className={`${B}__tpl-btn ${B}__tpl-btn--delete`} onClick={() => handleDeleteTemplate(t.id)}>
                            <TrashIcon />
                          </button>
                        </>
                      )}
                      <span className={`${B}__tpl-card-hint ${B}__tpl-card-hint--${t.status}`}>
                        {t.status === 'draft' && 'Envia a Meta para revision (tarda 1-24 horas)'}
                        {t.status === 'pending' && 'Meta esta revisando tu plantilla. Puede tardar 1-24 horas'}
                        {t.status === 'rejected' && 'Meta rechazo esta plantilla. Edita el mensaje y reintenta'}
                        {t.status === 'approved' && 'Lista para enviar a tus clientes'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {mainTab === 'send' && (
        <div className={`${B}__send`}>
          <div className={`${B}__steps`}>
            {['Plantilla', 'Audiencia', 'Contactos', 'Envio'].map((label, i) => (
              <div key={i} className={`${B}__step ${sendStep >= i ? `${B}__step--active` : ''} ${sendStep === i ? `${B}__step--current` : ''}`}>
                <div className={`${B}__step-dot`}>{sendStep > i ? <CheckIcon /> : i + 1}</div>
                <span className={`${B}__step-label`}>{label}</span>
                {i < 3 && <div className={`${B}__step-line`} />}
              </div>
            ))}
          </div>
          {sendStep === 0 && (
            <div className={`${B}__send-section`}>
              <div className={`${B}__send-section-header`}>
                <h2>Selecciona una plantilla aprobada</h2>
                <p>Solo las plantillas aprobadas por Meta pueden usarse para envio masivo</p>
              </div>
              {(() => {
                const approved = templates.filter(t => t.status === 'approved');
                if (approved.length === 0) return (
                  <EmptyState
                    icon={<AlertIcon />}
                    title="Sin plantillas aprobadas"
                    description="Primero crea y envia plantillas a Meta para aprobacion desde la pestana de Plantillas"
                  />
                );
                return (
                  <div className={`${B}__tpl-select-grid`}>
                    {approved.map(t => (
                      <div
                        key={t.id}
                        className={`${B}__tpl-select-card ${selectedTemplate?.id === t.id ? `${B}__tpl-select-card--selected` : ''}`}
                        onClick={() => setSelectedTemplate(t)}
                      >
                        <div className={`${B}__tpl-select-card-check`}>
                          {selectedTemplate?.id === t.id && <CheckIcon />}
                        </div>
                        <h4>{t.name}</h4>
                        <p>{(t.body || '').length > 100 ? t.body.slice(0, 100) + '...' : t.body}</p>
                        <span className={`${B}__tpl-select-card-cat`}>{t.category}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className={`${B}__send-actions`}>
                <div />
                <button className={`${B}__btn-primary`} disabled={!selectedTemplate} onClick={() => setSendStep(1)}>
                  Siguiente: Definir audiencia <ChevronRight />
                </button>
              </div>
            </div>
          )}
          {sendStep === 1 && (
            <div className={`${B}__send-section`}>
              <div className={`${B}__send-section-header`}>
                <h2>Define tu audiencia</h2>
                <p>Usa filtros avanzados para seleccionar exactamente a quien quieres enviar</p>
              </div>

              <div className={`${B}__audience-layout`}>
                <div className={`${B}__filters-panel`}>
                  <div className={`${B}__quick-segments`}>
                    <h4>Segmentos rapidos</h4>
                    <div className={`${B}__quick-segments-grid`}>
                      {QUICK_SEGMENTS.map((seg, i) => (
                        <button
                          key={i}
                          className={`${B}__quick-seg-btn ${JSON.stringify(filters) === JSON.stringify(seg.filters) ? `${B}__quick-seg-btn--active` : ''}`}
                          onClick={() => handleApplyQuickSegment(seg)}
                          title={seg.desc}
                        >
                          {seg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${B}__filters-divider`}>
                    <span>Filtros avanzados</span>
                    {activeFilterCount > 0 && (
                      <button className={`${B}__filters-clear`} onClick={() => setFilters({})}>
                        Limpiar ({activeFilterCount})
                      </button>
                    )}
                  </div>
                  {FILTER_GROUPS.map(group => (
                    <div key={group.id} className={`${B}__filter-group ${expandedGroups.includes(group.id) ? `${B}__filter-group--open` : ''}`} data-group={group.id}>
                      <button className={`${B}__filter-group-header`} onClick={() => toggleGroup(group.id)}>
                        <span className={`${B}__filter-group-icon`}>{(() => { const Icon = FilterGroupIcons[group.icon]; return Icon ? <Icon /> : null; })()}</span>
                        <span className={`${B}__filter-group-label`}>{group.label}</span>
                        <span className={`${B}__filter-group-count`}>
                          {group.filters.filter(f => filters[f.key] !== undefined && filters[f.key] !== '' && filters[f.key] !== false).length || ''}
                        </span>
                        <span className={`${B}__filter-group-chevron`}>
                          {expandedGroups.includes(group.id) ? <ChevronDown /> : <ChevronRight />}
                        </span>
                      </button>
                      {expandedGroups.includes(group.id) && (
                        <div className={`${B}__filter-group-body`}>
                          {group.filters.map(f => (
                            <div key={f.key} className={`${B}__filter-field`}>
                              <label>{f.label}</label>
                              {f.type === 'select' && (
                                <select value={filters[f.key] || ''} onChange={e => updateFilter(f.key, e.target.value)}>
                                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              )}
                              {f.type === 'number' && (
                                <input
                                  type="number"
                                  placeholder={f.placeholder}
                                  value={filters[f.key] || ''}
                                  onChange={e => updateFilter(f.key, e.target.value ? Number(e.target.value) : '')}
                                />
                              )}
                              {f.type === 'date' && (
                                <input
                                  type="date"
                                  value={filters[f.key] || ''}
                                  onChange={e => updateFilter(f.key, e.target.value)}
                                />
                              )}
                              {f.type === 'checkbox' && (
                                <label className={`${B}__filter-checkbox`}>
                                  <input
                                    type="checkbox"
                                    checked={!!filters[f.key]}
                                    onChange={e => updateFilter(f.key, e.target.checked)}
                                  />
                                  <span>Activar</span>
                                </label>
                              )}
                              {f.type === 'staff_select' && (
                                <select value={filters[f.key] || ''} onChange={e => updateFilter(f.key, e.target.value ? Number(e.target.value) : '')}>
                                  <option value="">Todos</option>
                                  {staffList.filter(s => s.is_active).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              )}
                              {f.type === 'service_select' && (
                                <select value={filters[f.key] || ''} onChange={e => updateFilter(f.key, e.target.value)}>
                                  <option value="">Todos</option>
                                  {servicesList.filter(s => s.is_active).map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                  ))}
                                </select>
                              )}
                              {f.type === 'staff_multi' && (
                                <div className={`${B}__multi-check-wrap`}>
                                  <input type="text" className={`${B}__multi-search`} placeholder="Buscar profesional..." value={staffFilterSearch} onChange={e => setStaffFilterSearch(e.target.value)} />
                                <div className={`${B}__multi-check`}>
                                  {staffList.filter(s => s.is_active && (!staffFilterSearch || s.name.toLowerCase().includes(staffFilterSearch.toLowerCase()))).map(s => {
                                    const selected = Array.isArray(filters[f.key]) ? filters[f.key].includes(s.id) : false;
                                    return (
                                      <label key={s.id} className={`${B}__multi-check-item ${selected ? `${B}__multi-check-item--on` : ''}`}>
                                        <input type="checkbox" checked={selected} onChange={() => {
                                          const current = Array.isArray(filters[f.key]) ? filters[f.key] : [];
                                          updateFilter(f.key, selected ? current.filter(id => id !== s.id) : [...current, s.id]);
                                        }} />
                                        <span className={`${B}__multi-check-box`}>
                                          {selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                        </span>
                                        <span>{s.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                </div>
                              )}
                              {f.type === 'service_multi' && (
                                <div className={`${B}__multi-check-wrap`}>
                                  <input type="text" className={`${B}__multi-search`} placeholder="Buscar servicio..." value={serviceFilterSearch} onChange={e => setServiceFilterSearch(e.target.value)} />
                                <div className={`${B}__multi-check`}>
                                  {servicesList.filter(s => s.is_active && (!serviceFilterSearch || s.name.toLowerCase().includes(serviceFilterSearch.toLowerCase()))).map(s => {
                                    const selected = Array.isArray(filters[f.key]) ? filters[f.key].includes(s.name) : false;
                                    return (
                                      <label key={s.id} className={`${B}__multi-check-item ${selected ? `${B}__multi-check-item--on` : ''}`}>
                                        <input type="checkbox" checked={selected} onChange={() => {
                                          const current = Array.isArray(filters[f.key]) ? filters[f.key] : [];
                                          updateFilter(f.key, selected ? current.filter(n => n !== s.name) : [...current, s.name]);
                                        }} />
                                        <span className={`${B}__multi-check-box`}>
                                          {selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                        </span>
                                        <span>{s.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className={`${B}__audience-preview`}>
                  <div className={`${B}__preview-header`}>
                    <FilterIcon />
                    <h3>Vista previa</h3>
                  </div>

                  <div className={`${B}__preview-selected-template`}>
                    <span className={`${B}__preview-label`}>Plantilla:</span>
                    <span className={`${B}__preview-value`}>{selectedTemplate?.name}</span>
                  </div>

                  <div className={`${B}__preview-filters-summary`}>
                    {activeFilterCount === 0 ? (
                      <p className={`${B}__preview-hint`}>Aplica filtros para ver cuantos clientes coinciden</p>
                    ) : (
                      <p>{activeFilterCount} filtro{activeFilterCount !== 1 ? 's' : ''} activo{activeFilterCount !== 1 ? 's' : ''}</p>
                    )}
                  </div>

                  <button className={`${B}__btn-search-audience`} onClick={handleSearchAudience} disabled={audienceLoading}>
                    {audienceLoading ? (
                      <><div className={`${B}__mini-spinner`} /> Buscando...</>
                    ) : (
                      <><SearchIcon /> Buscar audiencia</>
                    )}
                  </button>

                  {audienceResults && (
                    <div className={`${B}__preview-result`}>
                      <div className={`${B}__preview-result-count`}>
                        <UsersIcon />
                        <span className={`${B}__preview-result-number`}>{audienceResults.count}</span>
                        <span>contactos encontrados</span>
                      </div>
                      {audienceResults.count > 0 && (
                        <div className={`${B}__preview-result-sample`}>
                          {(audienceResults.contacts || []).slice(0, 5).map(c => (
                            <div key={c.id} className={`${B}__preview-contact-mini`}>
                              <span className={`${B}__preview-contact-name`}>{c.name}</span>
                              <span className={`${B}__preview-contact-info`}>{c.total_visits} visitas · {formatCOP(c.total_spent)}</span>
                            </div>
                          ))}
                          {audienceResults.count > 5 && (
                            <span className={`${B}__preview-more`}>+{audienceResults.count - 5} mas...</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={`${B}__send-actions`}>
                <button className={`${B}__btn-secondary`} onClick={() => setSendStep(0)}>
                  <ArrowLeft /> Atras
                </button>
                <button
                  className={`${B}__btn-primary`}
                  disabled={!audienceResults || audienceResults.count === 0}
                  onClick={() => setSendStep(2)}
                >
                  Siguiente: Revisar contactos ({audienceResults?.count || 0}) <ChevronRight />
                </button>
              </div>
            </div>
          )}
          {sendStep === 2 && (
            <div className={`${B}__send-section`}>
              <div className={`${B}__contacts-action-bar`}>
                <button className={`${B}__btn-secondary`} onClick={() => setSendStep(1)}>
                  <ArrowLeft /> Atras
                </button>
                <div className={`${B}__contacts-action-bar-center`}>
                  <span className={`${B}__contacts-selected-count`}>
                    <UserCheckIcon /> {selectedContacts.size} de {audienceResults?.count || 0} seleccionados
                  </span>
                  <button className={`${B}__btn-text`} onClick={() => setSelectedContacts(new Set((audienceResults?.contacts || []).map(c => c.id)))}>
                    Todos
                  </button>
                  <button className={`${B}__btn-text`} onClick={() => setSelectedContacts(new Set())}>
                    Ninguno
                  </button>
                </div>
                <button
                  className={`${B}__btn-primary ${B}__btn-primary--send`}
                  disabled={selectedContacts.size === 0}
                  onClick={() => setConfirmModal({
                    message: `Esto enviara un mensaje de WhatsApp a ${selectedContacts.size} persona${selectedContacts.size === 1 ? '' : 's'}. Esta accion no se puede deshacer.`,
                    confirmLabel: 'Si, enviar',
                    countdown: 3,
                    onConfirm: () => startSending(),
                  })}
                >
                  <SendIcon /> Enviar a {selectedContacts.size} contactos
                </button>
              </div>

              <div className={`${B}__contacts-toolbar`}>
                <div className={`${B}__search-box`}>
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o telefono..."
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className={`${B}__contacts-table`}>
                <div className={`${B}__contacts-header-row`}>
                  <div className={`${B}__contacts-col ${B}__contacts-col--check`} />
                  <div className={`${B}__contacts-col ${B}__contacts-col--name`}>Cliente</div>
                  <div className={`${B}__contacts-col ${B}__contacts-col--phone`}>Telefono</div>
                  <div className={`${B}__contacts-col ${B}__contacts-col--status`}>Estado</div>
                  <div className={`${B}__contacts-col ${B}__contacts-col--visits`}>Visitas</div>
                  <div className={`${B}__contacts-col ${B}__contacts-col--spent`}>Gasto total</div>
                  <div className={`${B}__contacts-col ${B}__contacts-col--days`}>Dias sin venir</div>
                </div>
                <div className={`${B}__contacts-body`}>
                  {filteredContacts.map(c => (
                    <div
                      key={c.id}
                      className={`${B}__contacts-row ${selectedContacts.has(c.id) ? '' : `${B}__contacts-row--deselected`}`}
                      onClick={() => {
                        setSelectedContacts(prev => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        });
                      }}
                    >
                      <div className={`${B}__contacts-col ${B}__contacts-col--check`}>
                        <div className={`${B}__checkbox ${selectedContacts.has(c.id) ? `${B}__checkbox--checked` : ''}`}>
                          {selectedContacts.has(c.id) && <CheckIcon />}
                        </div>
                      </div>
                      <div className={`${B}__contacts-col ${B}__contacts-col--name`}>
                        <span className={`${B}__contact-name`}>{c.name}</span>
                      </div>
                      <div className={`${B}__contacts-col ${B}__contacts-col--phone`}>{formatPhone(c.phone)}</div>
                      <div className={`${B}__contacts-col ${B}__contacts-col--status`}>
                        <span className={`${B}__contact-status ${B}__contact-status--${c.status}`}>{c.status}</span>
                      </div>
                      <div className={`${B}__contacts-col ${B}__contacts-col--visits`}>{c.total_visits}</div>
                      <div className={`${B}__contacts-col ${B}__contacts-col--spent`}>{formatCOP(c.total_spent)}</div>
                      <div className={`${B}__contacts-col ${B}__contacts-col--days`}>
                        {c.days_since !== null ? `${c.days_since}d` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {sendStep === 3 && (
            <div className={`${B}__sending-screen`}>
              <div className={`${B}__sending-hero`}>
                {sendingActive ? (
                  <div className={`${B}__sending-hero-icon ${B}__sending-hero-icon--active`}>
                    <div className={`${B}__queue-spinner ${B}__queue-spinner--lg`} />
                  </div>
                ) : (
                  <div className={`${B}__sending-hero-icon ${B}__sending-hero-icon--done`}>
                    {sendStats.failed === 0 ? <CheckCircleIcon /> : <AlertIcon />}
                  </div>
                )}
                <h2>{sendingActive ? 'Enviando campaña...' : (sendStats.failed === 0 ? 'Campaña enviada' : 'Envio completado')}</h2>
                <p className={`${B}__sending-hero-counter`}>
                  {sendingActive
                    ? `${sendStats.sent + sendStats.failed} de ${sendStats.total}`
                    : `${sendStats.sent} mensaje${sendStats.sent !== 1 ? 's' : ''} enviado${sendStats.sent !== 1 ? 's' : ''}`
                  }
                </p>
                <div className={`${B}__sending-progress`}>
                  <div
                    className={`${B}__sending-progress-bar ${!sendingActive ? `${B}__sending-progress-bar--done` : ''}`}
                    style={{ width: sendStats.total > 0 ? `${((sendStats.sent + sendStats.failed) / sendStats.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div className={`${B}__sending-cards`}>
                <div className={`${B}__sending-card ${B}__sending-card--sent`}>
                  <CheckCircleIcon />
                  <span className={`${B}__sending-card-num`}>{sendStats.sent}</span>
                  <span className={`${B}__sending-card-label`}>Enviados</span>
                </div>
                <div className={`${B}__sending-card ${B}__sending-card--failed`}>
                  <XCircleIcon />
                  <span className={`${B}__sending-card-num`}>{sendStats.failed}</span>
                  <span className={`${B}__sending-card-label`}>Fallidos</span>
                </div>
                <div className={`${B}__sending-card ${B}__sending-card--total`}>
                  <UsersIcon />
                  <span className={`${B}__sending-card-num`}>{sendStats.total}</span>
                  <span className={`${B}__sending-card-label`}>Total</span>
                </div>
              </div>

              <SendDetailCollapsible sendLog={sendLog} sendingActive={sendingActive} sendCurrent={sendCurrent} logEndRef={logEndRef} />

              <div className={`${B}__send-actions`}>
                {sendingActive ? (
                  <button className={`${B}__btn-danger`} onClick={stopSending}>
                    Detener envio
                  </button>
                ) : (
                  <button className={`${B}__btn-primary`} onClick={() => { resetSendFlow(); }}>
                    Nueva campaña
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {showEditor && createPortal(
        <div className={`${B}__overlay`} onClick={() => setShowEditor(false)}>
          <div className={`${B}__editor`} onClick={e => e.stopPropagation()}>
            <div className={`${B}__editor-header`}>
              <h2>{editId ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
              <button className={`${B}__editor-close`} onClick={() => setShowEditor(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className={`${B}__editor-body`}>
              <div className={`${B}__editor-field`}>
                <label>Nombre de la plantilla</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Ej: Promocion de semana"
                />
              </div>

              <div className={`${B}__editor-field`}>
                <label>Categoria</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                  <option value="recordatorio">Recordatorio</option>
                  <option value="post_servicio">Post-Servicio</option>
                  <option value="reactivacion">Reactivacion</option>
                  <option value="fidelizacion">Fidelizacion</option>
                  <option value="promocion">Promocion</option>
                  <option value="bienvenida">Bienvenida</option>
                </select>
              </div>

              <div className={`${B}__editor-field`}>
                <label>Encabezado (opcional)</label>
                <select value={editHeaderType} onChange={e => { setEditHeaderType(e.target.value); setEditHeaderMedia(null); setEditHeaderText(''); }} style={{ marginBottom: 8 }}>
                  <option value="">Sin encabezado</option>
                  <option value="IMAGE">Imagen</option>
                  <option value="VIDEO">Video</option>
                  <option value="TEXT">Texto</option>
                </select>
                {editHeaderType === 'IMAGE' && (
                  <div className={`${B}__editor-media-upload`}>
                    {editHeaderMedia?.preview ? (
                      <div className={`${B}__editor-media-preview`}>
                        <img src={editHeaderMedia.preview} alt="" />
                        <button onClick={() => setEditHeaderMedia(null)} className={`${B}__editor-media-remove`}><CloseIcon /></button>
                      </div>
                    ) : (
                      <label className={`${B}__editor-media-btn`}>
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setEditHeaderMedia({ file, preview: URL.createObjectURL(file) });
                          e.target.value = '';
                        }} />
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        Seleccionar imagen
                      </label>
                    )}
                    <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 4 }}>Meta revisara la imagen junto con la plantilla. Max 5MB, JPG/PNG.</p>
                  </div>
                )}
                {editHeaderType === 'VIDEO' && (
                  <div className={`${B}__editor-media-upload`}>
                    {editHeaderMedia?.preview ? (
                      <div className={`${B}__editor-media-preview`}>
                        <video src={editHeaderMedia.preview} style={{ width: 200, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }} muted />
                        <button onClick={() => { if (editHeaderMedia.preview) URL.revokeObjectURL(editHeaderMedia.preview); setEditHeaderMedia(null); }} className={`${B}__editor-media-remove`}><CloseIcon /></button>
                      </div>
                    ) : (
                      <label className={`${B}__editor-media-btn`}>
                        <input type="file" accept="video/mp4,video/*" style={{ display: 'none' }} onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 16 * 1024 * 1024) { alert('Video muy grande (max 16MB)'); return; }
                            setEditHeaderMedia({ file, preview: URL.createObjectURL(file) });
                          }
                          e.target.value = '';
                        }} />
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                        Seleccionar video
                      </label>
                    )}
                    <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 4 }}>MP4, max 16MB. Meta lo revisara junto con la plantilla.</p>
                  </div>
                )}
                {editHeaderType === 'TEXT' && (
                  <input type="text" value={editHeaderText} onChange={e => setEditHeaderText(e.target.value)} placeholder="Texto del encabezado" maxLength={60} />
                )}
              </div>

              <div className={`${B}__editor-field`}>
                <label>Mensaje</label>
                <textarea
                  ref={editBodyRef}
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  placeholder="Hola {{nombre}}, te esperamos en..."
                  rows={6}
                />
                <div className={`${B}__editor-vars`}>
                  {[
                    { key: 'nombre', tip: 'Primer nombre del cliente' },
                    { key: 'servicio', tip: 'Servicio favorito' },
                    { key: 'dias', tip: 'Dias sin venir' },
                    { key: 'negocio', tip: 'Nombre de tu negocio' },
                    { key: 'profesional', tip: 'Profesional preferido' },
                  ].map(v => (
                    <button key={v.key} type="button" className={`${B}__editor-var-pill`} onClick={() => insertEditVar(v.key)} title={v.tip}>
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
                <div className={`${B}__editor-hint`}>
                  <span>Haz clic en una variable para insertarla en el mensaje</span>
                  <span>{editBody.length} caracteres</span>
                </div>
              </div>

              {editBody && (
                <div className={`${B}__editor-preview`}>
                  <span className={`${B}__editor-preview-label`}>Vista previa WhatsApp</span>
                  <div className={`${B}__editor-preview-bubble`}>
                    {editHeaderType === 'IMAGE' && editHeaderMedia?.preview && (
                      <img src={editHeaderMedia.preview} alt="" style={{ width: '100%', borderRadius: '8px 8px 0 0', maxHeight: 180, objectFit: 'cover', marginBottom: 8 }} />
                    )}
                    {editHeaderType === 'VIDEO' && editHeaderMedia?.preview && (
                      <video src={editHeaderMedia.preview} style={{ width: '100%', borderRadius: '8px 8px 0 0', maxHeight: 180, objectFit: 'cover', marginBottom: 8 }} muted controls />
                    )}
                    {editHeaderType === 'TEXT' && editHeaderText && (
                      <p style={{ fontWeight: 700, marginBottom: 4 }}>{editHeaderText}</p>
                    )}
                    <WhatsAppIcon />
                    <p>{editBody.replace(/\{\{nombre\}\}/g, 'Juan').replace(/\{\{servicio\}\}/g, 'Corte Clasico').replace(/\{\{dias\}\}/g, '30').replace(/\{\{negocio\}\}/g, 'Tu Negocio').replace(/\{\{profesional\}\}/g, 'Carlos')}</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`${B}__editor-footer`}>
              <button className={`${B}__btn-secondary`} onClick={() => setShowEditor(false)}>
                Cancelar
              </button>
              <button className={`${B}__btn-primary`} onClick={handleSaveTemplate}>
                {editId ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {confirmModal && createPortal(
        <ConfirmWithCountdown modal={confirmModal} onClose={() => setConfirmModal(null)} />,
        document.body
      )}
    </div>
  );
};

export default Campaigns;
