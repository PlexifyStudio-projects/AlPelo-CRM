const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const BASE = `${API}/automation-studio`;

const _json = (r) => r.json();
const _err = async (r, fallback) => {
  const e = await r.json().catch(() => ({}));
  throw new Error(e.detail || fallback);
};

const automationStudioService = {
  // ── CRUD ──

  list: async () => {
    const r = await fetch(BASE);
    return r.ok ? _json(r) : { automations: [], plan: 'trial', plan_limit: 3, active_count: 0, total_count: 0 };
  },

  create: async (data) => {
    const r = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) await _err(r, 'Error al crear automatización');
    return _json(r);
  },

  update: async (id, data) => {
    const r = await fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) await _err(r, 'Error al actualizar');
    return _json(r);
  },

  delete: async (id) => {
    const r = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
    if (!r.ok) await _err(r, 'Error al eliminar');
    return _json(r);
  },

  duplicate: async (id) => {
    const r = await fetch(`${BASE}/${id}/duplicate`, { method: 'POST' });
    if (!r.ok) await _err(r, 'Error al duplicar');
    return _json(r);
  },

  // ── Preview ──

  previewAudience: async (triggerType, triggerConfig, filterConfig) => {
    const r = await fetch(`${BASE}/preview-audience`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger_type: triggerType,
        trigger_config: triggerConfig || {},
        filter_config: filterConfig || {},
      }),
    });
    return r.ok ? _json(r) : { total_clients: 0, matching: 0, sample_names: [] };
  },

  // ── Meta ──

  submitToMeta: async (id) => {
    const r = await fetch(`${BASE}/${id}/submit-to-meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!r.ok) await _err(r, 'Error al enviar a Meta');
    return _json(r);
  },

  checkMetaStatus: async (id) => {
    const r = await fetch(`${BASE}/${id}/check-meta-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!r.ok) await _err(r, 'Error al verificar estado');
    return _json(r);
  },

  // ── History & Stats ──

  getExecutions: async (limit = 50) => {
    const r = await fetch(`${BASE}/executions?limit=${limit}`);
    return r.ok ? _json(r) : [];
  },

  getRuleExecutions: async (ruleId, limit = 50) => {
    const r = await fetch(`${BASE}/${ruleId}/executions?limit=${limit}`);
    return r.ok ? _json(r) : { executions: [], month_stats: { sent: 0, responded: 0, response_rate: 0 } };
  },

  getStats: async () => {
    const r = await fetch(`${BASE}/stats`);
    return r.ok ? _json(r) : { active_count: 0, total_count: 0, sent_this_month: 0, sent_total: 0, response_rate: 0 };
  },

  // ── Wizard helpers ──

  getTriggers: async () => {
    const r = await fetch(`${BASE}/triggers`);
    return r.ok ? _json(r) : [];
  },

  getSuggestedTemplates: async () => {
    const r = await fetch(`${BASE}/suggested-templates`);
    return r.ok ? _json(r) : { business_type: 'general', templates: [] };
  },

  getClientsPreview: async () => {
    const r = await fetch(`${BASE}/clients-preview`);
    return r.ok ? _json(r) : [];
  },
};

export default automationStudioService;
