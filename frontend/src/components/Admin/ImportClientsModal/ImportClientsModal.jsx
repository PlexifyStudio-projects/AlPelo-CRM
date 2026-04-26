import { useState, useRef, useCallback, Fragment, useEffect } from 'react';
import Modal from '../../common/Modal/Modal';
import Button from '../../common/Button/Button';
import financeService from '../../../services/financeService';
import clientService from '../../../services/clientService';

/* ────────────────────────────────────────────────────────────────
   Column spec — backend (finance_endpoints.py) accepts headers
   case-insensitively. Tags are NEVER imported (system-managed).
   ──────────────────────────────────────────────────────────────── */
const COLUMNS = [
  {
    letter: 'A',
    header: 'Nombre',
    required: true,
    desc: 'Nombre completo del cliente',
    format: 'Texto. Mayúsculas y minúsculas se conservan.',
    example: 'Juan Pérez Gómez',
    accept: ['nombre', 'name'],
  },
  {
    letter: 'B',
    header: 'Telefono',
    required: true,
    desc: 'Número de WhatsApp',
    format: '10 dígitos sin espacios ni guiones. Sin "+57", sin "(316)".',
    example: '3105551234',
    accept: ['telefono', 'phone', 'tel'],
  },
  {
    letter: 'C',
    header: 'Email',
    required: false,
    desc: 'Correo electrónico (opcional)',
    format: 'Formato estándar. Vacío si no tiene.',
    example: 'juan@gmail.com',
    accept: ['email', 'correo'],
  },
  {
    letter: 'D',
    header: 'Cumpleanos',
    required: false,
    desc: 'Fecha de nacimiento para campañas',
    format: 'AAAA-MM-DD (año-mes-día). Ej: 1990-05-15',
    example: '1990-05-15',
    accept: ['cumpleanos', 'cumpleaños', 'birthday'],
  },
];

const SAMPLE_ROWS = [
  { A: 'Juan Pérez Gómez', B: '3105551234', C: 'juan@gmail.com', D: '1990-05-15' },
  { A: 'María García',     B: '3209998877', C: '',               D: '1985-11-23' },
  { A: 'Carlos Ruiz',      B: '3001112233', C: 'carlos@hotmail.com', D: '' },
];

/* Animation pacing: total feels good around 4-8 seconds, capped */
const calcDelay = (total) => {
  if (total <= 0) return 30;
  const targetMs = Math.min(8000, Math.max(2500, total * 8));
  return Math.max(8, Math.min(120, Math.floor(targetMs / total)));
};

const ImportClientsModal = ({ isOpen, onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | uploading | processing | done
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [shownRows, setShownRows] = useState([]);   // animated playback subset
  const [counters, setCounters] = useState({ imported: 0, duplicate: 0, error: 0 });
  const [progressIdx, setProgressIdx] = useState(0);
  const [hint, setHint] = useState('');
  const [view, setView] = useState('upload'); // 'upload' | 'history'
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openBatchId, setOpenBatchId] = useState(null);
  const [batchDetail, setBatchDetail] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const fileRef = useRef(null);
  const consoleRef = useRef(null);
  const animTimer = useRef(null);
  const b = 'import-modal';

  const reset = useCallback(() => {
    if (animTimer.current) { clearTimeout(animTimer.current); animTimer.current = null; }
    setFile(null);
    setPreview(null);
    setPhase('idle');
    setError('');
    setResult(null);
    setShownRows([]);
    setCounters({ imported: 0, duplicate: 0, error: 0 });
    setProgressIdx(0);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  /* ─────────── File handling ─────────── */
  const handleFile = useCallback((f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Solo se aceptan archivos CSV o Excel (.xlsx)');
      return;
    }
    setFile(f);
    setError('');
    setResult(null);

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter((l) => l.trim());
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1, 4).map((line) =>
          line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        );
        setPreview({ headers, rows, lineCount: lines.length - 1 });
      };
      reader.readAsText(f);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  /* ─────────── Import → animated playback ─────────── */
  const handleImport = useCallback(async () => {
    if (!file) return;
    setError('');
    setShownRows([]);
    setCounters({ imported: 0, duplicate: 0, error: 0 });
    setProgressIdx(0);
    setPhase('uploading');

    try {
      const res = await financeService.importClients(file);
      // eslint-disable-next-line no-console
      console.log('[Import] backend response', res);
      setResult(res);
      setPhase('processing');

      const allRows = Array.isArray(res.rows) ? res.rows : [];

      // Fallback: backend hasn't been redeployed and returned old shape
      // (no per-row detail). Build synthetic rows from imported/skipped/errors
      // so the animation still has something meaningful to show.
      let workingRows = allRows;
      if (workingRows.length === 0) {
        const backendImported = Number(res.imported || 0);
        const backendSkipped = Number(res.skipped || 0);
        const backendErrors = Array.isArray(res.errors) ? res.errors : [];
        const synthetic = [];
        let line = 2;
        for (let i = 0; i < backendImported; i++) {
          synthetic.push({ line: line++, status: 'imported', name: '(detalle no disponible)', phone: '' });
        }
        for (let i = 0; i < backendSkipped; i++) {
          synthetic.push({ line: line++, status: 'duplicate', name: '(detalle no disponible)', phone: '', reason: 'Teléfono ya registrado' });
        }
        for (const errMsg of backendErrors) {
          synthetic.push({ line: line++, status: 'error', name: '', phone: '', reason: errMsg });
        }
        workingRows = synthetic;
      }

      const total = workingRows.length;
      const delay = calcDelay(total);

      if (total === 0) {
        // Genuinely nothing happened — bail out with an explicit message
        setPhase('done');
        return;
      }

      // playback animation
      let idx = 0;
      const tick = () => {
        if (idx >= total) {
          setPhase('done');
          if ((res.imported || 0) > 0 && onImported) onImported();
          return;
        }
        const batchSize = total > 500 ? 4 : total > 150 ? 2 : 1;
        const batch = workingRows.slice(idx, idx + batchSize);
        idx += batch.length;

        setShownRows((prev) => {
          const merged = [...prev, ...batch];
          return merged.length > 200 ? merged.slice(-200) : merged;
        });
        setCounters((prev) => {
          let imp = prev.imported, dup = prev.duplicate, err = prev.error;
          for (const r of batch) {
            if (r.status === 'imported') imp++;
            else if (r.status === 'duplicate') dup++;
            else err++;
          }
          return { imported: imp, duplicate: dup, error: err };
        });
        setProgressIdx(idx);

        animTimer.current = setTimeout(tick, delay);
      };
      tick();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Import] failed', err);
      setError(err.message || 'Error al subir el archivo');
      setPhase('idle');
    }
  }, [file, onImported]);

  /* Auto-scroll console as new rows arrive */
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [shownRows]);

  /* Cleanup timer on unmount */
  useEffect(() => () => {
    if (animTimer.current) clearTimeout(animTimer.current);
  }, []);

  /* ─────────── History loading ─────────── */
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const list = await clientService.listImportHistory(30);
      setHistory(Array.isArray(list) ? list : []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[Import] history load failed', err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && view === 'history') loadHistory();
  }, [isOpen, view, loadHistory]);

  const toggleBatch = useCallback(async (id) => {
    if (openBatchId === id) {
      setOpenBatchId(null);
      setBatchDetail(null);
      return;
    }
    setOpenBatchId(id);
    setBatchLoading(true);
    setBatchDetail(null);
    try {
      const detail = await clientService.getImportBatch(id);
      setBatchDetail(detail);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[Import] batch detail load failed', err);
    } finally {
      setBatchLoading(false);
    }
  }, [openBatchId]);

  const formatDateTime = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
    } catch { return iso; }
  };

  /* ─────────── Templates ─────────── */
  const openSheetsWithHeaders = async () => {
    // Tab-separated row → pasting in Sheets cell A1 fills A1..D1 across columns
    const headerRow = COLUMNS.map((c) => c.header).join('\t');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(headerRow);
        setHint('Encabezados copiados — pega en A1 de la nueva hoja con Ctrl+V');
        setTimeout(() => setHint(''), 4500);
      }
    } catch { /* clipboard blocked, just open the sheet */ }
    // Reliable shortcut that always creates a brand-new blank sheet
    window.open('https://sheets.new', '_blank', 'noopener,noreferrer');
  };

  const downloadCSV = () => {
    const headers = COLUMNS.map((c) => c.header).join(',');
    const sample = SAMPLE_ROWS.map((r) =>
      COLUMNS.map((c) => `"${(r[c.letter] || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const csv = `${headers}\n${sample}`;
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plantilla_clientes.csv';
    a.click();
  };

  /* ─────────── Failed-rows report download ─────────── */
  const downloadFailedReport = () => {
    if (!result || !result.rows) return;
    const failed = result.rows.filter((r) => r.status !== 'imported');
    if (failed.length === 0) return;

    const headers = ['Linea', 'Estado', 'Razon', 'Nombre', 'Telefono', 'Email', 'Cumpleanos', 'Cliente_existente'];
    const lines = failed.map((r) => {
      const estado = r.status === 'duplicate' ? 'Duplicado' : 'Error';
      const existing = r.existing_client_id ? `${r.existing_client_id} - ${r.existing_client_name || ''}` : '';
      return [
        r.line, estado, r.reason || '',
        r.name || '', r.phone || '', r.email || '', r.birthday || '', existing,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = `${headers.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'clientes_a_corregir.csv';
    a.click();
  };

  const isImporting = phase === 'uploading' || phase === 'processing';
  const isDone = phase === 'done';
  const backendTotal = result
    ? (Number(result.total) || (Number(result.imported || 0) + Number(result.skipped || 0) + (Array.isArray(result.errors) ? result.errors.length : 0)))
    : 0;
  const total = backendTotal || result?.rows?.length || preview?.lineCount || 0;
  const totalProcessed = counters.imported + counters.duplicate + counters.error;
  const allFailed = isDone && total > 0 && totalProcessed === 0;

  /* ─────────── Render ─────────── */
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Clientes" className="modal--full">
      <div className={`${b} ${isImporting || isDone ? `${b}--running` : ''}`}>
        {error && (
          <div className={`${b}__error`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {hint && (
          <div className={`${b}__hint`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {hint}
          </div>
        )}

        {/* Tabs (hidden during running phase) */}
        {!isImporting && !isDone && (
          <div className={`${b}__tabs`} role="tablist">
            <button
              type="button"
              className={`${b}__tab ${view === 'upload' ? `${b}__tab--active` : ''}`}
              onClick={() => setView('upload')}
              role="tab"
              aria-selected={view === 'upload'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Nueva importación
            </button>
            <button
              type="button"
              className={`${b}__tab ${view === 'history' ? `${b}__tab--active` : ''}`}
              onClick={() => setView('history')}
              role="tab"
              aria-selected={view === 'history'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Historial
              {history.length > 0 && <span className={`${b}__tab-count`}>{history.length}</span>}
            </button>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────
            PHASE: PRE-UPLOAD — 2-column layout
            ────────────────────────────────────────────────────── */}
        {phase === 'idle' && !result && view === 'upload' && (
          <div className={`${b}__layout`}>
            {/* LEFT: Guide */}
            <div className={`${b}__col ${b}__col--guide`}>
              <h3 className={`${b}__col-title`}>Cómo preparar tu archivo</h3>

              {/* Visual sheet */}
              <div className={`${b}__sheet`}>
                <div className={`${b}__sheet-corner`} />
                {COLUMNS.map((col) => (
                  <div key={`L-${col.letter}`} className={`${b}__sheet-col-letter`}>{col.letter}</div>
                ))}

                <div className={`${b}__sheet-row-num`}>1</div>
                {COLUMNS.map((col) => (
                  <div key={`H-${col.letter}`} className={`${b}__sheet-cell ${b}__sheet-cell--header`}>
                    {col.header}
                    {col.required && <span className={`${b}__req-dot`}>*</span>}
                  </div>
                ))}

                {SAMPLE_ROWS.map((row, ri) => (
                  <Fragment key={`row-${ri}`}>
                    <div className={`${b}__sheet-row-num`}>{ri + 2}</div>
                    {COLUMNS.map((col) => (
                      <div key={`R-${ri}-${col.letter}`} className={`${b}__sheet-cell`}>
                        {row[col.letter] || <span className={`${b}__sheet-empty`}>—</span>}
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>

              <p className={`${b}__sheet-caption`}>
                Fila <strong>1</strong> son los títulos. Tus clientes empiezan en la fila <strong>2</strong>. <span className={`${b}__req-dot`}>*</span> = obligatorio.
              </p>

              {/* Field details */}
              <div className={`${b}__fields`}>
                {COLUMNS.map((col) => (
                  <div key={col.letter} className={`${b}__field ${col.required ? `${b}__field--req` : ''}`}>
                    <div className={`${b}__field-head`}>
                      <span className={`${b}__field-letter`}>{col.letter}</span>
                      <span className={`${b}__field-name`}>{col.header}</span>
                      <span className={`${b}__field-tag ${col.required ? `${b}__field-tag--req` : `${b}__field-tag--opt`}`}>
                        {col.required ? 'OBLIG.' : 'Opc.'}
                      </span>
                    </div>
                    <p className={`${b}__field-format`}>{col.format}</p>
                    <p className={`${b}__field-example`}><code>{col.example}</code></p>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Upload + rules + actions */}
            <div className={`${b}__col ${b}__col--upload`}>
              <h3 className={`${b}__col-title`}>Sube tu archivo</h3>

              <div className={`${b}__templates`}>
                <button type="button" className={`${b}__template-btn`} onClick={downloadCSV}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Plantilla CSV
                </button>
                <button
                  type="button"
                  className={`${b}__template-btn ${b}__template-btn--ghost`}
                  onClick={openSheetsWithHeaders}
                  title="Abre una hoja nueva en blanco y copia los encabezados al portapapeles"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                  Abrir Sheets
                </button>
              </div>

              <div
                className={`${b}__dropzone ${file ? `${b}__dropzone--has-file` : ''}`}
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFile(e.target.files[0])} hidden />
                {file ? (
                  <div className={`${b}__file-info`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <div className={`${b}__file-text`}>
                      <span className={`${b}__file-name`}>{file.name}</span>
                      <span className={`${b}__file-size`}>
                        {(file.size / 1024).toFixed(1)} KB
                        {preview?.lineCount ? ` · ${preview.lineCount} filas` : ''}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`${b}__drop-text`}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p>Arrastra tu archivo aquí</p>
                    <span>CSV o Excel · o haz clic</span>
                  </div>
                )}
              </div>

              {preview && (
                <div className={`${b}__preview`}>
                  <p className={`${b}__preview-label`}>Vista previa</p>
                  <div className={`${b}__preview-table-wrap`}>
                    <table className={`${b}__preview-table`}>
                      <thead><tr>{preview.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                      <tbody>
                        {preview.rows.map((row, ri) => (
                          <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell || '—'}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className={`${b}__rules`}>
                <p className={`${b}__rules-title`}>Reglas</p>
                <ul className={`${b}__rules-list`}>
                  <li>Teléfono <strong>duplicado</strong> → se salta, no se duplica.</li>
                  <li>Sin nombre o sin teléfono → fila rechazada.</li>
                  <li>Cumpleaños mal formateado → se ignora ese campo.</li>
                  <li><strong>Etiquetas</strong> (VIP, Activo…) las asigna el sistema, no las incluyas.</li>
                  <li>Hasta 5.000 clientes por archivo.</li>
                </ul>
              </div>

              <div className={`${b}__actions`}>
                <Button variant="ghost" size="md" onClick={handleClose}>Cancelar</Button>
                <Button variant="primary" size="md" onClick={handleImport} disabled={!file}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Importar {file && preview?.lineCount ? `${preview.lineCount} clientes` : 'clientes'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────
            VIEW: HISTORY
            ────────────────────────────────────────────────────── */}
        {phase === 'idle' && !result && view === 'history' && (
          <div className={`${b}__history`}>
            {historyLoading ? (
              <div className={`${b}__history-loading`}>Cargando historial...</div>
            ) : history.length === 0 ? (
              <div className={`${b}__history-empty`}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <p>Aún no has hecho importaciones masivas.</p>
                <span>Cuando importes tu primer archivo, aparecerá aquí.</span>
              </div>
            ) : (
              <ul className={`${b}__history-list`}>
                {history.map((batch) => (
                  <li key={batch.id} className={`${b}__history-item`}>
                    <button
                      type="button"
                      className={`${b}__history-row`}
                      onClick={() => toggleBatch(batch.id)}
                      aria-expanded={openBatchId === batch.id}
                    >
                      <div className={`${b}__history-icon`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                      <div className={`${b}__history-meta`}>
                        <div className={`${b}__history-row1`}>
                          <span className={`${b}__history-filename`}>{batch.filename || `Importación #${batch.id}`}</span>
                          <span className={`${b}__history-date`}>{formatDateTime(batch.created_at)}</span>
                        </div>
                        <div className={`${b}__history-row2`}>
                          <span className={`${b}__history-by`}>por {batch.admin_name || 'Sistema'}</span>
                          <div className={`${b}__history-stats`}>
                            <span className={`${b}__history-stat ${b}__history-stat--ok`}>✓ {batch.imported_count}</span>
                            {batch.skipped_count > 0 && <span className={`${b}__history-stat ${b}__history-stat--dup`}>⊘ {batch.skipped_count}</span>}
                            {batch.error_count > 0 && <span className={`${b}__history-stat ${b}__history-stat--err`}>✗ {batch.error_count}</span>}
                            <span className={`${b}__history-stat ${b}__history-stat--total`}>de {batch.total_rows}</span>
                          </div>
                        </div>
                      </div>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        style={{ transform: openBatchId === batch.id ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {openBatchId === batch.id && (
                      <div className={`${b}__history-detail`}>
                        {batchLoading ? (
                          <p className={`${b}__history-loading`}>Cargando clientes...</p>
                        ) : batchDetail ? (
                          <>
                            <p className={`${b}__history-detail-title`}>
                              {batchDetail.clients?.length || 0} clientes importados en esta tanda
                            </p>
                            {batchDetail.clients?.length > 0 ? (
                              <div className={`${b}__history-clients`}>
                                {batchDetail.clients.map((c) => (
                                  <div key={c.id} className={`${b}__history-client`}>
                                    <span className={`${b}__history-client-id`}>{c.client_id}</span>
                                    <span className={`${b}__history-client-name`}>{c.name}</span>
                                    <span className={`${b}__history-client-phone`}>{c.phone}</span>
                                    {!c.is_active && <span className={`${b}__history-client-tag`}>Inactivo</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className={`${b}__history-loading`}>Sin clientes en este lote.</p>
                            )}

                            {batchDetail.error_log?.length > 0 && (
                              <details className={`${b}__history-errors`}>
                                <summary>Ver registros de filas que no se importaron ({batchDetail.error_log.length})</summary>
                                <ul>
                                  {batchDetail.error_log.map((msg, i) => (
                                    <li key={i}>{msg}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </>
                        ) : (
                          <p className={`${b}__history-loading`}>No se pudo cargar el detalle.</p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────
            PHASE: UPLOADING / PROCESSING / DONE — Console view
            ────────────────────────────────────────────────────── */}
        {(isImporting || isDone) && (
          <div className={`${b}__runner`}>
            {/* Live counters */}
            <div className={`${b}__counters`}>
              <div className={`${b}__counter ${b}__counter--success`}>
                <span className={`${b}__counter-icon`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div>
                  <span className={`${b}__counter-value`}>{counters.imported}</span>
                  <span className={`${b}__counter-label`}>Importados</span>
                </div>
              </div>
              <div className={`${b}__counter ${b}__counter--warning`}>
                <span className={`${b}__counter-icon`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </span>
                <div>
                  <span className={`${b}__counter-value`}>{counters.duplicate}</span>
                  <span className={`${b}__counter-label`}>Duplicados</span>
                </div>
              </div>
              <div className={`${b}__counter ${b}__counter--danger`}>
                <span className={`${b}__counter-icon`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </span>
                <div>
                  <span className={`${b}__counter-value`}>{counters.error}</span>
                  <span className={`${b}__counter-label`}>Errores</span>
                </div>
              </div>
              <div className={`${b}__counter ${b}__counter--total`}>
                <div>
                  <span className={`${b}__counter-value`}>
                    {progressIdx} <span className={`${b}__counter-of`}>/ {total}</span>
                  </span>
                  <span className={`${b}__counter-label`}>{isDone ? 'Procesados' : 'Procesando...'}</span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className={`${b}__progress-track`}>
              <div
                className={`${b}__progress-bar-anim`}
                style={{ width: `${total ? (progressIdx / total) * 100 : 0}%` }}
              />
            </div>

            {/* Console log */}
            <div className={`${b}__console`} ref={consoleRef}>
              {phase === 'uploading' && (
                <div className={`${b}__console-line ${b}__console-line--meta`}>
                  <span className={`${b}__console-prefix`}>[ ··· ]</span>
                  <span>Subiendo archivo al servidor...</span>
                </div>
              )}
              {shownRows.map((r, idx) => {
                const cls = r.status === 'imported'
                  ? `${b}__console-line--ok`
                  : r.status === 'duplicate'
                  ? `${b}__console-line--dup`
                  : `${b}__console-line--err`;
                const symbol = r.status === 'imported' ? '✓' : r.status === 'duplicate' ? '⊘' : '✗';
                let detail = '';
                if (r.status === 'imported') {
                  detail = `${r.name} · ${r.phone} → añadido${r.client_id ? ` (${r.client_id})` : ''}`;
                } else if (r.status === 'duplicate') {
                  const ref = r.existing_client_id ? `${r.existing_client_id}${r.existing_client_name ? ` (${r.existing_client_name})` : ''}` : '';
                  detail = `${r.name || ''} · ${r.phone || ''} → duplicado de ${ref}`;
                } else {
                  detail = `${r.name || '(sin nombre)'} · ${r.phone || '(sin teléfono)'} → ${r.reason || 'error'}`;
                }
                return (
                  <div key={`${r.line}-${idx}`} className={`${b}__console-line ${cls}`}>
                    <span className={`${b}__console-prefix`}>[{String(r.line).padStart(4, '0')}]</span>
                    <span className={`${b}__console-symbol`}>{symbol}</span>
                    <span className={`${b}__console-detail`}>{detail}</span>
                  </div>
                );
              })}
              {isDone && (
                <div className={`${b}__console-line ${b}__console-line--meta`}>
                  <span className={`${b}__console-prefix`}>[ ✓✓ ]</span>
                  <span>Proceso completado · {counters.imported} importados, {counters.duplicate} duplicados, {counters.error} errores.</span>
                </div>
              )}
            </div>

            {/* Done actions */}
            {isDone && (
              <div className={`${b}__done-actions`}>
                {allFailed ? (
                  <div className={`${b}__report-card ${b}__report-card--err`}>
                    <div className={`${b}__report-text`}>
                      <strong>No se importó ningún cliente.</strong>
                      <span>Posibles causas: el archivo está vacío, los encabezados no coinciden ("Nombre" y "Telefono"), o el backend aún no fue actualizado. Revisa la consola del navegador para más detalle.</span>
                    </div>
                  </div>
                ) : (counters.duplicate + counters.error) > 0 ? (
                  <div className={`${b}__report-card`}>
                    <div className={`${b}__report-text`}>
                      <strong>{counters.duplicate + counters.error} filas necesitan tu atención.</strong>
                      <span>Descarga el reporte para ver cuáles fallaron y por qué. Los duplicados muestran el cliente original.</span>
                    </div>
                    <button type="button" className={`${b}__template-btn`} onClick={downloadFailedReport}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Descargar reporte
                    </button>
                  </div>
                ) : counters.imported > 0 ? (
                  <div className={`${b}__report-card ${b}__report-card--ok`}>
                    <strong>¡{counters.imported} {counters.imported === 1 ? 'cliente importado' : 'clientes importados'} correctamente!</strong>
                  </div>
                ) : null}
                <div className={`${b}__actions`}>
                  <Button variant="ghost" size="md" onClick={() => { reset(); }}>Importar otro archivo</Button>
                  <Button variant="primary" size="md" onClick={handleClose}>Cerrar</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ImportClientsModal;
