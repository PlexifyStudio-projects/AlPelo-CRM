import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNotification } from '../../context/NotificationContext';
import svc from '../../services/automationStudioService';

const B = 'auto-studio';

const Icon = ({ d, size = 20, stroke = 'currentColor', fill = 'none', ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>{typeof d === 'string' ? <path d={d} /> : d}</svg>
);
const ZapIcon = (p) => <Icon {...p} d={<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none" />} />;
const PlusIcon = (p) => <Icon {...p} d={<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>} />;
const ClockIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>} />;
const CalendarIcon = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />;
const UsersIcon = (p) => <Icon {...p} d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />;
const UserPlusIcon = (p) => <Icon {...p} d={<><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>} />;
const GiftIcon = (p) => <Icon {...p} d={<><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>} />;
const StarIcon = (p) => <Icon {...p} d={<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />} />;
const AwardIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>} />;
const DollarIcon = (p) => <Icon {...p} d={<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>} />;
const XIcon = (p) => <Icon {...p} d={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} />;
const CheckIcon = (p) => <Icon {...p} d="M20 6L9 17l-5-5" />;
const ChevronRight = (p) => <Icon {...p} size={16} d="M9 18l6-6-6-6" />;
const ChevronLeft = (p) => <Icon {...p} size={16} d="M15 18l-6-6 6-6" />;
const SendIcon = (p) => <Icon {...p} d={<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>} />;
const CopyIcon = (p) => <Icon {...p} d={<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>} />;
const TrashIcon = (p) => <Icon {...p} d={<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>} />;
const EditIcon = (p) => <Icon {...p} d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>} />;
const HistoryIcon = (p) => <Icon {...p} d={<><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></>} />;
const PlayIcon = (p) => <Icon {...p} d={<polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />} />;
const FilterIcon = (p) => <Icon {...p} d={<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />} />;
const EyeIcon = (p) => <Icon {...p} d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>} />;
const MessageIcon = (p) => <Icon {...p} d={<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>} />;
const LinkIcon = (p) => <Icon {...p} d={<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>} />;
const AlertIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>} />;
const BarChartIcon = (p) => <Icon {...p} d={<><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>} />;
const TargetIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>} />;
const LayersIcon = (p) => <Icon {...p} d={<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>} />;
const RefreshIcon = (p) => <Icon {...p} d={<><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>} />;
const WhatsAppIcon = (p) => <Icon {...p} size={16} fill="#25D366" stroke="none" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />;

const HeartIcon = (p) => <Icon {...p} d={<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />} />;
const TrendingUpIcon = (p) => <Icon {...p} d={<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>} />;
const RepeatIcon = (p) => <Icon {...p} d={<><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>} />;
const ShieldIcon = (p) => <Icon {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
const PackageIcon = (p) => <Icon {...p} d={<><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>} />;
const ThumbsUpIcon = (p) => <Icon {...p} d={<><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></>} />;
const MailIcon = (p) => <Icon {...p} d={<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>} />;
const BellIcon = (p) => <Icon {...p} d={<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>} />;
const ClipboardIcon = (p) => <Icon {...p} d={<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>} />;
const MegaphoneIcon = (p) => <Icon {...p} d={<><path d="M3 11l18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>} />;
const PercentIcon = (p) => <Icon {...p} d={<><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>} />;
const CrownIcon = (p) => <Icon {...p} d={<><path d="M2 4l3 12h14l3-12-5 4-5-4-5 4z" /><line x1="2" y1="20" x2="22" y2="20" /></>} />;
const SettingsIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>} />;

const TRIGGER_ICONS = {
  hours_before_appt: ClockIcon, hours_after_complete: CheckIcon, appointment_created: CalendarIcon,
  appointment_cancelled: XIcon, appointment_rescheduled: RepeatIcon, no_show: AlertIcon,
  rebooking_reminder: RefreshIcon,
  new_client: UserPlusIcon, days_since_visit: HistoryIcon, birthday: GiftIcon,
  visit_milestone: StarIcon, client_anniversary: AwardIcon, vip_reached: CrownIcon,
  client_at_risk: ShieldIcon,
  satisfaction_survey: ThumbsUpIcon, review_request: StarIcon, referral_program: UsersIcon,
  seasonal_promo: MegaphoneIcon, winback_offer: PercentIcon, upsell_suggestion: TrendingUpIcon,
  loyalty_welcome: HeartIcon, loyalty_points: StarIcon, loyalty_reward: GiftIcon,
  first_visit_thanks: HeartIcon, vip_exclusive: CrownIcon,
  payment_received: DollarIcon, payment_pending: DollarIcon, digital_receipt: ClipboardIcon,
  membership_expiring: ClockIcon,
  daily_summary: BarChartIcon, staff_briefing: ClipboardIcon, low_stock_alert: PackageIcon,
  new_booking_alert: BellIcon,
};

const TRIGGER_COLORS = {
  hours_before_appt: '#3B82F6', hours_after_complete: '#10B981', appointment_created: '#6366F1',
  appointment_cancelled: '#EF4444', appointment_rescheduled: '#F59E0B', no_show: '#DC2626',
  rebooking_reminder: '#0EA5E9',
  new_client: '#06B6D4', days_since_visit: '#8B5CF6', birthday: '#EC4899',
  visit_milestone: '#F97316', client_anniversary: '#14B8A6', vip_reached: '#D97706',
  client_at_risk: '#EF4444',
  satisfaction_survey: '#10B981', review_request: '#F59E0B', referral_program: '#8B5CF6',
  seasonal_promo: '#EC4899', winback_offer: '#EF4444', upsell_suggestion: '#F97316',
  loyalty_welcome: '#EC4899', loyalty_points: '#D97706', loyalty_reward: '#10B981',
  first_visit_thanks: '#06B6D4', vip_exclusive: '#D97706',
  payment_received: '#10B981', payment_pending: '#F59E0B', digital_receipt: '#3B82F6',
  membership_expiring: '#EF4444',
  daily_summary: '#6366F1', staff_briefing: '#3B82F6', low_stock_alert: '#EF4444',
  new_booking_alert: '#F59E0B',
};

const CATEGORY_META = {
  appointments: { label: 'Citas y Agenda', color: '#3B82F6', icon: CalendarIcon },
  clients: { label: 'Clientes', color: '#8B5CF6', icon: UsersIcon },
  marketing: { label: 'Marketing', color: '#EC4899', icon: MegaphoneIcon },
  loyalty: { label: 'Fidelización', color: '#D97706', icon: HeartIcon },
  payments: { label: 'Pagos y Facturación', color: '#10B981', icon: DollarIcon },
};

const META_STATUS = {
  draft: { label: 'Borrador', color: '#64748B', bg: 'rgba(100,116,139,0.08)', icon: EditIcon },
  pending: { label: 'En revisión por Meta', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: ClockIcon },
  approved: { label: 'Aprobada por Meta', color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: CheckIcon },
  rejected: { label: 'Rechazada por Meta', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: XIcon },
};

const MARKETPLACE_PACKS = [
  {
    id: 'bienvenida', name: 'Bienvenida', icon: '👋', color: '#2D5A3D',
    desc: 'Primera impresion perfecta. Mensaje automatico al registrar un nuevo cliente y al confirmar su primera cita.',
    templates: [
      {
        name: 'Bienvenida al nuevo cliente',
        trigger_type: 'new_client', trigger_config: {}, cooldown_days: 30, max_per_day: 20,
        action_config: { message: 'Hola {{nombre}}, bienvenido a {{negocio}}! Gracias por confiar en nosotros. A partir de ahora puede agendar citas, recibir recordatorios y acceder a promociones exclusivas por este medio. Cualquier cosa que necesite, escribanos.' },
      },
      {
        name: 'Confirmacion de cita nueva',
        trigger_type: 'appointment_created', trigger_config: {}, cooldown_days: 1, max_per_day: 50,
        action_config: { message: 'Hola {{nombre}}, su cita en {{negocio}} quedo confirmada para el {{fecha}} a las {{hora}} con {{profesional}}. Si necesita hacer algun cambio, escribanos con tiempo. Le esperamos!' },
      },
    ],
  },
  {
    id: 'recordatorios', name: 'Recordatorios', icon: '🔔', color: '#1E40AF',
    desc: 'Reduce inasistencias hasta un 70%. Recordatorios a 24h y 1h antes, seguimiento de no-shows y cancelaciones.',
    templates: [
      {
        name: 'Recordatorio — 24 horas antes',
        trigger_type: 'hours_before_appt', trigger_config: { hours: 24 }, cooldown_days: 1, max_per_day: 50,
        action_config: { message: 'Hola {{nombre}}, le recordamos que tiene cita manana a las {{hora}} con {{profesional}} en {{negocio}}. Responda SI para confirmar o escribanos si necesita reprogramar. Le esperamos.' },
      },
      {
        name: 'Recordatorio — 1 hora antes',
        trigger_type: 'hours_before_appt', trigger_config: { hours: 1 }, cooldown_days: 1, max_per_day: 50,
        action_config: { message: 'Hola {{nombre}}, su cita en {{negocio}} es en 1 hora. {{profesional}} ya esta preparando todo para recibirle. Le esperamos!' },
      },
      {
        name: 'No asistio — reprogramar',
        trigger_type: 'no_show', trigger_config: {}, cooldown_days: 7, max_per_day: 10,
        action_config: { message: 'Hola {{nombre}}, notamos que no pudo asistir a su cita de hoy en {{negocio}}. Esperamos que todo este bien. Si desea reprogramar, con gusto le buscamos un horario que le funcione. Solo escribanos.' },
      },
      {
        name: 'Cita cancelada — reagendar',
        trigger_type: 'appointment_cancelled', trigger_config: {}, cooldown_days: 3, max_per_day: 15,
        action_config: { message: 'Hola {{nombre}}, vimos que cancelo su cita en {{negocio}}. Esperamos que todo este bien. Si quiere reagendar para otro dia u hora, escribanos y le buscamos el mejor espacio.' },
      },
    ],
  },
  {
    id: 'seguimiento', name: 'Seguimiento', icon: '💬', color: '#0891B2',
    desc: 'Mantente presente despues de cada visita. Agradecimiento automatico, encuesta de satisfaccion y confirmacion de pago.',
    templates: [
      {
        name: 'Gracias por su visita — 3 horas despues',
        trigger_type: 'hours_after_complete', trigger_config: { hours: 3 }, cooldown_days: 7, max_per_day: 20,
        action_config: { message: 'Hola {{nombre}}, fue un gusto atenderle hoy en {{negocio}}. Esperamos que haya quedado a gusto con su {{servicio}}. Si tiene alguna sugerencia o quiere ajustar algo la proxima vez, con toda confianza diganos.' },
      },
      {
        name: 'Como le fue? — 24 horas despues',
        trigger_type: 'hours_after_complete', trigger_config: { hours: 24 }, cooldown_days: 14, max_per_day: 15, eval_hour: 11,
        action_config: { message: 'Hola {{nombre}}, queremos mejorar cada dia en {{negocio}}. Del 1 al 5, como calificaria su ultima visita? 5 = excelente, 1 = debemos mejorar. Su opinion nos importa mucho.' },
      },
      {
        name: 'Pago recibido — gracias',
        trigger_type: 'payment_received', trigger_config: {}, cooldown_days: 1, max_per_day: 30,
        action_config: { message: 'Hola {{nombre}}, recibimos su pago en {{negocio}}. Gracias por su preferencia. Recuerde que puede agendar su proxima cita en cualquier momento por este medio. Que tenga excelente dia!' },
      },
      {
        name: 'Pago pendiente — recordatorio',
        trigger_type: 'payment_pending', trigger_config: {}, cooldown_days: 7, max_per_day: 10, eval_hour: 10,
        action_config: { message: 'Hola {{nombre}}, le informamos que tiene un pago pendiente en {{negocio}} por su ultima visita. Si ya realizo el pago, ignore este mensaje. Si tiene alguna duda, escribanos y con gusto le ayudamos.' },
      },
    ],
  },
  {
    id: 'recuperacion', name: 'Recuperacion', icon: '🔄', color: '#E65100',
    desc: 'Recupera clientes que dejaron de venir. Mensajes escalonados a los 25, 45, 60 y 90 dias de inactividad.',
    templates: [
      {
        name: 'Le esperamos — 25 dias sin venir',
        trigger_type: 'days_since_visit', trigger_config: { days: 25 }, cooldown_days: 25, max_per_day: 15, eval_hour: 10,
        action_config: { message: 'Hola {{nombre}}, ya van {{dias}} dias desde su ultima visita a {{negocio}}. Le apartamos un espacio con {{profesional}}? Escribanos y le agendamos rapido.' },
      },
      {
        name: 'Le extranamos — 45 dias sin venir',
        trigger_type: 'days_since_visit', trigger_config: { days: 45 }, cooldown_days: 45, max_per_day: 10, eval_hour: 10,
        action_config: { message: 'Hola {{nombre}}, hace mas de un mes que no le vemos por {{negocio}} y le extranamos. {{profesional}} tiene disponibilidad esta semana. Quiere que le aparte un espacio?' },
      },
      {
        name: 'Detalle especial — 60 dias sin venir',
        trigger_type: 'days_since_visit', trigger_config: { days: 60 }, cooldown_days: 60, max_per_day: 10, eval_hour: 10,
        action_config: { message: 'Hola {{nombre}}, hace 2 meses que no viene por {{negocio}}. Nos encantaria tenerle de vuelta. Tenemos un detalle especial reservado para usted en su proxima visita. Cuando quiera agendar, escribanos.' },
      },
      {
        name: 'Ultimo intento — 90 dias sin venir',
        trigger_type: 'days_since_visit', trigger_config: { days: 90 }, cooldown_days: 90, max_per_day: 10, eval_hour: 10,
        action_config: { message: 'Hola {{nombre}}, han pasado 3 meses desde su ultima visita a {{negocio}}. Queremos saber si todo esta bien. Si hay algo que podamos mejorar, diganos. Su opinion nos importa. Le esperamos cuando guste.' },
      },
    ],
  },
  {
    id: 'fidelizacion', name: 'Fidelizacion', icon: '⭐', color: '#8B6914',
    desc: 'Premia a tus mejores clientes. Cumpleanos, aniversarios de visitas y reconocimiento por su lealtad.',
    templates: [
      {
        name: 'Feliz cumpleanos',
        trigger_type: 'birthday', trigger_config: {}, cooldown_days: 365, max_per_day: 20, eval_hour: 9,
        action_config: { message: 'Feliz cumpleanos, {{nombre}}! De parte de todo el equipo de {{negocio}} le deseamos un dia increible. Tiene un detalle especial esperandole en su proxima visita este mes. Agende cuando guste!' },
      },
      {
        name: 'Logro — 10 visitas',
        trigger_type: 'visit_milestone', trigger_config: { milestone: 10 }, cooldown_days: 365, max_per_day: 10,
        action_config: { message: 'Hola {{nombre}}, acaba de cumplir 10 visitas en {{negocio}}! Gracias por su fidelidad. Tiene un beneficio especial esperandole en su proxima cita.' },
      },
      {
        name: 'Logro — 25 visitas',
        trigger_type: 'visit_milestone', trigger_config: { milestone: 25 }, cooldown_days: 365, max_per_day: 5,
        action_config: { message: 'Hola {{nombre}}, 25 visitas en {{negocio}}! Usted ya es de la casa. Gracias por la confianza de siempre. Pase por su regalo especial en su proxima cita.' },
      },
      {
        name: 'Aniversario — 1 ano con nosotros',
        trigger_type: 'client_anniversary', trigger_config: {}, cooldown_days: 365, max_per_day: 10, eval_hour: 10,
        action_config: { message: 'Hola {{nombre}}, hoy se cumple un ano desde su primera visita a {{negocio}}! Gracias por acompanarnos. Tiene un detalle de aniversario esperandole. Agende cuando guste.' },
      },
    ],
  },
];

export default function AutomationStudio() {
  const { addNotification } = useNotification();
  const [view, setView] = useState('list');
  const [mainTab, setMainTab] = useState('automations');
  const [automations, setAutomations] = useState([]);
  const [stats, setStats] = useState(null);
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [historyRule, setHistoryRule] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [planLimit, setPlanLimit] = useState(999);
  const [limitModal, setLimitModal] = useState(false);
  const [installingPack, setInstallingPack] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [listData, statsData, triggerData] = await Promise.all([
      svc.list(), svc.getStats(), svc.getTriggers(),
    ]);
    setAutomations(listData.automations || []);
    setPlanLimit(listData.plan_limit || 999);
    setStats(statsData);
    setTriggers(triggerData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (rule) => {
    if (!rule.is_enabled && rule.meta_template_status !== 'approved') {
      addNotification('Primero envíe la plantilla a Meta para poder activar', 'warning');
      return;
    }
    if (!rule.is_enabled) {
      const activeCount = automations.filter(a => a.is_enabled).length;
      if (activeCount >= planLimit) {
        setLimitModal(true);
        return;
      }
    }
    try {
      await svc.update(rule.id, { is_enabled: !rule.is_enabled });
      addNotification(rule.is_enabled ? 'Automatización pausada' : 'Automatización activada', 'success');
      load();
    } catch (e) {
      if (e.message?.includes('Límite')) setLimitModal(true);
      else addNotification(e.message, 'error');
    }
  };

  const handleDelete = async (rule) => {
    try {
      await svc.delete(rule.id);
      addNotification('Automatización eliminada', 'success');
      setDeleteModal(null);
      load();
    } catch (e) { addNotification(e.message, 'error'); }
  };

  const handleDuplicate = async (rule) => {
    try {
      await svc.duplicate(rule.id);
      addNotification('Automatización duplicada', 'success');
      load();
    } catch (e) { addNotification(e.message, 'error'); }
  };

  const handleSubmitMeta = async (rule) => {
    try {
      const res = await svc.submitToMeta(rule.id);
      addNotification(
        res.meta_status === 'approved' ? 'Plantilla aprobada por Meta' : `Enviada a Meta como "${res.template_name}"`,
        res.meta_status === 'approved' ? 'success' : 'info'
      );
      load();
    } catch (e) { addNotification(e.message, 'error'); }
  };

  const handleCheckMeta = async (rule) => {
    try {
      const res = await svc.checkMetaStatus(rule.id);
      const msgs = { approved: 'Aprobada por Meta — ya puedes activarla', pending: 'Aún en revisión por Meta', rejected: 'Rechazada por Meta — edita y reenvía' };
      addNotification(msgs[res.meta_status] || res.meta_status, res.meta_status === 'approved' ? 'success' : 'warning');
      load();
    } catch (e) { addNotification(e.message, 'error'); }
  };

  const [checkingAll, setCheckingAll] = useState(false);
  const handleCheckAllMeta = async () => {
    const pending = automations.filter(a => a.meta_template_status === 'pending');
    if (!pending.length) { addNotification('No hay plantillas pendientes de verificar', 'info'); return; }
    setCheckingAll(true);
    let approved = 0, still_pending = 0, rejected = 0;
    for (const rule of pending) {
      try {
        const res = await svc.checkMetaStatus(rule.id);
        if (res.meta_status === 'approved') approved++;
        else if (res.meta_status === 'rejected') rejected++;
        else still_pending++;
      } catch { still_pending++; }
    }
    addNotification(`Verificadas ${pending.length}: ${approved} aprobadas, ${still_pending} pendientes${rejected ? `, ${rejected} rechazadas` : ''}`, approved > 0 ? 'success' : 'info');
    load();
    setCheckingAll(false);
  };

  const openWizard = (rule = null) => { setEditingRule(rule); setView('wizard'); };
  const openHistory = (rule) => { setHistoryRule(rule); setView('history'); };
  const closeWizard = () => { setEditingRule(null); setView('list'); load(); };

  if (loading) return (
    <div className={B}><div className={`${B}__loading`}><div className={`${B}__spinner`} /><span>Cargando automatizaciones...</span></div></div>
  );

  if (view === 'wizard') return <AutomationWizard triggers={triggers} editingRule={editingRule} onClose={closeWizard} addNotification={addNotification} />;
  if (view === 'history') return <ExecutionHistory rule={historyRule} onBack={() => { setView('list'); setHistoryRule(null); }} />;

  const active = automations.filter(a => a.is_enabled);
  const inactive = automations.filter(a => !a.is_enabled);

  return (
    <div className={B}>
      <div className={`${B}__hero`}>
        <div className={`${B}__hero-content`}>
          <div className={`${B}__hero-icon`}><ZapIcon size={24} /></div>
          <div className={`${B}__hero-text`}>
            <h1>Automatizaciones</h1>
            <p>Flujos automáticos que trabajan por ti 24/7 — sin intervención humana</p>
          </div>
        </div>
        {automations.some(a => a.meta_template_status === 'pending') && (
          <button className={`${B}__btn-ghost`} onClick={handleCheckAllMeta} disabled={checkingAll} style={{ marginRight: 8 }}>
            <RefreshIcon size={16} /><span>{checkingAll ? 'Verificando...' : 'Verificar todas en Meta'}</span>
          </button>
        )}
        <button className={`${B}__btn-primary`} onClick={() => {
          if (automations.length >= planLimit) { setLimitModal(true); return; }
          openWizard();
        }}>
          <PlusIcon size={18} /><span>Nueva automatización</span>
        </button>
      </div>

      {/* Tabs: Mis automatizaciones / Marketplace */}
      <div className={`${B}__tabs`}>
        <button className={`${B}__tab ${mainTab === 'automations' ? `${B}__tab--active` : ''}`} onClick={() => setMainTab('automations')}>
          <ZapIcon size={16} /> Mis automatizaciones ({automations.length})
        </button>
        <button className={`${B}__tab ${mainTab === 'marketplace' ? `${B}__tab--active` : ''}`} onClick={() => setMainTab('marketplace')}>
          <GiftIcon size={16} /> Marketplace
        </button>
      </div>

      {mainTab === 'marketplace' && (
        <div className={`${B}__marketplace`}>
          <p className={`${B}__marketplace-desc`}>Packs de automatizaciones listas para usar. Instala con un click, personaliza los mensajes y activa.</p>
          <div className={`${B}__marketplace-limit`}>
            <span>Automatizaciones: <strong>{automations.length}</strong> de <strong>{planLimit}</strong></span>
            <span className={`${B}__marketplace-limit-bar`}><span style={{ width: `${Math.min(100, (automations.length / planLimit) * 100)}%` }} /></span>
            <span>{Math.max(0, planLimit - automations.length)} disponibles</span>
          </div>
          <div className={`${B}__marketplace-grid`}>
            {MARKETPLACE_PACKS.map(pack => (
              <div key={pack.id} className={`${B}__pack-card`} style={{ '--pack-color': pack.color }}>
                <div className={`${B}__pack-icon`}>{pack.icon}</div>
                <h3 className={`${B}__pack-name`}>{pack.name}</h3>
                <p className={`${B}__pack-desc`}>{pack.desc}</p>
                <div className={`${B}__pack-count`}>{pack.templates.length} automatizaciones</div>
                <div className={`${B}__pack-list`}>
                  {pack.templates.map((t, i) => (
                    <span key={i} className={`${B}__pack-item`}>{t.name}</span>
                  ))}
                </div>
                <button
                  className={`${B}__pack-install`}
                  disabled={installingPack === pack.id}
                  onClick={async () => {
                    const available = planLimit - automations.length;
                    if (available <= 0) {
                      setLimitModal(true);
                      return;
                    }
                    const toInstall = Math.min(pack.templates.length, available);
                    const msg = toInstall < pack.templates.length
                      ? `Su plan permite ${planLimit} automatizaciones y ya tiene ${automations.length}. Solo se pueden instalar ${toInstall} de ${pack.templates.length}. Desea continuar?`
                      : `Instalar ${toInstall} automatizaciones del pack ${pack.name}? Se crearan como borradores (debera enviarlas a Meta para activar).`;
                    if (!window.confirm(msg)) return;
                    setInstallingPack(pack.id);
                    let ok = 0, fail = 0;
                    for (let i = 0; i < toInstall; i++) {
                      try {
                        await svc.create({ ...pack.templates[i], action_type: 'send_whatsapp' });
                        ok++;
                      } catch { fail++; }
                    }
                    addNotification(`${ok} automatizaciones instaladas${fail ? `, ${fail} errores` : ''}`, ok > 0 ? 'success' : 'error');
                    setInstallingPack(null);
                    load();
                    setMainTab('automations');
                  }}
                >
                  {installingPack === pack.id ? 'Instalando...' : (planLimit - automations.length <= 0 ? 'Limite alcanzado' : `Instalar pack (${pack.templates.length})`)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {mainTab === 'automations' && (<>
      {stats && (
        <div className={`${B}__metrics`}>
          {[
            { icon: ZapIcon, value: active.length, label: 'Activas', color: '#10B981' },
            { icon: SendIcon, value: stats.sent_this_month, label: 'Enviados este mes', color: '#3B82F6' },
            { icon: BarChartIcon, value: `${stats.response_rate}%`, label: 'Tasa de respuesta', color: '#8B5CF6' },
            { icon: MessageIcon, value: stats.sent_total, label: 'Total histórico', color: '#F59E0B' },
          ].map((m, i) => (
            <div key={i} className={`${B}__metric`} style={{ '--metric-color': m.color }}>
              <div className={`${B}__metric-icon`}><m.icon size={18} /></div>
              <div className={`${B}__metric-body`}>
                <span className={`${B}__metric-value`}>{m.value}</span>
                <span className={`${B}__metric-label`}>{m.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {active.length > 0 && (
        <section className={`${B}__section`}>
          <div className={`${B}__section-header`}>
            <PlayIcon size={16} /><h2>Activas</h2><span className={`${B}__section-count`}>{active.length}</span>
          </div>
          <div className={`${B}__grid`}>
            {active.map((a, i) => (
              <AutomationCard key={a.id} rule={a} index={i}
                onToggle={handleToggle} onEdit={() => openWizard(a)} onDelete={() => setDeleteModal(a)}
                onDuplicate={handleDuplicate} onSubmitMeta={handleSubmitMeta}
                onCheckMeta={handleCheckMeta} onHistory={() => openHistory(a)} />
            ))}
          </div>
        </section>
      )}
      {inactive.length > 0 && (
        <section className={`${B}__section`}>
          <div className={`${B}__section-header`}>
            <EditIcon size={16} /><h2>Borradores e inactivas</h2><span className={`${B}__section-count`}>{inactive.length}</span>
          </div>
          <div className={`${B}__grid`}>
            {inactive.map((a, i) => (
              <AutomationCard key={a.id} rule={a} index={i}
                onToggle={handleToggle} onEdit={() => openWizard(a)} onDelete={() => setDeleteModal(a)}
                onDuplicate={handleDuplicate} onSubmitMeta={handleSubmitMeta}
                onCheckMeta={handleCheckMeta} onHistory={() => openHistory(a)} />
            ))}
          </div>
        </section>
      )}
      <SuggestedTemplates onUse={(tpl) => openWizard(tpl)} />
      {automations.length === 0 && (
        <div className={`${B}__empty`}>
          <div className={`${B}__empty-icon`}><ZapIcon size={32} /></div>
          <h3>Crea tu primera automatización</h3>
          <p>Envía recordatorios, mensajes de bienvenida, seguimientos post-visita y más — todo automático vía WhatsApp.</p>
          <button className={`${B}__btn-primary`} onClick={() => openWizard()}>
            <PlusIcon size={18} /><span>Crear automatización</span>
          </button>
        </div>
      )}
      {deleteModal && (
        <div className={`${B}__overlay`} onClick={() => setDeleteModal(null)}>
          <div className={`${B}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${B}__modal-icon ${B}__modal-icon--danger`}><TrashIcon size={24} /></div>
            <h3>Eliminar automatización</h3>
            <p>¿Eliminar <strong>"{deleteModal.name}"</strong>? Se perderá todo el historial de envíos.</p>
            <div className={`${B}__modal-btns`}>
              <button className={`${B}__btn-ghost`} onClick={() => setDeleteModal(null)}>Cancelar</button>
              <button className={`${B}__btn-danger`} onClick={() => handleDelete(deleteModal)}><TrashIcon size={14} /> Eliminar</button>
            </div>
          </div>
        </div>
      )}

      </>)}

      {limitModal && (
        <div className={`${B}__overlay`} onClick={() => setLimitModal(false)}>
          <div className={`${B}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${B}__modal-icon`} style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}><AlertIcon size={24} /></div>
            <h3>Límite de plan alcanzado</h3>
            <p>Su plan actual permite un máximo de <strong>{planLimit} automatizaciones</strong>. Para crear o activar más, actualice su plan o desactive una existente.</p>
            <div style={{ display: 'flex', gap: 8, padding: '12px 0 0', justifyContent: 'center', fontSize: 13, color: '#64748B' }}>
              <span>Activas: <strong style={{ color: '#10B981' }}>{automations.filter(a => a.is_enabled).length}</strong></span>
              <span>•</span>
              <span>Total: <strong>{automations.length}</strong></span>
              <span>•</span>
              <span>Límite: <strong style={{ color: '#F59E0B' }}>{planLimit}</strong></span>
            </div>
            <div className={`${B}__modal-btns`}>
              <button className={`${B}__btn-ghost`} onClick={() => setLimitModal(false)}>Entendido</button>
              <button className={`${B}__btn-primary`} onClick={() => { setLimitModal(false); window.open('/AlPelo-CRM/pricing', '_blank'); }}>
                <TrendingUpIcon size={14} /> Ver planes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function AutomationCard({ rule, index, onToggle, onEdit, onDelete, onDuplicate, onSubmitMeta, onCheckMeta, onHistory }) {
  const TriggerIcon = TRIGGER_ICONS[rule.trigger_type] || ZapIcon;
  const triggerColor = TRIGGER_COLORS[rule.trigger_type] || '#64748B';
  const meta = META_STATUS[rule.meta_template_status] || META_STATUS.draft;
  const MetaIcon = meta.icon;
  const msg = rule.action_config?.message || '';
  const cfg = rule.trigger_config || {};

  const triggerDesc = (() => {
    switch (rule.trigger_type) {
      case 'hours_before_appt': return `${cfg.hours || 24}h antes de cita`;
      case 'hours_after_complete': return `${cfg.hours || 2}h después de visita`;
      case 'days_since_visit': return `${cfg.days || 30} días sin visitar`;
      case 'visit_milestone': return `Al alcanzar ${cfg.milestone || 10} visitas`;
      case 'birthday': return 'Día del cumpleaños';
      case 'new_client': return 'Al registrar cliente';
      case 'no_show': return 'Después de no-show';
      case 'appointment_created': return 'Al crear cita';
      case 'appointment_cancelled': return 'Al cancelar cita';
      case 'payment_received': return 'Al recibir pago';
      case 'payment_pending': return 'Pago pendiente 24h';
      case 'client_anniversary': return 'Aniversario 1 año';
      default: return rule.trigger_name;
    }
  })();

  return (
    <div className={`${B}__card ${rule.is_enabled ? `${B}__card--active` : ''}`} style={{ '--card-color': triggerColor, animationDelay: `${index * 0.05}s` }}>
      <div className={`${B}__card-accent`} />

      <div className={`${B}__card-top`}>
        <div className={`${B}__card-icon`}><TriggerIcon size={20} /></div>
        <div className={`${B}__card-title`}>
          <h3>{rule.name}</h3>
          <span className={`${B}__card-trigger`}>{triggerDesc}</span>
        </div>
        <button className={`${B}__toggle ${rule.is_enabled ? `${B}__toggle--on` : ''}`} onClick={() => onToggle(rule)}>
          <div className={`${B}__toggle-track`}><div className={`${B}__toggle-knob`} /></div>
        </button>
      </div>
      <div className={`${B}__card-status`} style={{ '--status-color': meta.color, '--status-bg': meta.bg }}>
        <MetaIcon size={14} />
        <span>{meta.label}</span>
        {rule.meta_template_status === 'pending' && (
          <button className={`${B}__card-status-action`} onClick={() => onCheckMeta(rule)}><RefreshIcon size={12} /> Verificar</button>
        )}
      </div>
      {msg && (
        <div className={`${B}__card-bubble`}>
          <WhatsAppIcon />
          <p>{msg.length > 100 ? msg.slice(0, 100) + '…' : msg}</p>
        </div>
      )}
      {rule.chain_config && (
        <div className={`${B}__card-chain`}>
          <LinkIcon size={12} />
          <span>Seguimiento en {rule.chain_config.if_no_reply_days || 3} días si no responde</span>
        </div>
      )}
      <div className={`${B}__card-metrics`}>
        <span><SendIcon size={12} /> {rule.stats.sent} enviados</span>
        <span><MessageIcon size={12} /> {rule.stats.responded} respuestas</span>
      </div>
      <div className={`${B}__card-toolbar`}>
        <button onClick={() => onEdit(rule)} title="Editar"><EditIcon size={15} /></button>
        <button onClick={() => onHistory(rule)} title="Historial"><HistoryIcon size={15} /></button>
        <button onClick={() => onDuplicate(rule)} title="Duplicar"><CopyIcon size={15} /></button>
        {(rule.meta_template_status === 'draft' || rule.meta_template_status === 'rejected') && (
          <button className={`${B}__card-toolbar-meta`} onClick={() => onSubmitMeta(rule)}><SendIcon size={14} /> Enviar a Meta</button>
        )}
        <button className={`${B}__card-toolbar-delete`} onClick={onDelete}><TrashIcon size={15} /></button>
      </div>
    </div>
  );
}
function SuggestedTemplates({ onUse }) {
  const [templates, setTemplates] = useState([]);
  useEffect(() => { svc.getSuggestedTemplates().then(d => setTemplates(d.templates || [])); }, []);
  if (!templates.length) return null;

  return (
    <section className={`${B}__suggested`}>
      <div className={`${B}__section-header`}>
        <LayersIcon size={16} /><h2>Plantillas recomendadas</h2>
      </div>
      <p className={`${B}__suggested-desc`}>Automatizaciones pre-configuradas listas para personalizar y activar.</p>
      <div className={`${B}__suggested-grid`}>
        {templates.map((tpl, i) => {
          const TplIcon = TRIGGER_ICONS[tpl.trigger_type] || ZapIcon;
          const color = TRIGGER_COLORS[tpl.trigger_type] || '#64748B';
          return (
            <button key={i} className={`${B}__suggested-card`} style={{ '--tpl-color': color }} onClick={() => onUse(tpl)}>
              <div className={`${B}__suggested-icon`}><TplIcon size={20} /></div>
              <div className={`${B}__suggested-info`}>
                <strong>{tpl.name}</strong>
                <span>{(tpl.action_config?.message || '').slice(0, 60)}…</span>
              </div>
              <ChevronRight />
            </button>
          );
        })}
      </div>
    </section>
  );
}
function AutomationWizard({ triggers, editingRule, onClose, addNotification }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [triggerConfig, setTriggerConfig] = useState({});
  const [filterConfig, setFilterConfig] = useState({});
  const [message, setMessage] = useState('');
  const [evalHour, setEvalHour] = useState(null);
  const [cooldownDays, setCooldownDays] = useState(7);
  const [maxPerDay, setMaxPerDay] = useState(20);
  const [chainEnabled, setChainEnabled] = useState(false);
  const [chainDays, setChainDays] = useState(3);
  const [chainMessage, setChainMessage] = useState('');
  const [audience, setAudience] = useState(null);
  const [previewClients, setPreviewClients] = useState([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [headerType, setHeaderType] = useState('');
  const [headerMedia, setHeaderMedia] = useState(null);
  const [headerText, setHeaderText] = useState('');

  useEffect(() => {
    if (editingRule) {
      if (editingRule.id) {
        setName(editingRule.name || ''); setTriggerType(editingRule.trigger_type || '');
        setTriggerConfig(editingRule.trigger_config || {}); setFilterConfig(editingRule.filter_config || {});
        setMessage(editingRule.action_config?.message || ''); setEvalHour(editingRule.eval_hour);
        setCooldownDays(editingRule.cooldown_days || 7); setMaxPerDay(editingRule.max_per_day || 20);
        setHeaderType(editingRule.action_config?.header_type || '');
        setHeaderMedia(editingRule.action_config?.header_media_url ? { preview: editingRule.action_config.header_media_url } : null);
        setHeaderText(editingRule.action_config?.header_text || '');
        if (editingRule.chain_config) { setChainEnabled(true); setChainDays(editingRule.chain_config.if_no_reply_days || 3); setChainMessage(editingRule.chain_config.then_message || ''); }
      } else {
        setName(editingRule.name || ''); setTriggerType(editingRule.trigger_type || '');
        setTriggerConfig(editingRule.trigger_config || {}); setMessage(editingRule.action_config?.message || '');
        setHeaderType(editingRule.action_config?.header_type || '');
        setHeaderMedia(editingRule.action_config?.header_media_url ? { preview: editingRule.action_config.header_media_url } : null);
        setHeaderText(editingRule.action_config?.header_text || '');
        setEvalHour(editingRule.eval_hour || null); setCooldownDays(editingRule.cooldown_days || 7); setMaxPerDay(editingRule.max_per_day || 20);
      }
    }
    svc.getClientsPreview().then(setPreviewClients);
  }, [editingRule]);

  useEffect(() => {
    if (triggerType) svc.previewAudience(triggerType, triggerConfig, filterConfig).then(setAudience);
  }, [triggerType, JSON.stringify(triggerConfig), JSON.stringify(filterConfig)]);

  const selectedTrigger = triggers.find(t => t.type === triggerType);
  const availableVars = selectedTrigger?.variables || [];
  const textareaRef = useRef(null);

  const renderPreview = () => {
    const c = previewClients[previewIdx];
    let r = message || '';
    if (c) r = r.replace(/\{\{nombre\}\}/g, (c.name || 'Juan').split(' ')[0]).replace(/\{\{negocio\}\}/g, 'Tu Negocio');
    return r.replace(/\{\{dias\}\}/g, triggerConfig.days || '30').replace(/\{\{hora\}\}/g, '10:00 AM')
      .replace(/\{\{fecha\}\}/g, '15/04/2026').replace(/\{\{profesional\}\}/g, 'Carlos')
      .replace(/\{\{servicio\}\}/g, 'Consulta').replace(/\{\{descuento\}\}/g, '20%');
  };

  const insertVar = (v) => {
    const ta = textareaRef.current;
    if (!ta) { setMessage(prev => prev + `{{${v}}}`); return; }
    const s = ta.selectionStart, e = ta.selectionEnd;
    const ins = `{{${v}}}`;
    setMessage(message.slice(0, s) + ins + message.slice(e));
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + ins.length; ta.focus(); }, 0);
  };

  const handleSave = async (goToMeta = false) => {
    setSaving(true);
    try {
      let headerMediaUrl = null;
      if ((headerType === 'IMAGE' || headerType === 'VIDEO') && headerMedia?.file) {
        headerMediaUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(headerMedia.file);
        });
      } else if (headerMedia?.preview && !headerMedia?.file) {
        headerMediaUrl = headerMedia.preview;
      }

      const actionConfig = { message };
      if (headerType) {
        actionConfig.header_type = headerType;
        if (headerType === 'TEXT') actionConfig.header_text = headerText;
        else if (headerMediaUrl) actionConfig.header_media_url = headerMediaUrl;
      }

      const payload = {
        name, trigger_type: triggerType, trigger_config: triggerConfig, filter_config: filterConfig,
        action_type: 'send_whatsapp', action_config: actionConfig,
        chain_config: chainEnabled ? { if_no_reply_days: chainDays, then_message: chainMessage } : null,
        cooldown_days: cooldownDays, max_per_day: maxPerDay, eval_hour: evalHour,
      };
      let saved;
      if (editingRule?.id) saved = await svc.update(editingRule.id, payload);
      else saved = await svc.create(payload);

      if (goToMeta && saved?.id) {
        try {
          const res = await svc.submitToMeta(saved.id);
          addNotification(`Plantilla "${res.template_name}" enviada a Meta`, 'success');
        } catch (e) { addNotification(e.message, 'warning'); }
      } else {
        addNotification(editingRule?.id ? 'Automatización actualizada' : 'Automatización creada', 'success');
      }
      onClose();
    } catch (e) { addNotification(e.message, 'error'); }
    setSaving(false);
  };

  const canNext = step === 1 ? !!triggerType && !!name : step === 2 ? true : step === 3 ? message.trim().length > 10 : true;

  const steps = [
    { num: 1, label: 'Trigger', icon: TargetIcon },
    { num: 2, label: 'Audiencia', icon: UsersIcon },
    { num: 3, label: 'Mensaje', icon: MessageIcon },
    { num: 4, label: 'Resumen', icon: CheckIcon },
  ];

  const grouped = useMemo(() => {
    const g = {};
    triggers.forEach(t => { const c = t.category || 'other'; if (!g[c]) g[c] = []; g[c].push(t); });
    return g;
  }, [triggers]);

  const pct = audience ? Math.round((audience.matching / Math.max(audience.total_clients, 1)) * 100) : 0;

  return (
    <div className={`${B}__wizard`}>
      <div className={`${B}__wz-header`}>
        <button className={`${B}__wz-close`} onClick={onClose}><XIcon size={20} /></button>
        <h2>{editingRule?.id ? 'Editar automatización' : 'Nueva automatización'}</h2>
        <div className={`${B}__wz-steps`}>
          {steps.map(s => (
            <button key={s.num}
              className={`${B}__wz-step ${s.num === step ? 'is-active' : ''} ${s.num < step ? 'is-done' : ''}`}
              onClick={() => s.num < step && setStep(s.num)}>
              <div className={`${B}__wz-step-circle`}>
                {s.num < step ? <CheckIcon size={12} /> : <s.icon size={12} />}
              </div>
              <span>{s.label}</span>
            </button>
          ))}
          <div className={`${B}__wz-progress`} style={{ width: `${((step - 1) / 3) * 100}%` }} />
        </div>
      </div>
      <div className={`${B}__wz-body`}>
        {step === 1 && (
          <div className={`${B}__wz-content`}>
            <div className={`${B}__field`}>
              <label>Nombre de la automatización</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Recordatorio de cita 24h" className={`${B}__input`} />
            </div>

            <div className={`${B}__field`}>
              <label>¿Cuándo se activa?</label>
              <p className={`${B}__field-hint`}>Selecciona el evento que dispara esta automatización</p>
            </div>

            {Object.entries(grouped).map(([cat, items]) => {
              const cm = CATEGORY_META[cat] || { label: cat, color: '#64748B', icon: ZapIcon };
              return (
                <div key={cat} className={`${B}__trigger-group`}>
                  <div className={`${B}__trigger-group-label`} style={{ color: cm.color }}><cm.icon size={14} /> {cm.label}</div>
                  <div className={`${B}__trigger-grid`}>
                    {items.map(t => {
                      const TI = TRIGGER_ICONS[t.type] || ZapIcon;
                      const sel = triggerType === t.type;
                      return (
                        <button key={t.type} className={`${B}__trigger-card ${sel ? 'is-selected' : ''}`}
                          style={{ '--tc': TRIGGER_COLORS[t.type] || '#64748B' }}
                          onClick={() => { setTriggerType(t.type); if (!name) setName(t.name); }}>
                          <div className={`${B}__trigger-card-icon`}><TI size={22} /></div>
                          <strong>{t.name}</strong>
                          <span>{t.description}</span>
                          {sel && <div className={`${B}__trigger-card-check`}><CheckIcon size={14} /></div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {selectedTrigger?.config_fields?.length > 0 && (
              <div className={`${B}__config-panel`}>
                <h4><TargetIcon size={14} /> Configuración del trigger</h4>
                <div className={`${B}__config-grid`}>
                  {selectedTrigger.config_fields.map(f => (
                    <div key={f.key} className={`${B}__config-item`}>
                      <label>{f.label}</label>
                      <input type="number" min={f.min} max={f.max} value={triggerConfig[f.key] || f.default}
                        onChange={e => setTriggerConfig({ ...triggerConfig, [f.key]: parseInt(e.target.value) || f.default })} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {triggerType && (
              <div className={`${B}__config-panel`}>
                <h4><LayersIcon size={14} /> Configuración avanzada</h4>
                <div className={`${B}__config-grid ${B}__config-grid--3`}>
                  <div className={`${B}__config-item`}>
                    <label>Hora de evaluación</label>
                    <p className={`${B}__config-hint`}>¿A qué hora revisa y envía?</p>
                    <select value={evalHour ?? ''} onChange={e => setEvalHour(e.target.value ? parseInt(e.target.value) : null)}>
                      <option value="">Tiempo real (inmediato)</option>
                      {Array.from({ length: 14 }, (_, i) => i + 7).map(h => (
                        <option key={h} value={h}>{`${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`} (Colombia)</option>
                      ))}
                    </select>
                  </div>
                  <div className={`${B}__config-item`}>
                    <label>Cooldown por cliente</label>
                    <p className={`${B}__config-hint`}>No repetir al mismo cliente en</p>
                    <div className={`${B}__config-inline`}>
                      <input type="number" min={1} max={365} value={cooldownDays} onChange={e => setCooldownDays(parseInt(e.target.value) || 1)} />
                      <span>días</span>
                    </div>
                  </div>
                  <div className={`${B}__config-item`}>
                    <label>Máx. envíos por día</label>
                    <p className={`${B}__config-hint`}>Protege tu cuenta de WhatsApp</p>
                    <input type="number" min={1} max={500} value={maxPerDay} onChange={e => setMaxPerDay(parseInt(e.target.value) || 20)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {step === 2 && <WizardStep2 filterConfig={filterConfig} setFilterConfig={setFilterConfig} audience={audience} />}
        {step === 3 && (
          <div className={`${B}__wz-split`}>
            <div className={`${B}__editor`}>
              <div className={`${B}__editor-field`}>
                <label className={`${B}__field-label`}>Encabezado (opcional)</label>
                <select value={headerType} onChange={e => { setHeaderType(e.target.value); setHeaderMedia(null); setHeaderText(''); }} className={`${B}__editor-select`}>
                  <option value="">Sin encabezado</option>
                  <option value="IMAGE">Imagen</option>
                  <option value="VIDEO">Video</option>
                  <option value="TEXT">Texto</option>
                </select>
                {headerType === 'IMAGE' && (
                  <div className={`${B}__editor-media`}>
                    {headerMedia?.preview ? (
                      <div className={`${B}__editor-media-preview`}>
                        <img src={headerMedia.preview} alt="" />
                        <button type="button" className={`${B}__editor-media-remove`} onClick={() => setHeaderMedia(null)}>✕</button>
                      </div>
                    ) : (
                      <label className={`${B}__editor-media-upload`}>
                        <input type="file" accept="image/*" onChange={e => {
                          const f = e.target.files?.[0];
                          if (f && f.size <= 5 * 1024 * 1024) setHeaderMedia({ file: f, preview: URL.createObjectURL(f) });
                          else if (f) addNotification('Imagen max 5MB', 'error');
                        }} hidden />
                        <span>Seleccionar imagen (max 5MB, JPG/PNG)</span>
                      </label>
                    )}
                  </div>
                )}
                {headerType === 'VIDEO' && (
                  <div className={`${B}__editor-media`}>
                    {headerMedia?.preview ? (
                      <div className={`${B}__editor-media-preview`}>
                        <video src={headerMedia.preview} controls style={{ maxHeight: 140, width: '100%', borderRadius: 8 }} />
                        <button type="button" className={`${B}__editor-media-remove`} onClick={() => setHeaderMedia(null)}>✕</button>
                      </div>
                    ) : (
                      <label className={`${B}__editor-media-upload`}>
                        <input type="file" accept="video/mp4" onChange={e => {
                          const f = e.target.files?.[0];
                          if (f && f.size <= 16 * 1024 * 1024) setHeaderMedia({ file: f, preview: URL.createObjectURL(f) });
                          else if (f) addNotification('Video max 16MB', 'error');
                        }} hidden />
                        <span>Seleccionar video (max 16MB, MP4)</span>
                      </label>
                    )}
                  </div>
                )}
                {headerType === 'TEXT' && (
                  <input type="text" value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="Texto del encabezado" maxLength={60} className={`${B}__editor-input`} />
                )}
                {(headerType === 'IMAGE' || headerType === 'VIDEO') && (
                  <p className={`${B}__editor-media-warn`}>Las plantillas con imagen o video tienen revision mas estricta por Meta. Usa imagenes profesionales.</p>
                )}
              </div>
              <label className={`${B}__field-label`}>Mensaje WhatsApp</label>
              <textarea ref={textareaRef} value={message} onChange={e => setMessage(e.target.value)} rows={8}
                placeholder="Escribe el mensaje que recibirán tus clientes..." className={`${B}__editor-ta`} />
              <div className={`${B}__editor-bar`}>
                <span className={message.length > 500 ? `${B}__editor-warn` : ''}>{message.length} caracteres</span>
                {message.length > 0 && message.length <= 160 && <span className={`${B}__editor-good`}>Mensaje corto = +40% respuesta</span>}
              </div>
              <div className={`${B}__vars`}>
                <label>Insertar variable:</label>
                <div className={`${B}__var-list`}>
                  {availableVars.map(v => (
                    <button key={v} className={`${B}__var-btn`} onClick={() => insertVar(v)}>{`{{${v}}}`}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className={`${B}__phone-preview`}>
              <label className={`${B}__field-label`}>Vista previa</label>
              <div className={`${B}__phone`}>
                <div className={`${B}__phone-notch`} />
                <div className={`${B}__phone-wa-bar`}><WhatsAppIcon /> WhatsApp</div>
                <div className={`${B}__phone-chat`}>
                  {message ? (
                    <div className={`${B}__phone-bubble`}>
                      {headerType === 'IMAGE' && headerMedia?.preview && (
                        <img src={headerMedia.preview} alt="" style={{ width: '100%', borderRadius: '8px 8px 0 0', maxHeight: 140, objectFit: 'cover', marginBottom: 6 }} />
                      )}
                      {headerType === 'VIDEO' && headerMedia?.preview && (
                        <video src={headerMedia.preview} style={{ width: '100%', borderRadius: '8px 8px 0 0', maxHeight: 140, objectFit: 'cover', marginBottom: 6 }} />
                      )}
                      {headerType === 'TEXT' && headerText && (
                        <p style={{ fontWeight: 700, marginBottom: 4 }}>{headerText}</p>
                      )}
                      <p>{renderPreview()}</p>
                      <span className={`${B}__phone-time`}>10:00 AM ✓✓</span>
                    </div>
                  ) : (
                    <div className={`${B}__phone-empty`}>Escribe un mensaje para ver la vista previa</div>
                  )}
                </div>
              </div>
              {previewClients.length > 0 && (
                <div className={`${B}__phone-selector`}>
                  <label>Datos de:</label>
                  <select value={previewIdx} onChange={e => setPreviewIdx(+e.target.value)}>
                    {previewClients.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
        {step === 4 && (
          <div className={`${B}__wz-content`}>
            <div className={`${B}__summary`}>
              <div className={`${B}__summary-header`}>
                {(() => { const TI = TRIGGER_ICONS[triggerType] || ZapIcon; return <TI size={22} />; })()}
                <h3>{name}</h3>
              </div>
              <div className={`${B}__summary-grid`}>
                {[
                  ['Trigger', selectedTrigger?.name || triggerType],
                  triggerConfig.hours && ['Tiempo', `${triggerConfig.hours} horas`],
                  triggerConfig.days && ['Inactividad', `${triggerConfig.days} días`],
                  ['Audiencia', `${audience?.matching || 0} clientes coinciden hoy`],
                  ['Evaluación', evalHour != null ? `${evalHour}:00 diario (Colombia)` : 'Tiempo real'],
                  ['Cooldown', `${cooldownDays} días entre envíos por cliente`],
                  ['Máx. diario', `${maxPerDay} envíos`],
                ].filter(Boolean).map(([label, value], i) => (
                  <div key={i} className={`${B}__summary-row`}>
                    <span className={`${B}__summary-label`}>{label}</span>
                    <span className={`${B}__summary-value`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`${B}__summary-msg`}>
              <label className={`${B}__field-label`}><MessageIcon size={14} /> Mensaje</label>
              <div className={`${B}__phone-bubble ${B}__phone-bubble--full`}>
                <p>{renderPreview()}</p>
              </div>
            </div>
            <div className={`${B}__chain`}>
              <div className={`${B}__chain-top`}>
                <LinkIcon size={18} /><h4>Seguimiento automático</h4>
                <span className={`${B}__chain-badge`}>Opcional</span>
                <button className={`${B}__toggle ${chainEnabled ? `${B}__toggle--on` : ''}`} onClick={() => setChainEnabled(!chainEnabled)}>
                  <div className={`${B}__toggle-track`}><div className={`${B}__toggle-knob`} /></div>
                </button>
              </div>
              {chainEnabled && (
                <div className={`${B}__chain-body`}>
                  <p>Si el cliente <strong>no responde</strong> en:</p>
                  <div className={`${B}__config-inline`}>
                    <input type="number" min={1} max={30} value={chainDays} onChange={e => setChainDays(parseInt(e.target.value) || 3)} />
                    <span>días, enviar este mensaje:</span>
                  </div>
                  <textarea value={chainMessage} onChange={e => setChainMessage(e.target.value)} rows={3}
                    placeholder="Mensaje de seguimiento..." className={`${B}__editor-ta`} />
                  <div className={`${B}__vars`}>
                    <label>Variables:</label>
                    <div className={`${B}__var-list`}>
                      {availableVars.map(v => <button key={v} className={`${B}__var-btn`} onClick={() => setChainMessage(prev => prev + `{{${v}}}`)}>{`{{${v}}}`}</button>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className={`${B}__timeline`}>
              <label className={`${B}__field-label`}><ClockIcon size={14} /> Línea de tiempo</label>
              <div className={`${B}__timeline-track`}>
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
                  <div key={i} className={`${B}__timeline-dot`}>
                    <div className={`${B}__timeline-circle`} />
                    <span>{d}</span>
                    <small>{evalHour != null ? `${evalHour}:00` : 'Auto'}</small>
                  </div>
                ))}
              </div>
              <p className={`${B}__timeline-est`}>Estimado: ~{Math.min(audience?.matching || 0, maxPerDay)} envíos/día</p>
            </div>
          </div>
        )}
      </div>
      <div className={`${B}__wz-footer`}>
        {step > 1 && <button className={`${B}__btn-ghost`} onClick={() => setStep(step - 1)}><ChevronLeft /> Anterior</button>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {step < 4 ? (
            <button className={`${B}__btn-primary`} onClick={() => setStep(step + 1)} disabled={!canNext}>Siguiente <ChevronRight /></button>
          ) : (
            <>
              <button className={`${B}__btn-ghost`} onClick={() => handleSave(false)} disabled={saving}>{saving ? 'Guardando...' : 'Guardar borrador'}</button>
              <button className={`${B}__btn-primary`} onClick={() => handleSave(true)} disabled={saving}><SendIcon size={15} /> {saving ? 'Enviando...' : 'Guardar y enviar a Meta'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function WizardStep2({ filterConfig, setFilterConfig, audience }) {
  const FILTER_OPTIONS = [
    { key: 'status', label: 'Estado del cliente', type: 'select', options: ['activo', 'vip', 'en_riesgo', 'inactivo', 'nuevo'] },
    { key: 'tags', label: 'Tag', type: 'text' },
    { key: 'min_visits', label: 'Mínimo de visitas', type: 'number' },
    { key: 'min_spend', label: 'Gasto mínimo (COP)', type: 'number' },
    { key: 'service', label: 'Servicio favorito', type: 'text' },
  ];

  const [filters, setFilters] = useState(() => {
    const f = [];
    if (filterConfig.status) f.push({ key: 'status', value: Array.isArray(filterConfig.status) ? filterConfig.status[0] : filterConfig.status });
    if (filterConfig.tags?.length) f.push({ key: 'tags', value: filterConfig.tags[0] });
    if (filterConfig.min_visits) f.push({ key: 'min_visits', value: filterConfig.min_visits });
    if (filterConfig.min_spend) f.push({ key: 'min_spend', value: filterConfig.min_spend });
    if (filterConfig.service) f.push({ key: 'service', value: filterConfig.service });
    return f;
  });

  useEffect(() => {
    const cfg = {};
    filters.forEach(f => {
      if (!f.value && f.value !== 0) return;
      if (f.key === 'status') cfg.status = [f.value];
      else if (f.key === 'tags') cfg.tags = [f.value];
      else if (f.key === 'min_visits') cfg.min_visits = parseInt(f.value) || 0;
      else if (f.key === 'min_spend') cfg.min_spend = parseInt(f.value) || 0;
      else if (f.key === 'service') cfg.service = f.value;
    });
    setFilterConfig(cfg);
  }, [filters]);

  const addFilter = () => {
    const avail = FILTER_OPTIONS.filter(o => !filters.some(f => f.key === o.key));
    if (avail.length) setFilters([...filters, { key: avail[0].key, value: '' }]);
  };

  const pct = audience ? Math.round((audience.matching / Math.max(audience.total_clients, 1)) * 100) : 0;

  return (
    <div className={`${B}__wz-content`}>
      <div className={`${B}__field`}>
        <label>¿A quién le llega?</label>
        <p className={`${B}__field-hint`}>Filtra la audiencia o déjalo vacío para enviar a todos los clientes que cumplan el trigger.</p>
      </div>

      {filters.length === 0 && (
        <div className={`${B}__audience-all`}>
          <UsersIcon size={20} />
          <div><strong>Todos los clientes</strong><span>Se enviará a todos los que cumplan la condición del trigger</span></div>
        </div>
      )}

      <div className={`${B}__filters`}>
        {filters.map((f, i) => {
          const opt = FILTER_OPTIONS.find(o => o.key === f.key);
          return (
            <div key={i} className={`${B}__filter-row`}>
              <select value={f.key} onChange={e => { const nf = [...filters]; nf[i] = { ...nf[i], key: e.target.value, value: '' }; setFilters(nf); }}>
                {FILTER_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              {opt?.type === 'select' ? (
                <select value={f.value} onChange={e => { const nf = [...filters]; nf[i] = { ...nf[i], value: e.target.value }; setFilters(nf); }}>
                  <option value="">Seleccionar...</option>
                  {opt.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={opt?.type === 'number' ? 'number' : 'text'} value={f.value}
                  onChange={e => { const nf = [...filters]; nf[i] = { ...nf[i], value: e.target.value }; setFilters(nf); }} placeholder={opt?.label} />
              )}
              <button className={`${B}__filter-x`} onClick={() => setFilters(filters.filter((_, j) => j !== i))}><XIcon size={16} /></button>
            </div>
          );
        })}
        <button className={`${B}__filter-add`} onClick={addFilter}><PlusIcon size={14} /> Agregar filtro</button>
      </div>
      {audience && (
        <div className={`${B}__audience`}>
          <div className={`${B}__audience-top`}><EyeIcon size={18} /><h4>Preview de audiencia</h4></div>
          <div className={`${B}__audience-bar`}><div className={`${B}__audience-fill`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
          <div className={`${B}__audience-info`}>
            <span className={`${B}__audience-num`}>{audience.matching}</span>
            <span>de {audience.total_clients} clientes coinciden con esta automatización</span>
          </div>
          {audience.sample_names?.length > 0 && (
            <div className={`${B}__audience-samples`}>
              {audience.sample_names.map((n, i) => <span key={i} className={`${B}__audience-chip`}>{n}</span>)}
              {audience.matching > 5 && <span className={`${B}__audience-more`}>+{audience.matching - 5} más</span>}
            </div>
          )}
          {audience.matching === 0 && (
            <p className={`${B}__audience-empty`}>Ningún cliente coincide ahora — esto puede cambiar cuando haya citas, visitas o clientes nuevos.</p>
          )}
        </div>
      )}
    </div>
  );
}
function ExecutionHistory({ rule, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { svc.getRuleExecutions(rule.id, 100).then(d => { setData(d); setLoading(false); }); }, [rule.id]);

  const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso), now = new Date(), diff = now - d;
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const statusCls = { sent: 'sent', delivered: 'delivered', responded: 'responded', failed: 'failed' };
  const statusLabel = { sent: 'Enviado', delivered: 'Entregado', responded: 'Respondió', failed: 'Falló' };

  return (
    <div className={`${B}__history`}>
      <div className={`${B}__history-top`}>
        <button className={`${B}__btn-ghost`} onClick={onBack}><ChevronLeft /> Volver</button>
        <h2><HistoryIcon size={20} /> {rule.name}</h2>
      </div>

      {data?.month_stats && (
        <div className={`${B}__metrics`}>
          {[
            { icon: SendIcon, value: data.month_stats.sent, label: 'Enviados este mes', color: '#3B82F6' },
            { icon: MessageIcon, value: data.month_stats.responded, label: 'Respondieron', color: '#10B981' },
            { icon: BarChartIcon, value: `${data.month_stats.response_rate}%`, label: 'Tasa respuesta', color: '#8B5CF6' },
          ].map((m, i) => (
            <div key={i} className={`${B}__metric`} style={{ '--metric-color': m.color }}>
              <div className={`${B}__metric-icon`}><m.icon size={18} /></div>
              <div className={`${B}__metric-body`}><span className={`${B}__metric-value`}>{m.value}</span><span className={`${B}__metric-label`}>{m.label}</span></div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className={`${B}__loading`}><div className={`${B}__spinner`} /><span>Cargando historial...</span></div>
      ) : (data?.executions || []).length === 0 ? (
        <div className={`${B}__empty`}><div className={`${B}__empty-icon`}><HistoryIcon size={32} /></div><h3>Sin ejecuciones</h3><p>Esta automatización aún no ha enviado mensajes.</p></div>
      ) : (
        <div className={`${B}__history-list`}>
          {data.executions.map(ex => (
            <div key={ex.id} className={`${B}__history-row`}>
              <span className={`${B}__history-time`}>{fmt(ex.created_at)}</span>
              <span className={`${B}__history-arrow`}>→</span>
              <span className={`${B}__history-client`}>{ex.client_name}</span>
              <span className={`${B}__history-msg`}>{ex.message_preview}</span>
              <span className={`${B}__history-badge ${B}__history-badge--${statusCls[ex.status] || 'sent'}`}>{statusLabel[ex.status] || ex.status}</span>
              {ex.is_chain && <span className={`${B}__history-chain`}>Cadena</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
