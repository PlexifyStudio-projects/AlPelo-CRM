import { useState, useEffect, useMemo, useCallback } from 'react';
import ClientTable from '../../components/Admin/ClientTable/ClientTable';
import ClientDetail from '../../components/Admin/ClientDetail/ClientDetail';
import ClientFilters from '../../components/Admin/ClientFilters/ClientFilters';
import AddClientModal from '../../components/Admin/AddClientModal/AddClientModal';
import AddVisitModal from '../../components/Admin/AddVisitModal/AddVisitModal';
import ImportClientsModal from '../../components/Admin/ImportClientsModal/ImportClientsModal';
import Button from '../../components/common/Button/Button';
import { useNotification } from '../../context/NotificationContext';
import { formatCurrency } from '../../utils/formatters';
import EmptyState from '../../components/common/EmptyState/EmptyState';
import clientService from '../../services/clientService';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [kpis, setKpis] = useState({ total_clients: 0, active_clients: 0, at_risk_clients: 0, inactive_clients: 0, vip_clients: 0, new_clients: 0, retention_rate: 0, total_revenue: 0, avg_ticket: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [selectedClient, setSelectedClient] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [rfmData, setRfmData] = useState(null);
  const [rfmFilter, setRfmFilter] = useState(null);
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
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.client_id.toLowerCase().includes(q)
      );
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
      if (editingClient) {
        await clientService.update(editingClient.id, clientData);
        addNotification('Cliente actualizado correctamente', 'success');
      } else {
        await clientService.create(clientData);
        addNotification('Cliente agregado correctamente', 'success');
      }
      setEditingClient(null);
      loadClients();
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

  const counts = useMemo(() => ({
    total: kpis.total_clients,
    activo: kpis.active_clients,
    vip: kpis.vip_clients,
    inactivo: kpis.inactive_clients,
    en_riesgo: kpis.at_risk_clients,
    nuevo: kpis.new_clients,
  }), [kpis]);

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
      <div className={`${b}__header`}>
        <div className={`${b}__header-top`}>
          <h2 className={`${b}__title`}>Gestión de Clientes</h2>
          <div className={`${b}__header-actions`}>
            <div style={{ position: 'relative' }}>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Exportar
              </Button>
              {showExportMenu && (
                <div className={`${b}__export-menu`}>
                  <button className={`${b}__export-option`} onClick={() => {
                    const headers = ['ID', 'Nombre', 'Telefono', 'Email', 'Estado', 'Visitas', 'Total Gastado', 'Ultima Visita'];
                    const rows = clients.map(c => [c.client_id, c.name, c.phone, c.email || '', c.status || '', c.total_visits || 0, c.total_spent || 0, c.last_visit || '']);
                    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
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
            <Button
              variant="ghost"
              size="md"
              onClick={() => setIsImportModalOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Importar
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsVisitModalOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="12" y1="14" x2="12" y2="18" />
                <line x1="10" y1="16" x2="14" y2="16" />
              </svg>
              Registrar Visita
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => { setEditingClient(null); setIsAddModalOpen(true); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nuevo Cliente
            </Button>
          </div>
        </div>
        <div className={`${b}__kpi-bar`}>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value`}>{kpis.total_clients}</span>
            <span className={`${b}__kpi-label`}>Total clientes</span>
          </div>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value ${b}__kpi-value--success`}>{kpis.retention_rate}%</span>
            <span className={`${b}__kpi-label`}>Retención</span>
          </div>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value`}>{formatCurrency(kpis.avg_ticket)}</span>
            <span className={`${b}__kpi-label`}>Ticket promedio</span>
          </div>
          <div className={`${b}__kpi-card${kpis.at_risk_clients > 0 ? ` ${b}__kpi-card--urgent` : ''}`}>
            <span className={`${b}__kpi-value ${b}__kpi-value--warning`}>{kpis.at_risk_clients}</span>
            <span className={`${b}__kpi-label`}>En riesgo</span>
          </div>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value ${b}__kpi-value--danger`}>{kpis.inactive_clients}</span>
            <span className={`${b}__kpi-label`}>Inactivos</span>
          </div>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value ${b}__kpi-value--accent`}>{kpis.vip_clients}</span>
            <span className={`${b}__kpi-label`}>VIP</span>
          </div>
        </div>

        {rfmData?.summary && Object.keys(rfmData.summary).length > 0 && (
          <div className={`${b}__rfm-bar`}>
            <span className={`${b}__rfm-title`}>Segmentacion RFM</span>
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
          </div>
        )}
      </div>

      <ClientFilters
        onSearch={setSearchQuery}
        onFilterStatus={setStatusFilter}
        activeStatus={statusFilter}
        counts={counts}
      />

      <ClientTable
        clients={filteredClients}
        onClientClick={handleClientClick}
        sortConfig={sortConfig}
        onSort={handleSort}
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

      <AddVisitModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        onSaved={loadClients}
        onNewClient={() => { setEditingClient(null); setIsAddModalOpen(true); }}
      />

      <ImportClientsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={loadClients}
      />
    </div>
  );
};

export default Clients;
