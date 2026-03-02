import { useState, useEffect, useMemo, useRef } from 'react';
import ClientTable from '../../components/crm/ClientTable/ClientTable';
import ClientDetail from '../../components/crm/ClientDetail/ClientDetail';
import ClientFilters from '../../components/crm/ClientFilters/ClientFilters';
import AddClientModal from '../../components/crm/AddClientModal/AddClientModal';
import Button from '../../components/common/Button/Button';
import { useNotification } from '../../context/NotificationContext';
import { mockClients as initialClients, mockVisitHistory } from '../../data/mockData';
import { formatCurrency } from '../../utils/formatters';
import { enrichClients, computeKPIs, STATUS } from '../../utils/clientStatus';

const STORAGE_KEY = 'alpelo_clients';
const STATUS_STORAGE_KEY = 'alpelo_prev_statuses';
const DATA_VERSION_KEY = 'alpelo_data_version';
const CURRENT_DATA_VERSION = '3.1'; // Bump when mockData changes

const Clients = () => {
  const [clients, setClients] = useState(() => {
    const storedVersion = localStorage.getItem(DATA_VERSION_KEY);
    if (storedVersion !== CURRENT_DATA_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STATUS_STORAGE_KEY);
      localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    const raw = stored ? JSON.parse(stored) : initialClients;
    return enrichClients(raw, mockVisitHistory);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [selectedClient, setSelectedClient] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const { addNotification } = useNotification();
  const hasNotified = useRef(false);
  const b = 'clients';

  // Status change notifications on mount
  useEffect(() => {
    if (hasNotified.current) return;
    hasNotified.current = true;

    const storedStatuses = JSON.parse(localStorage.getItem(STATUS_STORAGE_KEY) || '{}');
    const hasStoredStatuses = Object.keys(storedStatuses).length > 0;

    const atRisk = clients.filter((c) => c.status === STATUS.EN_RIESGO);
    const becameInactive = clients.filter(
      (c) => c.status === STATUS.INACTIVO && hasStoredStatuses && storedStatuses[c.id] !== STATUS.INACTIVO
    );

    if (atRisk.length > 0) {
      addNotification(
        `${atRisk.length} cliente${atRisk.length > 1 ? 's' : ''} en riesgo de perderse`,
        'warning'
      );
    }

    if (becameInactive.length > 0) {
      const names = becameInactive.slice(0, 3).map((c) => c.name).join(', ');
      const extra = becameInactive.length > 3 ? ` y ${becameInactive.length - 3} más` : '';
      addNotification(`${names}${extra} lleva${becameInactive.length === 1 ? '' : 'n'} más de 2 meses sin visitar`, 'warning');
    }

    const newStatuses = Object.fromEntries(clients.map((c) => [c.id, c.status]));
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(newStatuses));
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }, [clients]);

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
        c.email.toLowerCase().includes(q)
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

  const handleSaveClient = (clientData) => {
    setClients((prev) => {
      const exists = prev.find((c) => c.id === clientData.id);
      let updated;
      if (exists) {
        updated = prev.map((c) => (c.id === clientData.id ? clientData : c));
      } else {
        updated = [...prev, clientData];
      }
      return enrichClients(updated, mockVisitHistory);
    });
    addNotification(
      editingClient ? 'Cliente actualizado correctamente' : 'Cliente agregado correctamente',
      'success'
    );
    setEditingClient(null);
  };

  const handleNotesSave = (clientId, notes) => {
    setClients((prev) => {
      const updated = prev.map((c) => (c.id === clientId ? { ...c, notes } : c));
      return enrichClients(updated, mockVisitHistory);
    });
    addNotification('Notas actualizadas', 'success');
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setIsAddModalOpen(true);
    setSelectedClient(null);
  };

  const kpis = useMemo(() => computeKPIs(clients), [clients]);

  const counts = useMemo(() => ({
    total: clients.length,
    activo: clients.filter((c) => c.status === STATUS.ACTIVO).length,
    vip: clients.filter((c) => c.status === STATUS.VIP).length,
    inactivo: clients.filter((c) => c.status === STATUS.INACTIVO).length,
    en_riesgo: clients.filter((c) => c.status === STATUS.EN_RIESGO).length,
    nuevo: clients.filter((c) => c.status === STATUS.NUEVO).length,
  }), [clients]);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div className={`${b}__header-top`}>
          <h2 className={`${b}__title`}>Gestión de Clientes</h2>
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
        <div className={`${b}__kpi-bar`}>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value`}>{kpis.total}</span>
            <span className={`${b}__kpi-label`}>Total clientes</span>
          </div>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value ${b}__kpi-value--success`}>{kpis.retentionRate}%</span>
            <span className={`${b}__kpi-label`}>Retención</span>
          </div>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value`}>{formatCurrency(kpis.avgTicket)}</span>
            <span className={`${b}__kpi-label`}>Ticket promedio</span>
          </div>
          <div className={`${b}__kpi-card${kpis.atRisk > 0 ? ` ${b}__kpi-card--urgent` : ''}`}>
            <span className={`${b}__kpi-value ${b}__kpi-value--warning`}>{kpis.atRisk}</span>
            <span className={`${b}__kpi-label`}>En riesgo</span>
          </div>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value ${b}__kpi-value--danger`}>{kpis.inactive}</span>
            <span className={`${b}__kpi-label`}>Inactivos</span>
          </div>
          <div className={`${b}__kpi-card`}>
            <span className={`${b}__kpi-value ${b}__kpi-value--accent`}>{kpis.vip}</span>
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
        onClientClick={setSelectedClient}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      {filteredClients.length === 0 && (
        <div className={`${b}__empty`}>
          <div className={`${b}__empty-icon`}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className={`${b}__empty-text`}>No se encontraron clientes</p>
          <p className={`${b}__empty-hint`}>Intenta cambiar los filtros o agrega un nuevo cliente</p>
        </div>
      )}

      <ClientDetail
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        onEdit={handleEditClient}
        onNotesSave={handleNotesSave}
        visitHistory={mockVisitHistory}
      />

      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingClient(null); }}
        onSave={handleSaveClient}
        editingClient={editingClient}
      />
    </div>
  );
};

export default Clients;
