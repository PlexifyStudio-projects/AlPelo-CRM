import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'instagram-inbox';

const InstagramInbox = () => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if Instagram is connected via tenant config
    fetch(`${API_URL}/settings/integrations`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then(d => setConnected(!!d.instagram_connected))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={b}><p style={{ padding: 40, color: 'rgba(0,0,0,0.3)' }}>Cargando...</p></div>;

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <h2 className={`${b}__title`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          Instagram DM
        </h2>
      </div>

      {!connected ? (
        <div className={`${b}__connect`}>
          <div className={`${b}__connect-icon`}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <h3 className={`${b}__connect-title`}>Conecta tu Instagram Business</h3>
          <p className={`${b}__connect-desc`}>
            Recibe y responde mensajes directos de Instagram desde aqui. Lina puede responder automaticamente, igual que en WhatsApp.
          </p>
          <div className={`${b}__connect-steps`}>
            <div className={`${b}__connect-step`}>
              <span className={`${b}__step-num`}>1</span>
              <div>
                <strong>Cuenta Business</strong>
                <p>Tu Instagram debe ser cuenta Business o Creator, conectada a una pagina de Facebook</p>
              </div>
            </div>
            <div className={`${b}__connect-step`}>
              <span className={`${b}__step-num`}>2</span>
              <div>
                <strong>Meta Business Suite</strong>
                <p>Vincula tu Instagram a la misma Meta Business Suite donde esta tu WhatsApp</p>
              </div>
            </div>
            <div className={`${b}__connect-step`}>
              <span className={`${b}__step-num`}>3</span>
              <div>
                <strong>Permisos de mensajeria</strong>
                <p>Activa los permisos de Instagram Messaging API en tu App de Meta</p>
              </div>
            </div>
            <div className={`${b}__connect-step`}>
              <span className={`${b}__step-num`}>4</span>
              <div>
                <strong>Listo</strong>
                <p>Los DMs de Instagram llegaran aqui junto a WhatsApp. Lina responde en ambos canales</p>
              </div>
            </div>
          </div>
          <a
            href="https://business.facebook.com/settings/instagram-accounts"
            target="_blank"
            rel="noopener noreferrer"
            className={`${b}__connect-btn`}
          >
            Ir a Meta Business Suite
          </a>
          <p className={`${b}__connect-note`}>
            Proximamente: conexion directa desde aqui. Por ahora, contacta a soporte para activar Instagram.
          </p>
        </div>
      ) : (
        <div className={`${b}__coming`}>
          <p>Instagram conectado. Los mensajes aparecerian aqui.</p>
        </div>
      )}
    </div>
  );
};

export default InstagramInbox;
