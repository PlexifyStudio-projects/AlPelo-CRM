import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useNotification } from '../../../context/NotificationContext';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'staff-orders';
const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '';
const fmtTime = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`; };

const StaffOrders = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [tab, setTab] = useState('complete'); // 'complete' | 'mine'
  const [ticketSearch, setTicketSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const inputRef = useRef(null);

  const staffName = user?.name || '';
  const staffId = user?.id;

  // Search by ticket
  const handleSearch = useCallback(async () => {
    if (!ticketSearch.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch(`${API}/appointments/?search=${encodeURIComponent(ticketSearch.trim())}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      // Find exact ticket match
      const match = data.find(a =>
        a.visit_code === ticketSearch.trim() ||
        String(a.id) === ticketSearch.trim() ||
        a.visit_code?.includes(ticketSearch.trim())
      );
      if (match && (match.status === 'confirmed' || match.status === 'completed')) {
        setSearchResult(match);
      } else if (data.length === 1) {
        setSearchResult(data[0]);
      } else {
        addNotification(`No se encontró orden con ticket "${ticketSearch}"`, 'warning');
      }
    } catch {
      addNotification('Error buscando orden', 'error');
    } finally {
      setSearching(false);
    }
  }, [ticketSearch, addNotification]);

  // Auto-assign + complete
  const handleAssignAndComplete = useCallback(async () => {
    if (!searchResult || !staffId) return;
    setAssigning(true);
    try {
      // Assign staff to appointment
      const updateRes = await fetch(`${API}/appointments/${searchResult.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ staff_id: staffId, status: 'completed' }),
      });
      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al asignar');
      }
      addNotification(`Orden ${searchResult.visit_code || searchResult.id} completada y asignada a ti`, 'success');
      setSearchResult(null);
      setTicketSearch('');
      loadMyOrders();
    } catch (err) {
      addNotification(err.message || 'Error al completar', 'error');
    } finally {
      setAssigning(false);
    }
  }, [searchResult, staffId, addNotification]);

  // Load my orders
  const loadMyOrders = useCallback(async () => {
    if (!staffId) return;
    setLoadingMine(true);
    try {
      const res = await fetch(`${API}/appointments/?staff_id=${staffId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      // Only show confirmed + completed + paid, sorted by date desc
      const filtered = data
        .filter(a => ['confirmed', 'completed', 'paid'].includes(a.status))
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
        .slice(0, 50);
      setMyOrders(filtered);
    } catch {
      setMyOrders([]);
    } finally {
      setLoadingMine(false);
    }
  }, [staffId]);

  useEffect(() => { if (tab === 'mine') loadMyOrders(); }, [tab, loadMyOrders]);

  const STATUS = {
    confirmed: { label: 'Pendiente', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    completed: { label: 'Completada', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
    paid: { label: 'Pagada', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  };

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h1>Ordenes</h1>
        <p>Busca por ticket, asignate y completa</p>
      </div>

      {/* Tabs */}
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

      {/* COMPLETE TAB */}
      {tab === 'complete' && (
        <div className={`${b}__search-section`}>
          <div className={`${b}__search-box`}>
            <div className={`${b}__search-input-wrap`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Numero de ticket..."
                value={ticketSearch}
                onChange={e => setTicketSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                autoFocus
              />
              {ticketSearch && (
                <button className={`${b}__search-clear`} onClick={() => { setTicketSearch(''); setSearchResult(null); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
            <button className={`${b}__search-btn`} onClick={handleSearch} disabled={searching || !ticketSearch.trim()}>
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {/* Result */}
          {searchResult && (
            <div className={`${b}__result`}>
              <div className={`${b}__result-header`}>
                <span className={`${b}__result-ticket`}>#{searchResult.visit_code || searchResult.id}</span>
                <span className={`${b}__result-status`} style={{ color: STATUS[searchResult.status]?.color, background: STATUS[searchResult.status]?.bg }}>
                  {STATUS[searchResult.status]?.label || searchResult.status}
                </span>
              </div>
              <div className={`${b}__result-body`}>
                <div className={`${b}__result-row`}>
                  <span className={`${b}__result-label`}>Cliente</span>
                  <span className={`${b}__result-value`}>{searchResult.client_name}</span>
                </div>
                <div className={`${b}__result-row`}>
                  <span className={`${b}__result-label`}>Servicio</span>
                  <span className={`${b}__result-value`}>{searchResult.service_name}</span>
                </div>
                <div className={`${b}__result-row`}>
                  <span className={`${b}__result-label`}>Fecha</span>
                  <span className={`${b}__result-value`}>{fmtDate(searchResult.date)} {fmtTime(searchResult.time)}</span>
                </div>
                {searchResult.staff_name && (
                  <div className={`${b}__result-row`}>
                    <span className={`${b}__result-label`}>Asignado a</span>
                    <span className={`${b}__result-value`}>{searchResult.staff_name}</span>
                  </div>
                )}
              </div>
              {searchResult.status === 'confirmed' ? (
                <button className={`${b}__assign-btn`} onClick={handleAssignAndComplete} disabled={assigning}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  {assigning ? 'Procesando...' : 'Asignarme y completar'}
                </button>
              ) : (
                <div className={`${b}__result-done`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Esta orden ya esta {searchResult.status === 'paid' ? 'pagada' : 'completada'}
                </div>
              )}
            </div>
          )}

          {!searchResult && !searching && (
            <div className={`${b}__empty-search`}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <p>Ingresa el numero de ticket para buscar la orden</p>
            </div>
          )}
        </div>
      )}

      {/* MY ORDERS TAB */}
      {tab === 'mine' && (
        <div className={`${b}__mine`}>
          {loadingMine ? (
            <div className={`${b}__loading`}><div className={`${b}__spinner`} /></div>
          ) : myOrders.length > 0 ? (
            <div className={`${b}__list`}>
              {myOrders.map(o => {
                const st = STATUS[o.status] || { label: o.status, color: '#94A3B8', bg: '#F1F5F9' };
                return (
                  <div key={o.id} className={`${b}__card`}>
                    <div className={`${b}__card-top`}>
                      <span className={`${b}__card-ticket`}>#{o.visit_code || o.id}</span>
                      <span className={`${b}__card-status`} style={{ color: st.color, background: st.bg }}>{st.label}</span>
                    </div>
                    <div className={`${b}__card-client`}>{o.client_name}</div>
                    <div className={`${b}__card-service`}>{o.service_name}</div>
                    <div className={`${b}__card-meta`}>
                      <span>{fmtDate(o.date)} {fmtTime(o.time)}</span>
                    </div>
                  </div>
                );
              })}
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
