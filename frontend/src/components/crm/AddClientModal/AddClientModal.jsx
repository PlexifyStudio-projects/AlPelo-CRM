import { useState, useEffect } from 'react';
import Modal from '../../common/Modal/Modal';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import { mockServices, mockBarbers } from '../../../data/mockData';

const AddClientModal = ({ isOpen, onClose, onSave, editingClient }) => {
  const [form, setForm] = useState({
    client_id: '',
    name: '',
    phone: '',
    email: '',
    birthday: '',
    favorite_service: '',
    preferred_barber_id: '',
    accepts_whatsapp: true,
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const b = 'add-client-modal';

  useEffect(() => {
    if (editingClient) {
      setForm({
        client_id: editingClient.client_id || '',
        name: editingClient.name || '',
        phone: editingClient.phone || '',
        email: editingClient.email || '',
        birthday: editingClient.birthday || '',
        favorite_service: editingClient.favorite_service || '',
        preferred_barber_id: editingClient.preferred_barber_id || '',
        accepts_whatsapp: editingClient.accepts_whatsapp ?? true,
      });
    } else {
      setForm({
        client_id: '', name: '', phone: '', email: '', birthday: '',
        favorite_service: '', preferred_barber_id: '', accepts_whatsapp: true,
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
    if (name === 'client_id' && !value.trim()) fieldErrors.client_id = 'El ID es obligatorio';
    if (name === 'name' && !value.trim()) fieldErrors.name = 'El nombre es obligatorio';
    if (name === 'phone' && !value.trim()) fieldErrors.phone = 'El teléfono es obligatorio';
    if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      fieldErrors.email = 'Email inválido';
    }
    return fieldErrors;
  };

  const validate = () => {
    const newErrors = {};
    if (!form.client_id.trim()) newErrors.client_id = 'El ID es obligatorio (ej: M20201)';
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
      setTouched({ client_id: true, name: true, phone: true, email: true });
      return;
    }

    const payload = {
      ...form,
      preferred_barber_id: form.preferred_barber_id ? Number(form.preferred_barber_id) : null,
      birthday: form.birthday || null,
      email: form.email || null,
      favorite_service: form.favorite_service || null,
    };

    // When editing, don't send client_id (it's immutable)
    if (editingClient) {
      delete payload.client_id;
    }

    onSave(payload);
    onClose();
  };

  const isFormValid = form.client_id.trim() && form.name.trim() && form.phone.trim();

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
              label="ID del cliente"
              name="client_id"
              value={form.client_id}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="M20201"
              error={touched.client_id ? errors.client_id : ''}
              required
              disabled={!!editingClient}
            />
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
        </div>

        {/* Section 2: Preferences */}
        <div className={`${b}__section`}>
          <h4 className={`${b}__section-label`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
            </svg>
            Preferencias
          </h4>
          <div className={`${b}__grid`}>
            <div className={`${b}__select-group`}>
              <label className={`${b}__label`}>Servicio favorito</label>
              <select
                className={`${b}__select`}
                name="favorite_service"
                value={form.favorite_service}
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
                name="preferred_barber_id"
                value={form.preferred_barber_id}
                onChange={handleChange}
              >
                <option value="">Sin preferencia</option>
                {barberOptions.map((br) => (
                  <option key={br.id} value={br.id}>{br.name} - {br.specialty}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Consent */}
        <div className={`${b}__section`}>
          <div className={`${b}__toggle-row`}>
            <label className={`${b}__toggle-label`}>
              Acepta mensajes de WhatsApp
            </label>
            <button
              type="button"
              className={`${b}__toggle ${form.accepts_whatsapp ? `${b}__toggle--on` : ''}`}
              onClick={() => setForm((f) => ({ ...f, accepts_whatsapp: !f.accepts_whatsapp }))}
              aria-pressed={form.accepts_whatsapp}
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
