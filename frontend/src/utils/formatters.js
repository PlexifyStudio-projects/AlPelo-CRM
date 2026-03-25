export const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

export const formatDate = (date) => {
  const d = typeof date === 'string' && date.length === 10 ? new Date(date + 'T12:00:00') : new Date(date);
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
};

export const formatTime = (date) =>
  new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));

export const daysSince = (date) => {
  const d = typeof date === 'string' && date.length === 10 ? new Date(date + 'T12:00:00') : new Date(date);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Format phone number for display: +57 (317) 521-1170
 * Detects country by prefix or defaults to Colombia (+57).
 * Always stores raw digits, only formats for display.
 */
const PHONE_PREFIXES = [
  { prefix: '57', code: 'CO', len: 10 },
  { prefix: '58', code: 'VE', len: 10 },
  { prefix: '51', code: 'PE', len: 9 },
  { prefix: '593', code: 'EC', len: 9 },
  { prefix: '56', code: 'CL', len: 9 },
  { prefix: '54', code: 'AR', len: 10 },
  { prefix: '55', code: 'BR', len: 11 },
  { prefix: '1', code: 'US', len: 10 },
  { prefix: '52', code: 'MX', len: 10 },
  { prefix: '507', code: 'PA', len: 8 },
  { prefix: '506', code: 'CR', len: 8 },
  { prefix: '502', code: 'GT', len: 8 },
  { prefix: '591', code: 'BO', len: 8 },
  { prefix: '595', code: 'PY', len: 9 },
  { prefix: '598', code: 'UY', len: 8 },
  { prefix: '34', code: 'ES', len: 9 },
];

export const formatPhone = (raw) => {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 7) return raw; // too short, return as-is

  // Try to detect country prefix
  let prefix = '57';
  let local = digits;

  for (const p of PHONE_PREFIXES) {
    if (digits.startsWith(p.prefix) && digits.length >= p.prefix.length + 7) {
      prefix = p.prefix;
      local = digits.slice(p.prefix.length);
      break;
    }
  }

  // If no prefix matched and length is 10 (Colombian mobile), assume +57
  if (local === digits && digits.length === 10) {
    prefix = '57';
    local = digits;
  }

  // Format local number as (XXX) XXX-XXXX or similar
  if (local.length === 10) {
    return `+${prefix} (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (local.length === 9) {
    return `+${prefix} (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (local.length === 8) {
    return `+${prefix} (${local.slice(0, 4)}) ${local.slice(4)}`;
  }
  if (local.length === 11) {
    return `+${prefix} (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }

  // Fallback: just add prefix
  return `+${prefix} ${local}`;
};
