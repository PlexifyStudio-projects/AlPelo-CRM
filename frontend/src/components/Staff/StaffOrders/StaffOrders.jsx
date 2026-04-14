import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useNotification } from '../../../context/NotificationContext';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'staff-orders';
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
const fmtTime = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`; };

const STATUS = {
  confirmed: { label: 'Pendiente', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: '⏳' },
  completed: { label: 'Completada', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: '✓' },
  paid: { label: 'Pagada', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', icon: '✓' },
};

const StaffOrders = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [tab, setTab] = useState('complete');
  const [ticketSearch, setTicketSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [assigning, setAssigning] = useState(null); // appointment id being assigned

  const staffId = user?.id;
  const staffName = user?.name || '';

  const handleSearch = useCallback(async () => {
    if (!ticketSearch.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await fetch(`${API}/appointments/?search=${encodeURIComponent(ticketSearch.trim())}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      // Show all matches, sorted: pending first, then by date desc
      const sorted = data
        .filter(a => ['confirmed', 'completed', 'paid'].includes(a.status))
        .sort((a, b) => {
          if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
          if (b.status === 'confirmed' && a.status !== 'confirmed') return 1;
          return (b.date + b.time).localeCompare(a.date + a.time);
        })
        .slice(0, 10);
      setSearchResults(sorted);
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
      const res = await fetch(`${API}/appointments/${apt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ staff_id: staffId, status: 'completed' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error');
      }
      addNotification(`Orden #${apt.visit_code || apt.id} completada`, 'success');
      // Update in list
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
        <button className={`${b}__tab ${tab === 'complete' ? `${b}__tab--active` : ''}`} onClick={() => setTab('complete')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          Completar orden
        </button>
        <button className={`${b}__tab ${tab === 'mine' ? `${b}__tab--active` : ''}`} onClick={() => setTab('mine')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          Mis ordenes
        </button>
      </div>

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
