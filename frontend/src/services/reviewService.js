const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const STORAGE_KEY = 'plexify_reviews_config';

const DEFAULT_CONFIG = {
  googleReviewsUrl: '',
  satisfactionThreshold: 4,
  autoSendEnabled: false,
  delayAfterVisit: '2h',
  surveyMessage: 'Hola {{nombre}}, gracias por visitarnos! Como fue tu experiencia? Responde del 1 al 5',
  positiveFollowUp: 'Genial! Nos alegra mucho. Podrias dejarnos una resena? Tu opinion nos ayuda a crecer {{google_reviews_url}}',
  negativeFollowUp: 'Lamentamos que tu experiencia no fue perfecta. {{owner_name}} se comunicara contigo personalmente para resolverlo.',
  ownerNotification: 'Cliente {{nombre}} califico {{rating}}/5 despues de su visita. Motivo: {{feedback}}. Contactar: {{phone}}',
};

const MOCK_REVIEWS = [
  { id: 'rv_1', clientName: 'Carlos Ramirez', phone: '+57 310 555 1234', date: '2026-03-15T14:30:00', rating: 5, feedback: 'Excelente servicio, muy profesional el corte.', status: 'sent_to_google' },
  { id: 'rv_2', clientName: 'Andres Gomez', phone: '+57 315 555 5678', date: '2026-03-15T11:00:00', rating: 2, feedback: 'Tuve que esperar mucho tiempo.', status: 'escalated' },
  { id: 'rv_3', clientName: 'Miguel Torres', phone: '+57 320 555 9012', date: '2026-03-14T16:45:00', rating: 5, feedback: 'Siempre impecable, el mejor lugar.', status: 'sent_to_google' },
  { id: 'rv_4', clientName: 'Juan Pablo Diaz', phone: '+57 311 555 3456', date: '2026-03-14T10:20:00', rating: 4, feedback: 'Muy buen servicio, volvere pronto.', status: 'sent_to_google' },
  { id: 'rv_5', clientName: 'Felipe Herrera', phone: '+57 318 555 7890', date: '2026-03-13T15:10:00', rating: 1, feedback: 'No me gusto el resultado, esperaba algo diferente.', status: 'escalated' },
  { id: 'rv_6', clientName: 'Santiago Ruiz', phone: '+57 312 555 2345', date: '2026-03-13T12:00:00', rating: 5, feedback: 'Atencion de primera!', status: 'sent_to_google' },
  { id: 'rv_7', clientName: 'David Moreno', phone: '+57 316 555 6789', date: '2026-03-12T09:30:00', rating: 3, feedback: 'Regular, podria mejorar la limpieza.', status: 'escalated' },
  { id: 'rv_8', clientName: 'Alejandro Castro', phone: '+57 319 555 0123', date: '2026-03-12T14:00:00', rating: 4, feedback: 'Buen corte, ambiente agradable.', status: 'sent_to_google' },
  { id: 'rv_9', clientName: 'Oscar Mendoza', phone: '+57 313 555 4567', date: '2026-03-11T11:45:00', rating: 5, feedback: 'El mejor corte que me han hecho.', status: 'sent_to_google' },
  { id: 'rv_10', clientName: 'Roberto Valencia', phone: '+57 317 555 8901', date: '2026-03-10T16:20:00', rating: 0, feedback: '', status: 'no_response' },
];

const MOCK_STATS = {
  totalSent: 187,
  responseRate: 68,
  averageRating: 4.2,
  positiveRedirected: 94,
  issuesEscalated: 18,
  distribution: { 1: 5, 2: 8, 3: 15, 4: 38, 5: 61 },
};

const reviewService = {
  getConfig: async () => {
    try {
      const res = await fetch(`${API}/reviews/config`, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch { /* fallback below */ }
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { ...DEFAULT_CONFIG };
  },

  saveConfig: async (config) => {
    try {
      const res = await fetch(`${API}/reviews/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (res.ok) return await res.json();
    } catch { /* fallback below */ }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return config;
  },

  getStats: async (period = 'month') => {
    try {
      const res = await fetch(`${API}/reviews/stats?period=${period}`, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch { /* fallback below */ }
    return { ...MOCK_STATS };
  },

  getRecentReviews: async (limit = 10) => {
    try {
      const res = await fetch(`${API}/reviews/recent?limit=${limit}`, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch { /* fallback below */ }
    return MOCK_REVIEWS.slice(0, limit);
  },
};

export default reviewService;
