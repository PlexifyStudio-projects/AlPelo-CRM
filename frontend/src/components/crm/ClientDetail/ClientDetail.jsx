import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../common/Button/Button';
import { formatCurrency, formatDate, daysSince } from '../../../utils/formatters';
import { mockBarbers } from '../../../data/mockData';
import { STATUS_META, getStatusExplanation } from '../../../utils/clientStatus';

const ClientDetail = ({ client, onClose, onEdit, onNotesSave, visitHistory = [] }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const b = 'client-detail';

  // Sync notes/tab state when client changes
  useEffect(() => {
    if (client) {
      setNotesValue(client.notes || '');
      setEditingNotes(false);
      setActiveTab('overview');
    }
  }, [client]);

  // Escape key to close
  useEffect(() => {
    if (!client) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [client, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!client) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [client]);

  if (!client) return null;

  const clientHistory = visitHistory
    .filter((v) => v.clientId === client.id)
    .sort((a, c) => new Date(c.date) - new Date(a.date));
  const preferredBarber = mockBarbers.find((br) => br.id === client.preferredBarber);

  const getInitials = (name) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const tabs = [
    { id: 'overview', label: 'Resumen' },
    { id: 'analytics', label: 'Analítica' },
    { id: 'history', label: 'Historial' },
    { id: 'notes', label: 'Notas' },
  ];

  const statusMeta = STATUS_META[client.status] || { label: client.status, color: 'default' };
  const daysAgo = client.daysSinceLastVisit ?? daysSince(client.lastVisit);

  const statItems = [
    {
      label: 'Total Visitas', value: client.totalVisits, accent: 'primary',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
    },
    {
      label: 'Total Gastado', value: formatCurrency(client.totalSpent), accent: 'accent',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    },
    {
      label: 'Ticket Promedio', value: formatCurrency(client.avgTicket || 0), accent: 'info',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
    },
    {
      label: 'Días sin Visitar', value: daysAgo,
      accent: daysAgo > 60 ? 'danger' : daysAgo > 45 ? 'warning' : daysAgo > 20 ? 'warning' : 'success',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    },
    {
      label: 'No-Shows', value: client.noShowCount ?? 0,
      accent: (client.noShowCount ?? 0) > 0 ? 'danger' : 'success',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
    },
    {
      label: 'Cliente Desde', value: formatDate(client.firstVisit), accent: 'primary',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    },
  ];

  const genderLabel = { M: 'Masculino', F: 'Femenino', NB: 'No binario' };

  const contactItems = [
    {
      label: 'Teléfono', value: client.phone,
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
    },
    {
      label: 'Email', value: client.email || '\u2014',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
    },
    {
      label: 'Cumpleaños', value: client.birthday ? formatDate(client.birthday) : '\u2014',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    },
    {
      label: 'Género', value: genderLabel[client.gender] || '\u2014',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>,
    },
    {
      label: 'Origen', value: client.source || '\u2014',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
    },
    {
      label: 'WhatsApp',
      value: client.acceptsWhatsApp ? 'Acepta mensajes' : 'No acepta',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
    },
  ];

  const StarRating = ({ value }) => {
    if (!value) return <span className={`${b}__no-rating`}>Sin calificar</span>;
    return (
      <span className={`${b}__stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            width="12" height="12"
            viewBox="0 0 24 24"
            fill={star <= value ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            className={star <= value ? `${b}__star--filled` : `${b}__star--empty`}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
          </svg>
        ))}
      </span>
    );
  };

  const handleSaveNotes = () => {
    onNotesSave(client.id, notesValue);
    setEditingNotes(false);
  };

  const visitStatusLabels = { completed: 'Completada', no_show: 'No asistió', cancelled: 'Cancelada' };

  return createPortal(
    <div className={`${b}__wrapper`}>
      <div className={`${b}__overlay`} onClick={onClose} />

      <div className={b}>
        <div className={`${b}__accent-bar ${b}__accent-bar--${client.status}`} />

        {/* Header */}
        <div className={`${b}__header`}>
          <div className={`${b}__header-left`}>
            <div className={`${b}__avatar ${b}__avatar--${client.status}`}>
              {getInitials(client.name)}
            </div>
            <div className={`${b}__header-info`}>
              <h2 className={`${b}__name`}>{client.name}</h2>
              {client.clientId && <span className={`${b}__client-id`}>{client.clientId}</span>}
              <span className={`${b}__status ${b}__status--${client.status}`}>
                {client.status === 'vip' && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                  </svg>
                )}
                {statusMeta.label}
              </span>
            </div>
          </div>
          <button className={`${b}__close`} onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className={`${b}__tabs`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${b}__tab ${activeTab === tab.id ? `${b}__tab--active` : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className={`${b}__content`}>
          {activeTab === 'overview' && (
            <div className={`${b}__overview`}>
              {/* Stats grid */}
              <div className={`${b}__stats-grid`}>
                {statItems.map((stat) => (
                  <div key={stat.label} className={`${b}__stat ${b}__stat--${stat.accent}`}>
                    <div className={`${b}__stat-icon`}>{stat.icon}</div>
                    <span className={`${b}__stat-label`}>{stat.label}</span>
                    <span className={`${b}__stat-value`}>{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Contact info */}
              <div className={`${b}__info-section`}>
                <h4 className={`${b}__section-title`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Información de Contacto
                </h4>
                <div className={`${b}__info-grid`}>
                  {contactItems.map((item) => (
                    <div key={item.label} className={`${b}__info-item`}>
                      <div className={`${b}__info-icon`}>{item.icon}</div>
                      <div className={`${b}__info-text`}>
                        <span className={`${b}__info-label`}>{item.label}</span>
                        <span className={`${b}__info-value`}>{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service preferences */}
              <div className={`${b}__info-section`}>
                <h4 className={`${b}__section-title`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                  </svg>
                  Preferencias de Servicio
                </h4>
                <div className={`${b}__pref-grid`}>
                  <div className={`${b}__pref-item`}>
                    <span className={`${b}__pref-label`}>Servicio favorito</span>
                    <span className={`${b}__pref-value`}>{client.favoriteService || '\u2014'}</span>
                  </div>
                  <div className={`${b}__pref-item`}>
                    <span className={`${b}__pref-label`}>Barbero preferido</span>
                    <span className={`${b}__pref-value`}>{preferredBarber?.name || '\u2014'}</span>
                  </div>
                  {client.haircutStyleNotes && (
                    <div className={`${b}__pref-item ${b}__pref-item--full`}>
                      <span className={`${b}__pref-label`}>Estilo de corte</span>
                      <span className={`${b}__pref-value`}>{client.haircutStyleNotes}</span>
                    </div>
                  )}
                  {client.beardStyleNotes && (
                    <div className={`${b}__pref-item ${b}__pref-item--full`}>
                      <span className={`${b}__pref-label`}>Estilo de barba</span>
                      <span className={`${b}__pref-value`}>{client.beardStyleNotes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {client.tags?.length > 0 && (
                <div className={`${b}__info-section`}>
                  <div className={`${b}__tags`}>
                    {client.tags.map((tag, idx) => {
                      const colors = ['primary', 'accent', 'info', 'success', 'warning'];
                      return (
                        <span key={tag} className={`${b}__tag ${b}__tag--${colors[idx % colors.length]}`}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className={`${b}__analytics`}>
              {/* Loyalty points */}
              <div className={`${b}__loyalty-card`}>
                <div className={`${b}__loyalty-header`}>
                  <span>Puntos de Lealtad</span>
                  <strong>{client.loyaltyPoints ?? 0} pts</strong>
                </div>
                <div className={`${b}__loyalty-bar`}>
                  <div
                    className={`${b}__loyalty-fill`}
                    style={{ width: `${Math.min(100, ((client.loyaltyPoints ?? 0) / 3000) * 100)}%` }}
                  />
                </div>
                <span className={`${b}__loyalty-hint`}>
                  {(client.loyaltyPoints ?? 0) >= 3000
                    ? '¡Recompensa disponible!'
                    : `Faltan ${3000 - (client.loyaltyPoints ?? 0)} pts para la próxima recompensa`
                  }
                </span>
              </div>

              {/* Analytics grid */}
              <div className={`${b}__analytics-row`}>
                <div className={`${b}__analytics-item`}>
                  <span>Frecuencia promedio</span>
                  <strong>{client.avgVisitInterval ? `${client.avgVisitInterval} días` : '\u2014'}</strong>
                </div>
                <div className={`${b}__analytics-item`}>
                  <span>No-shows</span>
                  <strong className={(client.noShowCount ?? 0) > 0 ? `${b}__value--danger` : ''}>{client.noShowCount ?? 0}</strong>
                </div>
                <div className={`${b}__analytics-item`}>
                  <span>Cancelaciones</span>
                  <strong>{client.cancellationCount ?? 0}</strong>
                </div>
              </div>

              {/* Status explanation card */}
              <div className={`${b}__status-card ${b}__status-card--${client.status}`}>
                <strong>Estado actual: {statusMeta.label}</strong>
                <p>{getStatusExplanation(client)}</p>
              </div>

              {/* Visit frequency insight */}
              {client.avgVisitInterval && (
                <div className={`${b}__insight-card`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <p>
                    {client.avgVisitInterval <= 21
                      ? 'Excelente frecuencia de visita. Este cliente viene regularmente cada 2-3 semanas.'
                      : client.avgVisitInterval <= 35
                        ? 'Buena frecuencia mensual. Considerar incentivar visitas más frecuentes.'
                        : 'Frecuencia baja. Considerar campaña de reactivación o descuento.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className={`${b}__history`}>
              {clientHistory.length === 0 ? (
                <div className={`${b}__empty`}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <p>No hay historial disponible</p>
                </div>
              ) : (
                clientHistory.map((visit, idx) => {
                  const barber = mockBarbers.find((br) => br.id === visit.barberId);
                  const visitStatus = visit.status || 'completed';
                  return (
                    <div
                      key={visit.id}
                      className={`${b}__history-item`}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div className={`${b}__history-dot ${b}__history-dot--${visitStatus}`} />
                      <div className={`${b}__history-body`}>
                        <div className={`${b}__history-top`}>
                          <div className={`${b}__history-service-row`}>
                            <span className={`${b}__history-service`}>{visit.service}</span>
                            {visitStatus !== 'completed' && (
                              <span className={`${b}__history-visit-status ${b}__history-visit-status--${visitStatus}`}>
                                {visitStatusLabels[visitStatus]}
                              </span>
                            )}
                          </div>
                          <span className={`${b}__history-amount`}>{formatCurrency(visit.amount)}</span>
                        </div>
                        <div className={`${b}__history-meta`}>
                          <span className={`${b}__history-date`}>{formatDate(visit.date)}</span>
                          {barber && (
                            <>
                              <span className={`${b}__history-sep`}>&middot;</span>
                              <span className={`${b}__history-barber`}>{barber.name}</span>
                            </>
                          )}
                          {visit.rating && (
                            <>
                              <span className={`${b}__history-sep`}>&middot;</span>
                              <StarRating value={visit.rating} />
                            </>
                          )}
                        </div>
                        {visit.notes && (
                          <p className={`${b}__history-note`}>{visit.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className={`${b}__notes`}>
              {editingNotes ? (
                <div className={`${b}__notes-edit`}>
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Escribe notas sobre este cliente..."
                    autoFocus
                  />
                  <div className={`${b}__notes-actions`}>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingNotes(false); setNotesValue(client.notes || ''); }}>
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveNotes}>
                      Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {notesValue ? (
                    <div className={`${b}__notes-card`}>
                      <svg className={`${b}__notes-icon`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <p className={`${b}__notes-text`}>{notesValue}</p>
                    </div>
                  ) : (
                    <div className={`${b}__empty`}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <p>Sin notas registradas</p>
                    </div>
                  )}
                  <div className={`${b}__notes-edit-btn`}>
                    <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      {notesValue ? 'Editar notas' : 'Agregar notas'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`${b}__footer`}>
          <Button variant="ghost" size="md" onClick={onClose}>Cerrar</Button>
          {client.acceptsWhatsApp && client.phone && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}`, '_blank')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 0 1-4.243-1.214l-.257-.154-2.849.846.846-2.849-.154-.257A8 8 0 1 1 12 20z" />
              </svg>
              WhatsApp
            </Button>
          )}
          <Button variant="primary" size="md" onClick={() => onEdit(client)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ClientDetail;
