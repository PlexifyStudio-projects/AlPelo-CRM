import { useEffect, useRef, useState } from 'react';
import campaignService from '../../services/campaignService';
import { useNotification } from '../../context/NotificationContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

/**
 * Campaigns view for WhatsApp Web (Baileys) mode.
 *
 * Free-text only — no templates, no Meta approval. The dueño writes whatever
 * he wants and the system sends with random pacing to avoid getting banned.
 * Used when tenant.wa_mode = 'web'.
 *
 * Status semantics:
 *   sending             → background worker is currently iterating audience
 *   sent                → finished, all msgs delivered or failed
 *   paused_quota        → hit daily limit, will be retried after midnight or by raising cap
 *   paused_disconnected → WA Web session dropped mid-campaign, reconnect to resume
 *   draft / failed      → never sent / fatal error
 */
export default function WebCampaignsView({ b, waStatus, onRefreshStatus }) {
  const { addNotification: notify } = useNotification();

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [filterDays, setFilterDays] = useState(0); // 0 = all clients
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const pollRef = useRef(null);

  const dailyLimit = waStatus?.daily_limit || 20;
  const sentToday = waStatus?.sent_today || 0;
  const remainingToday = Math.max(0, dailyLimit - sentToday);
  const connected = waStatus?.db_status === 'connected';

  // ----- Load campaigns -----
  const fetchCampaigns = async () => {
    try {
      const data = await campaignService.list();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[WebCampaigns] list failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Poll while a campaign is sending so progress updates live
  useEffect(() => {
    const hasSending = campaigns.some((c) => c.status === 'sending');
    if (hasSending) {
      pollRef.current = setInterval(() => {
        fetchCampaigns();
        if (typeof onRefreshStatus === 'function') onRefreshStatus();
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [campaigns]);

  // ----- Audience preview -----
  const refreshPreview = async (days) => {
    setPreviewLoading(true);
    try {
      const filters = days > 0 ? { last_visit_days: days } : {};
      const res = await fetch(`${API_URL}/campaigns/audience/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_filters: filters }),
      });
      if (res.ok) {
        const data = await res.json();
        setAudiencePreview(data);
      }
    } catch (e) {
      console.error('[WebCampaigns] preview failed', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (showModal) refreshPreview(filterDays);
  }, [filterDays, showModal]);

  const openModal = () => {
    setName('');
    setBody('');
    setFilterDays(0);
    setAudiencePreview(null);
    setShowModal(true);
  };

  // ----- Send -----
  const handleSend = async () => {
    if (!body.trim()) {
      notify({ type: 'error', message: 'Escribe el mensaje antes de enviar' });
      return;
    }
    if (!connected) {
      notify({ type: 'error', message: 'WhatsApp Web no está conectado' });
      return;
    }
    if (!audiencePreview || (audiencePreview.count || 0) === 0) {
      notify({ type: 'error', message: 'No hay audiencia que coincida con los filtros' });
      return;
    }

    setSubmitting(true);
    try {
      const filters = filterDays > 0 ? { last_visit_days: filterDays } : {};
      const camp = await campaignService.create({
        name: name.trim() || `Campaña Web — ${new Date().toLocaleString('es-CO')}`,
        campaign_type: 'web_free_text',
        message_body: body,
        segment_filters: filters,
      });
      // Trigger send (background task — returns immediately)
      const res = await fetch(`${API_URL}/campaigns/${camp.id}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo iniciar la campaña');
      }
      const data = await res.json();
      notify({ type: 'success', message: `Campaña en envío: ${data.audience_count} contactos` });
      setShowModal(false);
      await fetchCampaigns();
    } catch (e) {
      notify({ type: 'error', message: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const statusPill = (s) => {
    const map = {
      sending:               { label: 'Enviando', color: '#1E40AF', bg: 'rgba(30,64,175,0.10)' },
      sent:                  { label: 'Completada', color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
      paused_quota:          { label: 'Pausada — limite diario', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
      paused_disconnected:   { label: 'Pausada — desconectado', color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
      failed:                { label: 'Fallida', color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
      draft:                 { label: 'Borrador', color: '#64748B', bg: 'rgba(100,116,139,0.10)' },
    };
    const v = map[s] || map.draft;
    return <span className={`${b}__webcamp-pill`} style={{ color: v.color, background: v.bg }}>{v.label}</span>;
  };

  return (
    <div className={`${b}__webcamp`}>
      <div className={`${b}__webcamp-header`}>
        <div>
          <h2 className={`${b}__webcamp-title`}>Campañas (Modo Web)</h2>
          <p className={`${b}__webcamp-sub`}>
            Sin plantillas. Texto libre. Pacing automático para proteger tu número.
          </p>
        </div>
        <button
          className={`${b}__webcamp-btn ${b}__webcamp-btn--primary`}
          onClick={openModal}
          disabled={!connected}
        >
          + Nueva campaña
        </button>
      </div>

      {/* Status banner */}
      {!connected ? (
        <div className={`${b}__webcamp-warning`}>
          WhatsApp Web no está conectado. Vaya a Configuración &rarr; Numero personal (Web) y escanee el QR.
        </div>
      ) : (
        <div className={`${b}__webcamp-quota`}>
          <div className={`${b}__webcamp-quota-row`}>
            <span><strong>Disponibles hoy:</strong> {remainingToday} de {dailyLimit}</span>
            <span><strong>Pacing:</strong> {(waStatus?.pacing_seconds || [30, 90])[0]}-{(waStatus?.pacing_seconds || [30, 90])[1]}s entre mensajes</span>
          </div>
          <div className={`${b}__webcamp-quota-bar`}>
            <div
              className={`${b}__webcamp-quota-bar-fill`}
              style={{ width: `${Math.min(100, (sentToday / Math.max(1, dailyLimit)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <div className={`${b}__webcamp-empty`}>Cargando...</div>
      ) : campaigns.length === 0 ? (
        <div className={`${b}__webcamp-empty`}>
          Aún no hay campañas. Cree la primera con el botón de arriba.
        </div>
      ) : (
        <div className={`${b}__webcamp-list`}>
          {campaigns.map((c) => {
            const total = c.audience_count || 0;
            const sent = c.sent_count || 0;
            const failed = c.failed_count || 0;
            const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
            return (
              <div key={c.id} className={`${b}__webcamp-card`}>
                <div className={`${b}__webcamp-card-header`}>
                  <div className={`${b}__webcamp-card-title`}>{c.name || 'Sin nombre'}</div>
                  {statusPill(c.status)}
                </div>
                {c.message_body && (
                  <div className={`${b}__webcamp-card-body`}>{c.message_body.slice(0, 180)}{c.message_body.length > 180 ? '…' : ''}</div>
                )}
                <div className={`${b}__webcamp-card-stats`}>
                  <span>Audiencia: <strong>{total}</strong></span>
                  <span>Enviados: <strong>{sent}</strong></span>
                  {failed > 0 && <span>Fallidos: <strong style={{ color: '#DC2626' }}>{failed}</strong></span>}
                  {c.status === 'sending' && <span className={`${b}__webcamp-card-stats-pct`}>{pct}%</span>}
                </div>
                {c.status === 'sending' && (
                  <div className={`${b}__webcamp-progress`}>
                    <div className={`${b}__webcamp-progress-fill`} style={{ width: `${pct}%` }} />
                  </div>
                )}
                {c.created_at && (
                  <div className={`${b}__webcamp-card-date`}>
                    {new Date(c.created_at).toLocaleString('es-CO')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New campaign modal */}
      {showModal && (
        <div className={`${b}__webcamp-modal-backdrop`} onClick={() => !submitting && setShowModal(false)}>
          <div className={`${b}__webcamp-modal`} onClick={(e) => e.stopPropagation()}>
            <div className={`${b}__webcamp-modal-header`}>
              <h3>Nueva campaña</h3>
              <button className={`${b}__webcamp-modal-close`} onClick={() => setShowModal(false)} disabled={submitting}>×</button>
            </div>
            <div className={`${b}__webcamp-modal-body`}>
              <label className={`${b}__webcamp-field`}>
                <span>Nombre interno (opcional)</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Promo del fin de mes"
                />
              </label>

              <label className={`${b}__webcamp-field`}>
                <span>Mensaje</span>
                <textarea
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Hola {{nombre}}, te escribo para...\n\nVariables disponibles: {{nombre}}, {{negocio}}, {{servicio}}`}
                />
                <span className={`${b}__webcamp-field-hint`}>
                  Las variables se reemplazan por cliente al enviar.
                </span>
              </label>

              <label className={`${b}__webcamp-field`}>
                <span>Audiencia</span>
                <select value={filterDays} onChange={(e) => setFilterDays(parseInt(e.target.value, 10))}>
                  <option value={0}>Todos los clientes</option>
                  <option value={7}>Vinieron hace 1 semana o más</option>
                  <option value={30}>Vinieron hace 30 días o más</option>
                  <option value={60}>Vinieron hace 60 días o más</option>
                  <option value={90}>Vinieron hace 90 días o más</option>
                </select>
              </label>

              <div className={`${b}__webcamp-preview`}>
                {previewLoading ? (
                  <span>Calculando audiencia...</span>
                ) : audiencePreview ? (
                  <>
                    <strong>{audiencePreview.count || 0}</strong> contactos coinciden.
                    {(audiencePreview.count || 0) > remainingToday && (
                      <div className={`${b}__webcamp-preview-warning`}>
                        ⚠ Hoy solo puedes enviar {remainingToday}. La campaña pausará al límite y reanudará cuando aumente la cuota.
                      </div>
                    )}
                    {(audiencePreview.count || 0) > 0 && (
                      <div className={`${b}__webcamp-preview-eta`}>
                        Tiempo estimado: ~{Math.ceil(((audiencePreview.count || 0) * 60) / 60)} min con pacing 30-90s
                      </div>
                    )}
                  </>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
            <div className={`${b}__webcamp-modal-footer`}>
              <button
                className={`${b}__webcamp-btn ${b}__webcamp-btn--ghost`}
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                className={`${b}__webcamp-btn ${b}__webcamp-btn--primary`}
                onClick={handleSend}
                disabled={submitting || !connected || !body.trim() || (audiencePreview?.count || 0) === 0}
              >
                {submitting ? 'Iniciando...' : `Enviar a ${audiencePreview?.count || 0}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
