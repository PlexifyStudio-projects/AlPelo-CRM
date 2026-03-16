import { useState, useEffect, useMemo } from 'react';
import { useNotification } from '../../context/NotificationContext';
import reviewService from '../../services/reviewService';

const B = 'reviews';

// ═══════════════════════════════════════════════
// SVG Icons
// ═══════════════════════════════════════════════
const StarIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#F59E0B' : 'none'} stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const GoogleIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
const SettingsIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>;
const SaveIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const AlertIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const CheckCircleIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const TrendUpIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
const MessageIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const ExternalLinkIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;

// ═══════════════════════════════════════════════
// Stars Display
// ═══════════════════════════════════════════════
const Stars = ({ rating, size = 16 }) => (
  <div className={`${B}__stars`}>
    {[1, 2, 3, 4, 5].map(i => (
      <svg key={i} width={size} height={size} viewBox="0 0 24 24"
        fill={i <= rating ? '#F59E0B' : 'none'}
        stroke={i <= rating ? '#F59E0B' : '#D1D5DB'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ))}
  </div>
);

// ═══════════════════════════════════════════════
// Status helpers
// ═══════════════════════════════════════════════
const STATUS_MAP = {
  sent_to_google: { label: 'Enviado a Google', color: '#34D399', icon: <GoogleIcon /> },
  escalated: { label: 'Escalado al dueno', color: '#F87171', icon: <AlertIcon /> },
  no_response: { label: 'Sin respuesta', color: '#8E8E85', icon: <ClockIcon /> },
};

// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════
const ReviewsPipeline = () => {
  const { addNotification } = useNotification();

  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | config
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state for config
  const [formConfig, setFormConfig] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, st, rv] = await Promise.all([
          reviewService.getConfig(),
          reviewService.getStats(),
          reviewService.getRecentReviews(10),
        ]);
        setConfig(cfg);
        setFormConfig({ ...cfg });
        setStats(st);
        setReviews(rv);
      } catch (e) {
        console.error('Failed to load reviews data:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const saved = await reviewService.saveConfig(formConfig);
      setConfig(saved);
      addNotification('Configuracion de resenas guardada', 'success');
      setActiveTab('dashboard');
    } catch (e) {
      addNotification('Error al guardar configuracion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key, value) => {
    setFormConfig(prev => ({ ...prev, [key]: value }));
  };

  // Distribution bar max
  const distMax = useMemo(() => {
    if (!stats?.distribution) return 1;
    return Math.max(...Object.values(stats.distribution), 1);
  }, [stats]);

  if (loading) {
    return (
      <div className={`${B}`}>
        <div className={`${B}__loading`}>Cargando pipeline de resenas...</div>
      </div>
    );
  }

  return (
    <div className={`${B}`}>
      {/* Header */}
      <div className={`${B}__header`}>
        <div className={`${B}__header-left`}>
          <div className={`${B}__header-icon`}>
            <GoogleIcon />
          </div>
          <div className={`${B}__header-text`}>
            <h2 className={`${B}__title`}>Pipeline de Resenas</h2>
            <span className={`${B}__subtitle`}>Encuestas post-visita y redireccion a Google Reviews</span>
          </div>
        </div>
        <div className={`${B}__header-tabs`}>
          <button
            className={`${B}__tab ${activeTab === 'dashboard' ? `${B}__tab--active` : ''}`}
            onClick={() => setActiveTab('dashboard')}>
            <TrendUpIcon /> Dashboard
          </button>
          <button
            className={`${B}__tab ${activeTab === 'config' ? `${B}__tab--active` : ''}`}
            onClick={() => setActiveTab('config')}>
            <SettingsIcon /> Configuracion
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          {/* Stats KPI Cards */}
          <div className={`${B}__kpis`}>
            <div className={`${B}__kpi`}>
              <div className={`${B}__kpi-icon ${B}__kpi-icon--sent`}><MessageIcon /></div>
              <div className={`${B}__kpi-info`}>
                <span className={`${B}__kpi-value`}>{stats?.totalSent || 0}</span>
                <span className={`${B}__kpi-label`}>Encuestas enviadas</span>
              </div>
            </div>
            <div className={`${B}__kpi`}>
              <div className={`${B}__kpi-icon ${B}__kpi-icon--rate`}><TrendUpIcon /></div>
              <div className={`${B}__kpi-info`}>
                <span className={`${B}__kpi-value`}>{stats?.responseRate || 0}%</span>
                <span className={`${B}__kpi-label`}>Tasa de respuesta</span>
              </div>
            </div>
            <div className={`${B}__kpi`}>
              <div className={`${B}__kpi-icon ${B}__kpi-icon--avg`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              </div>
              <div className={`${B}__kpi-info`}>
                <span className={`${B}__kpi-value`}>{stats?.averageRating?.toFixed(1) || '0.0'}</span>
                <span className={`${B}__kpi-label`}>Calificacion promedio</span>
              </div>
            </div>
            <div className={`${B}__kpi`}>
              <div className={`${B}__kpi-icon ${B}__kpi-icon--positive`}><CheckCircleIcon /></div>
              <div className={`${B}__kpi-info`}>
                <span className={`${B}__kpi-value`}>{stats?.positiveRedirected || 0}</span>
                <span className={`${B}__kpi-label`}>Enviadas a Google</span>
              </div>
            </div>
            <div className={`${B}__kpi`}>
              <div className={`${B}__kpi-icon ${B}__kpi-icon--escalated`}><AlertIcon /></div>
              <div className={`${B}__kpi-info`}>
                <span className={`${B}__kpi-value`}>{stats?.issuesEscalated || 0}</span>
                <span className={`${B}__kpi-label`}>Escaladas al dueno</span>
              </div>
            </div>
          </div>

          {/* Distribution + Recent Reviews */}
          <div className={`${B}__body`}>
            {/* Rating Distribution */}
            <div className={`${B}__distribution`}>
              <h3 className={`${B}__section-title`}>Distribucion de calificaciones</h3>
              <div className={`${B}__dist-bars`}>
                {[5, 4, 3, 2, 1].map(star => {
                  const count = stats?.distribution?.[star] || 0;
                  const pct = distMax > 0 ? (count / distMax) * 100 : 0;
                  const isPositive = star >= 4;
                  return (
                    <div key={star} className={`${B}__dist-row`}>
                      <span className={`${B}__dist-label`}>{star}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <div className={`${B}__dist-track`}>
                        <div
                          className={`${B}__dist-fill ${isPositive ? `${B}__dist-fill--positive` : `${B}__dist-fill--negative`}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`${B}__dist-count`}>{count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Pipeline summary */}
              <div className={`${B}__pipeline-summary`}>
                <div className={`${B}__pipeline-item ${B}__pipeline-item--positive`}>
                  <CheckCircleIcon />
                  <span>4-5 estrellas van a Google Reviews</span>
                </div>
                <div className={`${B}__pipeline-item ${B}__pipeline-item--negative`}>
                  <AlertIcon />
                  <span>1-3 estrellas se escalan al dueno</span>
                </div>
              </div>
            </div>

            {/* Recent Reviews Feed */}
            <div className={`${B}__feed`}>
              <h3 className={`${B}__section-title`}>Resenas recientes</h3>
              <div className={`${B}__feed-list`}>
                {reviews.map(rv => {
                  const statusInfo = STATUS_MAP[rv.status] || STATUS_MAP.no_response;
                  const dateStr = new Date(rv.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={rv.id} className={`${B}__feed-item`}>
                      <div className={`${B}__feed-top`}>
                        <div className={`${B}__feed-client`}>
                          <span className={`${B}__feed-name`}>{rv.clientName}</span>
                          <span className={`${B}__feed-date`}>{dateStr}</span>
                        </div>
                        <span
                          className={`${B}__feed-status`}
                          style={{ '--status-color': statusInfo.color }}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                      </div>
                      {rv.rating > 0 && (
                        <div className={`${B}__feed-rating`}>
                          <Stars rating={rv.rating} size={14} />
                          <span className={`${B}__feed-rating-text`}>{rv.rating}/5</span>
                        </div>
                      )}
                      {rv.feedback && (
                        <p className={`${B}__feed-feedback`}>{rv.feedback}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Configuration Panel */
        <div className={`${B}__config`}>
          <div className={`${B}__config-section`}>
            <h3 className={`${B}__section-title`}>Enlace de Google Reviews</h3>
            <p className={`${B}__config-desc`}>El link directo de tu negocio en Google Maps para dejar resenas.</p>
            <div className={`${B}__config-field`}>
              <div className={`${B}__config-input-wrap`}>
                <GoogleIcon />
                <input
                  type="url"
                  value={formConfig?.googleReviewsUrl || ''}
                  onChange={e => updateForm('googleReviewsUrl', e.target.value)}
                  placeholder="https://g.page/r/tu-negocio/review"
                  className={`${B}__config-input`}
                />
                {formConfig?.googleReviewsUrl && (
                  <a href={formConfig.googleReviewsUrl} target="_blank" rel="noopener noreferrer" className={`${B}__config-link`}>
                    <ExternalLinkIcon />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className={`${B}__config-section`}>
            <h3 className={`${B}__section-title`}>Automatizacion</h3>
            <div className={`${B}__config-row`}>
              <div className={`${B}__config-field`}>
                <label className={`${B}__config-label`}>Envio automatico</label>
                <button
                  className={`${B}__toggle ${formConfig?.autoSendEnabled ? `${B}__toggle--on` : ''}`}
                  onClick={() => updateForm('autoSendEnabled', !formConfig?.autoSendEnabled)}>
                  <span className={`${B}__toggle-knob`} />
                  <span className={`${B}__toggle-text`}>{formConfig?.autoSendEnabled ? 'Activo' : 'Inactivo'}</span>
                </button>
              </div>
              <div className={`${B}__config-field`}>
                <label className={`${B}__config-label`}>Demora despues de visita</label>
                <select
                  value={formConfig?.delayAfterVisit || '2h'}
                  onChange={e => updateForm('delayAfterVisit', e.target.value)}
                  className={`${B}__config-select`}>
                  <option value="2h">2 horas</option>
                  <option value="4h">4 horas</option>
                  <option value="24h">24 horas</option>
                </select>
              </div>
              <div className={`${B}__config-field`}>
                <label className={`${B}__config-label`}>Umbral positivo</label>
                <select
                  value={formConfig?.satisfactionThreshold || 4}
                  onChange={e => updateForm('satisfactionThreshold', parseInt(e.target.value))}
                  className={`${B}__config-select`}>
                  <option value={4}>4+ estrellas = Google</option>
                  <option value={3}>3+ estrellas = Google</option>
                  <option value={5}>Solo 5 estrellas = Google</option>
                </select>
              </div>
            </div>
          </div>

          <div className={`${B}__config-section`}>
            <h3 className={`${B}__section-title`}>Mensaje de encuesta</h3>
            <p className={`${B}__config-desc`}>Se envia automaticamente despues de cada visita. Variables: {'{{nombre}}'}</p>
            <textarea
              value={formConfig?.surveyMessage || ''}
              onChange={e => updateForm('surveyMessage', e.target.value)}
              className={`${B}__config-textarea`}
              rows={3}
            />
          </div>

          <div className={`${B}__config-section`}>
            <h3 className={`${B}__section-title`}>Mensajes de seguimiento</h3>
            <div className={`${B}__config-messages`}>
              <div className={`${B}__config-msg ${B}__config-msg--positive`}>
                <label className={`${B}__config-label`}>
                  <CheckCircleIcon /> Si la calificacion es positiva ({'>'}= {formConfig?.satisfactionThreshold || 4} estrellas)
                </label>
                <textarea
                  value={formConfig?.positiveFollowUp || ''}
                  onChange={e => updateForm('positiveFollowUp', e.target.value)}
                  className={`${B}__config-textarea`}
                  rows={3}
                />
                <span className={`${B}__config-hint`}>Variables: {'{{google_reviews_url}}'}</span>
              </div>
              <div className={`${B}__config-msg ${B}__config-msg--negative`}>
                <label className={`${B}__config-label`}>
                  <AlertIcon /> Si la calificacion es negativa ({'<'} {formConfig?.satisfactionThreshold || 4} estrellas)
                </label>
                <textarea
                  value={formConfig?.negativeFollowUp || ''}
                  onChange={e => updateForm('negativeFollowUp', e.target.value)}
                  className={`${B}__config-textarea`}
                  rows={3}
                />
                <span className={`${B}__config-hint`}>Variables: {'{{owner_name}}'}</span>
              </div>
              <div className={`${B}__config-msg ${B}__config-msg--owner`}>
                <label className={`${B}__config-label`}>
                  <AlertIcon /> Notificacion al dueno (cuando es negativa)
                </label>
                <textarea
                  value={formConfig?.ownerNotification || ''}
                  onChange={e => updateForm('ownerNotification', e.target.value)}
                  className={`${B}__config-textarea`}
                  rows={3}
                />
                <span className={`${B}__config-hint`}>Variables: {'{{nombre}}, {{rating}}, {{feedback}}, {{phone}}'}</span>
              </div>
            </div>
          </div>

          <div className={`${B}__config-actions`}>
            <button className={`${B}__btn--ghost`} onClick={() => setActiveTab('dashboard')}>
              Cancelar
            </button>
            <button className={`${B}__btn--primary`} onClick={handleSaveConfig} disabled={saving}>
              <SaveIcon /> {saving ? 'Guardando...' : 'Guardar configuracion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsPipeline;
