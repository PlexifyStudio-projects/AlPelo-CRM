import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import staffService from '../../services/staffService';
import { mockClients, mockBarbers, mockVisitHistory } from '../../data/mockData';
import { useNotification } from '../../context/NotificationContext';

const b = 'team';

const ROLES = ['Todos', 'Barbero', 'Barbera', 'Estilista', 'Manicurista'];

// ===== Weibook live data (synced from https://book.weibook.co/alpelo-peluqueria) =====
const WEIBOOK_DATA = {
  'Victor Fernandez':        { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/c550d3ed-9cd5-4a88-86c2-563c8d5d5f75.webp', rating: 4.85, role: 'Barbero' },
  'Alexander Carballo':      { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/c34facf4-5716-40ec-a139-bc3c0233e72e.webp', rating: 4.9, role: 'Barbero' },
  'Daniel Nunez':            { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/ee61be80-e8ab-44bc-abfe-3d264e3d6755.webp', rating: 4.71, role: 'Barbero' },
  'Angel Pabon':             { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/7bdf5545-b7ab-4b98-bfaf-4b1579be83c1.webp', rating: 5.0, role: 'Barbero' },
  'Anderson Bohorquez':      { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/2ee51b69-6e11-40b2-9d81-66941a6a1baf.webp', rating: 4.5, role: 'Barbero' },
  'Camilo Gutierrez':        { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/4618975a-6401-4000-ae8d-4a0474e59608.webp', rating: 4.7, role: 'Barbero' },
  'Yhon Estrada':            { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/5aac79e5-7abd-4044-917b-8966e672fae3.webp', rating: 5.0, role: 'Barbero' },
  'Josemith':                { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/5aac79e5-7abd-4044-917b-8966e672fae3.webp', rating: 5.0, role: 'Estilista', bio: 'Más de 10 años de experiencia en técnicas innovadoras de color' },
  'Liliana Gisella Romero':  { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/68062947-a86f-49a2-b1fb-15f3a659607b.webp', rating: 4.57, role: 'Estilista' },
  'Marcela Leal':            { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/822b9e68-7138-4be8-a085-aa620830b02b.webp', rating: 4.66, role: 'Estilista', bio: 'Tricoterapeuta especialista en recuperación capilar' },
  'Dulce Araque':            { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/08ce01d1-bf20-499a-9208-b767b2684f12.webp', rating: 4.66, role: 'Estilista' },
  'Fanny Lizarazo':          { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/08ce01d1-bf20-499a-9208-b767b2684f12.webp', rating: null, role: 'Estilista' },
  'Jazmin Aponte Montano':   { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/72102b0e-d7f0-4053-b4d1-b0c89d064e54.webp', rating: 4.92, role: 'Manicurista' },
  'Maria Jose Bastos':       { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/eb5b2f5e-cf13-49a2-a653-f312974c748a.webp', rating: 5.0, role: 'Manicurista' },
  'Carolina Banderas':       { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/598e4c9d-2dd9-46d8-bd09-b4bcd182ea6b.webp', rating: 4.8, role: 'Manicurista' },
  'Nicole Serrano':          { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/76710cba-c022-4459-9e81-fccc4e9cf0dc.webp', rating: 4.66, role: 'Manicurista' },
  'Zuleidy Yepes':           { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/f8dba059-c971-4af7-ae27-7025651ae7e7.webp', rating: 4.33, role: 'Manicurista', bio: '3 años de experiencia en todas las técnicas' },
  'Stefania Bustamante':     { photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/67183df2-8db1-4006-9af4-035c523c3ab2.webp', rating: 4.5, role: 'Manicurista' },
  'Astrid Carolina Leon':    { photo: null, rating: null, role: 'Barbera' },
  'Tatiana':                 { photo: null, rating: null, role: 'Barbera' },
};

const getWeibook = (name) => WEIBOOK_DATA[name] || {};
const getPhoto = (name) => getWeibook(name).photo || null;
const getWeibookRating = (name) => getWeibook(name).rating || null;

// ===== Name normalization for matching mock data =====
const normalize = (n) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const getMockBarberId = (staffName) => {
  const norm = normalize(staffName);
  const match = mockBarbers.find((mb) => normalize(mb.name) === norm);
  return match?.id || null;
};

const getInitials = (name) => {
  const parts = name.split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr + 'T00:00:00').getTime();
  return Math.floor(diff / 86400000);
};

// ===== ICONS =====
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const XIcon = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const PhoneIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const MailIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>;
const CalendarIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const StarIcon = ({ filled }) => <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
const UserIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const ToggleIcon = ({ on }) => (
  <svg width="36" height="20" viewBox="0 0 36 20">
    <rect x="0" y="0" width="36" height="20" rx="10" fill={on ? '#34D399' : '#D8D8D4'} style={{ transition: 'fill 0.2s' }} />
    <circle cx={on ? 26 : 10} cy="10" r="7" fill="white" style={{ transition: 'cx 0.2s' }} />
  </svg>
);
const SendIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>;

// ===== DEACTIVATION MODAL =====
const WhatsAppIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
const CheckIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;

const getStaffClients = (memberName) => {
  const mockId = getMockBarberId(memberName);
  if (!mockId) return [];
  const map = new Map();
  mockVisitHistory
    .filter((v) => v.barberId === mockId && v.status === 'completed')
    .forEach((v) => {
      const client = mockClients.find((c) => c.id === v.clientId);
      if (!client) return;
      if (!map.has(v.clientId)) {
        map.set(v.clientId, {
          id: client.id, clientId: client.clientId, name: client.name,
          phone: client.phone, lastVisit: v.date, lastService: v.service,
        });
      }
      const entry = map.get(v.clientId);
      if (v.date > entry.lastVisit) { entry.lastVisit = v.date; entry.lastService = v.service; }
    });
  return [...map.values()].sort((a, bb) => bb.lastVisit.localeCompare(a.lastVisit));
};

const DeactivateModal = ({ member, clients, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState(() => new Set(clients.map((c) => c.id)));
  const [template, setTemplate] = useState(
    `Hola {{nombre}}, soy Lina de Al Pelo. Queremos informarte que ${member.name} no estara disponible por el momento. Pero no te preocupes, tenemos un equipo increible listo para atenderte con la misma calidad de siempre. Como gesto especial, en tu proxima visita tienes un *10% de descuento*. Agenda aqui: https://book.weibook.co/alpelo-peluqueria Seguimos para ponerte Al Pelo!`
  );

  const toggleClient = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === clients.length) setSelected(new Set());
    else setSelected(new Set(clients.map((c) => c.id)));
  };

  const selectedClients = clients.filter((c) => selected.has(c.id));

  return createPortal(
    <div className={`${b}__overlay`} onClick={onCancel}>
      <div className={`${b}__deact-modal`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`${b}__deact-header`}>
          <div className={`${b}__deact-icon`}><SendIcon /></div>
          <h3>Desactivar a {member.name}</h3>
          <p>{clients.length > 0
            ? <>Selecciona los clientes a notificar para retenerlos en Al Pelo</>
            : 'Este miembro no tiene clientes registrados'
          }</p>
        </div>

        {/* Template */}
        <div className={`${b}__deact-body`}>
          <label>Plantilla de retencion (WhatsApp Business)</label>
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} />
          <span className={`${b}__deact-hint`}>
            <WhatsAppIcon /> Usa {'{{nombre}}'} para personalizar. Cumple politicas de WhatsApp Business.
          </span>
        </div>

        {/* Client list with checkboxes */}
        {clients.length > 0 && (
          <div className={`${b}__deact-clients`}>
            <div className={`${b}__deact-clients-header`}>
              <label className={`${b}__deact-check-all`}>
                <input
                  type="checkbox"
                  checked={selected.size === clients.length}
                  onChange={toggleAll}
                />
                <span>Seleccionar todos</span>
              </label>
              <span className={`${b}__deact-clients-badge`}>
                {selected.size} de {clients.length} seleccionados
              </span>
            </div>
            <div className={`${b}__deact-clients-list`}>
              {clients.map((c) => {
                const days = daysSince(c.lastVisit);
                const isChecked = selected.has(c.id);
                return (
                  <label key={c.id} className={`${b}__deact-client ${isChecked ? `${b}__deact-client--selected` : ''}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleClient(c.id)}
                    />
                    <div className={`${b}__deact-client-info`}>
                      <span className={`${b}__deact-client-name`}>{c.name}</span>
                      <span className={`${b}__deact-client-id`}>{c.clientId}</span>
                    </div>
                    <div className={`${b}__deact-client-meta`}>
                      <span className={`${b}__deact-client-phone`}>{c.phone}</span>
                      <span className={`${b}__deact-client-visit`}>
                        Ultima visita: {formatDate(c.lastVisit)}
                        {days !== null && days <= 7 && (
                          <mark className={`${b}__deact-client-recent`}>Reciente ({days}d)</mark>
                        )}
                      </span>
                    </div>
                    <span className={`${b}__deact-client-tag`}>Recuperando</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Info note */}
        <div className={`${b}__deact-note`}>
          <WhatsAppIcon />
          <span>Al confirmar, se creara una conversacion en el <strong>Inbox</strong> con cada cliente seleccionado. Los clientes tendran la etiqueta <strong>"Recuperando"</strong>.</span>
        </div>

        <div className={`${b}__deact-actions`}>
          <button className={`${b}__btn ${b}__btn--ghost`} onClick={onCancel}>Cancelar</button>
          <button
            className={`${b}__btn ${b}__btn--warning`}
            disabled={selected.size === 0}
            onClick={() => onConfirm(template, selectedClients)}
          >
            <SendIcon /> Desactivar y enviar a {selected.size} cliente{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ===== STAFF FORM MODAL =====
const StaffFormModal = ({ staff, onClose, onSaved }) => {
  const isEdit = !!staff;
  const [form, setForm] = useState({
    name: staff?.name || '', phone: staff?.phone || '', email: staff?.email || '',
    role: staff?.role || 'Barbero', specialty: staff?.specialty || '', bio: staff?.bio || '',
    hire_date: staff?.hire_date || '', skills: staff?.skills?.join(', ') || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); if (error) setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null,
        role: form.role, specialty: form.specialty.trim() || null, bio: form.bio.trim() || null,
        hire_date: form.hire_date || null,
        skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      };
      if (isEdit) await staffService.update(staff.id, data);
      else await staffService.create(data);
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className={`${b}__overlay`} onClick={onClose}>
      <div className={`${b}__form-modal`} onClick={(e) => e.stopPropagation()}>
        <div className={`${b}__form-header`}>
          <h3>{isEdit ? 'Editar miembro' : 'Nuevo miembro del equipo'}</h3>
          <button className={`${b}__close-btn`} onClick={onClose}><XIcon /></button>
        </div>
        <form className={`${b}__form-body`} onSubmit={handleSubmit}>
          <div className={`${b}__form-row`}>
            <div className={`${b}__form-field`}>
              <label>Nombre completo *</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Ej: Juan Perez" required />
            </div>
            <div className={`${b}__form-field`}>
              <label>Rol</label>
              <select name="role" value={form.role} onChange={handleChange}>
                <option value="Barbero">Barbero</option>
                <option value="Barbera">Barbera</option>
                <option value="Estilista">Estilista</option>
                <option value="Manicurista">Manicurista</option>
              </select>
            </div>
          </div>
          <div className={`${b}__form-row`}>
            <div className={`${b}__form-field`}>
              <label>Telefono</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+57 3XX XXX XXXX" />
            </div>
            <div className={`${b}__form-field`}>
              <label>Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="correo@alpelo.co" />
            </div>
          </div>
          <div className={`${b}__form-row`}>
            <div className={`${b}__form-field`}>
              <label>Especialidad</label>
              <input name="specialty" value={form.specialty} onChange={handleChange} placeholder="Ej: Especialista en color" />
            </div>
            <div className={`${b}__form-field`}>
              <label>Fecha de ingreso</label>
              <input name="hire_date" type="date" value={form.hire_date} onChange={handleChange} />
            </div>
          </div>
          <div className={`${b}__form-field`}>
            <label>Habilidades (separadas por coma)</label>
            <input name="skills" value={form.skills} onChange={handleChange} placeholder="Degradados, Cortes clasicos, Disenos" />
          </div>
          <div className={`${b}__form-field`}>
            <label>Biografia</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} placeholder="Breve descripcion del profesional..." />
          </div>
          {error && <div className={`${b}__form-error`}>{error}</div>}
          <div className={`${b}__form-actions`}>
            <button type="button" className={`${b}__btn ${b}__btn--ghost`} onClick={onClose}>Cancelar</button>
            <button type="submit" className={`${b}__btn ${b}__btn--primary`} disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear miembro'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

// ===== SKILL EDITOR =====
const SkillEditor = ({ staff, onUpdated }) => {
  const [newSkill, setNewSkill] = useState('');
  const { addNotification } = useNotification();

  const handleAdd = async () => {
    const skill = newSkill.trim();
    if (!skill) return;
    try {
      const updated = await staffService.addSkill(staff.id, skill);
      onUpdated(updated);
      setNewSkill('');
    } catch (err) { addNotification(err.message, 'error'); }
  };

  const handleRemove = async (skill) => {
    try {
      const updated = await staffService.removeSkill(staff.id, skill);
      onUpdated(updated);
    } catch (err) { addNotification(err.message, 'error'); }
  };

  return (
    <div className={`${b}__skill-editor`}>
      <div className={`${b}__skill-tags`}>
        {(staff.skills || []).map((skill) => (
          <span key={skill} className={`${b}__skill-tag`}>
            {skill}
            <button onClick={() => handleRemove(skill)}><XIcon size={10} /></button>
          </span>
        ))}
        {(!staff.skills || staff.skills.length === 0) && (
          <span className={`${b}__skill-empty`}>Sin habilidades registradas</span>
        )}
      </div>
      <div className={`${b}__skill-add`}>
        <input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          placeholder="Agregar habilidad..."
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        />
        <button onClick={handleAdd} disabled={!newSkill.trim()}><PlusIcon /></button>
      </div>
    </div>
  );
};

// ===== DETAIL DRAWER =====
const DetailDrawer = ({ member, onClose, onEdit, onToggleActive, onUpdated }) => {
  const mockId = getMockBarberId(member.name);

  // Get visit history for this staff member
  const visits = useMemo(() => {
    if (!mockId) return [];
    return mockVisitHistory
      .filter((v) => v.barberId === mockId && v.status === 'completed')
      .sort((a, bb) => bb.date.localeCompare(a.date));
  }, [mockId]);

  // Get unique clients with their latest visit info
  const clientHistory = useMemo(() => {
    const map = new Map();
    visits.forEach((v) => {
      const client = mockClients.find((c) => c.id === v.clientId);
      if (!client) return;
      if (!map.has(v.clientId)) {
        map.set(v.clientId, {
          id: client.id,
          clientId: client.clientId,
          name: client.name,
          phone: client.phone,
          lastVisit: v.date,
          lastService: v.service,
          totalVisits: 0,
          totalSpent: 0,
        });
      }
      const entry = map.get(v.clientId);
      entry.totalVisits += 1;
      entry.totalSpent += v.amount;
      if (v.date > entry.lastVisit) {
        entry.lastVisit = v.date;
        entry.lastService = v.service;
      }
    });
    return [...map.values()].sort((a, bb) => bb.lastVisit.localeCompare(a.lastVisit));
  }, [visits]);

  const totalRevenue = visits.reduce((s, v) => s + v.amount, 0);
  const photo = getPhoto(member.name);

  return createPortal(
    <div className={`${b}__drawer-overlay`} onClick={onClose}>
      <div className={`${b}__drawer`} onClick={(e) => e.stopPropagation()}>
        {/* Header with photo */}
        <div className={`${b}__drawer-hero`}>
          <button className={`${b}__drawer-close`} onClick={onClose}><XIcon size={18} /></button>
          <div className={`${b}__drawer-avatar ${!photo ? `${b}__drawer-avatar--fallback` : ''}`}>
            {photo ? (
              <img src={photo} alt={member.name} />
            ) : (
              <span>{getInitials(member.name)}</span>
            )}
            <span className={`${b}__drawer-dot ${member.is_active ? `${b}__drawer-dot--on` : `${b}__drawer-dot--off`}`} />
          </div>
          <h2 className={`${b}__drawer-name`}>{member.name}</h2>
          <p className={`${b}__drawer-role`}>{member.specialty || member.role}</p>
          {(getWeibookRating(member.name) || member.rating) && (
            <div className={`${b}__drawer-rating`}>
              <StarIcon filled /> {(getWeibookRating(member.name) || member.rating).toFixed(1)}
            </div>
          )}
          <div className={`${b}__drawer-hero-actions`}>
            <button className={`${b}__btn ${b}__btn--outline-sm`} onClick={() => onEdit(member)}>
              <EditIcon /> Editar
            </button>
            <button
              className={`${b}__btn ${member.is_active ? `${b}__btn--danger-sm` : `${b}__btn--success-sm`}`}
              onClick={() => onToggleActive(member)}
            >
              <ToggleIcon on={member.is_active} />
              {member.is_active ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className={`${b}__drawer-stats`}>
          <div className={`${b}__drawer-stat`}>
            <span className={`${b}__drawer-stat-value`}>{clientHistory.length}</span>
            <span className={`${b}__drawer-stat-label`}>Clientes</span>
          </div>
          <div className={`${b}__drawer-stat`}>
            <span className={`${b}__drawer-stat-value`}>{visits.length}</span>
            <span className={`${b}__drawer-stat-label`}>Atenciones</span>
          </div>
          <div className={`${b}__drawer-stat`}>
            <span className={`${b}__drawer-stat-value`}>{formatCurrency(totalRevenue)}</span>
            <span className={`${b}__drawer-stat-label`}>Ingresos</span>
          </div>
        </div>

        {/* Info section */}
        <div className={`${b}__drawer-section`}>
          <h4 className={`${b}__drawer-section-title`}>Informacion</h4>
          <div className={`${b}__drawer-info-grid`}>
            <div className={`${b}__drawer-info-item`}>
              <PhoneIcon />
              <span>{member.phone || 'No registrado'}</span>
            </div>
            <div className={`${b}__drawer-info-item`}>
              <MailIcon />
              <span>{member.email || 'No registrado'}</span>
            </div>
            <div className={`${b}__drawer-info-item`}>
              <CalendarIcon />
              <span>Ingreso: {formatDate(member.hire_date)}</span>
            </div>
            <div className={`${b}__drawer-info-item`}>
              <UserIcon />
              <span>{member.role}</span>
            </div>
          </div>
          {member.bio && <p className={`${b}__drawer-bio`}>{member.bio}</p>}
        </div>

        {/* Skills section */}
        <div className={`${b}__drawer-section`}>
          <h4 className={`${b}__drawer-section-title`}>Habilidades</h4>
          <SkillEditor staff={member} onUpdated={onUpdated} />
        </div>

        {/* Client history section */}
        <div className={`${b}__drawer-section`}>
          <h4 className={`${b}__drawer-section-title`}>
            Clientes atendidos
            <span className={`${b}__drawer-section-badge`}>{clientHistory.length}</span>
          </h4>
          {clientHistory.length > 0 ? (
            <div className={`${b}__drawer-clients`}>
              <div className={`${b}__drawer-client-header`}>
                <span>ID</span>
                <span>Cliente</span>
                <span>Servicio</span>
                <span>Ultima visita</span>
                <span>Visitas</span>
                <span>Total</span>
              </div>
              {clientHistory.map((c) => (
                <div key={c.id} className={`${b}__drawer-client-row`}>
                  <span className={`${b}__drawer-client-id`}>{c.clientId}</span>
                  <span className={`${b}__drawer-client-name`}>{c.name}</span>
                  <span className={`${b}__drawer-client-service`}>{c.lastService}</span>
                  <span className={`${b}__drawer-client-date`}>
                    {formatDate(c.lastVisit)}
                    {daysSince(c.lastVisit) !== null && (
                      <small> ({daysSince(c.lastVisit)}d)</small>
                    )}
                  </span>
                  <span className={`${b}__drawer-client-visits`}>{c.totalVisits}</span>
                  <span className={`${b}__drawer-client-total`}>{formatCurrency(c.totalSpent)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={`${b}__drawer-empty`}>Sin historial de clientes registrado</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ===== MAIN COMPONENT =====
const Team = () => {
  const { addNotification } = useNotification();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [activeFilter, setActiveFilter] = useState('active');
  const [sortBy, setSortBy] = useState('name');
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [simpleDeactivating, setSimpleDeactivating] = useState(null);

  const loadStaff = useCallback(async () => {
    try {
      const data = await staffService.list();
      setStaff(data);
    } catch (err) { addNotification(err.message, 'error'); }
    finally { setLoading(false); }
  }, [addNotification]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const filtered = useMemo(() => {
    let list = [...staff];
    if (roleFilter !== 'Todos') list = list.filter((s) => s.role === roleFilter);
    if (activeFilter === 'active') list = list.filter((s) => s.is_active);
    if (activeFilter === 'inactive') list = list.filter((s) => !s.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) || (s.specialty || '').toLowerCase().includes(q) || (s.skills || []).some((sk) => sk.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'name') list.sort((a, b_) => a.name.localeCompare(b_.name));
    if (sortBy === 'hire_date') list.sort((a, b_) => (a.hire_date || '').localeCompare(b_.hire_date || ''));
    if (sortBy === 'role') list.sort((a, b_) => a.role.localeCompare(b_.role) || a.name.localeCompare(b_.name));
    if (sortBy === 'rating') list.sort((a, b_) => (b_.rating || 0) - (a.rating || 0));
    return list;
  }, [staff, roleFilter, activeFilter, search, sortBy]);

  const stats = useMemo(() => {
    const rated = staff.filter((s) => s.rating);
    const avgRating = rated.length ? (rated.reduce((sum, s) => sum + s.rating, 0) / rated.length).toFixed(1) : '-';
    return {
      total: staff.length,
      active: staff.filter((s) => s.is_active).length,
      roles: ROLES.slice(1).map((r) => ({ role: r, count: staff.filter((s) => s.role === r).length })),
      avgRating,
    };
  }, [staff]);

  const selectedMember = staff.find((s) => s.id === selectedId);

  const handleEdit = (member) => { setEditingStaff(member); setShowForm(true); };

  const handleFormSaved = () => {
    setShowForm(false); setEditingStaff(null); loadStaff();
    addNotification(editingStaff ? 'Miembro actualizado' : 'Miembro creado', 'success');
  };

  const handleStaffUpdated = (updated) => {
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleToggleActive = (member) => {
    if (member.is_active) {
      const clients = getStaffClients(member.name);
      if (clients.length > 0) {
        setDeactivating(member);
      } else {
        setSimpleDeactivating(member);
      }
    } else {
      handleActivate(member);
    }
  };

  const handleActivate = async (member) => {
    try {
      const updated = await staffService.update(member.id, { is_active: true });
      handleStaffUpdated(updated);
      addNotification(`${member.name} ha sido activado`, 'success');
    } catch (err) { addNotification(err.message, 'error'); }
  };

  const handleDeactivateConfirm = async (template, selectedClients) => {
    const member = deactivating;
    try {
      const updated = await staffService.update(member.id, { is_active: false });
      handleStaffUpdated(updated);

      // Create conversations for Inbox via localStorage
      const roleText = member.role === 'Barbero' || member.role === 'Barbera'
        ? 'nuestros barberos' : member.role === 'Estilista' ? 'nuestras estilistas' : 'nuestras manicuristas';
      const now = new Date();
      const conversations = selectedClients.map((client, i) => {
        const firstName = client.name.split(' ')[0];
        const resolvedMsg = template.replace(/\{\{nombre\}\}/g, firstName);
        const t1 = new Date(now.getTime() + i * 2000);
        const t2 = new Date(t1.getTime() + 15 * 60000); // +15min
        const t3 = new Date(t2.getTime() + 2 * 60000);  // +2min
        return {
          convId: `deact-${member.id}-${client.id}`,
          clientName: client.name,
          clientPhone: client.phone,
          clientId: client.clientId,
          tag: 'Recuperando',
          messages: [
            { from: 'business', text: resolvedMsg, time: t1.toISOString() },
            { from: 'client', text: `Hola! Gracias por avisarme. Me gustaria agendar con otro profesional entonces. El descuento aplica para cualquier servicio?`, time: t2.toISOString() },
            { from: 'business', text: `Claro que si, ${firstName}! El 10% aplica en cualquier servicio. Te recomiendo a ${roleText} disponibles. Agenda aqui y listo: https://book.weibook.co/alpelo-peluqueria`, time: t3.toISOString() },
          ],
        };
      });

      // Save to localStorage for Inbox to pick up
      const existing = JSON.parse(localStorage.getItem('alpelo_inbox_pending') || '[]');
      localStorage.setItem('alpelo_inbox_pending', JSON.stringify([...existing, ...conversations]));

      addNotification(`${member.name} desactivado. ${selectedClients.length} conversacion${selectedClients.length !== 1 ? 'es' : ''} creada${selectedClients.length !== 1 ? 's' : ''} en el Inbox.`, 'success');
    } catch (err) { addNotification(err.message, 'error'); }
    setDeactivating(null);
  };

  const handleSimpleDeactivate = async () => {
    const member = simpleDeactivating;
    try {
      const updated = await staffService.update(member.id, { is_active: false });
      handleStaffUpdated(updated);
      addNotification(`${member.name} ha sido desactivado`, 'success');
    } catch (err) { addNotification(err.message, 'error'); }
    setSimpleDeactivating(null);
  };

  const getClientCount = (member) => getStaffClients(member.name).length;

  if (loading) return <div className={b}><p style={{ padding: '2rem', color: '#8E8E85' }}>Cargando equipo...</p></div>;

  return (
    <div className={b}>
      {/* Top bar */}
      <div className={`${b}__topbar`}>
        <div>
          <h2 className={`${b}__title`}>Equipo</h2>
          <p className={`${b}__subtitle`}>{stats.active} activos de {stats.total} miembros</p>
        </div>
        <button className={`${b}__btn ${b}__btn--primary`} onClick={() => { setEditingStaff(null); setShowForm(true); }}>
          <PlusIcon /> Nuevo miembro
        </button>
      </div>

      {/* KPI row */}
      <div className={`${b}__kpis`}>
        {stats.roles.map((r) => (
          <div key={r.role} className={`${b}__kpi`}>
            <span className={`${b}__kpi-num`}>{r.count}</span>
            <span className={`${b}__kpi-label`}>{r.role}s</span>
          </div>
        ))}
        <div className={`${b}__kpi ${b}__kpi--accent`}>
          <span className={`${b}__kpi-num`}>{stats.avgRating}</span>
          <span className={`${b}__kpi-label`}>Rating</span>
        </div>
      </div>

      {/* Filters */}
      <div className={`${b}__toolbar`}>
        <div className={`${b}__search`}>
          <SearchIcon />
          <input type="text" placeholder="Buscar por nombre, especialidad o habilidad..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={`${b}__filters`}>
          <div className={`${b}__tabs`}>
            {ROLES.map((role) => (
              <button key={role} className={`${b}__tab ${roleFilter === role ? `${b}__tab--active` : ''}`} onClick={() => setRoleFilter(role)}>{role}</button>
            ))}
          </div>
          <div className={`${b}__tabs`}>
            {[{ v: 'all', l: 'Todos' }, { v: 'active', l: 'Activos' }, { v: 'inactive', l: 'Inactivos' }].map((o) => (
              <button key={o.v} className={`${b}__tab ${activeFilter === o.v ? `${b}__tab--active` : ''}`} onClick={() => setActiveFilter(o.v)}>{o.l}</button>
            ))}
          </div>
          <select className={`${b}__select`} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Nombre</option>
            <option value="rating">Rating</option>
            <option value="hire_date">Antiguedad</option>
            <option value="role">Rol</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className={`${b}__results`}>{filtered.length} miembro{filtered.length !== 1 ? 's' : ''}</div>

      {/* Grid */}
      <div className={`${b}__grid`}>
        {filtered.map((member, i) => {
          const photo = getPhoto(member.name);
          const wRating = getWeibookRating(member.name);
          const rating = wRating || member.rating;
          const lastSvc = getStaffClients(member.name)[0];
          const isSelected = selectedId === member.id;
          return (
            <div
              key={member.id}
              className={`${b}__card ${isSelected ? `${b}__card--selected` : ''} ${!member.is_active ? `${b}__card--inactive` : ''}`}
              style={{ animationDelay: `${0.03 * (i + 1)}s` }}
              onClick={() => setSelectedId(isSelected ? null : member.id)}
            >
              <div className={`${b}__card-photo ${!photo ? `${b}__card-photo--fallback` : ''}`}>
                {photo ? (
                  <img src={photo} alt={member.name} />
                ) : (
                  <span className={`${b}__card-initials`}>{getInitials(member.name)}</span>
                )}
                <span className={`${b}__card-status ${member.is_active ? `${b}__card-status--on` : `${b}__card-status--off`}`} />
              </div>
              <div className={`${b}__card-body`}>
                <span className={`${b}__card-name`}>{member.name}</span>
                <span className={`${b}__card-role`}>{member.specialty || member.role}</span>
                {rating && (
                  <span className={`${b}__card-rating`}>
                    <StarIcon filled /> {rating.toFixed(1)}
                  </span>
                )}
              </div>
              <div className={`${b}__card-status-badge`}>
                <span className={`${b}__card-badge ${member.is_active ? `${b}__card-badge--active` : `${b}__card-badge--inactive`}`}>
                  {member.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              {lastSvc && (
                <div className={`${b}__card-last-service`}>
                  <CalendarIcon />
                  <div className={`${b}__card-last-service-info`}>
                    <span className={`${b}__card-last-service-name`}>{lastSvc.lastService}</span>
                    <span className={`${b}__card-last-service-date`}>{formatDate(lastSvc.lastVisit)}</span>
                  </div>
                </div>
              )}
              {(member.skills || []).length > 0 && (
                <div className={`${b}__card-skills`}>
                  {member.skills.slice(0, 2).map((sk) => (
                    <span key={sk} className={`${b}__card-chip`}>{sk}</span>
                  ))}
                  {member.skills.length > 2 && <span className={`${b}__card-chip ${b}__card-chip--more`}>+{member.skills.length - 2}</span>}
                </div>
              )}
              <div className={`${b}__card-footer`}>
                <span className={`${b}__card-clients`}><UserIcon /> {getClientCount(member)} clientes</span>
                <ChevronRight />
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className={`${b}__empty`}>
          <p>No se encontraron miembros con esos filtros</p>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedMember && (
        <DetailDrawer
          member={selectedMember}
          onClose={() => setSelectedId(null)}
          onEdit={(m) => { setSelectedId(null); handleEdit(m); }}
          onToggleActive={handleToggleActive}
          onUpdated={handleStaffUpdated}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <StaffFormModal
          staff={editingStaff}
          onClose={() => { setShowForm(false); setEditingStaff(null); }}
          onSaved={handleFormSaved}
        />
      )}

      {/* Deactivation Modal (with clients) */}
      {deactivating && (
        <DeactivateModal
          member={deactivating}
          clients={getStaffClients(deactivating.name)}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => setDeactivating(null)}
        />
      )}

      {/* Simple Deactivation Confirm (no clients) */}
      {simpleDeactivating && createPortal(
        <div className={`${b}__overlay`} onClick={() => setSimpleDeactivating(null)}>
          <div className={`${b}__simple-confirm`} onClick={(e) => e.stopPropagation()}>
            <div className={`${b}__simple-confirm-icon`}>
              <ToggleIcon on={false} />
            </div>
            <h3>Desactivar a {simpleDeactivating.name}?</h3>
            <p>Este miembro no tiene clientes registrados. Se marcara como inactivo.</p>
            <div className={`${b}__simple-confirm-actions`}>
              <button className={`${b}__btn ${b}__btn--ghost`} onClick={() => setSimpleDeactivating(null)}>Cancelar</button>
              <button className={`${b}__btn ${b}__btn--warning`} onClick={handleSimpleDeactivate}>
                Si, desactivar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Team;
