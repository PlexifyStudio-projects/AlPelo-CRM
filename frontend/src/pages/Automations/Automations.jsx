import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import automationService from '../../services/automationService';
import templateService from '../../services/templateService';

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

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [wfs, st, tpls] = await Promise.all([
        automationService.getAutomations(),
        automationService.getAutomationStats(),
        templateService.getApprovedTemplates(),
      ]);
      setAutomations(wfs || []);
      setStats(st || {});
      setApprovedTemplates(tpls || []);
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

  // Filter automations by category
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

          {/* Workflow Cards Grid */}
          {filteredAutomations.length === 0 && (
            <div className={`${B}__empty`}>
              <div className={`${B}__empty-icon`}>⚡</div>
              <h3 className={`${B}__empty-title`}>
                {automations.length === 0
                  ? 'Conectando motor de automatización...'
                  : 'Sin workflows en esta categoría'}
              </h3>
              <p className={`${B}__empty-desc`}>
                {automations.length === 0
                  ? 'Los workflows se crean automáticamente al desplegar el backend. Incluye recordatorios de cita, cumpleaños, reactivación, bienvenida, resumen diario y más.'
                  : 'Prueba con otra categoría o selecciona "Todos".'}
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

                  {/* Channel + Status badges */}
                  <div className={`${B}__card-badges`}>
                    <span
                      className={`${B}__card-channel`}
                      style={{ '--channel-color': channelInfo.color }}
                    >
                      {channelInfo.icon} {channelInfo.label}
                    </span>
                    <span className={`${B}__card-status ${auto.enabled ? `${B}__card-status--active` : `${B}__card-status--inactive`}`}>
                      <span className={`${B}__card-status-dot`} />
                      {auto.enabled ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Config row: days, send hour, template */}
                  <div className={`${B}__card-config`}>
                    {/* Days selector (reactivation) */}
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

                    {/* Send hour selector */}
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

                    {/* Template selector — from approved templates in Plantillas */}
                    {auto.channel !== 'interno' && (
                      <div className={`${B}__card-config-item ${B}__card-config-item--full`}>
                        <span className={`${B}__card-config-label`}>Plantilla aprobada:</span>
                        <select
                          className={`${B}__card-config-select ${B}__card-config-select--wide`}
                          value={auto.template_name || ''}
                          onChange={e => handleConfigChange(auto.id, 'template_name', e.target.value)}
                        >
                          <option value="">— Seleccionar plantilla —</option>
                          {approvedTemplates.map(tpl => (
                            <option key={tpl.id} value={tpl.slug}>
                              {tpl.name} ({tpl.category})
                            </option>
                          ))}
                        </select>
                        {auto.template_name ? (
                          <span className={`${B}__card-config-hint ${B}__card-config-hint--ok`}>
                            ✅ Plantilla "{auto.template_name}" configurada — funciona siempre
                          </span>
                        ) : (
                          <span className={`${B}__card-config-hint`}>
                            ⚠️ Sin plantilla: solo funciona si el cliente escribió en las últimas 24h
                          </span>
                        )}
                      </div>
                    )}

                    {/* Variables info */}
                    {auto.variables && auto.variables.length > 0 && (
                      <div className={`${B}__card-config-item ${B}__card-config-item--full`}>
                        <span className={`${B}__card-config-label`}>Variables:</span>
                        <div className={`${B}__card-variables`}>
                          {auto.variables.map(v => (
                            <span key={v} className={`${B}__card-variable`}>{'{{' + v + '}}'}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message preview / edit */}
                  <div className={`${B}__card-message`}>
                    <span className={`${B}__card-message-label`}>
                      <WhatsAppSmall /> Mensaje automático
                    </span>
                    {editingId === auto.id ? (
                      <textarea
                        className={`${B}__card-message-edit`}
                        value={editMessage}
                        onChange={e => setEditMessage(e.target.value)}
                        rows={4}
                        autoFocus
                      />
                    ) : (
                      <div className={`${B}__card-bubble`}>
                        {auto.message}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className={`${B}__card-footer`}>
                    <div className={`${B}__card-stats`}>
                      <span className={`${B}__card-stat`}>
                        📤 <strong>{(auto.stats?.sent || 0).toLocaleString()}</strong> enviados
                      </span>
                      <span className={`${B}__card-stat`}>
                        💬 <strong>{(auto.stats?.responded || 0).toLocaleString()}</strong> respondidos
                      </span>
                      <span className={`${B}__card-last`}>
                        {getTimeAgo(auto.last_triggered)}
                      </span>
                    </div>
                    <div className={`${B}__card-actions`}>
                      {editingId === auto.id ? (
                        <>
                          <button
                            className={`${B}__card-btn ${B}__card-btn--cancel`}
                            onClick={cancelEdit}
                          >
                            Cancelar
                          </button>
                          <button
                            className={`${B}__card-btn ${B}__card-btn--save`}
                            onClick={() => saveEdit(auto.id)}
                          >
                            <SaveIcon /> Guardar
                          </button>
                        </>
                      ) : (
                        <button
                          className={`${B}__card-btn`}
                          onClick={() => startEdit(auto)}
                        >
                          <EditIcon /> Editar
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
