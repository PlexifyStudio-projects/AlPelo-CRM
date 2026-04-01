import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import staffService from '../../services/staffService';
import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';

const b = 'team';


const DEFAULT_ROLES = ['Todos'];


const AVATAR_COLORS = [
  '#E05292', '#3B82F6', '#F97316', '#8B5CF6', '#14B8A6',
  '#EF4444', '#22B07E', '#C9A84C', '#06B6D4', '#D946EF',
  '#6366F1', '#84CC16', '#EC4899', '#0EA5E9', '#F59E0B',
  '#10B981', '#7C3AED', '#FB923C', '#2563EB', '#E11D48',
  '#059669', '#9333EA', '#DC2626', '#0891B2', '#CA8A04',
  '#4F46E5',
];
const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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


const WhatsAppIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
const CheckIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;

const getStaffClients = () => [];

const DeactivateModal = ({ member, clients, onConfirm, onCancel, tenantName, bookingUrl }) => {
  const [selected, setSelected] = useState(() => new Set(clients.map((c) => c.id)));
  const bookingLink = bookingUrl ? ` Agenda aqui: ${bookingUrl}` : '';
  const [template, setTemplate] = useState(
    `Hola {{nombre}}, soy Lina de ${tenantName}. Queremos informarte que ${member.name} no estara disponible por el momento. Pero no te preocupes, tenemos un equipo increible listo para atenderte con la misma calidad de siempre. Como gesto especial, en tu proxima visita tienes un *10% de descuento*.${bookingLink}`
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
            ? <>Selecciona los clientes a notificar para retenerlos</>
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


const LockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const EyeOffIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;

const StaffFormModal = ({ staff, onClose, onSaved, roles }) => {
  const isEdit = !!staff;
  const PRESET_COLORS = ['#2D5A3D', '#3B82F6', '#E05292', '#C9A84C', '#8B5CF6', '#F97316', '#14B8A6', '#EC4899', '#06B6D4', '#EF4444', '#22B07E', '#6366F1', '#D946EF', '#0EA5E9', '#84CC16'];
  const editableRoles = (roles || DEFAULT_ROLES).filter(r => r !== 'Todos');
  const [form, setForm] = useState({
    name: staff?.name || '', phone: staff?.phone || '', email: staff?.email || '',
    role: staff?.role || editableRoles[0] || 'Profesional', specialty: staff?.specialty || '', bio: staff?.bio || '',
    hire_date: staff?.hire_date || '', skills: staff?.skills?.join(', ') || '',
    color: staff?.color || '', photo_url: staff?.photo_url || null,
    username: staff?.username || '', password: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); if (error) setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    if (!isEdit && form.username.trim() && form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres'); return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null,
        role: form.role, specialty: form.specialty.trim() || null, bio: form.bio.trim() || null,
        hire_date: form.hire_date || null,
        skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
        color: form.color || null,
      };
      // Include credentials
      if (form.username.trim()) data.username = form.username.trim();
      if (form.password) data.password = form.password;
      let savedStaff;
      if (isEdit) { savedStaff = await staffService.update(staff.id, data); }
      else { savedStaff = await staffService.create(data); }
      if (photoFile && savedStaff?.id) {
        try { await staffService.uploadPhoto(savedStaff.id, photoFile); } catch {}
      }
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
        <form onSubmit={handleSubmit}>
          <div className={`${b}__form-body`}>
            {/* Section: Informacion personal */}
            <div className={`${b}__form-section`}>
              <div className={`${b}__form-section-title`}>
                <UserIcon /> Informacion personal
              </div>
              <div className={`${b}__form-section-fields`}>
                <div className={`${b}__form-row`}>
                  <div className={`${b}__form-field`}>
                    <label>Nombre completo *</label>
                    <input name="name" value={form.name} onChange={handleChange} placeholder="Ej: Juan Perez" required />
                  </div>
                  <div className={`${b}__form-field`}>
                    <label>Rol en el equipo</label>
                    <select name="role" value={editableRoles.includes(form.role) ? form.role : '__custom__'} onChange={e => {
                      if (e.target.value === '__custom__') {
                        setForm({ ...form, role: '' });
                      } else {
                        setForm({ ...form, role: e.target.value });
                      }
                    }}>
                      {editableRoles.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="__custom__">+ Crear nueva categoria...</option>
                    </select>
                    {(!editableRoles.includes(form.role) || form.role === '') && (
                      <input
                        name="role"
                        value={form.role}
                        onChange={handleChange}
                        placeholder="Escribe el nombre de la nueva categoria..."
                        autoFocus
                        style={{ marginTop: '8px' }}
                      />
                    )}
                  </div>
                </div>
                <div className={`${b}__form-row`}>
                  <div className={`${b}__form-field`}>
                    <label>Telefono</label>
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="+57 3XX XXX XXXX" />
                  </div>
                  <div className={`${b}__form-field`}>
                    <label>Email</label>
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="correo@ejemplo.com" />
                  </div>
                </div>
                <div className={`${b}__form-row`}>
                  <div className={`${b}__form-field`}>
                    <label>Foto de perfil</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {(photoFile || form.photo_url) && (
                        <img src={photoFile ? URL.createObjectURL(photoFile) : form.photo_url} alt="preview" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb' }} />
                      )}
                      <input type="file" accept="image/*" onChange={e => { if (e.target.files[0]) setPhotoFile(e.target.files[0]); }} style={{ fontSize: '0.85rem' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Acceso a la plataforma */}
            <div className={`${b}__form-section`}>
              <div className={`${b}__form-section-title`}>
                <LockIcon /> Acceso a la plataforma
              </div>
              <div className={`${b}__form-section-fields`}>
                <div className={`${b}__form-row`}>
                  <div className={`${b}__form-field`}>
                    <label>Usuario de acceso</label>
                    <input name="username" value={form.username} onChange={handleChange} placeholder="nombre.usuario" autoComplete="off" />
                  </div>
                  <div className={`${b}__form-field`}>
                    <label>{isEdit ? 'Nueva contraseña' : 'Contraseña'}</label>
                    <div className={`${b}__password-wrap`}>
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={handleChange}
                        placeholder={isEdit ? 'Dejar vacio para mantener' : 'Min. 6 caracteres'}
                        autoComplete="new-password"
                      />
                      <button type="button" className={`${b}__eye-btn`} onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Perfil profesional */}
            <div className={`${b}__form-section`}>
              <div className={`${b}__form-section-title`}>
                <StarIcon filled={false} /> Perfil profesional
              </div>
              <div className={`${b}__form-section-fields`}>
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
                  <label>Habilidades</label>
                  <input name="skills" value={form.skills} onChange={handleChange} placeholder="Separadas por coma: Degradados, Cortes clasicos" />
                </div>
                <div className={`${b}__form-row`}>
                  <div className={`${b}__form-field`}>
                    <label>Color en agenda</label>
                    <div className={`${b}__color-picker`}>
                      {PRESET_COLORS.map(c => (
                        <button key={c} type="button"
                          className={`${b}__color-swatch ${form.color === c ? `${b}__color-swatch--on` : ''}`}
                          style={{ background: c }}
                          onClick={() => setForm({ ...form, color: c })}
                          title={c} />
                      ))}
                      <input type="color" value={form.color || '#2D5A3D'} onChange={e => setForm({ ...form, color: e.target.value })}
                        className={`${b}__color-input`} title="Color personalizado" />
                    </div>
                  </div>
                </div>
                <div className={`${b}__form-field`}>
                  <label>Biografia</label>
                  <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} placeholder="Breve descripcion del profesional..." />
                </div>
              </div>
            </div>

            {error && <div className={`${b}__form-error`}>{error}</div>}
          </div>

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


const CopyIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
const KeyIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>;

const CredentialEditor = ({ member, onUpdated }) => {
  const { addNotification } = useNotification();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(member.username || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      addNotification('Copiado al portapapeles', 'success');
    }).catch(() => {});
  };

  const handleSave = async () => {
    if (!username.trim()) return;
    if (password.length < 6) { addNotification('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
    setSaving(true);
    try {
      await staffService.updateCredentials(member.id, { username: username.trim(), password });
      addNotification('Credenciales actualizadas', 'success');
      setEditing(false);
      setPassword('');
      if (onUpdated) onUpdated({ ...member, username: username.trim() });
    } catch (err) { addNotification(err.message, 'error'); }
    finally { setSaving(false); }
  };

  if (!editing) {
    return (
      <div className={`${b}__creds`}>
        {member.username ? (
          <>
            <div className={`${b}__creds-card`}>
              <div className={`${b}__creds-row`}>
                <div className={`${b}__creds-label`}><UserIcon /> Usuario</div>
                <div className={`${b}__creds-value`}>
                  <strong>{member.username}</strong>
                  <button className={`${b}__creds-copy`} onClick={() => copyToClipboard(member.username)} title="Copiar"><CopyIcon /></button>
                </div>
              </div>
              <div className={`${b}__creds-row`}>
                <div className={`${b}__creds-label`}><KeyIcon /> Contraseña</div>
                <div className={`${b}__creds-value`}>
                  <span className={`${b}__creds-masked`}>••••••••</span>
                </div>
              </div>
            </div>
            <button className={`${b}__btn ${b}__btn--outline-sm`} onClick={() => { setEditing(true); setUsername(member.username || ''); }}>
              <EditIcon /> Cambiar credenciales
            </button>
          </>
        ) : (
          <div className={`${b}__creds-empty`}>
            <LockIcon />
            <div>
              <span className={`${b}__creds-empty-title`}>Sin acceso configurado</span>
              <span className={`${b}__creds-empty-desc`}>Este miembro no puede iniciar sesion en la plataforma</span>
            </div>
            <button className={`${b}__btn ${b}__btn--primary-sm`} onClick={() => setEditing(true)}>
              Configurar acceso
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${b}__creds-edit`}>
      <div className={`${b}__creds-edit-header`}>
        <LockIcon /> {member.username ? 'Cambiar credenciales' : 'Configurar acceso'}
      </div>
      <div className={`${b}__creds-field`}>
        <label>Usuario de acceso</label>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="nombre.usuario" />
      </div>
      <div className={`${b}__creds-field`}>
        <label>{member.username ? 'Nueva contraseña' : 'Contraseña'}</label>
        <div className={`${b}__password-wrap`}>
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min. 6 caracteres"
          />
          <button type="button" className={`${b}__eye-btn`} onClick={() => setShowPw(!showPw)}>
            {showPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>
      <div className={`${b}__creds-actions`}>
        <button className={`${b}__btn ${b}__btn--ghost`} onClick={() => { setEditing(false); setPassword(''); }}>Cancelar</button>
        <button className={`${b}__btn ${b}__btn--primary`} onClick={handleSave} disabled={saving || !username.trim() || password.length < 6}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
};

// ===== SCHEDULE EDITOR =====
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;

const DAY_NAMES = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const _API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const DEFAULT_SCHEDULE = DAY_NAMES.map((_, i) => ({
  day_of_week: i,
  start_time: '08:00',
  end_time: '18:00',
  break_start: '12:00',
  break_end: '13:00',
  is_working: i < 6,
}));

const ScheduleEditor = ({ staffId }) => {
  const { addNotification } = useNotification();
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [daysOff, setDaysOff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDayOff, setNewDayOff] = useState({ date: '', reason: '' });
  const [addingDayOff, setAddingDayOff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [schedRes, daysRes] = await Promise.all([
          fetch(`${_API}/staff/${staffId}/schedule`, { credentials: 'include' }),
          fetch(`${_API}/staff/${staffId}/days-off`, { credentials: 'include' }),
        ]);
        if (!cancelled) {
          if (schedRes.ok) {
            const data = await schedRes.json();
            if (data.schedule && data.schedule.length === 7) setSchedule(data.schedule);
          }
          if (daysRes.ok) {
            const data = await daysRes.json();
            setDaysOff(Array.isArray(data) ? data : []);
          }
        }
      } catch { /* silently use defaults */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [staffId]);

  const updateDay = (idx, field, value) => {
    setSchedule(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${_API}/staff/${staffId}/schedule`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      if (!res.ok) throw new Error('Error al guardar horario');
      addNotification('Horario guardado', 'success');
    } catch (err) { addNotification(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleAddDayOff = async () => {
    if (!newDayOff.date) return;
    setAddingDayOff(true);
    try {
      const res = await fetch(`${_API}/staff/${staffId}/days-off`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDayOff),
      });
      if (!res.ok) throw new Error('Error al agregar dia libre');
      const created = await res.json();
      setDaysOff(prev => [...prev, created]);
      setNewDayOff({ date: '', reason: '' });
      addNotification('Dia libre agregado', 'success');
    } catch (err) { addNotification(err.message, 'error'); }
    finally { setAddingDayOff(false); }
  };

  const handleDeleteDayOff = async (id) => {
    try {
      const res = await fetch(`${_API}/staff/${staffId}/days-off/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al eliminar dia libre');
      setDaysOff(prev => prev.filter(d => d.id !== id));
      addNotification('Dia libre eliminado', 'success');
    } catch (err) { addNotification(err.message, 'error'); }
  };

  if (loading) return <p className={`${b}__sched-loading`}>Cargando horario...</p>;

  return (
    <div className={`${b}__sched`}>
      {/* Weekly schedule grid */}
      <div className={`${b}__sched-grid`}>
        <div className={`${b}__sched-header`}>
          <span className={`${b}__sched-hcol ${b}__sched-hcol--day`}>Dia</span>
          <span className={`${b}__sched-hcol`}>Entrada</span>
          <span className={`${b}__sched-hcol`}>Salida</span>
          <span className={`${b}__sched-hcol`}>Inicio descanso</span>
          <span className={`${b}__sched-hcol`}>Fin descanso</span>
        </div>
        {schedule.map((day, idx) => (
          <div key={idx} className={`${b}__sched-row ${!day.is_working ? `${b}__sched-row--off` : ''}`}>
            <div className={`${b}__sched-day`}>
              <button
                type="button"
                className={`${b}__sched-toggle`}
                onClick={() => updateDay(idx, 'is_working', !day.is_working)}
                title={day.is_working ? 'Desactivar dia' : 'Activar dia'}
              >
                <ToggleIcon on={day.is_working} />
              </button>
              <span className={`${b}__sched-day-name`}>{DAY_NAMES[idx]}</span>
            </div>
            <input
              type="time"
              className={`${b}__sched-time`}
              value={day.start_time || ''}
              onChange={(e) => updateDay(idx, 'start_time', e.target.value)}
              disabled={!day.is_working}
            />
            <input
              type="time"
              className={`${b}__sched-time`}
              value={day.end_time || ''}
              onChange={(e) => updateDay(idx, 'end_time', e.target.value)}
              disabled={!day.is_working}
            />
            <input
              type="time"
              className={`${b}__sched-time`}
              value={day.break_start || ''}
              onChange={(e) => updateDay(idx, 'break_start', e.target.value)}
              disabled={!day.is_working}
            />
            <input
              type="time"
              className={`${b}__sched-time`}
              value={day.break_end || ''}
              onChange={(e) => updateDay(idx, 'break_end', e.target.value)}
              disabled={!day.is_working}
            />
          </div>
        ))}
      </div>

      <button
        className={`${b}__btn ${b}__btn--success`}
        onClick={handleSaveSchedule}
        disabled={saving}
      >
        {saving ? 'Guardando...' : 'Guardar Horario'}
      </button>

      {/* Days off section */}
      <div className={`${b}__daysoff`}>
        <h5 className={`${b}__daysoff-title`}>
          <CalendarIcon /> Dias Libres
          <span className={`${b}__drawer-section-badge`}>{daysOff.length}</span>
        </h5>

        {daysOff.length > 0 ? (
          <div className={`${b}__daysoff-list`}>
            {daysOff.map((d) => (
              <div key={d.id} className={`${b}__daysoff-item`}>
                <div className={`${b}__daysoff-info`}>
                  <span className={`${b}__daysoff-date`}>{formatDate(d.date)}</span>
                  {d.reason && <span className={`${b}__daysoff-reason`}>{d.reason}</span>}
                </div>
                <button
                  className={`${b}__daysoff-delete`}
                  onClick={() => handleDeleteDayOff(d.id)}
                  title="Eliminar"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={`${b}__daysoff-empty`}>Sin dias libres programados</p>
        )}

        <div className={`${b}__daysoff-add`}>
          <input
            type="date"
            className={`${b}__daysoff-input`}
            value={newDayOff.date}
            onChange={(e) => setNewDayOff(prev => ({ ...prev, date: e.target.value }))}
          />
          <input
            type="text"
            className={`${b}__daysoff-input ${b}__daysoff-input--reason`}
            placeholder="Motivo (opcional)"
            value={newDayOff.reason}
            onChange={(e) => setNewDayOff(prev => ({ ...prev, reason: e.target.value }))}
          />
          <button
            className={`${b}__btn ${b}__btn--primary-sm`}
            onClick={handleAddDayOff}
            disabled={!newDayOff.date || addingDayOff}
          >
            {addingDayOff ? '...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
};

const DetailDrawer = ({ member, onClose, onEdit, onToggleActive, onUpdated }) => {
  const [clientHistory, setClientHistory] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    if (!member?.id) return;
    const loadClients = async () => {
      try {
        const res = await fetch(`${_API}/staff/${member.id}/clients-attended`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setClientHistory(data.clients || []);
          setTotalRevenue(data.total_revenue || 0);
        }
      } catch {}
    };
    loadClients();
  }, [member?.id]);

  return createPortal(
    <div className={`${b}__drawer-overlay`} onClick={onClose}>
      <div className={`${b}__drawer`} onClick={(e) => e.stopPropagation()}>
        {/* Header with photo */}
        <div className={`${b}__drawer-hero`}>
          <button className={`${b}__drawer-close`} onClick={onClose}><XIcon size={18} /></button>
          <div className={`${b}__drawer-avatar`} style={{ background: member.photo_url ? 'transparent' : getAvatarColor(member.name) }}>
            {member.photo_url ? <img src={member.photo_url} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : <span>{getInitials(member.name)}</span>}
            <span className={`${b}__drawer-dot ${member.is_active ? `${b}__drawer-dot--on` : `${b}__drawer-dot--off`}`} />
          </div>
          <h2 className={`${b}__drawer-name`}>{member.name}</h2>
          <p className={`${b}__drawer-role`}>{member.specialty || member.role}</p>
          {member.rating && (
            <div className={`${b}__drawer-rating`}>
              <StarIcon filled /> {member.rating.toFixed(1)}
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
            <span className={`${b}__drawer-stat-value`}>{clientHistory.reduce((sum, c) => sum + (c.totalVisits || 0), 0)}</span>
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

        {/* Credentials section */}
        <div className={`${b}__drawer-section`}>
          <h4 className={`${b}__drawer-section-title`}>Acceso a la plataforma</h4>
          <CredentialEditor member={member} onUpdated={onUpdated} />
        </div>

        {/* Skills section */}
        <div className={`${b}__drawer-section`}>
          <h4 className={`${b}__drawer-section-title`}>Habilidades</h4>
          <SkillEditor staff={member} onUpdated={onUpdated} />
        </div>

        {/* Schedule section */}
        <div className={`${b}__drawer-section`}>
          <h4 className={`${b}__drawer-section-title`}>
            <ClockIcon /> Horario
          </h4>
          <ScheduleEditor staffId={member.id} />
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


const Team = () => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();
  const [staff, setStaff] = useState([]);
  // Build roles dynamically from staff data, with tenant overrides
  const ROLES = useMemo(() => {
    if (tenant.staff_roles && tenant.staff_roles.length > 0) {
      return ['Todos', ...tenant.staff_roles];
    }
    const rolesFromStaff = [...new Set(staff.map(s => s.role).filter(Boolean))];
    return ['Todos', ...rolesFromStaff];
  }, [tenant.staff_roles, staff]);
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
  }, [staff, ROLES]);

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
      const roleText = 'nuestros profesionales';
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
            { from: 'business', text: `Claro que si, ${firstName}! El 10% aplica en cualquier servicio. Te recomiendo a ${roleText} disponibles.${tenant.booking_url ? ` Agenda aqui y listo: ${tenant.booking_url}` : ''}`, time: t3.toISOString() },
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

  const getClientCount = (member) => member?.client_count || 0;

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

      {/* Admin Users Section */}
      <AdminsPanel />

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
          const rating = member.rating;
          const isSelected = selectedId === member.id;
          return (
            <div
              key={member.id}
              className={`${b}__card ${isSelected ? `${b}__card--selected` : ''} ${!member.is_active ? `${b}__card--inactive` : ''}`}
              style={{ animationDelay: `${0.03 * (i + 1)}s` }}
              onClick={() => setSelectedId(isSelected ? null : member.id)}
            >
              <div className={`${b}__card-photo`} style={{ background: member.photo_url ? 'transparent' : getAvatarColor(member.name) }}>
                {member.photo_url ? <img src={member.photo_url} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : <span className={`${b}__card-initials`}>{getInitials(member.name)}</span>}
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
          roles={ROLES}
        />
      )}

      {/* Deactivation Modal (with clients) */}
      {deactivating && (
        <DeactivateModal
          member={deactivating}
          clients={getStaffClients(deactivating.name)}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => setDeactivating(null)}
          tenantName={tenant.name}
          bookingUrl={tenant.booking_url}
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


const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

function AdminsPanel() {
  const [admins, setAdmins] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { addNotification } = useNotification();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/users`, { credentials: 'include' });
      if (res.ok) setAdmins(await res.json());
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setError('');
    if (!form.name || !form.username || !form.password || !form.email) {
      setError('Todos los campos son requeridos');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/auth/users`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        addNotification('Administrador creado exitosamente', 'success');
        setForm({ name: '', email: '', username: '', password: '', phone: '' });
        setShowAdd(false);
        load();
      } else {
        const err = await res.json();
        setError(err.detail || 'Error al crear');
      }
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const handleDeactivate = async (id, name) => {
    if (!window.confirm(`¿Desactivar a ${name}?`)) return;
    try {
      const res = await fetch(`${API_URL}/auth/users/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { addNotification(`${name} desactivado`, 'success'); load(); }
    } catch {}
  };

  if (admins.length === 0) return null;

  return (
    <div className={`${b}__admins`}>
      <div className={`${b}__admins-header`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
          <path d="M20 8v6" /><path d="M23 11h-6" />
        </svg>
        <h3>Administradores</h3>
        <span className={`${b}__admins-count`}>{admins.length}</span>
        <button className={`${b}__admins-add`} onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancelar' : '+ Agregar admin'}
        </button>
      </div>

      {showAdd && (
        <div className={`${b}__admins-form`}>
          <div className={`${b}__admins-form-grid`}>
            <input placeholder="Nombre completo" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input placeholder="Correo electrónico" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <input placeholder="Usuario" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
            <input placeholder="Contraseña (mín 6 chars)" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            <input placeholder="Teléfono (opcional)" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          </div>
          {error && <p className={`${b}__admins-error`}>{error}</p>}
          <button className={`${b}__btn ${b}__btn--primary`} onClick={handleCreate} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Creando...' : 'Crear administrador'}
          </button>
        </div>
      )}

      <div className={`${b}__admins-list`}>
        {admins.map(a => (
          <div key={a.id} className={`${b}__admins-item`}>
            <div className={`${b}__admins-avatar`}>{(a.name || 'A').charAt(0).toUpperCase()}</div>
            <div className={`${b}__admins-info`}>
              <strong>{a.name}</strong>
              <span>{a.username} · {a.email}</span>
            </div>
            <span className={`${b}__admins-role`}>{a.role}</span>
            <button className={`${b}__admins-deactivate`} onClick={() => handleDeactivate(a.id, a.name)} title="Desactivar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Team;
