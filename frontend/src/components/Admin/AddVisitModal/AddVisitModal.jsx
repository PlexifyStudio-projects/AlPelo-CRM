import { useState, useEffect, useRef } from 'react';
import Modal from '../../common/Modal/Modal';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import { mockServices, mockBarbers } from '../../../data/mockData';
import { formatCurrency } from '../../../utils/formatters';
import clientService from '../../../services/clientService';

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
];

const EMPTY_ITEM = {
  service_name: '',
  amount: '',
  staff_id: '',
  status: 'completed',
  payment_method: '',
  notes: '',
};

const AddVisitModal = ({ isOpen, onClose, onSaved, onNewClient }) => {
  const [step, setStep] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentClients, setRecentClients] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searching, setSearching] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchTimer = useRef(null);
  const b = 'add-visit-modal';

  useEffect(() => {
    if (isOpen) {
      clientService.list({ sort_by: 'created_at' }).then((data) => {
        setRecentClients(data.slice(0, 20));
      }).catch(() => {});
    } else {
      setStep('search');
      setSearchQuery('');
      setSearchResults([]);
      setRecentClients([]);
      setSelectedClient(null);
      setError('');
      setVisitDate(new Date().toISOString().split('T')[0]);
      setItems([{ ...EMPTY_ITEM }]);
    }
  }, [isOpen]);

  // --- Search ---
  const handleSearch = (value) => {
    setSearchQuery(value);
    setError('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await clientService.list({ search: value.trim() });
        setSearchResults(results);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setStep('form');
    setSearchQuery('');
    setSearchResults([]);
  };

  // --- Items ---
  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleServiceSelect = (index, serviceName) => {
    const service = mockServices.find((s) => s.name === serviceName);
    setItems((prev) => prev.map((item, i) =>
      i === index
        ? { ...item, service_name: serviceName, amount: service ? service.price.toString() : item.amount }
        : item
    ));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    const valid = items.every((it) => it.service_name && it.amount && it.staff_id);
    if (!selectedClient || !visitDate || !valid) {
      setError('Completa todos los campos obligatorios en cada servicio');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await Promise.all(items.map((it) =>
        clientService.createVisit({
          client_id: selectedClient.id,
          staff_id: Number(it.staff_id),
          service_name: it.service_name,
          amount: Number(it.amount),
          visit_date: visitDate,
          status: it.status,
          payment_method: it.payment_method || null,
          notes: it.notes || null,
        })
      ));
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const activeBarbers = mockBarbers.filter((br) => br.available);
  const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Visita" className="modal--lg">
      <div className={b}>
        {error && (
          <div className={`${b}__error`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* =================== SEARCH STEP =================== */}
        {step === 'search' && (
          <div className={`${b}__search-step`}>
            <p className={`${b}__instruction`}>Busca al cliente por nombre, teléfono o ID</p>

            <div className={`${b}__search-box`}>
              <svg className={`${b}__search-icon`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className={`${b}__search-input`}
                placeholder="Buscar cliente..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
              {searching && <span className={`${b}__spinner`} />}
            </div>

            {(() => {
              const displayClients = searchQuery.length >= 2 ? searchResults : recentClients;
              if (displayClients.length > 0) {
                return (
                  <div className={`${b}__results`}>
                    {!searchQuery && recentClients.length > 0 && (
                      <div className={`${b}__results-label`}>Clientes recientes</div>
                    )}
                    {displayClients.map((client) => (
                      <button key={client.id} className={`${b}__result-item`} onClick={() => handleSelectClient(client)}>
                        <div className={`${b}__result-avatar`}>{getInitials(client.name)}</div>
                        <div className={`${b}__result-info`}>
                          <span className={`${b}__result-name`}>{client.name}</span>
                          <span className={`${b}__result-meta`}>{client.client_id} &middot; {client.phone}</span>
                        </div>
                        <span className={`${b}__result-status`}>{client.total_visits} visitas</span>
                      </button>
                    ))}
                  </div>
                );
              }
              return null;
            })()}

            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
              <p className={`${b}__no-results`}>No se encontró ningún cliente</p>
            )}

            <div className={`${b}__new-client-row`}>
              <span>¿Cliente nuevo?</span>
              <Button variant="ghost" size="sm" onClick={() => { onClose(); onNewClient(); }} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                Crear cliente nuevo
              </Button>
            </div>
          </div>
        )}

        {/* =================== FORM STEP =================== */}
        {step === 'form' && selectedClient && (
          <form className={`${b}__form-step`} onSubmit={handleSubmit}>
            {/* Client card */}
            <div className={`${b}__selected-client`}>
              <div className={`${b}__result-avatar`}>{getInitials(selectedClient.name)}</div>
              <div className={`${b}__result-info`}>
                <span className={`${b}__result-name`}>{selectedClient.name}</span>
                <span className={`${b}__result-meta`}>{selectedClient.client_id} &middot; {selectedClient.phone}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep('search')} type="button">Cambiar</Button>
            </div>

            {/* Shared date */}
            <div className={`${b}__date-row`}>
              <Input label="Fecha de visita *" name="visit_date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required />
            </div>

            {/* Services list */}
            <div className={`${b}__items`}>
              {items.map((item, idx) => (
                <div key={idx} className={`${b}__item`}>
                  <div className={`${b}__item-header`}>
                    <span className={`${b}__item-number`}>Servicio {idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" className={`${b}__item-remove`} onClick={() => removeItem(idx)} aria-label="Quitar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className={`${b}__grid`}>
                    <div className={`${b}__select-group`}>
                      <label className={`${b}__label`}>Servicio *</label>
                      <select className={`${b}__select`} value={item.service_name} onChange={(e) => handleServiceSelect(idx, e.target.value)} required>
                        <option value="">Seleccionar...</option>
                        {mockServices.map((s) => (
                          <option key={s.id} value={s.name}>{s.name} - ${s.price.toLocaleString('es-CO')}</option>
                        ))}
                      </select>
                    </div>
                    <Input label="Valor (COP) *" name="amount" type="number" value={item.amount} onChange={(e) => updateItem(idx, 'amount', e.target.value)} placeholder="25000" required />
                    <div className={`${b}__select-group`}>
                      <label className={`${b}__label`}>Personal *</label>
                      <select className={`${b}__select`} value={item.staff_id} onChange={(e) => updateItem(idx, 'staff_id', e.target.value)} required>
                        <option value="">Seleccionar...</option>
                        {activeBarbers.map((br) => (
                          <option key={br.id} value={br.id}>{br.name} - {br.specialty}</option>
                        ))}
                      </select>
                    </div>
                    <div className={`${b}__select-group`}>
                      <label className={`${b}__label`}>Metodo de Pago</label>
                      <select className={`${b}__select`} value={item.payment_method} onChange={(e) => updateItem(idx, 'payment_method', e.target.value)}>
                        <option value="">Sin registrar</option>
                        {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div className={`${b}__select-group`}>
                      <label className={`${b}__label`}>Estado</label>
                      <select className={`${b}__select`} value={item.status} onChange={(e) => updateItem(idx, 'status', e.target.value)}>
                        <option value="completed">Completada</option>
                        <option value="no_show">No asistió</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" className={`${b}__add-item`} onClick={addItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar otro servicio
              </button>
            </div>

            {/* Total + Actions */}
            <div className={`${b}__actions`}>
              <div className={`${b}__total`}>
                <span>Total</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <div className={`${b}__actions-buttons`}>
                <Button variant="ghost" size="md" onClick={onClose} type="button">Cancelar</Button>
                <Button variant="primary" size="md" type="submit" disabled={saving}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {saving ? 'Guardando...' : `Registrar ${items.length > 1 ? `${items.length} servicios` : 'Visita'}`}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default AddVisitModal;
