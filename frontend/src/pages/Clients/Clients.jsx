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
import financeService from '../../services/financeService';

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
  const { addNotification } = useNotification();
  const b = 'clients';

  const loadClients = useCallback(async () => {
    try {
      const [clientList, kpiData] = await Promise.all([
        clientService.list(),
        clientService.kpis(),
      ]);
      setClients(clientList);
      setKpis(kpiData);
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
  }, [clients, searchQuery, statusFilter, sortConfig]);

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
            <Button
              variant="ghost"
              size="md"
              onClick={async () => {
                try {
                  const blob = await financeService.exportClients();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'clientes.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                  addNotification('Clientes exportados', 'success');
                } catch (err) {
                  addNotification('Error al exportar: ' + err.message, 'error');
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar
            </Button>
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
