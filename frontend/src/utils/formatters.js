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

const PHONE_PREFIXES = [
  { prefix: '57', len: 10 },
  { prefix: '58', len: 10 },
  { prefix: '51', len: 9 },
  { prefix: '593', len: 9 },
  { prefix: '56', len: 9 },
  { prefix: '54', len: 10 },
  { prefix: '55', len: 11 },
  { prefix: '1', len: 10 },
  { prefix: '52', len: 10 },
  { prefix: '507', len: 8 },
  { prefix: '506', len: 8 },
  { prefix: '502', len: 8 },
  { prefix: '591', len: 8 },
  { prefix: '595', len: 9 },
  { prefix: '598', len: 8 },
  { prefix: '34', len: 9 },
];

export const formatPhone = (raw) => {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 7) return raw;

  let prefix = '57';
  let local = digits;

  for (const p of PHONE_PREFIXES) {
    if (digits.startsWith(p.prefix) && digits.length >= p.prefix.length + 7) {
      prefix = p.prefix;
      local = digits.slice(p.prefix.length);
      break;
    }
  }

  if (local === digits && digits.length === 10) {
    prefix = '57';
    local = digits;
  }

  if (local.length === 10) return `+${prefix} (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  if (local.length === 9) return `+${prefix} (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  if (local.length === 8) return `+${prefix} (${local.slice(0, 4)}) ${local.slice(4)}`;
  if (local.length === 11) return `+${prefix} (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;

  return `+${prefix} ${local}`;
};
