import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useNotification } from '../../context/NotificationContext';
import { useTenant } from '../../context/TenantContext';
import aiService from '../../services/aiService';
import settingsService from '../../services/settingsService';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

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

  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [googleSaving, setGoogleSaving] = useState(false);

  const EMPTY_SCHEDULE = [
    { day: 'Lunes', hours: '' }, { day: 'Martes', hours: '' }, { day: 'Miercoles', hours: '' },
    { day: 'Jueves', hours: '' }, { day: 'Viernes', hours: '' }, { day: 'Sabado', hours: '' }, { day: 'Domingo', hours: '' },
  ];
  const [bookingConfig, setBookingConfig] = useState({
    booking_enabled: false, booking_tagline: '', booking_description: '', gallery_images: [],
    booking_cover_url: null, booking_phone: '', booking_whatsapp: '',
    booking_instagram: '', booking_facebook: '',
    booking_tags: [], booking_schedule: EMPTY_SCHEDULE,
    google_place_id: '', booking_google_rating: null, booking_google_total_reviews: null,
    booking_google_reviews: [], slug: '', logo_url: null,
  });
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingLoaded, setBookingLoaded] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [syncingReviews, setSyncingReviews] = useState(false);
  const [newTag, setNewTag] = useState('');

  const loadBookingConfig = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/settings/booking`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        if (!d.booking_schedule || d.booking_schedule.length === 0) d.booking_schedule = EMPTY_SCHEDULE;
        setBookingConfig(d);
        setBookingLoaded(true);
      }
    } catch {}
  }, []);

  const handleSaveBooking = async () => {
    setBookingSaving(true);
    try {
      const body = {};
      ['booking_enabled', 'booking_tagline', 'booking_description', 'booking_phone', 'booking_whatsapp',
       'booking_instagram', 'booking_facebook', 'booking_tags', 'booking_schedule', 'google_place_id',
       'gallery_images'].forEach(k => { body[k] = bookingConfig[k]; });
      const r = await fetch(`${API_URL}/settings/booking`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) addNotification('Configuracion de reservas guardada', 'success');
      else addNotification('Error al guardar', 'error');
    } catch { addNotification('Error de conexion', 'error'); }
    setBookingSaving(false);
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { addNotification('Maximo 2MB', 'error'); return; }
    setCoverUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch(`${API_URL}/settings/booking/cover`, { method: 'POST', credentials: 'include', body: form });
      if (r.ok) { const d = await r.json(); setBookingConfig(c => ({ ...c, booking_cover_url: d.booking_cover_url })); addNotification('Portada actualizada', 'success'); }
      else addNotification('Error al subir portada', 'error');
    } catch { addNotification('Error de conexion', 'error'); }
    setCoverUploading(false);
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const currentCount = (bookingConfig.gallery_images || []).length;
    const maxNew = 20 - currentCount;
    if (maxNew <= 0) { addNotification('Ya tienes 20 imagenes (maximo)', 'error'); return; }
    const toUpload = files.slice(0, maxNew);
    const skipped = files.length - toUpload.length;
    setGalleryUploading(true);
    let uploaded = 0;
    for (const file of toUpload) {
      if (file.size > 2 * 1024 * 1024) { addNotification(`${file.name} excede 2MB, omitida`, 'error'); continue; }
      try {
        const form = new FormData();
        form.append('file', file);
        const r = await fetch(`${API_URL}/settings/booking/gallery`, { method: 'POST', credentials: 'include', body: form });
        if (r.ok) { const d = await r.json(); setBookingConfig(c => ({ ...c, gallery_images: d.gallery_images })); uploaded++; }
        else { const err = await r.json().catch(() => ({})); addNotification(err.detail || `Error: ${file.name}`, 'error'); }
      } catch { addNotification(`Error subiendo ${file.name}`, 'error'); }
    }
    if (uploaded > 0) addNotification(`${uploaded} imagen${uploaded > 1 ? 'es' : ''} agregada${uploaded > 1 ? 's' : ''}`, 'success');
    if (skipped > 0) addNotification(`${skipped} imagen${skipped > 1 ? 'es' : ''} omitida${skipped > 1 ? 's' : ''} (limite 20)`, 'error');
    setGalleryUploading(false);
    e.target.value = '';
  };

  const handleGalleryRemove = (index) => {
    const updated = bookingConfig.gallery_images.filter((_, i) => i !== index);
    setBookingConfig(c => ({ ...c, gallery_images: updated }));
  };

  const handleSaveReviews = async () => {
    setSyncingReviews(true);
    try {
      const r = await fetch(`${API_URL}/settings/booking/reviews`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: bookingConfig.booking_google_rating,
          total_reviews: bookingConfig.booking_google_total_reviews,
          reviews: bookingConfig.booking_google_reviews || [],
        }),
      });
      if (r.ok) addNotification('Resenas guardadas', 'success');
      else addNotification('Error al guardar resenas', 'error');
    } catch { addNotification('Error de conexion', 'error'); }
    setSyncingReviews(false);
  };

  const addReview = () => {
    const reviews = [...(bookingConfig.booking_google_reviews || []), { name: '', rating: 5, date: '', text: '', photo: null }];
    setBookingConfig(c => ({ ...c, booking_google_reviews: reviews }));
  };

  const updateReview = (idx, field, value) => {
    const reviews = [...(bookingConfig.booking_google_reviews || [])];
    reviews[idx] = { ...reviews[idx], [field]: value };
    setBookingConfig(c => ({ ...c, booking_google_reviews: reviews }));
  };

  const removeReview = (idx) => {
    const reviews = (bookingConfig.booking_google_reviews || []).filter((_, i) => i !== idx);
    setBookingConfig(c => ({ ...c, booking_google_reviews: reviews }));
  };

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
    { id: 'lina', title: 'Lina IA', desc: 'Prompt, contexto del negocio y pruebas de la asistente', color1: '#7C3AED', color2: '#A855F7' },
    { id: 'notif', title: 'Notificaciones', desc: 'Alertas de citas, mensajeria y sonidos', color1: '#3B82F6', color2: '#60A5FA' },
    { id: 'meta', title: 'Meta / WhatsApp', desc: 'Conexion, token, perfil y plantillas de WhatsApp Business', color1: '#1877F2', color2: '#00C6FF' },
    { id: 'loyalty', title: 'Programa de Lealtad', desc: 'Creditos, niveles, referidos y bonificaciones', color1: '#10B981', color2: '#34D399' },
    { id: 'google', title: 'Google Reviews', desc: 'Redirige clientes satisfechos a dejar resenas', color1: '#FBBC05', color2: '#EA4335' },
    { id: 'booking', title: 'Reservas Online', desc: 'Pagina publica para que tus clientes agenden citas', color1: '#F59E0B', color2: '#FBBF24' },
    { id: 'brand', title: 'Marca y Logo', desc: 'Logo, nombre y colores de tu negocio', color1: '#8B5CF6', color2: '#A78BFA' },
  ];

  const [usageStats, setUsageStats] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/tenant/me`, { credentials: 'include' });
        if (res.ok) setUsageStats(await res.json());
      } catch {}
    })();
  }, []);

  const SectionIcon = ({ id, color1, color2 }) => {
    const gid = `grad-${id}`;
    const grad = <defs><linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color1} /><stop offset="100%" stopColor={color2} /></linearGradient></defs>;
    const icons = {
      lina: <svg width="28" height="28" viewBox="0 0 24 24" fill="none">{grad}<path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill={`url(#${gid})`} opacity=".3"/><path d="M9.5 7.5C8 9 6 11 6 14c0 2 1 4 3.5 4.5" stroke={`url(#${gid})`} strokeWidth="1.5" strokeLinecap="round"/><path d="M14.5 7.5C16 9 18 11 18 14c0 2-1 4-3.5 4.5" stroke={`url(#${gid})`} strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="5.5" r="2.5" stroke={`url(#${gid})`} strokeWidth="1.5"/><path d="M10 19c0 1.1.9 2 2 2s2-.9 2-2" stroke={`url(#${gid})`} strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="13" r="1" fill={`url(#${gid})`} opacity=".6"/></svg>,
      notif: <svg width="28" height="28" viewBox="0 0 24 24" fill="none">{grad}<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill={`url(#${gid})`} opacity=".15"/><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={`url(#${gid})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={`url(#${gid})`} strokeWidth="1.5" strokeLinecap="round"/><circle cx="18" cy="5" r="3" fill={`url(#${gid})`} opacity=".5"/></svg>,
      meta: <svg width="28" height="28" viewBox="0 0 16 16" fill="none">{grad}<path fillRule="evenodd" d="M8.217 5.243C9.145 3.988 10.171 3 11.483 3 13.96 3 16 6.153 16.001 9.907c0 2.29-.986 3.725-2.757 3.725-1.543 0-2.395-.866-3.924-3.424l-.667-1.123-.118-.197a55 55 0 0 0-.53-.877l-1.178 2.08c-1.673 2.925-2.615 3.541-3.923 3.541C1.086 13.632 0 12.217 0 9.973 0 6.388 1.995 3 4.598 3q.477-.001.924.122c.31.086.611.22.913.407.577.359 1.154.915 1.782 1.714m1.516 2.224q-.378-.615-.727-1.133L9 6.326c.845-1.305 1.543-1.954 2.372-1.954 1.723 0 3.102 2.537 3.102 5.653 0 1.188-.39 1.877-1.195 1.877-.773 0-1.142-.51-2.61-2.87zM4.846 4.756c.725.1 1.385.634 2.34 2.001A212 212 0 0 0 5.551 9.3c-1.357 2.126-1.826 2.603-2.581 2.603-.777 0-1.24-.682-1.24-1.9 0-2.602 1.298-5.264 2.846-5.264q.137 0 .27.018" fill={`url(#${gid})`} /></svg>,
      brand: <svg width="28" height="28" viewBox="0 0 24 24" fill="none">{grad}<rect x="3" y="3" width="18" height="18" rx="3" fill={`url(#${gid})`} opacity=".15" /><rect x="3" y="3" width="18" height="18" rx="3" stroke={`url(#${gid})`} strokeWidth="1.5"/><circle cx="12" cy="10" r="3" stroke={`url(#${gid})`} strokeWidth="1.5"/><path d="M7 18c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke={`url(#${gid})`} strokeWidth="1.5" strokeLinecap="round"/></svg>,
      loyalty: <svg width="28" height="28" viewBox="0 0 24 24" fill="none">{grad}<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" fill={`url(#${gid})`} opacity=".15"/><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" stroke={`url(#${gid})`} strokeWidth="1.5" strokeLinejoin="round"/></svg>,
      google: <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
      booking: <svg width="28" height="28" viewBox="0 0 24 24" fill="none">{grad}<rect x="3" y="4" width="18" height="17" rx="2" fill={`url(#${gid})`} opacity=".15"/><rect x="3" y="4" width="18" height="17" rx="2" stroke={`url(#${gid})`} strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 9h18" stroke={`url(#${gid})`} strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="15" r="2" fill={`url(#${gid})`}/></svg>,
    };
    return icons[id] || null;
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
            style={{ '--c1': s.color1, '--c2': s.color2 }}
          >
            <div className={`${b}__section-card-glow`} />
            <div className={`${b}__section-icon`}>
              <SectionIcon id={s.id} color1={s.color1} color2={s.color2} />
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

          {/* Push notification debug */}
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginTop: '12px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Notificaciones Push</h4>
            <div id="push-debug" style={{ fontSize: '12px', color: '#64748B', marginBottom: '10px', lineHeight: 1.6 }}>
              Cargando estado...
            </div>
            <button
              className={`${b}__ai-save`}
              onClick={async () => {
                const dbg = document.getElementById('push-debug');
                const lines = [];

                // 1. Check API support
                lines.push(`Notification API: ${'Notification' in window ? 'SI' : 'NO'}`);
                lines.push(`Service Worker: ${'serviceWorker' in navigator ? 'SI' : 'NO'}`);
                lines.push(`PushManager: ${'PushManager' in window ? 'SI' : 'NO'}`);

                // 2. Check permission
                if ('Notification' in window) {
                  lines.push(`Permiso actual: ${Notification.permission}`);
                  if (Notification.permission === 'default') {
                    const result = await Notification.requestPermission();
                    lines.push(`Permiso solicitado: ${result}`);
                  }
                }

                // 3. Check SW registration
                if ('serviceWorker' in navigator) {
                  const reg = await navigator.serviceWorker.getRegistration('/AlPelo-CRM/');
                  lines.push(`SW registrado: ${reg ? 'SI' : 'NO'}`);
                  if (reg) {
                    const sub = await reg.pushManager?.getSubscription();
                    lines.push(`Push suscrito: ${sub ? 'SI' : 'NO'}`);
                  }
                }

                // 4. Try to show notification
                if ('Notification' in window && Notification.permission === 'granted') {
                  try {
                    const reg = await navigator.serviceWorker?.getRegistration('/AlPelo-CRM/');
                    if (reg) {
                      await reg.showNotification('Plexify Studio', {
                        body: 'Las notificaciones funcionan correctamente!',
                        icon: '/AlPelo-CRM/icon-192.svg',
                        badge: '/AlPelo-CRM/badge-72.svg',
                        tag: 'test-' + Date.now(),
                      });
                      lines.push('Test: Notificacion enviada via SW');
                    } else {
                      new Notification('Plexify Studio', { body: 'Test de notificacion!' });
                      lines.push('Test: Notificacion enviada via API');
                    }
                  } catch (e) {
                    lines.push(`Test ERROR: ${e.message}`);
                  }
                } else {
                  lines.push('Test: No se puede enviar (sin permiso)');
                }

                lines.push(`User Agent: ${navigator.userAgent.slice(0, 80)}...`);
                dbg.innerHTML = lines.join('<br>');
              }}
            >
              Probar notificaciones
            </button>
          </div>
            </div>
          )}

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

          {openSection === 'booking' && (
            <div className={`${b}__panel-content`}>
              {!bookingLoaded ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }} ref={() => loadBookingConfig()}>Cargando configuracion...</div>
              ) : (<>

              {/* Enable toggle */}
              <div className={`${b}__meta-field`}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!bookingConfig.booking_enabled} onChange={e => setBookingConfig(c => ({ ...c, booking_enabled: e.target.checked }))} style={{ width: 18, height: 18, accentColor: '#10b981' }} />
                  <span style={{ fontWeight: 600 }}>Pagina publica de reservas activa</span>
                </label>
                <span className={`${b}__meta-hint`}>Cuando este activa, tus clientes podran agendar citas desde el link publico.</span>
              </div>

              {/* Public link */}
              {bookingConfig.slug && (
                <div className={`${b}__meta-field`}>
                  <label>Link publico de reservas</label>
                  <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: 8, fontSize: '0.88rem', color: '#1e293b', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1 }}>{window.location.origin}{import.meta.env.BASE_URL || '/'}book/{bookingConfig.slug}</span>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL || '/'}book/${bookingConfig.slug}`); addNotification('Link copiado', 'success'); }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Copiar</button>
                  </div>
                </div>
              )}

              {/* Cover image */}
              <div className={`${b}__meta-field`}>
                <label>Imagen de portada (hero)</label>
                {bookingConfig.booking_cover_url && (
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginBottom: 8, maxHeight: 180 }}>
                    <img src={bookingConfig.booking_cover_url} alt="Portada" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => setBookingConfig(c => ({ ...c, booking_cover_url: null }))} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleCoverUpload} style={{ fontSize: '0.85rem' }} />
                {coverUploading && <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Subiendo...</span>}
              </div>

              {/* Tagline & Description */}
              <div className={`${b}__meta-field`}>
                <label>Tagline</label>
                <input value={bookingConfig.booking_tagline || ''} onChange={e => setBookingConfig(c => ({ ...c, booking_tagline: e.target.value }))} placeholder="Ej: Descubre la excelencia en nuestro negocio!" maxLength={300} />
              </div>
              <div className={`${b}__meta-field`}>
                <label>Descripcion (sobre nosotros)</label>
                <textarea value={bookingConfig.booking_description || ''} onChange={e => setBookingConfig(c => ({ ...c, booking_description: e.target.value }))} placeholder="Describe tu negocio..." rows={3} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              {/* Gallery */}
              <div className={`${b}__meta-field`}>
                <label>Galeria / Portafolio ({(bookingConfig.gallery_images || []).length}/20 imagenes)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 8 }}>
                  {(bookingConfig.gallery_images || []).map((img, i) => (
                    <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1' }}>
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <button onClick={() => handleGalleryRemove(i)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                    </div>
                  ))}
                </div>
                {(bookingConfig.gallery_images || []).length < 20 && (
                  <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} style={{ fontSize: '0.85rem' }} />
                )}
                {galleryUploading && <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Subiendo imagen...</span>}
              </div>

              {/* Contact */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={`${b}__meta-field`}>
                  <label>Telefono de contacto</label>
                  <input value={bookingConfig.booking_phone || ''} onChange={e => setBookingConfig(c => ({ ...c, booking_phone: e.target.value }))} placeholder="317 660 8487" />
                </div>
                <div className={`${b}__meta-field`}>
                  <label>WhatsApp (con codigo de pais)</label>
                  <input value={bookingConfig.booking_whatsapp || ''} onChange={e => setBookingConfig(c => ({ ...c, booking_whatsapp: e.target.value }))} placeholder="573176608487" />
                </div>
              </div>

              {/* Social links */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={`${b}__meta-field`}>
                  <label>Instagram URL</label>
                  <input value={bookingConfig.booking_instagram || ''} onChange={e => setBookingConfig(c => ({ ...c, booking_instagram: e.target.value }))} placeholder="https://instagram.com/tu-negocio" />
                </div>
                <div className={`${b}__meta-field`}>
                  <label>Facebook URL</label>
                  <input value={bookingConfig.booking_facebook || ''} onChange={e => setBookingConfig(c => ({ ...c, booking_facebook: e.target.value }))} placeholder="https://facebook.com/tu-negocio" />
                </div>
              </div>

              {/* Tags */}
              <div className={`${b}__meta-field`}>
                <label>Categorias / Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {(bookingConfig.booking_tags || []).map((tag, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: '#f1f5f9', borderRadius: 20, fontSize: '0.82rem', fontWeight: 500, color: '#334155' }}>
                      {tag}
                      <button onClick={() => setBookingConfig(c => ({ ...c, booking_tags: c.booking_tags.filter((_, j) => j !== i) }))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: 0, lineHeight: 1 }}>&times;</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Ej: Barberia" style={{ flex: 1 }} onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { setBookingConfig(c => ({ ...c, booking_tags: [...(c.booking_tags || []), newTag.trim()] })); setNewTag(''); } }} />
                  <button onClick={() => { if (newTag.trim()) { setBookingConfig(c => ({ ...c, booking_tags: [...(c.booking_tags || []), newTag.trim()] })); setNewTag(''); } }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Agregar</button>
                </div>
              </div>

              {/* Schedule */}
              <div className={`${b}__meta-field`}>
                <label>Horarios semanales</label>
                <span className={`${b}__meta-hint`}>Deja vacio si el dia esta cerrado.</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {(bookingConfig.booking_schedule || EMPTY_SCHEDULE).map((s, i) => (
                    <div key={s.day} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 100, fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>{s.day}</span>
                      <input value={s.hours || ''} onChange={e => {
                        const updated = [...(bookingConfig.booking_schedule || EMPTY_SCHEDULE)];
                        updated[i] = { ...updated[i], hours: e.target.value };
                        setBookingConfig(c => ({ ...c, booking_schedule: updated }));
                      }} placeholder="8:15 AM - 8:00 PM" style={{ flex: 1 }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews Editor */}
              <div className={`${b}__meta-field`} style={{ background: '#fafbfc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <label style={{ marginBottom: 8, fontSize: '0.95rem' }}>Resenas de Google</label>
                <span className={`${b}__meta-hint`}>Copia las resenas reales de tu pagina de Google Maps y pegalas aqui.</span>

                {/* Rating + Total */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 0' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>Rating general</label>
                    <input type="number" step="0.1" min="1" max="5" value={bookingConfig.booking_google_rating || ''} onChange={e => setBookingConfig(c => ({ ...c, booking_google_rating: parseFloat(e.target.value) || null }))} placeholder="4.7" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>Total de opiniones</label>
                    <input type="number" min="0" value={bookingConfig.booking_google_total_reviews || ''} onChange={e => setBookingConfig(c => ({ ...c, booking_google_total_reviews: parseInt(e.target.value) || null }))} placeholder="742" />
                  </div>
                </div>

                {/* Review list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                  {(bookingConfig.booking_google_reviews || []).map((rev, i) => (
                    <div key={i} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', position: 'relative' }}>
                      <button onClick={() => removeReview(i)} style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
                        <input value={rev.name} onChange={e => updateReview(i, 'name', e.target.value)} placeholder="Nombre del cliente" style={{ fontSize: '0.85rem' }} />
                        <select value={rev.rating} onChange={e => updateReview(i, 'rating', parseInt(e.target.value))} style={{ fontSize: '0.85rem' }}>
                          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} {'★'.repeat(n)}</option>)}
                        </select>
                      </div>
                      <input value={rev.date || ''} onChange={e => updateReview(i, 'date', e.target.value)} placeholder="Hace 1 mes" style={{ fontSize: '0.82rem', marginBottom: 6, width: '100%' }} />
                      <textarea value={rev.text} onChange={e => updateReview(i, 'text', e.target.value)} placeholder="Texto de la resena..." rows={2} style={{ width: '100%', fontSize: '0.82rem', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', resize: 'vertical' }} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={addReview} style={{ padding: '8px 20px', borderRadius: 8, border: '1.5px dashed #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>+ Agregar resena</button>
                  <button onClick={handleSaveReviews} disabled={syncingReviews} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: syncingReviews ? 0.5 : 1 }}>
                    {syncingReviews ? 'Guardando...' : 'Guardar resenas'}
                  </button>
                </div>
              </div>

              {/* Save */}
              <div className={`${b}__meta-actions`}>
                <button className={`${b}__ai-save`} onClick={handleSaveBooking} disabled={bookingSaving}>
                  {bookingSaving ? 'Guardando...' : 'Guardar configuracion'}
                </button>
              </div>
              </>)}
            </div>
          )}

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

          {openSection === 'brand' && (
            <BrandingPanel addNotification={addNotification} />
          )}

        </div>
      )}

      {/* ═══ USAGE OVERVIEW PANEL ═══ */}
      {!openSection && (
        <div className={`${b}__usage`}>
          <h3 className={`${b}__usage-title`}>Resumen del mes</h3>
          <div className={`${b}__usage-grid`}>
            {/* Messages */}
            <div className={`${b}__usage-card`}>
              <div className={`${b}__usage-card-header`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>Mensajes IA</span>
              </div>
              <div className={`${b}__usage-card-value`}>
                {(tenant?.messages_used || usageStats?.messages_used || 0).toLocaleString('es-CO')}
                <span className={`${b}__usage-card-limit`}>/ {(tenant?.messages_limit || usageStats?.messages_limit || 5000).toLocaleString('es-CO')}</span>
              </div>
              <div className={`${b}__usage-bar`}>
                <div className={`${b}__usage-bar-fill`} style={{ width: `${Math.min(100, ((tenant?.messages_used || 0) / (tenant?.messages_limit || 5000)) * 100)}%`, background: 'linear-gradient(90deg, #3B82F6, #60A5FA)' }} />
              </div>
            </div>

            {/* WhatsApp sent */}
            <div className={`${b}__usage-card`}>
              <div className={`${b}__usage-card-header`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>WhatsApp enviados</span>
              </div>
              <div className={`${b}__usage-card-value`}>
                {(usageStats?.wa_sent_month || 0).toLocaleString('es-CO')}
              </div>
              <span className={`${b}__usage-card-sub`}>mensajes este mes</span>
            </div>

            {/* Campaigns */}
            <div className={`${b}__usage-card`}>
              <div className={`${b}__usage-card-header`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <span>Campañas enviadas</span>
              </div>
              <div className={`${b}__usage-card-value`}>
                {usageStats?.campaigns_month || 0}
              </div>
              <span className={`${b}__usage-card-sub`}>campañas este mes</span>
            </div>

            {/* Messages remaining */}
            <div className={`${b}__usage-card`}>
              <div className={`${b}__usage-card-header`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>
                <span>Restantes</span>
              </div>
              <div className={`${b}__usage-card-value`}>
                {Math.max(0, (tenant?.messages_limit || 5000) - (tenant?.messages_used || 0)).toLocaleString('es-CO')}
              </div>
              <span className={`${b}__usage-card-sub`}>mensajes disponibles</span>
            </div>

            {/* WhatsApp status */}
            <div className={`${b}__usage-card`}>
              <div className={`${b}__usage-card-header`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={metaStatus?.connected ? '#10B981' : '#EF4444'} strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>{metaStatus?.connected && <polyline points="22 4 12 14.01 9 11.01"/>}</svg>
                <span>Estado WhatsApp</span>
              </div>
              <div className={`${b}__usage-card-value ${b}__usage-card-value--sm`}>
                {metaStatus?.connected ? 'Conectado' : 'Desconectado'}
              </div>
              {metaStatus?.connected && metaStatus.days_until_expiry != null && (
                <span className={`${b}__usage-card-sub`}>Token expira en {metaStatus.days_until_expiry} dias</span>
              )}
            </div>

            {/* Plan */}
            <div className={`${b}__usage-card`}>
              <div className={`${b}__usage-card-header`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                <span>Plan activo</span>
              </div>
              <div className={`${b}__usage-card-value ${b}__usage-card-value--sm`}>
                {(tenant?.plan || usageStats?.plan || 'Trial').charAt(0).toUpperCase() + (tenant?.plan || usageStats?.plan || 'trial').slice(1)}
              </div>
              <span className={`${b}__usage-card-sub`}>{tenant?.name || usageStats?.name || ''}</span>
            </div>
          </div>
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

const PRESET_COLORS = [
  { name: 'Azul Corporativo', color: '#1E40AF' },
  { name: 'Verde Bosque', color: '#2D5A3D' },
  { name: 'Rojo Elegante', color: '#DC2626' },
  { name: 'Morado Premium', color: '#7C3AED' },
  { name: 'Naranja Cálido', color: '#EA580C' },
  { name: 'Turquesa Moderno', color: '#0891B2' },
  { name: 'Rosa Suave', color: '#DB2777' },
  { name: 'Índigo Profundo', color: '#4338CA' },
  { name: 'Esmeralda', color: '#059669' },
  { name: 'Slate Oscuro', color: '#334155' },
];

function BrandingPanel({ addNotification }) {
  const { tenant, refreshTenant } = useTenant();
  const [brandName, setBrandName] = useState('');
  const [brandColor, setBrandColor] = useState('#1E40AF');
  const [accentColor, setAccentColor] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const bb = 'settings';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/settings/branding`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setBrandName(data.brand_name || data.name || '');
          setBrandColor(data.brand_color || '#1E40AF');
          setAccentColor(data.brand_color_accent || '');
          setLogoUrl(data.logo_url || null);
        }
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings/branding`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brandName,
          brand_color: brandColor,
          brand_color_accent: accentColor || null,
        }),
      });
      if (res.ok) {
        addNotification('Marca actualizada — recarga para ver los cambios', 'success');
        refreshTenant();
      } else {
        addNotification('Error al guardar', 'error');
      }
    } catch (e) { addNotification(e.message, 'error'); }
    setSaving(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { addNotification('Máximo 2MB', 'error'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_URL}/settings/branding/logo`, {
        method: 'POST', credentials: 'include', body: form,
      });
      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.logo_url);
        addNotification('Logo actualizado', 'success');
        refreshTenant();
      } else {
        addNotification('Error al subir logo', 'error');
      }
    } catch (e) { addNotification(e.message, 'error'); }
    setUploading(false);
  };

  const removeLogo = async () => {
    try {
      await fetch(`${API_URL}/settings/branding`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: null }),
      });
      setLogoUrl(null);
      addNotification('Logo eliminado', 'success');
      refreshTenant();
    } catch {}
  };

  return (
    <div className={`${bb}__panel-content`}>
      <h3 className={`${bb}__panel-title`}>Marca e Identidad</h3>
      <p className={`${bb}__panel-desc`}>Personaliza la apariencia de tu plataforma. Tu equipo y clientes verán tu marca, no la nuestra.</p>

      {/* Logo */}
      <div className={`${bb}__brand-section`}>
        <label className={`${bb}__brand-label`}>Logo del negocio</label>
        <div className={`${bb}__brand-logo-area`}>
          <div className={`${bb}__brand-logo-preview`}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" />
            ) : (
              <div className={`${bb}__brand-logo-placeholder`}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Sin logo</span>
              </div>
            )}
          </div>
          <div className={`${bb}__brand-logo-actions`}>
            <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
            <button className={`${bb}__brand-btn`} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {logoUrl && <button className={`${bb}__brand-btn ${bb}__brand-btn--danger`} onClick={removeLogo}>Eliminar</button>}
            <span className={`${bb}__brand-hint`}>PNG, JPG o SVG. Máximo 2MB.</span>
          </div>
        </div>
      </div>

      {/* Brand Name */}
      <div className={`${bb}__brand-section`}>
        <label className={`${bb}__brand-label`}>Nombre de marca</label>
        <p className={`${bb}__brand-hint`}>Se muestra en el sidebar, título de la página y recibos.</p>
        <input className={`${bb}__brand-input`} value={brandName} onChange={e => setBrandName(e.target.value)}
          placeholder="Ej: AlPelo CRM, Mi Barbería, etc." />
      </div>

      {/* Save */}
      <div className={`${bb}__brand-save`}>
        <button className={`${bb}__brand-save-btn`} onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios de marca'}
        </button>
      </div>
    </div>
  );
}

export default Settings;
