import { useEffect, useMemo, useRef, useState } from 'react';
import templateService from '../../services/templateService';
import campaignService from '../../services/campaignService';
import staffService from '../../services/staffService';
import servicesService from '../../services/servicesService';
import { useNotification } from '../../context/NotificationContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

/**
 * Campaigns view for WhatsApp Web (Baileys) mode.
 *
 * Mirrors the Meta Campaigns layout (KPIs row + template cards + sent campaigns)
 * but with key differences:
 *   - Templates are FREE TEXT (no Meta approval, auto-status="approved")
 *   - Sending respects daily_limit + warm-up curve + random pacing
 *   - When the day's quota is hit, the campaign pauses and resumes when the
 *     limit raises (next day automatically, or admin bumps the cap)
 */

const SVG = {
  plus:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  send:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  edit:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  close:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

const CATEGORIES = [
  { id: 'all',          label: 'Todas' },
  { id: 'recordatorio', label: 'Recordatorio' },
  { id: 'promocion',    label: 'Promocion' },
  { id: 'reactivacion', label: 'Reactivacion' },
  { id: 'fidelizacion', label: 'Fidelizacion' },
  { id: 'bienvenida',   label: 'Bienvenida' },
  { id: 'general',      label: 'General' },
];

const CATEGORY_COLOR = {
  recordatorio: '#3B82F6',
  promocion:    '#F59E0B',
  reactivacion: '#10B981',
  fidelizacion: '#8B5CF6',
  bienvenida:   '#EC4899',
  general:      '#64748B',
};

export default function WebCampaignsView({ b, waStatus, onRefreshStatus }) {
  const { addNotification: notify } = useNotification();

  // ---- data ----
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- toolbar ----
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // ---- new template modal ----
  const [showNewTpl, setShowNewTpl] = useState(false);
  const [editingTpl, setEditingTpl] = useState(null);
  const [tplForm, setTplForm] = useState({ name: '', category: 'promocion', body: '' });
  const [tplSaving, setTplSaving] = useState(false);

  // ---- send campaign modal ----
  const [sendingFor, setSendingFor] = useState(null);
  // Same filter shape as Meta wizard
  const [filters, setFilters] = useState({
    staff_ids: [],
    service_names: [],
    last_visit_days: 0,
    min_spent: '',
    max_spent: '',
    date_from: '',
    date_to: '',
  });
  const [staffList, setStaffList] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load staff + services once for the filter dropdowns
  useEffect(() => {
    (async () => {
      try {
        const [s, sv] = await Promise.all([
          staffService.list({}).catch(() => []),
          servicesService.list({}).catch(() => []),
        ]);
        setStaffList(Array.isArray(s) ? s : []);
        setServicesList(Array.isArray(sv) ? sv : []);
      } catch {}
    })();
  }, []);

  // ---- quota ----
  const dailyLimit = waStatus?.daily_limit || 20;
  const sentToday = waStatus?.sent_today || 0;
  const remainingToday = Math.max(0, dailyLimit - sentToday);
  const connected = waStatus?.db_status === 'connected';

  const pollRef = useRef(null);

  const fetchAll = async () => {
    try {
      const [tpls, camps] = await Promise.all([
        templateService.getTemplates().catch(() => []),
        campaignService.list().catch(() => []),
      ]);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setCampaigns(Array.isArray(camps) ? camps : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    const hasSending = campaigns.some(c => c.status === 'sending');
    if (hasSending) {
      pollRef.current = setInterval(() => {
        fetchAll();
        if (typeof onRefreshStatus === 'function') onRefreshStatus();
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [campaigns]);

  const stats = useMemo(() => {
    const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
    const sending   = campaigns.filter(c => c.status === 'sending').length;
    const completed = campaigns.filter(c => c.status === 'sent').length;
    const paused    = campaigns.filter(c => (c.status || '').startsWith('paused')).length;
    return { totalTemplates: templates.length, totalSent, sending, completed, paused };
  }, [templates, campaigns]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter(t => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false;
      if (!q) return true;
      return (t.name || '').toLowerCase().includes(q) || (t.body || '').toLowerCase().includes(q);
    });
  }, [templates, search, activeCategory]);

  const openNewTpl = () => {
    setEditingTpl(null);
    setTplForm({ name: '', category: 'promocion', body: '' });
    setShowNewTpl(true);
  };

  const openEditTpl = (tpl) => {
    setEditingTpl(tpl);
    setTplForm({ name: tpl.name || '', category: tpl.category || 'general', body: tpl.body || '' });
    setShowNewTpl(true);
  };

  const saveTpl = async () => {
    if (!tplForm.name.trim() || !tplForm.body.trim()) {
      notify({ type: 'error', message: 'Nombre y mensaje son requeridos' });
      return;
    }
    setTplSaving(true);
    try {
      if (editingTpl) {
        await templateService.updateTemplate(editingTpl.id, tplForm);
      } else {
        await templateService.createTemplate(tplForm);
      }
      setShowNewTpl(false);
      await fetchAll();
      notify({ type: 'success', message: editingTpl ? 'Plantilla actualizada' : 'Plantilla creada' });
    } catch (e) {
      notify({ type: 'error', message: e.message || 'No se pudo guardar' });
    } finally {
      setTplSaving(false);
    }
  };

  const deleteTpl = async (tpl) => {
    if (!window.confirm(`Eliminar la plantilla "${tpl.name}"?`)) return;
    try {
      await templateService.deleteTemplate(tpl.id);
      await fetchAll();
    } catch (e) {
      notify({ type: 'error', message: e.message });
    }
  };

  const openSend = (tpl) => {
    setSendingFor(tpl);
    setCampaignName(`${tpl.name} — ${new Date().toLocaleDateString('es-CO')}`);
    setFilters({
      staff_ids: [],
      service_names: [],
      last_visit_days: 0,
      min_spent: '',
      max_spent: '',
      date_from: '',
      date_to: '',
    });
    setAudiencePreview(null);
  };

  // Build the segment_filters payload from the local filter state — strips empty values
  const buildSegmentFilters = (f) => {
    const p = {};
    if (f.staff_ids && f.staff_ids.length) p.staff_ids = f.staff_ids;
    if (f.service_names && f.service_names.length) p.service_names = f.service_names;
    if (f.last_visit_days) p.last_visit_days = parseInt(f.last_visit_days, 10);
    if (f.min_spent !== '' && f.min_spent !== null) p.min_spent = parseInt(f.min_spent, 10);
    if (f.max_spent !== '' && f.max_spent !== null) p.max_spent = parseInt(f.max_spent, 10);
    if (f.date_from) p.date_from = f.date_from;
    if (f.date_to) p.date_to = f.date_to;
    return p;
  };

  const refreshPreview = async () => {
    if (!sendingFor) return;
    setPreviewLoading(true);
    try {
      const segment_filters = buildSegmentFilters(filters);
      const res = await fetch(`${API_URL}/campaigns/audience/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_filters }),
      });
      if (res.ok) setAudiencePreview(await res.json());
    } finally {
      setPreviewLoading(false);
    }
  };

  // Debounce preview when filters change
  useEffect(() => {
    if (!sendingFor) return;
    const t = setTimeout(refreshPreview, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sendingFor]);

  // Toggle helpers for multi-check pills
  const toggleStaff = (id) => {
    setFilters(f => ({
      ...f,
      staff_ids: f.staff_ids.includes(id) ? f.staff_ids.filter(x => x !== id) : [...f.staff_ids, id],
    }));
  };
  const toggleService = (name) => {
    setFilters(f => ({
      ...f,
      service_names: f.service_names.includes(name) ? f.service_names.filter(x => x !== name) : [...f.service_names, name],
    }));
  };

  const launchSend = async () => {
    if (!sendingFor) return;
    if (!connected) { notify({ type: 'error', message: 'WhatsApp Web no conectado' }); return; }
    if (!audiencePreview || (audiencePreview.count || 0) === 0) {
      notify({ type: 'error', message: 'No hay audiencia que coincida' });
      return;
    }
    setSubmitting(true);
    try {
      const segment_filters = buildSegmentFilters(filters);
      const camp = await campaignService.create({
        name: campaignName.trim() || sendingFor.name,
        campaign_type: 'web_free_text',
        message_body: sendingFor.body,
        meta_template_name: sendingFor.slug,
        segment_filters,
      });
      const res = await fetch(`${API_URL}/campaigns/${camp.id}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo iniciar la campaña');
      }
      const audCount = audiencePreview.count || 0;
      const overflow = audCount - remainingToday;
      notify({
        type: 'success',
        message: overflow > 0
          ? `Iniciada: ${remainingToday} hoy + ${overflow} pausada hasta mañana`
          : `Iniciada a ${audCount} contactos`,
      });
      setSendingFor(null);
      await fetchAll();
    } catch (e) {
      notify({ type: 'error', message: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const statusPill = (s) => {
    const map = {
      sending:             { label: 'Enviando',                    color: '#1E40AF', bg: 'rgba(30,64,175,0.10)' },
      sent:                { label: 'Completada',                  color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
      paused_quota:        { label: 'Pausada — limite diario',     color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
      paused_disconnected: { label: 'Pausada — sin conexion',      color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
      failed:              { label: 'Fallida',                     color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
      draft:               { label: 'Borrador',                    color: '#64748B', bg: 'rgba(100,116,139,0.10)' },
    };
    const v = map[s] || map.draft;
    return <span className={`${b}__webcamp-pill`} style={{ color: v.color, background: v.bg }}>{v.label}</span>;
  };

  return (
    <div className={`${b}__webcamp`}>
      {/* KPIs */}
      <div className={`${b}__webcamp-kpis`}>
        {[
          { label: 'Plantillas',         value: stats.totalTemplates, color: '#1E40AF' },
          { label: 'Disponibles hoy',    value: `${remainingToday}/${dailyLimit}`, color: '#10B981' },
          { label: 'Enviando ahora',     value: stats.sending, color: '#F59E0B' },
          { label: 'Mensajes enviados',  value: stats.totalSent, color: '#6366F1' },
        ].map((k, i) => (
          <div key={i} className={`${b}__webcamp-kpi`}>
            <span className={`${b}__webcamp-kpi-bar`} style={{ background: k.color }} />
            <div className={`${b}__webcamp-kpi-content`}>
              <span className={`${b}__webcamp-kpi-value`}>{k.value}</span>
              <span className={`${b}__webcamp-kpi-label`}>{k.label}</span>
            </div>
          </div>
        ))}
      </div>

      {!connected ? (
        <div className={`${b}__webcamp-warning`}>
          WhatsApp Web no está conectado. Vaya a Configuración → Numero personal (Web) y escanee el QR.
        </div>
      ) : (
        <div className={`${b}__webcamp-quota`}>
          <div className={`${b}__webcamp-quota-row`}>
            <span><strong>Cuota diaria:</strong> {sentToday} enviados / {dailyLimit} limite</span>
            <span><strong>Pacing:</strong> {(waStatus?.pacing_seconds || [30,90])[0]}–{(waStatus?.pacing_seconds || [30,90])[1]}s entre mensajes</span>
          </div>
          <div className={`${b}__webcamp-quota-bar`}>
            <div className={`${b}__webcamp-quota-bar-fill`} style={{ width: `${Math.min(100, (sentToday / Math.max(1, dailyLimit)) * 100)}%` }} />
          </div>
        </div>
      )}

      <div className={`${b}__webcamp-section-head`}>
        <div>
          <h3 className={`${b}__webcamp-section-title`}>Plantillas</h3>
          <p className={`${b}__webcamp-section-sub`}>Texto libre. Sin aprobación de Meta. Click "Enviar" para lanzar a tus clientes con pacing automático.</p>
        </div>
        <button className={`${b}__webcamp-btn ${b}__webcamp-btn--primary`} onClick={openNewTpl} disabled={!connected}>
          {SVG.plus} Nueva plantilla
        </button>
      </div>

      <div className={`${b}__webcamp-toolbar`}>
        <div className={`${b}__webcamp-search`}>
          {SVG.search}
          <input type="text" placeholder="Buscar plantilla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className={`${b}__webcamp-pills`}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`${b}__webcamp-pill-btn ${activeCategory === cat.id ? `${b}__webcamp-pill-btn--active` : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={`${b}__webcamp-empty`}>Cargando plantillas...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className={`${b}__webcamp-empty`}>
          {templates.length === 0
            ? 'Aún no hay plantillas. Cree la primera con el botón de arriba.'
            : 'Ninguna plantilla coincide con la búsqueda.'}
        </div>
      ) : (
        <div className={`${b}__webcamp-grid`}>
          {filteredTemplates.map(tpl => (
            <div key={tpl.id} className={`${b}__webcamp-card`}>
              <div className={`${b}__webcamp-card-top`}>
                <span className={`${b}__webcamp-card-cat`} style={{ background: CATEGORY_COLOR[tpl.category] || '#64748B' }}>
                  {tpl.category || 'general'}
                </span>
                <div className={`${b}__webcamp-card-actions`}>
                  <button className={`${b}__webcamp-icon-btn`} onClick={() => openEditTpl(tpl)} title="Editar">{SVG.edit}</button>
                  <button className={`${b}__webcamp-icon-btn ${b}__webcamp-icon-btn--danger`} onClick={() => deleteTpl(tpl)} title="Eliminar">{SVG.trash}</button>
                </div>
              </div>
              <h4 className={`${b}__webcamp-card-title`}>{tpl.name}</h4>
              <p className={`${b}__webcamp-card-body`}>{tpl.body}</p>
              <div className={`${b}__webcamp-card-footer`}>
                {tpl.times_sent ? <span className={`${b}__webcamp-card-meta`}>Enviada {tpl.times_sent}×</span> : <span className={`${b}__webcamp-card-meta`}>Sin envíos</span>}
                <button className={`${b}__webcamp-btn ${b}__webcamp-btn--send`} onClick={() => openSend(tpl)} disabled={!connected}>
                  {SVG.send} Enviar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {campaigns.length > 0 && (
        <div className={`${b}__webcamp-history`}>
          <h3 className={`${b}__webcamp-section-title`}>Campañas enviadas</h3>
          <div className={`${b}__webcamp-history-list`}>
            {campaigns.map(c => {
              const total = c.audience_count || 0;
              const sent = c.sent_count || 0;
              const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
              return (
                <div key={c.id} className={`${b}__webcamp-row`}>
                  <div className={`${b}__webcamp-row-main`}>
                    <strong>{c.name}</strong>
                    <span className={`${b}__webcamp-row-body`}>{(c.message_body || '').slice(0, 100)}{(c.message_body || '').length > 100 ? '…' : ''}</span>
                  </div>
                  <div className={`${b}__webcamp-row-stats`}>
                    <span>{sent}/{total}</span>
                    {c.status === 'sending' && (
                      <div className={`${b}__webcamp-row-progress`}>
                        <div className={`${b}__webcamp-row-progress-fill`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {statusPill(c.status)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New / edit template modal */}
      {showNewTpl && (
        <div className={`${b}__webcamp-modal-backdrop`} onClick={() => !tplSaving && setShowNewTpl(false)}>
          <div className={`${b}__webcamp-modal`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__webcamp-modal-header`}>
              <h3>{editingTpl ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
              <button className={`${b}__webcamp-modal-close`} onClick={() => setShowNewTpl(false)}>{SVG.close}</button>
            </div>
            <div className={`${b}__webcamp-modal-body`}>
              <label className={`${b}__webcamp-field`}>
                <span>Nombre interno</span>
                <input type="text" value={tplForm.name} onChange={e => setTplForm({ ...tplForm, name: e.target.value })} placeholder="Promo de fin de mes" autoFocus />
              </label>
              <label className={`${b}__webcamp-field`}>
                <span>Categoria</span>
                <select value={tplForm.category} onChange={e => setTplForm({ ...tplForm, category: e.target.value })}>
                  {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label className={`${b}__webcamp-field`}>
                <span>Mensaje</span>
                <textarea
                  rows={6}
                  value={tplForm.body}
                  onChange={e => setTplForm({ ...tplForm, body: e.target.value })}
                  placeholder={`Hola {{nombre}}, te escribo desde {{negocio}}...\n\nVariables: {{nombre}}, {{negocio}}, {{servicio}}`}
                />
                <span className={`${b}__webcamp-field-hint`}>Las variables se reemplazan por cada cliente al enviar.</span>
              </label>
            </div>
            <div className={`${b}__webcamp-modal-footer`}>
              <button className={`${b}__webcamp-btn ${b}__webcamp-btn--ghost`} onClick={() => setShowNewTpl(false)} disabled={tplSaving}>Cancelar</button>
              <button className={`${b}__webcamp-btn ${b}__webcamp-btn--primary`} onClick={saveTpl} disabled={tplSaving || !tplForm.name.trim() || !tplForm.body.trim()}>
                {tplSaving ? 'Guardando...' : (editingTpl ? 'Actualizar' : 'Guardar plantilla')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send modal — same filter set as Meta wizard */}
      {sendingFor && (
        <div className={`${b}__webcamp-modal-backdrop`} onClick={() => !submitting && setSendingFor(null)}>
          <div className={`${b}__webcamp-modal ${b}__webcamp-modal--wide`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__webcamp-modal-header`}>
              <h3>Enviar — {sendingFor.name}</h3>
              <button className={`${b}__webcamp-modal-close`} onClick={() => setSendingFor(null)}>{SVG.close}</button>
            </div>
            <div className={`${b}__webcamp-modal-body`}>
              <div className={`${b}__webcamp-preview-msg`}>
                <span className={`${b}__webcamp-preview-msg-label`}>Mensaje a enviar</span>
                <p>{sendingFor.body}</p>
              </div>

              <label className={`${b}__webcamp-field`}>
                <span>Nombre de la campaña</span>
                <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
              </label>

              {/* ===== Filtro Profesional ===== */}
              <div className={`${b}__webcamp-filter-group`}>
                <span className={`${b}__webcamp-filter-label`}>Profesional</span>
                <div className={`${b}__webcamp-filter-pills`}>
                  {staffList.length === 0 ? (
                    <span className={`${b}__webcamp-filter-empty`}>Sin profesionales registrados</span>
                  ) : staffList.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className={`${b}__webcamp-filter-pill ${filters.staff_ids.includes(s.id) ? `${b}__webcamp-filter-pill--active` : ''}`}
                      onClick={() => toggleStaff(s.id)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== Filtro Servicio ===== */}
              <div className={`${b}__webcamp-filter-group`}>
                <span className={`${b}__webcamp-filter-label`}>Servicio utilizado</span>
                <div className={`${b}__webcamp-filter-pills`}>
                  {servicesList.length === 0 ? (
                    <span className={`${b}__webcamp-filter-empty`}>Sin servicios registrados</span>
                  ) : servicesList.map(sv => (
                    <button
                      key={sv.id}
                      type="button"
                      className={`${b}__webcamp-filter-pill ${filters.service_names.includes(sv.name) ? `${b}__webcamp-filter-pill--active` : ''}`}
                      onClick={() => toggleService(sv.name)}
                    >
                      {sv.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== Filtro Inactividad ===== */}
              <div className={`${b}__webcamp-filter-group`}>
                <span className={`${b}__webcamp-filter-label`}>Inactividad</span>
                <div className={`${b}__webcamp-filter-pills`}>
                  {[
                    { v: 0,  label: 'Sin filtro' },
                    { v: 7,  label: '+7 días' },
                    { v: 30, label: '+30 días' },
                    { v: 60, label: '+60 días' },
                    { v: 90, label: '+90 días' },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      className={`${b}__webcamp-filter-pill ${filters.last_visit_days === opt.v ? `${b}__webcamp-filter-pill--active` : ''}`}
                      onClick={() => setFilters(f => ({ ...f, last_visit_days: opt.v }))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== Filtro Gasto ===== */}
              <div className={`${b}__webcamp-filter-group`}>
                <span className={`${b}__webcamp-filter-label`}>Gasto histórico (COP)</span>
                <div className={`${b}__webcamp-filter-row`}>
                  <input
                    type="number"
                    placeholder="Mínimo"
                    value={filters.min_spent}
                    onChange={e => setFilters(f => ({ ...f, min_spent: e.target.value }))}
                  />
                  <input
                    type="number"
                    placeholder="Máximo"
                    value={filters.max_spent}
                    onChange={e => setFilters(f => ({ ...f, max_spent: e.target.value }))}
                  />
                </div>
              </div>

              {/* ===== Filtro Fechas ===== */}
              <div className={`${b}__webcamp-filter-group`}>
                <span className={`${b}__webcamp-filter-label`}>Periodo de visita</span>
                <div className={`${b}__webcamp-filter-row`}>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                  />
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                  />
                </div>
              </div>

              {/* ===== Audience preview ===== */}
              <div className={`${b}__webcamp-preview`}>
                {previewLoading ? (
                  <span>Calculando audiencia...</span>
                ) : audiencePreview ? (
                  <>
                    <div><strong>{audiencePreview.count || 0}</strong> contactos coinciden con los filtros.</div>
                    {(audiencePreview.count || 0) > remainingToday && (
                      <div className={`${b}__webcamp-preview-warning`}>
                        ⚠ Hoy solo se enviarán los primeros <strong>{remainingToday}</strong>. Los demás ({(audiencePreview.count || 0) - remainingToday}) quedan pausados hasta mañana cuando se renueve la cuota. Esto protege tu numero de bloqueo.
                      </div>
                    )}
                    {(audiencePreview.count || 0) > 0 && (
                      <div className={`${b}__webcamp-preview-eta`}>
                        Tiempo estimado: ~{Math.ceil(Math.min(audiencePreview.count || 0, remainingToday))} min para los de hoy con pacing 30–90s
                      </div>
                    )}
                  </>
                ) : <span>—</span>}
              </div>
            </div>
            <div className={`${b}__webcamp-modal-footer`}>
              <button className={`${b}__webcamp-btn ${b}__webcamp-btn--ghost`} onClick={() => setSendingFor(null)} disabled={submitting}>Cancelar</button>
              <button
                className={`${b}__webcamp-btn ${b}__webcamp-btn--primary`}
                onClick={launchSend}
                disabled={submitting || !connected || (audiencePreview?.count || 0) === 0}
              >
                {SVG.send} {submitting ? 'Iniciando...' : `Enviar a ${audiencePreview?.count || 0}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
