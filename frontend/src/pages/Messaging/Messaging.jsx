import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../context/NotificationContext';
import {
  mockWhatsAppTemplates,
  templateCategories,
  mockClients as rawClients,
  mockVisitHistory,
} from '../../data/mockData';
import { enrichClients, STATUS } from '../../utils/clientStatus';

const clients = enrichClients(rawClients, mockVisitHistory);
const B = 'messaging';

// ===== SVG Icons =====
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// ===== Helpers =====
const getInitials = (name) => {
  const parts = name.split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
};

const getCategoryMeta = (categoryId) => {
  const cat = templateCategories.find((c) => c.id === categoryId);
  return cat || { name: categoryId, color: '#6B6B63' };
};

const SEGMENTS = [
  { id: 'all', label: 'Todos' },
  { id: 'vip', label: 'VIP' },
  { id: 'activo', label: 'Activos' },
  { id: 'en_riesgo', label: 'En Riesgo' },
  { id: 'inactivo', label: 'Inactivos' },
];

const SAMPLE_VARS = {
  nombre: (c) => c.name.split(' ')[0],
  servicio: (c) => c.favoriteService,
  barbero: () => 'Victor',
  hora: () => '10:00 AM',
  fecha: () => '6 de marzo',
  dia: () => 'viernes',
  dias: () => '15',
  puntos: (c) => String(c.loyaltyPoints),
  visitas: (c) => String(c.totalVisits),
  meses: () => '12',
  precio: () => '$45.000',
  producto: () => 'Pomada Mate Premium',
  servicio1: () => 'Corte + Barba',
  servicio2: () => 'Cejas',
  servicio_favorito: (c) => c.favoriteService,
  servicio_nuevo: () => 'Spa Capilar',
  cantidad: () => '42',
};

const resolveTemplate = (body, client) => {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const resolver = SAMPLE_VARS[key];
    return resolver ? resolver(client) : `{{${key}}}`;
  });
};

// ===== Sub-components =====

const TemplateCard = ({ template, onPreview, onSend }) => {
  const cat = getCategoryMeta(template.category);

  return (
    <div className={`${B}__card`}>
      <div className={`${B}__card-accent`} style={{ background: cat.color }} />
      <div className={`${B}__card-header`}>
        <span className={`${B}__card-cat`} style={{ color: cat.color }}>
          {cat.name}
        </span>
        <div className={`${B}__card-stats`}>
          <span className={`${B}__card-sent`}>{template.timesSent} env.</span>
          <span className={`${B}__card-rate`}>{template.responseRate}%</span>
        </div>
      </div>
      <h3 className={`${B}__card-name`}>{template.name}</h3>
      <p className={`${B}__card-body`}>
        {template.body.length > 120 ? template.body.slice(0, 120) + '...' : template.body}
      </p>
      <div className={`${B}__card-vars`}>
        {template.variables.map((v) => (
          <span key={v} className={`${B}__card-var`}>{`{{${v}}}`}</span>
        ))}
      </div>
      <div className={`${B}__card-actions`}>
        <button
          className={`${B}__card-btn ${B}__card-btn--preview`}
          onClick={() => onPreview(template)}
        >
          <EyeIcon />
          <span>Vista previa</span>
        </button>
        <button
          className={`${B}__card-btn ${B}__card-btn--send`}
          onClick={() => onSend(template)}
        >
          <SendIcon />
          <span>Enviar</span>
        </button>
      </div>
    </div>
  );
};

const PreviewModal = ({ template, onClose }) => {
  const cat = getCategoryMeta(template.category);
  const previewText = resolveTemplate(template.body, clients[0]);

  return createPortal(
    <div className={`${B}__overlay`} onClick={onClose}>
      <div className={`${B}__modal`} onClick={(e) => e.stopPropagation()}>
        <div className={`${B}__modal-header`}>
          <h3 className={`${B}__modal-title`}>Vista previa</h3>
          <button className={`${B}__modal-close`} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className={`${B}__modal-body`}>
          <span className={`${B}__modal-cat`} style={{ color: cat.color }}>
            {cat.name}
          </span>
          <h4 className={`${B}__modal-name`}>{template.name}</h4>
          <div className={`${B}__preview-bubble`}>
            <p>{previewText}</p>
          </div>
          <div className={`${B}__modal-meta`}>
            <span>Enviada {template.timesSent} veces</span>
            <span>Tasa de respuesta: {template.responseRate}%</span>
            {template.lastSent && <span>Ultimo envio: {template.lastSent}</span>}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const SendModal = ({ template, onClose, onSend }) => {
  const [segment, setSegment] = useState('all');
  const [selected, setSelected] = useState([]);

  const filteredClients = useMemo(() => {
    const waClients = clients.filter((c) => c.acceptsWhatsApp);
    if (segment === 'all') return waClients;
    if (segment === 'vip') return waClients.filter((c) => c.status === STATUS.VIP);
    if (segment === 'activo') return waClients.filter((c) => c.status === STATUS.ACTIVO || c.status === STATUS.NUEVO);
    if (segment === 'en_riesgo') return waClients.filter((c) => c.status === STATUS.EN_RIESGO);
    if (segment === 'inactivo') return waClients.filter((c) => c.status === STATUS.INACTIVO);
    return waClients;
  }, [segment]);

  const toggleClient = useCallback((clientId) => {
    setSelected((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  }, []);

  const handleSend = () => {
    const count = selected.length > 0 ? selected.length : filteredClients.length;
    onSend(template, count);
  };

  return createPortal(
    <div className={`${B}__overlay`} onClick={onClose}>
      <div className={`${B}__modal ${B}__modal--send`} onClick={(e) => e.stopPropagation()}>
        <div className={`${B}__modal-header`}>
          <h3 className={`${B}__modal-title`}>Enviar: {template.name}</h3>
          <button className={`${B}__modal-close`} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className={`${B}__modal-body`}>
          {/* Segment pills */}
          <div className={`${B}__segment-filters`}>
            {SEGMENTS.map((seg) => (
              <button
                key={seg.id}
                className={`${B}__segment-btn ${segment === seg.id ? `${B}__segment-btn--active` : ''}`}
                onClick={() => setSegment(seg.id)}
              >
                {seg.label}
              </button>
            ))}
          </div>

          {/* Client list */}
          <div className={`${B}__client-list`}>
            {filteredClients.map((client) => (
              <label
                key={client.id}
                className={`${B}__client-row ${selected.includes(client.id) ? `${B}__client-row--selected` : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(client.id)}
                  onChange={() => toggleClient(client.id)}
                  className={`${B}__client-check`}
                />
                <div className={`${B}__client-avatar`}>{getInitials(client.name)}</div>
                <div className={`${B}__client-info`}>
                  <span className={`${B}__client-name`}>{client.name}</span>
                  <span className={`${B}__client-phone`}>{client.phone}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Footer */}
          <div className={`${B}__send-footer`}>
            <span className={`${B}__send-count`}>
              <UsersIcon />
              {selected.length > 0
                ? `${selected.length} seleccionados`
                : `${filteredClients.length} clientes`}
            </span>
            <button className={`${B}__send-btn`} onClick={handleSend}>
              <WhatsAppIcon />
              <span>Enviar Plantilla</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ===== Main Component =====
const Messaging = () => {
  const { addNotification } = useNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [sendTemplate, setSendTemplate] = useState(null);

  const filteredTemplates = useMemo(() => {
    let templates = [...mockWhatsAppTemplates];

    if (activeCategory !== 'all') {
      templates = templates.filter((t) => t.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      templates = templates.filter(
        (t) => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
      );
    }

    return templates;
  }, [activeCategory, searchQuery]);

  const handleSend = useCallback((template, count) => {
    addNotification({
      message: `Plantilla "${template.name}" enviada a ${count} clientes`,
      type: 'success',
    });
    setSendTemplate(null);
  }, [addNotification]);

  return (
    <div className={B}>
      {/* Header */}
      <div className={`${B}__header`}>
        <div className={`${B}__header-left`}>
          <h2 className={`${B}__title`}>Plantillas WhatsApp</h2>
          <span className={`${B}__count`}>{mockWhatsAppTemplates.length} plantillas</span>
        </div>
        <div className={`${B}__search`}>
          <span className={`${B}__search-icon`}><SearchIcon /></span>
          <input
            type="text"
            className={`${B}__search-input`}
            placeholder="Buscar plantilla..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className={`${B}__categories`}>
        <button
          className={`${B}__cat-pill ${activeCategory === 'all' ? `${B}__cat-pill--active` : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          Todas ({mockWhatsAppTemplates.length})
        </button>
        {templateCategories.map((cat) => (
          <button
            key={cat.id}
            className={`${B}__cat-pill ${activeCategory === cat.id ? `${B}__cat-pill--active` : ''}`}
            onClick={() => setActiveCategory(cat.id)}
            style={activeCategory === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
          >
            {cat.name} ({cat.count})
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className={`${B}__grid`}>
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onPreview={setPreviewTemplate}
            onSend={setSendTemplate}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className={`${B}__empty`}>
          <p>No se encontraron plantillas</p>
        </div>
      )}

      {/* Modals */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {sendTemplate && (
        <SendModal
          template={sendTemplate}
          onClose={() => setSendTemplate(null)}
          onSend={handleSend}
        />
      )}
    </div>
  );
};

export default Messaging;
