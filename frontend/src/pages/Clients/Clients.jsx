import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ClientTable from '../../components/Admin/ClientTable/ClientTable';
import ClientDetail from '../../components/Admin/ClientDetail/ClientDetail';
import ClientFilters from '../../components/Admin/ClientFilters/ClientFilters';
import AddClientModal from '../../components/Admin/AddClientModal/AddClientModal';
import ImportClientsModal from '../../components/Admin/ImportClientsModal/ImportClientsModal';
import Button from '../../components/common/Button/Button';
import { useNotification } from '../../context/NotificationContext';
import { formatCurrency, daysSince } from '../../utils/formatters';
import EmptyState from '../../components/common/EmptyState/EmptyState';
import clientService from '../../services/clientService';

const Clients = ({ onNavigate }) => {
  const [clients, setClients] = useState([]);
  const [kpis, setKpis] = useState({ total_clients: 0, active_clients: 0, at_risk_clients: 0, inactive_clients: 0, vip_clients: 0, new_clients: 0, retention_rate: 0, total_revenue: 0, avg_ticket: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('nuevo');
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', direction: 'desc' });
  const [selectedClient, setSelectedClient] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [rfmData, setRfmData] = useState(null);
  const [rfmFilter, setRfmFilter] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const exportMenuRef = useRef(null);
  const { addNotification } = useNotification();
  const b = 'clients';

  const loadClients = useCallback(async () => {
    try {
      const [clientList, kpiData, rfm] = await Promise.all([
        clientService.list(),
        clientService.kpis(),
        clientService.rfm().catch(() => null),
      ]);
      setClients(clientList);
      setKpis(kpiData);
      if (rfm) setRfmData(rfm);
    } catch (err) {
      addNotification('Error al cargar clientes: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const filteredClients = useMemo(() => {
    let result = [...clients];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      result = result.filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        if (c.email && c.email.toLowerCase().includes(q)) return true;
        if (c.client_id.toLowerCase().includes(q)) return true;
        if (c.visit_code && c.visit_code.toLowerCase().includes(q)) return true;
        if (qDigits && c.phone) {
          const phoneDigits = c.phone.replace(/\D/g, '');
          if (phoneDigits.includes(qDigits)) return true;
        }
        return false;
      });
    }

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (rfmFilter && rfmData?.clients) {
      const rfmClientIds = new Set(
        rfmData.clients.filter((r) => r.segment === rfmFilter).map((r) => r.client_id)
      );
      result = result.filter((c) => rfmClientIds.has(c.id));
    }

    result.sort((a, bClient) => {
      let aVal = a[sortConfig.key];
      let bVal = bClient[sortConfig.key];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [clients, searchQuery, statusFilter, sortConfig, rfmFilter, rfmData]);

  const handleSaveClient = async (clientData) => {
    try {
      let savedClientId = editingClient?.id;
      if (editingClient) {
        await clientService.update(editingClient.id, clientData);
        addNotification('Cliente actualizado correctamente', 'success');
      } else {
        await clientService.create(clientData);
        addNotification('Cliente agregado correctamente', 'success');
      }
      setEditingClient(null);
      await loadClients();
      if (savedClientId) {
        try {
          const fresh = await clientService.get(savedClientId);
          setSelectedClient(fresh);
        } catch { /* ignore */ }
      }
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const handleClientClick = async (client) => {
    try {
      const fullClient = await clientService.get(client.id);
      setSelectedClient(fullClient);
    } catch (err) {
      addNotification('Error al cargar cliente: ' + err.message, 'error');
    }
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setIsAddModalOpen(true);
    setSelectedClient(null);
  };

  const handleDeleteRequest = useCallback((client) => {
    setDeleteCandidate(client);
  }, []);

  /* ─────────── Multi-select helpers ─────────── */
  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visibleIds = filteredClients.map((c) => c.id);
      const allSel = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSel) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [filteredClients]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await clientService.bulkDelete(ids, true);
      addNotification(`${res.deleted} clientes borrados`, 'success');
      setSelectedIds(new Set());
      setBulkConfirm(false);
      loadClients();
    } catch (err) {
      addNotification('No se pudo borrar: ' + err.message, 'error');
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedIds, addNotification, loadClients]);

  const handleSendCampaign = useCallback(() => {
    if (selectedIds.size === 0) return;
    // Snapshot of selected clients (full data) — Campaigns reads this on mount
    const ids = Array.from(selectedIds);
    const contacts = clients
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || null,
        client_id: c.client_id,
        status: c.status,
        total_visits: c.total_visits || 0,
        total_spent: c.total_spent || 0,
        last_visit: c.last_visit || null,
      }));
    sessionStorage.setItem('campaigns:preselected', JSON.stringify({ ids, contacts, ts: Date.now() }));
    onNavigate?.('campaigns');
  }, [selectedIds, clients]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteCandidate) return;
    const name = deleteCandidate.name;
    const id = deleteCandidate.id;
    setDeletingId(id);
    try {
      await clientService.delete(id, true); // hard delete
      // Optimistic remove + then full reload so KPIs and filter counts refresh too
      setClients((prev) => prev.filter((c) => c.id !== id));
      if (selectedClient?.id === id) setSelectedClient(null);
      setDeleteCandidate(null);
      addNotification(`${name} fue borrado del sistema`, 'success');
      loadClients();
    } catch (err) {
      addNotification('No se pudo borrar: ' + err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  }, [deleteCandidate, selectedClient, addNotification, loadClients]);

  const counts = useMemo(() => ({
    total: kpis.total_clients,
    activo: kpis.active_clients,
    vip: kpis.vip_clients,
    inactivo: kpis.inactive_clients,
    en_riesgo: kpis.at_risk_clients,
    nuevo: kpis.new_clients,
  }), [kpis]);

  // ---------- Smart insights derived from data ----------
  const insights = useMemo(() => {
    const list = [];
    if (!clients.length) return list;

    // 1) Top spender (este periodo total)
    const topSpender = [...clients]
      .filter((c) => c.total_spent > 0)
      .sort((a, b) => b.total_spent - a.total_spent)[0];
    if (topSpender) {
      list.push({
        id: 'top',
        tone: 'amber',
        icon: 'crown',
        kicker: 'Top cliente',
        title: topSpender.name,
        meta: `${formatCurrency(topSpender.total_spent)} · ${topSpender.total_visits || 0} visitas`,
        onClick: () => handleClientClick(topSpender),
      });
    }

    // 2) Sin visita > 30d (potencial pérdida)
    const dormant = clients.filter((c) => c.last_visit && daysSince(c.last_visit) >= 30);
    if (dormant.length > 0) {
      list.push({
        id: 'dormant',
        tone: 'rose',
        icon: 'alert',
        kicker: 'Atención',
        title: `${dormant.length} ${dormant.length === 1 ? 'cliente' : 'clientes'} sin visita +30d`,
        meta: 'Reactívalos con una campaña personalizada',
        onClick: () => setStatusFilter('en_riesgo'),
      });
    }

    // 3) Cumpleaños este mes
    const month = new Date().getMonth() + 1;
    const birthdays = clients.filter((c) => {
      if (!c.birthday) return false;
      const m = parseInt(String(c.birthday).slice(5, 7), 10);
      return m === month;
    });
    if (birthdays.length > 0) {
      list.push({
        id: 'bday',
        tone: 'pink',
        icon: 'gift',
        kicker: 'Cumpleaños',
        title: `${birthdays.length} ${birthdays.length === 1 ? 'cumpleaños' : 'cumpleaños'} este mes`,
        meta: birthdays.slice(0, 3).map((c) => c.name.split(' ')[0]).join(' · '),
        onClick: () => { /* could open birthday filter */ },
      });
    }

    // 4) Nuevos esta semana
    if (kpis.new_clients > 0) {
      list.push({
        id: 'new',
        tone: 'sky',
        icon: 'sparkle',
        kicker: 'Crecimiento',
        title: `${kpis.new_clients} ${kpis.new_clients === 1 ? 'nuevo cliente' : 'nuevos clientes'}`,
        meta: 'Bienvenida automática activada',
        onClick: () => setStatusFilter('nuevo'),
      });
    }

    // 5) VIP
    if (kpis.vip_clients > 0) {
      list.push({
        id: 'vip',
        tone: 'violet',
        icon: 'star',
        kicker: 'VIP',
        title: `${kpis.vip_clients} ${kpis.vip_clients === 1 ? 'cliente VIP' : 'clientes VIP'}`,
        meta: 'Tu núcleo de mayor valor',
        onClick: () => setStatusFilter('vip'),
      });
    }

    return list;
  }, [clients, kpis]);

  // ---------- KPI Hero Cards ----------
  const heroKpis = useMemo(() => ([
    {
      key: 'total',
      tone: 'indigo',
      label: 'Total clientes',
      value: kpis.total_clients,
      hint: kpis.new_clients > 0 ? `+${kpis.new_clients} este mes` : 'Tu base completa',
      trend: kpis.new_clients > 0 ? 'up' : 'flat',
      icon: 'users',
    },
    {
      key: 'retention',
      tone: 'emerald',
      label: 'Retención',
      value: `${Number(kpis.retention_rate || 0).toFixed(1)}%`,
      hint: kpis.retention_rate >= 60 ? 'Saludable' : kpis.retention_rate >= 40 ? 'En crecimiento' : 'Necesita atención',
      trend: kpis.retention_rate >= 60 ? 'up' : kpis.retention_rate >= 40 ? 'flat' : 'down',
      icon: 'pulse',
    },
    {
      key: 'avg',
      tone: 'sky',
      label: 'Ticket promedio',
      value: formatCurrency(kpis.avg_ticket),
      hint: kpis.total_revenue > 0 ? `${formatCurrency(kpis.total_revenue)} total` : 'Sin ventas registradas',
      trend: 'flat',
      icon: 'wallet',
    },
    {
      key: 'risk',
      tone: kpis.at_risk_clients > 0 ? 'rose' : 'gray',
      label: 'En riesgo',
      value: kpis.at_risk_clients,
      hint: kpis.at_risk_clients > 0 ? 'Requieren reactivación' : 'Todo bajo control',
      trend: kpis.at_risk_clients > 0 ? 'down' : 'flat',
      icon: 'shield',
      onClick: kpis.at_risk_clients > 0 ? () => setStatusFilter('en_riesgo') : undefined,
    },
  ]), [kpis]);

  // ---------- Icon library ----------
  const Icon = ({ name, size = 18 }) => {
    const sw = 1.8;
    const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
    switch (name) {
      case 'users': return (<svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
      case 'pulse': return (<svg {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>);
      case 'wallet': return (<svg {...props}><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" /><path d="M21 12h-4a2 2 0 0 0 0 4h4z" /></svg>);
      case 'shield': return (<svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
      case 'crown': return (<svg {...props}><path d="M3 18h18" /><path d="M3 8l4 4 5-7 5 7 4-4-2 10H5z" /></svg>);
      case 'alert': return (<svg {...props}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>);
      case 'gift': return (<svg {...props}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" /></svg>);
      case 'sparkle': return (<svg {...props}><path d="M12 2v6m0 8v6M2 12h6m8 0h6M5 5l4 4m6 6 4 4M5 19l4-4m6-6 4-4" /></svg>);
      case 'star': return (<svg {...props} fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" /></svg>);
      case 'arrow-up': return (<svg {...props}><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>);
      case 'arrow-down': return (<svg {...props}><line x1="7" y1="7" x2="17" y2="17" /><polyline points="17 7 17 17 7 17" /></svg>);
      case 'minus': return (<svg {...props}><line x1="5" y1="12" x2="19" y2="12" /></svg>);
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__loading`}>
          <div className={`${b}__spinner`} />
          <p>Cargando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={b}>
      {/* ---------- HERO HEADER ---------- */}
      <header className={`${b}__hero`}>
        <div className={`${b}__hero-text`}>
          <h1 className={`${b}__title`}>Clientes</h1>
          <p className={`${b}__subtitle`}>
            <span>{kpis.total_clients} contactos</span>
            {kpis.active_clients > 0 && <><span className={`${b}__dot`} />{kpis.active_clients} activos</>}
            {kpis.vip_clients > 0 && <><span className={`${b}__dot`} />{kpis.vip_clients} VIP</>}
          </p>
        </div>

        <div className={`${b}__hero-actions`}>
          <div className={`${b}__export-wrap`} ref={exportMenuRef}>
            <button
              className={`${b}__action ${b}__action--ghost`}
              onClick={() => setShowExportMenu((v) => !v)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar
            </button>
            {showExportMenu && (
              <div className={`${b}__export-menu`}>
                <button className={`${b}__export-option`} onClick={() => {
                  const headers = ['ID', 'Nombre', 'Telefono', 'Email', 'Estado', 'Visitas', 'Total Gastado', 'Ultima Visita'];
                  const rows = clients.map(c => [c.client_id, c.name, c.phone, c.email || '', c.status || '', c.total_visits || 0, c.total_spent || 0, c.last_visit || '']);
                  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
                  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clientes.csv'; a.click();
                  addNotification('Exportado como CSV (Sheets)', 'success'); setShowExportMenu(false);
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34A853" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                  Sheets (CSV)
                </button>
                <button className={`${b}__export-option`} onClick={() => {
                  const rows = clients.map(c => `<tr><td>${c.client_id}</td><td>${c.name}</td><td>${c.phone}</td><td>${c.email || ''}</td><td>${c.status || ''}</td><td>${c.total_visits || 0}</td><td>${c.total_spent || 0}</td><td>${c.last_visit || ''}</td></tr>`).join('');
                  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body><h2>Clientes</h2><table border="1" cellpadding="4"><tr><th>ID</th><th>Nombre</th><th>Telefono</th><th>Email</th><th>Estado</th><th>Visitas</th><th>Total</th><th>Ultima Visita</th></tr>${rows}</table></body></html>`;
                  const blob = new Blob([html], { type: 'application/msword' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clientes.doc'; a.click();
                  addNotification('Exportado como Word', 'success'); setShowExportMenu(false);
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2B579A" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Word (DOC)
                </button>
                <button className={`${b}__export-option`} onClick={async () => {
                  try {
                    const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
                    const res = await fetch(`${API}/clients/export-excel`, { credentials: 'include' });
                    if (!res.ok) throw new Error('Error');
                    const blob = await res.blob();
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Clientes.xlsx'; a.click();
                    addNotification('Excel descargado', 'success');
                  } catch { addNotification('Error exportando Excel', 'error'); }
                  setShowExportMenu(false);
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#217346" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                  Excel (XLSX)
                </button>
                <button className={`${b}__export-option`} onClick={() => {
                  const lines = clients.map(c => `${c.name} | ${c.phone} | ${c.email || 'Sin email'} | ${c.status || ''} | ${c.total_visits || 0} visitas | $${(c.total_spent || 0).toLocaleString('es-CO')}`);
                  const txt = `CLIENTES (${clients.length})\n${'='.repeat(50)}\n\n${lines.join('\n')}`;
                  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clientes.txt'; a.click();
                  addNotification('Exportado como texto', 'success'); setShowExportMenu(false);
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Texto (TXT)
                </button>
              </div>
            )}
          </div>

          <button
            className={`${b}__action ${b}__action--ghost`}
            onClick={() => setIsImportModalOpen(true)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importar
          </button>

          <button
            className={`${b}__action ${b}__action--primary`}
            onClick={() => { setEditingClient(null); setIsAddModalOpen(true); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo cliente
          </button>
        </div>
      </header>

      {/* ---------- HERO KPI CARDS ---------- */}
      <section className={`${b}__kpis`}>
        {heroKpis.map((k) => (
          <button
            key={k.key}
            type="button"
            className={`${b}__kpi ${b}__kpi--${k.tone} ${k.onClick ? `${b}__kpi--clickable` : ''}`}
            onClick={k.onClick}
            disabled={!k.onClick}
          >
            <span className={`${b}__kpi-icon`}><Icon name={k.icon} size={20} /></span>
            <div className={`${b}__kpi-body`}>
              <span className={`${b}__kpi-label`}>{k.label}</span>
              <span className={`${b}__kpi-value`}>{k.value}</span>
              <span className={`${b}__kpi-hint`}>
                {k.trend === 'up' && <Icon name="arrow-up" size={11} />}
                {k.trend === 'down' && <Icon name="arrow-down" size={11} />}
                {k.trend === 'flat' && <Icon name="minus" size={11} />}
                {k.hint}
              </span>
            </div>
          </button>
        ))}
      </section>

      {/* ---------- AI INSIGHTS ---------- */}
      {insights.length > 0 && (
        <section className={`${b}__insights`}>
          <div className={`${b}__insights-head`}>
            <span className={`${b}__insights-title`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.8.6 1 1.7 1 2.3v1h6v-1c0-.6.2-1.7 1-2.3A7 7 0 0 0 12 2z"/></svg>
              Insights inteligentes
            </span>
          </div>
          <div className={`${b}__insights-list`}>
            {insights.map((ins) => (
              <button
                key={ins.id}
                type="button"
                className={`${b}__insight ${b}__insight--${ins.tone}`}
                onClick={ins.onClick}
              >
                <span className={`${b}__insight-icon`}><Icon name={ins.icon} size={16} /></span>
                <div className={`${b}__insight-body`}>
                  <span className={`${b}__insight-kicker`}>{ins.kicker}</span>
                  <span className={`${b}__insight-title`}>{ins.title}</span>
                  {ins.meta && <span className={`${b}__insight-meta`}>{ins.meta}</span>}
                </div>
                <span className={`${b}__insight-arrow`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- RFM segmentation (when present) ---------- */}
      {rfmData?.summary && Object.keys(rfmData.summary).length > 0 && (
        <section className={`${b}__rfm`}>
          <span className={`${b}__rfm-label`}>Segmentación RFM</span>
          <div className={`${b}__rfm-chips`}>
            <button
              className={`${b}__rfm-chip ${!rfmFilter ? `${b}__rfm-chip--active` : ''}`}
              onClick={() => setRfmFilter(null)}
            >
              Todos
            </button>
            {Object.entries(rfmData.segments).map(([key, meta]) => {
              const count = rfmData.summary[key] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  className={`${b}__rfm-chip ${rfmFilter === key ? `${b}__rfm-chip--active` : ''}`}
                  onClick={() => setRfmFilter(rfmFilter === key ? null : key)}
                  style={rfmFilter === key ? { background: meta.color, borderColor: meta.color, color: '#fff' } : { borderColor: `${meta.color}40`, color: meta.color }}
                >
                  <span className={`${b}__rfm-dot`} style={{ background: meta.color }} />
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- FILTERS + BULK BAR (inline) ---------- */}
      <div className={`${b}__filters-row`}>
        <div className={`${b}__filters-wrap`}>
          <ClientFilters
            onSearch={setSearchQuery}
            onFilterStatus={setStatusFilter}
            activeStatus={statusFilter}
            counts={counts}
          />
        </div>

        {selectedIds.size > 0 && (
          <div className={`${b}__bulkbar`} role="region" aria-label="Acciones múltiples">
            <button
              className={`${b}__bulkbar-clear`}
              onClick={clearSelection}
              aria-label="Limpiar selección"
              title="Limpiar selección"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <span className={`${b}__bulkbar-count`}>
              <strong>{selectedIds.size}</strong> seleccionado{selectedIds.size === 1 ? '' : 's'}
            </span>

            <button
              className={`${b}__bulkbar-btn ${b}__bulkbar-btn--primary`}
              onClick={handleSendCampaign}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Enviar campaña
            </button>

            <button
              className={`${b}__bulkbar-btn ${b}__bulkbar-btn--danger`}
              onClick={() => setBulkConfirm(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
              </svg>
              Borrar todos
            </button>
          </div>
        )}
      </div>

      {/* ---------- TABLE ---------- */}
      <ClientTable
        clients={filteredClients}
        onClientClick={handleClientClick}
        sortConfig={sortConfig}
        onSort={handleSort}
        onDelete={handleDeleteRequest}
        selectable
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
      />

      {filteredClients.length === 0 && !loading && (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title="No hay clientes registrados"
          description="Intenta cambiar los filtros o agrega un nuevo cliente"
          actionLabel="Agregar Cliente"
          onAction={() => { setEditingClient(null); setIsAddModalOpen(true); }}
        />
      )}

      <ClientDetail
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        onEdit={handleEditClient}
        onRefresh={loadClients}
      />

      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingClient(null); }}
        onSave={handleSaveClient}
        editingClient={editingClient}
      />

      <ImportClientsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={loadClients}
      />

      {/* ───────── Bulk delete confirm dialog ───────── */}
      {bulkConfirm && (
        <div className={`${b}__confirm-backdrop`} onClick={() => !bulkDeleting && setBulkConfirm(false)}>
          <div className={`${b}__confirm`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={`${b}__confirm-icon`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3 className={`${b}__confirm-title`}>¿Borrar {selectedIds.size} cliente{selectedIds.size === 1 ? '' : 's'}?</h3>
            <p className={`${b}__confirm-text`}>
              Se eliminarán permanentemente del sistema, junto con su historial de visitas, citas, notas y conversaciones.
              <strong> Esta acción no se puede deshacer.</strong>
            </p>
            <div className={`${b}__confirm-actions`}>
              <button
                className={`${b}__confirm-btn ${b}__confirm-btn--ghost`}
                onClick={() => setBulkConfirm(false)}
                disabled={bulkDeleting}
              >
                Cancelar
              </button>
              <button
                className={`${b}__confirm-btn ${b}__confirm-btn--danger`}
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? 'Borrando...' : `Sí, borrar ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────── Single delete confirm dialog ───────── */}
      {deleteCandidate && (
        <div className={`${b}__confirm-backdrop`} onClick={() => deletingId == null && setDeleteCandidate(null)}>
          <div className={`${b}__confirm`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={`${b}__confirm-icon`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3 className={`${b}__confirm-title`}>¿Borrar a {deleteCandidate.name}?</h3>
            <p className={`${b}__confirm-text`}>
              Se eliminará permanentemente del sistema, junto con su historial de visitas, citas, notas y conversaciones.
              <strong> Esta acción no se puede deshacer.</strong>
            </p>
            <div className={`${b}__confirm-actions`}>
              <button
                className={`${b}__confirm-btn ${b}__confirm-btn--ghost`}
                onClick={() => setDeleteCandidate(null)}
                disabled={deletingId != null}
              >
                Cancelar
              </button>
              <button
                className={`${b}__confirm-btn ${b}__confirm-btn--danger`}
                onClick={handleDeleteConfirm}
                disabled={deletingId != null}
              >
                {deletingId != null ? 'Borrando...' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
