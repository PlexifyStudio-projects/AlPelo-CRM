import { useEffect, useMemo, useRef, useState } from 'react';
import staffService from '../../services/staffService';
import servicesService from '../../services/servicesService';
import campaignService from '../../services/campaignService';
import { useNotification } from '../../context/NotificationContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

/**
 * 4-step send wizard for WhatsApp Web campaigns. Mirrors the Meta wizard:
 *
 *   1) Plantilla   — already selected before entering this view
 *   2) Audiencia   — quick segments + advanced accordions + preview sidebar
 *   3) Contactos   — selectable list with checkboxes (uncheck specific people)
 *   4) Envio       — final review + launch
 *
 * The dueño's quota / pacing / anti-ban rules are enforced by the backend
 * Web sender, so the wizard's job here is just clean filter UX + selection.
 */

const SVG = {
  check:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  search:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  send:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  arrow:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  chevron:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  users:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  service:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  money:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  cal:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
};

// Quick segment buttons that map to backend filter combinations
const QUICK_SEGMENTS = [
  { id: 'all',          label: 'Todos los clientes',     filters: {} },
  { id: 'vip',          label: 'Clientes VIP',           filters: { status: 'vip' } },
  { id: 'risk',         label: 'En riesgo',              filters: { status: 'en_riesgo' } },
  { id: 'inactive_30',  label: 'Inactivos +30 dias',     filters: { days_inactive: 30 } },
  { id: 'inactive_60',  label: 'Inactivos +60 dias',     filters: { days_inactive: 60 } },
  { id: 'inactive_90',  label: 'Inactivos +90 dias',     filters: { days_inactive: 90 } },
  { id: 'new',          label: 'Nuevos (1 visita)',      filters: { max_visits: 1 } },
  { id: 'frequent',     label: 'Frecuentes (5+)',        filters: { min_visits: 5 } },
  { id: 'birthday',     label: 'Cumpleañeros',           filters: { birthday_month: new Date().getMonth() + 1 } },
  { id: 'top20',        label: 'Alto valor (top 20%)',   filters: { top_spenders_pct: 20 } },
];

const empty = () => ({
  staff_ids: [],
  service_names: [],
  min_spent: '',
  max_spent: '',
  date_from: '',
  date_to: '',
  days_inactive: 0,
  status: '',
  min_visits: '',
  max_visits: '',
  birthday_month: 0,
  top_spenders_pct: 0,
});


export default function WebSendWizard({ b, template, waStatus, onCancel, onSent }) {
  const { addNotification: notify } = useNotification();

  const [step, setStep] = useState(2); // 1=plantilla (skipped, already chosen), 2=audiencia, 3=contactos, 4=envio
  const [filters, setFilters] = useState(empty());
  const [activeSegment, setActiveSegment] = useState('all');
  const [openAccordion, setOpenAccordion] = useState(null);

  const [staffList, setStaffList] = useState([]);
  const [servicesList, setServicesList] = useState([]);

  const [audiencePreview, setAudiencePreview] = useState(null); // { count }
  const [previewLoading, setPreviewLoading] = useState(false);

  const [audienceContacts, setAudienceContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [contactSearch, setContactSearch] = useState('');

  const [campaignName, setCampaignName] = useState(`${template.name} — ${new Date().toLocaleDateString('es-CO')}`);
  const [submitting, setSubmitting] = useState(false);

  const dailyLimit = waStatus?.daily_limit || 20;
  const sentToday = waStatus?.sent_today || 0;
  const remainingToday = Math.max(0, dailyLimit - sentToday);
  const connected = waStatus?.db_status === 'connected';

  // ---- Load reference lists once ----
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

  // ---- Build segment_filters from current state ----
  const buildPayload = () => {
    const p = { ...filters };
    if (!p.staff_ids?.length) delete p.staff_ids;
    if (!p.service_names?.length) delete p.service_names;
    if (!p.min_spent) delete p.min_spent; else p.min_spent = parseInt(p.min_spent, 10);
    if (!p.max_spent) delete p.max_spent; else p.max_spent = parseInt(p.max_spent, 10);
    if (!p.date_from) delete p.date_from;
    if (!p.date_to) delete p.date_to;
    if (!p.days_inactive) delete p.days_inactive;
    if (!p.status) delete p.status;
    if (!p.min_visits) delete p.min_visits; else p.min_visits = parseInt(p.min_visits, 10);
    if (!p.max_visits) delete p.max_visits; else p.max_visits = parseInt(p.max_visits, 10);
    if (!p.birthday_month) delete p.birthday_month;
    if (!p.top_spenders_pct) delete p.top_spenders_pct;
    return p;
  };

  // ---- Audience preview (count) on filter changes (debounced) ----
  // Backend endpoint is /campaigns/audience-search — returns { count, contacts }.
  // We only read the count here to keep the sidebar reactive without loading
  // the full contact list (that happens in step 2 -> 3 transition).
  useEffect(() => {
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch(`${API_URL}/campaigns/audience-search`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        if (res.ok) {
          const data = await res.json();
          setAudiencePreview({ count: data.count || 0 });
        }
      } finally {
        setPreviewLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [filters]);

  // ---- Apply quick segment ----
  const applySegment = (seg) => {
    setActiveSegment(seg.id);
    setFilters({ ...empty(), ...seg.filters });
  };

  // ---- Toggle multi-checks ----
  const toggleStaff = (id) => {
    setActiveSegment(null);
    setFilters(f => ({
      ...f,
      staff_ids: f.staff_ids.includes(id) ? f.staff_ids.filter(x => x !== id) : [...f.staff_ids, id],
    }));
  };
  const toggleService = (name) => {
    setActiveSegment(null);
    setFilters(f => ({
      ...f,
      service_names: f.service_names.includes(name) ? f.service_names.filter(x => x !== name) : [...f.service_names, name],
    }));
  };
  const setF = (patch) => {
    setActiveSegment(null);
    setFilters(f => ({ ...f, ...patch }));
  };

  // ---- Step 2 -> 3: load full contact list ----
  const goToContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await fetch(`${API_URL}/campaigns/audience-search`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo cargar la audiencia');
      }
      const data = await res.json();
      const contacts = data.contacts || [];
      setAudienceContacts(contacts);
      setSelectedIds(new Set(contacts.map(c => c.id)));
      setStep(3);
    } catch (e) {
      notify({ type: 'error', message: e.message });
    } finally {
      setContactsLoading(false);
    }
  };

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return audienceContacts;
    return audienceContacts.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q),
    );
  }, [audienceContacts, contactSearch]);

  const allSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedIds.has(c.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const n = new Set(prev);
        filteredContacts.forEach(c => n.delete(c.id));
        return n;
      });
    } else {
      setSelectedIds(prev => {
        const n = new Set(prev);
        filteredContacts.forEach(c => n.add(c.id));
        return n;
      });
    }
  };
  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // ---- Step 4: launch ----
  const launch = async () => {
    if (!connected) {
      notify({ type: 'error', message: 'WhatsApp Web no conectado' });
      return;
    }
    if (selectedIds.size === 0) {
      notify({ type: 'error', message: 'Selecciona al menos un contacto' });
      return;
    }
    setSubmitting(true);
    try {
      // Build a filter that limits to the selected client IDs by their phones
      // (the backend campaign worker iterates by audience already, so we pass a
      // narrow filter that resolves to exactly these contacts).
      const phoneList = audienceContacts
        .filter(c => selectedIds.has(c.id))
        .map(c => c.phone)
        .filter(Boolean);

      const camp = await campaignService.create({
        name: campaignName.trim() || template.name,
        campaign_type: 'web_free_text',
        message_body: template.body,
        meta_template_name: template.slug,
        // Backend builds audience by client IDs when phone_list is provided
        segment_filters: { phone_list: phoneList },
      });
      const res = await fetch(`${API_URL}/campaigns/${camp.id}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo iniciar la campaña');
      }
      const overflow = selectedIds.size - remainingToday;
      notify({
        type: 'success',
        message: overflow > 0
          ? `Iniciada: ${remainingToday} hoy + ${overflow} pausada hasta mañana`
          : `Iniciada a ${selectedIds.size} contactos`,
      });
      onSent?.();
    } catch (e) {
      notify({ type: 'error', message: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render ----
  const stepperItems = [
    { n: 1, label: 'Plantilla',  done: true },
    { n: 2, label: 'Audiencia',  done: step > 2, active: step === 2 },
    { n: 3, label: 'Contactos',  done: step > 3, active: step === 3 },
    { n: 4, label: 'Envio',      done: false,    active: step === 4 },
  ];

  return (
    <div className={`${b}__wizard`}>
      {/* Top stepper */}
      <div className={`${b}__wizard-stepper`}>
        {stepperItems.map((it, i) => (
          <div key={it.n} className={`${b}__wizard-step-wrap`}>
            <div className={`${b}__wizard-step ${it.done ? `${b}__wizard-step--done` : ''} ${it.active ? `${b}__wizard-step--active` : ''}`}>
              <span className={`${b}__wizard-step-num`}>
                {it.done ? SVG.check : it.n}
              </span>
              <span className={`${b}__wizard-step-label`}>{it.label}</span>
            </div>
            {i < stepperItems.length - 1 && <div className={`${b}__wizard-step-line ${it.done ? `${b}__wizard-step-line--done` : ''}`} />}
          </div>
        ))}
      </div>

      {/* ============== STEP 2: Audiencia ============== */}
      {step === 2 && (
        <div className={`${b}__wizard-step2`}>
          <div className={`${b}__wizard-step2-main`}>
            <h2 className={`${b}__wizard-title`}>Define tu audiencia</h2>
            <p className={`${b}__wizard-sub`}>Usa filtros avanzados para seleccionar exactamente a quien quieres enviar</p>

            {/* Quick segments */}
            <div className={`${b}__wizard-block`}>
              <span className={`${b}__wizard-block-label`}>Segmentos rapidos</span>
              <div className={`${b}__wizard-pills`}>
                {QUICK_SEGMENTS.map(seg => (
                  <button
                    key={seg.id}
                    type="button"
                    className={`${b}__wizard-pill ${activeSegment === seg.id ? `${b}__wizard-pill--active` : ''}`}
                    onClick={() => applySegment(seg)}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced accordions */}
            <span className={`${b}__wizard-block-label`}>Filtros avanzados</span>

            <Accordion
              b={b}
              icon={SVG.users}
              title="Profesional"
              count={filters.staff_ids.length}
              open={openAccordion === 'staff'}
              onToggle={() => setOpenAccordion(openAccordion === 'staff' ? null : 'staff')}
            >
              <div className={`${b}__wizard-pills`}>
                {staffList.length === 0 ? (
                  <span className={`${b}__wizard-empty`}>Sin profesionales</span>
                ) : staffList.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`${b}__wizard-pill ${filters.staff_ids.includes(s.id) ? `${b}__wizard-pill--active` : ''}`}
                    onClick={() => toggleStaff(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </Accordion>

            <Accordion
              b={b}
              icon={SVG.service}
              title="Servicio"
              count={filters.service_names.length}
              open={openAccordion === 'service'}
              onToggle={() => setOpenAccordion(openAccordion === 'service' ? null : 'service')}
            >
              <div className={`${b}__wizard-pills`}>
                {servicesList.length === 0 ? (
                  <span className={`${b}__wizard-empty`}>Sin servicios</span>
                ) : servicesList.map(sv => (
                  <button
                    key={sv.id}
                    type="button"
                    className={`${b}__wizard-pill ${filters.service_names.includes(sv.name) ? `${b}__wizard-pill--active` : ''}`}
                    onClick={() => toggleService(sv.name)}
                  >
                    {sv.name}
                  </button>
                ))}
              </div>
            </Accordion>

            <Accordion
              b={b}
              icon={SVG.money}
              title="Gasto"
              count={(filters.min_spent || filters.max_spent) ? 1 : 0}
              open={openAccordion === 'money'}
              onToggle={() => setOpenAccordion(openAccordion === 'money' ? null : 'money')}
            >
              <div className={`${b}__wizard-row`}>
                <input type="number" placeholder="Minimo COP" value={filters.min_spent} onChange={e => setF({ min_spent: e.target.value })} />
                <input type="number" placeholder="Maximo COP" value={filters.max_spent} onChange={e => setF({ max_spent: e.target.value })} />
              </div>
            </Accordion>

            <Accordion
              b={b}
              icon={SVG.cal}
              title="Periodo"
              count={(filters.date_from || filters.date_to) ? 1 : 0}
              open={openAccordion === 'date'}
              onToggle={() => setOpenAccordion(openAccordion === 'date' ? null : 'date')}
            >
              <div className={`${b}__wizard-row`}>
                <input type="date" value={filters.date_from} onChange={e => setF({ date_from: e.target.value })} />
                <input type="date" value={filters.date_to} onChange={e => setF({ date_to: e.target.value })} />
              </div>
            </Accordion>
          </div>

          {/* Sidebar preview */}
          <div className={`${b}__wizard-sidebar`}>
            <div className={`${b}__wizard-sidebar-card`}>
              <h4>Vista previa</h4>
              <div className={`${b}__wizard-sidebar-tpl`}>
                <span>Plantilla:</span>
                <strong>{template.name}</strong>
              </div>
              <p className={`${b}__wizard-sidebar-hint`}>Aplica filtros para ver cuantos clientes coinciden</p>
              <div className={`${b}__wizard-sidebar-count`}>
                {previewLoading ? (
                  <span>Calculando...</span>
                ) : audiencePreview ? (
                  <>
                    <span className={`${b}__wizard-sidebar-num`}>{audiencePreview.count || 0}</span>
                    <span className={`${b}__wizard-sidebar-label`}>contactos coinciden</span>
                  </>
                ) : <span>—</span>}
              </div>
              {(audiencePreview?.count || 0) > remainingToday && (
                <div className={`${b}__wizard-sidebar-warn`}>
                  ⚠ Hoy solo {remainingToday} disponibles. El resto pausa hasta mañana.
                </div>
              )}
              <button
                className={`${b}__wizard-btn ${b}__wizard-btn--primary ${b}__wizard-btn--block`}
                onClick={goToContacts}
                disabled={contactsLoading || (audiencePreview?.count || 0) === 0}
              >
                {contactsLoading ? 'Cargando...' : `Siguiente: Revisar contactos (${audiencePreview?.count || 0})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== STEP 3: Contactos ============== */}
      {step === 3 && (
        <div className={`${b}__wizard-step3`}>
          <div className={`${b}__wizard-toolbar`}>
            <button className={`${b}__wizard-btn ${b}__wizard-btn--ghost`} onClick={() => setStep(2)}>
              {SVG.arrow} Atras
            </button>
            <span className={`${b}__wizard-counter`}>
              {SVG.users} {selectedIds.size} de {audienceContacts.length} seleccionados
            </span>
            <button className={`${b}__wizard-link`} onClick={() => setSelectedIds(new Set(audienceContacts.map(c => c.id)))}>
              Todos
            </button>
            <button className={`${b}__wizard-link`} onClick={() => setSelectedIds(new Set())}>
              Ninguno
            </button>
            <div className={`${b}__wizard-spacer`} />
            <button
              className={`${b}__wizard-btn ${b}__wizard-btn--send`}
              onClick={() => setStep(4)}
              disabled={selectedIds.size === 0}
            >
              {SVG.send} Enviar a {selectedIds.size} contactos
            </button>
          </div>

          <div className={`${b}__wizard-search`}>
            {SVG.search}
            <input type="text" placeholder="Buscar por nombre o telefono..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
          </div>

          <div className={`${b}__wizard-table-wrap`}>
            <table className={`${b}__wizard-table`}>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  <th>Cliente</th>
                  <th>Telefono</th>
                  <th>Estado</th>
                  <th>Visitas</th>
                  <th>Gasto total</th>
                  <th>Dias sin venir</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map(c => (
                  <tr key={c.id} className={selectedIds.has(c.id) ? `${b}__wizard-row--selected` : ''}>
                    <td><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)} /></td>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>
                      <span className={`${b}__wizard-status ${b}__wizard-status--${c.status || 'nuevo'}`}>{c.status || 'nuevo'}</span>
                    </td>
                    <td className={`${b}__wizard-num`}>{c.total_visits}</td>
                    <td className={`${b}__wizard-num`}>${(c.total_spent || 0).toLocaleString('es-CO')}</td>
                    <td className={`${b}__wizard-num`}>{c.days_since != null ? `${c.days_since}d` : '—'}</td>
                  </tr>
                ))}
                {filteredContacts.length === 0 && (
                  <tr><td colSpan={7} className={`${b}__wizard-table-empty`}>Sin contactos para los filtros actuales.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============== STEP 4: Envio ============== */}
      {step === 4 && (
        <div className={`${b}__wizard-step4`}>
          <h2 className={`${b}__wizard-title`}>Confirmar envio</h2>
          <p className={`${b}__wizard-sub`}>Revisa el detalle antes de lanzar la campaña.</p>

          <div className={`${b}__wizard-confirm`}>
            <div className={`${b}__wizard-confirm-row`}>
              <span>Plantilla</span>
              <strong>{template.name}</strong>
            </div>
            <div className={`${b}__wizard-confirm-row`}>
              <span>Contactos seleccionados</span>
              <strong>{selectedIds.size}</strong>
            </div>
            <div className={`${b}__wizard-confirm-row`}>
              <span>Disponibles hoy</span>
              <strong>{remainingToday} de {dailyLimit}</strong>
            </div>
            <div className={`${b}__wizard-confirm-row`}>
              <span>Pacing</span>
              <strong>{(waStatus?.pacing_seconds || [30,90])[0]}–{(waStatus?.pacing_seconds || [30,90])[1]}s entre msgs</strong>
            </div>
            {selectedIds.size > remainingToday && (
              <div className={`${b}__wizard-confirm-warn`}>
                ⚠ {selectedIds.size - remainingToday} contactos quedaran pausados hasta mañana cuando se renueve la cuota diaria. Esto protege el numero.
              </div>
            )}
          </div>

          <label className={`${b}__wizard-field`}>
            <span>Nombre interno de la campaña</span>
            <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
          </label>

          <div className={`${b}__wizard-toolbar ${b}__wizard-toolbar--end`}>
            <button className={`${b}__wizard-btn ${b}__wizard-btn--ghost`} onClick={() => setStep(3)} disabled={submitting}>
              {SVG.arrow} Atras
            </button>
            <button className={`${b}__wizard-btn ${b}__wizard-btn--ghost`} onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
            <button className={`${b}__wizard-btn ${b}__wizard-btn--send`} onClick={launch} disabled={submitting || !connected || selectedIds.size === 0}>
              {SVG.send} {submitting ? 'Iniciando...' : `Enviar a ${selectedIds.size}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// Inline accordion helper
function Accordion({ b, icon, title, count, open, onToggle, children }) {
  return (
    <div className={`${b}__wizard-acc ${open ? `${b}__wizard-acc--open` : ''}`}>
      <button className={`${b}__wizard-acc-head`} onClick={onToggle}>
        <span className={`${b}__wizard-acc-icon`}>{icon}</span>
        <span className={`${b}__wizard-acc-title`}>{title}</span>
        {count > 0 && <span className={`${b}__wizard-acc-count`}>{count}</span>}
        <span className={`${b}__wizard-acc-chevron`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </button>
      {open && <div className={`${b}__wizard-acc-body`}>{children}</div>}
    </div>
  );
}
