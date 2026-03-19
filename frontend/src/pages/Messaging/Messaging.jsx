import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../context/NotificationContext';
import clientService from '../../services/clientService';
import whatsappService from '../../services/whatsappService';
import templateService from '../../services/templateService';

const B = 'messaging';

// ===== SVG Icons =====
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const SendIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const WhatsAppIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
const UsersIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;

// Category colors
const CAT_COLORS = {
  recordatorio: '#3B82F6',
  post_servicio: '#34D399',
  reactivacion: '#FBBF24',
  fidelizacion: '#EC4899',
  promocion: '#8B5CF6',
  bienvenida: '#10B981',
  interno: '#0EA5E9',
  general: '#6B6B63',
};

const CAT_LABELS = {
  recordatorio: 'Recordatorio',
  post_servicio: 'Post-Servicio',
  reactivacion: 'Reactivación',
  fidelizacion: 'Fidelización',
  promocion: 'Promoción',
  bienvenida: 'Bienvenida',
  interno: 'Interno',
  general: 'General',
};

const STATUS_LABELS = {
  approved: { label: 'Aprobada', color: '#10B981', icon: '✅' },
  pending: { label: 'Pendiente Meta', color: '#F59E0B', icon: '⏳' },
  draft: { label: 'Borrador', color: '#6B7280', icon: '📝' },
  rejected: { label: 'Rechazada', color: '#EF4444', icon: '❌' },
  inactive: { label: 'Inactiva', color: '#9CA3AF', icon: '⏸️' },
};

const getInitials = (name) => {
  const parts = name.split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
};

const SEGMENTS = [
  { id: 'all', label: 'Todos' },
  { id: 'vip', label: 'VIP' },
  { id: 'activo', label: 'Activos' },
  { id: 'en_riesgo', label: 'En Riesgo' },
  { id: 'inactivo', label: 'Inactivos' },
];

const SAMPLE_VARS = {
  nombre: () => 'Juan',
  servicio: () => 'Corte Clásico',
  profesional: () => 'Anderson',
  barbero: () => 'Anderson',
  hora: () => '10:00 AM',
  fecha: () => '10 de marzo',
  dias: () => '30',
  visitas: () => '12',
  negocio: () => 'Tu Negocio',
  link_resena: () => 'https://g.page/review/...',
  completadas: () => '15',
  no_shows: () => '2',
  ingresos: () => '1.250.000',
  nuevos: () => '3',
  google_review_link: () => 'https://g.page/review/...',
};

const resolveTemplate = (body) => {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const resolver = SAMPLE_VARS[key];
    return resolver ? resolver() : `{{${key}}}`;
  });
};

// ===== Template Card =====
const MetaIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" /></svg>;
const RefreshIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /></svg>;

const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;

const TemplateCard = ({ template, onPreview, onSend, onApprove, onDelete, onSubmitMeta, onCheckStatus, onEdit, isSubmitting }) => {
  const catColor = CAT_COLORS[template.category] || CAT_COLORS.general;
  const catLabel = CAT_LABELS[template.category] || template.category;
  const statusInfo = STATUS_LABELS[template.status] || STATUS_LABELS.draft;

  return (
    <div className={`${B}__card ${template.status !== 'approved' ? `${B}__card--pending` : ''}`}>
      <div className={`${B}__card-accent`} style={{ background: catColor }} />
      <div className={`${B}__card-header`}>
        <span className={`${B}__card-cat`} style={{ color: catColor }}>{catLabel}</span>
        <div className={`${B}__card-stats`}>
          <span className={`${B}__card-status-badge`} style={{ color: statusInfo.color, borderColor: statusInfo.color }}>
            {statusInfo.label}
          </span>
          <span className={`${B}__card-sent`}>{template.times_sent} env.</span>
          <span className={`${B}__card-rate`}>{Math.round(template.response_rate)}%</span>
        </div>
      </div>
      <h3 className={`${B}__card-name`}>{template.name}</h3>
      <p className={`${B}__card-body`}>
        {template.body.length > 120 ? template.body.slice(0, 120) + '...' : template.body}
      </p>
      <div className={`${B}__card-vars`}>
        {(template.variables || []).map((v) => (
          <span key={v} className={`${B}__card-var`}>{`{{${v}}}`}</span>
        ))}
      </div>
      <div className={`${B}__card-actions`}>
        {template.status === 'draft' && (
          <button className={`${B}__card-btn ${B}__card-btn--meta`} onClick={() => !isSubmitting && onSubmitMeta(template)} disabled={isSubmitting}>
            {isSubmitting ? <><span className={`${B}__card-spinner`} /> <span>Enviando...</span></> : <><MetaIcon /> <span>Enviar a Meta</span></>}
          </button>
        )}
        {template.status === 'pending' && (
          <button className={`${B}__card-btn ${B}__card-btn--check`} onClick={() => onCheckStatus(template)}>
            <RefreshIcon /> <span>Verificar</span>
          </button>
        )}
        <button className={`${B}__card-btn ${B}__card-btn--preview`} onClick={() => onPreview(template)}>
          <EyeIcon /> <span>Vista previa</span>
        </button>
        {template.status === 'approved' && (
          <button className={`${B}__card-btn ${B}__card-btn--send`} onClick={() => onSend(template)}>
            <SendIcon /> <span>Enviar</span>
          </button>
        )}
        <button className={`${B}__card-btn ${B}__card-btn--edit`} onClick={() => onEdit(template)}>
          <EditIcon /> <span>Editar</span>
        </button>
        <button className={`${B}__card-btn ${B}__card-btn--delete`} onClick={() => onDelete(template)}>
          <TrashIcon />
        </button>
      </div>
    </div>
  );
};

// ===== Preview Modal =====
const PreviewModal = ({ template, onClose }) => {
  const catColor = CAT_COLORS[template.category] || CAT_COLORS.general;
  const catLabel = CAT_LABELS[template.category] || template.category;
  const previewText = resolveTemplate(template.body);

  return createPortal(
    <div className={`${B}__overlay`} onClick={onClose}>
      <div className={`${B}__modal`} onClick={(e) => e.stopPropagation()}>
        <div className={`${B}__modal-header`}>
          <h3 className={`${B}__modal-title`}>Vista previa</h3>
          <button className={`${B}__modal-close`} onClick={onClose}><CloseIcon /></button>
        </div>
        <div className={`${B}__modal-body`}>
          <span className={`${B}__modal-cat`} style={{ color: catColor }}>{catLabel}</span>
          <h4 className={`${B}__modal-name`}>{template.name}</h4>
          <div className={`${B}__preview-bubble`}><p>{previewText}</p></div>
          <div className={`${B}__modal-meta`}>
            <span>Slug: <strong>{template.slug}</strong></span>
            <span>Enviada {template.times_sent} veces</span>
            <span>Estado: {STATUS_LABELS[template.status]?.label}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ===== Edit Modal =====
const EditModal = ({ template, onClose, onSave }) => {
  const [name, setName] = useState(template.name);
  const [body, setBody] = useState(template.body);
  const [category, setCategory] = useState(template.category);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await onSave(template.id, { name: name.trim(), body: body.trim(), category });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return createPortal(
    <div className={`${B}__overlay`} onClick={onClose}>
      <div className={`${B}__modal ${B}__modal--edit`} onClick={(e) => e.stopPropagation()}>
        <div className={`${B}__modal-header`}>
          <h3 className={`${B}__modal-title`}>Editar plantilla</h3>
          <button className={`${B}__modal-close`} onClick={onClose}><CloseIcon /></button>
        </div>
        <div className={`${B}__modal-body`}>
          <div className={`${B}__edit-field`}>
            <label className={`${B}__edit-label`}>Nombre</label>
            <input className={`${B}__edit-input`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={`${B}__edit-field`}>
            <label className={`${B}__edit-label`}>Categoria</label>
            <select className={`${B}__edit-select`} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="recordatorio">Recordatorio</option>
              <option value="post_servicio">Post-Servicio</option>
              <option value="reactivacion">Reactivacion</option>
              <option value="fidelizacion">Fidelizacion</option>
              <option value="promocion">Promocion</option>
              <option value="bienvenida">Bienvenida</option>
              <option value="interno">Interno</option>
            </select>
          </div>
          <div className={`${B}__edit-field`}>
            <label className={`${B}__edit-label`}>Mensaje <span className={`${B}__edit-hint`}>Usa {'{{nombre}}'}, {'{{hora}}'}, {'{{servicio}}'}, {'{{profesional}}'}, {'{{fecha}}'}, {'{{dias}}'}, {'{{negocio}}'}</span></label>
            <textarea className={`${B}__edit-textarea`} value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
            <span className={`${B}__edit-count`}>{body.length}/1024 caracteres</span>
          </div>
          <div className={`${B}__edit-preview`}>
            <span className={`${B}__edit-preview-label`}>Vista previa:</span>
            <div className={`${B}__preview-bubble`}><p>{resolveTemplate(body)}</p></div>
          </div>
        </div>
        <div className={`${B}__modal-footer`}>
          <button className={`${B}__modal-btn ${B}__modal-btn--cancel`} onClick={onClose}>Cancelar</button>
          <button className={`${B}__modal-btn ${B}__modal-btn--save`} onClick={handleSave} disabled={saving || !name.trim() || !body.trim()}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ===== Send Modal =====
const SendModal = ({ template, onClose, onSend }) => {
  const [segment, setSegment] = useState('all');
  const [selected, setSelected] = useState([]);
  const [realClients, setRealClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });

  useEffect(() => {
    (async () => {
      try {
        const data = await clientService.list({ active: true });
        setRealClients(Array.isArray(data) ? data.filter((c) => c.phone) : []);
      } catch { setRealClients([]); }
      finally { setLoadingClients(false); }
    })();
  }, []);

  const filteredClients = useMemo(() => {
    if (segment === 'all') return realClients;
    if (segment === 'vip') return realClients.filter((c) => c.status === 'vip');
    if (segment === 'activo') return realClients.filter((c) => c.status === 'active' || c.status === 'new');
    if (segment === 'en_riesgo') return realClients.filter((c) => c.status === 'at_risk');
    if (segment === 'inactivo') return realClients.filter((c) => c.status === 'inactive');
    return realClients;
  }, [segment, realClients]);

  const toggleClient = useCallback((clientId) => {
    setSelected((prev) => prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]);
  }, []);

  const handleSend = async () => {
    const targets = selected.length > 0 ? realClients.filter((c) => selected.includes(c.id)) : filteredClients;
    if (targets.length === 0) return;
    setSending(true);
    setSendProgress({ sent: 0, failed: 0, total: targets.length });
    let sent = 0, failed = 0;

    for (const client of targets) {
      try {
        const firstName = (client.name || '').split(' ')[0];
        let body = template.body
          .replace(/\{\{nombre\}\}/g, firstName)
          .replace(/\{\{servicio\}\}/g, client.favorite_service || 'tu servicio')
          .replace(/\{\{profesional\}\}/g, 'tu profesional')
          .replace(/\{\{barbero\}\}/g, 'tu profesional')
          .replace(/\{\{negocio\}\}/g, 'AlPelo')
          .replace(/\{\{dias\}\}/g, client.days_since_last_visit ? String(client.days_since_last_visit) : '30');
        const conv = await whatsappService.createConversation(client.phone, client.name);
        await whatsappService.sendMessage(conv.id, body);
        sent++;
      } catch { failed++; }
      setSendProgress({ sent, failed, total: targets.length });
    }
    setSending(false);
    onSend(template, sent, failed);
  };

  return createPortal(
    <div className={`${B}__overlay`} onClick={sending ? undefined : onClose}>
      <div className={`${B}__modal ${B}__modal--send`} onClick={(e) => e.stopPropagation()}>
        <div className={`${B}__modal-header`}>
          <h3 className={`${B}__modal-title`}>Enviar: {template.name}</h3>
          <button className={`${B}__modal-close`} onClick={onClose} disabled={sending}><CloseIcon /></button>
        </div>
        <div className={`${B}__modal-body`}>
          <div className={`${B}__segment-filters`}>
            {SEGMENTS.map((seg) => (
              <button key={seg.id} className={`${B}__segment-btn ${segment === seg.id ? `${B}__segment-btn--active` : ''}`}
                onClick={() => setSegment(seg.id)} disabled={sending}>{seg.label}</button>
            ))}
          </div>
          <div className={`${B}__client-list`}>
            {loadingClients ? (
              <p style={{ padding: '20px', textAlign: 'center', color: '#8696A0' }}>Cargando clientes...</p>
            ) : filteredClients.length === 0 ? (
              <p style={{ padding: '20px', textAlign: 'center', color: '#8696A0' }}>No hay clientes en este segmento</p>
            ) : (
              filteredClients.map((client) => (
                <label key={client.id} className={`${B}__client-row ${selected.includes(client.id) ? `${B}__client-row--selected` : ''}`}>
                  <input type="checkbox" checked={selected.includes(client.id)} onChange={() => toggleClient(client.id)}
                    className={`${B}__client-check`} disabled={sending} />
                  <div className={`${B}__client-avatar`}>{getInitials(client.name)}</div>
                  <div className={`${B}__client-info`}>
                    <span className={`${B}__client-name`}>{client.name}</span>
                    <span className={`${B}__client-phone`}>{client.phone}</span>
                  </div>
                </label>
              ))
            )}
          </div>
          <div className={`${B}__send-footer`}>
            {sending ? (
              <span className={`${B}__send-count`}>
                Enviando... {sendProgress.sent + sendProgress.failed}/{sendProgress.total}
                {sendProgress.failed > 0 && <span style={{ color: '#FF5252' }}> ({sendProgress.failed} fallidos)</span>}
              </span>
            ) : (
              <span className={`${B}__send-count`}>
                <UsersIcon /> {selected.length > 0 ? `${selected.length} seleccionados` : `${filteredClients.length} clientes`}
              </span>
            )}
            <button className={`${B}__send-btn`} onClick={handleSend} disabled={sending || filteredClients.length === 0}>
              <WhatsAppIcon /> <span>{sending ? 'Enviando...' : 'Enviar Plantilla'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ===== Add Template Modal =====
const AddTemplateModal = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const result = await templateService.createTemplate({ name, category, body });
      onSave(result);
    } catch (e) {
      console.error('Failed to create template:', e);
    }
    setSaving(false);
  };

  return createPortal(
    <div className={`${B}__overlay`} onClick={onClose}>
      <div className={`${B}__modal`} onClick={(e) => e.stopPropagation()}>
        <div className={`${B}__modal-header`}>
          <h3 className={`${B}__modal-title`}>Nueva Plantilla</h3>
          <button className={`${B}__modal-close`} onClick={onClose}><CloseIcon /></button>
        </div>
        <div className={`${B}__modal-body`}>
          <div className={`${B}__form-field`}>
            <label className={`${B}__form-label`}>Nombre</label>
            <input type="text" className={`${B}__form-input`} value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Recordatorio de cita" />
          </div>
          <div className={`${B}__form-field`}>
            <label className={`${B}__form-label`}>Categoría</label>
            <select className={`${B}__form-select`} value={category} onChange={e => setCategory(e.target.value)}>
              {Object.entries(CAT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className={`${B}__form-field`}>
            <label className={`${B}__form-label`}>
              Mensaje <span className={`${B}__form-hint`}>Usa {'{{nombre}}'}, {'{{hora}}'}, {'{{negocio}}'}, etc.</span>
            </label>
            <textarea className={`${B}__form-textarea`} value={body} onChange={e => setBody(e.target.value)}
              placeholder="Hola {{nombre}}, te recordamos tu cita..." rows={5} />
          </div>
          <div className={`${B}__form-actions`}>
            <button className={`${B}__form-btn ${B}__form-btn--cancel`} onClick={onClose}>Cancelar</button>
            <button className={`${B}__form-btn ${B}__form-btn--save`} onClick={handleSave}
              disabled={saving || !name.trim() || !body.trim()}>
              {saving ? 'Guardando...' : 'Crear Plantilla'}
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
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [sendTemplate, setSendTemplate] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editTemplate, setEditTemplate] = useState(null);
  const [submittingMeta, setSubmittingMeta] = useState(null); // template.id being submitted

  const handleEditSave = useCallback(async (id, data) => {
    const result = await templateService.updateTemplate(id, data);
    setTemplates(prev => prev.map(t => t.id === id ? (result || { ...t, ...data }) : t));
    addNotification('Plantilla actualizada', 'success');
  }, [addNotification]);

  // Load templates from DB
  useEffect(() => {
    (async () => {
      try {
        const data = await templateService.getTemplates();
        setTemplates(data || []);
      } catch (e) {
        console.error('Failed to load templates:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Compute categories from real data
  const categories = useMemo(() => {
    const counts = {};
    templates.forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return Object.entries(counts).map(([id, count]) => ({
      id,
      name: CAT_LABELS[id] || id,
      color: CAT_COLORS[id] || CAT_COLORS.general,
      count,
    }));
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    let result = [...templates];
    if (activeCategory !== 'all') {
      result = result.filter((t) => t.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
      );
    }
    return result;
  }, [templates, activeCategory, searchQuery]);

  const handleSend = useCallback((template, sent, failed) => {
    if (failed > 0) {
      addNotification(`Plantilla "${template.name}": ${sent} enviados, ${failed} fallidos`, sent > 0 ? 'warning' : 'error');
    } else {
      addNotification(`Plantilla "${template.name}" enviada a ${sent} clientes`, 'success');
    }
    setSendTemplate(null);
  }, [addNotification]);

  const handleApprove = useCallback(async (template) => {
    try {
      await templateService.approveTemplate(template.id);
      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, status: 'approved' } : t));
      addNotification(`"${template.name}" marcada como aprobada`, 'success');
    } catch (e) {
      addNotification('Error aprobando plantilla', 'error');
    }
  }, [addNotification]);

  const handleSubmitMeta = useCallback(async (template) => {
    setSubmittingMeta(template.id);
    try {
      const result = await templateService.submitToMeta(template.id);
      setTemplates(prev => prev.map(t => t.id === template.id ? (result.template || { ...t, status: 'pending' }) : t));
      if (result.meta_status === 'APPROVED') {
        addNotification(`"${template.name}" aprobada por Meta`, 'success');
      } else if (result.meta_status === 'ALREADY_EXISTS') {
        addNotification(`"${template.name}" ya existe en Meta. Verifica el estado.`, 'info');
      } else {
        addNotification(`"${template.name}" enviada a Meta. Pendiente de aprobacion.`, 'success');
      }
    } catch (e) {
      addNotification(`Error: ${e.message}`, 'error');
    } finally {
      setSubmittingMeta(null);
    }
  }, [addNotification]);

  const handleCheckStatus = useCallback(async (template) => {
    try {
      const result = await templateService.checkMetaStatus(template.id);
      if (result.template) {
        setTemplates(prev => prev.map(t => t.id === template.id ? result.template : t));
      }
      const statusLabel = STATUS_LABELS[result.plexify_status]?.label || result.meta_status;
      addNotification(`"${template.name}": ${statusLabel}`, result.plexify_status === 'approved' ? 'success' : 'info');
    } catch (e) {
      addNotification('Error verificando estado en Meta', 'error');
    }
  }, [addNotification]);

  const handleDeleteClick = useCallback((template) => {
    setDeleteConfirm(template);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      await templateService.deleteTemplate(deleteConfirm.id);
      setTemplates(prev => prev.filter(t => t.id !== deleteConfirm.id));
      addNotification(`"${deleteConfirm.name}" eliminada`, 'info');
    } catch (e) {
      addNotification('Error eliminando plantilla', 'error');
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, addNotification]);

  const handleAddSave = useCallback((newTemplate) => {
    setTemplates(prev => [...prev, newTemplate]);
    setShowAddModal(false);
    addNotification(`Plantilla "${newTemplate.name}" creada como borrador`, 'success');
  }, [addNotification]);

  const approvedCount = templates.filter(t => t.status === 'approved').length;
  const pendingCount = templates.filter(t => t.status !== 'approved').length;

  return (
    <div className={B}>
      {/* Header */}
      <div className={`${B}__header`}>
        <div className={`${B}__header-left`}>
          <h2 className={`${B}__title`}>Plantillas WhatsApp</h2>
          <span className={`${B}__count`}>
            {templates.length} plantillas
            {approvedCount > 0 && <span style={{ color: '#10B981' }}> ({approvedCount} aprobadas)</span>}
            {pendingCount > 0 && <span style={{ color: '#F59E0B' }}> ({pendingCount} pendientes)</span>}
          </span>
        </div>
        <div className={`${B}__header-right`}>
          <div className={`${B}__search`}>
            <span className={`${B}__search-icon`}><SearchIcon /></span>
            <input type="text" className={`${B}__search-input`} placeholder="Buscar plantilla..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <button className={`${B}__add-btn`} onClick={() => setShowAddModal(true)}>
            <PlusIcon /> Nueva plantilla
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className={`${B}__categories`}>
        <button className={`${B}__cat-pill ${activeCategory === 'all' ? `${B}__cat-pill--active` : ''}`}
          onClick={() => setActiveCategory('all')}>
          Todas ({templates.length})
        </button>
        {categories.map((cat) => (
          <button key={cat.id}
            className={`${B}__cat-pill ${activeCategory === cat.id ? `${B}__cat-pill--active` : ''}`}
            onClick={() => setActiveCategory(cat.id)}
            style={activeCategory === cat.id ? { background: cat.color, borderColor: cat.color } : {}}>
            {cat.name} ({cat.count})
          </button>
        ))}
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className={`${B}__empty`}><p>Cargando plantillas...</p></div>
      ) : (
        <div className={`${B}__grid`}>
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template}
              onPreview={setPreviewTemplate} onSend={setSendTemplate}
              onApprove={handleApprove} onDelete={handleDeleteClick}
              onSubmitMeta={handleSubmitMeta} onCheckStatus={handleCheckStatus}
              onEdit={setEditTemplate} isSubmitting={submittingMeta === template.id} />
          ))}
        </div>
      )}

      {!loading && filteredTemplates.length === 0 && (
        <div className={`${B}__empty`}><p>No se encontraron plantillas</p></div>
      )}

      {/* Modals */}
      {previewTemplate && <PreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />}
      {sendTemplate && <SendModal template={sendTemplate} onClose={() => setSendTemplate(null)} onSend={handleSend} />}
      {showAddModal && <AddTemplateModal onClose={() => setShowAddModal(false)} onSave={handleAddSave} />}
      {editTemplate && <EditModal template={editTemplate} onClose={() => setEditTemplate(null)} onSave={handleEditSave} />}

      {/* Delete confirmation modal */}
      {deleteConfirm && createPortal(
        <div className={`${B}__overlay`} onClick={() => setDeleteConfirm(null)}>
          <div className={`${B}__modal ${B}__modal--confirm`} onClick={(e) => e.stopPropagation()}>
            <div className={`${B}__modal-header`}>
              <h3 className={`${B}__modal-title`}>Eliminar plantilla</h3>
              <button className={`${B}__modal-close`} onClick={() => setDeleteConfirm(null)}><CloseIcon /></button>
            </div>
            <div className={`${B}__modal-body`}>
              <div className={`${B}__confirm-icon`}>🗑️</div>
              <p className={`${B}__confirm-text`}>
                ¿Estás seguro de que quieres eliminar la plantilla <strong>"{deleteConfirm.name}"</strong>?
              </p>
              <p className={`${B}__confirm-sub`}>Esta acción no se puede deshacer.</p>
              <div className={`${B}__form-actions`}>
                <button className={`${B}__form-btn ${B}__form-btn--cancel`} onClick={() => setDeleteConfirm(null)}>
                  Cancelar
                </button>
                <button className={`${B}__form-btn ${B}__form-btn--delete`} onClick={handleDeleteConfirm}>
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Messaging;
