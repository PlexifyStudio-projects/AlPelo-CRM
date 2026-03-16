import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../context/NotificationContext';
import contentGeneratorService from '../../services/contentGeneratorService';

const B = 'content-studio';

// =============================================
// SVG Icons
// =============================================
const ImageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const VideoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const ZapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const StoryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="2" width="12" height="20" rx="3" ry="3" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const SparkleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
  </svg>
);

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const InstagramIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const PaletteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="10.5" r="2.5" />
    <circle cx="8.5" cy="7.5" r="2.5" />
    <circle cx="6.5" cy="12.5" r="2.5" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const HashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </svg>
);

const PlayIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const MusicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const WandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
    <path d="M17.8 11.8L19 13" /><path d="M15 9h0" /><path d="M17.8 6.2L19 5" />
    <path d="M12.2 6.2L11 5" /><path d="M12.2 11.8L11 13" />
    <path d="M2 22l10-10" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const PhoneFrameIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const BarChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

// =============================================
// Constants
// =============================================
const CONTENT_TYPES = [
  {
    id: 'image',
    label: 'Imagen Promocional',
    desc: 'Genera imagenes profesionales con IA optimizadas para cada red social',
    icon: ImageIcon,
    gradient: 'linear-gradient(135deg, #2D5A3D, #4E9466)',
    gradientBg: 'linear-gradient(135deg, rgba(45,90,61,0.08), rgba(78,148,102,0.04))',
    popular: true,
  },
  {
    id: 'video',
    label: 'Video con Presentador IA',
    desc: 'Crea videos con un avatar IA que presenta tu negocio de forma profesional',
    icon: VideoIcon,
    gradient: 'linear-gradient(135deg, #1A1A1A, #4A4A44)',
    gradientBg: 'linear-gradient(135deg, rgba(26,26,26,0.08), rgba(74,74,68,0.04))',
    popular: false,
  },
  {
    id: 'quick',
    label: 'Publicacion Rapida',
    desc: 'Crea, programa y publica contenido optimizado en menos de 2 minutos',
    icon: ZapIcon,
    gradient: 'linear-gradient(135deg, #C9A84C, #E4CC7A)',
    gradientBg: 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(228,204,122,0.04))',
    popular: false,
  },
  {
    id: 'story',
    label: 'Historia / Reel',
    desc: 'Contenido vertical optimizado para Instagram Stories, Reels y TikTok',
    icon: StoryIcon,
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    gradientBg: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(167,139,250,0.04))',
    popular: false,
  },
];

const IMAGE_STYLES = [
  { id: 'profesional', label: 'Profesional' },
  { id: 'moderno', label: 'Moderno' },
  { id: 'elegante', label: 'Elegante' },
  { id: 'vibrante', label: 'Vibrante' },
  { id: 'minimalista', label: 'Minimalista' },
  { id: 'corporativo', label: 'Corporativo' },
  { id: 'festivo', label: 'Festivo' },
  { id: 'premium', label: 'Premium' },
];

const COLOR_MOODS = [
  { id: 'auto', label: 'Auto (marca)' },
  { id: 'calido', label: 'Calido' },
  { id: 'frio', label: 'Frio' },
  { id: 'neutro', label: 'Neutro' },
  { id: 'vibrante', label: 'Vibrante' },
];

const IMAGE_DIMENSIONS = [
  { id: '1080x1080', label: '1080 x 1080', desc: 'Feed', ratio: '1 / 1' },
  { id: '1080x1920', label: '1080 x 1920', desc: 'Story', ratio: '9 / 16' },
  { id: '1200x628', label: '1200 x 628', desc: 'Facebook Ad', ratio: '1200 / 628' },
  { id: '1200x675', label: '1200 x 675', desc: 'Twitter', ratio: '16 / 9' },
];

const AVATAR_STYLES = [
  { id: 'mujer_ejecutiva', label: 'Mujer Ejecutiva', gender: 'F' },
  { id: 'hombre_ejecutivo', label: 'Hombre Ejecutivo', gender: 'M' },
  { id: 'mujer_casual', label: 'Mujer Casual', gender: 'F' },
  { id: 'hombre_casual', label: 'Hombre Casual', gender: 'M' },
  { id: 'mujer_elegante', label: 'Mujer Elegante', gender: 'F' },
  { id: 'hombre_elegante', label: 'Hombre Elegante', gender: 'M' },
];

const VIDEO_LANGUAGES = [
  { id: 'es', label: 'Espanol' },
  { id: 'en', label: 'English' },
  { id: 'pt', label: 'Portugues' },
];

const VIDEO_DURATIONS = [
  { id: '15', label: '15s', cost: '$0.50' },
  { id: '30', label: '30s', cost: '$1.00' },
  { id: '60', label: '60s', cost: '$1.80' },
];

const VIDEO_BACKGROUNDS = [
  { id: 'office', label: 'Oficina' },
  { id: 'studio', label: 'Estudio' },
  { id: 'solid', label: 'Color solido' },
];

const STORY_DURATIONS = [
  { id: '5', label: '5s' },
  { id: '10', label: '10s' },
  { id: '15', label: '15s' },
];

const MUSIC_MOODS = [
  { id: 'energetico', label: 'Energetico' },
  { id: 'relajante', label: 'Relajante' },
  { id: 'profesional', label: 'Profesional' },
  { id: 'celebracion', label: 'Celebracion' },
];

const TONE_OPTIONS = [
  { id: 'profesional', label: 'Profesional' },
  { id: 'amigable', label: 'Amigable' },
  { id: 'divertido', label: 'Divertido' },
  { id: 'elegante', label: 'Elegante' },
];

const FONT_OPTIONS = [
  { id: 'Inter', label: 'Inter (Sans-serif)' },
  { id: 'Playfair Display', label: 'Playfair Display (Serif)' },
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Poppins', label: 'Poppins' },
];

const STATUS_META = {
  published: { label: 'Publicado', className: 'published' },
  scheduled: { label: 'Programado', className: 'scheduled' },
  draft: { label: 'Borrador', className: 'draft' },
  processing: { label: 'Procesando', className: 'processing' },
  failed: { label: 'Fallido', className: 'failed' },
};

// =============================================
// Mock Data
// =============================================
const MOCK_STATS = {
  generated: 24,
  published: 18,
  scheduled: 3,
  drafts: 3,
};

const MOCK_HISTORY = [
  {
    id: 'hist_001',
    type: 'image',
    url: 'https://placehold.co/1080x1080/2D5A3D/FFFFFF?text=Promo+Marzo',
    caption: 'Descubre nuestros servicios premium este mes',
    platforms: ['facebook', 'instagram'],
    status: 'published',
    created_at: '2026-03-15T10:30:00Z',
  },
  {
    id: 'hist_002',
    type: 'video',
    thumbnail_url: 'https://placehold.co/1080x1920/1A1A1A/C9A84C?text=Video+IA',
    caption: 'Conoce nuestro equipo de profesionales',
    platforms: ['instagram'],
    status: 'published',
    created_at: '2026-03-14T15:00:00Z',
  },
  {
    id: 'hist_003',
    type: 'quick',
    url: 'https://placehold.co/1080x1080/3D7A52/FFFFFF?text=Post+Rapido',
    caption: '20% de descuento en todos los servicios',
    platforms: ['facebook', 'instagram'],
    status: 'scheduled',
    created_at: '2026-03-14T09:00:00Z',
  },
  {
    id: 'hist_004',
    type: 'story',
    url: 'https://placehold.co/1080x1920/8B5CF6/FFFFFF?text=Story',
    caption: 'Detras de camaras del salon',
    platforms: ['instagram'],
    status: 'published',
    created_at: '2026-03-13T18:00:00Z',
  },
  {
    id: 'hist_005',
    type: 'image',
    url: 'https://placehold.co/1200x628/2D5A3D/FFFFFF?text=Facebook+Ad',
    caption: 'Campaña de recuperacion de clientes',
    platforms: ['facebook'],
    status: 'published',
    created_at: '2026-03-13T12:00:00Z',
  },
  {
    id: 'hist_006',
    type: 'quick',
    url: 'https://placehold.co/1080x1080/C9A84C/1A1A1A?text=Promo+VIP',
    caption: 'Programa VIP: beneficios exclusivos',
    platforms: ['facebook', 'instagram'],
    status: 'draft',
    created_at: '2026-03-12T16:00:00Z',
  },
  {
    id: 'hist_007',
    type: 'video',
    thumbnail_url: 'https://placehold.co/1080x1920/333330/FFFFFF?text=Tutorial',
    caption: 'Tutorial: cuidado del cabello en casa',
    platforms: ['instagram'],
    status: 'published',
    created_at: '2026-03-12T11:00:00Z',
  },
  {
    id: 'hist_008',
    type: 'story',
    url: 'https://placehold.co/1080x1920/A78BFA/FFFFFF?text=Reel',
    caption: 'Antes y despues: transformacion total',
    platforms: ['instagram'],
    status: 'published',
    created_at: '2026-03-11T14:30:00Z',
  },
  {
    id: 'hist_009',
    type: 'image',
    url: 'https://placehold.co/1080x1080/1E3D2A/C9A84C?text=Promo+Noche',
    caption: 'Horario nocturno disponible',
    platforms: ['facebook', 'instagram'],
    status: 'failed',
    created_at: '2026-03-11T08:00:00Z',
  },
  {
    id: 'hist_010',
    type: 'quick',
    url: 'https://placehold.co/1080x1080/4E9466/FFFFFF?text=Feriado',
    caption: 'Feliz dia! Estamos abiertos',
    platforms: ['facebook'],
    status: 'published',
    created_at: '2026-03-10T09:00:00Z',
  },
  {
    id: 'hist_011',
    type: 'image',
    url: 'https://placehold.co/1080x1080/2D5A3D/E4CC7A?text=Nuevo+Servicio',
    caption: 'Nuevo servicio de colorimetria',
    platforms: ['facebook', 'instagram'],
    status: 'scheduled',
    created_at: '2026-03-10T07:00:00Z',
  },
  {
    id: 'hist_012',
    type: 'story',
    url: 'https://placehold.co/1080x1920/8B5CF6/E4CC7A?text=Q%26A',
    caption: 'Preguntas y respuestas con nuestro equipo',
    platforms: ['instagram'],
    status: 'published',
    created_at: '2026-03-09T17:00:00Z',
  },
];

const MOCK_CALENDAR = (() => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const posts = [];
    if (i === 0) posts.push({ type: 'image', status: 'published' }, { type: 'quick', status: 'published' });
    if (i === 1) posts.push({ type: 'video', status: 'published' });
    if (i === 2) posts.push({ type: 'story', status: 'published' }, { type: 'image', status: 'published' });
    if (i === 4) posts.push({ type: 'quick', status: 'scheduled' });
    if (i === 5) posts.push({ type: 'image', status: 'scheduled' }, { type: 'story', status: 'scheduled' });
    days.push({ date: d, posts });
  }
  return days;
})();

const AI_SUGGESTIONS = [
  {
    id: 's1',
    text: 'Dame ideas para publicaciones de esta semana',
    type: 'quick',
    fill: { topic: 'Ideas creativas para publicaciones semanales del salon' },
  },
  {
    id: 's2',
    text: 'Sugiere un tema para campana de recuperacion',
    type: 'quick',
    fill: { topic: 'Campana de recuperacion: trae un amigo y ambos reciben 15% de descuento' },
  },
  {
    id: 's3',
    text: 'Escribe un copy para promocion de servicios',
    type: 'quick',
    fill: { topic: 'Promocion especial: servicios premium con 20% de descuento esta semana' },
  },
  {
    id: 's4',
    text: 'Crea una historia destacando el equipo',
    type: 'story',
    fill: { prompt: 'Historia mostrando el equipo profesional del salon, ambiente elegante y moderno' },
  },
];

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const TYPE_COLORS = {
  image: '#2D5A3D',
  video: '#1A1A1A',
  quick: '#C9A84C',
  story: '#8B5CF6',
};

// =============================================
// Main Component
// =============================================
const ContentStudio = () => {
  const { addNotification } = useNotification();
  const workspaceRef = useRef(null);

  // State
  const [selectedType, setSelectedType] = useState(null);
  const [metaStatus, setMetaStatus] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genMessage, setGenMessage] = useState('');
  const [generatedContent, setGeneratedContent] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showBrandKit, setShowBrandKit] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(AI_SUGGESTIONS);
  const [historyPage, setHistoryPage] = useState(1);
  const [calendarSelectedDay, setCalendarSelectedDay] = useState(null);
  const [previewShimmer, setPreviewShimmer] = useState(false);

  // Brand Kit
  const [brandKit, setBrandKit] = useState({
    logo_url: null,
    primary_color: '#2D5A3D',
    secondary_color: '#1A1A1A',
    accent_color: '#C9A84C',
    font: 'Inter',
    tagline: '',
    tone: 'profesional',
  });

  // Image form
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState('profesional');
  const [imageColorMood, setImageColorMood] = useState('auto');
  const [imageDimensions, setImageDimensions] = useState('1080x1080');
  const [useBrandOverlay, setUseBrandOverlay] = useState(true);

  // Video form
  const [videoScript, setVideoScript] = useState('');
  const [videoAvatar, setVideoAvatar] = useState('mujer_ejecutiva');
  const [videoLanguage, setVideoLanguage] = useState('es');
  const [videoDuration, setVideoDuration] = useState('30');
  const [videoBackground, setVideoBackground] = useState('studio');
  const [videoBgColor, setVideoBgColor] = useState('#2D5A3D');

  // Quick post form
  const [quickCaption, setQuickCaption] = useState('');
  const [quickTopic, setQuickTopic] = useState('');
  const [quickPlatforms, setQuickPlatforms] = useState(['facebook', 'instagram']);
  const [quickImageGenerated, setQuickImageGenerated] = useState(null);

  // Story form
  const [storyPrompt, setStoryPrompt] = useState('');
  const [storyTextOverlay, setStoryTextOverlay] = useState('');
  const [storyDuration, setStoryDuration] = useState('10');
  const [storyMusicMood, setStoryMusicMood] = useState('energetico');

  // Schedule
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Caption for publish
  const [publishCaption, setPublishCaption] = useState('');
  const [publishPlatforms, setPublishPlatforms] = useState(['facebook', 'instagram']);

  // Load meta status and history on mount
  useEffect(() => {
    const init = async () => {
      const [status, kit, hist] = await Promise.all([
        contentGeneratorService.getMetaStatus(),
        contentGeneratorService.getBrandKit(),
        contentGeneratorService.getHistory(),
      ]);
      setMetaStatus(status);
      if (kit) setBrandKit(kit);
      const items = hist.items || [];
      setHistory(items.length > 0 ? items : MOCK_HISTORY);
      setLoadingHistory(false);
    };
    init();
  }, []);

  // Scroll to workspace when type is selected
  useEffect(() => {
    if (selectedType && workspaceRef.current) {
      setTimeout(() => {
        workspaceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedType]);

  // Reload history
  const reloadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const hist = await contentGeneratorService.getHistory();
    const items = hist.items || [];
    setHistory(items.length > 0 ? items : MOCK_HISTORY);
    setLoadingHistory(false);
  }, []);

  // Visible history items (paginated)
  const ITEMS_PER_PAGE = 8;
  const visibleHistory = useMemo(() => {
    return history.slice(0, historyPage * ITEMS_PER_PAGE);
  }, [history, historyPage]);
  const hasMoreHistory = history.length > visibleHistory.length;

  // Stats (computed from history)
  const stats = useMemo(() => {
    if (history.length === 0) return MOCK_STATS;
    return {
      generated: history.length,
      published: history.filter((h) => h.status === 'published').length,
      scheduled: history.filter((h) => h.status === 'scheduled').length,
      drafts: history.filter((h) => h.status === 'draft').length,
    };
  }, [history]);

  // ─── Generators ──────────────────────────────────
  // Progress simulation — smooth 0-100% during real API call
  const startProgress = (messages) => {
    setGenProgress(0);
    setGenMessage(messages[0] || 'Iniciando...');
    let progress = 0;
    const msgInterval = Math.floor(90 / messages.length);
    const interval = setInterval(() => {
      progress += Math.random() * 4 + 1;
      if (progress > 95) progress = 95; // Never reach 100 until done
      setGenProgress(Math.floor(progress));
      const msgIdx = Math.min(Math.floor(progress / msgInterval), messages.length - 1);
      setGenMessage(messages[msgIdx]);
    }, 300);
    return () => { clearInterval(interval); setGenProgress(100); setGenMessage('Listo!'); };
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      addNotification('Escribe una descripcion para la imagen', 'error');
      return;
    }
    setGenerating(true);
    setPreviewShimmer(true);
    const stopProgress = startProgress([
      'Analizando tu descripción...',
      'Configurando estilo visual...',
      'Generando imagen con IA...',
      'Aplicando paleta de colores...',
      'Optimizando resolución...',
      'Finalizando detalles...',
    ]);
    try {
      const result = await contentGeneratorService.generateImage({
        prompt: imagePrompt,
        style: imageStyle,
        dimensions: imageDimensions,
        brandColors: imageColorMood === 'auto' ? {
          primary: brandKit.primary_color,
          secondary: brandKit.secondary_color,
          accent: brandKit.accent_color,
        } : null,
      });
      stopProgress();
      // Pre-load the image before showing preview
      if (result.url || result.media_url) {
        const imgUrl = result.url || result.media_url;
        setGenMessage('Cargando imagen generada...');
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve; // Still show even if preload fails
          img.src = imgUrl;
          setTimeout(resolve, 15000); // Max 15s wait
        });
      }
      setGeneratedContent({ type: 'image', ...result });
      setPublishCaption('');
      setShowPreview(true);
      setPreviewShimmer(false);
      contentGeneratorService.saveToHistory({
        ...result,
        type: 'image',
        status: 'draft',
      });
      reloadHistory();
      addNotification('Imagen generada exitosamente', 'success');
    } catch (err) {
      stopProgress();
      addNotification(`Error generando imagen: ${err.message}`, 'error');
      setPreviewShimmer(false);
    }
    setGenerating(false);
  };

  const handleGenerateVideo = async () => {
    if (!videoScript.trim()) {
      addNotification('Escribe un guion para el video', 'error');
      return;
    }
    setGenerating(true);
    const stopProgress = startProgress([
      'Analizando guión...',
      'Preparando escena...',
      'Generando video con IA...',
      'Procesando audio...',
      'Renderizando frames...',
      'Compilando video final...',
    ]);
    try {
      const result = await contentGeneratorService.generateVideo({
        script: videoScript,
        avatarStyle: videoAvatar,
        language: videoLanguage,
        duration: videoDuration,
        background: videoBackground === 'solid' ? videoBgColor : videoBackground,
      });
      stopProgress();
      setGeneratedContent({ type: 'video', ...result });
      setPublishCaption('');
      setShowPreview(true);
      contentGeneratorService.saveToHistory({
        ...result,
        type: 'video',
        status: result.status === 'processing' ? 'processing' : 'draft',
      });
      reloadHistory();
      addNotification(
        result.status === 'processing'
          ? `Video en procesamiento. Tiempo estimado: ${result.estimated_time}`
          : 'Video generado exitosamente',
        'success'
      );
    } catch (err) {
      addNotification(`Error generando video: ${err.message}`, 'error');
    }
    setGenerating(false);
  };

  const handleGenerateCaption = async () => {
    const topic = selectedType === 'quick' ? quickTopic : storyPrompt;
    if (!topic.trim()) {
      addNotification('Escribe un tema para generar el caption', 'error');
      return;
    }
    setGenerating(true);
    try {
      const result = await contentGeneratorService.generateCaption({
        topic,
        tone: brandKit.tone,
        platform: publishPlatforms[0] || 'instagram',
        language: 'es',
      });
      if (selectedType === 'quick') {
        setQuickCaption(result.caption);
      } else {
        setStoryTextOverlay(result.caption);
      }
      addNotification('Caption generado con IA', 'success');
    } catch (err) {
      addNotification(`Error generando caption: ${err.message}`, 'error');
    }
    setGenerating(false);
  };

  const handleGenerateVideoScript = async () => {
    setGenerating(true);
    try {
      const result = await contentGeneratorService.generateCaption({
        topic: 'Guion profesional para video de presentacion del negocio',
        tone: brandKit.tone,
        platform: 'video',
        language: videoLanguage,
      });
      setVideoScript(result.caption?.slice(0, 500) || '');
      addNotification('Guion generado con IA', 'success');
    } catch (err) {
      addNotification(`Error generando guion: ${err.message}`, 'error');
    }
    setGenerating(false);
  };

  const handleGenerateQuickImage = async () => {
    if (!quickTopic.trim()) {
      addNotification('Escribe un tema para la publicacion', 'error');
      return;
    }
    setGenerating(true);
    try {
      const result = await contentGeneratorService.generateImage({
        prompt: `Imagen promocional para redes sociales sobre: ${quickTopic}`,
        style: 'moderno',
        dimensions: '1080x1080',
        brandColors: {
          primary: brandKit.primary_color,
          secondary: brandKit.secondary_color,
          accent: brandKit.accent_color,
        },
      });
      setQuickImageGenerated(result);
      addNotification('Imagen generada para la publicacion', 'success');
    } catch (err) {
      addNotification(`Error: ${err.message}`, 'error');
    }
    setGenerating(false);
  };

  const handleGenerateHashtags = async () => {
    if (!quickTopic.trim() && !quickCaption.trim()) return;
    const base = quickCaption || quickTopic;
    const hashtags = '\n\n#NegocioLocal #ServicioPremium #CalidadProfesional #TuMejorVersion #EstiloDeVida #CuidadoPersonal';
    setQuickCaption((prev) => prev ? prev + hashtags : base + hashtags);
    addNotification('Hashtags agregados', 'success');
  };

  const handleGenerateStory = async () => {
    if (!storyPrompt.trim()) {
      addNotification('Describe el contenido de la historia', 'error');
      return;
    }
    setGenerating(true);
    setPreviewShimmer(true);
    try {
      const result = await contentGeneratorService.generateImage({
        prompt: `Historia vertical para Instagram: ${storyPrompt}. Texto overlay: ${storyTextOverlay}`,
        style: 'vibrante',
        dimensions: '1080x1920',
        brandColors: {
          primary: brandKit.primary_color,
          secondary: brandKit.secondary_color,
          accent: brandKit.accent_color,
        },
      });
      setGeneratedContent({ type: 'story', ...result });
      setPublishCaption(storyTextOverlay);
      setShowPreview(true);
      setPreviewShimmer(false);
      contentGeneratorService.saveToHistory({
        ...result,
        type: 'story',
        status: 'draft',
      });
      reloadHistory();
      addNotification('Historia generada exitosamente', 'success');
    } catch (err) {
      addNotification(`Error: ${err.message}`, 'error');
      setPreviewShimmer(false);
    }
    setGenerating(false);
  };

  const handlePublishQuickPost = async (mode = 'publish') => {
    if (mode === 'draft') {
      const historyItem = {
        id: `draft_${Date.now()}`,
        type: 'quick',
        url: quickImageGenerated?.url || null,
        caption: quickCaption,
        platforms: quickPlatforms,
        status: 'draft',
        created_at: new Date().toISOString(),
      };
      contentGeneratorService.saveToHistory(historyItem);
      reloadHistory();
      addNotification('Borrador guardado', 'success');
      setQuickCaption('');
      setQuickTopic('');
      setQuickImageGenerated(null);
      return;
    }
    if (!quickCaption.trim() && !quickImageGenerated) {
      addNotification('Agrega un caption o genera una imagen primero', 'error');
      return;
    }
    setGenerating(true);
    try {
      const scheduledTime = showSchedule && scheduleDate && scheduleTime
        ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        : null;

      const result = await contentGeneratorService.publishToMeta({
        mediaUrl: quickImageGenerated?.url || null,
        caption: quickCaption,
        platforms: quickPlatforms,
        scheduledTime,
      });

      const historyItem = {
        id: result.id,
        type: 'quick',
        url: quickImageGenerated?.url || null,
        caption: quickCaption,
        platforms: quickPlatforms,
        status: result.status,
        created_at: new Date().toISOString(),
      };
      contentGeneratorService.saveToHistory(historyItem);
      reloadHistory();

      addNotification(
        result.status === 'scheduled'
          ? 'Publicacion programada exitosamente'
          : 'Publicacion realizada exitosamente',
        'success'
      );
      setQuickCaption('');
      setQuickTopic('');
      setQuickImageGenerated(null);
      setShowSchedule(false);
    } catch (err) {
      addNotification(`Error publicando: ${err.message}`, 'error');
    }
    setGenerating(false);
  };

  // ─── Publish from preview ──────────────────────────
  const handlePublishFromPreview = async () => {
    if (!generatedContent) return;
    setGenerating(true);
    try {
      const scheduledTime = showSchedule && scheduleDate && scheduleTime
        ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        : null;

      const result = await contentGeneratorService.publishToMeta({
        mediaUrl: generatedContent.url || generatedContent.thumbnail_url,
        caption: publishCaption,
        platforms: publishPlatforms,
        scheduledTime,
      });

      addNotification(
        result.status === 'scheduled'
          ? 'Contenido programado exitosamente'
          : 'Contenido publicado exitosamente',
        'success'
      );
      setShowPreview(false);
      setGeneratedContent(null);
    } catch (err) {
      addNotification(`Error publicando: ${err.message}`, 'error');
    }
    setGenerating(false);
  };

  // ─── Brand Kit save ────────────────────────────────
  const handleSaveBrandKit = async () => {
    try {
      await contentGeneratorService.saveBrandKit(brandKit);
      addNotification('Kit de marca guardado', 'success');
    } catch (err) {
      addNotification(`Error guardando kit: ${err.message}`, 'error');
    }
  };

  // ─── Delete history item ───────────────────────────
  const handleDeleteHistoryItem = (id) => {
    contentGeneratorService.deleteFromHistory(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
    addNotification('Elemento eliminado del historial', 'info');
  };

  // ─── Platform toggle ──────────────────────────────
  const togglePlatform = (platform, setter, current) => {
    if (current.includes(platform)) {
      if (current.length > 1) setter(current.filter((p) => p !== platform));
    } else {
      setter([...current, platform]);
    }
  };

  // ─── AI Suggestion click ──────────────────────────
  const handleSuggestionClick = (suggestion) => {
    setSelectedType(suggestion.type);
    if (suggestion.type === 'quick' && suggestion.fill?.topic) {
      setQuickTopic(suggestion.fill.topic);
    }
    if (suggestion.type === 'story' && suggestion.fill?.prompt) {
      setStoryPrompt(suggestion.fill.prompt);
    }
    setShowAiPanel(false);
    addNotification('Sugerencia aplicada al formulario', 'success');
  };

  const refreshSuggestions = () => {
    const newSuggestions = [
      { id: 'r1', text: 'Crea contenido sobre tendencias de la temporada', type: 'quick', fill: { topic: 'Tendencias de estilo para la temporada: lo que esta de moda' } },
      { id: 'r2', text: 'Genera una imagen para campana de fidelizacion', type: 'image', fill: {} },
      { id: 'r3', text: 'Video presentando nuevos servicios del mes', type: 'video', fill: {} },
      { id: 'r4', text: 'Historia de testimonios de clientes satisfechos', type: 'story', fill: { prompt: 'Testimonios reales de clientes satisfechos, diseno elegante con citas' } },
    ];
    setAiSuggestions(newSuggestions);
  };

  // Script character count
  const scriptCharCount = videoScript.length;
  const scriptMaxChars = 500;

  // Type label for history
  const typeLabel = (type) => {
    const labels = { image: 'Imagen', video: 'Video', story: 'Historia', quick: 'Post' };
    return labels[type] || 'Contenido';
  };

  return (
    <div className={B}>
      {/* ════════════════════════════════════════════
          HERO HEADER
         ════════════════════════════════════════════ */}
      <div className={`${B}__hero`}>
        <div className={`${B}__hero-content`}>
          <div className={`${B}__hero-text`}>
            <h1 className={`${B}__hero-title`}>
              <span className={`${B}__hero-title-gradient`}>Estudio de Contenido IA</span>
            </h1>
            <p className={`${B}__hero-subtitle`}>
              Crea, programa y publica contenido profesional para tus redes sociales
              impulsado por inteligencia artificial de ultima generacion
            </p>
          </div>
          <div className={`${B}__hero-badge`}>
            <div className={`${B}__meta-status ${metaStatus?.connected ? `${B}__meta-status--connected` : ''}`}>
              <span className={`${B}__meta-status-dot`} />
              <span className={`${B}__meta-status-text`}>
                {metaStatus?.connected ? 'Meta conectado' : 'Meta desconectado'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className={`${B}__stats-bar`}>
          <div className={`${B}__stat`}>
            <span className={`${B}__stat-value`}>{stats.generated}</span>
            <span className={`${B}__stat-label`}>Generados</span>
          </div>
          <div className={`${B}__stat-divider`} />
          <div className={`${B}__stat`}>
            <span className={`${B}__stat-value ${B}__stat-value--success`}>{stats.published}</span>
            <span className={`${B}__stat-label`}>Publicados</span>
          </div>
          <div className={`${B}__stat-divider`} />
          <div className={`${B}__stat`}>
            <span className={`${B}__stat-value ${B}__stat-value--info`}>{stats.scheduled}</span>
            <span className={`${B}__stat-label`}>Programados</span>
          </div>
          <div className={`${B}__stat-divider`} />
          <div className={`${B}__stat`}>
            <span className={`${B}__stat-value ${B}__stat-value--muted`}>{stats.drafts}</span>
            <span className={`${B}__stat-label`}>Borradores</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          CONTENT TYPE SELECTOR
         ════════════════════════════════════════════ */}
      <div className={`${B}__types`}>
        <div className={`${B}__types-grid`}>
          {CONTENT_TYPES.map((type, idx) => {
            const Icon = type.icon;
            const isActive = selectedType === type.id;
            return (
              <button
                key={type.id}
                className={`${B}__type-card ${isActive ? `${B}__type-card--active` : ''}`}
                onClick={() => setSelectedType(isActive ? null : type.id)}
                style={{
                  '--card-gradient': type.gradient,
                  '--card-gradient-bg': type.gradientBg,
                  animationDelay: `${idx * 0.06}s`,
                }}
              >
                <div className={`${B}__type-card-glow`} />
                <div className={`${B}__type-card-icon`}>
                  <Icon />
                </div>
                <div className={`${B}__type-card-text`}>
                  <span className={`${B}__type-card-label`}>{type.label}</span>
                  <span className={`${B}__type-card-desc`}>{type.desc}</span>
                </div>
                {type.popular && (
                  <span className={`${B}__type-card-badge`}>Popular</span>
                )}
                {isActive && (
                  <span className={`${B}__type-card-check`}>
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          WORKSPACE — Split Panel (Config + Preview)
         ════════════════════════════════════════════ */}
      {selectedType && (
        <div className={`${B}__workspace`} ref={workspaceRef}>
          <div className={`${B}__workspace-panels`}>
            {/* LEFT PANEL — Configuration */}
            <div className={`${B}__config-panel`}>

              {/* ── IMAGE FORM ── */}
              {selectedType === 'image' && (
                <div className={`${B}__form`}>
                  <h3 className={`${B}__form-title`}>
                    <SparkleIcon size={18} /> Generar Imagen Promocional
                  </h3>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>
                      Describe tu imagen
                      <span className={`${B}__char-count`}>{imagePrompt.length} caracteres</span>
                    </label>
                    <textarea
                      className={`${B}__textarea`}
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Ej: Una imagen elegante de un salon de belleza con colores verdes y dorados, mostrando un corte de cabello profesional..."
                      rows={4}
                    />
                    <button
                      className={`${B}__ai-assist`}
                      onClick={() => {
                        setImagePrompt('Imagen promocional profesional para salon de belleza premium, estilo moderno y elegante con iluminacion suave');
                        addNotification('Sugerencia de prompt aplicada', 'success');
                      }}
                      disabled={generating}
                    >
                      <WandIcon /> Sugerencia IA
                    </button>
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Estilo visual</label>
                    <div className={`${B}__chips`}>
                      {IMAGE_STYLES.map((s) => (
                        <button
                          key={s.id}
                          className={`${B}__chip ${imageStyle === s.id ? `${B}__chip--active` : ''}`}
                          onClick={() => setImageStyle(s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Paleta de color</label>
                    <div className={`${B}__chips`}>
                      {COLOR_MOODS.map((c) => (
                        <button
                          key={c.id}
                          className={`${B}__chip ${imageColorMood === c.id ? `${B}__chip--active` : ''}`}
                          onClick={() => setImageColorMood(c.id)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Dimensiones</label>
                    <div className={`${B}__dimensions-grid`}>
                      {IMAGE_DIMENSIONS.map((d) => (
                        <button
                          key={d.id}
                          className={`${B}__dimension-card ${imageDimensions === d.id ? `${B}__dimension-card--active` : ''}`}
                          onClick={() => setImageDimensions(d.id)}
                        >
                          <div className={`${B}__dimension-preview`} style={{ aspectRatio: d.ratio }} />
                          <span className={`${B}__dimension-label`}>{d.desc}</span>
                          <span className={`${B}__dimension-size`}>{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${B}__field ${B}__field--row`}>
                    <label className={`${B}__toggle-label`}>
                      <input
                        type="checkbox"
                        className={`${B}__toggle-input`}
                        checked={useBrandOverlay}
                        onChange={(e) => setUseBrandOverlay(e.target.checked)}
                      />
                      <span className={`${B}__toggle-switch`} />
                      Incluir logo de marca (watermark)
                    </label>
                  </div>

                  <button
                    className={`${B}__btn-generate`}
                    onClick={handleGenerateImage}
                    disabled={generating}
                  >
                    {generating ? (
                      <span className={`${B}__btn-loading`}>
                        <span className={`${B}__spinner`} /> Generando imagen...
                      </span>
                    ) : (
                      <>
                        <SparkleIcon /> Generar Imagen
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ── VIDEO FORM ── */}
              {selectedType === 'video' && (
                <div className={`${B}__form`}>
                  <h3 className={`${B}__form-title`}>
                    <SparkleIcon size={18} /> Video con Presentador IA
                  </h3>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>
                      Guion del presentador
                      <span className={`${B}__char-count ${scriptCharCount > scriptMaxChars ? `${B}__char-count--over` : ''}`}>
                        {scriptCharCount}/{scriptMaxChars}
                      </span>
                    </label>
                    <textarea
                      className={`${B}__textarea`}
                      value={videoScript}
                      onChange={(e) => setVideoScript(e.target.value)}
                      placeholder="Ej: Hola! Bienvenidos a nuestro salon. Hoy queremos contarte sobre nuestros servicios premium..."
                      rows={5}
                      maxLength={scriptMaxChars}
                    />
                    <button
                      className={`${B}__ai-assist`}
                      onClick={handleGenerateVideoScript}
                      disabled={generating}
                    >
                      <WandIcon /> Generar guion con IA
                    </button>
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Selecciona avatar</label>
                    <div className={`${B}__avatar-grid`}>
                      {AVATAR_STYLES.map((a) => (
                        <button
                          key={a.id}
                          className={`${B}__avatar-card ${videoAvatar === a.id ? `${B}__avatar-card--active` : ''}`}
                          onClick={() => setVideoAvatar(a.id)}
                        >
                          <div className={`${B}__avatar-thumb`}>
                            <UserIcon />
                          </div>
                          <span className={`${B}__avatar-name`}>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${B}__field-row`}>
                    <div className={`${B}__field`}>
                      <label className={`${B}__label`}>Idioma</label>
                      <div className={`${B}__chips`}>
                        {VIDEO_LANGUAGES.map((l) => (
                          <button
                            key={l.id}
                            className={`${B}__chip ${videoLanguage === l.id ? `${B}__chip--active` : ''}`}
                            onClick={() => setVideoLanguage(l.id)}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`${B}__field`}>
                      <label className={`${B}__label`}>Duracion</label>
                      <div className={`${B}__chips`}>
                        {VIDEO_DURATIONS.map((d) => (
                          <button
                            key={d.id}
                            className={`${B}__chip ${videoDuration === d.id ? `${B}__chip--active` : ''}`}
                            onClick={() => setVideoDuration(d.id)}
                          >
                            {d.label}
                            <span className={`${B}__chip-sub`}>{d.cost}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Fondo</label>
                    <div className={`${B}__chips`}>
                      {VIDEO_BACKGROUNDS.map((bg) => (
                        <button
                          key={bg.id}
                          className={`${B}__chip ${videoBackground === bg.id ? `${B}__chip--active` : ''}`}
                          onClick={() => setVideoBackground(bg.id)}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>
                    {videoBackground === 'solid' && (
                      <div className={`${B}__color-picker`} style={{ marginTop: '8px' }}>
                        <input
                          type="color"
                          value={videoBgColor}
                          onChange={(e) => setVideoBgColor(e.target.value)}
                        />
                        <span>{videoBgColor}</span>
                      </div>
                    )}
                  </div>

                  <button
                    className={`${B}__btn-generate`}
                    onClick={handleGenerateVideo}
                    disabled={generating}
                  >
                    {generating ? (
                      <span className={`${B}__btn-loading`}>
                        <span className={`${B}__spinner`} /> Generando video...
                      </span>
                    ) : (
                      <>
                        <SparkleIcon /> Generar Video
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ── QUICK POST FORM ── */}
              {selectedType === 'quick' && (
                <div className={`${B}__form`}>
                  <h3 className={`${B}__form-title`}>
                    <SparkleIcon size={18} /> Publicacion Rapida
                  </h3>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Tema de la publicacion</label>
                    <input
                      type="text"
                      className={`${B}__input`}
                      value={quickTopic}
                      onChange={(e) => setQuickTopic(e.target.value)}
                      placeholder="Ej: Descuento del 20% en cortes esta semana"
                    />
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>
                      Caption
                      <button
                        className={`${B}__ai-assist`}
                        onClick={handleGenerateCaption}
                        disabled={generating || !quickTopic.trim()}
                      >
                        <SparkleIcon /> Generar con IA
                      </button>
                    </label>
                    <textarea
                      className={`${B}__textarea`}
                      value={quickCaption}
                      onChange={(e) => setQuickCaption(e.target.value)}
                      placeholder="Escribe el texto de tu publicacion o genera uno con IA..."
                      rows={4}
                    />
                    <button
                      className={`${B}__ai-assist`}
                      onClick={handleGenerateHashtags}
                      disabled={!quickTopic.trim() && !quickCaption.trim()}
                    >
                      <HashIcon /> Generar hashtags
                    </button>
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Imagen</label>
                    {quickImageGenerated ? (
                      <div className={`${B}__generated-thumb`}>
                        <img src={quickImageGenerated.url} alt="Imagen generada" />
                        <button
                          className={`${B}__thumb-remove`}
                          onClick={() => setQuickImageGenerated(null)}
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    ) : (
                      <button
                        className={`${B}__btn-secondary`}
                        onClick={handleGenerateQuickImage}
                        disabled={generating || !quickTopic.trim()}
                      >
                        {generating ? (
                          <span className={`${B}__btn-loading`}>
                            <span className={`${B}__spinner`} /> Generando...
                          </span>
                        ) : (
                          <>
                            <SparkleIcon /> Generar imagen con IA
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>Plataformas</label>
                    <div className={`${B}__platform-toggles`}>
                      <button
                        className={`${B}__platform-btn ${quickPlatforms.includes('facebook') ? `${B}__platform-btn--active` : ''}`}
                        onClick={() => togglePlatform('facebook', setQuickPlatforms, quickPlatforms)}
                      >
                        <FacebookIcon /> Facebook
                      </button>
                      <button
                        className={`${B}__platform-btn ${quickPlatforms.includes('instagram') ? `${B}__platform-btn--active` : ''}`}
                        onClick={() => togglePlatform('instagram', setQuickPlatforms, quickPlatforms)}
                      >
                        <InstagramIcon /> Instagram
                      </button>
                    </div>
                  </div>

                  <div className={`${B}__field ${B}__field--row`}>
                    <label className={`${B}__toggle-label`}>
                      <input
                        type="checkbox"
                        className={`${B}__toggle-input`}
                        checked={showSchedule}
                        onChange={(e) => setShowSchedule(e.target.checked)}
                      />
                      <span className={`${B}__toggle-switch`} />
                      Programar publicacion
                    </label>
                  </div>

                  {showSchedule && (
                    <div className={`${B}__schedule-row`}>
                      <input
                        type="date"
                        className={`${B}__input ${B}__input--date`}
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                      <input
                        type="time"
                        className={`${B}__input ${B}__input--time`}
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                    </div>
                  )}

                  <div className={`${B}__form-actions`}>
                    <button
                      className={`${B}__btn-generate`}
                      onClick={() => handlePublishQuickPost('publish')}
                      disabled={generating}
                    >
                      {generating ? (
                        <span className={`${B}__btn-loading`}>
                          <span className={`${B}__spinner`} /> Publicando...
                        </span>
                      ) : showSchedule ? (
                        <>
                          <ClockIcon /> Programar
                        </>
                      ) : (
                        <>
                          <SendIcon /> Publicar Ahora
                        </>
                      )}
                    </button>
                    <button
                      className={`${B}__btn-secondary`}
                      onClick={() => handlePublishQuickPost('draft')}
                      disabled={generating}
                    >
                      <CopyIcon /> Guardar Borrador
                    </button>
                  </div>
                </div>
              )}

              {/* ── STORY / REEL FORM ── */}
              {selectedType === 'story' && (
                <div className={`${B}__form`}>
                  <h3 className={`${B}__form-title`}>
                    <SparkleIcon size={18} /> Crear Historia / Reel
                  </h3>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>
                      Descripcion visual
                      <span className={`${B}__format-badge`}>
                        <PhoneFrameIcon /> 9:16 vertical
                      </span>
                    </label>
                    <textarea
                      className={`${B}__textarea`}
                      value={storyPrompt}
                      onChange={(e) => setStoryPrompt(e.target.value)}
                      placeholder="Ej: Un fondo degradado elegante con una foto de un corte moderno, colores oscuros con detalles dorados..."
                      rows={3}
                    />
                  </div>

                  <div className={`${B}__field`}>
                    <label className={`${B}__label`}>
                      Texto superpuesto
                      <button
                        className={`${B}__ai-assist`}
                        onClick={handleGenerateCaption}
                        disabled={generating || !storyPrompt.trim()}
                      >
                        <SparkleIcon /> Generar con IA
                      </button>
                    </label>
                    <textarea
                      className={`${B}__textarea`}
                      value={storyTextOverlay}
                      onChange={(e) => setStoryTextOverlay(e.target.value)}
                      placeholder="Texto que aparecera sobre la imagen..."
                      rows={2}
                    />
                  </div>

                  <div className={`${B}__field-row`}>
                    <div className={`${B}__field`}>
                      <label className={`${B}__label`}>Duracion</label>
                      <div className={`${B}__chips`}>
                        {STORY_DURATIONS.map((d) => (
                          <button
                            key={d.id}
                            className={`${B}__chip ${storyDuration === d.id ? `${B}__chip--active` : ''}`}
                            onClick={() => setStoryDuration(d.id)}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`${B}__field`}>
                      <label className={`${B}__label`}><MusicIcon /> Musica</label>
                      <div className={`${B}__chips`}>
                        {MUSIC_MOODS.map((m) => (
                          <button
                            key={m.id}
                            className={`${B}__chip ${storyMusicMood === m.id ? `${B}__chip--active` : ''}`}
                            onClick={() => setStoryMusicMood(m.id)}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    className={`${B}__btn-generate`}
                    onClick={handleGenerateStory}
                    disabled={generating}
                  >
                    {generating ? (
                      <span className={`${B}__btn-loading`}>
                        <span className={`${B}__spinner`} /> Generando historia...
                      </span>
                    ) : (
                      <>
                        <SparkleIcon /> Generar Historia
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT PANEL — Live Preview */}
            <div className={`${B}__preview-panel`}>
              <div className={`${B}__phone-mockup`}>
                <div className={`${B}__phone-notch`} />
                <div className={`${B}__phone-screen`}>
                  {generating && previewShimmer ? (
                    <div className={`${B}__phone-shimmer`}>
                      <div className={`${B}__shimmer-pulse`} />
                      <span>Generando contenido...</span>
                    </div>
                  ) : generatedContent && (generatedContent.url || generatedContent.media_url || generatedContent.thumbnail_url) ? (
                    <img
                      src={generatedContent.url || generatedContent.media_url || generatedContent.thumbnail_url}
                      alt="Preview"
                      className={`${B}__phone-image`}
                      onError={(e) => {
                        if (!e.target.dataset.retried) {
                          e.target.dataset.retried = 'true';
                          setTimeout(() => { e.target.src = e.target.src + '&retry=1'; }, 3000);
                        }
                      }}
                    />
                  ) : selectedType === 'video' ? (
                    <div className={`${B}__phone-placeholder`}>
                      <div className={`${B}__phone-play-btn`}>
                        <PlayIcon />
                      </div>
                      <span>Vista previa del video</span>
                    </div>
                  ) : (
                    <div className={`${B}__phone-placeholder`}>
                      <ImageIcon />
                      <span>
                        {selectedType === 'image' && 'La imagen aparecera aqui'}
                        {selectedType === 'quick' && 'Vista previa de tu post'}
                        {selectedType === 'story' && 'Vista previa de historia'}
                      </span>
                    </div>
                  )}
                </div>
                <div className={`${B}__phone-home`} />
              </div>

              {/* Platform badges below phone */}
              <div className={`${B}__preview-platforms`}>
                {(selectedType === 'quick' ? quickPlatforms : publishPlatforms).map((p) => (
                  <span key={p} className={`${B}__preview-platform-badge`}>
                    {p === 'facebook' ? <FacebookIcon /> : <InstagramIcon />}
                    {p === 'facebook' ? 'Facebook' : 'Instagram'}
                  </span>
                ))}
              </div>

              {/* Quick action buttons below preview */}
              {generatedContent && (
                <div className={`${B}__preview-quick-actions`}>
                  <button
                    className={`${B}__btn-generate`}
                    onClick={() => setShowPreview(true)}
                  >
                    <SendIcon /> Publicar
                  </button>
                  <button className={`${B}__btn-secondary`}>
                    <DownloadIcon /> Descargar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          CONTENT CALENDAR (Weekly)
         ════════════════════════════════════════════ */}
      <div className={`${B}__calendar`}>
        <div className={`${B}__calendar-header`}>
          <h3 className={`${B}__calendar-title`}>
            <CalendarIcon /> Calendario Semanal
          </h3>
        </div>
        <div className={`${B}__calendar-grid`}>
          {MOCK_CALENDAR.map((day, idx) => {
            const isToday = day.date.toDateString() === new Date().toDateString();
            const isSelected = calendarSelectedDay === idx;
            return (
              <button
                key={idx}
                className={`${B}__calendar-day ${isToday ? `${B}__calendar-day--today` : ''} ${isSelected ? `${B}__calendar-day--selected` : ''}`}
                onClick={() => setCalendarSelectedDay(isSelected ? null : idx)}
              >
                <span className={`${B}__calendar-day-name`}>{DAY_NAMES[idx]}</span>
                <span className={`${B}__calendar-day-number`}>{day.date.getDate()}</span>
                <div className={`${B}__calendar-day-dots`}>
                  {day.posts.length > 0 ? (
                    day.posts.map((post, pIdx) => (
                      <span
                        key={pIdx}
                        className={`${B}__calendar-dot`}
                        style={{ background: TYPE_COLORS[post.type] || '#888' }}
                      />
                    ))
                  ) : (
                    <span className={`${B}__calendar-day-empty`}>
                      <PlusIcon />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {calendarSelectedDay !== null && MOCK_CALENDAR[calendarSelectedDay] && (
          <div className={`${B}__calendar-detail`}>
            {MOCK_CALENDAR[calendarSelectedDay].posts.length > 0 ? (
              MOCK_CALENDAR[calendarSelectedDay].posts.map((post, idx) => (
                <div key={idx} className={`${B}__calendar-post`}>
                  <span
                    className={`${B}__calendar-post-dot`}
                    style={{ background: TYPE_COLORS[post.type] }}
                  />
                  <span className={`${B}__calendar-post-type`}>{typeLabel(post.type)}</span>
                  <span className={`${B}__calendar-post-status ${B}__calendar-post-status--${post.status}`}>
                    {STATUS_META[post.status]?.label}
                  </span>
                </div>
              ))
            ) : (
              <div className={`${B}__calendar-empty-day`}>
                <span>Sin contenido programado</span>
                <button
                  className={`${B}__btn-secondary`}
                  onClick={() => {
                    setSelectedType('quick');
                    setCalendarSelectedDay(null);
                  }}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  <PlusIcon /> Crear contenido
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════
          BRAND KIT (Collapsible)
         ════════════════════════════════════════════ */}
      <div className={`${B}__brand-kit`}>
        <button
          className={`${B}__brand-kit-toggle`}
          onClick={() => setShowBrandKit(!showBrandKit)}
        >
          <PaletteIcon />
          <span>Kit de Marca</span>
          <span className={`${B}__brand-kit-arrow ${showBrandKit ? `${B}__brand-kit-arrow--open` : ''}`}>
            <ChevronDownIcon />
          </span>
        </button>

        {showBrandKit && (
          <div className={`${B}__brand-kit-body`}>
            <div className={`${B}__brand-kit-grid`}>
              <div className={`${B}__field`}>
                <label className={`${B}__label`}>Color primario</label>
                <div className={`${B}__color-picker`}>
                  <input
                    type="color"
                    value={brandKit.primary_color}
                    onChange={(e) => setBrandKit({ ...brandKit, primary_color: e.target.value })}
                  />
                  <span>{brandKit.primary_color}</span>
                </div>
              </div>
              <div className={`${B}__field`}>
                <label className={`${B}__label`}>Color secundario</label>
                <div className={`${B}__color-picker`}>
                  <input
                    type="color"
                    value={brandKit.secondary_color}
                    onChange={(e) => setBrandKit({ ...brandKit, secondary_color: e.target.value })}
                  />
                  <span>{brandKit.secondary_color}</span>
                </div>
              </div>
              <div className={`${B}__field`}>
                <label className={`${B}__label`}>Color acento</label>
                <div className={`${B}__color-picker`}>
                  <input
                    type="color"
                    value={brandKit.accent_color}
                    onChange={(e) => setBrandKit({ ...brandKit, accent_color: e.target.value })}
                  />
                  <span>{brandKit.accent_color}</span>
                </div>
              </div>
              <div className={`${B}__field`}>
                <label className={`${B}__label`}>Fuente</label>
                <select
                  className={`${B}__select`}
                  value={brandKit.font}
                  onChange={(e) => setBrandKit({ ...brandKit, font: e.target.value })}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className={`${B}__field`}>
                <label className={`${B}__label`}>Tagline</label>
                <input
                  type="text"
                  className={`${B}__input`}
                  value={brandKit.tagline}
                  onChange={(e) => setBrandKit({ ...brandKit, tagline: e.target.value })}
                  placeholder="Tu slogan o frase de marca"
                />
              </div>
              <div className={`${B}__field`}>
                <label className={`${B}__label`}>Tono de voz</label>
                <div className={`${B}__chips`}>
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      className={`${B}__chip ${brandKit.tone === t.id ? `${B}__chip--active` : ''}`}
                      onClick={() => setBrandKit({ ...brandKit, tone: t.id })}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button className={`${B}__btn-secondary`} onClick={handleSaveBrandKit}>
              <CheckIcon /> Guardar Kit de Marca
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════
          HISTORY GRID (Improved)
         ════════════════════════════════════════════ */}
      <div className={`${B}__history`}>
        <div className={`${B}__history-header`}>
          <h3 className={`${B}__history-title`}>
            <HistoryIcon /> Historial de Contenido
            <span className={`${B}__history-count`}>{history.length}</span>
          </h3>
          <button className={`${B}__history-refresh`} onClick={reloadHistory} disabled={loadingHistory}>
            <RefreshIcon />
          </button>
        </div>

        {loadingHistory ? (
          <div className={`${B}__history-loading`}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${B}__skeleton`} />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className={`${B}__history-empty`}>
            <SparkleIcon size={32} />
            <p>Aun no has generado contenido. Selecciona un tipo arriba para comenzar.</p>
          </div>
        ) : (
          <>
            <div className={`${B}__history-grid`}>
              {visibleHistory.map((item) => {
                const statusInfo = STATUS_META[item.status] || STATUS_META.draft;
                return (
                  <div key={item.id} className={`${B}__history-card`}>
                    <div className={`${B}__history-card-thumb`}>
                      {item.url || item.thumbnail_url ? (
                        <img src={item.url || item.thumbnail_url} alt="" />
                      ) : (
                        <div className={`${B}__history-card-placeholder`}>
                          {item.type === 'video' ? <VideoIcon /> : <ImageIcon />}
                        </div>
                      )}
                      <span className={`${B}__history-card-type`}>
                        {typeLabel(item.type)}
                      </span>
                      {/* Hover actions */}
                      <div className={`${B}__history-card-actions`}>
                        <button
                          className={`${B}__history-action-btn`}
                          title="Re-publicar"
                          onClick={() => {
                            setGeneratedContent({ ...item, type: item.type });
                            setShowPreview(true);
                          }}
                        >
                          <SendIcon />
                        </button>
                        <button
                          className={`${B}__history-action-btn ${B}__history-action-btn--danger`}
                          title="Eliminar"
                          onClick={() => handleDeleteHistoryItem(item.id)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                    {item.caption && (
                      <div className={`${B}__history-card-caption`}>
                        {item.caption.length > 60 ? item.caption.slice(0, 60) + '...' : item.caption}
                      </div>
                    )}
                    <div className={`${B}__history-card-info`}>
                      <span className={`${B}__history-card-date`}>
                        {new Date(item.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`${B}__history-card-status ${B}__history-card-status--${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className={`${B}__history-card-platforms`}>
                      {(item.platforms || []).includes('facebook') && <FacebookIcon />}
                      {(item.platforms || []).includes('instagram') && <InstagramIcon />}
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMoreHistory && (
              <button
                className={`${B}__history-load-more`}
                onClick={() => setHistoryPage((p) => p + 1)}
              >
                Cargar mas ({history.length - visibleHistory.length} restantes)
              </button>
            )}
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════
          AI SUGGESTIONS — Floating Button + Panel
         ════════════════════════════════════════════ */}
      <button
        className={`${B}__ai-fab`}
        onClick={() => setShowAiPanel(!showAiPanel)}
        title="Asistente IA"
      >
        <WandIcon />
      </button>

      {showAiPanel && (
        <div className={`${B}__ai-panel`}>
          <div className={`${B}__ai-panel-header`}>
            <h4 className={`${B}__ai-panel-title`}>
              <SparkleIcon size={14} /> Asistente IA
            </h4>
            <button className={`${B}__ai-panel-close`} onClick={() => setShowAiPanel(false)}>
              <CloseIcon />
            </button>
          </div>
          <div className={`${B}__ai-panel-body`}>
            <p className={`${B}__ai-panel-desc`}>Haz clic en una sugerencia para aplicarla:</p>
            {aiSuggestions.map((s) => (
              <button
                key={s.id}
                className={`${B}__ai-suggestion`}
                onClick={() => handleSuggestionClick(s)}
              >
                <SparkleIcon size={12} />
                <span>{s.text}</span>
              </button>
            ))}
          </div>
          <button className={`${B}__ai-panel-refresh`} onClick={refreshSuggestions}>
            <RefreshIcon /> Nuevas sugerencias
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════
          PREVIEW / PUBLISH MODAL
         ════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════
         GENERATION PROGRESS MODAL
         ════════════════════════════════════════════ */}
      {generating && createPortal(
        <div className={`${B}__overlay ${B}__overlay--progress`}>
          <div className={`${B}__progress-modal`} onClick={(e) => e.stopPropagation()}>
            <div className={`${B}__progress-icon`}>
              {selectedType === 'video' ? '🎬' : selectedType === 'story' ? '📱' : '🎨'}
            </div>
            <h3 className={`${B}__progress-title`}>
              {selectedType === 'video' ? 'Generando video...' : 'Generando imagen...'}
            </h3>
            <p className={`${B}__progress-message`}>{genMessage}</p>
            <div className={`${B}__progress-bar-track`}>
              <div
                className={`${B}__progress-bar-fill`}
                style={{ width: `${genProgress}%` }}
              />
            </div>
            <span className={`${B}__progress-percent`}>{genProgress}%</span>
            <p className={`${B}__progress-tip`}>
              Puedes seguir trabajando en otras secciones mientras se genera.
            </p>
          </div>
        </div>,
        document.body
      )}

      {showPreview && generatedContent && createPortal(
        <div className={`${B}__overlay`} onClick={() => setShowPreview(false)}>
          <div className={`${B}__preview-modal`} onClick={(e) => e.stopPropagation()}>
            <div className={`${B}__preview-header`}>
              <h2 className={`${B}__preview-title`}>Vista Previa</h2>
              <button className={`${B}__modal-close`} onClick={() => setShowPreview(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className={`${B}__preview-body`}>
              {/* Preview image/video */}
              <div className={`${B}__preview-media`}>
                <div className={`${B}__preview-frame ${generatedContent.dimensions === '1080x1920' || generatedContent.type === 'story' ? `${B}__preview-frame--vertical` : ''}`}>
                  {generatedContent.url || generatedContent.media_url || generatedContent.thumbnail_url ? (
                    <img
                      src={generatedContent.url || generatedContent.media_url || generatedContent.thumbnail_url}
                      alt="Contenido generado"
                      loading="eager"
                      onError={(e) => {
                        // Retry once after 3 seconds (Pollinations might be slow)
                        if (!e.target.dataset.retried) {
                          e.target.dataset.retried = 'true';
                          setTimeout(() => { e.target.src = e.target.src + '&retry=1'; }, 3000);
                        }
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className={`${B}__preview-placeholder`}>
                      {generatedContent.type === 'video' ? (
                        <>
                          <div className={`${B}__phone-play-btn`}>
                            <PlayIcon />
                          </div>
                          <span>Video en procesamiento...</span>
                          <span className={`${B}__preview-eta`}>Tiempo estimado: {generatedContent.estimated_time}</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon />
                          <span>Vista previa no disponible</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Publish controls */}
              <div className={`${B}__preview-controls`}>
                <div className={`${B}__field`}>
                  <label className={`${B}__label`}>Caption</label>
                  <textarea
                    className={`${B}__textarea`}
                    value={publishCaption}
                    onChange={(e) => setPublishCaption(e.target.value)}
                    placeholder="Escribe el caption para tu publicacion..."
                    rows={4}
                  />
                </div>

                <div className={`${B}__field`}>
                  <label className={`${B}__label`}>Plataformas</label>
                  <div className={`${B}__platform-toggles`}>
                    <button
                      className={`${B}__platform-btn ${publishPlatforms.includes('facebook') ? `${B}__platform-btn--active` : ''}`}
                      onClick={() => togglePlatform('facebook', setPublishPlatforms, publishPlatforms)}
                    >
                      <FacebookIcon /> Facebook
                    </button>
                    <button
                      className={`${B}__platform-btn ${publishPlatforms.includes('instagram') ? `${B}__platform-btn--active` : ''}`}
                      onClick={() => togglePlatform('instagram', setPublishPlatforms, publishPlatforms)}
                    >
                      <InstagramIcon /> Instagram
                    </button>
                  </div>
                </div>

                <div className={`${B}__field ${B}__field--row`}>
                  <label className={`${B}__toggle-label`}>
                    <input
                      type="checkbox"
                      className={`${B}__toggle-input`}
                      checked={showSchedule}
                      onChange={(e) => setShowSchedule(e.target.checked)}
                    />
                    <span className={`${B}__toggle-switch`} />
                    Programar
                  </label>
                </div>

                {showSchedule && (
                  <div className={`${B}__schedule-row`}>
                    <input
                      type="date"
                      className={`${B}__input ${B}__input--date`}
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                    <input
                      type="time"
                      className={`${B}__input ${B}__input--time`}
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                )}

                <div className={`${B}__preview-actions`}>
                  <button
                    className={`${B}__btn-generate`}
                    onClick={handlePublishFromPreview}
                    disabled={generating}
                  >
                    {generating ? (
                      <span className={`${B}__btn-loading`}>
                        <span className={`${B}__spinner`} /> Publicando...
                      </span>
                    ) : showSchedule ? (
                      <>
                        <ClockIcon /> Programar
                      </>
                    ) : (
                      <>
                        <SendIcon /> Publicar Ahora
                      </>
                    )}
                  </button>
                  <button className={`${B}__btn-secondary`}>
                    <DownloadIcon /> Descargar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ContentStudio;
