import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import aiService from '../../services/aiService';
import settingsService from '../../services/settingsService';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

// Model is managed by Plexify (dev), not by the agency admin

const DEFAULT_PROMPT = `=== DATOS DEL NEGOCIO ===
Nombre:
Ubicacion:
Tipo:

=== HORARIO ===
Lunes a Viernes: 9:00am - 7:00pm
Sabado: 9:00am - 5:00pm
Domingo: CERRADO
Fuera de horario: Lina responde preguntas y agenda citas, pero informa el horario si preguntan.

=== ESTILO DE COMUNICACION ===
Tono: Calido y cercano
Tutea o trata de usted: Tutea
Largo de mensajes: Maximo 2-3 lineas por mensaje.
Emojis: 1 emoji si aporta
Expresiones tipicas:

=== POLITICAS ===
Pagos:
Cancelaciones:
Reservas:

=== NOTAS ADICIONALES ===
`;

const Settings = () => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();

  const [aiConfig, setAiConfig] = useState(null);
  const [businessContext, setBusinessContext] = useState(DEFAULT_PROMPT);
  const [aiSaving, setAiSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadAiConfig();
  }, []);

  const loadAiConfig = async () => {
    try {
      const config = await aiService.getConfig();
      setAiConfig(config);
      setBusinessContext(config.system_prompt || DEFAULT_PROMPT);
    } catch {
      // No config yet
    }
  };

  const handleTestAI = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const start = Date.now();
      const result = await aiService.chat('Responde SOLO con "OK, funcionando correctamente" y nada mas.', []);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      setTestResult({ ok: true, msg: `${result.response} (${elapsed}s, ${result.tokens_used} tokens)` });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAiConfig = useCallback(async () => {
    setAiSaving(true);
    try {
      const data = {
        name: 'Lina IA',
        system_prompt: businessContext,
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        temperature: 0.4,
        max_tokens: 2048,
      };

      let result;
      if (aiConfig?.id) {
        result = await aiService.updateConfig(aiConfig.id, data);
      } else {
        result = await aiService.saveConfig(data);
      }
      setAiConfig(result);
      addNotification('Configuracion de Lina guardada', 'success');
    } catch (err) {
      addNotification(`Error al guardar: ${err.message}`, 'error');
    } finally {
      setAiSaving(false);
    }
  }, [businessContext, aiConfig, addNotification]);

  const [notifPrefs, setNotifPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('plexify_notif_prefs') || '{}'); } catch { return {}; }
  });

  const handleToggle = (key) => {
    setNotifPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('plexify_notif_prefs', JSON.stringify(updated));
      return updated;
    });
  };

  // Meta token management
  const [metaToken, setMetaToken] = useState('');
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaBizId, setMetaBizId] = useState('');
  const [metaStatus, setMetaStatus] = useState(null);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaChecking, setMetaChecking] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [metaTemplates, setMetaTemplates] = useState(null);
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (tenant?.wa_access_token) setMetaToken(tenant.wa_access_token);
    if (tenant?.wa_phone_number_id) setMetaPhoneId(tenant.wa_phone_number_id);
    if (tenant?.wa_business_account_id) setMetaBizId(tenant.wa_business_account_id);
  }, [tenant]);

  useEffect(() => {
    settingsService.getMetaTokenStatus().then(setMetaStatus).catch(() => {});
  }, []);

  // OAuth popup flow — uses postMessage from callback page (works cross-origin)
  const handleFacebookLogin = async () => {
    setOauthLoading(true);
    try {
      const { url } = await settingsService.getMetaAuthUrl();

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        url,
        'fb_oauth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );
      popupRef.current = popup;

      // Listen for postMessage from the callback page
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'META_OAUTH_CODE' && event.data.code) {
          window.removeEventListener('message', messageHandler);
          clearInterval(pollRef.current);
          handleExchangeToken(event.data.code);
        }
      };
      window.addEventListener('message', messageHandler);

      // Fallback: detect if popup was closed without completing
      pollRef.current = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(pollRef.current);
          window.removeEventListener('message', messageHandler);
          setOauthLoading(false);
        }
      }, 1000);
    } catch (err) {
      setOauthLoading(false);
      addNotification(err.message, 'error');
    }
  };

  const handleExchangeToken = async (code) => {
    try {
      const result = await settingsService.exchangeMetaToken(code);
      if (result.success) {
        setMetaStatus({
          connected: true,
          phone_display: result.phone_display,
          phone_number_id: result.phone_number_id,
          business_account_id: result.business_account_id,
          expires_at: result.expires_at,
          days_until_expiry: result.expires_in ? Math.floor(result.expires_in / 86400) : null,
        });
        if (result.phone_number_id) setMetaPhoneId(result.phone_number_id);
        if (result.business_account_id) setMetaBizId(result.business_account_id);
        addNotification('Conectado con Facebook exitosamente', 'success');
        loadMetaTemplates();
      }
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setOauthLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const result = await settingsService.refreshMetaToken();
      if (result.success) {
        setMetaStatus(prev => ({
          ...prev,
          expires_at: result.expires_at,
          days_until_expiry: result.expires_in ? Math.floor(result.expires_in / 86400) : null,
        }));
        addNotification('Token renovado exitosamente', 'success');
      }
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Loyalty Program state
  const [loyaltyConfig, setLoyaltyConfig] = useState({
    is_active: false,
    points_per_currency: 1,
    currency_unit: 10000,
    tier_bronze_min: 100,
    tier_silver_min: 500,
    tier_gold_min: 1000,
    tier_vip_min: 2500,
    referral_bonus_referrer: 50,
    referral_bonus_referred: 50,
    birthday_bonus: 100,
    redemption_rate: 100,
  });
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  // WhatsApp Business Profile state
  const [waProfile, setWaProfile] = useState(null);
  const [waAbout, setWaAbout] = useState('');
  const [waDescription, setWaDescription] = useState('');
  const [waAddress, setWaAddress] = useState('');
  const [waEmail, setWaEmail] = useState('');
  const [waWebsite, setWaWebsite] = useState('');
  const [waPhotoFile, setWaPhotoFile] = useState(null);
  const [waPhotoPreview, setWaPhotoPreview] = useState('');
  const [waProfileSaving, setWaProfileSaving] = useState(false);
  const [waPhotoSaving, setWaPhotoSaving] = useState(false);
  const [waProfileLoaded, setWaProfileLoaded] = useState(false);
  const waPhotoInputRef = useRef(null);

  // Google Reviews state
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [googleSaving, setGoogleSaving] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await settingsService.disconnectMeta();
      setMetaStatus({ connected: false });
      setMetaToken('');
      setMetaPhoneId('');
      setMetaBizId('');
      setMetaTemplates(null);
      setShowDisconnectModal(false);
      addNotification('Cuenta de Meta desconectada', 'info');
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  // Cleanup popup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
  }, []);

  const handleSaveToken = async () => {
    if (!metaToken.trim()) return;
    setMetaSaving(true);
    try {
      const result = await settingsService.updateMetaToken({
        wa_access_token: metaToken.trim(),
        wa_phone_number_id: metaPhoneId.trim(),
        wa_business_account_id: metaBizId.trim(),
      });
      setMetaStatus({ connected: result.verified, phone_display: result.phone_display });
      addNotification(result.message, result.verified ? 'success' : 'warning');
      loadMetaTemplates();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setMetaSaving(false);
    }
  };

  const handleCheckStatus = async () => {
    setMetaChecking(true);
    try {
      const status = await settingsService.getMetaTokenStatus();
      setMetaStatus(status);
      addNotification(status.connected ? 'Token valido — conexion activa' : `Token invalido: ${status.message}`, status.connected ? 'success' : 'error');
    } catch {
      addNotification('Error al verificar token', 'error');
    } finally {
      setMetaChecking(false);
    }
  };

  const loadMetaTemplates = async () => {
    try {
      const data = await settingsService.getMetaTemplates();
      setMetaTemplates(data);
    } catch { /* silent */ }
  };

  useEffect(() => { loadMetaTemplates(); }, []);

  // Load WhatsApp Business Profile
  const loadWaProfile = useCallback(async () => {
    try {
      const { profile } = await settingsService.getWhatsAppProfile();
      if (profile) {
        setWaProfile(profile);
        setWaAbout(profile.about || '');
        setWaDescription(profile.description || '');
        setWaAddress(profile.address || '');
        setWaEmail(profile.email || '');
        setWaWebsite(profile.websites?.[0] || '');
        setWaPhotoUrl(profile.profile_picture_url || '');
      }
      setWaProfileLoaded(true);
    } catch { setWaProfileLoaded(true); }
  }, []);

  useEffect(() => { loadWaProfile(); }, [loadWaProfile]);

  const handleSaveWaProfile = async () => {
    setWaProfileSaving(true);
    try {
      const payload = { about: waAbout.trim(), description: waDescription.trim() };
      if (waAddress.trim()) payload.address = waAddress.trim();
      if (waEmail.trim()) payload.email = waEmail.trim();
      if (waWebsite.trim()) payload.websites = [waWebsite.trim()];
      await settingsService.updateWhatsAppProfile(payload);
      addNotification('Perfil de WhatsApp actualizado en Meta', 'success');
      loadWaProfile();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setWaProfileSaving(false);
    }
  };

  const handleWaPhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addNotification('Solo se permiten imagenes (JPEG, PNG)', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addNotification('La imagen no puede superar 5MB', 'error');
      return;
    }
    setWaPhotoFile(file);
    setWaPhotoPreview(URL.createObjectURL(file));
  };

  const handleSaveWaPhoto = async () => {
    if (!waPhotoFile) return;
    setWaPhotoSaving(true);
    try {
      await settingsService.updateWhatsAppProfilePhoto(waPhotoFile);
      addNotification('Foto de perfil actualizada en WhatsApp', 'success');
      setWaPhotoFile(null);
      setWaPhotoPreview('');
      loadWaProfile();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setWaPhotoSaving(false);
    }
  };

  const maskToken = (t) => t ? `${t.slice(0, 12)}...${t.slice(-8)}` : '';

  const formatExpiryDate = (isoString) => {
    if (!isoString) return null;
    try {
      return new Date(isoString).toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return null; }
  };

  const isTokenExpiringSoon = metaStatus?.days_until_expiry != null && metaStatus.days_until_expiry <= 7;

  // Load loyalty config on mount
  useEffect(() => {
    const loadLoyaltyConfig = async () => {
      try {
        const res = await fetch(`${API_URL}/loyalty/config`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setLoyaltyConfig(prev => ({ ...prev, ...data }));
        }
      } catch { /* no config yet */ }
    };
    loadLoyaltyConfig();
  }, []);

  // Load Google Review URL from tenant data
  useEffect(() => {
    if (tenant?.google_review_url) {
      setGoogleReviewUrl(tenant.google_review_url);
    }
  }, [tenant]);

  const handleSaveLoyalty = async () => {
    setLoyaltySaving(true);
    try {
      const res = await fetch(`${API_URL}/loyalty/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loyaltyConfig),
      });
      if (!res.ok) throw new Error('Error al guardar');
      addNotification('Programa de lealtad actualizado', 'success');
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setLoyaltySaving(false);
    }
  };

  const handleLoyaltyChange = (field, value) => {
    setLoyaltyConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveGoogleReview = async () => {
    setGoogleSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings/google-review-url`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: googleReviewUrl }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      addNotification('URL de Google Reviews guardada', 'success');
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setGoogleSaving(false);
    }
  };

  const b = 'settings';
  const [openSection, setOpenSection] = useState(null);
  const toggleSection = (id) => setOpenSection(prev => prev === id ? null : id);

  const sections = [
    { id: 'lina', icon: 'lina', title: 'Lina IA', desc: 'Prompt, contexto del negocio y pruebas de la asistente', color: '#7C3AED' },
    { id: 'notif', icon: 'bell', title: 'Notificaciones', desc: 'Alertas de citas, mensajeria y sonidos', color: '#3B82F6' },
    { id: 'meta', icon: 'meta', title: 'Meta / WhatsApp', desc: 'Conexion, token, perfil y plantillas de WhatsApp Business', color: '#1877F2' },
    { id: 'loyalty', icon: 'star', title: 'Programa de Lealtad', desc: 'Creditos, niveles, referidos y bonificaciones', color: '#10B981' },
    { id: 'google', icon: 'google', title: 'Google Reviews', desc: 'Redirige clientes satisfechos a dejar resenas', color: '#F59E0B' },
  ];

  const SectionIcon = ({ type, color }) => {
    const icons = {
      lina: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 3-3.87"/><circle cx="12" cy="17" r="1"/><path d="M9 17h6"/></svg>,
      bell: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
      meta: <svg width="24" height="24" viewBox="0 0 24 24" fill={color}><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/></svg>,
      star: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
      google: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
    };
    return icons[type] || null;
  };

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h2 className={`${b}__title`}>Configuracion</h2>
        <p className={`${b}__subtitle`}>Personaliza tu negocio y sus integraciones</p>
      </div>

      {/* ═══ SECTION CARDS GRID ═══ */}
      <div className={`${b}__grid`}>
        {sections.map(s => (
          <button
            key={s.id}
            className={`${b}__section-card ${openSection === s.id ? `${b}__section-card--active` : ''}`}
            onClick={() => toggleSection(s.id)}
            style={{ '--accent': s.color }}
          >
            <div className={`${b}__section-icon`}>
              <SectionIcon type={s.icon} color={s.color} />
            </div>
            <h3 className={`${b}__section-title`}>{s.title}</h3>
            <p className={`${b}__section-desc`}>{s.desc}</p>
            {s.id === 'meta' && metaStatus?.connected && (
              <span className={`${b}__section-badge`}>Conectado</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ EXPANDED CONTENT ═══ */}
      {openSection && (
        <div className={`${b}__panel`} key={openSection}>

          {/* ========== LINA IA CONFIG ========== */}
          {openSection === 'lina' && (
            <div className={`${b}__panel-content`}>
          <div className={`${b}__ai-field`}>
            <label className={`${b}__ai-label`}>
              Instrucciones del negocio
              <span className={`${b}__ai-label-hint`}>
                Completa cada linea con la informacion de tu negocio. Lina ya sabe operar (agendar, responder, cobrar) — tu solo defines el contexto.
              </span>
            </label>
            <textarea
              className={`${b}__ai-textarea`}
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              rows={14}
            />
            <span className={`${b}__ai-char-count`}>
              {businessContext.length} caracteres
            </span>
          </div>

          <div className={`${b}__ai-actions`}>
            <button
              className={`${b}__ai-save`}
              onClick={handleSaveAiConfig}
              disabled={aiSaving || !businessContext.trim()}
            >
              {aiSaving ? 'Guardando...' : aiConfig?.id ? 'Actualizar configuracion' : 'Guardar configuracion'}
            </button>
            <button
              className={`${b}__ai-test`}
              onClick={handleTestAI}
              disabled={testing}
            >
              {testing ? 'Probando...' : 'Probar Lina'}
            </button>
            {aiConfig?.updated_at && (
              <span className={`${b}__ai-last-saved`}>
                Ultima actualizacion: {new Date(aiConfig.updated_at).toLocaleDateString('es-CO')}
              </span>
            )}
          </div>
          {testResult && (
            <div className={`${b}__test-result ${testResult.ok ? `${b}__test-result--ok` : `${b}__test-result--err`}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.msg}
            </div>
          )}
            </div>
          )}

          {/* ========== NOTIFICATIONS ========== */}
          {openSection === 'notif' && (
            <div className={`${b}__panel-content`}>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Notificaciones de citas</span>
              <span className={`${b}__option-desc`}>Recibir alertas cuando se agende una cita</span>
            </div>
            <button className={`${b}__toggle ${notifPrefs.citas !== false ? `${b}__toggle--active` : ''}`} onClick={() => handleToggle('citas')}>
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Alertas de mensajeria</span>
              <span className={`${b}__option-desc`}>Notificar cuando se complete un envio masivo</span>
            </div>
            <button className={`${b}__toggle ${notifPrefs.mensajeria !== false ? `${b}__toggle--active` : ''}`} onClick={() => handleToggle('mensajeria')}>
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Sonidos</span>
              <span className={`${b}__option-desc`}>Reproducir sonido con las notificaciones</span>
            </div>
            <button className={`${b}__toggle ${notifPrefs.sonidos ? `${b}__toggle--active` : ''}`} onClick={() => handleToggle('sonidos')}>
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>
            </div>
          )}

          {/* ========== META / WHATSAPP ========== */}
          {openSection === 'meta' && (
            <div className={`${b}__panel-content`}>
          {/* Token expiry warning banner */}
          {metaStatus?.connected && isTokenExpiringSoon && (
            <div className={`${b}__meta-expiry-warning`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Tu token expira en {metaStatus.days_until_expiry} dia{metaStatus.days_until_expiry !== 1 ? 's' : ''}. Renovalo para mantener la conexion activa.</span>
              <button className={`${b}__meta-expiry-renew`} onClick={handleRefreshToken} disabled={refreshing}>
                {refreshing ? 'Renovando...' : 'Renovar ahora'}
              </button>
            </div>
          )}

          {/* Status indicator */}
          <div className={`${b}__meta-status`}>
            <div className={`${b}__meta-status-dot ${metaStatus?.connected ? `${b}__meta-status-dot--on` : `${b}__meta-status-dot--off`}`} />
            <div className={`${b}__meta-status-info`}>
              <span className={`${b}__meta-status-label`}>
                {metaStatus?.connected ? 'Conectado' : 'Desconectado'}
              </span>
              <span className={`${b}__meta-status-detail`}>
                {metaStatus?.connected
                  ? `WhatsApp: ${metaStatus.phone_display || 'Activo'}`
                  : metaStatus?.message || 'Configura tu conexion con Facebook'
                }
              </span>
            </div>
            {metaStatus?.connected && (
              <span className={`${b}__meta-connected-pill`}>Conectado</span>
            )}
            <button className={`${b}__meta-check`} onClick={handleCheckStatus} disabled={metaChecking}>
              {metaChecking ? 'Verificando...' : 'Verificar conexion'}
            </button>
            {metaStatus?.connected && (
              <button className={`${b}__meta-disconnect`} onClick={() => setShowDisconnectModal(true)}>
                Desconectar
              </button>
            )}
          </div>

          {/* Token expiration info */}
          {metaStatus?.connected && metaStatus.expires_at && (
            <div className={`${b}__meta-token-info`}>
              <div className={`${b}__meta-token-info-row`}>
                <span className={`${b}__meta-token-info-label`}>Token valido hasta</span>
                <span className={`${b}__meta-token-info-date`}>
                  {formatExpiryDate(metaStatus.expires_at)}
                  {metaStatus.days_until_expiry != null && (
                    <span className={`${b}__meta-token-info-days ${isTokenExpiringSoon ? `${b}__meta-token-info-days--warning` : ''}`}>
                      ({metaStatus.days_until_expiry} dias restantes)
                    </span>
                  )}
                </span>
              </div>
              <button
                className={`${b}__meta-token-refresh`}
                onClick={handleRefreshToken}
                disabled={refreshing}
              >
                {refreshing ? 'Renovando...' : 'Renovar token'}
              </button>
            </div>
          )}

          {/* Facebook OAuth button — always visible */}
          <div className={`${b}__meta-oauth`}>
            <button
              className={`${b}__meta-fb-btn`}
              onClick={handleFacebookLogin}
              disabled={oauthLoading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {oauthLoading ? 'Conectando...' : metaStatus?.connected ? 'Reconectar con Facebook' : 'Conectar con Facebook'}
            </button>
            <p className={`${b}__meta-oauth-hint`}>
              {metaStatus?.connected
                ? 'Reconecta si necesitas actualizar permisos o cambiar de cuenta'
                : 'Conecta tu cuenta de Facebook para configurar WhatsApp Business automaticamente'}
            </p>
          </div>

          {/* Manual config accordion */}
          <div className={`${b}__meta-manual`}>
            <button
              className={`${b}__meta-manual-toggle`}
              onClick={() => setShowManualConfig(!showManualConfig)}
            >
              <svg
                className={`${b}__meta-manual-chevron ${showManualConfig ? `${b}__meta-manual-chevron--open` : ''}`}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              Configuracion manual (avanzado)
            </button>

            {showManualConfig && (
              <div className={`${b}__meta-manual-content`}>
                {/* Token input */}
                <div className={`${b}__meta-field`}>
                  <label>Token de acceso (Meta Business)</label>
                  <span className={`${b}__meta-hint`}>
                    Generalo en developers.facebook.com &rarr; Tu app &rarr; Configuracion de la API &rarr; Generar token de acceso
                  </span>
                  <div className={`${b}__meta-token-input`}>
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={metaToken}
                      onChange={e => setMetaToken(e.target.value)}
                      placeholder="EAAxxxxxxxxxxxxxxx..."
                    />
                    <button type="button" className={`${b}__meta-eye`} onClick={() => setShowToken(!showToken)}>
                      {showToken ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                </div>

                {/* Phone Number ID + Business Account ID */}
                <div className={`${b}__meta-row`}>
                  <div className={`${b}__meta-field`}>
                    <label>Phone Number ID</label>
                    <input
                      type="text"
                      value={metaPhoneId}
                      onChange={e => setMetaPhoneId(e.target.value)}
                      placeholder="Ej: 123456789012345"
                    />
                  </div>
                  <div className={`${b}__meta-field`}>
                    <label>WhatsApp Business Account ID</label>
                    <input
                      type="text"
                      value={metaBizId}
                      onChange={e => setMetaBizId(e.target.value)}
                      placeholder="Ej: 123456789012345"
                    />
                  </div>
                </div>

                <div className={`${b}__meta-actions`}>
                  <button
                    className={`${b}__ai-save`}
                    onClick={handleSaveToken}
                    disabled={metaSaving || !metaToken.trim()}
                  >
                    {metaSaving ? 'Guardando...' : 'Guardar configuracion Meta'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── WhatsApp Business Profile ── */}
          {metaStatus?.connected && (
            <div className={`${b}__wa-profile`}>
              <h4 className={`${b}__wa-profile-title`}>Perfil de WhatsApp Business</h4>
              <p className={`${b}__wa-profile-hint`}>
                Esto es lo que ven tus clientes en WhatsApp: nombre, foto, descripcion y datos del negocio.
              </p>

              {/* Current photo preview + upload */}
              <div className={`${b}__wa-profile-photo-section`}>
                <div
                  className={`${b}__wa-profile-photo-preview`}
                  onClick={() => waPhotoInputRef.current?.click()}
                  title="Clic para cambiar foto"
                >
                  {(waPhotoPreview || waProfile?.profile_picture_url) ? (
                    <img src={waPhotoPreview || waProfile.profile_picture_url} alt="Perfil WA" />
                  ) : (
                    <div className={`${b}__wa-profile-photo-empty`}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                  )}
                  <div className={`${b}__wa-profile-photo-overlay`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                </div>
                <input
                  ref={waPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  style={{ display: 'none' }}
                  onChange={handleWaPhotoSelect}
                />
                <div className={`${b}__wa-profile-photo-input`}>
                  <label>Foto de perfil de WhatsApp</label>
                  <span className={`${b}__meta-hint`}>JPEG o PNG, max 5MB, cuadrada recomendada. Clic en la foto o en el boton para cambiarla.</span>
                  <div className={`${b}__wa-profile-photo-row`}>
                    <button
                      className={`${b}__wa-profile-photo-select`}
                      onClick={() => waPhotoInputRef.current?.click()}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      {waPhotoFile ? waPhotoFile.name : 'Seleccionar imagen'}
                    </button>
                    <button
                      className={`${b}__ai-save`}
                      onClick={handleSaveWaPhoto}
                      disabled={waPhotoSaving || !waPhotoFile}
                    >
                      {waPhotoSaving ? 'Subiendo a Meta...' : 'Subir foto'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Profile fields */}
              <div className={`${b}__wa-profile-fields`}>
                <div className={`${b}__meta-field`}>
                  <label>Descripcion corta (About)</label>
                  <span className={`${b}__meta-hint`}>Aparece debajo del nombre en el perfil (max 139 caracteres)</span>
                  <input
                    type="text"
                    value={waAbout}
                    onChange={e => setWaAbout(e.target.value.slice(0, 139))}
                    placeholder="Ej: Peluqueria premium en Cabecera"
                    maxLength={139}
                  />
                  <span className={`${b}__wa-profile-charcount`}>{waAbout.length}/139</span>
                </div>

                <div className={`${b}__meta-field`}>
                  <label>Descripcion del negocio</label>
                  <span className={`${b}__meta-hint`}>Descripcion completa visible en el perfil del negocio</span>
                  <textarea
                    value={waDescription}
                    onChange={e => setWaDescription(e.target.value.slice(0, 512))}
                    placeholder="Ej: En AlPelo nos especializamos en cortes modernos, barba y tratamientos capilares..."
                    rows={3}
                    maxLength={512}
                  />
                </div>

                <div className={`${b}__meta-row`}>
                  <div className={`${b}__meta-field`}>
                    <label>Direccion</label>
                    <input
                      type="text"
                      value={waAddress}
                      onChange={e => setWaAddress(e.target.value)}
                      placeholder="Ej: Calle 49 #35-21, Cabecera"
                    />
                  </div>
                  <div className={`${b}__meta-field`}>
                    <label>Email</label>
                    <input
                      type="email"
                      value={waEmail}
                      onChange={e => setWaEmail(e.target.value)}
                      placeholder="contacto@tunegocio.com"
                    />
                  </div>
                </div>

                <div className={`${b}__meta-field`}>
                  <label>Sitio web</label>
                  <input
                    type="url"
                    value={waWebsite}
                    onChange={e => setWaWebsite(e.target.value)}
                    placeholder="https://tunegocio.com"
                  />
                </div>
              </div>

              <button
                className={`${b}__ai-save`}
                onClick={handleSaveWaProfile}
                disabled={waProfileSaving}
                style={{ marginTop: '12px' }}
              >
                {waProfileSaving ? 'Guardando en Meta...' : 'Guardar perfil en WhatsApp'}
              </button>
            </div>
          )}

          {/* Approved templates from Meta */}
          {metaTemplates && metaTemplates.templates && metaTemplates.templates.length > 0 && (
            <div className={`${b}__meta-templates`}>
              <div className={`${b}__meta-templates-header`}>
                <span>Plantillas en Meta</span>
                <div className={`${b}__meta-templates-badges`}>
                  {metaTemplates.approved > 0 && <span className={`${b}__meta-badge ${b}__meta-badge--approved`}>{metaTemplates.approved} aprobadas</span>}
                  {metaTemplates.pending > 0 && <span className={`${b}__meta-badge ${b}__meta-badge--pending`}>{metaTemplates.pending} pendientes</span>}
                  {metaTemplates.rejected > 0 && <span className={`${b}__meta-badge ${b}__meta-badge--rejected`}>{metaTemplates.rejected} rechazadas</span>}
                </div>
              </div>
              <div className={`${b}__meta-templates-list`}>
                {metaTemplates.templates.filter(t => t.status === 'approved').map(t => (
                  <div key={t.id} className={`${b}__meta-tpl`}>
                    <span className={`${b}__meta-tpl-name`}>{t.name}</span>
                    <span className={`${b}__meta-tpl-cat`}>{t.category}</span>
                    <span className={`${b}__meta-tpl-body`}>{t.body?.slice(0, 80)}{t.body?.length > 80 ? '...' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metaTemplates?.error && (
            <div className={`${b}__test-result ${b}__test-result--err`}>
              Meta API: {metaTemplates.error}
            </div>
          )}
            </div>
          )}

          {/* ========== LOYALTY PROGRAM ========== */}
          {openSection === 'loyalty' && (
            <div className={`${b}__panel-content`}>
          <div className={`${b}__option`}>
            <div className={`${b}__option-info`}>
              <span className={`${b}__option-label`}>Activar programa de lealtad</span>
              <span className={`${b}__option-desc`}>Tus clientes acumulan credito con cada visita y lo usan como descuento</span>
            </div>
            <button
              className={`${b}__toggle ${loyaltyConfig.is_active ? `${b}__toggle--active` : ''}`}
              onClick={() => handleLoyaltyChange('is_active', !loyaltyConfig.is_active)}
            >
              <span className={`${b}__toggle-knob`} />
            </button>
          </div>

          {/* ACUMULACION */}
          <div style={{ padding: '20px 0', borderBottom: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: '16px' }}>Acumulacion de credito</h4>
            <div className={`${b}__meta-row`}>
              <div className={`${b}__meta-field`}>
                <label>Por cada $ que gaste el cliente...</label>
                <input type="number" value={loyaltyConfig.currency_unit} onChange={e => handleLoyaltyChange('currency_unit', Number(e.target.value))} placeholder="10000" />
              </div>
              <div className={`${b}__meta-field`}>
                <label>...recibe $ en credito de descuento</label>
                <input type="number" value={Math.round((loyaltyConfig.points_per_currency || 1) * (loyaltyConfig.redemption_rate || 0.1) * 1000)} onChange={e => {
                  const creditPerPoint = Number(e.target.value);
                  const rate = creditPerPoint / 1000;
                  handleLoyaltyChange('redemption_rate', rate);
                  handleLoyaltyChange('points_per_currency', 1);
                }} placeholder="500" />
              </div>
            </div>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', marginTop: '12px' }}>
              <span style={{ fontSize: '13px', color: '#166534' }}>
                Ejemplo con un corte de <strong>$40,000</strong>: el cliente acumula <strong>${loyaltyConfig.currency_unit > 0 ? Math.floor(40000 / loyaltyConfig.currency_unit) : 0} creditos</strong> = <strong>${loyaltyConfig.currency_unit > 0 ? (Math.floor(40000 / loyaltyConfig.currency_unit) * Math.round((loyaltyConfig.points_per_currency || 1) * (loyaltyConfig.redemption_rate || 0.1) * 1000)).toLocaleString('es-CO') : '0'}</strong> en descuentos futuros
              </span>
            </div>
          </div>

          {/* NIVELES */}
          <div style={{ padding: '20px 0', borderBottom: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>Niveles de cliente (por numero de visitas)</h4>
            <span className={`${b}__meta-hint`} style={{ marginBottom: '16px', display: 'block' }}>Los clientes suben de nivel segun cuantas veces han venido. Cada nivel puede tener un descuento permanente.</span>
            <div className={`${b}__meta-row`}>
              <div className={`${b}__meta-field`} style={{ flex: 2 }}>
                <label style={{ color: '#CD7F32', fontWeight: 600 }}>Bronce — desde</label>
                <input type="number" value={loyaltyConfig.tier_bronze_min} onChange={e => handleLoyaltyChange('tier_bronze_min', Number(e.target.value))} placeholder="0" />
                <span className={`${b}__meta-hint`}>visitas</span>
              </div>
              <div className={`${b}__meta-field`} style={{ flex: 1 }}>
                <label>Beneficio</label>
                <span style={{ fontSize: '13px', color: '#64748B', padding: '14px 0', display: 'block' }}>Sin descuento</span>
              </div>
            </div>
            <div className={`${b}__meta-row`}>
              <div className={`${b}__meta-field`} style={{ flex: 2 }}>
                <label style={{ color: '#64748B', fontWeight: 600 }}>Plata — desde</label>
                <input type="number" value={loyaltyConfig.tier_silver_min} onChange={e => handleLoyaltyChange('tier_silver_min', Number(e.target.value))} placeholder="10" />
                <span className={`${b}__meta-hint`}>visitas — Cliente frecuente</span>
              </div>
              <div className={`${b}__meta-field`} style={{ flex: 1 }}>
                <label>Descuento permanente</label>
                <span style={{ fontSize: '14px', color: '#059669', fontWeight: 600, padding: '14px 0', display: 'block' }}>5%</span>
              </div>
            </div>
            <div className={`${b}__meta-row`}>
              <div className={`${b}__meta-field`} style={{ flex: 2 }}>
                <label style={{ color: '#F59E0B', fontWeight: 600 }}>Oro — desde</label>
                <input type="number" value={loyaltyConfig.tier_gold_min} onChange={e => handleLoyaltyChange('tier_gold_min', Number(e.target.value))} placeholder="50" />
                <span className={`${b}__meta-hint`}>visitas — Cliente leal</span>
              </div>
              <div className={`${b}__meta-field`} style={{ flex: 1 }}>
                <label>Descuento permanente</label>
                <span style={{ fontSize: '14px', color: '#059669', fontWeight: 600, padding: '14px 0', display: 'block' }}>10%</span>
              </div>
            </div>
            <div className={`${b}__meta-row`}>
              <div className={`${b}__meta-field`} style={{ flex: 2 }}>
                <label style={{ color: '#8B5CF6', fontWeight: 600 }}>VIP — desde</label>
                <input type="number" value={loyaltyConfig.tier_vip_min} onChange={e => handleLoyaltyChange('tier_vip_min', Number(e.target.value))} placeholder="100" />
                <span className={`${b}__meta-hint`}>visitas — Tu mejor cliente</span>
              </div>
              <div className={`${b}__meta-field`} style={{ flex: 1 }}>
                <label>Descuento permanente</label>
                <span style={{ fontSize: '14px', color: '#059669', fontWeight: 600, padding: '14px 0', display: 'block' }}>15% + servicio gratis en cumpleanos</span>
              </div>
            </div>
          </div>

          {/* BONIFICACIONES */}
          <div style={{ padding: '20px 0' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>Bonificaciones por referidos y cumpleanos</h4>
            <span className={`${b}__meta-hint`} style={{ marginBottom: '16px', display: 'block' }}>Credito en pesos que se da automaticamente. El cliente o Lina registran "vengo por parte de X".</span>
            <div className={`${b}__meta-row`}>
              <div className={`${b}__meta-field`}>
                <label>Quien trae a alguien nuevo gana</label>
                <input type="number" value={loyaltyConfig.referral_bonus_referrer} onChange={e => handleLoyaltyChange('referral_bonus_referrer', Number(e.target.value))} placeholder="5000" />
                <span className={`${b}__meta-hint`}>$ en credito de descuento</span>
              </div>
              <div className={`${b}__meta-field`}>
                <label>El cliente nuevo recibe de bienvenida</label>
                <input type="number" value={loyaltyConfig.referral_bonus_referred} onChange={e => handleLoyaltyChange('referral_bonus_referred', Number(e.target.value))} placeholder="3000" />
                <span className={`${b}__meta-hint`}>$ en credito de descuento</span>
              </div>
            </div>
            <div className={`${b}__meta-row`}>
              <div className={`${b}__meta-field`}>
                <label>Bono de cumpleanos</label>
                <input type="number" value={loyaltyConfig.birthday_bonus} onChange={e => handleLoyaltyChange('birthday_bonus', Number(e.target.value))} placeholder="10000" />
                <span className={`${b}__meta-hint`}>$ en credito que recibe automaticamente en su mes de cumpleanos</span>
              </div>
            </div>
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px 16px', marginTop: '12px' }}>
              <span style={{ fontSize: '13px', color: '#1E40AF' }}>
                Ejemplo: Luis trae a 2 amigos → Luis gana <strong>${(loyaltyConfig.referral_bonus_referrer * 2 || 0).toLocaleString('es-CO')}</strong> de credito. Cada amigo recibe <strong>${(loyaltyConfig.referral_bonus_referred || 0).toLocaleString('es-CO')}</strong> de bienvenida.
              </span>
            </div>
          </div>

          <div className={`${b}__meta-actions`}>
            <button
              className={`${b}__ai-save`}
              onClick={handleSaveLoyalty}
              disabled={loyaltySaving}
            >
              {loyaltySaving ? 'Guardando...' : 'Guardar programa de lealtad'}
            </button>
          </div>
            </div>
          )}

          {/* ========== GOOGLE REVIEWS ========== */}
          {openSection === 'google' && (
            <div className={`${b}__panel-content`}>
          <div className={`${b}__meta-field`}>
            <label>URL de Google Reviews</label>
            <input
              type="url"
              value={googleReviewUrl}
              onChange={e => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/xxx/review"
            />
            <span className={`${b}__meta-hint`}>
              Cuando un cliente califique 4-5 estrellas, sera redirigido a esta URL para dejar su resena.
            </span>
          </div>
          <div className={`${b}__meta-actions`}>
            <button
              className={`${b}__ai-save`}
              onClick={handleSaveGoogleReview}
              disabled={googleSaving || !googleReviewUrl.trim()}
            >
              {googleSaving ? 'Guardando...' : 'Guardar URL'}
            </button>
          </div>
            </div>
          )}

        </div>
      )}

      {/* Disconnect confirmation modal — rendered via portal to avoid stacking context issues */}
      {showDisconnectModal && createPortal(
        <div className={`${b}__modal-overlay`} onClick={() => setShowDisconnectModal(false)}>
          <div className={`${b}__modal`} onClick={e => e.stopPropagation()}>
            <div className={`${b}__modal-icon`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className={`${b}__modal-title`}>Desconectar cuenta de Meta</h3>
            <p className={`${b}__modal-desc`}>
              Se eliminara el token de acceso y la conexion con WhatsApp Business.
              Las automatizaciones dejaran de funcionar hasta que vuelvas a conectar.
            </p>
            <div className={`${b}__modal-actions`}>
              <button
                className={`${b}__modal-cancel`}
                onClick={() => setShowDisconnectModal(false)}
                disabled={disconnecting}
              >
                Cancelar
              </button>
              <button
                className={`${b}__modal-confirm`}
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Desconectando...' : 'Si, desconectar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Settings;
