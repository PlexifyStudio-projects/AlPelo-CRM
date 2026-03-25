import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-prospector';

const CATEGORIES = [
  'Peluquerias', 'Barberias', 'Restaurantes', 'Odontologia',
  'Clinicas/Hospitales', 'Spas', 'Gimnasios', 'Veterinarias',
  'Hoteles', 'Salones de belleza', 'Nail salons', 'Lavaderos de autos',
  'Lavanderias', 'Pet groomers', 'Tattoo studios', 'Fisioterapia',
  'Opticas', 'Psicologia', 'Guarderias', 'Yoga studios',
  'Coworking spaces', 'Centros esteticos', 'Consultorios medicos',
  'Academias de baile', 'Escuelas de musica',
];

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: '#94A3B8' },
  contacted: { label: 'Contactado', color: '#3B82F6' },
  interested: { label: 'Interesado', color: '#10B981' },
  discarded: { label: 'Descartado', color: '#EF4444' },
  converted: { label: 'Convertido', color: '#8B5CF6' },
};

const DevProspector = () => {
  const [prospects, setProspects] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesText, setNotesText] = useState('');

  // Generator state
  const [city, setCity] = useState('Bucaramanga');
  const [selectedCats, setSelectedCats] = useState(['Peluquerias', 'Barberias', 'Restaurantes']);
  const [count, setCount] = useState(10);

  // Filter state
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const fetchProspects = useCallback(async () => {
    try {
      let url = `${API_URL}/dev/prospects?`;
      if (filterStatus) url += `status=${filterStatus}&`;
      if (filterSearch) url += `search=${encodeURIComponent(filterSearch)}&`;
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setProspects(data.prospects || []);
      setStats(data.by_status || {});
      setTotal(data.total || 0);
    } catch {
      setProspects([]);
    }
    setLoading(false);
  }, [filterStatus, filterSearch]);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  const handleGenerate = async () => {
    if (selectedCats.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/dev/prospect/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, categories: selectedCats, count }),
      });
      if (!res.ok) throw new Error('Failed');
      await res.json();
      fetchProspects();
    } catch {
      // silently fail
    }
    setGenerating(false);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await fetch(`${API_URL}/dev/prospects/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchProspects();
    } catch { /* */ }
  };

  const handleSaveNotes = async (id) => {
    try {
      await fetch(`${API_URL}/dev/prospects/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesText }),
      });
      setEditingNotes(null);
      fetchProspects();
    } catch { /* */ }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_URL}/dev/prospects/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      fetchProspects();
    } catch { /* */ }
  };

  const toggleCategory = (cat) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Tendencias</h1></div>
        <p className={`${b}__loading`}>Cargando prospectos...</p>
      </div>
    );
  }

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Tendencias</h1>
          <p className={`${b}__subtitle`}>Prospector de Negocios IA — {total} prospectos en base de datos</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className={`${b}__stats`}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className={`${b}__stat-item`}>
            <span className={`${b}__stat-dot`} style={{ background: cfg.color }} />
            <span className={`${b}__stat-label`}>{cfg.label}</span>
            <span className={`${b}__stat-count`}>{stats[key] || 0}</span>
          </div>
        ))}
      </div>

      {/* Generator Panel */}
      <div className={`${b}__generator`}>
        <h3 className={`${b}__gen-title`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a4 4 0 014 4v1a2 2 0 012 2v1a2 2 0 01-2 2h0a2 2 0 01-2 2v3a2 2 0 01-4 0v-3a2 2 0 01-2-2h0a2 2 0 01-2-2V9a2 2 0 012-2V6a4 4 0 014-4z"/></svg>
          Generar Prospectos con IA
        </h3>

        <div className={`${b}__gen-row`}>
          <div className={`${b}__gen-field`}>
            <label>Ciudad</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bucaramanga"
              className={`${b}__input`}
            />
          </div>
          <div className={`${b}__gen-field`}>
            <label>Cantidad</label>
            <div className={`${b}__count-row`}>
              <input
                type="range"
                min="3"
                max="20"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className={`${b}__slider`}
              />
              <span className={`${b}__count-val`}>{count}</span>
            </div>
          </div>
        </div>

        <div className={`${b}__gen-field`}>
          <label>Categorias ({selectedCats.length} seleccionadas)</label>
          <div className={`${b}__categories`}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`${b}__cat-chip ${selectedCats.includes(cat) ? `${b}__cat-chip--selected` : ''}`}
                onClick={() => toggleCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <button
          className={`${b}__gen-btn`}
          onClick={handleGenerate}
          disabled={generating || selectedCats.length === 0}
        >
          {generating ? (
            <>
              <span className={`${b}__spinner`} />
              Generando prospectos...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 2 3 14h9l-1 8 10-12h-9l1-8"/></svg>
              Generar {count} Prospectos
            </>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className={`${b}__filters`}>
        <select
          className={`${b}__select`}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <input
          type="text"
          className={`${b}__search`}
          placeholder="Buscar por nombre, tipo o dueno..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
        />
      </div>

      {/* Prospects List */}
      {prospects.length === 0 ? (
        <div className={`${b}__empty`}>
          <div className={`${b}__empty-icon`}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h3 className={`${b}__empty-title`}>Sin prospectos</h3>
          <p className={`${b}__empty-text`}>Usa el generador para encontrar negocios potenciales</p>
        </div>
      ) : (
        <div className={`${b}__list`}>
          {prospects.map((p) => {
            const isExpanded = expandedId === p.id;
            const sCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
            return (
              <div key={p.id} className={`${b}__card ${isExpanded ? `${b}__card--expanded` : ''}`}>
                <div className={`${b}__card-main`} onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                  <div className={`${b}__card-left`}>
                    <span className={`${b}__card-status`} style={{ background: sCfg.color }} title={sCfg.label} />
                    <div className={`${b}__card-info`}>
                      <span className={`${b}__card-name`}>{p.name}</span>
                      <span className={`${b}__card-meta`}>
                        {p.business_type} — {p.city}
                        {p.owner_name && ` — ${p.owner_name}`}
                      </span>
                    </div>
                  </div>
                  <div className={`${b}__card-right`}>
                    {p.phone && <span className={`${b}__card-contact`}>{p.phone}</span>}
                    {p.email && <span className={`${b}__card-contact`}>{p.email}</span>}
                    <select
                      className={`${b}__status-select`}
                      value={p.status}
                      onChange={(e) => { e.stopPropagation(); handleStatusChange(p.id, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                    <button
                      className={`${b}__delete-btn`}
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      title="Eliminar"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                    <svg className={`${b}__chevron`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points={isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className={`${b}__card-detail`}>
                    {p.address && (
                      <div className={`${b}__detail-row`}>
                        <strong>Direccion:</strong> {p.address}
                      </div>
                    )}
                    {p.ai_analysis && (
                      <div className={`${b}__detail-section`}>
                        <strong>Analisis de Mercado:</strong>
                        <p className={`${b}__detail-text`}>{p.ai_analysis}</p>
                      </div>
                    )}
                    {p.why_plexify && (
                      <div className={`${b}__detail-section`}>
                        <strong>Por que Plexify:</strong>
                        <p className={`${b}__detail-text`}>{p.why_plexify}</p>
                      </div>
                    )}

                    {/* Notes */}
                    <div className={`${b}__detail-section`}>
                      <strong>Notas:</strong>
                      {editingNotes === p.id ? (
                        <div className={`${b}__notes-edit`}>
                          <textarea
                            className={`${b}__notes-input`}
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            rows={3}
                            placeholder="Escribe notas sobre este prospecto..."
                          />
                          <div className={`${b}__notes-actions`}>
                            <button className={`${b}__notes-save`} onClick={() => handleSaveNotes(p.id)}>Guardar</button>
                            <button className={`${b}__notes-cancel`} onClick={() => setEditingNotes(null)}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`${b}__notes-display`}
                          onClick={() => { setEditingNotes(p.id); setNotesText(p.notes || ''); }}
                        >
                          {p.notes || 'Click para agregar notas...'}
                        </div>
                      )}
                    </div>

                    <div className={`${b}__detail-footer`}>
                      <span>Creado: {p.created_at ? new Date(p.created_at).toLocaleDateString('es-CO') : 'N/A'}</span>
                      {p.contacted_at && <span>Contactado: {new Date(p.contacted_at).toLocaleDateString('es-CO')}</span>}
                      <span>Fuente: {p.source}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DevProspector;
