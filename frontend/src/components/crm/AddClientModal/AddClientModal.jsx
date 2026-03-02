import { useState, useEffect } from 'react';
import Modal from '../../common/Modal/Modal';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import { mockServices, mockBarbers } from '../../../data/mockData';

const AddClientModal = ({ isOpen, onClose, onSave, editingClient }) => {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    birthday: '',
    gender: '',
    source: '',
    favoriteService: '',
    preferredBarber: '',
    haircutStyleNotes: '',
    beardStyleNotes: '',
    notes: '',
    acceptsWhatsApp: true,
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const b = 'add-client-modal';

  useEffect(() => {
    if (editingClient) {
      setForm({
        name: editingClient.name || '',
        phone: editingClient.phone || '',
        email: editingClient.email || '',
        birthday: editingClient.birthday || '',
        gender: editingClient.gender || '',
        source: editingClient.source || '',
        favoriteService: editingClient.favoriteService || '',
        preferredBarber: editingClient.preferredBarber || '',
        haircutStyleNotes: editingClient.haircutStyleNotes || '',
        beardStyleNotes: editingClient.beardStyleNotes || '',
        notes: editingClient.notes || '',
        acceptsWhatsApp: editingClient.acceptsWhatsApp ?? true,
      });
    } else {
      setForm({
        name: '', phone: '', email: '', birthday: '', gender: '', source: '',
        favoriteService: '', preferredBarber: '', haircutStyleNotes: '', beardStyleNotes: '',
        notes: '', acceptsWhatsApp: true,
      });
    }
    setErrors({});
    setTouched({});
  }, [editingClient, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleBlur = (e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
    const fieldErrors = validateField(e.target.name, e.target.value);
    setErrors((prev) => ({ ...prev, ...fieldErrors }));
  };

  const validateField = (name, value) => {
    const fieldErrors = {};
    if (name === 'name' && !value.trim()) fieldErrors.name = 'El nombre es obligatorio';
    if (name === 'phone' && !value.trim()) fieldErrors.phone = 'El teléfono es obligatorio';
    if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      fieldErrors.email = 'Email inválido';
    }
    return fieldErrors;
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'El nombre es obligatorio';
    if (!form.phone.trim()) newErrors.phone = 'El teléfono es obligatorio';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email inválido';
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ name: true, phone: true, email: true });
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    onSave({
      ...editingClient,
      ...form,
      preferredBarber: form.preferredBarber ? Number(form.preferredBarber) : null,
      id: editingClient?.id || Date.now(),
      totalVisits: editingClient?.totalVisits || 0,
      totalSpent: editingClient?.totalSpent || 0,
      lastVisit: editingClient?.lastVisit || today,
      firstVisit: editingClient?.firstVisit || today,
      noShowCount: editingClient?.noShowCount || 0,
      cancellationCount: editingClient?.cancellationCount || 0,
      loyaltyPoints: editingClient?.loyaltyPoints || 0,
      tags: editingClient?.tags || [],
      avatar: null,
    });
    onClose();
  };

  const isFormValid = form.name.trim() && form.phone.trim();

  const genderOptions = [
    { val: 'M', lbl: 'Masculino' },
    { val: 'F', lbl: 'Femenino' },
    { val: 'NB', lbl: 'No binario' },
  ];

  const sourceOptions = ['Instagram', 'Referido', 'Google Maps', 'Pasó por aquí', 'TikTok'];

  const barberOptions = mockBarbers.filter((barber) => barber.available);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
      className="modal--lg"
    >
      <form className={b} onSubmit={handleSubmit} noValidate>
        {/* Section 1: Personal data */}
        <div className={`${b}__section`}>
          <h4 className={`${b}__section-label`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Datos personales
          </h4>
          <div className={`${b}__grid`}>
            <Input
              label="Nombre completo"
              name="name"
              value={form.name}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Nombre del cliente"
              error={touched.name ? errors.name : ''}
              required
            />
            <Input
              label="Teléfono (WhatsApp)"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="+57 300 123 4567"
              error={touched.phone ? errors.phone : ''}
              required
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="correo@email.com"
              error={touched.email ? errors.email : ''}
            />
            <Input
              label="Cumpleaños"
              name="birthday"
              type="date"
              value={form.birthday}
              onChange={handleChange}
            />
          </div>
          <div className={`${b}__gender-group`}>
            <label className={`${b}__label`}>Género</label>
            <div className={`${b}__radio-row`}>
              {genderOptions.map((opt) => (
                <label
                  key={opt.val}
                  className={`${b}__radio-option ${form.gender === opt.val ? `${b}__radio-option--selected` : ''}`}
                >
                  <input type="radio" name="gender" value={opt.val} checked={form.gender === opt.val} onChange={handleChange} />
                  {opt.lbl}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Origin & Preferences */}
        <div className={`${b}__section`}>
          <h4 className={`${b}__section-label`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
            </svg>
            Origen y preferencias
          </h4>
          <div className={`${b}__grid`}>
            <div className={`${b}__select-group`}>
              <label className={`${b}__label`}>¿Cómo nos conoció?</label>
              <select
                className={`${b}__select`}
                name="source"
                value={form.source}
                onChange={handleChange}
              >
                <option value="">Seleccionar...</option>
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className={`${b}__select-group`}>
              <label className={`${b}__label`}>Servicio favorito</label>
              <select
                className={`${b}__select`}
                name="favoriteService"
                value={form.favoriteService}
                onChange={handleChange}
              >
                <option value="">Seleccionar servicio...</option>
                {mockServices.map((s) => (
                  <option key={s.id} value={s.name}>{s.name} - ${s.price.toLocaleString('es-CO')}</option>
                ))}
              </select>
            </div>
            <div className={`${b}__select-group`}>
              <label className={`${b}__label`}>Barbero preferido</label>
              <select
                className={`${b}__select`}
                name="preferredBarber"
                value={form.preferredBarber}
                onChange={handleChange}
              >
                <option value="">Sin preferencia</option>
                {barberOptions.map((br) => (
                  <option key={br.id} value={br.id}>{br.name} - {br.specialty}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={`${b}__grid`}>
            <div className={`${b}__textarea-group`}>
              <label className={`${b}__label`}>Estilo de corte</label>
              <textarea
                className={`${b}__textarea ${b}__textarea--sm`}
                name="haircutStyleNotes"
                value={form.haircutStyleNotes}
                onChange={handleChange}
                placeholder="Ej: Degradado alto, textura arriba..."
                rows={2}
              />
            </div>
            <div className={`${b}__textarea-group`}>
              <label className={`${b}__label`}>Estilo de barba</label>
              <textarea
                className={`${b}__textarea ${b}__textarea--sm`}
                name="beardStyleNotes"
                value={form.beardStyleNotes}
                onChange={handleChange}
                placeholder="Ej: Barba delineada, bordes definidos..."
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Notes & Consent */}
        <div className={`${b}__section`}>
          <h4 className={`${b}__section-label`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Notas y consentimiento
          </h4>
          <div className={`${b}__textarea-group`}>
            <label className={`${b}__label`}>Notas internas</label>
            <textarea
              className={`${b}__textarea`}
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Preferencias, alergias, observaciones..."
              rows={3}
            />
          </div>
          <div className={`${b}__toggle-row`}>
            <label className={`${b}__toggle-label`}>
              Acepta mensajes de WhatsApp
            </label>
            <button
              type="button"
              className={`${b}__toggle ${form.acceptsWhatsApp ? `${b}__toggle--on` : ''}`}
              onClick={() => setForm((f) => ({ ...f, acceptsWhatsApp: !f.acceptsWhatsApp }))}
              aria-pressed={form.acceptsWhatsApp}
            >
              <span className={`${b}__toggle-thumb`} />
            </button>
          </div>
        </div>

        <div className={`${b}__actions`}>
          <Button variant="ghost" size="md" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" size="md" type="submit" disabled={!isFormValid}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {editingClient ? 'Guardar Cambios' : 'Agregar Cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddClientModal;
