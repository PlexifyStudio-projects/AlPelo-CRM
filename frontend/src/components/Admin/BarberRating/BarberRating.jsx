import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { mockBarbers, mockClients, mockVisitHistory } from '../../../data/mockData';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { useNotification } from '../../../context/NotificationContext';
import { useTenant } from '../../../context/TenantContext';
import Modal from '../../common/Modal/Modal';

const StarIcon = ({ filled, half }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#C9A84C' : half ? 'url(#halfGrad)' : 'none'} stroke="#C9A84C" strokeWidth="1.5">
    {half && (
      <defs>
        <linearGradient id="halfGrad">
          <stop offset="50%" stopColor="#C9A84C" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
    )}
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const StarRating = memo(({ rating }) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const roundUp = rating - fullStars >= 0.75;
  return (
    <div className="barber-rating__stars">
      {Array.from({ length: 5 }, (_, i) => {
        const isFull = i < fullStars || (roundUp && i === fullStars);
        const isHalf = !isFull && hasHalf && i === fullStars;
        return <StarIcon key={i} filled={isFull} half={isHalf} />;
      })}
      <span className="barber-rating__stars-value">{rating.toFixed(1)}</span>
    </div>
  );
});

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const DollarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CameraIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const ClipboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const getInitials = (name) => {
  const parts = name.split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
};

const STORAGE_KEY = 'alpelo_barber_photos';

const loadBarberPhotos = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveBarberPhotos = (photos) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  } catch {}
};

const computeBarberStats = () => {
  return mockBarbers.map((barber) => {
    const barberVisits = mockVisitHistory.filter(
      (v) => v.barberId === barber.id && v.status === 'completed'
    );

    const ratings = barberVisits
      .filter((v) => v.rating !== null && v.rating !== undefined)
      .map((v) => v.rating);

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

    const uniqueClientIds = [...new Set(barberVisits.map((v) => v.clientId))];
    const totalRevenue = barberVisits.reduce((sum, v) => sum + v.amount, 0);
    const avgTicket = barberVisits.length > 0
      ? Math.round(totalRevenue / barberVisits.length)
      : 0;

    const serviceCount = {};
    barberVisits.forEach((v) => {
      serviceCount[v.service] = (serviceCount[v.service] || 0) + 1;
    });
    const topServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const monthRevenue = {};
    barberVisits.forEach((v) => {
      const monthKey = v.date.substring(0, 7);
      monthRevenue[monthKey] = (monthRevenue[monthKey] || 0) + v.amount;
    });
    const bestMonth = Object.entries(monthRevenue)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      ...barber,
      computedRating: Math.round(avgRating * 10) / 10,
      uniqueClients: uniqueClientIds.length,
      totalRevenue,
      avgTicket,
      totalVisits: barberVisits.length,
      clientIds: uniqueClientIds,
      topServices,
      bestMonth: bestMonth ? { month: bestMonth[0], revenue: bestMonth[1] } : null,
    };
  });
};

const computeBarberClients = (barberId) => {
  const barberVisits = mockVisitHistory.filter(
    (v) => v.barberId === barberId && v.status === 'completed'
  );

  const clientMap = {};
  barberVisits.forEach((visit) => {
    if (!clientMap[visit.clientId]) {
      const client = mockClients.find((c) => c.id === visit.clientId);
      clientMap[visit.clientId] = {
        id: visit.clientId,
        name: client?.name || 'Cliente desconocido',
        phone: client?.phone || '',
        acceptsWhatsApp: client?.acceptsWhatsApp || false,
        visits: 0,
        totalSpent: 0,
        totalRating: 0,
        ratingCount: 0,
        lastVisitDate: null,
      };
    }
    clientMap[visit.clientId].visits += 1;
    clientMap[visit.clientId].totalSpent += visit.amount;
    if (visit.rating !== null && visit.rating !== undefined) {
      clientMap[visit.clientId].totalRating += visit.rating;
      clientMap[visit.clientId].ratingCount += 1;
    }
    const visitDate = new Date(visit.date);
    if (!clientMap[visit.clientId].lastVisitDate || visitDate > clientMap[visit.clientId].lastVisitDate) {
      clientMap[visit.clientId].lastVisitDate = visitDate;
    }
  });

  return Object.values(clientMap).map((c) => ({
    ...c,
    avgRating: c.ratingCount > 0 ? Math.round((c.totalRating / c.ratingCount) * 10) / 10 : null,
    lastVisit: c.lastVisitDate ? c.lastVisitDate.toISOString().split('T')[0] : null,
  }));
};

const SORT_OPTIONS = [
  { value: 'visits', label: 'Mas visitas' },
  { value: 'rating', label: 'Mejor calificacion' },
  { value: 'recent', label: 'Mas reciente' },
];

const formatMonthLabel = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
};

const ClientSelectionList = memo(({ barberClients, selectedClientIds, toggleClientSelection, toggleAllClients, b }) => (
  <div className={`${b}__client-selection`}>
    <div className={`${b}__client-selection-header`}>
      <label className={`${b}__checkbox-wrapper`}>
        <input
          type="checkbox"
          className={`${b}__checkbox`}
          checked={selectedClientIds.size === barberClients.length && barberClients.length > 0}
          onChange={toggleAllClients}
        />
        <span className={`${b}__checkbox-custom`}>
          {selectedClientIds.size === barberClients.length && barberClients.length > 0 && <CheckIcon />}
        </span>
        <span className={`${b}__checkbox-label`}>
          Seleccionar todos ({barberClients.length})
        </span>
      </label>
      <span className={`${b}__selected-count`}>
        {selectedClientIds.size} seleccionados
      </span>
    </div>
    <div className={`${b}__client-check-list`}>
      {barberClients.map((client) => (
        <label
          key={client.id}
          className={`${b}__client-check-item ${selectedClientIds.has(client.id) ? `${b}__client-check-item--selected` : ''}`}
        >
          <input
            type="checkbox"
            className={`${b}__checkbox`}
            checked={selectedClientIds.has(client.id)}
            onChange={() => toggleClientSelection(client.id)}
          />
          <span className={`${b}__checkbox-custom`}>
            {selectedClientIds.has(client.id) && <CheckIcon />}
          </span>
          <div className={`${b}__client-check-info`}>
            <span className={`${b}__client-check-name`}>{client.name}</span>
            <span className={`${b}__client-check-phone`}>{client.phone}</span>
          </div>
          {!client.acceptsWhatsApp && (
            <span className={`${b}__client-check-badge`}>Sin WhatsApp</span>
          )}
        </label>
      ))}
    </div>
  </div>
));

const BarberRating = () => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();
  const [expandedBarberId, setExpandedBarberId] = useState(null);
  const [sortBy, setSortBy] = useState('visits');
  const [clientFilter, setClientFilter] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState(new Set());
  const [isSending, setIsSending] = useState(false);
  const [retentionOffer, setRetentionOffer] = useState('20% de descuento en tu próximo servicio');
  const [barberPhotos, setBarberPhotos] = useState({});

  const fileInputRefs = useRef({});

  const b = 'barber-rating';

  useEffect(() => {
    setBarberPhotos(loadBarberPhotos());
  }, []);

  const barberStats = useMemo(() => computeBarberStats(), []);

  const barberStatsWithVisits = useMemo(() => {
    return barberStats.filter((bs) => bs.totalVisits > 0);
  }, [barberStats]);

  const expandedBarber = useMemo(() => {
    return barberStatsWithVisits.find((bs) => bs.id === expandedBarberId) || null;
  }, [barberStatsWithVisits, expandedBarberId]);

  const barberClients = useMemo(() => {
    if (!expandedBarberId) return [];
    return computeBarberClients(expandedBarberId);
  }, [expandedBarberId]);

  const filteredClients = useMemo(() => {
    let clients = [...barberClients];

    if (clientFilter.trim()) {
      const q = clientFilter.toLowerCase();
      clients = clients.filter((c) => c.name.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'visits':
        clients.sort((a, cb) => cb.visits - a.visits);
        break;
      case 'rating':
        clients.sort((a, cb) => (cb.avgRating || 0) - (a.avgRating || 0));
        break;
      case 'recent':
        clients.sort((a, cb) => new Date(cb.lastVisit) - new Date(a.lastVisit));
        break;
      default:
        break;
    }
    return clients;
  }, [barberClients, clientFilter, sortBy]);

  const handleBarberClick = useCallback((barberId) => {
    if (expandedBarberId === barberId) {
      setExpandedBarberId(null);
    } else {
      setExpandedBarberId(barberId);
      setClientFilter('');
      setSortBy('visits');
    }
  }, [expandedBarberId]);

  const handlePhotoUpload = useCallback((barberId, event) => {
    event.stopPropagation();
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addNotification('Por favor selecciona un archivo de imagen valido', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addNotification('La imagen no debe superar 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setBarberPhotos((prev) => {
        const updated = { ...prev, [barberId]: base64 };
        saveBarberPhotos(updated);
        return updated;
      });
      addNotification('Foto actualizada exitosamente', 'success');
    };
    reader.readAsDataURL(file);

    event.target.value = '';
  }, [addNotification]);

  const handleCameraClick = useCallback((barberId, event) => {
    event.stopPropagation();
    const input = fileInputRefs.current[barberId];
    if (input) input.click();
  }, []);

  const handleOpenFeedback = useCallback((event) => {
    event.stopPropagation();
    const whatsappClients = barberClients.filter((c) => c.acceptsWhatsApp);
    setSelectedClientIds(new Set(whatsappClients.map((c) => c.id)));
    setShowFeedbackModal(true);
  }, [barberClients]);

  const handleOpenRetention = useCallback((event) => {
    event.stopPropagation();
    const whatsappClients = barberClients.filter((c) => c.acceptsWhatsApp);
    setSelectedClientIds(new Set(whatsappClients.map((c) => c.id)));
    setRetentionOffer('20% de descuento en tu próximo servicio');
    setShowRetentionModal(true);
  }, [barberClients]);

  const handleSendRetention = useCallback(() => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setShowRetentionModal(false);
      addNotification(
        `Campaña de retención enviada a ${selectedClientIds.size} clientes de ${expandedBarber?.name}`,
        'success'
      );
    }, 1500);
  }, [selectedClientIds.size, expandedBarber?.name, addNotification]);

  const toggleClientSelection = useCallback((clientId) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }, []);

  const toggleAllClients = useCallback(() => {
    if (selectedClientIds.size === barberClients.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(barberClients.map((c) => c.id)));
    }
  }, [selectedClientIds.size, barberClients]);

  const handleSendFeedback = useCallback(() => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setShowFeedbackModal(false);
      addNotification(
        `Encuesta enviada exitosamente a ${selectedClientIds.size} clientes de ${expandedBarber?.name}`,
        'success'
      );
    }, 1500);
  }, [selectedClientIds.size, expandedBarber?.name, addNotification]);

  const messageTemplate = useMemo(() => {
    return expandedBarber
      ? `Hola {nombre}! Que tal tu experiencia con ${expandedBarber.name} en ${tenant.name}? Tu opinion nos ayuda a mejorar. Responde del 1 al 5`
      : '';
  }, [expandedBarber, tenant.name]);

  const getMessagePreview = useCallback((clientName) => {
    return messageTemplate.replace('{nombre}', clientName);
  }, [messageTemplate]);

  const retentionTemplate = useMemo(() => {
    return expandedBarber
      ? `Hola {nombre}, soy Lina de ${tenant.name}. Queremos invitarte esta semana con un ${retentionOffer}. Te esperamos!${tenant.booking_url ? ` Agenda aqui: ${tenant.booking_url}` : ''}`
      : '';
  }, [expandedBarber, tenant.name, tenant.booking_url, retentionOffer]);

  const getRetentionPreview = useCallback((clientName) => {
    return retentionTemplate.replace('{nombre}', clientName);
  }, [retentionTemplate]);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div className={`${b}__header-left`}>
          <h2 className={`${b}__title`}>Rendimiento del Equipo</h2>
          <p className={`${b}__subtitle`}>
            Calificaciones, clientes atendidos e ingresos por profesional
          </p>
        </div>
      </div>

      <div className={`${b}__grid`}>
        {barberStatsWithVisits.map((barber, index) => {
          const isExpanded = expandedBarberId === barber.id;
          const photo = barberPhotos[barber.id];

          return (
            <div
              key={barber.id}
              className={`${b}__card ${isExpanded ? `${b}__card--selected` : ''} ${!barber.available ? `${b}__card--unavailable` : ''} ${isExpanded ? `${b}__card--expanded` : ''}`}
              onClick={() => handleBarberClick(barber.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleBarberClick(barber.id)}
              style={{ animationDelay: `${0.04 * (index + 1)}s` }}
            >
              <div className={`${b}__card-top`}>
                <div className={`${b}__card-avatar`}>
                  {photo ? (
                    <img
                      src={photo}
                      alt={barber.name}
                      className={`${b}__avatar-photo`}
                    />
                  ) : (
                    getInitials(barber.name)
                  )}
                  <span className={`${b}__card-dot ${barber.available ? `${b}__card-dot--active` : `${b}__card-dot--inactive`}`} />
                  <button
                    className={`${b}__avatar-upload`}
                    onClick={(e) => handleCameraClick(barber.id, e)}
                    title="Cambiar foto"
                    type="button"
                  >
                    <CameraIcon />
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    className={`${b}__avatar-input`}
                    ref={(el) => { fileInputRefs.current[barber.id] = el; }}
                    onChange={(e) => handlePhotoUpload(barber.id, e)}
                    tabIndex={-1}
                  />
                </div>
                <div className={`${b}__card-info`}>
                  <span className={`${b}__card-name`}>{barber.name}</span>
                  <span className={`${b}__card-specialty`}>{barber.specialty}</span>
                </div>
                <div className={`${b}__card-chevron ${isExpanded ? `${b}__card-chevron--open` : ''}`}>
                  <ChevronDownIcon />
                </div>
              </div>

              <div className={`${b}__card-rating`}>
                <StarRating rating={barber.computedRating} />
              </div>

              <div className={`${b}__card-metrics`}>
                <div className={`${b}__metric`}>
                  <span className={`${b}__metric-icon`}><UsersIcon /></span>
                  <div className={`${b}__metric-data`}>
                    <span className={`${b}__metric-value`}>{barber.uniqueClients}</span>
                    <span className={`${b}__metric-label`}>Clientes</span>
                  </div>
                </div>
                <div className={`${b}__metric`}>
                  <span className={`${b}__metric-icon`}><DollarIcon /></span>
                  <div className={`${b}__metric-data`}>
                    <span className={`${b}__metric-value`}>{formatCurrency(barber.totalRevenue)}</span>
                    <span className={`${b}__metric-label`}>Ingresos</span>
                  </div>
                </div>
                <div className={`${b}__metric`}>
                  <span className={`${b}__metric-icon`}><DollarIcon /></span>
                  <div className={`${b}__metric-data`}>
                    <span className={`${b}__metric-value`}>{formatCurrency(barber.avgTicket)}</span>
                    <span className={`${b}__metric-label`}>Ticket prom.</span>
                  </div>
                </div>
              </div>

              <div className={`${b}__detail ${isExpanded ? `${b}__detail--open` : ''}`}>
                {isExpanded && (
                  <>
                    <div className={`${b}__detail-section`}>
                      <h4 className={`${b}__detail-section-title`}>Informacion del Profesional</h4>
                      <div className={`${b}__info-grid`}>
                        <div className={`${b}__info-item`}>
                          <span className={`${b}__info-icon`}><PhoneIcon /></span>
                          <div className={`${b}__info-content`}>
                            <span className={`${b}__info-label`}>Telefono</span>
                            <span className={`${b}__info-value`}>{barber.phone || 'No registrado'}</span>
                          </div>
                        </div>
                        <div className={`${b}__info-item`}>
                          <span className={`${b}__info-icon`}><MailIcon /></span>
                          <div className={`${b}__info-content`}>
                            <span className={`${b}__info-label`}>Email</span>
                            <span className={`${b}__info-value`}>{barber.email || 'No registrado'}</span>
                          </div>
                        </div>
                        <div className={`${b}__info-item`}>
                          <span className={`${b}__info-icon`}><CalendarIcon /></span>
                          <div className={`${b}__info-content`}>
                            <span className={`${b}__info-label`}>Fecha de ingreso</span>
                            <span className={`${b}__info-value`}>{barber.hireDate ? formatDate(barber.hireDate) : 'No registrada'}</span>
                          </div>
                        </div>
                      </div>
                      {barber.bio && (
                        <p className={`${b}__info-bio`}>{barber.bio}</p>
                      )}
                    </div>

                    <div className={`${b}__detail-section`}>
                      <h4 className={`${b}__detail-section-title`}>Metricas de Rendimiento</h4>
                      <div className={`${b}__metrics-grid`}>
                        <div className={`${b}__metric-card`}>
                          <span className={`${b}__metric-card-icon`}><UsersIcon /></span>
                          <span className={`${b}__metric-card-value`}>{barber.uniqueClients}</span>
                          <span className={`${b}__metric-card-label`}>Total clientes</span>
                        </div>
                        <div className={`${b}__metric-card`}>
                          <span className={`${b}__metric-card-icon`}><DollarIcon /></span>
                          <span className={`${b}__metric-card-value`}>{formatCurrency(barber.totalRevenue)}</span>
                          <span className={`${b}__metric-card-label`}>Ingresos totales</span>
                        </div>
                        <div className={`${b}__metric-card`}>
                          <span className={`${b}__metric-card-icon`}><TrendingUpIcon /></span>
                          <span className={`${b}__metric-card-value`}>{formatCurrency(barber.avgTicket)}</span>
                          <span className={`${b}__metric-card-label`}>Ticket promedio</span>
                        </div>
                        <div className={`${b}__metric-card`}>
                          <span className={`${b}__metric-card-icon`}>
                            <StarIcon filled />
                          </span>
                          <span className={`${b}__metric-card-value`}>{barber.computedRating.toFixed(1)}</span>
                          <span className={`${b}__metric-card-label`}>Rating promedio</span>
                        </div>
                        {barber.bestMonth && (
                          <div className={`${b}__metric-card`}>
                            <span className={`${b}__metric-card-icon`}><CalendarIcon /></span>
                            <span className={`${b}__metric-card-value`}>{formatMonthLabel(barber.bestMonth.month)}</span>
                            <span className={`${b}__metric-card-label`}>Mejor mes ({formatCurrency(barber.bestMonth.revenue)})</span>
                          </div>
                        )}
                      </div>
                      {barber.topServices.length > 0 && (
                        <div className={`${b}__top-services`}>
                          <span className={`${b}__top-services-label`}>Servicios mas solicitados:</span>
                          <div className={`${b}__top-services-list`}>
                            {barber.topServices.map((svc) => (
                              <span key={svc.name} className={`${b}__top-services-tag`}>
                                {svc.name} ({svc.count})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`${b}__detail-section`}>
                      <div className={`${b}__detail-header`}>
                        <div className={`${b}__detail-header-left`}>
                          <h4 className={`${b}__detail-section-title`}>
                            Clientes Atendidos
                          </h4>
                          <span className={`${b}__detail-count`}>
                            {filteredClients.length} clientes
                          </span>
                        </div>
                      </div>

                      <div className={`${b}__detail-filters`} onClick={(e) => e.stopPropagation()}>
                        <div className={`${b}__search`}>
                          <SearchIcon />
                          <input
                            type="text"
                            className={`${b}__search-input`}
                            placeholder="Buscar cliente..."
                            value={clientFilter}
                            onChange={(e) => setClientFilter(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className={`${b}__sort`}>
                          {SORT_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              className={`${b}__sort-btn ${sortBy === opt.value ? `${b}__sort-btn--active` : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSortBy(opt.value);
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={`${b}__clients-list`}>
                        {filteredClients.length > 0 ? (
                          filteredClients.map((client, clientIndex) => (
                            <div
                              key={client.id}
                              className={`${b}__client-row`}
                              style={{ animationDelay: `${0.03 * (clientIndex + 1)}s` }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className={`${b}__client-avatar`}>
                                {getInitials(client.name)}
                              </div>
                              <div className={`${b}__client-info`}>
                                <span className={`${b}__client-name`}>{client.name}</span>
                                <span className={`${b}__client-phone`}>{client.phone}</span>
                              </div>
                              <div className={`${b}__client-stat`}>
                                <span className={`${b}__client-stat-value`}>{client.visits}</span>
                                <span className={`${b}__client-stat-label`}>Visitas</span>
                              </div>
                              <div className={`${b}__client-stat`}>
                                <span className={`${b}__client-stat-value ${b}__client-stat-value--date`}>
                                  {client.lastVisit ? formatDate(client.lastVisit) : '-'}
                                </span>
                                <span className={`${b}__client-stat-label`}>Ultima visita</span>
                              </div>
                              <div className={`${b}__client-stat`}>
                                <span className={`${b}__client-stat-value`}>
                                  {formatCurrency(client.totalSpent)}
                                </span>
                                <span className={`${b}__client-stat-label`}>Gastado</span>
                              </div>
                              <div className={`${b}__client-stat`}>
                                <span className={`${b}__client-stat-value`}>
                                  {client.avgRating !== null ? client.avgRating.toFixed(1) : '-'}
                                </span>
                                <span className={`${b}__client-stat-label`}>Rating</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className={`${b}__empty`}>
                            <p>No se encontraron clientes</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`${b}__actions`}>
                      <button
                        className={`${b}__feedback-btn`}
                        onClick={handleOpenFeedback}
                        type="button"
                      >
                        <SendIcon />
                        <span>Enviar encuesta de experiencia</span>
                      </button>
                      <button
                        className={`${b}__retention-btn`}
                        onClick={handleOpenRetention}
                        type="button"
                      >
                        <UsersIcon />
                        <span>Campaña de retención</span>
                      </button>
                      <button
                        className={`${b}__history-btn`}
                        onClick={(e) => e.stopPropagation()}
                        type="button"
                      >
                        <ClipboardIcon />
                        <span>Ver historial completo</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        title="Enviar encuesta de experiencia"
        className={`${b}__modal`}
      >
        <div className={`${b}__modal-content`}>
          <div className={`${b}__message-preview`}>
            <span className={`${b}__message-preview-label`}>Vista previa del mensaje</span>
            <div className={`${b}__message-bubble`}>
              <p>{getMessagePreview('Carlos')}</p>
            </div>
          </div>

          <ClientSelectionList
            barberClients={barberClients}
            selectedClientIds={selectedClientIds}
            toggleClientSelection={toggleClientSelection}
            toggleAllClients={toggleAllClients}
            b={b}
          />

          <div className={`${b}__modal-footer`}>
            <button
              className={`${b}__cancel-btn`}
              onClick={() => setShowFeedbackModal(false)}
            >
              Cancelar
            </button>
            <button
              className={`${b}__send-btn ${isSending ? `${b}__send-btn--sending` : ''}`}
              onClick={handleSendFeedback}
              disabled={selectedClientIds.size === 0 || isSending}
            >
              {isSending ? (
                <>
                  <span className={`${b}__send-spinner`} />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <SendIcon />
                  <span>Enviar a {selectedClientIds.size} clientes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRetentionModal}
        onClose={() => setShowRetentionModal(false)}
        title="Campaña de retención"
        className={`${b}__modal`}
      >
        <div className={`${b}__modal-content`}>
          <div className={`${b}__retention-offer`}>
            <label className={`${b}__retention-offer-label`}>Oferta personalizada</label>
            <input
              type="text"
              className={`${b}__retention-offer-input`}
              value={retentionOffer}
              onChange={(e) => setRetentionOffer(e.target.value)}
              placeholder="Ej: 20% de descuento en tu próximo corte"
            />
          </div>

          <div className={`${b}__message-preview`}>
            <span className={`${b}__message-preview-label`}>Vista previa del mensaje</span>
            <div className={`${b}__message-bubble ${b}__message-bubble--retention`}>
              <p>{getRetentionPreview('Carlos')}</p>
            </div>
          </div>

          <ClientSelectionList
            barberClients={barberClients}
            selectedClientIds={selectedClientIds}
            toggleClientSelection={toggleClientSelection}
            toggleAllClients={toggleAllClients}
            b={b}
          />

          <div className={`${b}__modal-footer`}>
            <button
              className={`${b}__cancel-btn`}
              onClick={() => setShowRetentionModal(false)}
            >
              Cancelar
            </button>
            <button
              className={`${b}__send-btn ${b}__send-btn--retention ${isSending ? `${b}__send-btn--sending` : ''}`}
              onClick={handleSendRetention}
              disabled={selectedClientIds.size === 0 || isSending}
            >
              {isSending ? (
                <>
                  <span className={`${b}__send-spinner`} />
                  <span>Enviando campaña...</span>
                </>
              ) : (
                <>
                  <SendIcon />
                  <span>Enviar a {selectedClientIds.size} clientes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BarberRating;
