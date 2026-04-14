import { useState, useEffect, useCallback } from 'react';
import Modal from '../../common/Modal/Modal';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import { useTenant } from '../../../context/TenantContext';

const COUNTRY_PREFIXES = {
  CO: '+57', CL: '+56', AR: '+54', PE: '+51', VE: '+58', EC: '+593',
  US: '+1', BR: '+55', MX: '+52', PA: '+507', CR: '+506', GT: '+502',
  HN: '+504', SV: '+503', NI: '+505', DO: '+1', PY: '+595', UY: '+598',
  BO: '+591', CU: '+53', PR: '+1',
};

const AddClientModal = ({ isOpen, onClose, onSave, editingClient }) => {
  const { tenant } = useTenant();
  const countryPrefix = COUNTRY_PREFIXES[tenant?.country] || '+57';

  const [form, setForm] = useState({
    client_id: '',
    name: '',
    phone: '',
    email: '',
    document_type: '',
    document_number: '',
    birthday: '',
    accepts_whatsapp: true,
    visit_code: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const b = 'add-client-modal';

  const stripPrefix = (raw) => {
    if (!raw) return '';
    const stripped = raw.replace(/[\s()\-]/g, '');
    for (const pfx of Object.values(COUNTRY_PREFIXES)) {
      if (stripped.startsWith(pfx)) return stripped.slice(pfx.length);
    }
    for (const pfx of Object.values(COUNTRY_PREFIXES)) {
      const digits = pfx.replace('+', '');
      if (stripped.startsWith(digits)) return stripped.slice(digits.length);
    }
    if (stripped.startsWith('+')) return stripped.replace(/^\+\d{1,3}/, '');
    return stripped;
  };

  useEffect(() => {
    if (editingClient) {
      setForm({
        client_id: editingClient.client_id || '',
        name: editingClient.name || '',
        phone: stripPrefix(editingClient.phone),
        email: editingClient.email || '',
        document_type: editingClient.document_type || '',
        document_number: editingClient.document_number || '',
        birthday: editingClient.birthday || '',
        accepts_whatsapp: editingClient.accepts_whatsapp ?? true,
        visit_code: editingClient.visit_code || '',
      });
    } else {
      setForm({
        client_id: '', name: '', phone: '', email: '', document_type: '', document_number: '',
        birthday: '', accepts_whatsapp: true, visit_code: '',
      });
    }
    setErrors({});
    setTouched({});
  }, [editingClient, isOpen, countryPrefix]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const digits = value.replace(/\D/g, '').slice(0, 10);
      setForm((f) => ({ ...f, phone: digits }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
    setErrors((prev) => {
      if (prev[name]) return { ...prev, [name]: '' };
      return prev;
    });
  }, []);

  const validateField = useCallback((name, value) => {
    const fieldErrors = {};
    if (name === 'name' && !value.trim()) fieldErrors.name = 'El nombre es obligatorio';
    if (name === 'phone' && !value.trim()) fieldErrors.phone = 'El telefono es obligatorio';
    if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      fieldErrors.email = 'Email invalido';
    }
    return fieldErrors;
  }, []);

  const handleBlur = useCallback((e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
    const fieldErrors = validateField(e.target.name, e.target.value);
    setErrors((prev) => ({ ...prev, ...fieldErrors }));
  }, [validateField]);

  const validate = useCallback(() => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'El nombre es obligatorio';
    if (!form.phone.trim()) newErrors.phone = 'El telefono es obligatorio';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email invalido';
    }
    return newErrors;
  }, [form]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ name: true, phone: true, email: true });
      return;
    }

    const fullPhone = countryPrefix.replace('+', '') + form.phone;
    const payload = {
      ...form,
      phone: fullPhone,
      birthday: form.birthday || null,
      email: form.email || null,
      document_type: form.document_type || null,
      document_number: form.document_number || null,
      client_id: form.client_id || null,
      visit_code: form.visit_code || null,
    };

    if (!editingClient && !payload.client_id) {
      delete payload.client_id;
    }

    onSave(payload);
    onClose();
  }, [validate, form, editingClient, onSave, onClose, countryPrefix]);

  const isFormValid = form.name.trim() && form.phone.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
      className="modal--lg"
    >
      <form className={b} onSubmit={handleSubmit} noValidate>
        <div className={`${b}__ticket-section`}>
          <label className={`${b}__ticket-label`}>Ticket / Código de visita</label>
          <input
            type="text"
            name="visit_code"
            value={form.visit_code}
            onChange={handleChange}
            placeholder="Ej: 1213"
            className={`${b}__ticket-input`}
          />
        </div>

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
            <div className={`input ${touched.phone && errors.phone ? 'input--error' : ''}`}>
              <label className="input__label">Telefono (WhatsApp)<span className="input__required"> *</span></label>
              <div className={`${b}__phone-field`}>
                <span className={`${b}__phone-prefix`}>{countryPrefix}</span>
                <input
                  className="input__field"
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={e => {
                    const el = e.target;
                    const pos = el.selectionStart;
                    const prev = form.phone;
                    handleChange(e);
                    requestAnimationFrame(() => {
                      const newLen = el.value.length;
                      const diff = newLen - prev.length;
                      const newPos = Math.max(0, pos + diff);
                      el.setSelectionRange(newPos, newPos);
                    });
                  }}
                  onBlur={handleBlur}
                  placeholder="3001234567"
                  required
                  inputMode="numeric"
                />
              </div>
              {touched.phone && errors.phone && <span className="input__error-message">{errors.phone}</span>}
            </div>
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
            <div className={`${b}__doc-group`}>
              <label className={`${b}__doc-label`}>Tipo de documento</label>
              <select name="document_type" value={form.document_type} onChange={handleChange} className={`${b}__doc-select`}>
                <option value="">Seleccionar</option>
                <option value="CC">CC - Cédula de Ciudadanía</option>
                <option value="CE">CE - Cédula de Extranjería</option>
                <option value="TI">TI - Tarjeta de Identidad</option>
                <option value="RC">RC - Registro Civil</option>
                <option value="PA">PA - Pasaporte</option>
                <option value="NIT">NIT</option>
                <option value="PEP">PEP - Permiso Especial</option>
                <option value="PPT">PPT - Permiso Protección Temporal</option>
                <option value="DIE">DIE - Doc. Identificación Extranjero</option>
                <option value="NUIP">NUIP</option>
              </select>
            </div>
            <Input
              label="Número de documento"
              name="document_number"
              value={form.document_number}
              onChange={handleChange}
              placeholder="Número de documento"
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
