import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNotification } from '../../context/NotificationContext';
import svc from '../../services/automationStudioService';

const B = 'auto-studio';

// ═══════════════════════════════════════════════
// Professional SVG Icons (24x24 stroked)
// ═══════════════════════════════════════════════
const Icon = ({ d, size = 20, stroke = 'currentColor', fill = 'none', ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>{typeof d === 'string' ? <path d={d} /> : d}</svg>
);

const ZapIcon = (p) => <Icon {...p} d={<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none" />} />;
const PlusIcon = (p) => <Icon {...p} d={<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>} />;
const ClockIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>} />;
const CalendarIcon = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />;
const UsersIcon = (p) => <Icon {...p} d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />;
const UserPlusIcon = (p) => <Icon {...p} d={<><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>} />;
const GiftIcon = (p) => <Icon {...p} d={<><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>} />;
const StarIcon = (p) => <Icon {...p} d={<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />} />;
const AwardIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>} />;
const DollarIcon = (p) => <Icon {...p} d={<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>} />;
const XIcon = (p) => <Icon {...p} d={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} />;
const CheckIcon = (p) => <Icon {...p} d="M20 6L9 17l-5-5" />;
const ChevronRight = (p) => <Icon {...p} size={16} d="M9 18l6-6-6-6" />;
const ChevronLeft = (p) => <Icon {...p} size={16} d="M15 18l-6-6 6-6" />;
const SendIcon = (p) => <Icon {...p} d={<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>} />;
const CopyIcon = (p) => <Icon {...p} d={<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>} />;
const TrashIcon = (p) => <Icon {...p} d={<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>} />;
const EditIcon = (p) => <Icon {...p} d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>} />;
const HistoryIcon = (p) => <Icon {...p} d={<><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></>} />;
const PauseIcon = (p) => <Icon {...p} d={<><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>} />;
const PlayIcon = (p) => <Icon {...p} d={<polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />} />;
const FilterIcon = (p) => <Icon {...p} d={<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />} />;
const EyeIcon = (p) => <Icon {...p} d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>} />;
const MessageIcon = (p) => <Icon {...p} d={<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>} />;
const LinkIcon = (p) => <Icon {...p} d={<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>} />;
const AlertIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>} />;
const BarChartIcon = (p) => <Icon {...p} d={<><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>} />;
const WhatsAppIcon = (p) => <Icon {...p} size={16} fill="#25D366" stroke="none" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />;

// Trigger category icons
const TRIGGER_ICONS = {
  hours_before_appt: ClockIcon,
  hours_after_complete: CheckIcon,
  appointment_created: CalendarIcon,
  appointment_cancelled: XIcon,
  no_show: AlertIcon,
  days_since_visit: HistoryIcon,
  new_client: UserPlusIcon,
  birthday: GiftIcon,
  visit_milestone: StarIcon,
  client_anniversary: AwardIcon,
  payment_received: DollarIcon,
  payment_pending: DollarIcon,
};

const CATEGORY_META = {
  appointments: { label: 'Citas', color: '#3B82F6' },
  clients: { label: 'Clientes', color: '#8B5CF6' },
  payments: { label: 'Pagos', color: '#10B981' },
};

const META_STATUS = {
  draft: { label: 'Borrador', color: '#64748B', bg: 'rgba(100,116,139,0.08)' },
  pending: { label: 'En revisión', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  approved: { label: 'Aprobada', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  rejected: { label: 'Rechazada', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
};

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════

export default function AutomationStudio() {
  const { addNotification } = useNotification();
  const [view, setView] = useState('list'); // list | wizard | history
  const [automations, setAutomations] = useState([]);
  const [planInfo, setPlanInfo] = useState({ plan: 'trial', plan_limit: 3, active_count: 0 });
  const [stats, setStats] = useState(null);
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [historyRule, setHistoryRule] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, statsData, triggerData] = await Promise.all([
        svc.list(), svc.getStats(), svc.getTriggers(),
      ]);
      setAutomations(listData.automations || []);
      setPlanInfo({ plan: listData.plan, plan_limit: listData.plan_limit, active_count: listData.active_count });
      setStats(statsData);
      setTriggers(triggerData);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (rule) => {
    if (!rule.is_enabled && rule.meta_template_status !== 'approved') {
      addNotification('Primero envía la plantilla a Meta para poder activar', 'warning');
      return;
    }
    try {
      await svc.update(rule.id, { is_enabled: !rule.is_enabled });
      addNotification(rule.is_enabled ? 'Automatización pausada' : 'Automatización activada', 'success');
      load();
    } catch (e) { addNotification(e.message, 'error'); }
  };

  const handleDelete = async (rule) => {
    try {
      await svc.delete(rule.id);
      addNotification('Automatización eliminada', 'success');
      load();
    } catch (e) { addNotification(e.message, 'error'); }
  };

  const handleDuplicate = async (rule) => {
    try {
      await svc.duplicate(rule.id);
      addNotification('Automatización duplicada', 'success');
      load();
    } catch (e) { addNotification(e.message, 'error'); }
  };

  const handleSubmitMeta = async (rule) => {
    try {
      const res = await svc.submitToMeta(rule.id);
      addNotification(
        res.meta_status === 'approved' ? 'Plantilla aprobada por Meta' : 'Plantilla enviada a Meta — en revisión',
        res.meta_status === 'approved' ? 'success' : 'info'
      );
      load();
    } catch (e) { addNotification(e.message, 'error'); }
  };

  const handleCheckMeta = async (rule) => {
    try {
      const res = await svc.checkMetaStatus(rule.id);
      const msgs = { approved: 'Aprobada por Meta', pending: 'Aún en revisión', rejected: 'Rechazada por Meta' };
      addNotification(msgs[res.meta_status] || res.meta_status, res.meta_status === 'approved' ? 'success' : 'info');
      load();
    } catch (e) { addNotification(e.message, 'error'); }
  };

  const openWizard = (rule = null) => {
    setEditingRule(rule);
    setView('wizard');
  };

  const openHistory = (rule) => {
    setHistoryRule(rule);
    setView('history');
  };

  const closeWizard = () => {
    setEditingRule(null);
    setView('list');
    load();
  };

  if (loading) {
    return (
      <div className={B}>
        <div className={`${B}__loading`}>
          <div className={`${B}__spinner`} />
          <span>Cargando automatizaciones...</span>
        </div>
      </div>
    );
  }

  if (view === 'wizard') {
    return <AutomationWizard triggers={triggers} editingRule={editingRule} onClose={closeWizard} addNotification={addNotification} />;
  }

  if (view === 'history') {
    return <ExecutionHistory rule={historyRule} onBack={() => { setView('list'); setHistoryRule(null); }} />;
  }

  const active = automations.filter(a => a.is_enabled);
  const inactive = automations.filter(a => !a.is_enabled);

  return (
    <div className={B}>
      {/* Header */}
      <div className={`${B}__header`}>
        <div className={`${B}__header-left`}>
          <div className={`${B}__header-icon`}><ZapIcon size={22} /></div>
          <div>
            <h1 className={`${B}__title`}>Automatizaciones</h1>
            <p className={`${B}__subtitle`}>Crea flujos automáticos que trabajan por ti 24/7</p>
          </div>
        </div>
        <div className={`${B}__header-right`}>
          <div className={`${B}__plan-badge`}>
            <span className={`${B}__plan-count`}>{planInfo.active_count}</span>
            <span className={`${B}__plan-sep`}>/</span>
            <span className={`${B}__plan-limit`}>{planInfo.plan_limit}</span>
            <span className={`${B}__plan-label`}>activas</span>
          </div>
          <button className={`${B}__btn-create`} onClick={() => openWizard()}>
            <PlusIcon size={18} />
            <span>Crear automatización</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className={`${B}__stats`}>
          <div className={`${B}__stat`}>
            <ZapIcon size={16} />
            <div className={`${B}__stat-data`}>
              <span className={`${B}__stat-value`}>{stats.active_count}</span>
              <span className={`${B}__stat-label`}>Activas</span>
            </div>
          </div>
          <div className={`${B}__stat`}>
            <SendIcon size={16} />
            <div className={`${B}__stat-data`}>
              <span className={`${B}__stat-value`}>{stats.sent_this_month}</span>
              <span className={`${B}__stat-label`}>Este mes</span>
            </div>
          </div>
          <div className={`${B}__stat`}>
            <BarChartIcon size={16} />
            <div className={`${B}__stat-data`}>
              <span className={`${B}__stat-value`}>{stats.response_rate}%</span>
              <span className={`${B}__stat-label`}>Respuesta</span>
            </div>
          </div>
          <div className={`${B}__stat`}>
            <MessageIcon size={16} />
            <div className={`${B}__stat-data`}>
              <span className={`${B}__stat-value`}>{stats.sent_total}</span>
              <span className={`${B}__stat-label`}>Total enviados</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Automations */}
      {active.length > 0 && (
        <section className={`${B}__section`}>
          <h2 className={`${B}__section-title`}>Activas</h2>
          <div className={`${B}__grid`}>
            {active.map(a => (
              <AutomationCard key={a.id} rule={a}
                onToggle={handleToggle} onEdit={() => openWizard(a)} onDelete={handleDelete}
                onDuplicate={handleDuplicate} onSubmitMeta={handleSubmitMeta}
                onCheckMeta={handleCheckMeta} onHistory={() => openHistory(a)} />
            ))}
          </div>
        </section>
      )}

      {/* Inactive / Draft */}
      {inactive.length > 0 && (
        <section className={`${B}__section`}>
          <h2 className={`${B}__section-title`}>Borradores e inactivas</h2>
          <div className={`${B}__grid`}>
            {inactive.map(a => (
              <AutomationCard key={a.id} rule={a}
                onToggle={handleToggle} onEdit={() => openWizard(a)} onDelete={handleDelete}
                onDuplicate={handleDuplicate} onSubmitMeta={handleSubmitMeta}
                onCheckMeta={handleCheckMeta} onHistory={() => openHistory(a)} />
            ))}
          </div>
        </section>
      )}

      {/* Suggested Templates */}
      {automations.length < planInfo.plan_limit && (
        <SuggestedTemplates onUse={(tpl) => openWizard(tpl)} />
      )}

      {/* Empty State */}
      {automations.length === 0 && (
        <div className={`${B}__empty`}>
          <ZapIcon size={48} />
          <h3>No tienes automatizaciones</h3>
          <p>Crea tu primera automatización para empezar a comunicarte con tus clientes de forma automática.</p>
          <button className={`${B}__btn-create`} onClick={() => openWizard()}>
            <PlusIcon size={18} /><span>Crear automatización</span>
          </button>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════
// AUTOMATION CARD
// ═══════════════════════════════════════════════

function AutomationCard({ rule, onToggle, onEdit, onDelete, onDuplicate, onSubmitMeta, onCheckMeta, onHistory }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const TriggerIcon = TRIGGER_ICONS[rule.trigger_type] || ZapIcon;
  const catMeta = CATEGORY_META[rule.trigger_category] || CATEGORY_META.appointments;
  const metaStatus = META_STATUS[rule.meta_template_status] || META_STATUS.draft;
  const msg = rule.action_config?.message || '';

  // Build real trigger description with config values
  const triggerDesc = (() => {
    const cfg = rule.trigger_config || {};
    switch (rule.trigger_type) {
      case 'hours_before_appt': return `Se envía ${cfg.hours || 24} horas antes de una cita`;
      case 'hours_after_complete': return `Se envía ${cfg.hours || 2} horas después de completar`;
      case 'days_since_visit': return `Cliente sin visitar en ${cfg.days || 30} días`;
      case 'visit_milestone': return `Al alcanzar ${cfg.milestone || 10} visitas`;
      default: return rule.trigger_description || rule.trigger_name;
    }
  })();

  return (
    <div className={`${B}__card ${rule.is_enabled ? `${B}__card--active` : ''}`}>
      <div className={`${B}__card-header`}>
        <div className={`${B}__card-icon`} style={{ color: catMeta.color }}>
          <TriggerIcon size={20} />
        </div>
        <div className={`${B}__card-info`}>
          <h3 className={`${B}__card-name`}>{rule.name}</h3>
          <p className={`${B}__card-trigger`}>{triggerDesc}</p>
        </div>
        <button
          className={`${B}__toggle ${rule.is_enabled ? `${B}__toggle--on` : ''}`}
          onClick={() => onToggle(rule)}
          title={rule.is_enabled ? 'Pausar' : 'Activar'}
        >
          <div className={`${B}__toggle-knob`} />
        </button>
      </div>

      {/* Meta Status Badge */}
      <div className={`${B}__card-meta`} style={{ color: metaStatus.color, background: metaStatus.bg }}>
        <span className={`${B}__card-meta-dot`} style={{ background: metaStatus.color }} />
        {metaStatus.label}
        {rule.meta_template_status === 'pending' && (
          <button className={`${B}__card-meta-btn`} onClick={() => onCheckMeta(rule)}>Verificar</button>
        )}
      </div>

      {/* Message Preview */}
      {msg && (
        <div className={`${B}__card-preview`}>
          <WhatsAppIcon />
          <p>{msg.length > 120 ? msg.slice(0, 120) + '...' : msg}</p>
        </div>
      )}

      {/* Stats */}
      <div className={`${B}__card-stats`}>
        <span><SendIcon size={12} /> {rule.stats.sent} env.</span>
        <span><MessageIcon size={12} /> {rule.stats.responded} resp.</span>
        {rule.chain_config && <span><LinkIcon size={12} /> Cadena</span>}
      </div>

      {/* Actions */}
      <div className={`${B}__card-actions`}>
        <button onClick={() => onEdit(rule)} title="Editar"><EditIcon size={16} /></button>
        <button onClick={() => onHistory(rule)} title="Historial"><HistoryIcon size={16} /></button>
        <button onClick={() => onDuplicate(rule)} title="Duplicar"><CopyIcon size={16} /></button>
        {(rule.meta_template_status === 'draft' || rule.meta_template_status === 'rejected') && (
          <button className={`${B}__card-action--meta`} onClick={() => onSubmitMeta(rule)} title="Enviar a Meta">
            <SendIcon size={16} /> Meta
          </button>
        )}
        {rule.meta_template_status === 'pending' && (
          <button className={`${B}__card-action--meta`} onClick={() => onCheckMeta(rule)} title="Verificar estado Meta">
            <ClockIcon size={16} /> Verificar
          </button>
        )}
        <button className={`${B}__card-action--delete`} onClick={() => setConfirmDelete(true)} title="Eliminar"><TrashIcon size={16} /></button>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className={`${B}__modal-overlay`} onClick={() => setConfirmDelete(false)}>
          <div className={`${B}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${B}__modal-icon`}><TrashIcon size={24} /></div>
            <h3>Eliminar automatización</h3>
            <p>¿Estás seguro de eliminar <strong>"{rule.name}"</strong>? Se perderá todo el historial de ejecuciones.</p>
            <div className={`${B}__modal-actions`}>
              <button className={`${B}__modal-btn--cancel`} onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button className={`${B}__modal-btn--delete`} onClick={() => { setConfirmDelete(false); onDelete(rule); }}>
                <TrashIcon size={14} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════
// SUGGESTED TEMPLATES
// ═══════════════════════════════════════════════

function SuggestedTemplates({ onUse }) {
  const [templates, setTemplates] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    svc.getSuggestedTemplates().then(data => {
      setTemplates(data.templates || []);
      setLoaded(true);
    });
  }, []);

  if (!loaded || templates.length === 0) return null;

  return (
    <section className={`${B}__suggested`}>
      <h2 className={`${B}__section-title`}>
        <StarIcon size={18} /> Plantillas sugeridas
      </h2>
      <p className={`${B}__suggested-desc`}>Automatizaciones pre-armadas listas para personalizar.</p>
      <div className={`${B}__suggested-grid`}>
        {templates.map((tpl, i) => {
          const TplIcon = TRIGGER_ICONS[tpl.trigger_type] || ZapIcon;
          return (
            <button key={i} className={`${B}__suggested-card`} onClick={() => onUse(tpl)}>
              <TplIcon size={20} />
              <span>{tpl.name}</span>
              <ChevronRight />
            </button>
          );
        })}
      </div>
    </section>
  );
}


// ═══════════════════════════════════════════════
// WIZARD — 4-Step Automation Creator/Editor
// ═══════════════════════════════════════════════

function AutomationWizard({ triggers, editingRule, onClose, addNotification }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [triggerConfig, setTriggerConfig] = useState({});
  const [filterConfig, setFilterConfig] = useState({});
  const [message, setMessage] = useState('');
  const [evalHour, setEvalHour] = useState(null);
  const [cooldownDays, setCooldownDays] = useState(7);
  const [maxPerDay, setMaxPerDay] = useState(20);
  const [chainEnabled, setChainEnabled] = useState(false);
  const [chainDays, setChainDays] = useState(3);
  const [chainMessage, setChainMessage] = useState('');

  // Audience preview
  const [audience, setAudience] = useState(null);

  // Client preview for message
  const [previewClients, setPreviewClients] = useState([]);
  const [previewClientIdx, setPreviewClientIdx] = useState(0);

  // Init from editing rule or suggested template
  useEffect(() => {
    if (editingRule) {
      if (editingRule.id) {
        // Editing existing rule
        setName(editingRule.name || '');
        setTriggerType(editingRule.trigger_type || '');
        setTriggerConfig(editingRule.trigger_config || {});
        setFilterConfig(editingRule.filter_config || {});
        setMessage(editingRule.action_config?.message || '');
        setEvalHour(editingRule.eval_hour);
        setCooldownDays(editingRule.cooldown_days || 7);
        setMaxPerDay(editingRule.max_per_day || 20);
        if (editingRule.chain_config) {
          setChainEnabled(true);
          setChainDays(editingRule.chain_config.if_no_reply_days || 3);
          setChainMessage(editingRule.chain_config.then_message || '');
        }
      } else {
        // Suggested template
        setName(editingRule.name || '');
        setTriggerType(editingRule.trigger_type || '');
        setTriggerConfig(editingRule.trigger_config || {});
        setMessage(editingRule.action_config?.message || '');
        setEvalHour(editingRule.eval_hour || null);
        setCooldownDays(editingRule.cooldown_days || 7);
        setMaxPerDay(editingRule.max_per_day || 20);
      }
    }
    svc.getClientsPreview().then(setPreviewClients);
  }, [editingRule]);

  // Fetch audience preview when trigger/filter changes
  useEffect(() => {
    if (triggerType) {
      svc.previewAudience(triggerType, triggerConfig, filterConfig).then(setAudience);
    }
  }, [triggerType, JSON.stringify(triggerConfig), JSON.stringify(filterConfig)]);

  const selectedTrigger = triggers.find(t => t.type === triggerType);
  const availableVars = selectedTrigger?.variables || [];

  const renderPreview = () => {
    const client = previewClients[previewClientIdx];
    let rendered = message;
    if (client) {
      rendered = rendered
        .replace(/\{\{nombre\}\}/g, (client.name || 'Juan').split(' ')[0])
        .replace(/\{\{negocio\}\}/g, 'Tu Negocio');
    }
    rendered = rendered
      .replace(/\{\{dias\}\}/g, triggerConfig.days || '30')
      .replace(/\{\{hora\}\}/g, '10:00 AM')
      .replace(/\{\{fecha\}\}/g, '15/04/2026')
      .replace(/\{\{profesional\}\}/g, 'Carlos')
      .replace(/\{\{servicio\}\}/g, 'Consulta General')
      .replace(/\{\{descuento\}\}/g, '20%');
    return rendered;
  };

  const insertVariable = (varName) => {
    setMessage(prev => prev + `{{${varName}}}`);
  };

  const handleSave = async (goToMeta = false) => {
    setSaving(true);
    try {
      const payload = {
        name,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        filter_config: filterConfig,
        action_type: 'send_whatsapp',
        action_config: { message },
        chain_config: chainEnabled ? { if_no_reply_days: chainDays, then_message: chainMessage } : null,
        cooldown_days: cooldownDays,
        max_per_day: maxPerDay,
        eval_hour: evalHour,
      };

      let savedRule;
      if (editingRule?.id) {
        savedRule = await svc.update(editingRule.id, payload);
      } else {
        savedRule = await svc.create(payload);
      }

      if (goToMeta && savedRule?.id) {
        try {
          await svc.submitToMeta(savedRule.id);
          addNotification('Plantilla enviada a Meta para aprobación', 'success');
        } catch (e) { addNotification(e.message, 'warning'); }
      } else {
        addNotification(editingRule?.id ? 'Automatización actualizada' : 'Automatización creada', 'success');
      }
      onClose();
    } catch (e) {
      addNotification(e.message, 'error');
    }
    setSaving(false);
  };

  const canNext = () => {
    if (step === 1) return !!triggerType && !!name;
    if (step === 2) return true;
    if (step === 3) return message.trim().length > 10;
    return true;
  };

  return (
    <div className={`${B}__wizard`}>
      {/* Wizard Header */}
      <div className={`${B}__wizard-header`}>
        <button className={`${B}__wizard-close`} onClick={onClose}><XIcon size={20} /></button>
        <h2>{editingRule?.id ? 'Editar automatización' : 'Nueva automatización'}</h2>
        <div className={`${B}__wizard-steps`}>
          {[1, 2, 3, 4].map(s => (
            <button key={s}
              className={`${B}__wizard-step ${s === step ? `${B}__wizard-step--active` : ''} ${s < step ? `${B}__wizard-step--done` : ''}`}
              onClick={() => s < step && setStep(s)}
            >
              <span className={`${B}__wizard-step-num`}>{s < step ? <CheckIcon size={14} /> : s}</span>
              <span className={`${B}__wizard-step-label`}>
                {s === 1 ? 'Trigger' : s === 2 ? 'Audiencia' : s === 3 ? 'Mensaje' : 'Resumen'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className={`${B}__wizard-body`}>
        {step === 1 && (
          <WizardStep1
            triggers={triggers} triggerType={triggerType} setTriggerType={setTriggerType}
            triggerConfig={triggerConfig} setTriggerConfig={setTriggerConfig}
            name={name} setName={setName} evalHour={evalHour} setEvalHour={setEvalHour}
            cooldownDays={cooldownDays} setCooldownDays={setCooldownDays}
            maxPerDay={maxPerDay} setMaxPerDay={setMaxPerDay}
          />
        )}
        {step === 2 && (
          <WizardStep2
            filterConfig={filterConfig} setFilterConfig={setFilterConfig} audience={audience}
          />
        )}
        {step === 3 && (
          <WizardStep3
            message={message} setMessage={setMessage} availableVars={availableVars}
            renderPreview={renderPreview} previewClients={previewClients}
            previewClientIdx={previewClientIdx} setPreviewClientIdx={setPreviewClientIdx}
            insertVariable={insertVariable}
          />
        )}
        {step === 4 && (
          <WizardStep4
            name={name} triggerType={triggerType} triggerConfig={triggerConfig}
            filterConfig={filterConfig} audience={audience} message={message}
            evalHour={evalHour} cooldownDays={cooldownDays} maxPerDay={maxPerDay}
            chainEnabled={chainEnabled} setChainEnabled={setChainEnabled}
            chainDays={chainDays} setChainDays={setChainDays}
            chainMessage={chainMessage} setChainMessage={setChainMessage}
            selectedTrigger={selectedTrigger} renderPreview={renderPreview}
          />
        )}
      </div>

      {/* Wizard Footer */}
      <div className={`${B}__wizard-footer`}>
        {step > 1 && (
          <button className={`${B}__wizard-btn--back`} onClick={() => setStep(step - 1)}>
            <ChevronLeft /> Anterior
          </button>
        )}
        <div className={`${B}__wizard-footer-right`}>
          {step < 4 ? (
            <button className={`${B}__wizard-btn--next`} onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Siguiente <ChevronRight />
            </button>
          ) : (
            <>
              <button className={`${B}__wizard-btn--save`} onClick={() => handleSave(false)} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </button>
              <button className={`${B}__wizard-btn--meta`} onClick={() => handleSave(true)} disabled={saving}>
                <SendIcon size={16} /> {saving ? 'Enviando...' : 'Guardar y enviar a Meta'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// WIZARD STEP 1 — Trigger Selection
// ═══════════════════════════════════════════════

function WizardStep1({ triggers, triggerType, setTriggerType, triggerConfig, setTriggerConfig, name, setName, evalHour, setEvalHour, cooldownDays, setCooldownDays, maxPerDay, setMaxPerDay }) {
  const grouped = useMemo(() => {
    const g = {};
    triggers.forEach(t => {
      const cat = t.category || 'other';
      if (!g[cat]) g[cat] = [];
      g[cat].push(t);
    });
    return g;
  }, [triggers]);

  const selected = triggers.find(t => t.type === triggerType);

  return (
    <div className={`${B}__step`}>
      <div className={`${B}__step-section`}>
        <label className={`${B}__field-label`}>Nombre de la automatización</label>
        <input className={`${B}__field-input`} value={name} onChange={e => setName(e.target.value)}
          placeholder="Ej: Recordatorio de cita 24h" />
      </div>

      <div className={`${B}__step-section`}>
        <label className={`${B}__field-label`}>¿Cuándo se activa?</label>
        {Object.entries(grouped).map(([cat, items]) => {
          const catMeta = CATEGORY_META[cat] || { label: cat, color: '#64748B' };
          return (
            <div key={cat} className={`${B}__trigger-group`}>
              <h4 className={`${B}__trigger-group-label`} style={{ color: catMeta.color }}>{catMeta.label}</h4>
              <div className={`${B}__trigger-grid`}>
                {items.map(t => {
                  const TIcon = TRIGGER_ICONS[t.type] || ZapIcon;
                  const isSelected = triggerType === t.type;
                  return (
                    <button key={t.type}
                      className={`${B}__trigger-card ${isSelected ? `${B}__trigger-card--selected` : ''}`}
                      onClick={() => {
                        setTriggerType(t.type);
                        if (!name) setName(t.name);
                      }}
                    >
                      <TIcon size={22} />
                      <span className={`${B}__trigger-card-name`}>{t.name}</span>
                      <span className={`${B}__trigger-card-desc`}>{t.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trigger Config */}
      {selected?.config_fields?.length > 0 && (
        <div className={`${B}__step-section ${B}__trigger-config`}>
          <label className={`${B}__field-label`}>Configuración del trigger</label>
          {selected.config_fields.map(f => (
            <div key={f.key} className={`${B}__config-field`}>
              <label>{f.label}</label>
              <input type="number" min={f.min} max={f.max}
                value={triggerConfig[f.key] || f.default}
                onChange={e => setTriggerConfig({ ...triggerConfig, [f.key]: parseInt(e.target.value) || f.default })}
              />
            </div>
          ))}
        </div>
      )}

      {/* Advanced Config */}
      {triggerType && (
        <div className={`${B}__step-section ${B}__advanced-config`}>
          <label className={`${B}__field-label`}>Configuración avanzada</label>
          <div className={`${B}__config-row`}>
            <div className={`${B}__config-field`}>
              <label>Hora de evaluación</label>
              <select value={evalHour ?? ''} onChange={e => setEvalHour(e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">Tiempo real</option>
                {Array.from({ length: 14 }, (_, i) => i + 7).map(h => (
                  <option key={h} value={h}>{h}:00 {h < 12 ? 'AM' : 'PM'}</option>
                ))}
              </select>
            </div>
            <div className={`${B}__config-field`}>
              <label>No repetir en</label>
              <div className={`${B}__config-field-row`}>
                <input type="number" min={1} max={365} value={cooldownDays}
                  onChange={e => setCooldownDays(parseInt(e.target.value) || 1)} />
                <span>días</span>
              </div>
            </div>
            <div className={`${B}__config-field`}>
              <label>Máx. envíos/día</label>
              <input type="number" min={1} max={100} value={maxPerDay}
                onChange={e => setMaxPerDay(parseInt(e.target.value) || 20)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════
// WIZARD STEP 2 — Audience Filters
// ═══════════════════════════════════════════════

function WizardStep2({ filterConfig, setFilterConfig, audience }) {
  const [filters, setFilters] = useState(() => {
    const f = [];
    if (filterConfig.status) f.push({ key: 'status', op: 'is', value: filterConfig.status });
    if (filterConfig.tags?.length) f.push({ key: 'tags', op: 'contains', value: filterConfig.tags[0] });
    if (filterConfig.min_visits) f.push({ key: 'min_visits', op: 'gte', value: filterConfig.min_visits });
    if (filterConfig.min_spend) f.push({ key: 'min_spend', op: 'gte', value: filterConfig.min_spend });
    return f;
  });

  const FILTER_OPTIONS = [
    { key: 'status', label: 'Estado del cliente', type: 'select', options: ['activo', 'vip', 'en_riesgo', 'inactivo', 'nuevo'] },
    { key: 'tags', label: 'Tag', type: 'text' },
    { key: 'min_visits', label: 'Mínimo de visitas', type: 'number' },
    { key: 'min_spend', label: 'Gasto mínimo (COP)', type: 'number' },
    { key: 'service', label: 'Servicio favorito', type: 'text' },
  ];

  const addFilter = () => {
    const available = FILTER_OPTIONS.filter(fo => !filters.some(f => f.key === fo.key));
    if (available.length > 0) {
      setFilters([...filters, { key: available[0].key, op: 'is', value: '' }]);
    }
  };

  const removeFilter = (idx) => {
    setFilters(filters.filter((_, i) => i !== idx));
  };

  const updateFilter = (idx, field, value) => {
    const updated = [...filters];
    updated[idx] = { ...updated[idx], [field]: value };
    setFilters(updated);
  };

  // Sync filters to filterConfig
  useEffect(() => {
    const config = {};
    filters.forEach(f => {
      if (!f.value && f.value !== 0) return;
      if (f.key === 'status') config.status = Array.isArray(f.value) ? f.value : [f.value];
      else if (f.key === 'tags') config.tags = [f.value];
      else if (f.key === 'min_visits') config.min_visits = parseInt(f.value) || 0;
      else if (f.key === 'min_spend') config.min_spend = parseInt(f.value) || 0;
      else if (f.key === 'service') config.service = f.value;
    });
    setFilterConfig(config);
  }, [filters]);

  const pct = audience ? Math.round((audience.matching / Math.max(audience.total_clients, 1)) * 100) : 0;

  return (
    <div className={`${B}__step`}>
      <div className={`${B}__step-section`}>
        <label className={`${B}__field-label`}>¿A quién le llega?</label>

        {filters.length === 0 && (
          <p className={`${B}__filter-all`}>
            <UsersIcon size={16} /> Todos los clientes que cumplan el trigger
          </p>
        )}

        {filters.map((f, idx) => {
          const opt = FILTER_OPTIONS.find(o => o.key === f.key);
          return (
            <div key={idx} className={`${B}__filter-row`}>
              <select value={f.key} onChange={e => updateFilter(idx, 'key', e.target.value)}>
                {FILTER_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              {opt?.type === 'select' ? (
                <select value={f.value} onChange={e => updateFilter(idx, 'value', e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {opt.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={opt?.type === 'number' ? 'number' : 'text'}
                  value={f.value} onChange={e => updateFilter(idx, 'value', e.target.value)}
                  placeholder={opt?.label} />
              )}
              <button className={`${B}__filter-remove`} onClick={() => removeFilter(idx)}>
                <XIcon size={16} />
              </button>
            </div>
          );
        })}

        <button className={`${B}__filter-add`} onClick={addFilter}>
          <PlusIcon size={14} /> Agregar filtro
        </button>
      </div>

      {/* Audience Preview */}
      {audience && (
        <div className={`${B}__audience-preview`}>
          <div className={`${B}__audience-header`}>
            <EyeIcon size={18} />
            <h4>Preview de audiencia</h4>
          </div>
          <div className={`${B}__audience-bar`}>
            <div className={`${B}__audience-fill`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <p className={`${B}__audience-count`}>
            <strong>{audience.matching}</strong> de {audience.total_clients} clientes coinciden hoy
          </p>
          {audience.sample_names?.length > 0 && (
            <p className={`${B}__audience-samples`}>
              Ejemplo: {audience.sample_names.join(', ')}
              {audience.matching > 5 && '...'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════
// WIZARD STEP 3 — Message Editor + WhatsApp Preview
// ═══════════════════════════════════════════════

function WizardStep3({ message, setMessage, availableVars, renderPreview, previewClients, previewClientIdx, setPreviewClientIdx, insertVariable }) {
  const textareaRef = useRef(null);

  const handleInsertVar = (varName) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = message.slice(0, start);
      const after = message.slice(end);
      const insert = `{{${varName}}}`;
      setMessage(before + insert + after);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + insert.length;
        ta.focus();
      }, 0);
    } else {
      insertVariable(varName);
    }
  };

  const charCount = message.length;

  return (
    <div className={`${B}__step ${B}__step--split`}>
      {/* Left: Editor */}
      <div className={`${B}__editor`}>
        <label className={`${B}__field-label`}>Mensaje</label>
        <textarea
          ref={textareaRef}
          className={`${B}__editor-textarea`}
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={8}
          placeholder="Escribe el mensaje que recibirán tus clientes..."
        />
        <div className={`${B}__editor-footer`}>
          <span className={`${B}__editor-chars ${charCount > 500 ? `${B}__editor-chars--warn` : ''}`}>
            {charCount} caracteres
          </span>
          {charCount < 160 && <span className={`${B}__editor-tip`}>Los mensajes cortos tienen 40% más respuesta</span>}
        </div>

        <div className={`${B}__editor-vars`}>
          <label>Variables disponibles</label>
          <div className={`${B}__editor-var-btns`}>
            {availableVars.map(v => (
              <button key={v} className={`${B}__var-btn`} onClick={() => handleInsertVar(v)}>
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: WhatsApp Preview */}
      <div className={`${B}__preview`}>
        <label className={`${B}__field-label`}>Vista previa</label>
        <div className={`${B}__wa-phone`}>
          <div className={`${B}__wa-header`}>
            <WhatsAppIcon /> <span>WhatsApp</span>
          </div>
          <div className={`${B}__wa-chat`}>
            <div className={`${B}__wa-bubble`}>
              <p>{renderPreview() || 'Escribe un mensaje para ver la vista previa...'}</p>
              <span className={`${B}__wa-time`}>10:00 AM ✓✓</span>
            </div>
          </div>
        </div>
        {previewClients.length > 0 && (
          <div className={`${B}__preview-selector`}>
            <label>Preview con datos de:</label>
            <select value={previewClientIdx} onChange={e => setPreviewClientIdx(parseInt(e.target.value))}>
              {previewClients.map((c, i) => (
                <option key={i} value={i}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// WIZARD STEP 4 — Summary + Chain + Save
// ═══════════════════════════════════════════════

function WizardStep4({ name, triggerType, triggerConfig, filterConfig, audience, message, evalHour, cooldownDays, maxPerDay, chainEnabled, setChainEnabled, chainDays, setChainDays, chainMessage, setChainMessage, selectedTrigger, renderPreview }) {
  const TIcon = TRIGGER_ICONS[triggerType] || ZapIcon;
  const filterCount = Object.keys(filterConfig).filter(k => {
    const v = filterConfig[k];
    return v && (!Array.isArray(v) || v.length > 0);
  }).length;

  return (
    <div className={`${B}__step`}>
      {/* Summary Card */}
      <div className={`${B}__summary-card`}>
        <h3 className={`${B}__summary-title`}>
          <TIcon size={20} /> {name}
        </h3>
        <div className={`${B}__summary-rows`}>
          <div className={`${B}__summary-row`}>
            <span className={`${B}__summary-label`}>Trigger</span>
            <span>{selectedTrigger?.name || triggerType}</span>
          </div>
          {triggerConfig.hours && (
            <div className={`${B}__summary-row`}>
              <span className={`${B}__summary-label`}>Tiempo</span>
              <span>{triggerConfig.hours} horas</span>
            </div>
          )}
          {triggerConfig.days && (
            <div className={`${B}__summary-row`}>
              <span className={`${B}__summary-label`}>Días</span>
              <span>{triggerConfig.days} días sin visitar</span>
            </div>
          )}
          <div className={`${B}__summary-row`}>
            <span className={`${B}__summary-label`}>Audiencia</span>
            <span>{filterCount > 0 ? `${filterCount} filtro(s)` : 'Todos los clientes'} — {audience?.matching || '?'} hoy</span>
          </div>
          <div className={`${B}__summary-row`}>
            <span className={`${B}__summary-label`}>Evaluación</span>
            <span>{evalHour != null ? `${evalHour}:00 diario` : 'Tiempo real'}</span>
          </div>
          <div className={`${B}__summary-row`}>
            <span className={`${B}__summary-label`}>Cooldown</span>
            <span>No repetir en {cooldownDays} días por cliente</span>
          </div>
          <div className={`${B}__summary-row`}>
            <span className={`${B}__summary-label`}>Máx. diario</span>
            <span>{maxPerDay} envíos por día</span>
          </div>
        </div>

        {/* Message Preview */}
        <div className={`${B}__summary-msg`}>
          <label className={`${B}__field-label`}>Mensaje</label>
          <div className={`${B}__wa-bubble ${B}__wa-bubble--summary`}>
            <p>{renderPreview()}</p>
          </div>
        </div>
      </div>

      {/* Chain (Follow-up) */}
      <div className={`${B}__chain-section`}>
        <div className={`${B}__chain-header`}>
          <LinkIcon size={18} />
          <h4>Seguimiento automático</h4>
          <span className={`${B}__chain-optional`}>Opcional</span>
          <button
            className={`${B}__toggle ${chainEnabled ? `${B}__toggle--on` : ''}`}
            onClick={() => setChainEnabled(!chainEnabled)}
          >
            <div className={`${B}__toggle-knob`} />
          </button>
        </div>
        {chainEnabled && (
          <div className={`${B}__chain-body`}>
            <p className={`${B}__chain-desc`}>Si el cliente no responde en:</p>
            <div className={`${B}__config-field-row`}>
              <input type="number" min={1} max={30} value={chainDays}
                onChange={e => setChainDays(parseInt(e.target.value) || 3)} />
              <span>días → Enviar segundo mensaje:</span>
            </div>
            <textarea
              className={`${B}__editor-textarea ${B}__editor-textarea--chain`}
              value={chainMessage}
              onChange={e => setChainMessage(e.target.value)}
              rows={4}
              placeholder="Mensaje de seguimiento..."
            />
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className={`${B}__timeline`}>
        <label className={`${B}__field-label`}>
          <ClockIcon size={16} /> Línea de tiempo estimada
        </label>
        <div className={`${B}__timeline-bar`}>
          {['Hoy', 'Mañ', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, i) => (
            <div key={i} className={`${B}__timeline-day`}>
              <div className={`${B}__timeline-dot`} />
              <span className={`${B}__timeline-label`}>{day}</span>
              <span className={`${B}__timeline-time`}>{evalHour != null ? `${evalHour}:00` : 'Auto'}</span>
            </div>
          ))}
        </div>
        {audience && (
          <p className={`${B}__timeline-estimate`}>
            Estimado: ~{Math.min(audience.matching, maxPerDay)} envíos/día
          </p>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// EXECUTION HISTORY
// ═══════════════════════════════════════════════

function ExecutionHistory({ rule, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    svc.getRuleExecutions(rule.id, 100).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [rule.id]);

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (s) => {
    const map = {
      sent: { label: 'Enviado', cls: 'sent' },
      delivered: { label: 'Entregado', cls: 'delivered' },
      responded: { label: 'Respondió', cls: 'responded' },
      failed: { label: 'Falló', cls: 'failed' },
    };
    const m = map[s] || map.sent;
    return <span className={`${B}__history-status ${B}__history-status--${m.cls}`}>{m.label}</span>;
  };

  return (
    <div className={`${B}__history`}>
      <div className={`${B}__history-header`}>
        <button className={`${B}__wizard-btn--back`} onClick={onBack}><ChevronLeft /> Volver</button>
        <h2>Historial: {rule.name}</h2>
      </div>

      {data?.month_stats && (
        <div className={`${B}__history-stats`}>
          <div className={`${B}__stat`}>
            <SendIcon size={16} />
            <div className={`${B}__stat-data`}>
              <span className={`${B}__stat-value`}>{data.month_stats.sent}</span>
              <span className={`${B}__stat-label`}>Este mes</span>
            </div>
          </div>
          <div className={`${B}__stat`}>
            <MessageIcon size={16} />
            <div className={`${B}__stat-data`}>
              <span className={`${B}__stat-value`}>{data.month_stats.responded}</span>
              <span className={`${B}__stat-label`}>Respondieron</span>
            </div>
          </div>
          <div className={`${B}__stat`}>
            <BarChartIcon size={16} />
            <div className={`${B}__stat-data`}>
              <span className={`${B}__stat-value`}>{data.month_stats.response_rate}%</span>
              <span className={`${B}__stat-label`}>Respuesta</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className={`${B}__loading`}><div className={`${B}__spinner`} /><span>Cargando historial...</span></div>
      ) : (
        <div className={`${B}__history-list`}>
          {(data?.executions || []).length === 0 ? (
            <div className={`${B}__empty`}>
              <HistoryIcon size={40} />
              <p>Sin ejecuciones aún</p>
            </div>
          ) : (
            (data.executions).map(ex => (
              <div key={ex.id} className={`${B}__history-row`}>
                <div className={`${B}__history-time`}>{formatTime(ex.created_at)}</div>
                <div className={`${B}__history-arrow`}>→</div>
                <div className={`${B}__history-client`}>{ex.client_name}</div>
                <div className={`${B}__history-msg`}>{ex.message_preview}</div>
                {statusBadge(ex.status)}
                {ex.is_chain && <span className={`${B}__history-chain-badge`}>Cadena</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
