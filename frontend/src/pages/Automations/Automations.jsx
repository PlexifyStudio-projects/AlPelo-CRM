import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import automationService from '../../services/automationService';
import templateService from '../../services/templateService';
import settingsService from '../../services/settingsService';

const B = 'automations';

// ═══════════════════════════════════════════════
// SVG Icons
// ═══════════════════════════════════════════════
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const SaveIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>;
const HistoryIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>;
const ZapIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const WhatsAppSmall = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.6"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>;

const CHANNEL_LABELS = {
  whatsapp: { label: 'WhatsApp', icon: '📱', color: '#25D366' },
  crm: { label: 'CRM', icon: '📊', color: '#8B5CF6' },
  'whatsapp+crm': { label: 'WhatsApp + CRM', icon: '⚡', color: '#D97706' },
  marketing: { label: 'Marketing', icon: '📣', color: '#EC4899' },
  interno: { label: 'Interno', icon: '🔔', color: '#0EA5E9' },
};

const CATEGORY_LABELS = {
  citas: 'Citas',
  marketing: 'Marketing',
  crm: 'CRM',
  interno: 'Interno',
  general: 'General',
};

// Business-friendly descriptions and impact for each workflow type
const WORKFLOW_IMPACT = {
  reminder_24h: {
    description: 'Envía un recordatorio automático por WhatsApp a cada cliente 24 horas antes de su cita. El cliente puede confirmar o cancelar.',
    impact: 'Reduce inasistencias hasta un 80%',
    impactIcon: '📉',
    impactColor: '#10B981',
    tip: 'Esta es la automatización más importante. Un solo no-show evitado al mes ya paga tu suscripción.',
  },
  reminder_1h: {
    description: 'Recordatorio final 1 hora antes. Ideal para clientes que confirmaron ayer pero podrían olvidarse.',
    impact: 'Reduce cancelaciones de último minuto',
    impactIcon: '⏰',
    impactColor: '#F59E0B',
    tip: 'Complemento perfecto del recordatorio 24h. Juntos reducen no-shows hasta un 80%.',
  },
  post_visit: {
    description: 'Después de completar un servicio, pregunta al cliente cómo le fue. Las respuestas positivas alimentan Google Reviews.',
    impact: 'Aumenta reseñas en Google 5x',
    impactIcon: '⭐',
    impactColor: '#8B5CF6',
    tip: 'Los clientes que califican 4-5 reciben automáticamente un link a Google Reviews.',
  },
  birthday: {
    description: 'Envía una felicitación personalizada con descuento el día del cumpleaños del cliente.',
    impact: '25-30% de clientes redimen el descuento',
    impactIcon: '🎂',
    impactColor: '#EC4899',
    tip: 'Es la automatización con mayor tasa de respuesta. Genera lealtad emocional.',
  },
  reactivation: {
    description: 'Contacta automáticamente a clientes que no han visitado tu negocio en X días con un incentivo para que vuelvan.',
    impact: 'Recupera clientes que estaban perdidos',
    impactIcon: '🔄',
    impactColor: '#EF4444',
    tip: 'Recuperar 1 cliente inactivo por semana puede significar +$500,000 COP al mes.',
  },
  no_show_followup: {
    description: 'Al día siguiente de una inasistencia, envía un mensaje amable para reagendar. Sin presión.',
    impact: '40% de no-shows reagendan',
    impactIcon: '📋',
    impactColor: '#6366F1',
    tip: 'No acuses al cliente. El tono amable recupera más citas que uno agresivo.',
  },
  welcome: {
    description: 'Da la bienvenida a cada cliente nuevo apenas lo registras. Primera impresión profesional.',
    impact: 'Mejora retención de clientes nuevos 35%',
    impactIcon: '👋',
    impactColor: '#10B981',
    tip: 'Un cliente que recibe bienvenida tiene 3x más probabilidad de volver.',
  },
  auto_vip: {
    description: 'Detecta clientes fieles automáticamente y los etiqueta como VIP cuando alcanzan X visitas. Les envía reconocimiento.',
    impact: 'Los VIP gastan 67% más que el promedio',
    impactIcon: '⭐',
    impactColor: '#D97706',
    tip: 'Tus VIP son tu 20% que genera el 80% de ingresos. Reconócelos.',
  },
  review_request: {
    description: 'Después de una calificación positiva (4-5 estrellas), pide automáticamente una reseña en Google.',
    impact: 'Multiplica tus reseñas en Google',
    impactIcon: '🌟',
    impactColor: '#F97316',
    tip: 'Solo pide reseña a clientes satisfechos. Los insatisfechos van directo al dueño.',
  },
  daily_summary: {
    description: 'Cada noche recibe un resumen del día en tu WhatsApp: citas completadas, no-shows, ingresos, clientes nuevos.',
    impact: 'Controla tu negocio sin abrir la app',
    impactIcon: '📊',
    impactColor: '#0EA5E9',
    tip: 'Ideal para dueños que tienen múltiples negocios o no están presentes todo el día.',
  },
};

const getTimeAgo = (dateStr) => {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
};

const Automations = () => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();
  const [automations, setAutomations] = useState([]);
  const [stats, setStats] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editMessage, setEditMessage] = useState('');
  const [activeTab, setActiveTab] = useState('workflows'); // workflows | history
  const [filterCategory, setFilterCategory] = useState('all');
  const [approvedTemplates, setApprovedTemplates] = useState([]);
  const [metaTemplates, setMetaTemplates] = useState([]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [wfs, st, tpls, metaData] = await Promise.all([
        automationService.getAutomations(),
        automationService.getAutomationStats(),
        templateService.getApprovedTemplates(),
        settingsService.getMetaTemplates().catch(() => ({ templates: [] })),
      ]);
      setAutomations(wfs || []);
      setStats(st || {});
      setApprovedTemplates(tpls || []);
      // Only keep Meta-approved templates
      const metaApproved = (metaData?.templates || []).filter(t => t.status === 'approved');
      setMetaTemplates(metaApproved);
    } catch (e) {
      console.error('Failed to load automations:', e);
      addNotification('Error cargando automatizaciones', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadExecutions = useCallback(async () => {
    try {
      const execs = await automationService.getExecutions(50);
      setExecutions(execs || []);
    } catch (e) {
      console.error('Failed to load executions:', e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadExecutions();
  }, [activeTab, loadExecutions]);

  // Toggle workflow
  const handleToggle = async (id) => {
    const auto = automations.find(a => a.id === id);
    if (!auto) return;

    const newEnabled = !auto.enabled;
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: newEnabled } : a));

    try {
      await automationService.updateAutomation(id, { enabled: newEnabled });
      addNotification(
        newEnabled ? `"${auto.name}" activado` : `"${auto.name}" desactivado`,
        newEnabled ? 'success' : 'info'
      );
    } catch (e) {
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !newEnabled } : a));
      addNotification('Error actualizando workflow', 'error');
    }
  };

  // Edit message
  const startEdit = (auto) => {
    setEditingId(auto.id);
    setEditMessage(auto.message);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMessage('');
  };

  const saveEdit = async (id) => {
    try {
      await automationService.updateAutomation(id, { message: editMessage });
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, message: editMessage } : a));
      setEditingId(null);
      setEditMessage('');
      addNotification('Mensaje actualizado', 'success');
    } catch (e) {
      addNotification('Error guardando mensaje', 'error');
    }
  };

  // Update any config field
  const handleConfigChange = async (id, key, value) => {
    setAutomations(prev => prev.map(a =>
      a.id === id ? { ...a, [key]: value, config: { ...a.config, [key]: value } } : a
    ));
    try {
      await automationService.updateAutomation(id, { config: { [key]: value } });
    } catch (e) {
      addNotification('Error actualizando configuración', 'error');
    }
  };

  // Update days for reactivation
  const handleDaysChange = async (id, days) => {
    setAutomations(prev => prev.map(a =>
      a.id === id ? { ...a, days: Number(days) } : a
    ));
    try {
      await automationService.updateAutomation(id, { days: Number(days) });
    } catch (e) {
      addNotification('Error actualizando configuración', 'error');
    }
  };

  // Filter: only show ENABLED automations (+ category filter)
  const enabledAutomations = automations.filter(a => a.enabled);
  const disabledAutomations = automations.filter(a => !a.enabled);
  const filteredAutomations = filterCategory === 'all'
    ? automations
    : automations.filter(a => a.category === filterCategory);

  // Stats computed
  const activeCount = automations.filter(a => a.enabled).length;
  const totalSent = stats?.sent_total || automations.reduce((s, a) => s + (a.stats?.sent || 0), 0);
  const responseRate = stats?.response_rate || 0;
  const monthSent = stats?.sent_this_month || 0;

  if (loading) {
    return (
      <div className={B}>
        <div className={`${B}__loading`}>
          <div className={`${B}__loading-spinner`} />
          <p>Cargando automatizaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={B}>
      {/* Page Header */}
      <div className={`${B}__header`}>
        <div className={`${B}__header-left`}>
          <div className={`${B}__header-icon`}>
            <ZapIcon />
          </div>
          <div>
            <h1 className={`${B}__title`}>Automatizaciones</h1>
            <p className={`${B}__subtitle`}>
              Motor de workflows automáticos — WhatsApp, CRM, Marketing
            </p>
          </div>
        </div>
        <div className={`${B}__header-right`}>
          <div className={`${B}__header-badge`}>
            <span className={`${B}__header-badge-dot`} />
            {activeCount} de {automations.length} activos
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className={`${B}__stats`}>
        <div className={`${B}__stat ${B}__stat--active`}>
          <div className={`${B}__stat-icon`}>⚡</div>
          <div className={`${B}__stat-info`}>
            <span className={`${B}__stat-value`}>{activeCount}/{automations.length}</span>
            <span className={`${B}__stat-label`}>Workflows activos</span>
          </div>
        </div>
        <div className={`${B}__stat ${B}__stat--sent`}>
          <div className={`${B}__stat-icon`}>📤</div>
          <div className={`${B}__stat-info`}>
            <span className={`${B}__stat-value`}>{monthSent.toLocaleString()}</span>
            <span className={`${B}__stat-label`}>Enviados este mes</span>
          </div>
        </div>
        <div className={`${B}__stat ${B}__stat--rate`}>
          <div className={`${B}__stat-icon`}>📊</div>
          <div className={`${B}__stat-info`}>
            <span className={`${B}__stat-value`}>{responseRate}%</span>
            <span className={`${B}__stat-label`}>Tasa de respuesta</span>
          </div>
        </div>
        <div className={`${B}__stat ${B}__stat--confirmed`}>
          <div className={`${B}__stat-icon`}>✅</div>
          <div className={`${B}__stat-info`}>
            <span className={`${B}__stat-value`}>{totalSent.toLocaleString()}</span>
            <span className={`${B}__stat-label`}>Total enviados</span>
          </div>
        </div>
      </div>

      {/* Tabs: Workflows | Historial */}
      <div className={`${B}__tabs`}>
        <button
          className={`${B}__tab ${activeTab === 'workflows' ? `${B}__tab--active` : ''}`}
          onClick={() => setActiveTab('workflows')}
        >
          <ZapIcon /> Workflows
          <span className={`${B}__tab-badge`}>{automations.length}</span>
        </button>
        <button
          className={`${B}__tab ${activeTab === 'history' ? `${B}__tab--active` : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <HistoryIcon /> Historial
          {monthSent > 0 && <span className={`${B}__tab-badge`}>{monthSent}</span>}
        </button>
      </div>

      {activeTab === 'workflows' && (
        <>
          {/* Category Filters */}
          <div className={`${B}__filters`}>
            {['all', 'citas', 'marketing', 'crm', 'interno'].map(cat => (
              <button
                key={cat}
                className={`${B}__filter ${filterCategory === cat ? `${B}__filter--active` : ''}`}
                onClick={() => setFilterCategory(cat)}
              >
                {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat] || cat}
                {cat !== 'all' && (
                  <span className={`${B}__filter-count`}>
                    {automations.filter(a => a.category === cat).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Active Workflows */}
          {filteredAutomations.length === 0 && (
            <div className={`${B}__empty`}>
              <div className={`${B}__empty-icon`}>⚡</div>
              <h3 className={`${B}__empty-title`}>No tienes automatizaciones activas</h3>
              <p className={`${B}__empty-desc`}>
                Activa una automatización de la sección "Disponibles" más abajo.
                Selecciona una plantilla aprobada y prende el switch.
              </p>
            </div>
          )}
          <div className={`${B}__grid`}>
            {filteredAutomations.map(auto => {
              const channelInfo = CHANNEL_LABELS[auto.channel] || CHANNEL_LABELS.whatsapp;

              return (
                <div
                  key={auto.id}
                  className={`${B}__card ${auto.enabled ? `${B}__card--active` : `${B}__card--inactive`}`}
                  style={{ '--auto-color': auto.color, '--auto-bg': auto.bg }}
                >
                  {/* Header */}
                  <div className={`${B}__card-header`}>
                    <div className={`${B}__card-header-left`}>
                      <div className={`${B}__card-icon`} style={{ background: auto.bg }}>
                        {auto.icon}
                      </div>
                      <div className={`${B}__card-title-group`}>
                        <h3 className={`${B}__card-name`}>{auto.name}</h3>
                        <span className={`${B}__card-trigger`}>
                          <ClockIcon /> {auto.trigger}
                        </span>
                      </div>
                    </div>
                    <label className={`${B}__toggle`}>
                      <input
                        type="checkbox"
                        className={`${B}__toggle-input`}
                        checked={auto.enabled}
                        onChange={() => handleToggle(auto.id)}
                      />
                      <span className={`${B}__toggle-slider`} />
                    </label>
                  </div>

                  {/* Description — compact */}
                  {(() => {
                    const impact = WORKFLOW_IMPACT[auto.workflow_type];
                    return impact ? (
                      <p className={`${B}__card-desc`}>{impact.description}</p>
                    ) : null;
                  })()}

                  {/* Template status pill */}
                  {auto.channel !== 'interno' && (
                    <div className={`${B}__card-template-ready`}>
                      {auto.template_name ? (
                        <>
                          <span className={`${B}__card-template-dot ${B}__card-template-dot--ok`} />
                          Plantilla lista
                        </>
                      ) : (
                        <>
                          <span className={`${B}__card-template-dot ${B}__card-template-dot--warn`} />
                          Sin plantilla Meta
                        </>
                      )}
                    </div>
                  )}

                  {/* Config: only show days/hour selectors inline (no message editing) */}
                  {(auto.days_options || auto.send_hour_options) && (
                    <div className={`${B}__card-config`}>
                      {auto.days_options && (
                        <div className={`${B}__card-config-item`}>
                          <span className={`${B}__card-config-label`}>Inactividad:</span>
                          <select className={`${B}__card-config-select`} value={auto.days || 30} onChange={e => handleDaysChange(auto.id, e.target.value)}>
                            {auto.days_options.map(d => (<option key={d} value={d}>{d} días</option>))}
                          </select>
                        </div>
                      )}
                      {auto.send_hour_options && (
                        <div className={`${B}__card-config-item`}>
                          <span className={`${B}__card-config-label`}>Hora de envío:</span>
                          <select className={`${B}__card-config-select`} value={auto.send_hour || auto.send_hour_options[0]} onChange={e => handleConfigChange(auto.id, 'send_hour', Number(e.target.value))}>
                            {auto.send_hour_options.map(h => (<option key={h} value={h}>{h}:00 {h < 12 ? 'AM' : 'PM'}</option>))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer — compact stats + actions */}
                  <div className={`${B}__card-footer`}>
                    <div className={`${B}__card-stats`}>
                      <span className={`${B}__card-stat`}><strong>{auto.stats?.sent || 0}</strong> env.</span>
                      <span className={`${B}__card-stat`}><strong>{auto.stats?.responded || 0}</strong> resp.</span>
                    </div>
                    {/* No edit button — templates are Meta-approved and cannot be modified */}
                  </div>
                </div>
              );
            })}
          </div>

        </>
      )}

      {activeTab === 'history' && (
        <div className={`${B}__history`}>
          {executions.length === 0 ? (
            <div className={`${B}__history-empty`}>
              <span className={`${B}__history-empty-icon`}>📋</span>
              <p>Aún no hay ejecuciones registradas.</p>
              <p className={`${B}__history-empty-sub`}>
                Activa un workflow y las ejecuciones aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className={`${B}__history-list`}>
              <div className={`${B}__history-header`}>
                <span>Workflow</span>
                <span>Cliente</span>
                <span>Mensaje</span>
                <span>Estado</span>
                <span>Fecha</span>
              </div>
              {executions.map(ex => (
                <div key={ex.id} className={`${B}__history-row`}>
                  <span className={`${B}__history-cell`}>
                    <span className={`${B}__history-icon`}>{ex.workflow_icon}</span>
                    {ex.workflow_name}
                  </span>
                  <span className={`${B}__history-cell`}>{ex.client_name}</span>
                  <span className={`${B}__history-cell ${B}__history-cell--preview`}>
                    {ex.message_preview}
                  </span>
                  <span className={`${B}__history-cell`}>
                    <span className={`${B}__history-status ${B}__history-status--${ex.status}`}>
                      {ex.status === 'sent' ? '✅ Enviado' : ex.status === 'failed' ? '❌ Fallido' : ex.status}
                    </span>
                  </span>
                  <span className={`${B}__history-cell ${B}__history-cell--date`}>
                    {getTimeAgo(ex.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Automations;
