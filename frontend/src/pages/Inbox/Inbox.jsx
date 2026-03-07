import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import whatsappService from '../../services/whatsappService';
import { formatCurrency } from '../../utils/formatters';

// ============================================
// AlPelo - Inbox WhatsApp Business v3.0
// Full WhatsApp Web Clone — All features
// ============================================

const b = 'inbox';

// ===== LOCAL STORAGE KEYS =====
const LS_PINNED = 'alpelo_wa_pinned';
const LS_STARRED = 'alpelo_wa_starred';
const LS_LABELS = 'alpelo_wa_labels';
const LS_ARCHIVED = 'alpelo_wa_archived';
const LS_MUTED = 'alpelo_wa_muted';

const loadJson = (key, fallback) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
};

// ===== ICONS =====
const Icons = {
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  send: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  ),
  mic: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  smiley: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  attach: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  template: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  ),
  back: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  checkSingle: (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 5.5 5.5 10 15 1" />
    </svg>
  ),
  checkDouble: (
    <svg width="20" height="11" viewBox="0 0 20 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 5.5 5.5 10 15 1" /><polyline points="5 5.5 9.5 10 19 1" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  robot: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  user: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  megaphone: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
    </svg>
  ),
  phone: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  video: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  image: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  star: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  starOutline: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  lock: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
    </svg>
  ),
  link: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
  calendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  whatsapp: (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </svg>
  ),
  newChat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  pin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1V2H8v4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
    </svg>
  ),
  reply: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 00-4-4H4" />
    </svg>
  ),
  forward: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 014-4h12" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  dots3: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
    </svg>
  ),
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  doc: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  camera: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
    </svg>
  ),
  contact: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
  poll: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  mute: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ),
  archive: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  label: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
};

// ===== EMOJI DATA =====
const EMOJI_CATEGORIES = [
  { id: 'recent', label: 'Recientes', icon: '🕐', emojis: ['👍', '❤️', '😂', '😊', '🙏', '🔥', '👏', '😍'] },
  { id: 'smileys', label: 'Caras', icon: '😊', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'] },
  { id: 'gestures', label: 'Manos', icon: '👋', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪'] },
  { id: 'hearts', label: 'Corazones', icon: '❤️', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '💕', '💞', '💓', '💗', '💖', '💘', '💝'] },
  { id: 'objects', label: 'Objetos', icon: '💈', emojis: ['💈', '✂️', '🪒', '💇', '💇‍♂️', '💅', '🧴', '🪞', '📱', '💻', '📞', '📅', '📊', '📈', '📉', '💰', '💵', '💳', '🏷️', '📋', '📝', '✏️', '📌', '📎', '🔗', '🔑', '⭐', '🌟', '💡', '🎯', '🏆', '🎉', '🎊'] },
  { id: 'symbols', label: 'Simbolos', icon: '✅', emojis: ['✅', '❌', '⭕', '❗', '❓', '‼️', '⁉️', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🔶', '🔷', '🔸', '🔹', '▪️', '▫️', '🔺', '🔻'] },
];

// ===== LABEL COLORS =====
const LABEL_COLORS = [
  { id: 'green', color: '#25D366', label: 'Nuevo pedido' },
  { id: 'blue', color: '#53BDEB', label: 'Seguimiento' },
  { id: 'yellow', color: '#FFC107', label: 'Pendiente pago' },
  { id: 'red', color: '#FF5252', label: 'Urgente' },
  { id: 'purple', color: '#9C27B0', label: 'VIP' },
  { id: 'orange', color: '#FF9800', label: 'Reagendar' },
];

// ===== TEMPLATES =====
const TEMPLATES = [
  { id: 'welcome', label: 'Bienvenida', text: 'Hola{nombre}, soy Lina de Al Pelo! Bienvenido/a. En que te puedo ayudar? Si quieres agendar una cita: https://book.weibook.co/alpelo-peluqueria' },
  { id: 'prices', label: 'Precios', text: 'Hola{nombre}! Estos son nuestros servicios mas solicitados:\n- Corte: $25.000\n- Barba: $12.000\n- Corte + Barba: $37.000\n\nAgenda tu cita: https://book.weibook.co/alpelo-peluqueria' },
  { id: 'promo', label: 'Promocion', text: 'Hola{nombre}! Tenemos una promocion especial para ti! Agenda esta semana y recibe 10% de descuento: https://book.weibook.co/alpelo-peluqueria' },
  { id: 'reactivation', label: 'Reactivacion', text: 'Hola{nombre}! Te extranamos! Hace rato no te vemos por aca. Ven a ponerte Al Pelo: https://book.weibook.co/alpelo-peluqueria' },
  { id: 'confirm', label: 'Confirmacion', text: 'Hola{nombre}! Te recordamos tu cita en Al Pelo. Te esperamos! Confirma respondiendo SI.' },
  { id: 'thanks', label: 'Agradecimiento', text: 'Hola{nombre}! Gracias por tu visita a Al Pelo. Esperamos verte pronto. Calificanos: https://g.page/r/alpelo' },
];

// ===== HELPERS =====
const getInitials = (name = '') => {
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : (parts[0] || '?').substring(0, 2).toUpperCase();
};

const avatarColors = [
  '#00A884', '#25D366', '#128C7E', '#075E54',
  '#1FA855', '#00BFA5', '#009688', '#4CAF50',
  '#2E7D32', '#1B5E20', '#388E3C', '#43A047',
  '#5C6BC0', '#7E57C2', '#AB47BC', '#EC407A',
  '#EF5350', '#FF7043', '#FFA726', '#29B6F6',
  '#26A69A', '#66BB6A', '#9CCC65', '#8D6E63',
];

const getAvatarColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const parseUTC = (dateStr) => {
  if (!dateStr) return null;
  // Ensure UTC timestamps from backend are parsed as UTC
  const s = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
  return new Date(s);
};

const formatTime = (dateStr) => {
  const d = parseUTC(dateStr);
  if (!d) return '';
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatConvTime = (dateStr) => {
  const d = parseUTC(dateStr);
  if (!d) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return formatTime(dateStr);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return d.toLocaleDateString('es-CO', { weekday: 'short' });
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
};

const formatFullDate = (dateStr) => {
  const d = parseUTC(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};

const getDateLabel = (dateStr) => {
  const now = new Date();
  const d = parseUTC(dateStr);
  if (!d) return '';
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};

const STATUS_LABELS = {
  vip: 'VIP', activo: 'Activo', nuevo: 'Nuevo', en_riesgo: 'En riesgo', inactivo: 'Inactivo',
};

// ===== MESSAGE STATUS COMPONENT =====
const MessageStatus = ({ status }) => {
  if (status === 'sent') return <span className={`${b}__check ${b}__check--sent`}>{Icons.checkSingle}</span>;
  if (status === 'delivered') return <span className={`${b}__check ${b}__check--delivered`}>{Icons.checkDouble}</span>;
  if (status === 'read') return <span className={`${b}__check ${b}__check--read`}>{Icons.checkDouble}</span>;
  return null;
};

// ===== EMOJI PICKER =====
const EmojiPicker = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('recent');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const category = EMOJI_CATEGORIES.find((c) => c.id === activeCategory) || EMOJI_CATEGORIES[0];

  return (
    <div className={`${b}__emoji-picker`} ref={pickerRef}>
      <div className={`${b}__emoji-tabs`}>
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`${b}__emoji-tab ${activeCategory === cat.id ? `${b}__emoji-tab--active` : ''}`}
            onClick={() => setActiveCategory(cat.id)}
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
      </div>
      <div className={`${b}__emoji-grid`}>
        {category.emojis.map((emoji, i) => (
          <button key={i} className={`${b}__emoji-item`} onClick={() => onSelect(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

// ===== ATTACHMENT MENU =====
const AttachmentMenu = ({ onClose }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { icon: Icons.doc, label: 'Documento', color: '#7C3AED' },
    { icon: Icons.image, label: 'Fotos y videos', color: '#2563EB' },
    { icon: Icons.camera, label: 'Camara', color: '#EC4899' },
    { icon: Icons.contact, label: 'Contacto', color: '#0891B2' },
    { icon: Icons.poll, label: 'Encuesta', color: '#F59E0B' },
    { icon: Icons.template, label: 'Plantilla', color: '#10B981' },
  ];

  return (
    <div className={`${b}__attach-menu`} ref={menuRef}>
      {items.map((item, i) => (
        <button key={i} className={`${b}__attach-item`} style={{ animationDelay: `${i * 40}ms` }}>
          <span className={`${b}__attach-icon`} style={{ background: item.color }}>{item.icon}</span>
          <span className={`${b}__attach-label`}>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

// ===== MESSAGE CONTEXT MENU =====
const MessageContextMenu = ({ msg, position, onAction, onClose, isStarred }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { id: 'reply', icon: Icons.reply, label: 'Responder' },
    { id: 'react', icon: '😊', label: 'Reaccionar', isEmoji: true },
    { id: 'forward', icon: Icons.forward, label: 'Reenviar' },
    { id: 'star', icon: isStarred ? Icons.star : Icons.starOutline, label: isStarred ? 'Quitar estrella' : 'Destacar' },
    { id: 'delete', icon: Icons.trash, label: 'Eliminar', danger: true },
  ];

  return (
    <div
      className={`${b}__msg-context`}
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          className={`${b}__msg-context-item ${item.danger ? `${b}__msg-context-item--danger` : ''}`}
          onClick={() => onAction(item.id, msg)}
        >
          <span className={`${b}__msg-context-icon`}>
            {item.isEmoji ? item.icon : item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
};

// ===== QUICK REACTION BAR =====
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ===== CLIENT PROFILE SIDEBAR =====
const ClientSidebar = ({ conversation, onClose, starredMsgIds }) => {
  const [activeMediaTab, setActiveMediaTab] = useState('media');
  const client = conversation?.client || null;
  const name = client?.name || conversation?.wa_contact_name || 'Contacto';
  const phone = client?.phone || conversation?.wa_contact_phone || '';
  const starredCount = starredMsgIds?.length || 0;

  return (
    <div className={`${b}__client-sidebar`}>
      {/* Close button */}
      <div className={`${b}__client-sidebar-header`}>
        <button className={`${b}__client-sidebar-close`} onClick={onClose}>{Icons.close}</button>
        <span className={`${b}__client-sidebar-title`}>Info. del contacto</span>
      </div>

      {/* Profile header */}
      <div className={`${b}__client-header`}>
        <div className={`${b}__client-avatar-lg`} style={{ background: getAvatarColor(name) }}>
          {getInitials(name)}
        </div>
        <h3 className={`${b}__client-name-lg`}>{name}</h3>
        <span className={`${b}__client-phone-lg`}>{phone}</span>
        {client?.status && (
          <span className={`${b}__client-status-badge ${b}__client-status-badge--${client.status}`}>
            {STATUS_LABELS[client.status] || client.status}
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div className={`${b}__client-quick-actions`}>
        <button className={`${b}__client-quick-action`} title="Mensaje">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <span>Mensaje</span>
        </button>
        <button className={`${b}__client-quick-action`} title="Llamar">
          {Icons.phone}
          <span>Llamar</span>
        </button>
        <button className={`${b}__client-quick-action`} title="Video">
          {Icons.video}
          <span>Video</span>
        </button>
        <button className={`${b}__client-quick-action`} title="Buscar">
          {Icons.search}
          <span>Buscar</span>
        </button>
      </div>

      {/* Business data */}
      {client && (
        <div className={`${b}__client-section`}>
          <h4 className={`${b}__client-section-title`}>Datos del cliente</h4>
          <div className={`${b}__client-stats`}>
            <div className={`${b}__client-stat`}>
              <span className={`${b}__client-stat-value`}>{client.total_visits || 0}</span>
              <span className={`${b}__client-stat-label`}>Visitas</span>
            </div>
            <div className={`${b}__client-stat`}>
              <span className={`${b}__client-stat-value`}>{formatCurrency(client.total_spent || 0)}</span>
              <span className={`${b}__client-stat-label`}>Total</span>
            </div>
            <div className={`${b}__client-stat`}>
              <span className={`${b}__client-stat-value`}>{client.days_since_last_visit ?? '-'}</span>
              <span className={`${b}__client-stat-label`}>Dias</span>
            </div>
          </div>
        </div>
      )}

      {/* Contact details */}
      <div className={`${b}__client-section`}>
        <h4 className={`${b}__client-section-title`}>Informacion</h4>
        <div className={`${b}__client-details`}>
          <div className={`${b}__client-detail`}>
            <span className={`${b}__client-label`}>Telefono</span>
            <span className={`${b}__client-value`}>{phone || 'Sin telefono'}</span>
          </div>
          {client?.email && (
            <div className={`${b}__client-detail`}>
              <span className={`${b}__client-label`}>Email</span>
              <span className={`${b}__client-value`}>{client.email}</span>
            </div>
          )}
          {client?.client_id && (
            <div className={`${b}__client-detail`}>
              <span className={`${b}__client-label`}>ID Cliente</span>
              <span className={`${b}__client-value`}>{client.client_id}</span>
            </div>
          )}
          {client?.favorite_service && (
            <div className={`${b}__client-detail`}>
              <span className={`${b}__client-label`}>Servicio favorito</span>
              <span className={`${b}__client-value`}>{client.favorite_service}</span>
            </div>
          )}
          {client?.last_visit && (
            <div className={`${b}__client-detail`}>
              <span className={`${b}__client-label`}>Ultima visita</span>
              <span className={`${b}__client-value`}>{formatFullDate(client.last_visit)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Starred messages */}
      <div className={`${b}__client-section`}>
        <button className={`${b}__client-section-btn`}>
          <span className={`${b}__client-section-btn-left`}>
            {Icons.star} Mensajes destacados
          </span>
          <span className={`${b}__client-section-btn-right`}>
            {starredCount > 0 && <span className={`${b}__client-section-count`}>{starredCount}</span>}
            {Icons.chevronDown}
          </span>
        </button>
      </div>

      {/* Media, links, docs */}
      <div className={`${b}__client-section`}>
        <h4 className={`${b}__client-section-title`}>Multimedia, enlaces y docs</h4>
        <div className={`${b}__client-media-tabs`}>
          {['media', 'links', 'docs'].map((tab) => (
            <button
              key={tab}
              className={`${b}__client-media-tab ${activeMediaTab === tab ? `${b}__client-media-tab--active` : ''}`}
              onClick={() => setActiveMediaTab(tab)}
            >
              {tab === 'media' ? 'Multimedia' : tab === 'links' ? 'Enlaces' : 'Docs'}
            </button>
          ))}
        </div>
        <div className={`${b}__client-media-empty`}>
          No hay archivos compartidos aun.
        </div>
      </div>

      {/* Actions */}
      <div className={`${b}__client-section`}>
        <button className={`${b}__client-action`}>
          {Icons.mute} Silenciar notificaciones
        </button>
        <button className={`${b}__client-action`}>
          {Icons.calendar} Agendar cita
        </button>
        <button className={`${b}__client-action`}>
          {Icons.archive} Archivar chat
        </button>
        <button className={`${b}__client-action ${b}__client-action--danger`}>
          {Icons.close} Bloquear contacto
        </button>
        <button className={`${b}__client-action ${b}__client-action--danger`}>
          {Icons.trash} Eliminar chat
        </button>
      </div>
    </div>
  );
};

// ===== MAIN INBOX COMPONENT =====
const Inbox = () => {
  // --- Core state ---
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [messageInput, setMessageInput] = useState('');
  const [showClientInfo, setShowClientInfo] = useState(false);
  const [aiMode, setAiMode] = useState({});
  const [showBlast, setShowBlast] = useState(false);
  const [typingState, setTypingState] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  // --- New chat state ---
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatStep, setNewChatStep] = useState('phone');

  // --- Enhanced features state ---
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pinnedConvIds, setPinnedConvIds] = useState(() => loadJson(LS_PINNED, []));
  const [starredMsgIds, setStarredMsgIds] = useState(() => loadJson(LS_STARRED, []));
  const [labels, setLabels] = useState(() => loadJson(LS_LABELS, {}));
  const [archivedConvIds, setArchivedConvIds] = useState(() => loadJson(LS_ARCHIVED, []));
  const [mutedConvIds, setMutedConvIds] = useState(() => loadJson(LS_MUTED, []));
  const [replyingTo, setReplyingTo] = useState(null);
  const [msgContextMenu, setMsgContextMenu] = useState(null);
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [searchInChatQuery, setSearchInChatQuery] = useState('');
  const [showConvMenu, setShowConvMenu] = useState(null);
  const [showLabelPicker, setShowLabelPicker] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // --- Refs ---
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const searchInChatRef = useRef(null);
  const convMenuRef = useRef(null);

  // --- Persist to localStorage ---
  useEffect(() => { localStorage.setItem(LS_PINNED, JSON.stringify(pinnedConvIds)); }, [pinnedConvIds]);
  useEffect(() => { localStorage.setItem(LS_STARRED, JSON.stringify(starredMsgIds)); }, [starredMsgIds]);
  useEffect(() => { localStorage.setItem(LS_LABELS, JSON.stringify(labels)); }, [labels]);
  useEffect(() => { localStorage.setItem(LS_ARCHIVED, JSON.stringify(archivedConvIds)); }, [archivedConvIds]);
  useEffect(() => { localStorage.setItem(LS_MUTED, JSON.stringify(mutedConvIds)); }, [mutedConvIds]);

  // --- Load conversations ---
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await whatsappService.getConversations();
      setConversations(data);
      const modes = {};
      data.forEach((c) => { modes[c.id] = c.is_ai_active ?? true; });
      setAiMode(modes);
    } catch (err) {
      setError(err.message);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // --- Polling: refresh conversations every 5s ---
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await whatsappService.getConversations();
        setConversations(data);
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- Load messages ---
  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      setLoadingMessages(true);
      const data = await whatsappService.getMessages(convId);
      setMessages(data);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
      inputRef.current?.focus();
    } else {
      setMessages([]);
      setReplyingTo(null);
    }
  }, [selectedConvId, loadMessages]);

  // --- Polling: refresh messages every 3s for active conversation ---
  useEffect(() => {
    if (!selectedConvId) return;
    const interval = setInterval(async () => {
      try {
        const data = await whatsappService.getMessages(selectedConvId);
        setMessages(data);
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Close menus on click outside
  useEffect(() => {
    const handler = (e) => {
      if (showConvMenu && convMenuRef.current && !convMenuRef.current.contains(e.target)) {
        setShowConvMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showConvMenu]);

  // --- Filter & search ---
  const filteredConversations = useMemo(() => {
    let list = [...conversations];

    // Exclude archived (unless filter is 'archived')
    if (filter !== 'archived') {
      list = list.filter((c) => !archivedConvIds.includes(c.id));
    } else {
      list = list.filter((c) => archivedConvIds.includes(c.id));
    }

    if (filter === 'unread') list = list.filter((c) => (c.unread_count || 0) > 0);
    if (filter === 'vip') list = list.filter((c) => c.client?.status === 'vip');
    if (filter === 'starred') list = list.filter((c) => pinnedConvIds.includes(c.id));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) =>
        (c.wa_contact_name || '').toLowerCase().includes(q) ||
        (c.client?.name || '').toLowerCase().includes(q) ||
        (c.wa_contact_phone || '').includes(q)
      );
    }

    // Sort: pinned first, then by last message
    return list.sort((a, bConv) => {
      const aPinned = pinnedConvIds.includes(a.id) ? 1 : 0;
      const bPinned = pinnedConvIds.includes(bConv.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(bConv.last_message_at || 0) - new Date(a.last_message_at || 0);
    });
  }, [conversations, filter, searchQuery, archivedConvIds, pinnedConvIds]);

  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;
  const isAiActive = selectedConvId ? (aiMode[selectedConvId] !== false) : true;
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const archivedCount = conversations.filter((c) => archivedConvIds.includes(c.id)).length;

  // --- Search in chat ---
  const searchInChatResults = useMemo(() => {
    if (!searchInChatQuery.trim()) return [];
    const q = searchInChatQuery.toLowerCase();
    return messages.filter((m) => (m.content || '').toLowerCase().includes(q));
  }, [messages, searchInChatQuery]);

  // --- Send message ---
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConvId || sendingMessage) return;
    const text = messageInput.trim();
    setMessageInput('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);

    const tempMsg = {
      id: `temp-${Date.now()}`,
      direction: 'outbound',
      content: text,
      message_type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
      reply_to: replyingTo ? { id: replyingTo.id, content: replyingTo.content } : null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setSendingMessage(true);

    try {
      const saved = await whatsappService.sendMessage(selectedConvId, text);
      setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? { ...saved, reply_to: tempMsg.reply_to } : m));
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === tempMsg.id ? { ...m, status: 'failed' } : m
      ));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const toggleAiMode = () => {
    if (!selectedConvId) return;
    setAiMode((prev) => ({ ...prev, [selectedConvId]: !prev[selectedConvId] }));
  };

  const handleSelectConv = async (convId) => {
    setSelectedConvId(convId);
    setShowBlast(false);
    setShowClientInfo(false);
    setShowSearchInChat(false);
    setSearchInChatQuery('');
    setReplyingTo(null);
    setMsgContextMenu(null);

    // Mark conversation as read — update local state immediately, then API
    const conv = conversations.find((c) => c.id === convId);
    if (conv && conv.unread_count > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
      try {
        await whatsappService.markAsRead(convId);
      } catch (err) {
        console.error('[Inbox] Error marking as read:', err);
      }
    }
  };

  // --- Pin/Unpin ---
  const togglePin = (convId) => {
    setPinnedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  // --- Star/Unstar message ---
  const toggleStar = (msgId) => {
    setStarredMsgIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

  // --- Archive ---
  const toggleArchive = (convId) => {
    setArchivedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  // --- Mute ---
  const toggleMute = (convId) => {
    setMutedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  // --- Label ---
  const setLabel = (convId, labelId) => {
    setLabels((prev) => {
      const next = { ...prev };
      if (labelId) next[convId] = labelId;
      else delete next[convId];
      return next;
    });
    setShowLabelPicker(null);
  };

  // --- Message context menu actions ---
  const handleMsgAction = (action, msg) => {
    switch (action) {
      case 'reply': setReplyingTo(msg); inputRef.current?.focus(); break;
      case 'star': toggleStar(msg.id); break;
      case 'delete':
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        break;
      default: break;
    }
    setMsgContextMenu(null);
  };

  // --- Emoji select ---
  const handleEmojiSelect = (emoji) => {
    setMessageInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // --- Template select ---
  const handleTemplateSelect = (tpl) => {
    const name = selectedConv?.client?.name || selectedConv?.wa_contact_name || '';
    const nameTag = name ? ` ${name.split(' ')[0]}` : '';
    setMessageInput(tpl.text.replace('{nombre}', nameTag));
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  // --- New chat ---
  const handleNewChatNext = () => {
    if (!newChatPhone.trim()) return;
    setNewChatStep('template');
  };

  const handleCreateNewChat = (templateText) => {
    const name = newChatName.trim() || newChatPhone.trim();
    const nameTag = newChatName.trim() ? ` ${newChatName.trim().split(' ')[0]}` : '';
    const msgText = (templateText || '').replace('{nombre}', nameTag);

    const tempConv = {
      id: `temp-conv-${Date.now()}`,
      wa_contact_phone: newChatPhone.trim(),
      wa_contact_name: name,
      last_message_at: new Date().toISOString(),
      last_message_preview: msgText.slice(0, 50) + '...',
      last_message_direction: 'outbound',
      unread_count: 0,
      is_ai_active: true,
      client: null,
    };

    setConversations((prev) => [tempConv, ...prev]);
    setMessages([{
      id: `temp-msg-${Date.now()}`,
      direction: 'outbound',
      content: msgText,
      message_type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
    }]);
    setSelectedConvId(tempConv.id);
    setAiMode((prev) => ({ ...prev, [tempConv.id]: true }));
    setShowNewChat(false);
    setNewChatPhone('');
    setNewChatName('');
    setNewChatStep('phone');
  };

  // --- Group messages by date ---
  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDate = '';
    messages.forEach((msg) => {
      const dateKey = new Date(msg.created_at).toDateString();
      if (dateKey !== lastDate) {
        groups.push({ type: 'date', label: getDateLabel(msg.created_at), key: `date-${dateKey}` });
        lastDate = dateKey;
      }
      groups.push({ type: 'message', data: msg, key: msg.id });
    });
    return groups;
  }, [messages]);

  const getConvName = (conv) => conv.client?.name || conv.wa_contact_name || conv.wa_contact_phone || 'Contacto';
  const getConvPreview = (conv) => conv.last_message_preview || 'Sin mensajes';

  // ===== RENDER =====
  return (
    <div className={`${b} ${selectedConvId ? `${b}--chat-open` : ''}`}>
      {/* ===== LIST PANEL ===== */}
      <div className={`${b}__list-panel`}>
        <div className={`${b}__list-header`}>
          <h2 className={`${b}__list-title`}>Chats</h2>
          <div className={`${b}__list-header-actions`}>
            <button className={`${b}__new-chat-btn`} onClick={() => setShowNewChat(!showNewChat)} title="Nuevo chat">
              {Icons.newChat}
            </button>
            <button className={`${b}__blast-trigger ${showBlast ? `${b}__blast-trigger--active` : ''}`} onClick={() => setShowBlast(!showBlast)} title="Envio masivo">
              {Icons.megaphone}
            </button>
            {totalUnread > 0 && <span className={`${b}__unread-total`}>{totalUnread}</span>}
          </div>
        </div>

        {/* Blast panel */}
        {showBlast && (
          <div className={`${b}__blast-panel`}>
            <div className={`${b}__blast-header`}>
              <div className={`${b}__blast-title-row`}>
                <span className={`${b}__blast-icon`}>{Icons.megaphone}</span>
                <div>
                  <h3 className={`${b}__blast-title`}>Envio Masivo</h3>
                  <p className={`${b}__blast-subtitle`}>Requiere conexion con WhatsApp Business API</p>
                </div>
              </div>
              <button className={`${b}__blast-close`} onClick={() => setShowBlast(false)}>{Icons.close}</button>
            </div>
            <div className={`${b}__blast-pending`}>
              <div className={`${b}__blast-pending-icon`}>{Icons.lock}</div>
              <p className={`${b}__blast-pending-text`}>
                El envio masivo estara disponible cuando se complete la integracion con Meta WhatsApp Business API.
                Podras enviar campanas, promociones y mensajes personalizados a +500 clientes simultaneamente.
              </p>
            </div>
          </div>
        )}

        {/* New Chat Panel */}
        {showNewChat && (
          <div className={`${b}__new-chat-panel`}>
            <div className={`${b}__new-chat-header`}>
              <h3 className={`${b}__new-chat-title`}>
                {newChatStep === 'phone' ? 'Nuevo chat' : 'Elegir plantilla'}
              </h3>
              <button className={`${b}__new-chat-close`} onClick={() => { setShowNewChat(false); setNewChatStep('phone'); }}>
                {Icons.close}
              </button>
            </div>
            {newChatStep === 'phone' ? (
              <div className={`${b}__new-chat-form`}>
                <input type="text" className={`${b}__new-chat-input`} placeholder="Numero (ej: +573001234567)" value={newChatPhone} onChange={(e) => setNewChatPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNewChatNext()} autoFocus />
                <input type="text" className={`${b}__new-chat-input`} placeholder="Nombre (opcional)" value={newChatName} onChange={(e) => setNewChatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNewChatNext()} />
                <button className={`${b}__new-chat-submit`} onClick={handleNewChatNext} disabled={!newChatPhone.trim()}>Siguiente</button>
              </div>
            ) : (
              <div className={`${b}__new-chat-templates`}>
                <p className={`${b}__new-chat-templates-hint`}>Elige una plantilla para <strong>{newChatName || newChatPhone}</strong></p>
                {TEMPLATES.map((tpl) => {
                  const nameTag = newChatName.trim() ? ` ${newChatName.trim().split(' ')[0]}` : '';
                  const preview = tpl.text.replace('{nombre}', nameTag);
                  return (
                    <button key={tpl.id} className={`${b}__new-chat-tpl`} onClick={() => handleCreateNewChat(tpl.text)}>
                      <span className={`${b}__new-chat-tpl-label`}>{tpl.label}</span>
                      <span className={`${b}__new-chat-tpl-preview`}>{preview.length > 80 ? preview.slice(0, 80) + '...' : preview}</span>
                    </button>
                  );
                })}
                <button className={`${b}__new-chat-back`} onClick={() => setNewChatStep('phone')}>← Volver</button>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className={`${b}__search`}>
          <span className={`${b}__search-icon`}>{Icons.search}</span>
          <input type="text" className={`${b}__search-input`} placeholder="Buscar o empezar un chat nuevo" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        {/* Filters */}
        <div className={`${b}__filters`}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'unread', label: 'No leidos' },
            { id: 'vip', label: 'VIP' },
            { id: 'starred', label: 'Fijados' },
            { id: 'archived', label: `Archivados${archivedCount > 0 ? ` (${archivedCount})` : ''}` },
          ].map((f) => (
            <button key={f.id} className={`${b}__filter ${filter === f.id ? `${b}__filter--active` : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div className={`${b}__conv-list`}>
          {loading ? (
            <div className={`${b}__conv-loading`}>
              <div className={`${b}__conv-loading-spinner`} />
              <p>Cargando conversaciones...</p>
            </div>
          ) : error ? (
            <div className={`${b}__conv-error`}>
              <div className={`${b}__conv-error-icon`}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
                </svg>
              </div>
              <h4 className={`${b}__conv-error-title`}>WhatsApp no conectado</h4>
              <p className={`${b}__conv-error-text`}>
                La integracion con WhatsApp Business API esta pendiente. Una vez conectada, aqui veran todas las conversaciones en tiempo real.
              </p>
              <div className={`${b}__conv-error-features`}>
                <div className={`${b}__conv-error-feature`}>{Icons.robot}<span>Lina IA responde automaticamente</span></div>
                <div className={`${b}__conv-error-feature`}>{Icons.megaphone}<span>Envio masivo de campanas</span></div>
                <div className={`${b}__conv-error-feature`}>{Icons.user}<span>Perfil completo del cliente</span></div>
                <div className={`${b}__conv-error-feature`}>{Icons.phone}<span>Historial de llamadas</span></div>
                <div className={`${b}__conv-error-feature`}>{Icons.label}<span>Etiquetas por conversacion</span></div>
                <div className={`${b}__conv-error-feature`}>{Icons.starOutline}<span>Mensajes destacados</span></div>
              </div>
              <button className={`${b}__conv-error-retry`} onClick={loadConversations}>Reintentar conexion</button>
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const name = getConvName(conv);
              const isVip = conv.client?.status === 'vip';
              const isTyping = !!typingState[conv.id];
              const unread = conv.unread_count || 0;
              const isPinned = pinnedConvIds.includes(conv.id);
              const isMuted = mutedConvIds.includes(conv.id);
              const convLabel = labels[conv.id];
              const labelColor = convLabel ? LABEL_COLORS.find((l) => l.id === convLabel) : null;

              return (
                <div
                  key={conv.id}
                  className={`${b}__conv-item ${selectedConvId === conv.id ? `${b}__conv-item--active` : ''} ${unread > 0 ? `${b}__conv-item--unread` : ''}`}
                  onClick={() => handleSelectConv(conv.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setShowConvMenu({ id: conv.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <div className={`${b}__conv-avatar ${isVip ? `${b}__conv-avatar--vip` : ''}`} style={!isVip ? { background: getAvatarColor(name) } : undefined}>
                    {getInitials(name)}
                  </div>
                  <div className={`${b}__conv-content`}>
                    <div className={`${b}__conv-top`}>
                      <span className={`${b}__conv-name`}>
                        {name.split(' ').slice(0, 2).join(' ')}
                        {isVip && <mark className={`${b}__conv-tag`}>VIP</mark>}
                      </span>
                      <span className={`${b}__conv-time`}>{formatConvTime(conv.last_message_at)}</span>
                    </div>
                    <div className={`${b}__conv-bottom`}>
                      <p className={`${b}__conv-preview`}>
                        {isTyping ? (
                          <span className={`${b}__conv-typing-text`}>escribiendo...</span>
                        ) : (
                          <>
                            {conv.last_message_direction === 'outbound' && (
                              <span className={`${b}__conv-check-inline`}><MessageStatus status="read" /></span>
                            )}
                            {getConvPreview(conv).length > 45 ? getConvPreview(conv).slice(0, 45) + '...' : getConvPreview(conv)}
                          </>
                        )}
                      </p>
                      <div className={`${b}__conv-indicators`}>
                        {isPinned && <span className={`${b}__conv-pin-icon`}>{Icons.pin}</span>}
                        {isMuted && <span className={`${b}__conv-mute-icon`}>{Icons.mute}</span>}
                        {labelColor && <span className={`${b}__conv-label-dot`} style={{ background: labelColor.color }} />}
                        {unread > 0 && !isTyping && <span className={`${b}__conv-badge`}>{unread}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={`${b}__empty`}><p>No se encontraron conversaciones</p></div>
          )}
        </div>

        {/* Conversation Context Menu */}
        {showConvMenu && (
          <div
            className={`${b}__conv-context-menu`}
            ref={convMenuRef}
            style={{ top: showConvMenu.y, left: showConvMenu.x }}
          >
            <button onClick={() => { togglePin(showConvMenu.id); setShowConvMenu(null); }}>
              {Icons.pin} {pinnedConvIds.includes(showConvMenu.id) ? 'Desfijar' : 'Fijar chat'}
            </button>
            <button onClick={() => { toggleMute(showConvMenu.id); setShowConvMenu(null); }}>
              {Icons.mute} {mutedConvIds.includes(showConvMenu.id) ? 'Activar sonido' : 'Silenciar'}
            </button>
            <button onClick={() => { setShowLabelPicker(showConvMenu.id); setShowConvMenu(null); }}>
              {Icons.label} Etiquetar
            </button>
            <button onClick={() => { toggleArchive(showConvMenu.id); setShowConvMenu(null); }}>
              {Icons.archive} {archivedConvIds.includes(showConvMenu.id) ? 'Desarchivar' : 'Archivar'}
            </button>
            <button className={`${b}__conv-context-danger`} onClick={() => { setShowConvMenu(null); }}>
              {Icons.trash} Eliminar chat
            </button>
          </div>
        )}

        {/* Label Picker */}
        {showLabelPicker && (
          <div className={`${b}__label-picker`}>
            <div className={`${b}__label-picker-header`}>
              <span>Etiquetar chat</span>
              <button onClick={() => setShowLabelPicker(null)}>{Icons.close}</button>
            </div>
            {LABEL_COLORS.map((lbl) => (
              <button
                key={lbl.id}
                className={`${b}__label-option ${labels[showLabelPicker] === lbl.id ? `${b}__label-option--active` : ''}`}
                onClick={() => setLabel(showLabelPicker, labels[showLabelPicker] === lbl.id ? null : lbl.id)}
              >
                <span className={`${b}__label-color`} style={{ background: lbl.color }} />
                {lbl.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== CHAT PANEL ===== */}
      <div className={`${b}__chat-panel`}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className={`${b}__chat-header`}>
              <button className={`${b}__back-btn`} onClick={() => setSelectedConvId(null)}>
                {Icons.back}
              </button>
              <div className={`${b}__chat-avatar`} style={{ background: getAvatarColor(getConvName(selectedConv)) }} onClick={() => setShowClientInfo(!showClientInfo)}>
                {getInitials(getConvName(selectedConv))}
              </div>
              <div className={`${b}__chat-info`} onClick={() => setShowClientInfo(!showClientInfo)}>
                <span className={`${b}__chat-name`}>{getConvName(selectedConv)}</span>
                <span className={`${b}__chat-status ${typingState[selectedConvId] ? `${b}__chat-status--typing` : ''}`}>
                  {typingState[selectedConvId] ? 'escribiendo...' : 'en linea'}
                </span>
              </div>

              <button className={`${b}__header-action`} title="Videollamada (proximamente)">
                {Icons.video}
              </button>
              <button className={`${b}__header-action`} title="Llamada de voz (proximamente)">
                {Icons.phone}
              </button>
              <button className={`${b}__header-action`} onClick={() => { setShowSearchInChat(!showSearchInChat); setSearchInChatQuery(''); }} title="Buscar en el chat">
                {Icons.search}
              </button>

              {/* AI Toggle */}
              <button
                className={`${b}__ai-toggle ${isAiActive ? `${b}__ai-toggle--ai` : `${b}__ai-toggle--human`}`}
                onClick={toggleAiMode}
                title={isAiActive ? 'Lina IA activa' : 'Modo manual'}
              >
                {isAiActive ? Icons.robot : Icons.user}
                <span>{isAiActive ? 'Lina IA' : 'Manual'}</span>
              </button>

              <button className={`${b}__info-btn ${showClientInfo ? `${b}__info-btn--active` : ''}`} onClick={() => setShowClientInfo(!showClientInfo)}>
                {showClientInfo ? Icons.close : Icons.info}
              </button>
            </div>

            {/* Search in chat bar */}
            {showSearchInChat && (
              <div className={`${b}__search-in-chat`}>
                <div className={`${b}__search-in-chat-input-wrap`}>
                  <span className={`${b}__search-in-chat-icon`}>{Icons.search}</span>
                  <input
                    ref={searchInChatRef}
                    type="text"
                    className={`${b}__search-in-chat-input`}
                    placeholder="Buscar en esta conversacion..."
                    value={searchInChatQuery}
                    onChange={(e) => setSearchInChatQuery(e.target.value)}
                    autoFocus
                  />
                  {searchInChatQuery && (
                    <span className={`${b}__search-in-chat-count`}>
                      {searchInChatResults.length} resultado{searchInChatResults.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button className={`${b}__search-in-chat-close`} onClick={() => { setShowSearchInChat(false); setSearchInChatQuery(''); }}>
                  {Icons.close}
                </button>
              </div>
            )}

            <div className={`${b}__chat-body-wrapper`}>
              {/* Messages */}
              <div className={`${b}__messages`}>
                <div className={`${b}__messages-inner`}>
                  <div className={`${b}__encryption-notice`}>
                    {Icons.lock}
                    Los mensajes estan cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos.
                  </div>

                  {loadingMessages ? (
                    <div className={`${b}__messages-loading`}>
                      <div className={`${b}__conv-loading-spinner`} />
                      <p>Cargando mensajes...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className={`${b}__messages-empty`}>
                      <p>No hay mensajes en esta conversacion.</p>
                      <p>Envia el primer mensaje para comenzar.</p>
                    </div>
                  ) : (
                    groupedMessages.map((item) => {
                      if (item.type === 'date') {
                        return (
                          <div key={item.key} className={`${b}__date-separator`}>
                            <span>{item.label}</span>
                          </div>
                        );
                      }
                      const msg = item.data;
                      const isSent = msg.direction === 'outbound' || msg.from === 'business';
                      const isStarred = starredMsgIds.includes(msg.id);
                      const isHighlighted = searchInChatQuery && (msg.content || '').toLowerCase().includes(searchInChatQuery.toLowerCase());

                      return (
                        <div
                          key={msg.id}
                          className={`${b}__message ${isSent ? `${b}__message--sent` : `${b}__message--received`} ${isHighlighted ? `${b}__message--highlighted` : ''}`}
                        >
                          <div className={`${b}__message-bubble`}>
                            {isSent && <span className={`${b}__bubble-tail ${b}__bubble-tail--sent`} />}
                            {!isSent && <span className={`${b}__bubble-tail ${b}__bubble-tail--received`} />}

                            {/* Hover actions */}
                            <button
                              className={`${b}__msg-hover-btn`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMsgContextMenu({
                                  msg,
                                  position: { top: rect.bottom + 4, left: isSent ? rect.left - 140 : rect.right - 20 },
                                });
                              }}
                            >
                              {Icons.chevronDown}
                            </button>

                            {/* Reply quote */}
                            {msg.reply_to && (
                              <div className={`${b}__reply-quote`}>
                                <span className={`${b}__reply-quote-text`}>
                                  {(msg.reply_to.content || '').slice(0, 80)}{msg.reply_to.content?.length > 80 ? '...' : ''}
                                </span>
                              </div>
                            )}

                            {/* Media content */}
                            {msg.media_url && msg.message_type === 'sticker' && (
                              <img src={msg.media_url} alt="Sticker" className={`${b}__message-sticker`} />
                            )}
                            {msg.media_url && msg.message_type === 'image' && (
                              <img src={msg.media_url} alt="Imagen" className={`${b}__message-image`} />
                            )}
                            {msg.media_url && msg.message_type === 'video' && (
                              <video src={msg.media_url} controls className={`${b}__message-video`} />
                            )}
                            {msg.media_url && msg.message_type === 'audio' && (
                              <audio src={msg.media_url} controls className={`${b}__message-audio`} />
                            )}
                            {(!msg.media_url || (msg.content && msg.message_type !== 'sticker')) && (
                              <p className={`${b}__message-text`}>{msg.content || msg.text}</p>
                            )}
                            <div className={`${b}__message-meta`}>
                              {isStarred && <span className={`${b}__message-star`}>{Icons.star}</span>}
                              <span className={`${b}__message-time`}>{formatTime(msg.created_at || msg.time)}</span>
                              {isSent && <MessageStatus status={msg.status} />}
                              {msg.status === 'failed' && <span className={`${b}__message-failed`}>!</span>}
                            </div>
                          </div>

                          {/* Quick reactions */}
                          {msg._showReactions && (
                            <div className={`${b}__quick-reactions`}>
                              {QUICK_REACTIONS.map((r, i) => (
                                <button key={i} className={`${b}__quick-reaction`} onClick={() => { /* reaction logic */ }}>
                                  {r}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Typing indicator */}
                  {typingState[selectedConvId] && (
                    <div className={`${b}__message ${typingState[selectedConvId] === 'business' ? `${b}__message--sent` : `${b}__message--received`}`}>
                      <div className={`${b}__message-bubble ${b}__message-bubble--typing`}>
                        <span className={`${b}__bubble-tail ${typingState[selectedConvId] === 'business' ? `${b}__bubble-tail--sent` : `${b}__bubble-tail--received`}`} />
                        <div className={`${b}__typing-indicator`}>
                          <span className={`${b}__typing-dot`} /><span className={`${b}__typing-dot`} /><span className={`${b}__typing-dot`} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message context menu */}
              {msgContextMenu && (
                <MessageContextMenu
                  msg={msgContextMenu.msg}
                  position={msgContextMenu.position}
                  isStarred={starredMsgIds.includes(msgContextMenu.msg.id)}
                  onAction={handleMsgAction}
                  onClose={() => setMsgContextMenu(null)}
                />
              )}

              {/* Client sidebar */}
              {showClientInfo && (
                <ClientSidebar
                  conversation={selectedConv}
                  onClose={() => setShowClientInfo(false)}
                  starredMsgIds={starredMsgIds.filter((id) => messages.some((m) => m.id === id))}
                />
              )}
            </div>

            {/* AI bar */}
            {isAiActive && (
              <div className={`${b}__ai-bar`}>
                <span className={`${b}__ai-bar-dot`} />
                Lina IA esta respondiendo este chat automaticamente
              </div>
            )}

            {/* Reply bar */}
            {replyingTo && (
              <div className={`${b}__reply-bar`}>
                <div className={`${b}__reply-bar-content`}>
                  <span className={`${b}__reply-bar-label`}>Respondiendo a</span>
                  <span className={`${b}__reply-bar-text`}>
                    {(replyingTo.content || '').slice(0, 100)}{replyingTo.content?.length > 100 ? '...' : ''}
                  </span>
                </div>
                <button className={`${b}__reply-bar-close`} onClick={() => setReplyingTo(null)}>
                  {Icons.close}
                </button>
              </div>
            )}

            {/* Templates panel */}
            {showTemplates && (
              <div className={`${b}__templates-panel`}>
                <div className={`${b}__templates-header`}>
                  <span>Plantillas rapidas</span>
                  <button onClick={() => setShowTemplates(false)}>{Icons.close}</button>
                </div>
                <div className={`${b}__templates-list`}>
                  {TEMPLATES.map((tpl) => (
                    <button key={tpl.id} className={`${b}__template-item`} onClick={() => handleTemplateSelect(tpl)}>
                      <span className={`${b}__template-label`}>{tpl.label}</span>
                      <span className={`${b}__template-preview`}>{tpl.text.slice(0, 60)}...</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className={`${b}__input-area`}>
              {/* Emoji picker */}
              {showEmojiPicker && (
                <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
              )}

              {/* Attachment menu */}
              {showAttachMenu && (
                <AttachmentMenu onClose={() => setShowAttachMenu(false)} />
              )}

              <button className={`${b}__input-action ${showEmojiPicker ? `${b}__input-action--active` : ''}`} onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }} title="Emojis">
                {Icons.smiley}
              </button>
              <button className={`${b}__input-action ${showAttachMenu ? `${b}__input-action--active` : ''}`} onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }} title="Adjuntar">
                {Icons.attach}
              </button>

              <div className={`${b}__input-wrapper`}>
                <textarea
                  ref={inputRef}
                  className={`${b}__input`}
                  placeholder={isAiActive ? 'Lina IA activa... escribe para intervenir' : 'Escribe un mensaje...'}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
              </div>

              {/* Template button */}
              <button className={`${b}__input-action`} onClick={() => setShowTemplates(!showTemplates)} title="Plantillas">
                {Icons.template}
              </button>

              {/* Mic / Send */}
              {messageInput.trim() ? (
                <button className={`${b}__send-btn ${b}__send-btn--active`} onClick={handleSendMessage} disabled={sendingMessage}>
                  {Icons.send}
                </button>
              ) : (
                <button className={`${b}__mic-btn`} title="Mensaje de voz (proximamente)">
                  {Icons.mic}
                </button>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className={`${b}__empty-chat`}>
            <div className={`${b}__empty-chat-bg`}>
              <div className={`${b}__empty-chat-icon`}>{Icons.whatsapp}</div>
              <h3 className={`${b}__empty-chat-title`}>Al Pelo WhatsApp</h3>
              <p className={`${b}__empty-chat-text`}>
                Envia y recibe mensajes con tus clientes.<br />
                Lina IA se encarga de responder por ti.
              </p>
              <div className={`${b}__empty-chat-features`}>
                <span>Respuestas automaticas con IA</span>
                <span>Envio masivo de plantillas</span>
                <span>Perfil completo del cliente</span>
                <span>Toggle IA / Manual por chat</span>
                <span>Mensajes destacados y fijados</span>
                <span>Etiquetas por conversacion</span>
              </div>
              <div className={`${b}__empty-chat-encryption`}>
                {Icons.lock} Cifrado de extremo a extremo
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
