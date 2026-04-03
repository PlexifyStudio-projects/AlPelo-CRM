import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import whatsappService from '../../services/whatsappService';
import clientService from '../../services/clientService';
import { formatCurrency } from '../../utils/formatters';
import UsageMeter from '../../components/common/UsageMeter/UsageMeter';
import { useTenant } from '../../context/TenantContext';

const b = 'inbox';
const API_BASE = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const resolveMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/api/')) return API_BASE.replace('/api', '') + url;
  return API_BASE + '/' + url;
};

const QUICK_REPLIES = [
  { id: 1, label: 'Saludo', text: '¡Hola! Gracias por escribirnos. ¿En qué podemos ayudarte?' },
  { id: 2, label: 'Horario', text: 'Nuestro horario es de lunes a sábado, 8:00 AM a 7:00 PM.' },
  { id: 3, label: 'Confirmar cita', text: '¡Perfecto! Tu cita está confirmada. Te esperamos.' },
  { id: 4, label: 'Precios', text: 'Con gusto te envío nuestros precios. ¿Qué servicio te interesa?' },
  { id: 5, label: 'Ubicación', text: 'Estamos ubicados en [dirección]. ¿Necesitas indicaciones?' },
  { id: 6, label: 'Despedida', text: '¡Gracias por contactarnos! Que tengas un excelente día.' },
];

const CONV_STATUSES = [
  { id: 'nuevo', label: 'Nuevo', color: '#2563EB' },
  { id: 'pendiente', label: 'Pendiente', color: '#F59E0B' },
  { id: 'resuelto', label: 'Resuelto', color: '#10B981' },
  { id: 'urgente', label: 'Urgente', color: '#EF4444' },
];

const LS_PINNED = 'alpelo_wa_pinned';
const LS_STARRED = 'alpelo_wa_starred';
const LS_LABELS = 'alpelo_wa_labels';
const LS_ARCHIVED = 'alpelo_wa_archived';
const LS_MUTED = 'alpelo_wa_muted';
const LS_CONV_STATUSES = 'alpelo_wa_conv_statuses';
const LS_NOTES_PREFIX = 'inbox_notes_';

const loadJson = (key, fallback) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
};

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
  lightning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  notepad: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  label: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
};

const EMOJI_CATEGORIES = [
  { id: 'recent', label: 'Recientes', icon: '🕐', emojis: ['👍', '❤️', '😂', '😊', '🙏', '🔥', '👏', '😍'] },
  { id: 'smileys', label: 'Caras', icon: '😊', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'] },
  { id: 'gestures', label: 'Manos', icon: '👋', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪'] },
  { id: 'hearts', label: 'Corazones', icon: '❤️', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '💕', '💞', '💓', '💗', '💖', '💘', '💝'] },
  { id: 'objects', label: 'Objetos', icon: '💈', emojis: ['💈', '✂️', '🪒', '💇', '💇‍♂️', '💅', '🧴', '🪞', '📱', '💻', '📞', '📅', '📊', '📈', '📉', '💰', '💵', '💳', '🏷️', '📋', '📝', '✏️', '📌', '📎', '🔗', '🔑', '⭐', '🌟', '💡', '🎯', '🏆', '🎉', '🎊'] },
  { id: 'symbols', label: 'Simbolos', icon: '✅', emojis: ['✅', '❌', '⭕', '❗', '❓', '‼️', '⁉️', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🔶', '🔷', '🔸', '🔹', '▪️', '▫️', '🔺', '🔻'] },
];

const LABEL_COLORS = [
  { id: 'green', color: '#25D366', label: 'Nuevo pedido' },
  { id: 'blue', color: '#53BDEB', label: 'Seguimiento' },
  { id: 'yellow', color: '#FFC107', label: 'Pendiente pago' },
  { id: 'red', color: '#FF5252', label: 'Urgente' },
  { id: 'purple', color: '#9C27B0', label: 'VIP' },
  { id: 'orange', color: '#FF9800', label: 'Reagendar' },
];

const buildTemplates = (tenantName, bookingUrl) => {
  const name = tenantName || 'nuestro negocio';
  const bookLink = bookingUrl ? ` ${bookingUrl}` : '';
  return [
    { id: 'welcome', label: 'Bienvenida', text: `Hola{nombre}, soy Lina de ${name}! Bienvenido/a. En que te puedo ayudar?${bookingUrl ? ` Si quieres agendar una cita:${bookLink}` : ''}` },
    { id: 'prices', label: 'Precios', text: `Hola{nombre}! Preguntanos por nuestros servicios mas solicitados y sus precios.${bookingUrl ? `\n\nAgenda tu cita:${bookLink}` : ''}` },
    { id: 'promo', label: 'Promocion', text: `Hola{nombre}! Tenemos una promocion especial para ti! Agenda esta semana y recibe 10% de descuento.${bookLink}` },
    { id: 'reactivation', label: 'Reactivacion', text: `Hola{nombre}! Te extranamos! Hace rato no te vemos por aca. Te esperamos de vuelta en ${name}!${bookLink}` },
    { id: 'confirm', label: 'Confirmacion', text: `Hola{nombre}! Te recordamos tu cita en ${name}. Te esperamos! Confirma respondiendo SI.` },
    { id: 'thanks', label: 'Agradecimiento', text: `Hola{nombre}! Gracias por tu visita a ${name}. Esperamos verte pronto.` },
    { id: 'survey', label: 'Encuesta', text: `Hola{nombre}! Como te fue con tu ultimo servicio en ${name}? Califica del 1 al 5 y cuentanos como mejorar. Tu opinion es muy importante para nosotros!` },
    { id: 'comeback', label: 'Te extrañamos', text: `Hola{nombre}! Hace mucho no te vemos por ${name}. Tenemos novedades que te van a encantar.${bookingUrl ? ` Agenda tu proxima cita:${bookLink}` : ''}` },
  ];
};

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

const MessageStatus = ({ status }) => {
  if (status === 'sent') return <span className={`${b}__check ${b}__check--sent`}>{Icons.checkSingle}</span>;
  if (status === 'delivered') return <span className={`${b}__check ${b}__check--delivered`}>{Icons.checkDouble}</span>;
  if (status === 'read') return <span className={`${b}__check ${b}__check--read`}>{Icons.checkDouble}</span>;
  return null;
};

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

const AttachmentMenu = ({ onClose, onSelectType }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { icon: Icons.doc, label: 'Documento', color: '#7C3AED', type: 'document' },
    { icon: Icons.image, label: 'Fotos y videos', color: '#2563EB', type: 'image' },
  ];

  return (
    <div className={`${b}__attach-menu`} ref={menuRef}>
      {items.map((item, i) => (
        <button key={i} className={`${b}__attach-item`} style={{ animationDelay: `${i * 40}ms` }}
          onClick={() => { onSelectType(item.type); onClose(); }}>
          <span className={`${b}__attach-icon`} style={{ background: item.color }}>{item.icon}</span>
          <span className={`${b}__attach-label`}>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

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

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const ClientSidebar = ({ conversation, onClose, starredMsgIds, onDelete, getNotes, onAddNote, onDeleteNote }) => {
  const [activeMediaTab, setActiveMediaTab] = useState('media');
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState(() => getNotes ? getNotes(conversation?.id) : []);
  const client = conversation?.client || null;
  const name = conversation?.wa_contact_name || client?.name || 'Contacto';
  const phone = client?.phone || conversation?.wa_contact_phone || '';
  const starredCount = starredMsgIds?.length || 0;

  return (
    <div className={`${b}__client-sidebar`}>
      <div className={`${b}__client-sidebar-header`}>
        <button className={`${b}__client-sidebar-close`} onClick={onClose}>{Icons.close}</button>
        <span className={`${b}__client-sidebar-title`}>Info. del contacto</span>
      </div>
      <div className={`${b}__client-header`}>
        <div className={`${b}__client-avatar-lg`} style={!conversation?.wa_profile_photo_url ? { background: getAvatarColor(name) } : undefined}>
          {conversation?.wa_profile_photo_url ? (
            <img src={conversation.wa_profile_photo_url} alt={name} className={`${b}__client-avatar-lg-img`} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          ) : null}
          <span className={`${b}__client-avatar-lg-fallback`} style={conversation?.wa_profile_photo_url ? { display: 'none' } : { display: 'flex', background: getAvatarColor(name) }}>
            {getInitials(name)}
          </span>
        </div>
        <h3 className={`${b}__client-name-lg`}>{name}</h3>
        <span className={`${b}__client-phone-lg`}>{phone}</span>
        {client?.status && (
          <span className={`${b}__client-status-badge ${b}__client-status-badge--${client.status}`}>
            {STATUS_LABELS[client.status] || client.status}
          </span>
        )}
      </div>
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
      <div className={`${b}__client-section`}>
        <h4 className={`${b}__client-section-title`}>{Icons.notepad} Notas internas</h4>
        <div className={`${b}__notes-section`}>
          {notes.length > 0 ? (
            notes.map((note) => (
              <div key={note.id} className={`${b}__note-item`}>
                <div className={`${b}__note-item-header`}>
                  <span className={`${b}__note-item-author`}>{note.author}</span>
                  <span className={`${b}__note-item-time`}>{formatTime(note.timestamp)}</span>
                  <button className={`${b}__note-item-delete`} onClick={() => {
                    if (onDeleteNote) {
                      const updated = onDeleteNote(conversation?.id, note.id);
                      setNotes(updated);
                    }
                  }}>{Icons.close}</button>
                </div>
                <p className={`${b}__note-item-text`}>{note.text}</p>
              </div>
            ))
          ) : (
            <p className={`${b}__notes-empty`}>Sin notas internas</p>
          )}
          <div className={`${b}__note-input-wrap`}>
            <textarea
              className={`${b}__note-input`}
              placeholder="Agregar nota interna..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              rows={2}
            />
            <button
              className={`${b}__note-submit`}
              disabled={!noteInput.trim()}
              onClick={() => {
                if (onAddNote && noteInput.trim()) {
                  const updated = onAddNote(conversation?.id, noteInput);
                  setNotes(updated);
                  setNoteInput('');
                }
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
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
        <button className={`${b}__client-action ${b}__client-action--danger`} onClick={() => {
          if (window.confirm('¿Eliminar esta conversación? Se borrarán todos los mensajes.') && onDelete) onDelete();
        }}>
          {Icons.trash} Eliminar chat
        </button>
      </div>
    </div>
  );
};

const LINA_PIPELINE = [
  { icon: '💬', text: 'Leyendo mensajes del chat...', duration: 3000 },
  { icon: '👤', text: 'Verificando cliente en el sistema...', duration: 3000 },
  { icon: '📅', text: 'Revisando agenda y disponibilidad...', duration: 4000 },
  { icon: '🔍', text: 'Verificando conflictos de horario...', duration: 3500 },
  { icon: '👥', text: 'Comprobando personal disponible...', duration: 3000 },
  { icon: '🧠', text: 'Analizando y preparando respuesta...', duration: 4000 },
  { icon: '✅', text: 'Verificación final antes de responder...', duration: 3000 },
];

const LinaThinking = () => {
  const [stepIdx, setStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  useEffect(() => {
    setStepIdx(0);
    setCompletedSteps([]);

    let currentStep = 0;
    const advanceStep = () => {
      if (currentStep < LINA_PIPELINE.length - 1) {
        setCompletedSteps(prev => [...prev, currentStep]);
        currentStep += 1;
        setStepIdx(currentStep);
        timeout = setTimeout(advanceStep, LINA_PIPELINE[currentStep].duration);
      }
    };

    let timeout = setTimeout(advanceStep, LINA_PIPELINE[0].duration);
    return () => clearTimeout(timeout);
  }, []);

  const currentPipe = LINA_PIPELINE[stepIdx];

  return (
    <div className={`${b}__lina-thinking`}>
      <div className={`${b}__lina-thinking-bubble`}>
        <div className={`${b}__lina-thinking-header`}>
          <span className={`${b}__lina-thinking-icon`}>🤖</span>
          <span className={`${b}__lina-thinking-label`}>Lina IA</span>
        </div>
        <div className={`${b}__lina-thinking-pipeline`}>
          {completedSteps.map(idx => (
            <div key={idx} className={`${b}__lina-thinking-done`}>
              <span className={`${b}__lina-thinking-check`}>✓</span>
              <span className={`${b}__lina-thinking-done-text`}>{LINA_PIPELINE[idx].text.replace('...', '')}</span>
            </div>
          ))}
          <div className={`${b}__lina-thinking-step`}>
            <span className={`${b}__lina-thinking-step-icon`}>{currentPipe.icon}</span>
            <span className={`${b}__lina-thinking-text`}>{currentPipe.text}</span>
            <span className={`${b}__lina-thinking-dots`}>
              <span /><span /><span />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AudioPlayer = ({ src }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play().catch(() => {}); }
    setPlaying(!playing);
  }, [playing]);

  const formatDur = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`${b}__audio-player`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onTimeUpdate={(e) => setProgress(e.target.duration ? (e.target.currentTime / e.target.duration) * 100 : 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button className={`${b}__audio-play`} onClick={toggle} type="button">
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        )}
      </button>
      <div className={`${b}__audio-track`}>
        <div className={`${b}__audio-progress`} style={{ width: `${progress}%` }} />
      </div>
      <span className={`${b}__audio-time`}>{playing ? formatDur(audioRef.current?.currentTime) : formatDur(duration)}</span>
    </div>
  );
};

const Inbox = () => {
  const { tenant } = useTenant();
  const TEMPLATES = useMemo(() => buildTemplates(tenant.name, tenant.booking_url), [tenant.name, tenant.booking_url]);
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

  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatStep, setNewChatStep] = useState('phone');
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [newChatError, setNewChatError] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const clientSearchTimer = useRef(null);

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
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const fileInputDocRef = useRef(null);
  const fileInputImgRef = useRef(null);
  const [convStatuses, setConvStatuses] = useState(() => loadJson(LS_CONV_STATUSES, {}));
  const [showStatusPicker, setShowStatusPicker] = useState(null);

  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const searchInChatRef = useRef(null);
  const convMenuRef = useRef(null);
  const lastKnownMsgCountRef = useRef({});
  const initialLoadDoneRef = useRef(false);
  const globalSearchRef = useRef(null);

  useEffect(() => { localStorage.setItem(LS_PINNED, JSON.stringify(pinnedConvIds)); }, [pinnedConvIds]);
  useEffect(() => { localStorage.setItem(LS_STARRED, JSON.stringify(starredMsgIds)); }, [starredMsgIds]);
  useEffect(() => { localStorage.setItem(LS_LABELS, JSON.stringify(labels)); }, [labels]);
  useEffect(() => { localStorage.setItem(LS_ARCHIVED, JSON.stringify(archivedConvIds)); }, [archivedConvIds]);
  useEffect(() => { localStorage.setItem(LS_MUTED, JSON.stringify(mutedConvIds)); }, [mutedConvIds]);
  useEffect(() => { localStorage.setItem(LS_CONV_STATUSES, JSON.stringify(convStatuses)); }, [convStatuses]);

  const getNotesForConv = useCallback((convId) => {
    return loadJson(`${LS_NOTES_PREFIX}${convId}`, []);
  }, []);

  const addNoteToConv = useCallback((convId, text) => {
    if (!text.trim()) return;
    const notes = loadJson(`${LS_NOTES_PREFIX}${convId}`, []);
    const newNote = {
      id: Date.now(),
      text: text.trim(),
      author: 'Admin',
      timestamp: new Date().toISOString(),
    };
    const updated = [...notes, newNote];
    localStorage.setItem(`${LS_NOTES_PREFIX}${convId}`, JSON.stringify(updated));
    return updated;
  }, []);

  const deleteNoteFromConv = useCallback((convId, noteId) => {
    const notes = loadJson(`${LS_NOTES_PREFIX}${convId}`, []);
    const updated = notes.filter((n) => n.id !== noteId);
    localStorage.setItem(`${LS_NOTES_PREFIX}${convId}`, JSON.stringify(updated));
    return updated;
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 830;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* silent */ }
  }, []);

  const handleGlobalSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setGlobalSearchResults([]);
      return;
    }
    try {
      setGlobalSearchLoading(true);
      const results = await whatsappService.searchMessages(query);
      setGlobalSearchResults(results);
    } catch {
      setGlobalSearchResults([]);
    } finally {
      setGlobalSearchLoading(false);
    }
  }, []);

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

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await whatsappService.getConversations();
        if (initialLoadDoneRef.current) {
          data.forEach((conv) => {
            const prevUnread = lastKnownMsgCountRef.current[conv.id] || 0;
            const newUnread = conv.unread_count || 0;
            if (newUnread > prevUnread && conv.last_message_direction === 'inbound') {
              playNotificationSound();
            }
          });
        }
        const counts = {};
        data.forEach((c) => { counts[c.id] = c.unread_count || 0; });
        lastKnownMsgCountRef.current = counts;
        initialLoadDoneRef.current = true;
        setConversations(data);
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [playNotificationSound]);

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

  const lastMsgIdRef = useRef(null);
  useEffect(() => {
    if (!selectedConvId) return;
    const interval = setInterval(async () => {
      try {
        const data = await whatsappService.getMessages(selectedConvId);
        if (data.length > 0) {
          const lastMsg = data[data.length - 1];
          if (lastMsgIdRef.current && lastMsg.id !== lastMsgIdRef.current) {
            const isInbound = lastMsg.direction === 'inbound' || lastMsg.from === 'client';
            if (isInbound) playNotificationSound();
          }
          lastMsgIdRef.current = lastMsg.id;
        }
        setMessages(data);
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedConvId, playNotificationSound]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const handler = (e) => {
      if (showConvMenu && convMenuRef.current && !convMenuRef.current.contains(e.target)) {
        setShowConvMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showConvMenu]);

  const filteredConversations = useMemo(() => {
    let list = [...conversations];

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

  const searchInChatResults = useMemo(() => {
    if (!searchInChatQuery.trim()) return [];
    const q = searchInChatQuery.toLowerCase();
    return messages.filter((m) => (m.content || '').toLowerCase().includes(q));
  }, [messages, searchInChatQuery]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConvId || sendingMessage) return;
    const text = messageInput.trim();
    setMessageInput('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    setShowQuickReplies(false);

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

  const handleAttachSelect = (type) => {
    if (type === 'document') fileInputDocRef.current?.click();
    else if (type === 'image') fileInputImgRef.current?.click();
  };

  const readFileAsDataUri = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsDataURL(file);
  });

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          const maxDim = 1200;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
            else { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const result = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(url);
          resolve(result);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error cargando imagen')); };
      img.src = url;
    });
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId) return;
    e.target.value = '';

    const conv = conversations.find(c => c.id === selectedConvId);
    if (!conv) return;

    // Size limit: 10MB for docs, 2MB for images (will be compressed)
    if (file.size > 10 * 1024 * 1024) {
      addNotification('Archivo muy grande (max 10MB)', 'error');
      return;
    }

    setSendingMedia(true);
    addNotification(`Subiendo ${type === 'image' ? 'imagen' : 'documento'}...`, 'info');
    try {
      let dataUri;
      if (type === 'image' && file.type.startsWith('image/')) {
        dataUri = await compressImage(file);
      } else {
        dataUri = await readFileAsDataUri(file);
      }

      const endpoint = type === 'image' ? '/whatsapp/send-image' : '/whatsapp/send-document';
      const body = {
        phone: conv.wa_contact_phone,
        caption: messageInput.trim() || '',
        name: conv.wa_contact_name || '',
        media_data: dataUri,
      };
      if (type === 'document') body.filename = file.name;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Error enviando archivo');
      }

      setMessageInput('');
      addNotification(type === 'image' ? 'Imagen enviada' : 'Documento enviado', 'success');
      const msgs = await whatsappService.getMessages(selectedConvId);
      setMessages(msgs);
      setTimeout(() => {
        const el = document.querySelector(`.${b}__messages`);
        if (el) el.scrollTop = el.scrollHeight;
      }, 100);
    } catch (err) {
      if (err.name === 'AbortError') {
        addNotification('Timeout — archivo muy pesado o conexion lenta', 'error');
      } else {
        addNotification('Error: ' + err.message, 'error');
      }
    } finally {
      setSendingMedia(false);
    }
  };

  const toggleAiMode = async () => {
    if (!selectedConvId) return;
    const newState = !(aiMode[selectedConvId] !== false);
    setAiMode((prev) => ({ ...prev, [selectedConvId]: newState }));
    try {
      await whatsappService.toggleAi(selectedConvId, newState);
    } catch (err) {
      setAiMode((prev) => ({ ...prev, [selectedConvId]: !newState }));
    }
  };

  const handleSelectConv = async (convId) => {
    setSelectedConvId(convId);
    setShowBlast(false);
    setShowClientInfo(false);
    setShowSearchInChat(false);
    setSearchInChatQuery('');
    setReplyingTo(null);
    setMsgContextMenu(null);

    const conv = conversations.find((c) => c.id === convId);
    if (conv && conv.unread_count > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
      try {
        await whatsappService.markAsRead(convId);
      } catch (err) {
      }
    }
  };

  const togglePin = (convId) => {
    setPinnedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const toggleStar = (msgId) => {
    setStarredMsgIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

  const toggleArchive = (convId) => {
    setArchivedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const toggleMute = (convId) => {
    setMutedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const setLabel = async (convId, labelId) => {
    setLabels((prev) => {
      const next = { ...prev };
      if (labelId) next[convId] = labelId;
      else delete next[convId];
      return next;
    });
    setShowLabelPicker(null);
    const labelObj = LABEL_COLORS.find((l) => l.id === labelId);
    const conv = conversations.find((c) => c.id === convId);
    const currentTags = conv?.tags || [];
    const labelIds = LABEL_COLORS.map((l) => l.id);
    const filtered = currentTags.filter((t) => !labelIds.includes(t));
    const newTags = labelId ? [...filtered, labelId] : filtered;
    try {
      await whatsappService.updateTags(convId, newTags);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, tags: newTags } : c))
      );
    } catch (err) {
    }
  };

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

  const handleEmojiSelect = (emoji) => {
    setMessageInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleTemplateSelect = (tpl) => {
    const name = selectedConv?.wa_contact_name || selectedConv?.client?.name || '';
    const nameTag = name ? ` ${name.split(' ')[0]}` : '';
    setMessageInput(tpl.text.replace('{nombre}', nameTag));
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  const handleQuickReplySelect = (reply) => {
    setMessageInput(reply.text);
    setShowQuickReplies(false);
    inputRef.current?.focus();
  };

  const setConvStatus = (convId, statusId) => {
    setConvStatuses((prev) => {
      const next = { ...prev };
      if (statusId) next[convId] = statusId;
      else delete next[convId];
      return next;
    });
    setShowStatusPicker(null);
  };

  const handleClientSearch = (query) => {
    setClientSearchQuery(query);
    if (clientSearchTimer.current) clearTimeout(clientSearchTimer.current);
    if (!query.trim() || query.trim().length < 2) {
      setClientSearchResults([]);
      return;
    }
    setClientSearchLoading(true);
    clientSearchTimer.current = setTimeout(async () => {
      try {
        const results = await clientService.list({ search: query.trim(), active: true });
        setClientSearchResults(Array.isArray(results) ? results.slice(0, 8) : []);
      } catch { setClientSearchResults([]); }
      finally { setClientSearchLoading(false); }
    }, 300);
  };

  const handleSelectClient = (client) => {
    setNewChatPhone(client.phone || '');
    setNewChatName(client.name || '');
    setClientSearchQuery('');
    setClientSearchResults([]);
  };

  const [metaTemplates, setMetaTemplates] = useState([]);
  const [metaTemplatesLoaded, setMetaTemplatesLoaded] = useState(false);

  const loadMetaTemplates = useCallback(async () => {
    if (metaTemplatesLoaded) return;
    try {
      const tpls = await whatsappService.getMetaTemplates();
      setMetaTemplates(Array.isArray(tpls) ? tpls.filter((t) => t.status === 'APPROVED') : []);
    } catch (err) {
    }
    setMetaTemplatesLoaded(true);
  }, [metaTemplatesLoaded]);

  const handleNewChatNext = () => {
    if (!newChatPhone.trim()) return;
    setNewChatError('');
    loadMetaTemplates();

    const existingConv = conversations.find((c) => {
      const convPhone = (c.wa_contact_phone || '').replace(/[+\s-]/g, '');
      const inputPhone = newChatPhone.trim().replace(/[+\s-]/g, '');
      return convPhone === inputPhone || convPhone.endsWith(inputPhone) || inputPhone.endsWith(convPhone);
    });

    if (existingConv) {
      setSelectedConvId(existingConv.id);
      setShowNewChat(false);
      setNewChatPhone('');
      setNewChatName('');
      setNewChatStep('phone');
      return;
    }

    setNewChatStep('template');
  };

  const handleSendTemplate = async (tpl) => {
    const phone = newChatPhone.trim();
    const name = newChatName.trim();

    if (!phone) return;
    setNewChatLoading(true);
    setNewChatError('');

    try {
      const result = await whatsappService.sendTemplate(
        phone,
        name,
        tpl.name,
        tpl.language || 'en_US',
        tpl.body || `[Plantilla: ${tpl.name}]`
      );

      await loadConversations();
      if (result.conversation_id) {
        setSelectedConvId(result.conversation_id);
        try {
          const msgs = await whatsappService.getMessages(result.conversation_id);
          setMessages(msgs);
        } catch { /* will load on next poll */ }
      }

      setShowNewChat(false);
      setNewChatPhone('');
      setNewChatName('');
      setNewChatStep('phone');
      setClientSearchQuery('');
      setClientSearchResults([]);
    } catch (err) {
      setNewChatError(err.message || 'Error al enviar plantilla');
    } finally {
      setNewChatLoading(false);
    }
  };

  const handleCreateNewChat = async (templateText) => {
    const phone = newChatPhone.trim();
    const name = newChatName.trim() || phone;
    const nameTag = newChatName.trim() ? ` ${newChatName.trim().split(' ')[0]}` : '';
    const msgText = (templateText || '').replace('{nombre}', nameTag);

    if (!phone) return;
    setNewChatLoading(true);
    setNewChatError('');

    try {
      const convResult = await whatsappService.createConversation(phone, name);
      const convId = convResult.id;
      await whatsappService.sendMessage(convId, msgText);
      await loadConversations();
      setSelectedConvId(convId);
      try {
        const msgs = await whatsappService.getMessages(convId);
        setMessages(msgs);
      } catch { /* will load on next poll */ }

      setShowNewChat(false);
      setNewChatPhone('');
      setNewChatName('');
      setNewChatStep('phone');
      setClientSearchQuery('');
      setClientSearchResults([]);
    } catch (err) {
      setNewChatError(err.message || 'Error al enviar mensaje');
    } finally {
      setNewChatLoading(false);
    }
  };

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

  const getConvName = (conv) => conv.wa_contact_name || conv.client?.name || conv.wa_contact_phone || 'Contacto';
  const getConvPreview = (conv) => conv.last_message_preview || 'Sin mensajes';

  return (
    <div className={`${b} ${selectedConvId ? `${b}--chat-open` : ''}`}>
      <div className={`${b}__list-panel`}>
        <div className={`${b}__list-header`}>
          <h2 className={`${b}__list-title`}>Chats</h2>
          <div className={`${b}__list-header-actions`}>
            <button className={`${b}__new-chat-btn`} onClick={() => { setShowGlobalSearch(!showGlobalSearch); setGlobalSearchQuery(''); setGlobalSearchResults([]); }} title="Buscar mensajes">
              {Icons.search}
            </button>
            <button className={`${b}__new-chat-btn`} onClick={() => setShowNewChat(!showNewChat)} title="Nuevo chat">
              {Icons.newChat}
            </button>
            <button className={`${b}__blast-trigger ${showBlast ? `${b}__blast-trigger--active` : ''}`} onClick={() => setShowBlast(!showBlast)} title="Envio masivo">
              {Icons.megaphone}
            </button>
            {totalUnread > 0 && <span className={`${b}__unread-total`}>{totalUnread}</span>}
          </div>
        </div>
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
        {showGlobalSearch && (
          <div className={`${b}__global-search-panel`}>
            <div className={`${b}__global-search-header`}>
              <div className={`${b}__global-search-input-wrap`}>
                <span className={`${b}__global-search-icon`}>{Icons.search}</span>
                <input
                  ref={globalSearchRef}
                  type="text"
                  className={`${b}__global-search-input`}
                  placeholder="Buscar en todos los mensajes..."
                  value={globalSearchQuery}
                  onChange={(e) => {
                    setGlobalSearchQuery(e.target.value);
                    if (e.target.value.length >= 3) handleGlobalSearch(e.target.value);
                    else setGlobalSearchResults([]);
                  }}
                  autoFocus
                />
              </div>
              <button className={`${b}__global-search-close`} onClick={() => { setShowGlobalSearch(false); setGlobalSearchQuery(''); setGlobalSearchResults([]); }}>
                {Icons.close}
              </button>
            </div>
            <div className={`${b}__global-search-results`}>
              {globalSearchLoading ? (
                <div className={`${b}__global-search-loading`}>
                  <div className={`${b}__conv-loading-spinner`} />
                  <p>Buscando...</p>
                </div>
              ) : globalSearchQuery.length >= 3 && globalSearchResults.length === 0 ? (
                <div className={`${b}__global-search-empty`}>
                  <p>No se encontraron mensajes</p>
                </div>
              ) : (
                globalSearchResults.map((result) => (
                  <div
                    key={result.id}
                    className={`${b}__global-search-item`}
                    onClick={() => {
                      setSelectedConvId(result.conversation_id);
                      setShowGlobalSearch(false);
                      setGlobalSearchQuery('');
                      setGlobalSearchResults([]);
                    }}
                  >
                    <div className={`${b}__global-search-item-header`}>
                      <span className={`${b}__global-search-item-name`}>{result.contact_name || result.phone_number || 'Desconocido'}</span>
                      <span className={`${b}__global-search-item-time`}>{formatConvTime(result.created_at)}</span>
                    </div>
                    <p className={`${b}__global-search-item-text`}>
                      {(result.content || '').length > 100 ? (result.content || '').slice(0, 100) + '...' : (result.content || '')}
                    </p>
                  </div>
                ))
              )}
              {globalSearchQuery.length < 3 && globalSearchQuery.length > 0 && (
                <div className={`${b}__global-search-hint`}>
                  <p>Escribe al menos 3 caracteres para buscar</p>
                </div>
              )}
            </div>
          </div>
        )}
        {showNewChat && (
          <div className={`${b}__new-chat-panel`}>
            <div className={`${b}__new-chat-header`}>
              <h3 className={`${b}__new-chat-title`}>
                {newChatStep === 'phone' ? 'Nuevo chat' : newChatStep === 'custom' ? 'Mensaje personalizado' : 'Elegir plantilla'}
              </h3>
              <button className={`${b}__new-chat-close`} onClick={() => { setShowNewChat(false); setNewChatStep('phone'); setClientSearchQuery(''); setClientSearchResults([]); setNewChatError(''); }}>
                {Icons.close}
              </button>
            </div>

            {newChatStep === 'phone' && (
              <div className={`${b}__new-chat-form`}>
                <div className={`${b}__new-chat-search-wrap`}>
                  <input
                    type="text"
                    className={`${b}__new-chat-input`}
                    placeholder="Buscar cliente por nombre o telefono..."
                    value={clientSearchQuery}
                    onChange={(e) => handleClientSearch(e.target.value)}
                    autoFocus
                  />
                  {clientSearchLoading && <span className={`${b}__new-chat-search-loading`}>Buscando...</span>}
                  {clientSearchResults.length > 0 && (
                    <div className={`${b}__new-chat-results`}>
                      {clientSearchResults.map((cl) => (
                        <button key={cl.id} className={`${b}__new-chat-result`} onClick={() => handleSelectClient(cl)}>
                          <div className={`${b}__new-chat-result-avatar`} style={{ background: getAvatarColor(cl.name) }}>
                            {getInitials(cl.name)}
                          </div>
                          <div className={`${b}__new-chat-result-info`}>
                            <span className={`${b}__new-chat-result-name`}>{cl.name}</span>
                            <span className={`${b}__new-chat-result-phone`}>{cl.phone}</span>
                          </div>
                          {cl.status && <span className={`${b}__new-chat-result-status ${b}__new-chat-result-status--${cl.status}`}>{cl.status}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`${b}__new-chat-divider`}><span>o escribe el numero directamente</span></div>

                <input type="text" className={`${b}__new-chat-input`} placeholder="Numero (ej: +573001234567)" value={newChatPhone} onChange={(e) => setNewChatPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNewChatNext()} />
                <input type="text" className={`${b}__new-chat-input`} placeholder="Nombre (opcional)" value={newChatName} onChange={(e) => setNewChatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNewChatNext()} />
                {newChatPhone && <p className={`${b}__new-chat-selected`}>Contacto: <strong>{newChatName || newChatPhone}</strong> — {newChatPhone}</p>}
                <button className={`${b}__new-chat-submit`} onClick={handleNewChatNext} disabled={!newChatPhone.trim()}>Siguiente</button>
              </div>
            )}

            {newChatStep === 'template' && (
              <div className={`${b}__new-chat-templates`}>
                <p className={`${b}__new-chat-templates-hint`}>Enviando a <strong>{newChatName || newChatPhone}</strong></p>
                <p className={`${b}__new-chat-meta-note`}>WhatsApp requiere una plantilla aprobada por Meta para iniciar conversaciones con contactos nuevos. Una vez el cliente responda, puedes enviar mensajes libres.</p>
                {newChatError && <p className={`${b}__new-chat-error`}>{newChatError}</p>}
                {metaTemplates.length > 0 ? (
                  <>
                    <p className={`${b}__new-chat-section-label`}>Plantillas disponibles</p>
                    {metaTemplates.map((tpl) => {
                      const friendlyNames = {
                        hello_world: 'Bienvenida (Meta test)',
                        bienvenida_alpelo: 'Bienvenida AlPelo',
                        reactivacion_cliente: 'Reactivacion de cliente',
                        encuesta_servicio: 'Encuesta de servicio',
                        promocion_especial: 'Promocion especial',
                        confirmacion_cita: 'Confirmacion de cita',
                        agradecimiento_visita: 'Agradecimiento post-visita',
                        nuevo_contacto: 'Nuevo contacto',
                        servicios_premium: 'Servicios premium',
                        referido: 'Cliente referido',
                        seguimiento_cliente: 'Seguimiento',
                      };
                      return (
                        <button key={tpl.name} className={`${b}__new-chat-tpl`} onClick={() => handleSendTemplate(tpl)} disabled={newChatLoading}>
                          <span className={`${b}__new-chat-tpl-label`}>{friendlyNames[tpl.name] || tpl.name.replace(/_/g, ' ')}</span>
                          <span className={`${b}__new-chat-tpl-preview`}>{(tpl.body || `Plantilla: ${tpl.name}`).slice(0, 120)}</span>
                          <span className={`${b}__new-chat-tpl-meta`}>{tpl.language} · {tpl.category}</span>
                        </button>
                      );
                    })}
                    <p className={`${b}__new-chat-meta-note`} style={{ marginTop: '12px' }}>Para crear plantillas personalizadas en español, ve a Meta Business Suite → WhatsApp → Plantillas de mensajes.</p>
                  </>
                ) : (
                  <p className={`${b}__new-chat-no-templates`}>
                    {metaTemplatesLoaded ? 'No hay plantillas aprobadas. Crea una en Meta Business Suite → WhatsApp → Plantillas.' : 'Cargando plantillas...'}
                  </p>
                )}

                <div className={`${b}__new-chat-footer`}>
                  <button className={`${b}__new-chat-back`} onClick={() => setNewChatStep('phone')}>← Volver</button>
                  {newChatLoading && <span className={`${b}__new-chat-sending`}>Enviando...</span>}
                </div>
              </div>
            )}

            {newChatStep === 'custom' && (
              <div className={`${b}__new-chat-custom`}>
                <p className={`${b}__new-chat-templates-hint`}>Mensaje para <strong>{newChatName || newChatPhone}</strong></p>
                {newChatError && <p className={`${b}__new-chat-error`}>{newChatError}</p>}
                <textarea
                  className={`${b}__new-chat-textarea`}
                  placeholder="Escribe tu mensaje aqui..."
                  rows={4}
                  id="newChatCustomMsg"
                  autoFocus
                />
                <div className={`${b}__new-chat-footer`}>
                  <button className={`${b}__new-chat-back`} onClick={() => setNewChatStep('template')}>← Volver</button>
                  <button
                    className={`${b}__new-chat-submit`}
                    disabled={newChatLoading}
                    onClick={() => {
                      const txt = document.getElementById('newChatCustomMsg')?.value?.trim();
                      if (txt) handleCreateNewChat(txt);
                    }}
                  >
                    {newChatLoading ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className={`${b}__search`}>
          <span className={`${b}__search-icon`}>{Icons.search}</span>
          <input type="text" className={`${b}__search-input`} placeholder="Buscar o empezar un chat nuevo" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
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
              const convStatus = convStatuses[conv.id];
              const statusObj = convStatus ? CONV_STATUSES.find((s) => s.id === convStatus) : null;

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
                  <div className={`${b}__conv-avatar ${isVip ? `${b}__conv-avatar--vip` : ''}`} style={!isVip && !conv.wa_profile_photo_url ? { background: getAvatarColor(name) } : undefined}>
                    {conv.wa_profile_photo_url ? (
                      <img src={conv.wa_profile_photo_url} alt={name} className={`${b}__conv-avatar-img`} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                    ) : null}
                    <span className={`${b}__conv-avatar-fallback`} style={conv.wa_profile_photo_url ? { display: 'none' } : { display: 'flex', background: isVip ? undefined : getAvatarColor(name) }}>
                      {getInitials(name)}
                    </span>
                  </div>
                  <div className={`${b}__conv-content`}>
                    <div className={`${b}__conv-top`}>
                      <span className={`${b}__conv-name`}>
                        {name.split(' ').slice(0, 2).join(' ')}
                        {isVip && <mark className={`${b}__conv-tag`}>VIP</mark>}
                        {statusObj && (
                          <span className={`${b}__status-badge ${b}__status-badge--${statusObj.id}`}>
                            {statusObj.label}
                          </span>
                        )}
                      </span>
                      {conv.last_sentiment && conv.last_sentiment !== 'neutral' && (
                        <span className={`${b}__conv-sentiment ${b}__conv-sentiment--${conv.last_sentiment}`} title={conv.last_sentiment === 'positive' ? 'Positivo' : conv.last_sentiment === 'negative' ? 'Negativo' : conv.last_sentiment === 'urgent' ? 'Urgente' : ''} />
                      )}
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
                    {conv.tags && conv.tags.length > 0 && (
                      <div className={`${b}__conv-tags`}>
                        {conv.tags.map((tag, i) => (
                          <span key={i} className={`${b}__conv-tag ${b}__conv-tag--${tag}`}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={`${b}__empty`}><p>No se encontraron conversaciones</p></div>
          )}
        </div>
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
            <button onClick={() => { setShowStatusPicker(showConvMenu.id); setShowConvMenu(null); }}>
              {Icons.lightning} Cambiar estado
            </button>
            <button onClick={() => { toggleArchive(showConvMenu.id); setShowConvMenu(null); }}>
              {Icons.archive} {archivedConvIds.includes(showConvMenu.id) ? 'Desarchivar' : 'Archivar'}
            </button>
            <button className={`${b}__conv-context-danger`} onClick={async () => {
              const convId = showConvMenu.id;
              setShowConvMenu(null);
              if (!window.confirm('¿Eliminar esta conversación? Se borrarán todos los mensajes.')) return;
              try {
                await whatsappService.deleteConversation(convId);
                setConversations((prev) => prev.filter((c) => c.id !== convId));
                if (selectedConvId === convId) { setSelectedConvId(null); setMessages([]); }
              } catch { }
            }}>
              {Icons.trash} Eliminar chat
            </button>
          </div>
        )}
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
        {showStatusPicker && (
          <div className={`${b}__label-picker`}>
            <div className={`${b}__label-picker-header`}>
              <span>Estado de conversacion</span>
              <button onClick={() => setShowStatusPicker(null)}>{Icons.close}</button>
            </div>
            {CONV_STATUSES.map((st) => (
              <button
                key={st.id}
                className={`${b}__label-option ${convStatuses[showStatusPicker] === st.id ? `${b}__label-option--active` : ''}`}
                onClick={() => setConvStatus(showStatusPicker, convStatuses[showStatusPicker] === st.id ? null : st.id)}
              >
                <span className={`${b}__label-color`} style={{ background: st.color }} />
                {st.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`${b}__chat-panel`}>
        {selectedConv ? (
          <>
            <div className={`${b}__chat-header`}>
              <button className={`${b}__back-btn`} onClick={() => setSelectedConvId(null)}>
                {Icons.back}
              </button>
              <div className={`${b}__chat-avatar`} style={!selectedConv.wa_profile_photo_url ? { background: getAvatarColor(getConvName(selectedConv)) } : undefined} onClick={() => setShowClientInfo(!showClientInfo)}>
                {selectedConv.wa_profile_photo_url ? (
                  <img src={selectedConv.wa_profile_photo_url} alt="" className={`${b}__chat-avatar-img`} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                ) : null}
                <span className={`${b}__chat-avatar-fallback`} style={selectedConv.wa_profile_photo_url ? { display: 'none' } : { display: 'flex', background: getAvatarColor(getConvName(selectedConv)) }}>
                  {getInitials(getConvName(selectedConv))}
                </span>
              </div>
              <div className={`${b}__chat-info`} onClick={() => setShowClientInfo(!showClientInfo)}>
                <span className={`${b}__chat-name`}>{getConvName(selectedConv)}</span>
                <span className={`${b}__chat-status ${typingState[selectedConvId] ? `${b}__chat-status--typing` : ''}`}>
                  {typingState[selectedConvId] ? 'escribiendo...' : selectedConv?.last_message_at ? `ult. vez ${formatConvTime(selectedConv.last_message_at)}` : ''}
                </span>
              </div>
              <button
                className={`${b}__ai-toggle ${isAiActive ? `${b}__ai-toggle--ai` : `${b}__ai-toggle--human`}`}
                onClick={toggleAiMode}
                title={isAiActive ? 'Lina IA activa' : 'Modo manual'}
              >
                {isAiActive ? Icons.robot : Icons.user}
                <span>{isAiActive ? 'Lina IA' : 'Manual'}</span>
              </button>
            </div>
            {selectedConv && (
              <div className={`${b}__client-bar`}>
                {selectedConv.client ? (
                  <>
                    <span className={`${b}__client-bar-id`}>{selectedConv.client.client_id}</span>
                    <span className={`${b}__client-bar-status ${b}__client-bar-status--${selectedConv.client.status}`}>
                      {selectedConv.client.status}
                    </span>
                    <span className={`${b}__client-bar-visits`}>{selectedConv.client.total_visits} visitas</span>
                    {selectedConv.client.days_since_last_visit !== null && (
                      <span className={`${b}__client-bar-days`}>Ult. visita: hace {selectedConv.client.days_since_last_visit}d</span>
                    )}
                  </>
                ) : (
                  <span className={`${b}__client-bar-new`}>Contacto no registrado</span>
                )}
                <div className={`${b}__client-bar-meter`}>
                  <UsageMeter variant="compact" />
                </div>
              </div>
            )}
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
                            <button
                              className={`${b}__msg-hover-btn`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const menuW = 200;
                                const menuH = 220;
                                let left = isSent ? rect.left - menuW : rect.right - 20;
                                let top = rect.bottom + 4;
                                if (left + menuW > window.innerWidth - 16) left = window.innerWidth - menuW - 16;
                                if (left < 16) left = 16;
                                if (top + menuH > window.innerHeight - 16) top = rect.top - menuH - 4;
                                setMsgContextMenu({
                                  msg,
                                  position: { top, left },
                                });
                              }}
                            >
                              {Icons.chevronDown}
                            </button>
                            {msg.reply_to && (
                              <div className={`${b}__reply-quote`}>
                                <span className={`${b}__reply-quote-text`}>
                                  {(msg.reply_to.content || '').slice(0, 80)}{msg.reply_to.content?.length > 80 ? '...' : ''}
                                </span>
                              </div>
                            )}
                            {msg.sent_by?.startsWith('lina_ia') && (
                              <div className={`${b}__lina-label`}>
                                {Icons.robot}
                                <span>Lina IA</span>
                              </div>
                            )}
                            {msg.media_url && msg.message_type === 'sticker' && (
                              <img src={resolveMediaUrl(msg.media_url)} alt="Sticker" className={`${b}__message-sticker`} loading="lazy" />
                            )}
                            {msg.media_url && (msg.message_type === 'image' || msg.media_mime_type?.startsWith('image/')) && msg.message_type !== 'sticker' && (
                              <>
                                <img src={resolveMediaUrl(msg.media_url)} alt="Imagen" className={`${b}__message-image`} loading="lazy" onClick={() => window.open(resolveMediaUrl(msg.media_url), '_blank')}
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                                {msg.content && <p className={`${b}__message-text`}>{msg.content}</p>}
                              </>
                            )}
                            {msg.media_url && (msg.message_type === 'video' || msg.media_mime_type?.startsWith('video/')) && (
                              <>
                                <video src={resolveMediaUrl(msg.media_url)} controls className={`${b}__message-video`} />
                                {msg.content && <p className={`${b}__message-text`}>{msg.content}</p>}
                              </>
                            )}
                            {msg.media_url && (msg.message_type === 'audio' || msg.media_mime_type?.startsWith('audio/')) && (
                              <>
                                <AudioPlayer src={resolveMediaUrl(msg.media_url)} />
                                {msg.content && (
                                  <p className={`${b}__message-transcript`}>{msg.content}</p>
                                )}
                              </>
                            )}
                            {!msg.media_url && msg.content && (
                              <p className={`${b}__message-text`}>{msg.content || msg.text}</p>
                            )}
                            <div className={`${b}__message-meta`}>
                              {!isSent && msg.sentiment && msg.sentiment !== 'neutral' && (
                                <span className={`${b}__sentiment-dot ${b}__sentiment-dot--${msg.sentiment}`} title={msg.sentiment === 'positive' ? 'Positivo' : msg.sentiment === 'negative' ? 'Negativo' : 'Urgente'} />
                              )}
                              {isStarred && <span className={`${b}__message-star`}>{Icons.star}</span>}
                              <span className={`${b}__message-time`}>{formatTime(msg.created_at || msg.time)}</span>
                              {isSent && <MessageStatus status={msg.status} />}
                              {msg.status === 'failed' && <span className={`${b}__message-failed`}>!</span>}
                            </div>
                          </div>
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
                  {selectedConv?.is_ai_active && messages.length > 0 && messages[messages.length - 1]?.direction === 'inbound' && !typingState[selectedConvId] && (
                    <LinaThinking />
                  )}
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
              {msgContextMenu && (
                <MessageContextMenu
                  msg={msgContextMenu.msg}
                  position={msgContextMenu.position}
                  isStarred={starredMsgIds.includes(msgContextMenu.msg.id)}
                  onAction={handleMsgAction}
                  onClose={() => setMsgContextMenu(null)}
                />
              )}
              {showClientInfo && (
                <ClientSidebar
                  conversation={selectedConv}
                  onClose={() => setShowClientInfo(false)}
                  starredMsgIds={starredMsgIds.filter((id) => messages.some((m) => m.id === id))}
                  getNotes={getNotesForConv}
                  onAddNote={addNoteToConv}
                  onDeleteNote={deleteNoteFromConv}
                  onDelete={async () => {
                    try {
                      await whatsappService.deleteConversation(selectedConvId);
                      setConversations((prev) => prev.filter((c) => c.id !== selectedConvId));
                      setSelectedConvId(null);
                      setMessages([]);
                      setShowClientInfo(false);
                    } catch { }
                  }}
                />
              )}
            </div>
            {isAiActive && (
              <div className={`${b}__ai-bar`}>
                <span className={`${b}__ai-bar-dot`} />
                Lina IA esta respondiendo este chat automaticamente
              </div>
            )}
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
            <div className={`${b}__input-area`}>
              {showEmojiPicker && (
                <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
              )}
              {showAttachMenu && (
                <AttachmentMenu onClose={() => setShowAttachMenu(false)} onSelectType={handleAttachSelect} />
              )}
              {showQuickReplies && (
                <div className={`${b}__quick-replies`}>
                  <div className={`${b}__quick-replies-header`}>
                    <span>Respuestas rapidas</span>
                    <button onClick={() => setShowQuickReplies(false)}>{Icons.close}</button>
                  </div>
                  {QUICK_REPLIES.map((reply) => (
                    <button
                      key={reply.id}
                      className={`${b}__quick-reply-item`}
                      onClick={() => handleQuickReplySelect(reply)}
                    >
                      <span className={`${b}__quick-reply-item-label`}>{reply.label}</span>
                      <span className={`${b}__quick-reply-item-text`}>{reply.text}</span>
                    </button>
                  ))}
                </div>
              )}

              <input type="file" ref={fileInputDocRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={(e) => handleFileUpload(e, 'document')} />
              <input type="file" ref={fileInputImgRef} style={{ display: 'none' }} accept="image/*,video/*" onChange={(e) => handleFileUpload(e, 'image')} />
              <button className={`${b}__input-action ${showAttachMenu ? `${b}__input-action--active` : ''}`} onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); setShowQuickReplies(false); }} title="Adjuntar archivo" disabled={sendingMedia}>
                {sendingMedia ? <svg className={`${b}__spinner`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> : Icons.attach}
              </button>
              <button className={`${b}__input-action ${showEmojiPicker ? `${b}__input-action--active` : ''}`} onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); setShowQuickReplies(false); }} title="Emojis">
                {Icons.smiley}
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
              <button className={`${b}__send-btn ${messageInput.trim() ? `${b}__send-btn--active` : ''}`} onClick={handleSendMessage} disabled={sendingMessage || !messageInput.trim()}>
                {Icons.send}
              </button>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className={`${b}__empty-chat`}>
            <div className={`${b}__empty-chat-bg`}>
              <div className={`${b}__empty-chat-icon`}>{Icons.whatsapp}</div>
              <h3 className={`${b}__empty-chat-title`}>{tenant.name} WhatsApp</h3>
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
