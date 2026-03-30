import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const BUSINESS_TYPES = [
  'Peluquería / Barbería', 'Spa / Centro de Bienestar', 'Centro Estético',
  'Clínica / Consultorio', 'Odontología', 'Fisioterapia / Rehabilitación',
  'Psicología / Terapia', 'Veterinaria', 'Nutrición / Dietética',
  'Gimnasio / Fitness', 'Academia / Educación', 'Estudio de Yoga / Pilates',
  'Restaurante / Cafetería', 'Hotel / Hospedaje',
  'Estudio de Tatuajes / Piercing', 'Estudio Fotográfico',
  'Taller Mecánico / Automotriz', 'Lavandería / Tintorería',
  'Consultoría / Asesoría', 'Otro',
];

const COUNTRIES = [
  { name: 'Colombia', code: '+57', flag: '\u{1F1E8}\u{1F1F4}' },
  { name: 'México', code: '+52', flag: '\u{1F1F2}\u{1F1FD}' },
  { name: 'Argentina', code: '+54', flag: '\u{1F1E6}\u{1F1F7}' },
  { name: 'Chile', code: '+56', flag: '\u{1F1E8}\u{1F1F1}' },
  { name: 'Perú', code: '+51', flag: '\u{1F1F5}\u{1F1EA}' },
  { name: 'Ecuador', code: '+593', flag: '\u{1F1EA}\u{1F1E8}' },
  { name: 'Venezuela', code: '+58', flag: '\u{1F1FB}\u{1F1EA}' },
  { name: 'Panamá', code: '+507', flag: '\u{1F1F5}\u{1F1E6}' },
  { name: 'Costa Rica', code: '+506', flag: '\u{1F1E8}\u{1F1F7}' },
  { name: 'Guatemala', code: '+502', flag: '\u{1F1EC}\u{1F1F9}' },
  { name: 'Honduras', code: '+504', flag: '\u{1F1ED}\u{1F1F3}' },
  { name: 'El Salvador', code: '+503', flag: '\u{1F1F8}\u{1F1FB}' },
  { name: 'Nicaragua', code: '+505', flag: '\u{1F1F3}\u{1F1EE}' },
  { name: 'República Dominicana', code: '+1', flag: '\u{1F1E9}\u{1F1F4}' },
  { name: 'Cuba', code: '+53', flag: '\u{1F1E8}\u{1F1FA}' },
  { name: 'Puerto Rico', code: '+1', flag: '\u{1F1F5}\u{1F1F7}' },
  { name: 'Uruguay', code: '+598', flag: '\u{1F1FA}\u{1F1FE}' },
  { name: 'Paraguay', code: '+595', flag: '\u{1F1F5}\u{1F1FE}' },
  { name: 'Bolivia', code: '+591', flag: '\u{1F1E7}\u{1F1F4}' },
  { name: 'España', code: '+34', flag: '\u{1F1EA}\u{1F1F8}' },
  { name: 'Estados Unidos', code: '+1', flag: '\u{1F1FA}\u{1F1F8}' },
];

// service_type: 'cita' = sesión única, 'paquete' = membresía/plan, 'reserva' = espacio/mesa
const SERVICE_TEMPLATES = {
  'Peluquería / Barbería': [
    { name: 'Corte Clásico', price: 25000, duration: 40, category: 'Corte', service_type: 'cita', active: true },
    { name: 'Corte + Barba', price: 35000, duration: 50, category: 'Corte', service_type: 'cita', active: true },
    { name: 'Barba', price: 15000, duration: 20, category: 'Barba', service_type: 'cita', active: true },
    { name: 'Tinte', price: 45000, duration: 60, category: 'Color', service_type: 'cita', active: true },
    { name: 'Alisado Keratina', price: 80000, duration: 90, category: 'Tratamiento', service_type: 'cita', active: false },
    { name: 'Tratamiento Capilar', price: 50000, duration: 45, category: 'Tratamiento', service_type: 'cita', active: false },
  ],
  'Spa / Centro de Bienestar': [
    { name: 'Masaje Relajante', price: 80000, duration: 60, category: 'Masajes', service_type: 'cita', active: true },
    { name: 'Masaje Descontracturante', price: 95000, duration: 60, category: 'Masajes', service_type: 'cita', active: true },
    { name: 'Circuito de Aguas', price: 120000, duration: 90, category: 'Circuitos', service_type: 'cita', active: true },
    { name: 'Facial Hidratante', price: 70000, duration: 45, category: 'Faciales', service_type: 'cita', active: true },
    { name: 'Day Spa Completo', price: 250000, duration: 180, category: 'Paquetes', service_type: 'cita', active: false },
  ],
  'Centro Estético': [
    { name: 'Limpieza Facial', price: 60000, duration: 50, category: 'Facial', service_type: 'cita', active: true },
    { name: 'Microdermoabrasión', price: 90000, duration: 40, category: 'Facial', service_type: 'cita', active: true },
    { name: 'Depilación Láser', price: 120000, duration: 30, category: 'Corporal', service_type: 'cita', active: true },
    { name: 'Diseño de Cejas', price: 30000, duration: 20, category: 'Cejas', service_type: 'cita', active: true },
    { name: 'Paquete 6 Sesiones Láser', price: 600000, duration: 180, category: 'Paquetes', service_type: 'paquete', active: false },
  ],
  'Clínica / Consultorio': [
    { name: 'Consulta General', price: 80000, duration: 30, category: 'Consulta', service_type: 'cita', active: true },
    { name: 'Consulta Especializada', price: 120000, duration: 45, category: 'Consulta', service_type: 'cita', active: true },
    { name: 'Control / Seguimiento', price: 50000, duration: 20, category: 'Control', service_type: 'cita', active: true },
    { name: 'Examen de Laboratorio', price: 40000, duration: 15, category: 'Exámenes', service_type: 'cita', active: false },
  ],
  'Odontología': [
    { name: 'Limpieza Dental', price: 80000, duration: 40, category: 'Preventiva', service_type: 'cita', active: true },
    { name: 'Blanqueamiento', price: 350000, duration: 60, category: 'Estética', service_type: 'cita', active: true },
    { name: 'Consulta Valoración', price: 50000, duration: 30, category: 'Consulta', service_type: 'cita', active: true },
    { name: 'Ortodoncia — Control Mensual', price: 100000, duration: 30, category: 'Ortodoncia', service_type: 'cita', active: true },
    { name: 'Extracción Simple', price: 120000, duration: 45, category: 'Cirugía', service_type: 'cita', active: false },
  ],
  'Fisioterapia / Rehabilitación': [
    { name: 'Sesión de Fisioterapia', price: 60000, duration: 45, category: 'Terapia', service_type: 'cita', active: true },
    { name: 'Evaluación Inicial', price: 80000, duration: 60, category: 'Evaluación', service_type: 'cita', active: true },
    { name: 'Paquete 10 Sesiones', price: 500000, duration: 30, category: 'Paquetes', service_type: 'paquete', active: true },
    { name: 'Terapia Manual', price: 70000, duration: 50, category: 'Terapia', service_type: 'cita', active: true },
  ],
  'Psicología / Terapia': [
    { name: 'Sesión Individual', price: 100000, duration: 50, category: 'Individual', service_type: 'cita', active: true },
    { name: 'Sesión de Pareja', price: 150000, duration: 60, category: 'Pareja', service_type: 'cita', active: true },
    { name: 'Primera Consulta', price: 80000, duration: 60, category: 'Evaluación', service_type: 'cita', active: true },
    { name: 'Paquete 4 Sesiones', price: 360000, duration: 200, category: 'Paquetes', service_type: 'paquete', active: false },
  ],
  'Veterinaria': [
    { name: 'Consulta General', price: 50000, duration: 30, category: 'Consulta', service_type: 'cita', active: true },
    { name: 'Vacunación', price: 35000, duration: 15, category: 'Vacunas', service_type: 'cita', active: true },
    { name: 'Baño y Peluquería', price: 40000, duration: 60, category: 'Estética', service_type: 'cita', active: true },
    { name: 'Cirugía Menor', price: 200000, duration: 90, category: 'Cirugía', service_type: 'cita', active: false },
    { name: 'Guardería — Día', price: 30000, duration: 480, category: 'Hospedaje', service_type: 'reserva', active: false },
  ],
  'Nutrición / Dietética': [
    { name: 'Consulta Nutricional', price: 80000, duration: 45, category: 'Consulta', service_type: 'cita', active: true },
    { name: 'Plan Alimenticio', price: 150000, duration: 60, category: 'Plan', service_type: 'cita', active: true },
    { name: 'Control Mensual', price: 50000, duration: 30, category: 'Control', service_type: 'cita', active: true },
    { name: 'Programa 3 Meses', price: 400000, duration: 90, category: 'Paquetes', service_type: 'paquete', active: false },
  ],
  'Gimnasio / Fitness': [
    { name: 'Mensualidad', price: 80000, duration: 30, category: 'Membresía', service_type: 'paquete', active: true },
    { name: 'Trimestral', price: 210000, duration: 90, category: 'Membresía', service_type: 'paquete', active: true },
    { name: 'Semestral', price: 400000, duration: 180, category: 'Membresía', service_type: 'paquete', active: true },
    { name: 'Anual', price: 700000, duration: 365, category: 'Membresía', service_type: 'paquete', active: true },
    { name: 'Clase Personal (1 sesión)', price: 50000, duration: 60, category: 'Personal', service_type: 'cita', active: true },
    { name: 'Paquete 10 Clases', price: 400000, duration: 60, category: 'Clases', service_type: 'paquete', active: false },
  ],
  'Academia / Educación': [
    { name: 'Clase Individual', price: 50000, duration: 60, category: 'Clases', service_type: 'cita', active: true },
    { name: 'Curso Mensual', price: 200000, duration: 30, category: 'Cursos', service_type: 'paquete', active: true },
    { name: 'Taller Grupal', price: 80000, duration: 120, category: 'Talleres', service_type: 'cita', active: true },
    { name: 'Semestre Completo', price: 1000000, duration: 180, category: 'Programa', service_type: 'paquete', active: false },
  ],
  'Estudio de Yoga / Pilates': [
    { name: 'Clase Grupal', price: 25000, duration: 60, category: 'Grupal', service_type: 'cita', active: true },
    { name: 'Clase Personal', price: 60000, duration: 60, category: 'Personal', service_type: 'cita', active: true },
    { name: 'Plan Mensual Ilimitado', price: 150000, duration: 30, category: 'Membresía', service_type: 'paquete', active: true },
    { name: 'Paquete 8 Clases', price: 160000, duration: 30, category: 'Paquetes', service_type: 'paquete', active: true },
  ],
  'Restaurante / Cafetería': [
    { name: 'Mesa 2 personas', price: 0, duration: 90, category: 'Reserva', service_type: 'reserva', active: true },
    { name: 'Mesa 4 personas', price: 0, duration: 90, category: 'Reserva', service_type: 'reserva', active: true },
    { name: 'Mesa 6+ personas', price: 0, duration: 120, category: 'Reserva', service_type: 'reserva', active: true },
    { name: 'Evento Privado', price: 500000, duration: 240, category: 'Eventos', service_type: 'reserva', active: false },
  ],
  'Hotel / Hospedaje': [
    { name: 'Habitación Estándar', price: 120000, duration: 1440, category: 'Habitaciones', service_type: 'reserva', active: true },
    { name: 'Habitación Doble', price: 180000, duration: 1440, category: 'Habitaciones', service_type: 'reserva', active: true },
    { name: 'Suite', price: 300000, duration: 1440, category: 'Habitaciones', service_type: 'reserva', active: true },
    { name: 'Day Pass — Piscina', price: 40000, duration: 480, category: 'Day Pass', service_type: 'reserva', active: false },
  ],
  'Estudio de Tatuajes / Piercing': [
    { name: 'Tatuaje Pequeño', price: 100000, duration: 60, category: 'Tatuajes', service_type: 'cita', active: true },
    { name: 'Tatuaje Mediano', price: 250000, duration: 120, category: 'Tatuajes', service_type: 'cita', active: true },
    { name: 'Tatuaje Grande', price: 500000, duration: 240, category: 'Tatuajes', service_type: 'cita', active: true },
    { name: 'Piercing', price: 50000, duration: 20, category: 'Piercing', service_type: 'cita', active: true },
    { name: 'Consulta / Diseño', price: 0, duration: 30, category: 'Consulta', service_type: 'cita', active: true },
  ],
  'Estudio Fotográfico': [
    { name: 'Sesión Individual', price: 150000, duration: 60, category: 'Sesión', service_type: 'cita', active: true },
    { name: 'Sesión Pareja / Familia', price: 250000, duration: 90, category: 'Sesión', service_type: 'cita', active: true },
    { name: 'Sesión Corporativa', price: 400000, duration: 120, category: 'Corporativo', service_type: 'cita', active: true },
    { name: 'Cobertura Evento', price: 800000, duration: 300, category: 'Eventos', service_type: 'reserva', active: false },
  ],
  'Taller Mecánico / Automotriz': [
    { name: 'Diagnóstico General', price: 50000, duration: 30, category: 'Diagnóstico', service_type: 'cita', active: true },
    { name: 'Cambio de Aceite', price: 80000, duration: 30, category: 'Mantenimiento', service_type: 'cita', active: true },
    { name: 'Revisión Frenos', price: 60000, duration: 45, category: 'Mantenimiento', service_type: 'cita', active: true },
    { name: 'Alineación y Balanceo', price: 70000, duration: 45, category: 'Mantenimiento', service_type: 'cita', active: true },
  ],
  'Lavandería / Tintorería': [
    { name: 'Lavado por Kilo', price: 8000, duration: 1440, category: 'Lavado', service_type: 'cita', active: true },
    { name: 'Lavado en Seco', price: 15000, duration: 2880, category: 'Seco', service_type: 'cita', active: true },
    { name: 'Planchado', price: 5000, duration: 1440, category: 'Planchado', service_type: 'cita', active: true },
    { name: 'Edredón / Cobija', price: 25000, duration: 2880, category: 'Especial', service_type: 'cita', active: false },
  ],
  'Consultoría / Asesoría': [
    { name: 'Sesión de Asesoría (1h)', price: 150000, duration: 60, category: 'Asesoría', service_type: 'cita', active: true },
    { name: 'Consultoría Estratégica', price: 300000, duration: 120, category: 'Consultoría', service_type: 'cita', active: true },
    { name: 'Plan Mensual', price: 800000, duration: 30, category: 'Planes', service_type: 'paquete', active: true },
    { name: 'Auditoría', price: 500000, duration: 240, category: 'Auditoría', service_type: 'cita', active: false },
  ],
  'default': [
    { name: 'Servicio General', price: 50000, duration: 30, category: 'General', service_type: 'cita', active: true },
    { name: 'Servicio Premium', price: 80000, duration: 60, category: 'Premium', service_type: 'cita', active: true },
    { name: 'Consulta Básica', price: 30000, duration: 30, category: 'General', service_type: 'cita', active: true },
  ],
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 190000,
    automations: 10,
    features: ['CRM completo — clientes ilimitados', 'Agenda y calendario visual', 'Inbox WhatsApp en tiempo real', 'Lina IA — 1.000 mensajes/mes', '10 automatizaciones activas', 'Finanzas, comisiones y lealtad', 'Campañas WhatsApp', 'Soporte por email'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 390000,
    popular: true,
    automations: 25,
    features: ['Todo lo del plan Starter', 'Lina IA — 3.000 mensajes/mes', '25 automatizaciones activas', 'Campañas masivas ilimitadas', 'Referidos y bonos', 'Soporte prioritario'],
  },
  {
    id: 'business',
    name: 'Business',
    price: 590000,
    automations: 50,
    features: ['Todo lo del plan Pro', 'Lina IA — 5.000 mensajes/mes', '50 automatizaciones activas', 'Multi-profesionales ilimitados', 'Soporte dedicado 24/7', 'Onboarding personalizado'],
  },
];

const AUTOMATION_GROUPS = [
  { label: 'Citas', icon: '\u{1F4C5}', items: [
    { id: 'confirmation', name: 'Confirmación de cita', desc: 'Pide confirmación al cliente al agendar' },
    { id: 'reminder_24h', name: 'Recordatorio 24h', desc: 'WhatsApp automático 24 horas antes' },
    { id: 'reminder_1h', name: 'Recordatorio 1h', desc: 'WhatsApp automático 1 hora antes' },
    { id: 'reschedule', name: 'Reagendamiento', desc: 'Notifica al cliente si se mueve su cita' },
    { id: 'cancellation', name: 'Cancelación', desc: 'Confirma cancelación y ofrece reagendar' },
  ]},
  { label: 'Post-visita', icon: '\u2B50', items: [
    { id: 'post_visit_thanks', name: 'Agradecimiento', desc: 'Mensaje de gracias 2h después del servicio' },
    { id: 'rating_request', name: 'Encuesta de satisfacción', desc: 'Pide calificación 1-5 estrellas' },
    { id: 'review_google', name: 'Reseña en Google', desc: 'Si califica 4-5, pide reseña en Google' },
    { id: 'post_care_tips', name: 'Tips de cuidado', desc: 'Consejos personalizados post-servicio' },
    { id: 'suggest_next_service', name: 'Sugerir próximo servicio', desc: 'Recomienda servicio complementario' },
  ]},
  { label: 'Retención', icon: '\u{1F504}', items: [
    { id: 'reactivation_30d', name: 'Reactivación 30 días', desc: 'Mensaje a clientes inactivos +30 días' },
    { id: 'reactivation_60d', name: 'Reactivación 60 días', desc: 'Mensaje más urgente a +60 días' },
    { id: 'no_show_followup', name: 'Seguimiento no-show', desc: 'Contacta al cliente que no asistió' },
    { id: 'rebooking_cycle', name: 'Ciclo de rebooking', desc: 'Recuerda agendar según su frecuencia' },
    { id: 'winback_discount', name: 'Descuento de recuperación', desc: 'Oferta especial para clientes perdidos' },
  ]},
  { label: 'Fidelización', icon: '\u{1F48E}', items: [
    { id: 'welcome', name: 'Bienvenida', desc: 'Mensaje de bienvenida a clientes nuevos' },
    { id: 'birthday', name: 'Cumpleaños', desc: 'Felicitación automática + oferta especial' },
    { id: 'auto_vip', name: 'Reconocimiento VIP', desc: 'Notifica al cliente cuando sube a VIP' },
    { id: 'anniversary', name: 'Aniversario', desc: 'Celebra el aniversario como cliente' },
    { id: 'visit_milestone', name: 'Hito de visitas', desc: 'Celebra la visita #10, #25, #50...' },
  ]},
  { label: 'Operativo', icon: '\u{1F4CA}', items: [
    { id: 'daily_summary', name: 'Resumen diario', desc: 'Resumen del día al admin por WhatsApp' },
    { id: 'noshow_alert', name: 'Alerta de no-show', desc: 'Notifica al admin cuando alguien no asiste' },
    { id: 'new_client_alert', name: 'Nuevo cliente', desc: 'Alerta al admin cuando se registra alguien' },
    { id: 'payment_reminder', name: 'Recordatorio de pago', desc: 'Recuerda pagos pendientes al cliente' },
    { id: 'digital_receipt', name: 'Recibo digital', desc: 'Envía recibo por WhatsApp al pagar' },
  ]},
];

const STEPS = [
  { num: 1, title: 'Negocio', icon: '\u{1F3EA}' },
  { num: 2, title: 'Cuenta', icon: '\u{1F464}' },
  { num: 3, title: 'Equipo', icon: '\u{1F465}' },
  { num: 4, title: 'Plan', icon: '\u{1F48E}' },
  { num: 5, title: 'Automatizaciones', icon: '\u26A1' },
  { num: 6, title: 'Pago', icon: '\u{1F4B3}' },
  { num: 7, title: 'Listo', icon: '\u{1F680}' },
];

const STEP_SUBTITLES = {
  1: 'Cuéntenos sobre su negocio',
  2: 'Configure su cuenta de administrador',
  3: 'Registre a su equipo de trabajo',
  4: 'Seleccione el plan ideal para su negocio',
  5: 'Active las automatizaciones que necesita',
  6: 'Revise el resumen y confirme su suscripción',
  7: 'Su negocio está siendo configurado',
};

const STEP_DESCRIPTIONS = {
  1: 'Esta información configura su CRM personalizado y su página de reservas.',
  2: 'Con estas credenciales podrá acceder a su panel de administración.',
  3: 'Agregue al menos un profesional. Podrá agregar más después desde el CRM.',
  4: 'Todos los planes incluyen CRM completo, Lina IA y WhatsApp integrado.',
  5: '',
  6: 'Resumen de su suscripción mensual.',
  7: '',
};

const formatCOP = (n) => '$' + n.toLocaleString('es-CO');

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

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
        if (!form.businessType) return 'Seleccione el tipo de negocio';
        if (!form.city.trim()) return 'La ciudad es obligatoria';
        if (!form.phone || form.phone.replace(/\D/g, '').length < 7) return 'Ingrese un número de teléfono válido';
        return null;
      case 2: // Tu cuenta
        if (!form.ownerName.trim()) return 'Su nombre es obligatorio';
        if (form.ownerName.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
        if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Ingrese un correo electrónico válido';
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
        if (validStaff.length === 0) return 'Agregue al menos un profesional';
        for (const s of validStaff) {
          if (s.name.trim().length < 2) return `El nombre "${s.name}" es muy corto`;
        }
        return null;
      case 4: // Plan
        if (!form.plan) return 'Seleccione un plan';
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
    setStep(7); // Show processing spinner immediately

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
          payment_ref: 'SIM-' + Date.now(),
        }),
      });

      const data = await res.json().catch(() => ({ detail: 'Error de conexión' }));

      if (!res.ok) {
        let errMsg = 'Error al crear el negocio';
        if (typeof data.detail === 'string') errMsg = data.detail;
        else if (Array.isArray(data.detail)) errMsg = data.detail.map(e => typeof e === 'string' ? e : (e.msg || JSON.stringify(e))).join('. ');
        setError(errMsg);
        setResult(null); // triggers "rejected" screen
        setLoading(false);
        return;
      }

      setResult(data);
    } catch (err) {
      setError('Error de conexión. Intente de nuevo.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = Math.round(((step - 1) / 6) * 100);

  return (
    <>
      <SEO
        title="Registrar mi Negocio — Cuenta Gratis"
        description="Crea tu cuenta en Plexify Studio en minutos. Configura agenda online, WhatsApp y CRM para tu peluqueria, salon de belleza, barberia o spa. Sin tarjeta de credito."
        url="/register"
        keywords="registrar negocio software peluqueria, crear cuenta CRM salon, registro sistema de citas gratis"
        noindex
      />

      <div className="reg">
        <h1 className="sr-only">Registre su negocio en Plexify Studio</h1>
        <div className="reg__container">
          {/* Left — Form */}
          <div className="reg__form-side">
            {/* Mobile progress — compact */}
            <div className="reg__progress-mobile">
              <div className="reg__progress-mobile-info">
                <span className="reg__progress-mobile-step">Paso {step} de 7</span>
                <span className="reg__progress-mobile-label">{STEPS[step - 1]?.title}</span>
              </div>
              <div className="reg__progress-mobile-bar">
                <div className="reg__progress-mobile-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {/* Desktop progress */}
            <div className="reg__progress">
              {STEPS.map((s) => {
                const completed = step > s.num;
                const canClick = completed && step < 7;
                return (
                  <div
                    key={s.num}
                    className={`reg__progress-step ${step >= s.num ? 'reg__progress-step--active' : ''} ${step === s.num ? 'reg__progress-step--current' : ''} ${canClick ? 'reg__progress-step--clickable' : ''}`}
                    onClick={() => { if (canClick) { setError(''); setStep(s.num); } }}
                  >
                    <span className="reg__progress-num">
                      {completed ? <CheckIcon /> : s.num}
                    </span>
                    <span className="reg__progress-label">{s.title}</span>
                  </div>
                );
              })}
            </div>

            {/* Form card wrapper */}
            <div className="reg__card">
              {/* Step 1 — Business */}
              {step === 1 && (
                <div className="reg__step">
                  <h2 className="reg__step-title">{STEP_SUBTITLES[1]}</h2>
                  <p className="reg__step-sub">{STEP_DESCRIPTIONS[1]}</p>
                  <div className="reg__field">
                    <label>Nombre del negocio</label>
                    <input type="text" placeholder="Ej: Studio Barber" value={form.businessName} onChange={e => updateForm('businessName', e.target.value)} />
                    {form.businessName && <small className="reg__slug">plexify.studio/book/<strong>{slug}</strong></small>}
                  </div>
                  <div className="reg__field">
                    <label>Tipo de negocio</label>
                    <select value={form.businessType} onChange={e => updateForm('businessType', e.target.value)}>
                      <option value="">Seleccione una categoría</option>
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
                    <label>Dirección <span className="reg__field-optional">(opcional)</span></label>
                    <input type="text" placeholder="Ej: Cra 31 #50-21" value={form.address} onChange={e => updateForm('address', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 2 — Account */}
              {step === 2 && (
                <div className="reg__step">
                  <h2 className="reg__step-title">{STEP_SUBTITLES[2]}</h2>
                  <p className="reg__step-sub">{STEP_DESCRIPTIONS[2]}</p>
                  <div className="reg__field">
                    <label>Nombre completo</label>
                    <input type="text" placeholder="Ej: Jaime Pérez" value={form.ownerName} onChange={e => updateForm('ownerName', e.target.value)} />
                  </div>
                  <div className="reg__field">
                    <label>Correo electrónico</label>
                    <input type="email" placeholder="Ej: jaime@tunegocio.com" value={form.email} onChange={e => updateForm('email', e.target.value)} />
                  </div>
                  <div className="reg__row">
                    <div className="reg__field">
                      <label>Usuario</label>
                      <input type="text" placeholder="Ej: jaime" value={form.username} onChange={e => updateForm('username', e.target.value)} />
                    </div>
                    <div className="reg__field">
                      <label>Contraseña</label>
                      <input type="password" placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número" value={form.password} onChange={e => updateForm('password', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 — Team */}
              {step === 3 && (
                <div className="reg__step">
                  <h2 className="reg__step-title">{STEP_SUBTITLES[3]}</h2>
                  <p className="reg__step-sub">{STEP_DESCRIPTIONS[3]}</p>
                  <div className="reg__staff-list">
                    {form.staff.map((s, i) => (
                      <div key={i} className="reg__staff-row">
                        <input type="text" placeholder="Nombre completo" value={s.name} onChange={e => updateStaff(i, 'name', e.target.value)} />
                        <input type="text" placeholder="Especialidad (Ej: Barbero)" value={s.specialty} onChange={e => updateStaff(i, 'specialty', e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <button className="reg__add-staff" onClick={addStaff}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar otro profesional
                  </button>
                </div>
              )}

              {/* Step 4 — Plan Selection */}
              {step === 4 && (
                <div className="reg__step">
                  <h2 className="reg__step-title">{STEP_SUBTITLES[4]}</h2>
                  <p className="reg__step-sub">{STEP_DESCRIPTIONS[4]}</p>
                  <div className="reg__plans">
                    {PLANS.map(plan => (
                      <div
                        key={plan.id}
                        className={`reg__plan ${form.plan === plan.id ? 'reg__plan--selected' : ''} ${plan.popular ? 'reg__plan--popular' : ''}`}
                        onClick={() => { updateForm('plan', plan.id); updateForm('automationIds', []); }}
                      >
                        {plan.popular && <span className="reg__plan-badge">Recomendado</span>}
                        <h3 className="reg__plan-name">{plan.name}</h3>
                        <div className="reg__plan-price">
                          <span className="reg__plan-amount">{formatCOP(plan.price)}</span>
                          <span className="reg__plan-period">/mes</span>
                        </div>
                        <ul className="reg__plan-features">
                          {plan.features.map((f, i) => (
                            <li key={i}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5 — Automations */}
              {step === 5 && (
                <div className="reg__step">
                  <h2 className="reg__step-title">{STEP_SUBTITLES[5]}</h2>
                  <p className="reg__step-sub">
                    Su plan <strong>{selectedPlan.name}</strong> incluye{' '}
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
                    <p className="reg__note">Ha alcanzado el límite de su plan. <span className="reg__note-link" onClick={() => { setStep(4); }}>Cambiar de plan</span></p>
                  )}
                </div>
              )}

              {/* Step 6 — Payment (Simulated) */}
              {step === 6 && (
                <div className="reg__step">
                  <h2 className="reg__step-title">{STEP_SUBTITLES[6]}</h2>
                  <p className="reg__step-sub">{STEP_DESCRIPTIONS[6]}</p>

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
                        <p className="reg__step-sub">Estamos verificando su pago y creando su cuenta. No cierre esta ventana.</p>
                      </div>
                    </>
                  ) : result ? (
                    <>
                      <div className="reg__done-success-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      </div>
                      <h2 className="reg__step-title">Su negocio está listo</h2>
                      <p className="reg__step-sub">Guarde sus credenciales de acceso. Las necesitará para iniciar sesión.</p>

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
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Descargar credenciales
                        </button>
                        <button
                          className="reg__btn reg__btn--primary"
                          onClick={() => { window.location.href = (import.meta.env.BASE_URL || '/') + 'login'; }}
                        >
                          Iniciar sesión
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="reg__done-error-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                      </div>
                      <h2 className="reg__step-title">Pago rechazado</h2>
                      <p className="reg__step-sub">{error || 'No se pudo procesar el pago. Verifique los datos de su tarjeta e intente de nuevo.'}</p>
                      <button className="reg__btn reg__btn--primary" onClick={() => setStep(6)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                        Volver a intentar
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Error */}
              {error && step < 7 && (
                <div className="reg__error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              {/* Navigation */}
              {step < 6 && (
                <div className="reg__nav">
                  {step > 1 ? (
                    <button className="reg__btn reg__btn--ghost" onClick={back}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                      Atrás
                    </button>
                  ) : <span />}
                  <button className="reg__btn reg__btn--primary" onClick={next}>
                    Continuar
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </button>
                </div>
              )}
              {step === 6 && (
                <div className="reg__nav">
                  <button className="reg__btn reg__btn--ghost" onClick={back}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Atrás
                  </button>
                  <button className="reg__btn reg__btn--primary" onClick={handlePayAndCreate} disabled={loading}>
                    {loading ? 'Procesando...' : (
                      <>
                        Pagar {formatCOP(selectedPlan.price)} y crear negocio
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Trust indicators */}
              {step < 7 && (
                <div className="reg__trust">
                  <div className="reg__trust-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span>Información segura</span>
                  </div>
                  <div className="reg__trust-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Sin permanencia</span>
                  </div>
                  <div className="reg__trust-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>Activo en minutos</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right — Info */}
          <div className="reg__info-side">
            <div className="reg__info-content">
              <div className="reg__info-badge">Plexify Studio</div>
              <h3 className="reg__info-title">Su negocio<br />funcionando en minutos.</h3>
              <p className="reg__info-desc">Configure su CRM, su página de reservas y Lina IA en un solo proceso de registro.</p>
              <div className="reg__info-features">
                {['CRM completo desde el primer día', 'Página de reservas pública al instante', 'Lina IA responde WhatsApp automáticamente', 'Automatizaciones que trabajan por usted', 'Sin contratos ni permanencia'].map((f, i) => (
                  <div key={i} className="reg__info-feature">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="reg__info-stats">
                <div className="reg__info-stat">
                  <span className="reg__info-stat-num">500+</span>
                  <span className="reg__info-stat-label">Negocios activos</span>
                </div>
                <div className="reg__info-stat">
                  <span className="reg__info-stat-num">50K+</span>
                  <span className="reg__info-stat-label">Citas gestionadas</span>
                </div>
                <div className="reg__info-stat">
                  <span className="reg__info-stat-num">98%</span>
                  <span className="reg__info-stat-label">Satisfacción</span>
                </div>
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
