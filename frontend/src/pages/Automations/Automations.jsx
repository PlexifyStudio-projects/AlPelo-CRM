import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import automationService from '../../services/automationService';

const B = 'automations';

// ═══════════════════════════════════════════════
// SVG Icons
// ═══════════════════════════════════════════════
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const HistoryIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>;
const ZapIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const WhatsAppSmall = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.6"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>;

const CATEGORY_LABELS = {
  citas: 'Citas',
  marketing: 'Marketing',
  crm: 'CRM',
  pagos: 'Pagos',
  interno: 'Interno',
};

// Business-friendly tips for each workflow type (used in tooltips only)
const WORKFLOW_IMPACT = {
  reminder_24h: { tip: 'Esta es la automatización más importante. Un solo no-show evitado al mes ya paga tu suscripción.' },
  reminder_1h: { tip: 'Complemento perfecto del recordatorio 24h. Juntos reducen no-shows hasta un 80%.' },
  post_visit: { tip: 'Los clientes que califican 4-5 reciben automáticamente un link a Google Reviews.' },
  birthday: { tip: 'Es la automatización con mayor tasa de respuesta. Genera lealtad emocional.' },
  reactivation: { tip: 'Recuperar 1 cliente inactivo por semana puede significar +$500,000 COP al mes.' },
  no_show_followup: { tip: 'No acuses al cliente. El tono amable recupera más citas que uno agresivo.' },
  welcome: { tip: 'Un cliente que recibe bienvenida tiene 3x más probabilidad de volver.' },
  auto_vip: { tip: 'Tus VIP son tu 20% que genera el 80% de ingresos. Reconócelos.' },
  review_request: { tip: 'Solo pide reseña a clientes satisfechos. Los insatisfechos van directo al dueño.' },
  daily_summary: { tip: 'Ideal para dueños que tienen múltiples negocios o no están presentes todo el día.' },
};

const META_STATUS_LABELS = {
  draft: 'Borrador — Envía a Meta para activar',
  pending: 'Pendiente — Esperando aprobación de Meta',
  approved: 'Aprobada por Meta — Lista para usar',
  rejected: 'Rechazada por Meta — Edita y reenvía',
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
  const [activeTab, setActiveTab] = useState('workflows');
  const [filterCategory, setFilterCategory] = useState('all');
  const [submittingId, setSubmittingId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [wfs, st] = await Promise.all([
        automationService.getAutomations(),
        automationService.getAutomationStats(),
      ]);
      setAutomations(wfs || []);
      setStats(st || {});
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

  // Toggle workflow — only if meta_template_status is approved
  const handleToggle = async (id) => {
    const auto = automations.find(a => a.id === id);
    if (!auto) return;

    const metaStatus = auto.meta_template_status || 'draft';
    if (metaStatus !== 'approved') {
      addNotification('Primero envía la plantilla a Meta para poder activar', 'warning');
      return;
    }

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

  // Submit ALL draft templates to Meta
  const [submittingAll, setSubmittingAll] = useState(false);
  const handleSubmitAllToMeta = async () => {
    const drafts = automations.filter(a => {
      const status = a.meta_template_status || 'draft';
      return status === 'draft' || status === 'rejected';
    });
    if (drafts.length === 0) {
      addNotification('No hay borradores para enviar', 'info');
      return;
    }

    setSubmittingAll(true);
    let sent = 0;
    let failed = 0;

    for (const auto of drafts) {
      try {
        const result = await automationService.submitToMeta(auto.id);
        setAutomations(prev => prev.map(a =>
          a.id === auto.id ? { ...a, meta_template_status: result.meta_template_status || 'pending' } : a
        ));
        sent++;
      } catch {
        failed++;
      }
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1500));
    }

    setSubmittingAll(false);
    addNotification(`Enviadas: ${sent} exitosas, ${failed} fallidas de ${drafts.length} total`, sent > 0 ? 'success' : 'error');
  };

  // Submit template to Meta
  const handleSubmitToMeta = async (id) => {
    const auto = automations.find(a => a.id === id);
    if (!auto) return;

    setSubmittingId(id);
    try {
      const result = await automationService.submitToMeta(id);
      setAutomations(prev => prev.map(a =>
        a.id === id ? { ...a, meta_template_status: result.meta_template_status || 'pending' } : a
      ));
      addNotification(`"${auto.name}" enviada a Meta para aprobación`, 'success');
    } catch (e) {
      addNotification(e.message || 'Error al enviar a Meta', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  // Check Meta status
  const handleCheckStatus = async (id) => {
    const auto = automations.find(a => a.id === id);
    if (!auto) return;

    setCheckingId(id);
    try {
      const result = await automationService.checkMetaStatus(id);
      const newStatus = result.meta_template_status || auto.meta_template_status;
      setAutomations(prev => prev.map(a =>
        a.id === id ? { ...a, meta_template_status: newStatus } : a
      ));
      if (newStatus === 'approved') {
        addNotification(`"${auto.name}" fue aprobada por Meta`, 'success');
      } else if (newStatus === 'rejected') {
        addNotification(`"${auto.name}" fue rechazada por Meta`, 'error');
      } else {
        addNotification(`Estado actual: ${META_STATUS_LABELS[newStatus] || newStatus}`, 'info');
      }
    } catch (e) {
      addNotification(e.message || 'Error al verificar estado', 'error');
    } finally {
      setCheckingId(null);
    }
  };

  // Edit template text
  const handleEditTemplate = (auto) => {
    setEditingId(auto.id);
    setEditMessage(auto.message || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMessage('');
  };

  const handleSaveTemplate = async (id) => {
    const auto = automations.find(a => a.id === id);
    const metaStatus = auto?.meta_template_status || 'draft';

    try {
      await automationService.updateAutomation(id, { message: editMessage });
      const updatedStatus = metaStatus === 'approved' ? 'draft' : metaStatus;
      setAutomations(prev => prev.map(a =>
        a.id === id ? { ...a, message: editMessage, meta_template_status: updatedStatus, enabled: updatedStatus !== 'approved' ? false : a.enabled } : a
      ));
      setEditingId(null);
      setEditMessage('');
      if (metaStatus === 'approved') {
        addNotification('Mensaje actualizado. Meta debe aprobar de nuevo antes de poder activar.', 'warning');
      } else {
        addNotification('Mensaje actualizado', 'success');
      }
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

  // Filter
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
          {automations.filter(a => (a.meta_template_status || 'draft') === 'draft').length > 0 && (
            <button
              className={`${B}__submit-all-btn`}
              onClick={handleSubmitAllToMeta}
              disabled={submittingAll}
            >
              {submittingAll ? 'Enviando...' : 'Enviar todas a Meta'}
            </button>
          )}
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
            {['all', 'citas', 'marketing', 'crm', 'pagos', 'interno'].map(cat => (
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

          {/* Automation Cards */}
          {filteredAutomations.length === 0 && (
            <div className={`${B}__empty`}>
              <div className={`${B}__empty-icon`}>⚡</div>
              <h3 className={`${B}__empty-title`}>No hay automatizaciones en esta categoría</h3>
              <p className={`${B}__empty-desc`}>
                Selecciona otra categoría o revisa que tengas workflows configurados.
              </p>
            </div>
          )}

          <div className={`${B}__grid`}>
            {filteredAutomations.map(auto => {
              const metaStatus = auto.meta_template_status || 'draft';
              const impact = WORKFLOW_IMPACT[auto.workflow_type];

              return (
                <div
                  key={auto.id}
                  className={`${B}__card ${auto.enabled ? `${B}__card--active` : `${B}__card--inactive`}`}
                  style={{ '--auto-color': auto.color }}
                >
                  {/* Header: icon + name + trigger + toggle */}
                  <div className={`${B}__card-header`}>
                    <div className={`${B}__card-header-left`}>
                      <div className={`${B}__card-icon`}>
                        {auto.icon}
                      </div>
                      <div className={`${B}__card-title-group`}>
                        <h3 className={`${B}__card-name`}>{auto.name}</h3>
                        <span className={`${B}__card-trigger`}>
                          <ClockIcon /> {auto.trigger}
                        </span>
                      </div>
                    </div>
                    <label className={`${B}__toggle ${metaStatus !== 'approved' ? `${B}__toggle--disabled` : ''}`}>
                      <input
                        type="checkbox"
                        className={`${B}__toggle-input`}
                        checked={auto.enabled}
                        onChange={() => handleToggle(auto.id)}
                        disabled={metaStatus !== 'approved'}
                      />
                      <span className={`${B}__toggle-slider`} />
                    </label>
                  </div>

                  {/* Meta Status Indicator */}
                  <div className={`${B}__card-meta-status ${B}__card-meta-status--${metaStatus}`}>
                    <span className={`${B}__card-meta-dot`} />
                    {META_STATUS_LABELS[metaStatus] || metaStatus}
                  </div>

                  {/* Template Preview (WhatsApp bubble style) or Edit mode */}
                  {editingId === auto.id ? (
                    <div className={`${B}__card-edit`}>
                      <textarea
                        className={`${B}__card-edit-textarea`}
                        value={editMessage}
                        onChange={e => setEditMessage(e.target.value)}
                        rows={4}
                      />
                      <div className={`${B}__card-edit-actions`}>
                        <button
                          className={`${B}__card-edit-save`}
                          onClick={() => handleSaveTemplate(auto.id)}
                        >
                          Guardar
                        </button>
                        <button
                          className={`${B}__card-edit-cancel`}
                          onClick={cancelEdit}
                        >
                          Cancelar
                        </button>
                      </div>
                      {metaStatus === 'approved' && (
                        <p className={`${B}__card-edit-warning`}>
                          Si editas, Meta debe aprobar de nuevo
                        </p>
                      )}
                    </div>
                  ) : (
                    auto.message && (
                      <div className={`${B}__card-bubble`}>
                        <WhatsAppSmall /> {auto.message}
                      </div>
                    )
                  )}

                  {/* Tip (tooltip-style info from WORKFLOW_IMPACT) */}
                  {impact?.tip && (
                    <p className={`${B}__card-tip`} title={impact.tip}>
                      💡 {impact.tip}
                    </p>
                  )}

                  {/* Config selectors (days, send_hour) */}
                  {(auto.days_options || auto.send_hour_options) && (
                    <div className={`${B}__card-config`}>
                      {auto.days_options && (
                        <div className={`${B}__card-config-item`}>
                          <span className={`${B}__card-config-label`}>Inactividad:</span>
                          <select
                            className={`${B}__card-config-select`}
                            value={auto.days || 30}
                            onChange={e => handleDaysChange(auto.id, e.target.value)}
                          >
                            {auto.days_options.map(d => (
                              <option key={d} value={d}>{d} días</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {auto.send_hour_options && (
                        <div className={`${B}__card-config-item`}>
                          <span className={`${B}__card-config-label`}>Hora de envío:</span>
                          <select
                            className={`${B}__card-config-select`}
                            value={auto.send_hour || auto.send_hour_options[0]}
                            onChange={e => handleConfigChange(auto.id, 'send_hour', Number(e.target.value))}
                          >
                            {auto.send_hour_options.map(h => (
                              <option key={h} value={h}>{h}:00 {h < 12 ? 'AM' : 'PM'}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer: stats + action buttons */}
                  <div className={`${B}__card-footer`}>
                    <div className={`${B}__card-stats`}>
                      <span className={`${B}__card-stat`}>
                        <strong>{auto.stats?.sent || 0}</strong> env.
                      </span>
                      <span className={`${B}__card-stat`}>
                        <strong>{auto.stats?.responded || 0}</strong> resp.
                      </span>
                    </div>
                    <div className={`${B}__card-actions`}>
                      <button
                        className={`${B}__card-action-btn`}
                        onClick={() => handleEditTemplate(auto)}
                        title="Editar mensaje"
                      >
                        <EditIcon /> Editar
                      </button>
                      {metaStatus === 'draft' && (
                        <button
                          className={`${B}__card-submit-btn`}
                          onClick={() => handleSubmitToMeta(auto.id)}
                          disabled={submittingId === auto.id}
                        >
                          {submittingId === auto.id ? 'Enviando...' : 'Enviar a Meta'}
                        </button>
                      )}
                      {metaStatus === 'rejected' && (
                        <button
                          className={`${B}__card-submit-btn`}
                          onClick={() => handleSubmitToMeta(auto.id)}
                          disabled={submittingId === auto.id}
                        >
                          {submittingId === auto.id ? 'Reenviando...' : 'Reenviar a Meta'}
                        </button>
                      )}
                      {metaStatus === 'pending' && (
                        <button
                          className={`${B}__card-action-btn`}
                          onClick={() => handleCheckStatus(auto.id)}
                          disabled={checkingId === auto.id}
                        >
                          {checkingId === auto.id ? 'Verificando...' : 'Verificar estado'}
                        </button>
                      )}
                    </div>
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
