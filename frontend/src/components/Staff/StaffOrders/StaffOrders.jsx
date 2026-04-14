import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useNotification } from '../../../context/NotificationContext';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'staff-orders';
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
const fmtTime = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`; };
const fmtCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

const STATUS = {
  confirmed: { label: 'Pendiente', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: '⏳' },
  completed: { label: 'Completada', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: '✓' },
  paid: { label: 'Pagada', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', icon: '✓' },
};

const StaffOrders = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [tab, setTab] = useState('create');
  const [ticketSearch, setTicketSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [assigning, setAssigning] = useState(null);

  // Create order state
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [cTicket, setCTicket] = useState('');
  const [cClientName, setCClientName] = useState('');
  const [cServiceId, setCServiceId] = useState(null);
  const [cTime, setCTime] = useState(nowTime());
  const [cPrice, setCPrice] = useState(0);
  const [cSubmitting, setCSubmitting] = useState(false);
  const [cSvcSearch, setCSvcSearch] = useState('');

  const staffId = user?.id;
  const staffName = user?.name || '';

  const selectedService = useMemo(() => services.find(s => s.id === cServiceId), [services, cServiceId]);

  const handleSearch = useCallback(async () => {
    if (!ticketSearch.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const q = ticketSearch.trim();
      // Search both appointments AND orders
      const [aptRes, ordRes] = await Promise.all([
        fetch(`${API}/appointments/?search=${encodeURIComponent(q)}`, { credentials: 'include' }),
        fetch(`${API}/orders/?search=${encodeURIComponent(q)}`, { credentials: 'include' }),
      ]);

      const aptData = aptRes.ok ? await aptRes.json() : [];
      const ordRaw = ordRes.ok ? await ordRes.json() : [];
      const ordData = Array.isArray(ordRaw) ? ordRaw : (ordRaw.orders || []);

      // Filter appointments by ticket match — exclude those assigned to OTHER staff
      const matchApt = (Array.isArray(aptData) ? aptData : []).filter(a => {
        if (!['confirmed', 'completed', 'paid'].includes(a.status)) return false;
        // Don't show if assigned to someone else
        if (a.staff_id && a.staff_id !== staffId && String(a.staff_id) !== String(staffId)) return false;
        const vc = String(a.visit_code || '');
        const aid = String(a.id);
        if (vc === q || aid === q) return true;
        if (vc && vc.includes(q)) return true;
        const vcDigits = vc.replace(/\D/g, '');
        if (vcDigits && vcDigits === q) return true;
        return false;
      });

      // Convert orders to appointment-like objects — exclude assigned to other staff
      const matchOrd = ordData.filter(o => {
        if (o.status === 'cancelled' || o.status === 'no_show') return false;
        if (o.staff_id && o.staff_id !== staffId && String(o.staff_id) !== String(staffId)) return false;
        const tk = String(o.ticket_number || '');
        if (tk === q || tk.includes(q)) return true;
        return false;
      }).map(o => ({
        id: o.id,
        _is_order: true,
        visit_code: o.ticket_number,
        client_name: o.client_name,
        client_phone: o.client_phone,
        service_name: o.items?.map(i => i.service_name).join(', ') || 'Servicio',
        staff_id: o.staff_id,
        staff_name: o.staff_name,
        date: o.service_date,
        time: o.service_time,
        status: o.status === 'completed' ? 'completed' : 'confirmed',
        price: o.total || o.subtotal,
      }));

      // Merge, dedup by visit_code, sort
      const seen = new Set();
      const merged = [];
      for (const item of [...matchApt, ...matchOrd]) {
        const key = `${item.visit_code || ''}_${item.id}_${item._is_order ? 'o' : 'a'}`;
        if (!seen.has(key)) { seen.add(key); merged.push(item); }
      }
      merged.sort((a, b) => {
        if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
        if (b.status === 'confirmed' && a.status !== 'confirmed') return 1;
        return ((b.date || '') + (b.time || '')).localeCompare((a.date || '') + (a.time || ''));
      });
      setSearchResults(merged);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [ticketSearch]);

  const handleAssign = useCallback(async (apt) => {
    if (!staffId) return;
    setAssigning(apt.id);
    try {
      if (apt._is_order) {
        // Update order
        const res = await fetch(`${API}/orders/${apt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ staff_id: staffId, status: 'completed' }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Error'); }
      } else {
        // Update appointment
        const res = await fetch(`${API}/appointments/${apt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ staff_id: staffId, status: 'completed' }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Error'); }
      }
      addNotification(`Orden #${apt.visit_code || apt.id} completada`, 'success');
      setSearchResults(prev => prev.map(a => a.id === apt.id ? { ...a, status: 'completed', staff_name: staffName, staff_id: staffId } : a));
      loadMyOrders();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setAssigning(null);
    }
  }, [staffId, staffName, addNotification]);

  const loadMyOrders = useCallback(async () => {
    if (!staffId) return;
    setLoadingMine(true);
    try {
      const res = await fetch(`${API}/appointments/?staff_id=${staffId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setMyOrders(
        data.filter(a => ['confirmed', 'completed', 'paid'].includes(a.status))
          .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
          .slice(0, 50)
      );
    } catch { setMyOrders([]); }
    finally { setLoadingMine(false); }
  }, [staffId]);

  useEffect(() => { if (tab === 'mine') loadMyOrders(); }, [tab, loadMyOrders]);

  // Load services for create tab
  useEffect(() => {
    if (tab === 'create' && services.length === 0) {
      setLoadingServices(true);
      fetch(`${API}/services/`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          const mine = data.filter(s => !s.staff_ids?.length || s.staff_ids.includes(staffId));
          setServices(mine);
        })
        .catch(() => setServices([]))
        .finally(() => setLoadingServices(false));
    }
  }, [tab, staffId, services.length]);

  // Auto-lookup client info when ticket changes
  const lookupClient = useCallback(async (ticket) => {
    if (!ticket.trim()) { setCClientName(''); return; }
    try {
      const res = await fetch(`${API}/orders/?search=${encodeURIComponent(ticket.trim())}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const orders = data.orders || data || [];
        const match = orders.find(o => o.ticket_number === ticket.trim() || o.ticket_number?.includes(ticket.trim()));
        if (match) setCClientName(match.client_name || '');
      }
    } catch {}
  }, []);

  const handleCreateOrder = useCallback(async () => {
    if (!cTicket.trim()) { addNotification('El ticket es obligatorio', 'error'); return; }
    if (!cServiceId) { addNotification('Selecciona un servicio', 'error'); return; }
    setCSubmitting(true);
    try {
      const svc = services.find(s => s.id === cServiceId);
      const clientName = cClientName.trim() || 'Cliente';
      const payload = {
        ticket_number: cTicket.trim(),
        client_name: clientName,
        client_phone: '',
        staff_id: staffId,
        service_date: toISO(new Date()),
        service_time: cTime || nowTime(),
        notes: '',
        items: [{
          service_id: cServiceId,
          service_name: svc?.name || 'Servicio',
          price: cPrice,
          duration_minutes: svc?.duration_minutes || 30,
          staff_id: staffId,
        }],
        products: [],
      };
      await fetch(`${API}/orders/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(payload),
      }).then(r => { if (!r.ok) throw new Error('Error al crear orden'); return r.json(); });

      // Also create appointment
      await fetch(`${API}/appointments/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({
          client_name: clientName,
          client_phone: '',
          staff_id: staffId,
          service_id: cServiceId,
          date: toISO(new Date()),
          time: cTime || nowTime(),
          duration_minutes: svc?.duration_minutes || 30,
          price: cPrice,
          status: 'confirmed',
          visit_code: cTicket.trim(),
        }),
      }).catch(() => {});

      addNotification(`Orden #${cTicket.trim()} creada`, 'success');
      setCTicket(''); setCServiceId(null); setCPrice(0); setCClientName(''); setCTime(nowTime()); setCSvcSearch('');
      setTab('mine');
      loadMyOrders();
    } catch (err) {
      addNotification(err.message || 'Error al crear', 'error');
    } finally {
      setCSubmitting(false);
    }
  }, [cTicket, cServiceId, cPrice, cTime, cClientName, staffId, services, addNotification, loadMyOrders]);

  const filteredServices = useMemo(() => {
    if (!cSvcSearch.trim()) return services;
    return services.filter(s => s.name.toLowerCase().includes(cSvcSearch.toLowerCase()));
  }, [services, cSvcSearch]);

  const renderCard = (o, showAssign = false) => {
    const st = STATUS[o.status] || STATUS.confirmed;
    const isMine = o.staff_id === staffId || String(o.staff_id) === String(staffId);
    const isAssigned = !!o.staff_name;
    const canAssign = o.status === 'confirmed' && showAssign;

    return (
      <div key={o.id} className={`${b}__card ${canAssign ? `${b}__card--actionable` : ''}`}>
        <div className={`${b}__card-header`}>
          <span className={`${b}__card-ticket`}>#{o.visit_code || o.id}</span>
          <span className={`${b}__card-badge`} style={{ color: st.color, background: st.bg }}>{st.label}</span>
        </div>
        <div className={`${b}__card-body`}>
          <div className={`${b}__card-row`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <span className={`${b}__card-client`}>{o.client_name}</span>
          </div>
          <div className={`${b}__card-row`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
            <span>{o.service_name}</span>
          </div>
          <div className={`${b}__card-row`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <span>{fmtDate(o.date)} {fmtTime(o.time)}</span>
          </div>
          {isAssigned && (
            <div className={`${b}__card-row`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isMine ? '#10B981' : '#94A3B8'} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>
              <span style={isMine ? { color: '#10B981', fontWeight: 600 } : {}}>{isMine ? 'Tu (asignado)' : o.staff_name}</span>
            </div>
          )}
        </div>
        {canAssign && (
          <button className={`${b}__assign-btn`} onClick={() => handleAssign(o)} disabled={assigning === o.id}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            {assigning === o.id ? 'Procesando...' : 'Asignarme y completar'}
          </button>
        )}
        {o.status !== 'confirmed' && !canAssign && isMine && (
          <div className={`${b}__card-footer`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            {o.status === 'paid' ? 'Pagada' : 'Completada por ti'}
          </div>
        )}
        {o.status !== 'confirmed' && !isMine && isAssigned && (
          <div className={`${b}__card-footer ${b}__card-footer--other`}>
            Atendida por {o.staff_name}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h1>Ordenes</h1>
        <p>Busca por ticket, asignate y completa</p>
      </div>

      <div className={`${b}__tabs`}>
        <button className={`${b}__tab ${tab === 'create' ? `${b}__tab--active` : ''}`} onClick={() => setTab('create')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Crear
        </button>
        <button className={`${b}__tab ${tab === 'complete' ? `${b}__tab--active` : ''}`} onClick={() => setTab('complete')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          Buscar
        </button>
        <button className={`${b}__tab ${tab === 'mine' ? `${b}__tab--active` : ''}`} onClick={() => setTab('mine')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          Mis ordenes
        </button>
      </div>

      {tab === 'create' && (
        <div className={`${b}__create`}>
          {/* Ticket */}
          <div className={`${b}__field`}>
            <label className={`${b}__field-label`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /></svg>
              Ticket del cliente *
            </label>
            <input
              type="text"
              value={cTicket}
              onChange={e => setCTicket(e.target.value)}
              onBlur={() => lookupClient(cTicket)}
              placeholder="Ej: M8824"
              className={`${b}__field-input ${b}__field-input--lg`}
            />
          </div>

          {/* Client name (auto or manual) */}
          {cTicket.trim() && (
            <div className={`${b}__field`}>
              <label className={`${b}__field-label`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                Nombre del cliente
              </label>
              <input
                type="text"
                value={cClientName}
                onChange={e => setCClientName(e.target.value)}
                placeholder="Se busca automaticamente por ticket"
                className={`${b}__field-input`}
              />
            </div>
          )}

          {/* Service selection */}
          <div className={`${b}__field`}>
            <label className={`${b}__field-label`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
              Servicio *
            </label>
            {loadingServices ? (
              <div className={`${b}__loading`} style={{ minHeight: 60 }}><div className={`${b}__spinner`} /></div>
            ) : (
              <>
                {services.length > 6 && (
                  <input
                    type="text"
                    value={cSvcSearch}
                    onChange={e => setCSvcSearch(e.target.value)}
                    placeholder="Buscar servicio..."
                    className={`${b}__field-input`}
                    style={{ marginBottom: 8 }}
                  />
                )}
                <div className={`${b}__svc-grid`}>
                  {filteredServices.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className={`${b}__svc-option ${cServiceId === s.id ? `${b}__svc-option--selected` : ''}`}
                      onClick={() => { setCServiceId(s.id); setCPrice(s.price); }}
                    >
                      <span className={`${b}__svc-option-name`}>{s.name}</span>
                      <span className={`${b}__svc-option-price`}>{fmtCOP(s.price)}</span>
                      {s.duration_minutes && <span className={`${b}__svc-option-dur`}>{s.duration_minutes} min</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Time + Price row */}
          {cServiceId && (
            <div className={`${b}__field-row`}>
              <div className={`${b}__field`}>
                <label className={`${b}__field-label`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  Hora
                </label>
                <input type="time" value={cTime} onChange={e => setCTime(e.target.value)} className={`${b}__field-input`} />
              </div>
              <div className={`${b}__field`}>
                <label className={`${b}__field-label`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  Precio cobrado
                </label>
                <input type="number" value={cPrice} onChange={e => setCPrice(parseInt(e.target.value) || 0)} className={`${b}__field-input`} min="0" step="1000" />
              </div>
            </div>
          )}

          {/* Summary + Submit */}
          {cServiceId && (
            <div className={`${b}__create-summary`}>
              <div className={`${b}__create-summary-row`}>
                <span>{selectedService?.name}</span>
                <span className={`${b}__create-summary-price`}>{fmtCOP(cPrice)}</span>
              </div>
              <button
                className={`${b}__create-btn`}
                onClick={handleCreateOrder}
                disabled={cSubmitting || !cTicket.trim()}
              >
                {cSubmitting ? (
                  <><div className={`${b}__spinner`} style={{ width: 16, height: 16, borderWidth: 2 }} /> Creando...</>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Crear orden
                  </>
                )}
              </button>
            </div>
          )}

          {!cServiceId && services.length > 0 && !loadingServices && (
            <div className={`${b}__create-hint`}>
              <p>Selecciona un servicio para continuar</p>
            </div>
          )}
        </div>
      )}

      {tab === 'complete' && (
        <div className={`${b}__search-section`}>
          <div className={`${b}__search-box`}>
            <div className={`${b}__search-input-wrap`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                type="text"
                placeholder="Numero de ticket..."
                value={ticketSearch}
                onChange={e => setTicketSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                autoFocus
              />
              {ticketSearch && (
                <button className={`${b}__search-clear`} onClick={() => { setTicketSearch(''); setSearchResults([]); setSearched(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
            <button className={`${b}__search-btn`} onClick={handleSearch} disabled={searching || !ticketSearch.trim()}>
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {searching && <div className={`${b}__loading`}><div className={`${b}__spinner`} /></div>}

          {!searching && searched && searchResults.length > 0 && (
            <div className={`${b}__results`}>
              <p className={`${b}__results-count`}>{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{ticketSearch}"</p>
              <div className={`${b}__results-grid`}>
                {searchResults.map(o => renderCard(o, true))}
              </div>
            </div>
          )}

          {!searching && searched && searchResults.length === 0 && (
            <div className={`${b}__not-found`}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
              <h3>No se encontro</h3>
              <p>No hay ordenes con el ticket "{ticketSearch}". Verifica el numero e intenta de nuevo.</p>
            </div>
          )}

          {!searching && !searched && (
            <div className={`${b}__empty-search`}>
              <div className={`${b}__empty-icon`}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
              </div>
              <h3>Buscar orden por ticket</h3>
              <p>Ingresa el numero de ticket del cliente para buscar su orden, asignarte y completarla.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className={`${b}__mine`}>
          {loadingMine ? (
            <div className={`${b}__loading`}><div className={`${b}__spinner`} /></div>
          ) : myOrders.length > 0 ? (
            <div className={`${b}__results-grid`}>
              {myOrders.map(o => renderCard(o, false))}
            </div>
          ) : (
            <div className={`${b}__empty`}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
              <p>No tienes ordenes asignadas</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StaffOrders;
