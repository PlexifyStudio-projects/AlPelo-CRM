import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const BUSINESS_TYPES = [
  'Peluquería / Barbería', 'Clínica / Consultorio', 'Spa / Centro de Bienestar',
  'Restaurante / Cafetería', 'Gimnasio / Fitness', 'Academia / Educación',
  'Veterinaria', 'Centro Estético', 'Hotel / Hospedaje', 'Otro',
];

const COUNTRIES = [
  { name: 'Colombia', code: '+57', flag: '🇨🇴' },
  { name: 'México', code: '+52', flag: '🇲🇽' },
  { name: 'Argentina', code: '+54', flag: '🇦🇷' },
  { name: 'Chile', code: '+56', flag: '🇨🇱' },
  { name: 'Perú', code: '+51', flag: '🇵🇪' },
  { name: 'Ecuador', code: '+593', flag: '🇪🇨' },
  { name: 'Venezuela', code: '+58', flag: '🇻🇪' },
  { name: 'Panamá', code: '+507', flag: '🇵🇦' },
  { name: 'Costa Rica', code: '+506', flag: '🇨🇷' },
  { name: 'Guatemala', code: '+502', flag: '🇬🇹' },
  { name: 'Honduras', code: '+504', flag: '🇭🇳' },
  { name: 'El Salvador', code: '+503', flag: '🇸🇻' },
  { name: 'Nicaragua', code: '+505', flag: '🇳🇮' },
  { name: 'República Dominicana', code: '+1', flag: '🇩🇴' },
  { name: 'Cuba', code: '+53', flag: '🇨🇺' },
  { name: 'Puerto Rico', code: '+1', flag: '🇵🇷' },
  { name: 'Uruguay', code: '+598', flag: '🇺🇾' },
  { name: 'Paraguay', code: '+595', flag: '🇵🇾' },
  { name: 'Bolivia', code: '+591', flag: '🇧🇴' },
  { name: 'España', code: '+34', flag: '🇪🇸' },
  { name: 'Estados Unidos', code: '+1', flag: '🇺🇸' },
];

const SERVICE_TEMPLATES = {
  'Peluquería / Barbería': [
    { name: 'Corte Clásico', price: 25000, duration: 40, category: 'Corte', active: true },
    { name: 'Corte + Barba', price: 35000, duration: 50, category: 'Corte', active: true },
    { name: 'Barba', price: 15000, duration: 20, category: 'Barba', active: true },
    { name: 'Tinte', price: 45000, duration: 60, category: 'Color', active: true },
    { name: 'Alisado Keratina', price: 80000, duration: 90, category: 'Tratamiento', active: false },
    { name: 'Tratamiento Capilar', price: 50000, duration: 45, category: 'Tratamiento', active: false },
  ],
  'default': [
    { name: 'Consulta General', price: 50000, duration: 30, category: 'General', active: true },
    { name: 'Servicio Premium', price: 80000, duration: 60, category: 'Premium', active: true },
    { name: 'Servicio Básico', price: 30000, duration: 30, category: 'General', active: true },
  ],
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 190000,
    automations: 5,
    features: ['CRM completo — clientes ilimitados', 'Agenda y calendario visual', 'Inbox WhatsApp en tiempo real', 'Lina IA — 1,500 mensajes/mes', '5 automatizaciones activas', 'Catálogo de servicios', 'Dashboard básico', 'Soporte por email'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 390000,
    popular: true,
    automations: 12,
    features: ['Todo lo del plan Starter', 'Lina IA — 4,000 mensajes/mes', '12 automatizaciones activas', 'Finanzas y reportes avanzados', 'Comisiones automáticas', 'Programa de lealtad completo', 'Campañas WhatsApp masivas', 'Google Reviews integrado', 'Soporte prioritario'],
  },
  {
    id: 'business',
    name: 'Business',
    price: 590000,
    automations: 20,
    features: ['Todo lo del plan Pro', 'Lina IA — 7,000 mensajes/mes', '20 automatizaciones activas', 'Campañas masivas ilimitadas', 'Reportes ejecutivos avanzados', 'Multi-profesionales ilimitados', 'Soporte dedicado 24/7', 'Onboarding personalizado'],
  },
];

const AUTOMATION_GROUPS = [
  { label: 'Citas', icon: '📅', items: [
    { id: 'confirmation', name: 'Confirmación de cita', desc: 'Pide confirmación al cliente al agendar' },
    { id: 'reminder_24h', name: 'Recordatorio 24h', desc: 'WhatsApp automático 24 horas antes' },
    { id: 'reminder_1h', name: 'Recordatorio 1h', desc: 'WhatsApp automático 1 hora antes' },
    { id: 'reschedule', name: 'Reagendamiento', desc: 'Notifica al cliente si se mueve su cita' },
    { id: 'cancellation', name: 'Cancelación', desc: 'Confirma cancelación y ofrece reagendar' },
  ]},
  { label: 'Post-visita', icon: '⭐', items: [
    { id: 'post_visit_thanks', name: 'Agradecimiento', desc: 'Mensaje de gracias 2h después del servicio' },
    { id: 'rating_request', name: 'Encuesta de satisfacción', desc: 'Pide calificación 1-5 estrellas' },
    { id: 'review_google', name: 'Reseña en Google', desc: 'Si califica 4-5, pide reseña en Google' },
    { id: 'post_care_tips', name: 'Tips de cuidado', desc: 'Consejos personalizados post-servicio' },
    { id: 'suggest_next_service', name: 'Sugerir próximo servicio', desc: 'Recomienda servicio complementario' },
  ]},
  { label: 'Retención', icon: '🔄', items: [
    { id: 'reactivation_30d', name: 'Reactivación 30 días', desc: 'Mensaje a clientes inactivos +30 días' },
    { id: 'reactivation_60d', name: 'Reactivación 60 días', desc: 'Mensaje más urgente a +60 días' },
    { id: 'no_show_followup', name: 'Seguimiento no-show', desc: 'Contacta al cliente que no asistió' },
    { id: 'rebooking_cycle', name: 'Ciclo de rebooking', desc: 'Recuerda agendar según su frecuencia' },
    { id: 'winback_discount', name: 'Descuento de recuperación', desc: 'Oferta especial para clientes perdidos' },
  ]},
  { label: 'Fidelización', icon: '💎', items: [
    { id: 'welcome', name: 'Bienvenida', desc: 'Mensaje de bienvenida a clientes nuevos' },
    { id: 'birthday', name: 'Cumpleaños', desc: 'Felicitación automática + oferta especial' },
    { id: 'auto_vip', name: 'Reconocimiento VIP', desc: 'Notifica al cliente cuando sube a VIP' },
    { id: 'anniversary', name: 'Aniversario', desc: 'Celebra el aniversario como cliente' },
    { id: 'visit_milestone', name: 'Hito de visitas', desc: 'Celebra la visita #10, #25, #50...' },
  ]},
  { label: 'Operativo', icon: '📊', items: [
    { id: 'daily_summary', name: 'Resumen diario', desc: 'Resumen del día al admin por WhatsApp' },
    { id: 'noshow_alert', name: 'Alerta de no-show', desc: 'Notifica al admin cuando alguien no asiste' },
    { id: 'new_client_alert', name: 'Nuevo cliente', desc: 'Alerta al admin cuando se registra alguien' },
    { id: 'payment_reminder', name: 'Recordatorio de pago', desc: 'Recuerda pagos pendientes al cliente' },
    { id: 'digital_receipt', name: 'Recibo digital', desc: 'Envía recibo por WhatsApp al pagar' },
  ]},
];

const ALL_AUTOMATIONS = AUTOMATION_GROUPS.flatMap(g => g.items);

const STEPS = [
  { num: 1, title: 'Tu negocio', icon: '🏪' },
  { num: 2, title: 'Tu cuenta', icon: '👤' },
  { num: 3, title: 'Equipo', icon: '👥' },
  { num: 4, title: 'Plan', icon: '💎' },
  { num: 5, title: 'Automatizaciones', icon: '⚡' },
  { num: 6, title: 'Pago', icon: '💳' },
  { num: 7, title: '¡Listo!', icon: '🚀' },
];

const formatCOP = (n) => '$' + n.toLocaleString('es-CO');

export default function Register() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    businessName: '', businessType: '', country: 'Colombia', city: '', address: '', phone: '',
    ownerName: '', email: '', username: '', password: '',
    services: [],
    staff: [{ name: '', specialty: '' }],
    plan: 'pro',
    automationIds: [],
  });

  const slug = form.businessName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'tu-negocio';
  const selectedPlan = PLANS.find(p => p.id === form.plan) || PLANS[1];
  const maxAuto = selectedPlan.automations;

  const updateForm = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const currentCountry = COUNTRIES.find(c => c.name === form.country) || COUNTRIES[0];

  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhone = (e) => updateForm('phone', formatPhone(e.target.value));
  const handleCountry = (e) => { updateForm('country', e.target.value); updateForm('phone', ''); };
  const fullPhone = form.phone ? `${currentCountry.code} ${form.phone}` : '';

  const toggleService = (idx) => {
    const s = [...form.services];
    s[idx] = { ...s[idx], active: !s[idx].active };
    updateForm('services', s);
  };

  const addStaff = () => updateForm('staff', [...form.staff, { name: '', specialty: '' }]);
  const updateStaff = (idx, key, val) => {
    const s = [...form.staff];
    s[idx] = { ...s[idx], [key]: val };
    updateForm('staff', s);
  };

  const toggleAutomation = (id) => {
    const current = form.automationIds;
    if (current.includes(id)) {
      updateForm('automationIds', current.filter(x => x !== id));
    } else if (current.length < maxAuto) {
      updateForm('automationIds', [...current, id]);
    }
  };

  // Auto-load services when business type is selected (no manual step needed)
  const ensureServices = () => {
    if (form.businessType && form.services.length === 0) {
      const tpl = SERVICE_TEMPLATES[form.businessType] || SERVICE_TEMPLATES['default'];
      updateForm('services', tpl.map(s => ({ ...s, active: true })));
    }
  };

  const validateStep = () => {
    switch (step) {
      case 1: // Tu negocio
        if (!form.businessName.trim()) return 'El nombre del negocio es obligatorio';
        if (form.businessName.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
        if (!form.businessType) return 'Selecciona el tipo de negocio';
        if (!form.city.trim()) return 'La ciudad es obligatoria';
        if (!form.phone || form.phone.replace(/\D/g, '').length < 7) return 'Ingresa un número de teléfono válido';
        return null;
      case 2: // Tu cuenta
        if (!form.ownerName.trim()) return 'Tu nombre es obligatorio';
        if (form.ownerName.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
        if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Ingresa un correo electrónico válido';
        if (!form.username.trim()) return 'El nombre de usuario es obligatorio';
        if (form.username.trim().length < 3) return 'El usuario debe tener al menos 3 caracteres';
        if (/\s/.test(form.username)) return 'El usuario no puede tener espacios';
        if (!form.password) return 'La contraseña es obligatoria';
        if (form.password.length < 8) return 'La contraseña debe tener mínimo 8 caracteres';
        if (!/[A-Z]/.test(form.password)) return 'La contraseña debe tener al menos una mayúscula';
        if (!/[0-9]/.test(form.password)) return 'La contraseña debe tener al menos un número';
        return null;
      case 3: // Equipo
        const validStaff = form.staff.filter(s => s.name.trim());
        if (validStaff.length === 0) return 'Agrega al menos un profesional';
        for (const s of validStaff) {
          if (s.name.trim().length < 2) return `El nombre "${s.name}" es muy corto`;
        }
        return null;
      case 4: // Plan
        if (!form.plan) return 'Selecciona un plan';
        return null;
      case 5: // Automatizaciones
        return null; // opcional
      default:
        return null;
    }
  };

  const next = () => {
    setError('');
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    if (step === 1) ensureServices();
    setStep(s => Math.min(s + 1, 7));
  };
  const back = () => { setError(''); setStep(s => Math.max(s - 1, 1)); };

  const handlePayAndCreate = async () => {
    setError('');
    setLoading(true);

    try {
      const activeServices = form.services.filter(s => s.active).map(s => ({
        name: s.name,
        price: s.price,
        duration_minutes: s.duration,
        category: s.category || 'General',
      }));

      const validStaff = form.staff.filter(s => s.name.trim()).map(s => ({
        name: s.name.trim(),
        specialty: s.specialty || '',
      }));

      const res = await fetch(`${API}/public/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: form.businessName,
          business_type: form.businessType,
          country: form.country === 'Colombia' ? 'CO' : form.country.slice(0, 2).toUpperCase(),
          city: form.city,
          address: form.address,
          phone: fullPhone,
          owner_name: form.ownerName,
          email: form.email,
          username: form.username,
          password: form.password,
          plan: form.plan,
          services: activeServices,
          staff: validStaff,
          automation_ids: form.automationIds,
          payment_ref: 'SIM-' + Date.now(), // Simulated payment
        }),
      });

      const data = await res.json().catch(() => ({ detail: 'Error de conexión' }));

      if (!res.ok) {
        let errMsg = 'Error al crear el negocio';
        if (typeof data.detail === 'string') errMsg = data.detail;
        else if (Array.isArray(data.detail)) errMsg = data.detail.map(e => typeof e === 'string' ? e : (e.msg || JSON.stringify(e))).join('. ');
        setError(errMsg);
        setLoading(false);
        return;
      }

      // No auto-login — user logs in manually
      setResult(data);
      setStep(8);
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO title="Registrar mi negocio — PlexifyStudio" description="Registra tu negocio en PlexifyStudio CRM." url="/register" />

      <div className="reg">
        <div className="reg__container">
          {/* Left — Form */}
          <div className="reg__form-side">
            {/* Progress */}
            <div className="reg__progress">
              {STEPS.map((s) => (
                <div key={s.num} className={`reg__progress-step ${step >= s.num ? 'reg__progress-step--active' : ''} ${step === s.num ? 'reg__progress-step--current' : ''}`}>
                  <span className="reg__progress-num">{step > s.num ? '✓' : s.num}</span>
                  <span className="reg__progress-label">{s.title}</span>
                </div>
              ))}
            </div>

            {/* Step 1 — Business */}
            {step === 1 && (
              <div className="reg__step">
                <h2 className="reg__step-title">Cuéntanos sobre tu negocio</h2>
                <p className="reg__step-sub">Esta información se usará para configurar tu CRM.</p>
                <div className="reg__field">
                  <label>Nombre del negocio</label>
                  <input type="text" placeholder="Ej: Studio Barber" value={form.businessName} onChange={e => updateForm('businessName', e.target.value)} />
                  {form.businessName && <small className="reg__slug">plexify.studio/book/<strong>{slug}</strong></small>}
                </div>
                <div className="reg__field">
                  <label>Tipo de negocio</label>
                  <select value={form.businessType} onChange={e => updateForm('businessType', e.target.value)}>
                    <option value="">Selecciona una categoría</option>
                    {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="reg__row">
                  <div className="reg__field">
                    <label>País</label>
                    <select value={form.country} onChange={handleCountry}>
                      {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.flag} {c.name} ({c.code})</option>)}
                    </select>
                  </div>
                  <div className="reg__field">
                    <label>Ciudad</label>
                    <input type="text" placeholder="Ej: Bucaramanga" value={form.city} onChange={e => updateForm('city', e.target.value)} />
                  </div>
                </div>
                <div className="reg__field">
                  <label>Teléfono</label>
                  <div className="reg__phone-wrap">
                    <span className="reg__phone-prefix">{currentCountry.flag} {currentCountry.code}</span>
                    <input type="tel" placeholder="(315) 157-3329" value={form.phone} onChange={handlePhone} />
                  </div>
                </div>
                <div className="reg__field">
                  <label>Dirección</label>
                  <input type="text" placeholder="Ej: Cra 31 #50-21" value={form.address} onChange={e => updateForm('address', e.target.value)} />
                </div>
              </div>
            )}

            {/* Step 2 — Account */}
            {step === 2 && (
              <div className="reg__step">
                <h2 className="reg__step-title">Crea tu cuenta de administrador</h2>
                <p className="reg__step-sub">Con estas credenciales accederás a tu CRM.</p>
                <div className="reg__field">
                  <label>Tu nombre completo</label>
                  <input type="text" placeholder="Ej: Jaime Pérez" value={form.ownerName} onChange={e => updateForm('ownerName', e.target.value)} />
                </div>
                <div className="reg__field">
                  <label>Email</label>
                  <input type="email" placeholder="Ej: jaime@tunegocio.com" value={form.email} onChange={e => updateForm('email', e.target.value)} />
                </div>
                <div className="reg__row">
                  <div className="reg__field">
                    <label>Usuario</label>
                    <input type="text" placeholder="Ej: jaime" value={form.username} onChange={e => updateForm('username', e.target.value)} />
                  </div>
                  <div className="reg__field">
                    <label>Contraseña</label>
                    <input type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => updateForm('password', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Team */}
            {step === 3 && (
              <div className="reg__step">
                <h2 className="reg__step-title">Agrega a tu equipo</h2>
                <p className="reg__step-sub">Mínimo 1 profesional. Puedes agregar más después.</p>
                <div className="reg__staff-list">
                  {form.staff.map((s, i) => (
                    <div key={i} className="reg__staff-row">
                      <input type="text" placeholder="Nombre completo" value={s.name} onChange={e => updateStaff(i, 'name', e.target.value)} />
                      <input type="text" placeholder="Especialidad (Ej: Barbero)" value={s.specialty} onChange={e => updateStaff(i, 'specialty', e.target.value)} />
                    </div>
                  ))}
                </div>
                <button className="reg__add-staff" onClick={addStaff}>+ Agregar otro profesional</button>
              </div>
            )}

            {/* Step 4 — Plan Selection */}
            {step === 4 && (
              <div className="reg__step">
                <h2 className="reg__step-title">Elige tu plan</h2>
                <p className="reg__step-sub">Todos incluyen CRM completo + Lina IA + WhatsApp.</p>
                <div className="reg__plans">
                  {PLANS.map(plan => (
                    <div
                      key={plan.id}
                      className={`reg__plan ${form.plan === plan.id ? 'reg__plan--selected' : ''} ${plan.popular ? 'reg__plan--popular' : ''}`}
                      onClick={() => { updateForm('plan', plan.id); updateForm('automationIds', []); }}
                    >
                      {plan.popular && <span className="reg__plan-badge">Popular</span>}
                      <h3 className="reg__plan-name">{plan.name}</h3>
                      <div className="reg__plan-price">
                        <span className="reg__plan-amount">{formatCOP(plan.price)}</span>
                        <span className="reg__plan-period">/mes</span>
                      </div>
                      <ul className="reg__plan-features">
                        {plan.features.map((f, i) => <li key={i}>✓ {f}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5 — Automations */}
            {step === 5 && (
              <div className="reg__step">
                <h2 className="reg__step-title">Elige tus automatizaciones</h2>
                <p className="reg__step-sub">
                  Tu plan <strong>{selectedPlan.name}</strong> incluye{' '}
                  <strong>{maxAuto === 999 ? 'ilimitadas' : maxAuto}</strong> automatizaciones.
                  {maxAuto !== 999 && ` (${form.automationIds.length}/${maxAuto} seleccionadas)`}
                </p>

                <div className="reg__auto-groups">
                  {AUTOMATION_GROUPS.map(group => (
                    <div key={group.label} className="reg__auto-group">
                      <h3 className="reg__auto-group-title">{group.icon} {group.label}</h3>
                      <div className="reg__auto-group-items">
                        {group.items.map(auto => {
                          const selected = form.automationIds.includes(auto.id);
                          const disabled = !selected && maxAuto !== 999 && form.automationIds.length >= maxAuto;
                          return (
                            <div
                              key={auto.id}
                              className={`reg__auto-card ${selected ? 'reg__auto-card--selected' : ''} ${disabled ? 'reg__auto-card--disabled' : ''}`}
                              onClick={() => !disabled && toggleAutomation(auto.id)}
                            >
                              <div className="reg__auto-card-toggle">
                                <div className={`reg__auto-card-switch ${selected ? 'reg__auto-card-switch--on' : ''}`}>
                                  <div className="reg__auto-card-knob" />
                                </div>
                              </div>
                              <div className="reg__auto-card-text">
                                <span className="reg__auto-card-name">{auto.name}</span>
                                <span className="reg__auto-card-desc">{auto.desc}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {maxAuto !== 999 && form.automationIds.length >= maxAuto && (
                  <p className="reg__note">Has alcanzado el límite de tu plan. ¿Necesitas más? <span className="reg__note-link" onClick={() => { setStep(4); }}>Cambia de plan</span></p>
                )}
              </div>
            )}

            {/* Step 6 — Payment (Simulated) */}
            {step === 6 && (
              <div className="reg__step">
                <h2 className="reg__step-title">Confirmar y pagar</h2>
                <p className="reg__step-sub">Resumen de tu suscripción</p>

                <div className="reg__payment-summary">
                  <div className="reg__summary-row">
                    <span>Plan {selectedPlan.name}</span>
                    <strong>{formatCOP(selectedPlan.price)}/mes</strong>
                  </div>
                  <div className="reg__summary-row">
                    <span>Negocio</span>
                    <span>{form.businessName}</span>
                  </div>
                  <div className="reg__summary-row">
                    <span>Servicios</span>
                    <span>{form.services.filter(s => s.active).length} activos</span>
                  </div>
                  <div className="reg__summary-row">
                    <span>Equipo</span>
                    <span>{form.staff.filter(s => s.name.trim()).length} profesionales</span>
                  </div>
                  <div className="reg__summary-row">
                    <span>Automatizaciones</span>
                    <span>{form.automationIds.length} seleccionadas</span>
                  </div>
                  <div className="reg__summary-row reg__summary-row--total">
                    <span>Total primer mes</span>
                    <strong>{formatCOP(selectedPlan.price)}</strong>
                  </div>
                </div>

                <div className="reg__payment-card">
                  <h3 className="reg__payment-card-title">Datos de pago</h3>
                  <p className="reg__payment-card-note">Simulación — integración Wompi próximamente</p>
                  <div className="reg__field">
                    <label>Número de tarjeta</label>
                    <input type="text" placeholder="4242 4242 4242 4242" maxLength={19} />
                  </div>
                  <div className="reg__row">
                    <div className="reg__field">
                      <label>Vencimiento</label>
                      <input type="text" placeholder="MM/AA" maxLength={5} />
                    </div>
                    <div className="reg__field">
                      <label>CVV</label>
                      <input type="text" placeholder="123" maxLength={4} />
                    </div>
                  </div>
                  <div className="reg__field">
                    <label>Nombre en la tarjeta</label>
                    <input type="text" placeholder={form.ownerName || 'Nombre completo'} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 7 — Done */}
            {step === 7 && (
              <div className="reg__step reg__step--done">
                {loading ? (
                  <>
                    <div className="reg__processing">
                      <div className="reg__processing-spinner" />
                      <h2 className="reg__step-title">Procesando pago...</h2>
                      <p className="reg__step-sub">Estamos verificando tu pago y creando tu cuenta. No cierres esta ventana.</p>
                    </div>
                  </>
                ) : result ? (
                  <>
                    <span className="reg__done-icon">🎉</span>
                    <h2 className="reg__step-title">¡Pago exitoso! Tu negocio está listo.</h2>
                    <p className="reg__step-sub">Guarda tus credenciales de acceso. Las necesitarás para iniciar sesión.</p>

                    <div className="reg__credentials">
                      <div className="reg__credential-row">
                        <span className="reg__credential-label">Negocio</span>
                        <span className="reg__credential-value">{result.tenant?.name || form.businessName}</span>
                      </div>
                      <div className="reg__credential-row">
                        <span className="reg__credential-label">Plan</span>
                        <span className="reg__credential-value">{selectedPlan.name} — {formatCOP(selectedPlan.price)}/mes</span>
                      </div>
                      <div className="reg__credential-row">
                        <span className="reg__credential-label">Usuario</span>
                        <span className="reg__credential-value reg__credential-value--mono">{result.admin?.username || form.username}</span>
                        <button className="reg__copy-btn" onClick={() => { navigator.clipboard.writeText(result.admin?.username || form.username); }}>Copiar</button>
                      </div>
                      <div className="reg__credential-row">
                        <span className="reg__credential-label">Contraseña</span>
                        <span className="reg__credential-value reg__credential-value--mono">{form.password}</span>
                        <button className="reg__copy-btn" onClick={() => { navigator.clipboard.writeText(form.password); }}>Copiar</button>
                      </div>
                      <div className="reg__credential-row">
                        <span className="reg__credential-label">Email</span>
                        <span className="reg__credential-value">{form.email}</span>
                      </div>
                      <div className="reg__credential-row">
                        <span className="reg__credential-label">Reservas</span>
                        <span className="reg__credential-value reg__credential-value--mono">plexify.studio/book/{result.tenant?.slug || slug}</span>
                        <button className="reg__copy-btn" onClick={() => { navigator.clipboard.writeText(`plexify.studio/book/${result.tenant?.slug || slug}`); }}>Copiar</button>
                      </div>
                    </div>

                    <div className="reg__done-actions">
                      <button
                        className="reg__btn reg__btn--ghost"
                        onClick={() => {
                          const text = `PlexifyStudio — Credenciales de acceso\n\nNegocio: ${result.tenant?.name || form.businessName}\nPlan: ${selectedPlan.name}\nUsuario: ${result.admin?.username || form.username}\nContraseña: ${form.password}\nEmail: ${form.email}\nReservas: plexify.studio/book/${result.tenant?.slug || slug}\n`;
                          const blob = new Blob([text], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'plexify-credenciales.txt';
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        Descargar credenciales
                      </button>
                      <button
                        className="reg__btn reg__btn--primary"
                        onClick={() => { window.location.href = (import.meta.env.BASE_URL || '/') + 'login'; }}
                      >
                        Iniciar sesión →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="reg__done-icon">❌</span>
                    <h2 className="reg__step-title">Pago rechazado</h2>
                    <p className="reg__step-sub">{error || 'No se pudo procesar el pago. Verifica los datos de tu tarjeta e intenta de nuevo.'}</p>
                    <button className="reg__btn reg__btn--primary" onClick={() => setStep(6)}>
                      ← Volver a intentar
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Error */}
            {error && <div className="reg__error">{error}</div>}

            {/* Navigation */}
            {step < 6 && (
              <div className="reg__nav">
                {step > 1 && <button className="reg__btn reg__btn--ghost" onClick={back}>← Atrás</button>}
                <button className="reg__btn reg__btn--primary" onClick={next}>
                  Continuar →
                </button>
              </div>
            )}
            {step === 6 && (
              <div className="reg__nav">
                <button className="reg__btn reg__btn--ghost" onClick={back}>← Atrás</button>
                <button className="reg__btn reg__btn--primary" onClick={handlePayAndCreate} disabled={loading}>
                  {loading ? 'Procesando...' : `Pagar ${formatCOP(selectedPlan.price)} y crear negocio`}
                </button>
              </div>
            )}
          </div>

          {/* Right — Info */}
          <div className="reg__info-side">
            <div className="reg__info-content">
              <h3 className="reg__info-title">Tu negocio<br />funcionando en minutos.</h3>
              <p className="reg__info-desc">Configura tu CRM, tu página de reservas y Lina IA en un solo proceso.</p>
              <div className="reg__info-features">
                {['CRM completo desde el primer día', 'Página de reservas pública al instante', 'Lina IA responde WhatsApp automáticamente', 'Automatizaciones que trabajan por ti', 'Sin contratos ni permanencia'].map((f, i) => (
                  <div key={i} className="reg__info-feature">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="reg__info-trust">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Datos protegidos con encriptación SSL 256-bit</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
