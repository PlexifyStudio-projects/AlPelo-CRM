import { useState, useRef } from 'react';
import Modal from '../../common/Modal/Modal';
import Button from '../../common/Button/Button';
import financeService from '../../../services/financeService';

const ImportClientsModal = ({ isOpen, onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const b = 'import-modal';

  const reset = () => {
    setFile(null);
    setPreview(null);
    setImporting(false);
    setProgress(0);
    setResult(null);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Solo se aceptan archivos CSV o Excel (.xlsx)');
      return;
    }
    setFile(f);
    setError('');
    setResult(null);

    // Preview CSV
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter((l) => l.trim());
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1, 6).map((line) =>
          line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        );
        setPreview({ headers, rows });
      };
      reader.readAsText(f);
    } else {
      setPreview(null); // Excel preview not supported client-side
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setProgress(10);
    setError('');

    // Animate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 15, 85));
    }, 300);

    try {
      const res = await financeService.importClients(file);
      clearInterval(progressInterval);
      setProgress(100);
      setResult(res);
      if (res.imported > 0 && onImported) onImported();
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message);
      setProgress(0);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Clientes" className="modal--md">
      <div className={b}>
        {error && (
          <div className={`${b}__error`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`${b}__result`}>
            <div className={`${b}__result-icon`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className={`${b}__result-stats`}>
              <div className={`${b}__stat ${b}__stat--success`}>
                <span className={`${b}__stat-value`}>{result.imported}</span>
                <span className={`${b}__stat-label`}>Importados</span>
              </div>
              <div className={`${b}__stat ${b}__stat--warning`}>
                <span className={`${b}__stat-value`}>{result.skipped}</span>
                <span className={`${b}__stat-label`}>Duplicados</span>
              </div>
              <div className={`${b}__stat ${b}__stat--danger`}>
                <span className={`${b}__stat-value`}>{result.errors.length}</span>
                <span className={`${b}__stat-label`}>Errores</span>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className={`${b}__error-list`}>
                {result.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className={`${b}__error-item`}>{err}</p>
                ))}
              </div>
            )}
            <Button variant="primary" size="md" onClick={handleClose}>Cerrar</Button>
          </div>
        )}

        {/* Dropzone + Preview */}
        {!result && (
          <>
            <div
              className={`${b}__dropzone ${file ? `${b}__dropzone--has-file` : ''}`}
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => handleFile(e.target.files[0])}
                hidden
              />
              {file ? (
                <div className={`${b}__file-info`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className={`${b}__file-name`}>{file.name}</span>
                  <span className={`${b}__file-size`}>{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <div className={`${b}__drop-text`}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p>Arrastra un archivo CSV o Excel aqui</p>
                  <span>o haz clic para seleccionar</span>
                </div>
              )}
            </div>

            {/* Preview */}
            {preview && (
              <div className={`${b}__preview`}>
                <p className={`${b}__preview-label`}>Vista previa (primeras filas)</p>
                <div className={`${b}__preview-table-wrap`}>
                  <table className={`${b}__preview-table`}>
                    <thead>
                      <tr>{preview.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, ri) => (
                        <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Progress */}
            {importing && (
              <div className={`${b}__progress`}>
                <div className={`${b}__progress-bar`}>
                  <div className={`${b}__progress-fill`} style={{ width: `${progress}%` }} />
                </div>
                <span className={`${b}__progress-text`}>Importando... {Math.round(progress)}%</span>
              </div>
            )}

            {/* Actions */}
            <div className={`${b}__actions`}>
              <Button variant="ghost" size="md" onClick={handleClose}>Cancelar</Button>
              <Button variant="primary" size="md" onClick={handleImport} disabled={!file || importing}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {importing ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ImportClientsModal;
