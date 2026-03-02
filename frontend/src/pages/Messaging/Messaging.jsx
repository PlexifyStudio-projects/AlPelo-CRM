import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { mockClients as rawClients, mockVisitHistory } from '../../data/mockData';
import { enrichClients, STATUS_META } from '../../utils/clientStatus';
import { formatDate } from '../../utils/formatters';

const clients = enrichClients(rawClients, mockVisitHistory);

// ============================================
// SVG Icons
// ============================================
const WhatsAppIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const HeartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const GiftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const TagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const BarChartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ============================================
// Pre-approved WhatsApp template data
// ============================================
const TEMPLATES = [
  {
    id: 'reactivacion',
    name: 'Reactivacion',
    icon: <RefreshIcon />,
    description: 'Trae de vuelta a clientes que llevan mas de 60 dias sin visitar',
    audience: ['inactivo', 'en_riesgo'],
    message: 'Hola {{nombre}}, te extrañamos en AlPelo! Han pasado unos dias desde tu ultima visita. Vuelve y recibe 15% de descuento en tu proximo {{servicio}}. Reserva aqui: https://book.weibook.co/alpelo-peluqueria',
    lastUsed: '2026-02-20',
    color: 'warning',
  },
  {
    id: 'recordatorio',
    name: 'Recordatorio de Cita',
    icon: <CalendarIcon />,
    description: 'Recuerda a tus clientes su cita programada para reducir no-shows',
    audience: ['activo', 'vip', 'nuevo'],
    message: 'Hola {{nombre}}, te recordamos que tienes una cita en AlPelo para {{servicio}} el {{fecha_cita}}. Te esperamos! Si necesitas cambiarla, escribenos.',
    lastUsed: '2026-02-27',
    color: 'info',
  },
  {
    id: 'bienvenida',
    name: 'Bienvenida',
    icon: <HeartIcon />,
    description: 'Dale la bienvenida a clientes nuevos y crea una primera impresion memorable',
    audience: ['nuevo'],
    message: 'Hola {{nombre}}, gracias por visitarnos en AlPelo! Queremos que te sientas como en casa. En tu proxima visita, lleva un amigo y ambos reciben 10% de descuento.',
    lastUsed: '2026-02-15',
    color: 'success',
  },
  {
    id: 'promo_vip',
    name: 'Promocion VIP',
    icon: <StarIcon />,
    description: 'Ofertas exclusivas para tus clientes mas valiosos',
    audience: ['vip'],
    message: 'Hola {{nombre}}, como cliente VIP de AlPelo tienes acceso exclusivo a nuestro nuevo servicio de Spa Capilar con 20% de descuento. Agenda tu cita: https://book.weibook.co/alpelo-peluqueria',
    lastUsed: '2026-02-10',
    color: 'accent',
  },
  {
    id: 'cumpleanos',
    name: 'Feliz Cumpleanos',
    icon: <GiftIcon />,
    description: 'Celebra el cumpleanos de tus clientes con un detalle especial',
    audience: ['vip', 'activo', 'nuevo'],
    message: 'Feliz cumpleanos, {{nombre}}! En AlPelo queremos celebrar contigo. Te regalamos un 25% de descuento en cualquier servicio durante esta semana. Reserva: https://book.weibook.co/alpelo-peluqueria',
    lastUsed: '2026-02-22',
    color: 'accent',
  },
];

// ============================================
// Campaign history mock data
// ============================================
const CAMPAIGN_HISTORY = [
  {
    id: 1,
    name: 'Reactivacion Febrero',
    template: 'reactivacion',
    status: 'enviada',
    date: '2026-02-20',
    recipients: 7,
    delivered: 7,
    opened: 6,
    replied: 3,
  },
  {
    id: 2,
    name: 'Promo VIP Marzo',
    template: 'promo_vip',
    status: 'programada',
    date: '2026-03-01',
    recipients: 5,
    delivered: 0,
    opened: 0,
    replied: 0,
  },
  {
    id: 3,
    name: 'Bienvenida Nuevos Feb',
    template: 'bienvenida',
    status: 'enviada',
    date: '2026-02-15',
    recipients: 3,
    delivered: 3,
    opened: 3,
    replied: 2,
  },
  {
    id: 4,
    name: 'Recordatorio Semana 8',
    template: 'recordatorio',
    status: 'enviada',
    date: '2026-02-24',
    recipients: 12,
    delivered: 12,
    opened: 10,
    replied: 5,
  },
];

// ============================================
// Status options for audience
// ============================================
const STATUS_OPTIONS = [
  { value: 'vip', label: 'VIP', icon: <StarIcon /> },
  { value: 'activo', label: 'Activo', icon: <CheckIcon /> },
  { value: 'nuevo', label: 'Nuevo', icon: <HeartIcon /> },
  { value: 'en_riesgo', label: 'En Riesgo', icon: <AlertIcon /> },
  { value: 'inactivo', label: 'Inactivo', icon: <ClockIcon /> },
];

// ============================================
// Main Component
// ============================================
const Messaging = () => {
  const { addNotification } = useNotification();

  // Navigation state
  const [activeView, setActiveView] = useState('templates'); // 'templates' | 'quick' | 'history'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [campaigns] = useState(CAMPAIGN_HISTORY);

  // Compose state
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Quick message state
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [quickMessage, setQuickMessage] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const searchRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ============================================
  // Computed values
  // ============================================
  const whatsappClients = useMemo(
    () => clients.filter((c) => c.acceptsWhatsApp),
    []
  );

  const nonConsentClients = useMemo(
    () => clients.filter((c) => !c.acceptsWhatsApp),
    []
  );

  const filteredRecipients = useMemo(() => {
    if (selectedStatuses.length === 0) return [];
    return whatsappClients.filter((c) => selectedStatuses.includes(c.status));
  }, [whatsappClients, selectedStatuses]);

  const allClientsForStatuses = useMemo(() => {
    if (selectedStatuses.length === 0) return [];
    return clients.filter((c) => selectedStatuses.includes(c.status));
  }, [selectedStatuses]);

  const noConsentCount = allClientsForStatuses.length - filteredRecipients.length;

  const searchResults = useMemo(() => {
    if (!quickSearch.trim()) return [];
    const q = quickSearch.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q)
      )
      .slice(0, 8);
  }, [quickSearch]);

  // Stats
  const dailyMessagesSent = 47; // Mock: messages sent today
  const dailyLimit = 1000;
  const accountQuality = 'Alta';

  const campaignStats = useMemo(() => {
    const sent = campaigns.filter((c) => c.status === 'enviada');
    const totalDelivered = sent.reduce((s, c) => s + c.delivered, 0);
    const totalOpened = sent.reduce((s, c) => s + c.opened, 0);
    const totalRecipients = sent.reduce((s, c) => s + c.recipients, 0);

    return {
      totalSent: totalRecipients,
      deliveryRate: totalRecipients > 0 ? Math.round((totalDelivered / totalRecipients) * 100) : 0,
      openRate: totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0,
    };
  }, [campaigns]);

  // ============================================
  // Handlers
  // ============================================
  const handleSelectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setCampaignName(template.name);
    setCampaignMessage(template.message);
    setSelectedStatuses(template.audience);
  }, []);

  const toggleStatus = useCallback((status) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  }, []);

  const resolveTemplate = useCallback((template, client) => {
    return template
      .replace(/\{\{nombre\}\}/g, client.name.split(' ')[0])
      .replace(/\{\{servicio\}\}/g, client.favoriteService || 'tu servicio favorito')
      .replace(/\{\{nombre_completo\}\}/g, client.name)
      .replace(/\{\{fecha_cita\}\}/g, 'viernes 6 de marzo')
      .replace(/\{\{telefono\}\}/g, client.phone);
  }, []);

  const handleSendCampaign = useCallback(() => {
    if (!campaignMessage.trim() || filteredRecipients.length === 0) {
      addNotification('Selecciona una plantilla y al menos un grupo de destinatarios', 'warning');
      return;
    }
    setShowConfirmModal(true);
  }, [campaignMessage, filteredRecipients.length, addNotification]);

  const confirmSendCampaign = useCallback(() => {
    setShowConfirmModal(false);
    addNotification(
      `Campana "${campaignName}" enviada a ${filteredRecipients.length} clientes via WhatsApp`,
      'success'
    );
    setCampaignName('');
    setCampaignMessage('');
    setSelectedStatuses([]);
    setSelectedTemplate(null);
  }, [campaignName, filteredRecipients.length, addNotification]);

  const handleSendQuickMessage = useCallback(() => {
    if (!selectedClient || !quickMessage.trim()) {
      addNotification('Selecciona un cliente y escribe un mensaje', 'warning');
      return;
    }
    if (!selectedClient.acceptsWhatsApp) {
      addNotification('Este cliente no ha dado consentimiento para recibir mensajes de WhatsApp', 'error');
      return;
    }
    addNotification(
      `Mensaje enviado a ${selectedClient.name} via WhatsApp`,
      'success'
    );
    setQuickMessage('');
    setSelectedClient(null);
    setQuickSearch('');
  }, [selectedClient, quickMessage, addNotification]);

  const handleSelectClient = useCallback((client) => {
    setSelectedClient(client);
    setQuickSearch(client.name);
    setShowClientDropdown(false);
  }, []);

  const insertVariable = useCallback((variable) => {
    setCampaignMessage((prev) => prev + `{{${variable}}}`);
  }, []);

  const previewClient = filteredRecipients[0] || whatsappClients[0] || clients[0];

  const getStatusColor = (status) => {
    const map = {
      enviada: 'success',
      programada: 'info',
      borrador: 'neutral',
    };
    return map[status] || 'neutral';
  };

  const getStatusLabel = (status) => {
    const map = {
      enviada: 'Enviada',
      programada: 'Programada',
      borrador: 'Borrador',
    };
    return map[status] || status;
  };

  // ============================================
  // Render
  // ============================================
  return (
    <div className="messaging">
      {/* ===== Header ===== */}
      <header className="messaging__header">
        <div className="messaging__header-left">
          <div className="messaging__header-icon">
            <WhatsAppIcon size={24} />
          </div>
          <div className="messaging__header-text">
            <h2 className="messaging__title">Mensajeria</h2>
            <p className="messaging__subtitle">
              Conecta con tus clientes a traves de WhatsApp Business
            </p>
          </div>
        </div>
        <nav className="messaging__nav">
          <button
            className={`messaging__nav-btn ${activeView === 'templates' ? 'messaging__nav-btn--active' : ''}`}
            onClick={() => setActiveView('templates')}
          >
            <SendIcon />
            <span>Enviar campana</span>
          </button>
          <button
            className={`messaging__nav-btn ${activeView === 'quick' ? 'messaging__nav-btn--active' : ''}`}
            onClick={() => setActiveView('quick')}
          >
            <UserIcon />
            <span>Mensaje directo</span>
          </button>
          <button
            className={`messaging__nav-btn ${activeView === 'history' ? 'messaging__nav-btn--active' : ''}`}
            onClick={() => setActiveView('history')}
          >
            <BarChartIcon />
            <span>Historial</span>
          </button>
        </nav>
      </header>

      {/* ===== WhatsApp Compliance Strip ===== */}
      <div className="messaging__compliance">
        <div className="messaging__compliance-item">
          <div className="messaging__compliance-dot messaging__compliance-dot--green" />
          <span className="messaging__compliance-label">Cuenta activa</span>
        </div>
        <div className="messaging__compliance-divider" />
        <div className="messaging__compliance-item">
          <ShieldIcon />
          <span className="messaging__compliance-label">
            Calidad: <strong>{accountQuality}</strong>
          </span>
        </div>
        <div className="messaging__compliance-divider" />
        <div className="messaging__compliance-item">
          <span className="messaging__compliance-label">
            Hoy: <strong>{dailyMessagesSent}</strong> / {dailyLimit} mensajes
          </span>
          <div className="messaging__compliance-bar">
            <div
              className="messaging__compliance-bar-fill"
              style={{ width: `${(dailyMessagesSent / dailyLimit) * 100}%` }}
            />
          </div>
        </div>
        <div className="messaging__compliance-divider" />
        <div className="messaging__compliance-item">
          <span className="messaging__compliance-label">
            Entrega 24h: <strong>{campaignStats.deliveryRate}%</strong>
          </span>
        </div>
      </div>

      {/* ===== TEMPLATES VIEW ===== */}
      {activeView === 'templates' && (
        <div className="messaging__layout">
          {/* Left: Templates + Audience */}
          <div className="messaging__panel messaging__panel--left">
            <div className="messaging__section">
              <h3 className="messaging__section-title">
                <TagIcon />
                Plantillas aprobadas
              </h3>
              <p className="messaging__section-desc">
                Selecciona una plantilla pre-aprobada por WhatsApp Business
              </p>
            </div>

            <div className="messaging__templates">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  className={`messaging__template ${selectedTemplate?.id === template.id ? 'messaging__template--active' : ''}`}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <div className={`messaging__template-icon messaging__template-icon--${template.color}`}>
                    {template.icon}
                  </div>
                  <div className="messaging__template-content">
                    <span className="messaging__template-name">{template.name}</span>
                    <span className="messaging__template-desc">{template.description}</span>
                  </div>
                  <div className="messaging__template-meta">
                    <span className="messaging__template-audience">
                      <UsersIcon />
                      {whatsappClients.filter((c) => template.audience.includes(c.status)).length}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Audience selector */}
            {selectedTemplate && (
              <div className="messaging__audience">
                <h3 className="messaging__section-title">
                  <UsersIcon />
                  Audiencia
                </h3>
                <div className="messaging__audience-chips">
                  {STATUS_OPTIONS.map((opt) => {
                    const count = whatsappClients.filter((c) => c.status === opt.value).length;
                    const totalCount = clients.filter((c) => c.status === opt.value).length;
                    const isSelected = selectedStatuses.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        className={`messaging__audience-chip ${isSelected ? 'messaging__audience-chip--active' : ''}`}
                        onClick={() => toggleStatus(opt.value)}
                      >
                        <span className="messaging__audience-chip-name">{opt.label}</span>
                        <span className="messaging__audience-chip-count">
                          {count}
                          {totalCount > count && (
                            <span className="messaging__audience-chip-total"> / {totalCount}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Recipients summary */}
                <div className="messaging__audience-summary">
                  <div className="messaging__audience-ready">
                    <CheckCircleIcon />
                    <span>
                      <strong>{filteredRecipients.length}</strong> clientes con consentimiento
                    </span>
                  </div>
                  {noConsentCount > 0 && (
                    <div className="messaging__audience-no-consent">
                      <XIcon />
                      <span>
                        <strong>{noConsentCount}</strong> sin consentimiento (no recibiran el mensaje)
                      </span>
                    </div>
                  )}
                </div>

                {/* Consent warning */}
                <div className="messaging__consent-notice">
                  <ShieldIcon />
                  <span>Solo se enviaran mensajes a clientes con consentimiento WhatsApp activo. Cumplimos con las politicas de Meta.</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Compose + Preview */}
          <div className="messaging__panel messaging__panel--right">
            {selectedTemplate ? (
              <>
                <div className="messaging__compose">
                  <div className="messaging__compose-header">
                    <div className={`messaging__compose-icon messaging__template-icon--${selectedTemplate.color}`}>
                      {selectedTemplate.icon}
                    </div>
                    <div className="messaging__compose-title-group">
                      <h3 className="messaging__compose-title">{selectedTemplate.name}</h3>
                      <span className="messaging__compose-badge">Plantilla aprobada</span>
                    </div>
                  </div>

                  {/* Variables */}
                  <div className="messaging__compose-variables">
                    <span className="messaging__compose-variables-label">Variables disponibles:</span>
                    <div className="messaging__compose-variables-list">
                      {['nombre', 'servicio', 'fecha_cita'].map((v) => (
                        <button
                          key={v}
                          className="messaging__variable-pill"
                          onClick={() => insertVariable(v)}
                          title={`Insertar {{${v}}}`}
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message editor */}
                  <div className="messaging__compose-editor">
                    <textarea
                      className="messaging__compose-textarea"
                      value={campaignMessage}
                      onChange={(e) => setCampaignMessage(e.target.value)}
                      rows={5}
                      placeholder="Escribe tu mensaje usando las variables..."
                    />
                    <div className="messaging__compose-meta">
                      <span className={`messaging__compose-chars ${campaignMessage.length > 1024 ? 'messaging__compose-chars--over' : ''}`}>
                        {campaignMessage.length} / 1,024
                      </span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp preview */}
                <div className="messaging__preview">
                  <span className="messaging__preview-label">
                    <EyeIcon />
                    Vista previa en WhatsApp
                  </span>
                  <div className="messaging__preview-phone">
                    <div className="messaging__preview-bar">
                      <div className="messaging__preview-bar-left">
                        <div className="messaging__preview-avatar-wa">A</div>
                        <span className="messaging__preview-name">AlPelo Peluqueria</span>
                      </div>
                    </div>
                    <div className="messaging__preview-chat">
                      <div className="messaging__preview-bg" />
                      {campaignMessage ? (
                        <div className="messaging__bubble">
                          <p className="messaging__bubble-text">
                            {resolveTemplate(campaignMessage, previewClient)}
                          </p>
                          <span className="messaging__bubble-time">
                            {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                              <path d="M1 5.5L4 8.5L10 2" stroke="#53BDEB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M5 5.5L8 8.5L14 2" stroke="#53BDEB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        </div>
                      ) : (
                        <div className="messaging__preview-empty">
                          Escribe un mensaje para ver como se vera
                        </div>
                      )}
                    </div>
                  </div>
                  {previewClient && campaignMessage && (
                    <span className="messaging__preview-hint">
                      Ejemplo con datos de {previewClient.name.split(' ')[0]}
                    </span>
                  )}
                </div>

                {/* Send button */}
                <button
                  className="messaging__send-btn"
                  onClick={handleSendCampaign}
                  disabled={!campaignMessage.trim() || filteredRecipients.length === 0}
                >
                  <WhatsAppIcon size={20} />
                  <span>Enviar a {filteredRecipients.length} clientes</span>
                </button>
              </>
            ) : (
              <div className="messaging__empty-compose">
                <div className="messaging__empty-compose-icon">
                  <SendIcon />
                </div>
                <h3 className="messaging__empty-compose-title">Selecciona una plantilla</h3>
                <p className="messaging__empty-compose-text">
                  Elige una de las plantillas aprobadas para comenzar a crear tu campana de WhatsApp
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== QUICK MESSAGE VIEW ===== */}
      {activeView === 'quick' && (
        <div className="messaging__layout">
          <div className="messaging__panel messaging__panel--left">
            <div className="messaging__section">
              <h3 className="messaging__section-title">
                <UserIcon />
                Mensaje directo
              </h3>
              <p className="messaging__section-desc">
                Envia un mensaje individual a un cliente por WhatsApp
              </p>
            </div>

            {/* Client search */}
            <div className="messaging__quick-search" ref={searchRef}>
              <div className="messaging__search-wrapper">
                <SearchIcon />
                <input
                  type="text"
                  className="messaging__search-input"
                  placeholder="Buscar por nombre o telefono..."
                  value={quickSearch}
                  onChange={(e) => {
                    setQuickSearch(e.target.value);
                    setShowClientDropdown(true);
                    if (!e.target.value.trim()) setSelectedClient(null);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                />
                {quickSearch && (
                  <button
                    className="messaging__search-clear"
                    onClick={() => {
                      setSelectedClient(null);
                      setQuickSearch('');
                    }}
                  >
                    <XIcon />
                  </button>
                )}
              </div>

              {showClientDropdown && searchResults.length > 0 && !selectedClient && (
                <div className="messaging__dropdown">
                  {searchResults.map((client) => {
                    const meta = STATUS_META[client.status];
                    return (
                      <button
                        key={client.id}
                        className="messaging__dropdown-item"
                        onClick={() => handleSelectClient(client)}
                      >
                        <div className="messaging__dropdown-avatar">
                          {client.name.charAt(0)}
                        </div>
                        <div className="messaging__dropdown-info">
                          <span className="messaging__dropdown-name">{client.name}</span>
                          <span className="messaging__dropdown-phone">{client.phone}</span>
                        </div>
                        <div className="messaging__dropdown-right">
                          <span className={`messaging__status-badge messaging__status-badge--${meta?.color || 'info'}`}>
                            {meta?.label}
                          </span>
                          {client.acceptsWhatsApp ? (
                            <span className="messaging__consent-badge messaging__consent-badge--yes" title="Consentimiento WhatsApp activo">
                              <WhatsAppIcon size={10} />
                            </span>
                          ) : (
                            <span className="messaging__consent-badge messaging__consent-badge--no" title="Sin consentimiento WhatsApp">
                              <XIcon />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected client card */}
            {selectedClient && (
              <div className={`messaging__client-card ${!selectedClient.acceptsWhatsApp ? 'messaging__client-card--no-consent' : ''}`}>
                <div className="messaging__client-card-top">
                  <div className="messaging__client-card-avatar">
                    {selectedClient.name.charAt(0)}
                  </div>
                  <div className="messaging__client-card-info">
                    <span className="messaging__client-card-name">{selectedClient.name}</span>
                    <span className="messaging__client-card-phone">{selectedClient.phone}</span>
                  </div>
                  <span className={`messaging__status-badge messaging__status-badge--${STATUS_META[selectedClient.status]?.color}`}>
                    {STATUS_META[selectedClient.status]?.label}
                  </span>
                </div>
                <div className="messaging__client-card-details">
                  <span className="messaging__client-card-detail">
                    <ClockIcon />
                    Ultima visita: {selectedClient.daysSinceLastVisit} dias
                  </span>
                  <span className="messaging__client-card-detail">
                    <StarIcon />
                    Servicio favorito: {selectedClient.favoriteService || 'N/A'}
                  </span>
                </div>
                <div className={`messaging__client-card-consent ${selectedClient.acceptsWhatsApp ? 'messaging__client-card-consent--yes' : 'messaging__client-card-consent--no'}`}>
                  {selectedClient.acceptsWhatsApp ? (
                    <>
                      <CheckCircleIcon />
                      <span>Consentimiento WhatsApp activo</span>
                    </>
                  ) : (
                    <>
                      <AlertIcon />
                      <span>Este cliente NO ha dado consentimiento para WhatsApp. No se puede enviar mensaje.</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick template suggestions */}
            {selectedClient && selectedClient.acceptsWhatsApp && (
              <div className="messaging__quick-templates">
                <span className="messaging__quick-templates-label">Plantillas rapidas:</span>
                {TEMPLATES.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    className="messaging__quick-template-btn"
                    onClick={() => setQuickMessage(resolveTemplate(t.message, selectedClient))}
                  >
                    {t.icon}
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Compose */}
          <div className="messaging__panel messaging__panel--right">
            {selectedClient ? (
              <>
                {selectedClient.acceptsWhatsApp ? (
                  <div className="messaging__quick-compose">
                    <div className="messaging__quick-compose-header">
                      <WhatsAppIcon size={18} />
                      <span>Mensaje para {selectedClient.name.split(' ')[0]}</span>
                    </div>

                    {/* WhatsApp preview */}
                    <div className="messaging__preview">
                      <div className="messaging__preview-phone">
                        <div className="messaging__preview-bar">
                          <div className="messaging__preview-bar-left">
                            <div className="messaging__preview-avatar-wa">A</div>
                            <span className="messaging__preview-name">AlPelo Peluqueria</span>
                          </div>
                        </div>
                        <div className="messaging__preview-chat">
                          <div className="messaging__preview-bg" />
                          {quickMessage ? (
                            <div className="messaging__bubble">
                              <p className="messaging__bubble-text">{quickMessage}</p>
                              <span className="messaging__bubble-time">
                                {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                                  <path d="M1 5.5L4 8.5L10 2" stroke="#53BDEB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M5 5.5L8 8.5L14 2" stroke="#53BDEB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </span>
                            </div>
                          ) : (
                            <div className="messaging__preview-empty">
                              Escribe un mensaje o selecciona una plantilla
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <textarea
                      className="messaging__compose-textarea"
                      placeholder={`Escribe un mensaje para ${selectedClient.name.split(' ')[0]}...`}
                      value={quickMessage}
                      onChange={(e) => setQuickMessage(e.target.value)}
                      rows={4}
                    />

                    <button
                      className="messaging__send-btn messaging__send-btn--quick"
                      onClick={handleSendQuickMessage}
                      disabled={!quickMessage.trim()}
                    >
                      <WhatsAppIcon size={20} />
                      <span>Enviar por WhatsApp</span>
                    </button>
                  </div>
                ) : (
                  <div className="messaging__no-consent-state">
                    <div className="messaging__no-consent-icon">
                      <ShieldIcon />
                    </div>
                    <h3 className="messaging__no-consent-title">Sin consentimiento</h3>
                    <p className="messaging__no-consent-text">
                      {selectedClient.name} no ha dado su consentimiento para recibir mensajes de WhatsApp.
                      Segun las politicas de Meta, no podemos enviarle mensajes por este canal.
                    </p>
                    <div className="messaging__no-consent-action">
                      <span>Pide el consentimiento en su proxima visita presencial</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="messaging__empty-compose">
                <div className="messaging__empty-compose-icon">
                  <UserIcon />
                </div>
                <h3 className="messaging__empty-compose-title">Busca un cliente</h3>
                <p className="messaging__empty-compose-text">
                  Busca por nombre o telefono para enviar un mensaje directo por WhatsApp
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== HISTORY VIEW ===== */}
      {activeView === 'history' && (
        <div className="messaging__history">
          {/* Stats cards */}
          <div className="messaging__history-stats">
            <div className="messaging__history-stat">
              <div className="messaging__history-stat-icon messaging__history-stat-icon--sent">
                <SendIcon />
              </div>
              <div className="messaging__history-stat-content">
                <span className="messaging__history-stat-value">{campaignStats.totalSent}</span>
                <span className="messaging__history-stat-label">Mensajes enviados</span>
              </div>
            </div>
            <div className="messaging__history-stat">
              <div className="messaging__history-stat-icon messaging__history-stat-icon--delivered">
                <CheckCircleIcon />
              </div>
              <div className="messaging__history-stat-content">
                <span className="messaging__history-stat-value">{campaignStats.deliveryRate}%</span>
                <span className="messaging__history-stat-label">Tasa de entrega</span>
              </div>
            </div>
            <div className="messaging__history-stat">
              <div className="messaging__history-stat-icon messaging__history-stat-icon--opened">
                <EyeIcon />
              </div>
              <div className="messaging__history-stat-content">
                <span className="messaging__history-stat-value">{campaignStats.openRate}%</span>
                <span className="messaging__history-stat-label">Tasa de apertura</span>
              </div>
            </div>
            <div className="messaging__history-stat">
              <div className="messaging__history-stat-icon messaging__history-stat-icon--contacts">
                <WhatsAppIcon size={18} />
              </div>
              <div className="messaging__history-stat-content">
                <span className="messaging__history-stat-value">{whatsappClients.length}</span>
                <span className="messaging__history-stat-label">Contactos WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Campaign list */}
          <div className="messaging__history-list">
            <h3 className="messaging__section-title">
              <ClockIcon />
              Campanas recientes
            </h3>
            <div className="messaging__history-items">
              {campaigns.map((campaign, index) => {
                const template = TEMPLATES.find((t) => t.id === campaign.template);
                const deliveryPct = campaign.recipients > 0 ? Math.round((campaign.delivered / campaign.recipients) * 100) : 0;
                const openPct = campaign.delivered > 0 ? Math.round((campaign.opened / campaign.delivered) * 100) : 0;
                return (
                  <div key={campaign.id} className="messaging__history-item" style={{ animationDelay: `${index * 0.06}s` }}>
                    <div className="messaging__history-item-left">
                      <div className={`messaging__history-item-icon messaging__template-icon--${template?.color || 'info'}`}>
                        {template?.icon || <SendIcon />}
                      </div>
                      <div className="messaging__history-item-info">
                        <span className="messaging__history-item-name">{campaign.name}</span>
                        <span className="messaging__history-item-date">
                          {campaign.date ? formatDate(campaign.date) : 'Sin fecha'}
                        </span>
                      </div>
                    </div>
                    <div className="messaging__history-item-stats">
                      <div className="messaging__history-item-metric">
                        <span className="messaging__history-item-metric-value">{campaign.recipients}</span>
                        <span className="messaging__history-item-metric-label">Enviados</span>
                      </div>
                      {campaign.status === 'enviada' && (
                        <>
                          <div className="messaging__history-item-metric">
                            <span className="messaging__history-item-metric-value">{deliveryPct}%</span>
                            <span className="messaging__history-item-metric-label">Entregados</span>
                          </div>
                          <div className="messaging__history-item-metric">
                            <span className="messaging__history-item-metric-value">{openPct}%</span>
                            <span className="messaging__history-item-metric-label">Leidos</span>
                          </div>
                          <div className="messaging__history-item-metric">
                            <span className="messaging__history-item-metric-value">{campaign.replied}</span>
                            <span className="messaging__history-item-metric-label">Respuestas</span>
                          </div>
                        </>
                      )}
                    </div>
                    <span className={`messaging__history-item-badge messaging__history-item-badge--${getStatusColor(campaign.status)}`}>
                      {getStatusLabel(campaign.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== Confirmation Modal ===== */}
      {showConfirmModal && (
        <div className="messaging__modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="messaging__modal" onClick={(e) => e.stopPropagation()}>
            <div className="messaging__modal-header">
              <WhatsAppIcon size={28} />
              <h3 className="messaging__modal-title">Confirmar envio de campana</h3>
            </div>
            <div className="messaging__modal-body">
              <div className="messaging__modal-summary">
                <div className="messaging__modal-summary-row">
                  <span className="messaging__modal-summary-label">Campana</span>
                  <span className="messaging__modal-summary-value">{campaignName}</span>
                </div>
                <div className="messaging__modal-summary-row">
                  <span className="messaging__modal-summary-label">Destinatarios</span>
                  <span className="messaging__modal-summary-value">{filteredRecipients.length} clientes con consentimiento</span>
                </div>
                {noConsentCount > 0 && (
                  <div className="messaging__modal-summary-row messaging__modal-summary-row--warning">
                    <span className="messaging__modal-summary-label">Excluidos</span>
                    <span className="messaging__modal-summary-value">{noConsentCount} sin consentimiento</span>
                  </div>
                )}
              </div>

              <div className="messaging__modal-preview-section">
                <span className="messaging__modal-preview-label">Vista previa del mensaje:</span>
                <div className="messaging__modal-preview-bubble">
                  <div className="messaging__bubble messaging__bubble--modal">
                    <p className="messaging__bubble-text">
                      {resolveTemplate(campaignMessage, previewClient)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="messaging__modal-consent-notice">
                <ShieldIcon />
                <span>Solo se enviara a clientes con consentimiento WhatsApp activo, cumpliendo las politicas de Meta Business.</span>
              </div>
            </div>
            <div className="messaging__modal-actions">
              <button
                className="messaging__modal-btn messaging__modal-btn--cancel"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancelar
              </button>
              <button
                className="messaging__modal-btn messaging__modal-btn--confirm"
                onClick={confirmSendCampaign}
              >
                <WhatsAppIcon size={16} />
                Confirmar y enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messaging;
