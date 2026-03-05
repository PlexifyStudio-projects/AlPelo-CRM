import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { mockWhatsAppConversations, mockWhatsAppMessages, mockClients as rawClients, mockVisitHistory } from '../../data/mockData';
import { enrichClients, STATUS } from '../../utils/clientStatus';
import { formatCurrency, daysSince } from '../../utils/formatters';

const allClients = enrichClients(rawClients, mockVisitHistory);

// ===== ICONS =====
const Icons = {
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  send: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  ),
  template: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  ),
  back: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  checkSingle: (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 5.5 5.5 10 15 1" />
    </svg>
  ),
  checkDouble: (
    <svg width="20" height="11" viewBox="0 0 20 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 5.5 5.5 10 15 1" />
      <polyline points="5 5.5 9.5 10 19 1" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  robot: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  user: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  megaphone: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
    </svg>
  ),
  play: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  pause: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  stop: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
};

// ===== HELPERS =====
const getInitials = (name) => {
  const parts = name.split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
};

const avatarColors = [
  '#00A884', '#25D366', '#128C7E', '#075E54', // WhatsApp greens
  '#1FA855', '#00BFA5', '#009688', '#4CAF50',
  '#2E7D32', '#1B5E20', '#388E3C', '#43A047',
  '#5C6BC0', '#7E57C2', '#AB47BC', '#EC407A',
  '#EF5350', '#FF7043', '#FFA726', '#29B6F6',
  '#26A69A', '#66BB6A', '#9CCC65', '#8D6E63',
];

const getAvatarColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatConvTime = (dateStr) => {
  const now = new Date('2026-03-04T12:00:00');
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return formatTime(dateStr);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return d.toLocaleDateString('es-CO', { weekday: 'short' });
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
};

const MessageStatus = ({ status }) => {
  if (status === 'sent') return <span className="inbox__check inbox__check--sent">{Icons.checkSingle}</span>;
  if (status === 'delivered') return <span className="inbox__check inbox__check--delivered">{Icons.checkDouble}</span>;
  if (status === 'read') return <span className="inbox__check inbox__check--read">{Icons.checkDouble}</span>;
  return null;
};

// ===== BLAST PANEL — Envío masivo con animación =====
const BlastPanel = ({ onClose }) => {
  const [blastState, setBlastState] = useState('idle'); // idle | running | paused | done
  const [sentCount, setSentCount] = useState(0);
  const [currentClient, setCurrentClient] = useState(null);
  const intervalRef = useRef(null);

  const inactiveClients = useMemo(() =>
    allClients
      .filter((c) => daysSince(c.lastVisit) >= 30 && c.acceptsWhatsApp)
      .sort((a, b) => daysSince(b.lastVisit) - daysSince(a.lastVisit))
      .slice(0, 12),
    []
  );

  const startBlast = useCallback(() => {
    setBlastState('running');
    let idx = sentCount;

    intervalRef.current = setInterval(() => {
      if (idx >= inactiveClients.length) {
        clearInterval(intervalRef.current);
        setBlastState('done');
        setCurrentClient(null);
        return;
      }
      setCurrentClient(inactiveClients[idx]);
      setSentCount(idx + 1);
      idx++;
    }, 3000);
  }, [sentCount, inactiveClients]);

  const pauseBlast = () => {
    clearInterval(intervalRef.current);
    setBlastState('paused');
  };

  const stopBlast = () => {
    clearInterval(intervalRef.current);
    setBlastState('done');
    setCurrentClient(null);
  };

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="inbox__blast-panel">
      <div className="inbox__blast-header">
        <div className="inbox__blast-title-row">
          <span className="inbox__blast-icon">{Icons.megaphone}</span>
          <div>
            <h3 className="inbox__blast-title">Campaña de Reactivación</h3>
            <p className="inbox__blast-subtitle">Clientes con 30+ días sin visita</p>
          </div>
        </div>
        <button className="inbox__blast-close" onClick={onClose}>{Icons.close}</button>
      </div>

      <div className="inbox__blast-stats">
        <div className="inbox__blast-stat">
          <span className="inbox__blast-stat-number">{inactiveClients.length}</span>
          <span className="inbox__blast-stat-label">Por contactar</span>
        </div>
        <div className="inbox__blast-stat inbox__blast-stat--sent">
          <span className="inbox__blast-stat-number">{sentCount}</span>
          <span className="inbox__blast-stat-label">Enviados</span>
        </div>
        <div className="inbox__blast-stat">
          <span className="inbox__blast-stat-number">{inactiveClients.length - sentCount}</span>
          <span className="inbox__blast-stat-label">Pendientes</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="inbox__blast-progress">
        <div
          className="inbox__blast-progress-fill"
          style={{ width: `${(sentCount / inactiveClients.length) * 100}%` }}
        />
      </div>

      {/* Current sending animation */}
      {currentClient && blastState === 'running' && (
        <div className="inbox__blast-sending">
          <div className="inbox__blast-sending-dot" />
          <span>Enviando a <strong>{currentClient.name}</strong>...</span>
        </div>
      )}

      {/* Client list */}
      <div className="inbox__blast-list">
        {inactiveClients.map((client, i) => {
          const isSent = i < sentCount;
          const isCurrent = currentClient?.id === client.id && blastState === 'running';
          return (
            <div
              key={client.id}
              className={`inbox__blast-item ${isSent ? 'inbox__blast-item--sent' : ''} ${isCurrent ? 'inbox__blast-item--sending' : ''}`}
            >
              <div className="inbox__blast-item-avatar" style={{ background: getAvatarColor(client.name) }}>
                {getInitials(client.name)}
              </div>
              <div className="inbox__blast-item-info">
                <span className="inbox__blast-item-name">{client.name}</span>
                <span className="inbox__blast-item-days">{daysSince(client.lastVisit)} días sin visita</span>
              </div>
              <div className="inbox__blast-item-status">
                {isSent && <span className="inbox__blast-item-check">✓ Enviado</span>}
                {isCurrent && <span className="inbox__blast-item-loading">Enviando...</span>}
                {!isSent && !isCurrent && <span className="inbox__blast-item-pending">Pendiente</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="inbox__blast-actions">
        {blastState === 'idle' && (
          <button className="inbox__blast-btn inbox__blast-btn--start" onClick={startBlast}>
            {Icons.play} Iniciar envío
          </button>
        )}
        {blastState === 'running' && (
          <>
            <button className="inbox__blast-btn inbox__blast-btn--pause" onClick={pauseBlast}>
              {Icons.pause} Pausar
            </button>
            <button className="inbox__blast-btn inbox__blast-btn--stop" onClick={stopBlast}>
              {Icons.stop} Detener
            </button>
          </>
        )}
        {blastState === 'paused' && (
          <>
            <button className="inbox__blast-btn inbox__blast-btn--start" onClick={startBlast}>
              {Icons.play} Continuar
            </button>
            <button className="inbox__blast-btn inbox__blast-btn--stop" onClick={stopBlast}>
              {Icons.stop} Detener
            </button>
          </>
        )}
        {blastState === 'done' && (
          <div className="inbox__blast-done">
            Se enviaron <strong>{sentCount}</strong> mensajes de reactivación
          </div>
        )}
      </div>
    </div>
  );
};

// ===== SCRIPTED LIVE CONVERSATIONS =====
// Delays in ms — realistic: 15 000–45 000 between messages
// Varied lengths: some 30, some 20, some 10, some 5, some NO response
const liveScripts = {

  // ── Conv-1: Miguel Ángel Torres (VIP) — 30 msgs ──
  'conv-1': [
    { from: 'client', text: 'Oye Lina, una pregunta rápida', delay: 15000 },
    { from: 'client', text: '¿Tienen gel para cabello rizado? Victor me recomendó uno la vez pasada pero no recuerdo cuál era', delay: 18000 },
    { from: 'business', text: 'Hola Miguel Ángel! Sí, Victor trabaja con el gel Eco Styler para rizos. Es muy bueno, deja el rizo definido sin que se sienta duro.', delay: 25000 },
    { from: 'client', text: 'Ese mismo! Cuánto cuesta?', delay: 20000 },
    { from: 'business', text: 'Está en $18.000 el tarro grande. Si quieres te lo separo para tu próxima cita y así lo ves con Victor.', delay: 22000 },
    { from: 'client', text: 'Dale, sepáramelo. Y aprovecho para preguntar, ¿tienen algo para la barba también? Se me reseca mucho', delay: 30000 },
    { from: 'business', text: 'Claro! Tenemos el aceite para barba que usa Julián con sus clientes. Es de argán, hidrata muy bien y huele brutal. Ese está en $22.000.', delay: 28000 },
    { from: 'client', text: 'Uy sí, ese me interesa. Sepárame los dos por fa', delay: 18000 },
    { from: 'business', text: 'Listo! Te separo el gel ($18.000) y el aceite de barba ($22.000). ¿Quieres agendar tu próxima cita? https://book.weibook.co/alpelo-peluqueria', delay: 25000 },
    { from: 'client', text: 'Sí, ya entro a agendar. Ponme con Victor como siempre, el sábado si hay', delay: 35000 },
    { from: 'business', text: 'Victor tiene disponibilidad el sábado a las 9:00 AM y a las 11:30 AM. Elige la que más te sirva por el link!', delay: 20000 },
    { from: 'client', text: 'La de las 9, madrugador jaja. Ya agendé', delay: 40000 },
    { from: 'business', text: 'Perfecto! Quedó tu cita: sábado 9:00 AM con Victor. Ahí tendrás tus dos productos listos.', delay: 22000 },
    { from: 'client', text: 'Genial. Oye Lina, otra cosa. Mi mamá cumple años el viernes y quiero regalarle algo del local. Qué me recomiendas?', delay: 35000 },
    { from: 'business', text: 'Qué detalle! Tenemos un bono regalo que se puede canjear por cualquier servicio. Lo puedes personalizar con un mensaje. Los hay de $50.000, $80.000 y $120.000.', delay: 30000 },
    { from: 'client', text: 'El de $80.000 está bien. Ella usa manicure y esas cosas. Le alcanza con eso?', delay: 25000 },
    { from: 'business', text: 'Le alcanza perfecto! Con $80.000 puede hacerse Spa Manicure + Spa Pedicure ($45.000) y le sobra para un lifting de pestañas ($35.000). Queda justo!', delay: 28000 },
    { from: 'client', text: 'Perfecto! Cómo hago para comprarlo?', delay: 20000 },
    { from: 'business', text: 'Puedes pasar a recogerlo al local o te lo mandamos digital por WhatsApp para que se lo reenvíes. ¿Cómo prefieres?', delay: 22000 },
    { from: 'client', text: 'Digital está bien, así se lo mando el viernes tempranito', delay: 25000 },
    { from: 'business', text: 'Listo! Te lo preparo y te lo envío mañana. ¿Qué mensaje quieres que lleve?', delay: 20000 },
    { from: 'client', text: 'Ponle: "Feliz cumple mamá, pásala brutal. Con amor, Miguel Ángel"', delay: 30000 },
    { from: 'business', text: 'Hermoso! Queda así. Te lo envío mañana antes del mediodía para que lo tengas listo.', delay: 22000 },
    { from: 'client', text: 'Gracias Lina! Eres una crack. Una última cosa', delay: 25000 },
    { from: 'client', text: 'Mi pana Sebastián quiere ir el mismo sábado que yo. Le puedo dar tu contacto?', delay: 18000 },
    { from: 'business', text: 'Claro que sí! Que me escriba por aquí o que agende directamente: https://book.weibook.co/alpelo-peluqueria Y recuerda que por referidos tú sumas puntos extra.', delay: 25000 },
    { from: 'client', text: 'Buenísimo, le paso el link. Cuántos puntos tengo?', delay: 22000 },
    { from: 'business', text: 'Tienes 520 puntos Miguel Ángel! Ya puedes redimir un corte gratis cuando quieras. Solo dime y lo aplico.', delay: 20000 },
    { from: 'client', text: 'Uy de una! El sábado entonces aplícame el corte gratis y solo pago la barba y cejas', delay: 30000 },
    { from: 'business', text: 'Hecho! Sábado 9:00 AM: corte gratis (520 pts) + barba ($12.000) + cejas ($8.000) = $20.000 total. Más tus dos productos. Nos vemos Miguel Ángel!', delay: 25000 },
  ],

  // ── Conv-2: Carlos Mendoza — 20 msgs ──
  'conv-2': [
    { from: 'client', text: 'Lina, una cosa más', delay: 20000 },
    { from: 'client', text: 'Mañana puedo llegar tipo 9:45 o tiene que ser 10 en punto?', delay: 15000 },
    { from: 'business', text: 'Hola Carlos! Puedes llegar a las 9:45 sin problema, Victor empieza tu corte apenas llegues.', delay: 25000 },
    { from: 'client', text: 'Perfecto. Oye y otra cosa, mi hermano quiere ir también. Puede agendar para el mismo día?', delay: 35000 },
    { from: 'business', text: 'Claro! ¿Tu hermano quiere el mismo servicio o algo diferente?', delay: 20000 },
    { from: 'client', text: 'Solo corte, nada de barba. Él es más sencillo jaja', delay: 25000 },
    { from: 'business', text: 'Jaja entendido. Que agende aquí: https://book.weibook.co/alpelo-peluqueria Mañana después de las 10:30 hay espacio con Julián.', delay: 28000 },
    { from: 'client', text: 'Le paso el link. Se llama Daniel Mendoza por si acaso', delay: 22000 },
    { from: 'business', text: 'Anotado! Si necesita ayuda para agendar, que me escriba por aquí y lo guío.', delay: 20000 },
    { from: 'client', text: 'Dale Lina. Oye, una última cosa. ¿Cuánto tengo en puntos de fidelidad?', delay: 30000 },
    { from: 'business', text: 'Tienes 340 puntos Carlos. Con 500 puedes redimir un corte gratis. Te faltan 160, unas 4 visitas más.', delay: 25000 },
    { from: 'client', text: 'Uy ya casi! Con la de mañana son 3 más', delay: 20000 },
    { from: 'business', text: 'Así es! Vas muy bien. Mañana sumas más puntos.', delay: 18000 },
    { from: 'client', text: 'Oye y cambiando de tema, vi que tienen un servicio nuevo de alisado. Eso es para hombres también?', delay: 35000 },
    { from: 'business', text: 'Sí! El alisado con keratina es unisex. Queda muy bien en cabello grueso. Toma unas 2 horas y sale en $85.000.', delay: 28000 },
    { from: 'client', text: 'Uy 2 horas es bastante. Pero me interesa, lo pienso para la próxima', delay: 25000 },
    { from: 'business', text: 'Sin problema! Cuando quieras me dices y te agendo con tiempo. Es mejor en un día que no tengas afán.', delay: 22000 },
    { from: 'client', text: 'Dale, lo pienso. Bueno Lina, mañana nos vemos entonces', delay: 20000 },
    { from: 'business', text: 'Nos vemos mañana Carlos! Tú a las 9:45 y tu hermano Daniel después de las 10:30.', delay: 22000 },
    { from: 'client', text: 'Exacto. Gracias por todo Lina!', delay: 18000 },
  ],

  // ── Conv-3: Andrés Ruiz Parra — 20 msgs ──
  'conv-3': [
    { from: 'business', text: 'Hola Andrés! Claro, sin problema. Déjame revisar el viernes...', delay: 18000 },
    { from: 'business', text: 'Tenemos a las 10:00 AM, 2:00 PM y 4:30 PM. Puedes agendar aquí: https://book.weibook.co/alpelo-peluqueria', delay: 20000 },
    { from: 'client', text: 'La de las 2 está bien. Ya agendo por el link', delay: 35000 },
    { from: 'business', text: 'Perfecto! ¿Va a ser corte + barba como siempre?', delay: 22000 },
    { from: 'client', text: 'Sí, lo de siempre. Pero esta vez quiero probar algo diferente con el corte', delay: 30000 },
    { from: 'business', text: 'Cuéntame! Julián es muy bueno con estilos nuevos. ¿Tienes alguna referencia?', delay: 25000 },
    { from: 'client', text: 'Quiero un fade medio, no tan bajo como el que me hago siempre. Algo más natural', delay: 28000 },
    { from: 'business', text: 'Buena elección! Julián hace un mid fade muy limpio. Le dejo la nota para cuando llegues.', delay: 22000 },
    { from: 'client', text: 'Genial. Oye y cuánto sale corte + barba + cejas? Quiero el combo completo', delay: 30000 },
    { from: 'business', text: 'Corte $25.000 + Barba $12.000 + Cejas $8.000 = $45.000. Quedas saliendo como modelo jaja', delay: 25000 },
    { from: 'client', text: 'Jajaja eso espero. Dale, el viernes con todo entonces', delay: 20000 },
    { from: 'client', text: 'Oye y una cosa, el parqueadero de ustedes sigue siendo el mismo?', delay: 25000 },
    { from: 'business', text: 'Sí, el mismo parqueadero público a media cuadra. $3.000 la hora. Aunque los viernes a veces se llena rápido, te recomiendo llegar unos 10 min antes.', delay: 28000 },
    { from: 'client', text: 'Buena idea, llego tipo 1:50 entonces para no estresarme', delay: 22000 },
    { from: 'business', text: 'Perfecto! Y así Julián arranca puntual contigo a las 2.', delay: 18000 },
    { from: 'client', text: 'Una última cosa Lina. Mi novia quiere hacerse las uñas. Ustedes hacen eso verdad?', delay: 35000 },
    { from: 'business', text: 'Sí! Semipermanente ($28.000), Acrigel ($35.000), Spa Manicure ($20.000). Todo con Josemith.', delay: 25000 },
    { from: 'client', text: 'Le digo que agende, ella se llama Camila. Puede ir el viernes también?', delay: 28000 },
    { from: 'business', text: 'El viernes a las 3:00 PM hay espacio con Josemith. Que agende por el link!', delay: 22000 },
    { from: 'client', text: 'Listo, le paso el link. Gracias Lina, nos vemos el viernes!', delay: 20000 },
  ],

  // ── Conv-4: Emmanuel Rojas Díaz (Nuevo) — 20 msgs ──
  'conv-4': [
    { from: 'business', text: 'Perfecto Emmanuel! Agenda tu cita del sábado aquí: https://book.weibook.co/alpelo-peluqueria', delay: 18000 },
    { from: 'client', text: 'Listo, ya agendé para las 10 am', delay: 40000 },
    { from: 'business', text: 'Tu cita quedó registrada: sábado 10:00 AM. ¿Con quién te gustaría que te atendiera?', delay: 22000 },
    { from: 'client', text: 'No conozco a nadie, es mi primera vez. ¿Quién me recomiendan?', delay: 25000 },
    { from: 'business', text: 'Te recomiendo a Victor, es nuestro barbero con más experiencia. Muy detallista con los acabados.', delay: 25000 },
    { from: 'client', text: 'Dale, con Victor. Oye, ¿cómo es el tema de estacionamiento? Voy en carro', delay: 30000 },
    { from: 'business', text: 'Estamos en Cabecera. Hay parqueadero público a media cuadra, $3.000 la hora. También zonas azules cerca.', delay: 25000 },
    { from: 'client', text: 'Ah ok perfecto. Y ¿aceptan tarjeta o solo efectivo?', delay: 22000 },
    { from: 'business', text: 'Efectivo, Nequi, Daviplata y tarjeta débito/crédito. Como prefieras.', delay: 20000 },
    { from: 'client', text: 'Por Nequi entonces que es lo más fácil', delay: 18000 },
    { from: 'business', text: 'Solo para confirmar: sábado 10:00 AM, corte + barba con Victor, pago Nequi. ¿Todo bien?', delay: 22000 },
    { from: 'client', text: 'Todo bien! Oye y una pregunta más, cuánto dura la cita?', delay: 28000 },
    { from: 'business', text: 'Corte + barba con Victor toma entre 45 minutos y 1 hora. Se toma su tiempo para que quede perfecto.', delay: 22000 },
    { from: 'client', text: 'Ok genial. Y si quiero corte + barba + cejas cuánto sale?', delay: 25000 },
    { from: 'business', text: 'El combo completo sale $45.000. Corte ($25.000) + Barba ($12.000) + Cejas ($8.000).', delay: 22000 },
    { from: 'client', text: 'Mmm puede ser. Le agrego cejas también, primera vez que me las hago jaja', delay: 30000 },
    { from: 'business', text: 'Jaja te va a gustar! Victor es muy cuidadoso con las cejas, las deja naturales pero limpias.', delay: 25000 },
    { from: 'client', text: 'Dale, actualízame la cita con cejas también por fa', delay: 20000 },
    { from: 'business', text: 'Listo Emmanuel! Sábado 10:00 AM: corte + barba + cejas con Victor. $45.000 por Nequi. Te esperamos!', delay: 25000 },
    { from: 'client', text: 'Ahí estaré puntual. Nos vemos Lina!', delay: 18000 },
  ],

  // ── Conv-5: Nicolás Pabón Serrano — 10 msgs ──
  'conv-5': [
    { from: 'client', text: '¿Cuándo tienen espacio para la próxima semana? Quiero repetir el mismo corte', delay: 25000 },
    { from: 'business', text: 'Hola Nicolás! ¿Qué día te queda mejor?', delay: 22000 },
    { from: 'client', text: 'El martes o miércoles, por la tarde', delay: 30000 },
    { from: 'business', text: 'Martes 3:00 PM o miércoles 4:00 PM con Victor. Elige aquí: https://book.weibook.co/alpelo-peluqueria', delay: 25000 },
    { from: 'client', text: 'Martes a las 3. Ya agendo', delay: 35000 },
    { from: 'business', text: 'Taper fade como la vez pasada? Le dejo la nota a Victor.', delay: 22000 },
    { from: 'client', text: 'Sí, exacto el mismo. Ese quedó perfecto', delay: 20000 },
    { from: 'business', text: 'Agrego cejas? Quedaría en $33.000 con todo.', delay: 22000 },
    { from: 'client', text: 'Dale, agrega cejas', delay: 25000 },
    { from: 'business', text: 'Listo! Martes 3:00 PM: taper fade + cejas con Victor. $33.000. Nos vemos Nicolás!', delay: 22000 },
  ],

  // ── Conv-6: David López Vargas — 20 msgs ──
  'conv-6': [
    { from: 'client', text: 'Oye Lina, tengo una duda', delay: 22000 },
    { from: 'client', text: '¿Cuánto demora el spa manicure exactamente? Tengo una reunión a las 4:30', delay: 18000 },
    { from: 'business', text: 'El Spa Manicure toma entre 40 y 50 min. Si tu cita es a las 3:00, estarías listo a las 3:50 máximo.', delay: 28000 },
    { from: 'client', text: 'Ah perfecto, me alcanza. Josemith es buena?', delay: 25000 },
    { from: 'business', text: 'Josemith es excelente! Mejor calificación del equipo en spa manicure. Vas a quedar contento.', delay: 25000 },
    { from: 'client', text: 'Bueno, confío. Oye y tienen pedicure? Mi esposa quiere saber', delay: 30000 },
    { from: 'business', text: 'Sí! Spa Pedicure $25.000 y Pedicure Express $18.000. También con Josemith.', delay: 22000 },
    { from: 'client', text: 'Mi esposa se llama Marcela. ¿Puede ir el mismo día?', delay: 25000 },
    { from: 'business', text: 'A las 4:00 PM hay espacio. Así cuando tú termines ella entra. Que agende: https://book.weibook.co/alpelo-peluqueria', delay: 28000 },
    { from: 'client', text: 'Le paso el link. ¿El pedicure cuánto demora?', delay: 22000 },
    { from: 'business', text: 'Aproximadamente 50 minutos. Si entra a las 4:00, lista a las 4:50.', delay: 20000 },
    { from: 'client', text: 'Entonces yo a las 3 y ella a las 4', delay: 18000 },
    { from: 'business', text: 'Listo! Tú: Spa Manicure 3:00 PM. Marcela: Spa Pedicure 4:00 PM. Ambos con Josemith.', delay: 25000 },
    { from: 'client', text: 'Ella ya está agendando. Oye y una cosa más', delay: 30000 },
    { from: 'client', text: 'Ustedes hacen masaje de manos? Vi eso en el Instagram', delay: 18000 },
    { from: 'business', text: 'El Spa Manicure incluye un masaje de manos relajante como parte del servicio. No es aparte, ya viene incluido!', delay: 25000 },
    { from: 'client', text: 'Ah genial, no sabía eso. Mejor aún', delay: 20000 },
    { from: 'business', text: 'Sí! Es uno de los servicios más completos que tenemos. Vas a salir relajado.', delay: 22000 },
    { from: 'client', text: 'Bueno Lina, nos vemos mañana entonces. Gracias por todo!', delay: 25000 },
    { from: 'business', text: 'Los esperamos David! Que tengan buena tarde.', delay: 20000 },
  ],

  // ── Conv-7: Valentina Morales Cruz — 20 msgs ──
  'conv-7': [
    { from: 'client', text: 'Hola Lina!', delay: 30000 },
    { from: 'client', text: 'Mi amiga Laura vio mis pestañas y quiere ir también. ¿Cómo agenda?', delay: 18000 },
    { from: 'business', text: 'Hola Valentina! Laura puede agendar aquí: https://book.weibook.co/alpelo-peluqueria', delay: 25000 },
    { from: 'business', text: 'Por ser referida tuya tiene 10% de descuento en su primera visita.', delay: 15000 },
    { from: 'client', text: 'Genial! ¿El lifting cuánto le sale con descuento?', delay: 28000 },
    { from: 'business', text: '$35.000 con 10% = $31.500. Lo hace Camila, que te atendió a ti.', delay: 25000 },
    { from: 'client', text: 'Perfecto. Oye, ¿ustedes hacen uñas también?', delay: 30000 },
    { from: 'business', text: 'Sí! Spa Manicure ($20.000), Semipermanente ($28.000) y Acrigel ($35.000). Con Josemith.', delay: 22000 },
    { from: 'client', text: 'Me interesa el semipermanente. ¿Puedo agendar el mismo día que Laura?', delay: 25000 },
    { from: 'business', text: '¿Qué día le queda bien a Laura?', delay: 20000 },
    { from: 'client', text: 'El viernes por la mañana', delay: 30000 },
    { from: 'business', text: 'Viernes 10:00 AM Laura (lifting con Camila) y 10:30 tú (semipermanente con Josemith). ¿Les funciona?', delay: 28000 },
    { from: 'client', text: 'Perfecto! Las dos agendamos por el link', delay: 22000 },
    { from: 'business', text: 'Recuerda decirle a Laura que mencione tu nombre para el descuento. Tú sumas puntos por referida!', delay: 25000 },
    { from: 'client', text: 'Sí! Oye Lina y otra pregunta, ¿qué colores tienen en semipermanente?', delay: 35000 },
    { from: 'business', text: 'Josemith maneja toda la carta de colores: nude, rosado, rojo, vino, negro, french, y los de temporada. Puedes llevar referencia también.', delay: 28000 },
    { from: 'client', text: 'Quiero nude o rosado, algo discreto para la oficina', delay: 22000 },
    { from: 'business', text: 'Perfecto! Le dejo la nota a Josemith. El nude queda muy elegante, es el más pedido.', delay: 25000 },
    { from: 'client', text: 'Dale, nude entonces. Gracias Lina, eres la mejor!', delay: 20000 },
    { from: 'business', text: 'Gracias a ti Valentina! Las esperamos el viernes.', delay: 22000 },
  ],

  // ── Conv-8: Esteban Capacho León — 10 msgs ──
  'conv-8': [
    { from: 'client', text: 'Hola, una pregunta', delay: 25000 },
    { from: 'client', text: 'Carlos me dijo que pidiera con Victor, pero en el link no sale para elegir barbero', delay: 18000 },
    { from: 'business', text: 'No te preocupes Esteban! El barbero se asigna desde aquí. Ya te anoté con Victor para el jueves 3:00 PM.', delay: 28000 },
    { from: 'client', text: 'Ah ok. Yo nunca he ido a una barbería pro. ¿Cómo es el proceso?', delay: 30000 },
    { from: 'business', text: 'Muy sencillo! Llegas, te sientas con Victor, le cuentas qué estilo quieres. Si tienes foto de referencia, llévala. Él te asesora.', delay: 30000 },
    { from: 'client', text: 'Quiero algo tipo fade. Cuánto vale solo el corte?', delay: 35000 },
    { from: 'business', text: 'Corte solo $25.000. Si agregas barba $12.000 más, cejas $8.000. Victor es especialista en fades.', delay: 25000 },
    { from: 'client', text: 'Solo corte por ahora. Oye y Carlos dice que tiene puntos, ¿yo también puedo?', delay: 30000 },
    { from: 'business', text: 'Sí! Desde tu primera visita empiezas a acumular. Con 500 puntos puedes redimir un corte gratis.', delay: 25000 },
    { from: 'client', text: 'Buenísimo! Nos vemos el jueves Lina, gracias!', delay: 22000 },
  ],

  // ── Conv-9: Juan Pablo Pérez — 5 msgs (quick confirm) ──
  'conv-9': [
    { from: 'client', text: 'Oye Lina, mañana puedo cambiar la hora? En vez de las 3 a las 4?', delay: 20000 },
    { from: 'business', text: 'Hola Juan Pablo! A las 4:00 PM hay espacio con Memo. Te cambio?', delay: 25000 },
    { from: 'client', text: 'Sí porfa, a las 4 mejor', delay: 30000 },
    { from: 'business', text: 'Listo! Queda tu cita: mañana 4:00 PM con Memo. Corte hipster como siempre.', delay: 22000 },
    { from: 'client', text: 'Gracias Lina, nos vemos!', delay: 18000 },
  ],

  // ── Conv-10: Santiago Reyes Duarte — 30 msgs (largo, cliente indeciso) ──
  'conv-10': [
    { from: 'client', text: 'Bueno la verdad sí quiero ir pero no sé qué hacerme', delay: 25000 },
    { from: 'business', text: 'Tranquilo Santiago! Para eso estamos. ¿Qué tipo de cabello tienes? Liso, ondulado, rizado?', delay: 28000 },
    { from: 'client', text: 'Ondulado, medio grueso. Ahora lo tengo largo porque no me corto hace como 2 meses', delay: 30000 },
    { from: 'business', text: 'Ok! Con cabello ondulado y grueso hay varias opciones. ¿Quieres algo corto o prefieres dejarlo con algo de largo arriba?', delay: 25000 },
    { from: 'client', text: 'Algo con largo arriba. No quiero quedar pelado jaja', delay: 22000 },
    { from: 'business', text: 'Jaja entendido. Un textured crop o un mid fade con volumen arriba te quedaría muy bien. Los dos dejan largo arriba pero limpio a los lados.', delay: 30000 },
    { from: 'client', text: 'Cuál es la diferencia?', delay: 25000 },
    { from: 'business', text: 'El textured crop es más desenfadado, tipo europeo, con flequillo texturizado. El mid fade es más definido, degradado limpio a los lados. Los dos son muy solicitados.', delay: 35000 },
    { from: 'client', text: 'El mid fade suena bien. Victor sabe hacer eso?', delay: 28000 },
    { from: 'business', text: 'Victor es el mejor en fades del equipo. Es su especialidad. Te recomiendo ir con él.', delay: 22000 },
    { from: 'client', text: 'Dale. Y la barba? Porque la tengo descuidada', delay: 25000 },
    { from: 'business', text: 'Un perfilado de barba te deja todo definido y limpio. Con el mid fade + barba perfilada quedas impecable. Sale $37.000 el combo.', delay: 28000 },
    { from: 'client', text: 'Cuánto solo el corte?', delay: 20000 },
    { from: 'business', text: '$25.000 solo corte. Barba aparte $12.000. Cejas $8.000 si quieres agregar.', delay: 22000 },
    { from: 'client', text: 'Mmm voy con corte + barba entonces. $37.000?', delay: 30000 },
    { from: 'business', text: 'Correcto! ¿Cuándo quieres venir? Esta semana hay buena disponibilidad.', delay: 22000 },
    { from: 'client', text: 'El jueves puedo. Qué horarios hay?', delay: 28000 },
    { from: 'business', text: 'Jueves con Victor: 9:00 AM, 11:00 AM, 2:00 PM y 4:30 PM. ¿Cuál te sirve?', delay: 25000 },
    { from: 'client', text: 'Las 11 está bien. Puedo agendar por el link?', delay: 22000 },
    { from: 'business', text: 'Sí! Agenda aquí: https://book.weibook.co/alpelo-peluqueria Elige jueves 11:00 AM.', delay: 22000 },
    { from: 'client', text: 'Listo, ya agendé. Oye pero una duda, si no me gusta el mid fade puedo cambiar?', delay: 35000 },
    { from: 'business', text: 'Claro! Victor siempre consulta contigo antes de empezar. Te muestra opciones y entre los dos deciden. No hace nada sin tu aprobación.', delay: 28000 },
    { from: 'client', text: 'Bueno eso me tranquiliza. Es que una vez fui a otro lado y me dejaron pelado', delay: 25000 },
    { from: 'business', text: 'Jaja eso no va a pasar aquí! Victor es muy cuidadoso y detallista. Si llevas una foto de referencia mejor, así queda claro desde el inicio.', delay: 30000 },
    { from: 'client', text: 'Dale, busco unas fotos y las llevo. Oye y puedo pagar con Nequi?', delay: 22000 },
    { from: 'business', text: 'Sí! Aceptamos Nequi, Daviplata, efectivo y tarjeta.', delay: 20000 },
    { from: 'client', text: 'Perfecto. Cuánto demora el corte + barba?', delay: 25000 },
    { from: 'business', text: 'Entre 45 minutos y 1 hora. Victor se toma su tiempo.', delay: 22000 },
    { from: 'client', text: 'Ok, entonces jueves 11, salgo tipo 12. Perfecto para almorzar después jaja', delay: 28000 },
    { from: 'business', text: 'Exacto! Quedas listo y sales a almorzar como nuevo. Te esperamos el jueves Santiago!', delay: 25000 },
  ],

  // ── Conv-11: Camilo Hernández Ríos — 5 msgs (responde tarde) ──
  'conv-11': [
    { from: 'business', text: '¿Quieres que te reagende para esta semana? Tenemos buena disponibilidad.', delay: 25000 },
    { from: 'client', text: 'Hola Lina, perdón por no responder antes. Sí, se me olvidó la cita', delay: 45000 },
    { from: 'business', text: 'No te preocupes Camilo! ¿Quieres reagendar? Esta semana hay espacio con Victor.', delay: 25000 },
    { from: 'client', text: 'Sí, el viernes por la tarde puede ser?', delay: 30000 },
    { from: 'business', text: 'Viernes 3:00 PM con Victor. Agenda aquí: https://book.weibook.co/alpelo-peluqueria Te esperamos!', delay: 22000 },
  ],

  // ── Conv-12: Sebastián Cárdenas Leal — 10 msgs ──
  'conv-12': [
    { from: 'client', text: 'Oye, ya agendé para el jueves. Pero me quedó con Samuel, quiero con Victor', delay: 20000 },
    { from: 'business', text: 'Hola Sebastián! Déjame revisar... El jueves Victor tiene espacio a las 2:00 PM. ¿Te cambio?', delay: 28000 },
    { from: 'client', text: 'Sí porfa, a las 2 con Victor', delay: 22000 },
    { from: 'business', text: 'Listo! Te cambié: jueves 2:00 PM con Victor. Corte + barba.', delay: 25000 },
    { from: 'client', text: 'Gracias. Oye y me puedes agregar cejas?', delay: 30000 },
    { from: 'business', text: 'Claro! Corte + barba + cejas = $45.000. Te agrego cejas.', delay: 22000 },
    { from: 'client', text: 'Dale. Cuántos puntos tengo?', delay: 25000 },
    { from: 'business', text: 'Tienes 280 puntos Sebastián. Con 500 redimes un corte gratis. Te faltan 220.', delay: 25000 },
    { from: 'client', text: 'Ok, voy sumando. Nos vemos el jueves Lina', delay: 20000 },
    { from: 'business', text: 'Nos vemos! Jueves 2:00 PM con Victor. Que tengas buena semana.', delay: 22000 },
  ],

  // ── Conv-13: Mateo Gómez Plata — 5 msgs (confirma rápido) ──
  'conv-13': [
    { from: 'client', text: 'Listo Lina, ahí estaré mañana', delay: 35000 },
    { from: 'business', text: 'Perfecto Mateo! Mañana 11:00 AM con Memo. Corte + cejas. Te esperamos!', delay: 22000 },
    { from: 'client', text: 'Una pregunta, aceptan Daviplata?', delay: 30000 },
    { from: 'business', text: 'Sí! Daviplata, Nequi, efectivo y tarjeta. Como prefieras.', delay: 22000 },
    { from: 'client', text: 'Dale, por Daviplata entonces. Nos vemos!', delay: 20000 },
  ],

  // ── Conv-14: Fabián Andrés Capacho Rincón — 20 msgs ──
  'conv-14': [
    { from: 'business', text: 'Mañana 4:00 PM con Andrés, corte + barba. Te confirmo?', delay: 18000 },
    { from: 'client', text: 'Sí, confirmado. Oye pero tengo una pregunta', delay: 25000 },
    { from: 'client', text: 'Quiero un diseño en el fade esta vez. Ustedes hacen eso?', delay: 18000 },
    { from: 'business', text: 'Sí Fabián! Andrés hace diseños en el fade. Líneas, figuras geométricas, lo que quieras. Tiene muy buen pulso.', delay: 28000 },
    { from: 'client', text: 'Uy qué chimba. Cuánto más sale con diseño?', delay: 22000 },
    { from: 'business', text: 'El diseño tiene un costo adicional de $8.000. Entonces corte + barba + diseño = $45.000.', delay: 25000 },
    { from: 'client', text: 'Dale, agrégueme el diseño. Quiero unas líneas en el lateral', delay: 28000 },
    { from: 'business', text: 'Perfecto! Le dejo la nota a Andrés: fade con líneas laterales. Si llevas referencia mejor.', delay: 25000 },
    { from: 'client', text: 'Sí, tengo unas fotos. Las llevo mañana', delay: 20000 },
    { from: 'business', text: 'Listo! ¿Algo más que necesites?', delay: 22000 },
    { from: 'client', text: 'Sí una cosa más. Mi primo también quiere ir. Tiene espacio mañana después de mí?', delay: 30000 },
    { from: 'business', text: '¿Tu primo quiere corte simple o algo más complejo?', delay: 22000 },
    { from: 'client', text: 'Solo corte, él es más tranquilo', delay: 20000 },
    { from: 'business', text: 'A las 5:00 PM hay espacio con Andrés. Que agende aquí: https://book.weibook.co/alpelo-peluqueria', delay: 25000 },
    { from: 'client', text: 'Le paso el link. Se llama Brayan Capacho', delay: 22000 },
    { from: 'business', text: 'Anotado! Si necesita ayuda para agendar, que me escriba.', delay: 20000 },
    { from: 'client', text: 'Dale. Oye y ustedes tienen Instagram? Quiero ver trabajos de Andrés', delay: 28000 },
    { from: 'business', text: 'Sí! Síguenos en @SomosAlpelo ahí subimos todos los trabajos del equipo. Andrés tiene varios diseños publicados.', delay: 25000 },
    { from: 'client', text: 'Ya los sigo, acabo de ver. Se ve brutal el trabajo de Andrés', delay: 30000 },
    { from: 'business', text: 'Te va a encantar! Mañana a las 4:00 PM. Nos vemos Fabián!', delay: 22000 },
  ],

  // ── Conv-15: Karen Lizeth Amaya Soto — 10 msgs ──
  'conv-15': [
    { from: 'client', text: 'Hola Lina! Oye quiero cambiar el semipermanente por acrigel. Se puede?', delay: 22000 },
    { from: 'business', text: 'Hola Karen! Claro, el acrigel sale en $35.000 en vez de $28.000. ¿Te cambio?', delay: 28000 },
    { from: 'client', text: 'Sí porfa. Es que quiero que duren más', delay: 25000 },
    { from: 'business', text: 'Buena decisión! El acrigel dura entre 3 y 4 semanas. Josemith las deja divinas.', delay: 22000 },
    { from: 'client', text: 'Perfecto. Oye y puedo llevar mi propio diseño?', delay: 30000 },
    { from: 'business', text: 'Sí! Lleva fotos de referencia y Josemith te asesora. Ella puede replicar casi cualquier diseño.', delay: 25000 },
    { from: 'client', text: 'Genial. Quiero algo en tonos nude con un detalle en dorado', delay: 22000 },
    { from: 'business', text: 'Hermoso! Josemith tiene brillos dorados y pigmentos metallic. Queda elegante. Le dejo tu nota.', delay: 28000 },
    { from: 'client', text: 'Buenísimo! Entonces sábado 10 AM, acrigel con Josemith', delay: 20000 },
    { from: 'business', text: 'Confirmado Karen! Te esperamos el sábado. Va a quedar espectacular!', delay: 22000 },
  ],

  // ── Conv-16: Robinson Ferney Patiño — 10 msgs (reactivación exitosa) ──
  'conv-16': [
    { from: 'client', text: 'Hola! Sí la verdad sí me hacía falta un corte jaja', delay: 40000 },
    { from: 'business', text: 'Hola Robinson! Nos alegra saber de ti! ¿Cuándo quieres venir?', delay: 25000 },
    { from: 'client', text: 'Esta semana puede ser. Qué días hay?', delay: 28000 },
    { from: 'business', text: 'Hay espacio jueves y viernes. ¿Corte + barba como siempre?', delay: 22000 },
    { from: 'client', text: 'Sí, lo de siempre. El jueves por la mañana', delay: 30000 },
    { from: 'business', text: 'Jueves 10:00 AM con Samuel. Agenda aquí: https://book.weibook.co/alpelo-peluqueria', delay: 25000 },
    { from: 'client', text: 'Listo, ya agendé. Cuánto sale ahora? Seguro subió de precio jaja', delay: 35000 },
    { from: 'business', text: 'Jaja sigue en $37.000 el corte + barba. Mismo precio! Y por volver después de tanto tiempo te damos un 10% de descuento: $33.300.', delay: 28000 },
    { from: 'client', text: 'Uy qué buena onda. Entonces nos vemos el jueves!', delay: 22000 },
    { from: 'business', text: 'Te esperamos Robinson! No te nos pierdas otra vez jaja. Jueves 10:00 AM con Samuel.', delay: 25000 },
  ],

  // ── Conv-17: Harold Steven Pineda Solano — 20 msgs ──
  'conv-17': [
    { from: 'business', text: 'Hola Harold! La promo es Corte + Barba + Cejas por $40.000 (normalmente $45.000). Válida hasta el sábado.', delay: 18000 },
    { from: 'client', text: 'Uy qué oferta. Cuándo puedo ir?', delay: 30000 },
    { from: 'business', text: 'Esta semana hay espacio jueves, viernes y sábado. ¿Qué día te queda?', delay: 25000 },
    { from: 'client', text: 'El viernes, por la mañana si puede ser', delay: 28000 },
    { from: 'business', text: 'Viernes a las 9:00 AM o 10:30 AM con Victor. ¿Cuál prefieres?', delay: 22000 },
    { from: 'client', text: '10:30 está bien', delay: 20000 },
    { from: 'business', text: 'Agenda aquí: https://book.weibook.co/alpelo-peluqueria Elige viernes 10:30 AM.', delay: 22000 },
    { from: 'client', text: 'Listo, ya agendé. La promo se aplica automática?', delay: 35000 },
    { from: 'business', text: 'Sí! Al llegar solo menciona la promo y te cobran $40.000 en vez de $45.000.', delay: 22000 },
    { from: 'client', text: 'Perfecto. Oye y tengo una pregunta aparte', delay: 28000 },
    { from: 'client', text: 'Mi cabello se me está cayendo mucho últimamente. ¿Ustedes hacen algún tratamiento para eso?', delay: 20000 },
    { from: 'business', text: 'Harold, no tenemos tratamiento capilar como tal, pero Victor puede evaluarte y recomendarte productos. También podemos referirte con un dermatólogo si es algo más serio.', delay: 35000 },
    { from: 'client', text: 'Dale, le pregunto a Victor el viernes entonces', delay: 22000 },
    { from: 'business', text: 'Perfecto! Él sabe mucho de cuidado capilar. Te va a dar buenos tips.', delay: 25000 },
    { from: 'client', text: 'Gracias Lina. Oye y una cosa más, puedo llevar a mi hijo? Él quiere un corte también', delay: 30000 },
    { from: 'business', text: 'Claro! ¿Cuántos años tiene?', delay: 20000 },
    { from: 'client', text: '12 años. Quiere un fade como los youtubers jaja', delay: 25000 },
    { from: 'business', text: 'Jaja seguro! El corte para menores sale en $20.000. Puedo agendarle a las 11:15, justo después de ti.', delay: 28000 },
    { from: 'client', text: 'Perfecto! Se va a emocionar. Se llama Santiago', delay: 22000 },
    { from: 'business', text: 'Anotado! Harold 10:30 AM ($40.000 promo) + Santiago 11:15 AM ($20.000). Los dos con Victor. Nos vemos el viernes!', delay: 28000 },
  ],

  // ── Conv-18: Cristian Camilo Ordóñez Vega — 30 msgs (cambio de look extenso) ──
  'conv-18': [
    { from: 'business', text: 'Hola Cristian! Un cambio de look total suena genial. Cuéntame, ¿qué tienes en mente?', delay: 18000 },
    { from: 'client', text: 'Pues la verdad quiero algo completamente diferente. Siempre me hago el mismo corte y estoy aburrido', delay: 30000 },
    { from: 'business', text: 'Entiendo! ¿Cómo tienes el cabello ahora? Largo, corto, qué tipo?', delay: 25000 },
    { from: 'client', text: 'Medio largo, liso. Siempre me hago corte clásico a los lados y arriba. Muy aburrido', delay: 28000 },
    { from: 'business', text: 'Ok! Con cabello liso y largo hay muchas opciones. ¿Te gusta algo más atrevido o prefieres cambio sutil pero notable?', delay: 30000 },
    { from: 'client', text: 'Atrevido. Quiero que la gente note el cambio', delay: 22000 },
    { from: 'business', text: 'Entonces te recomiendo un high fade bien definido con textura arriba, o un mullet moderno que está muy de moda. ¿Alguno te llama?', delay: 28000 },
    { from: 'client', text: 'El high fade suena bien. Mullet no jaja, muy arriesgado para mí', delay: 25000 },
    { from: 'business', text: 'Jaja el high fade es perfecto entonces. Limpio a los lados, volumen con textura arriba. Y si le agregas un diseño queda brutal.', delay: 30000 },
    { from: 'client', text: 'Diseño? Cómo así?', delay: 20000 },
    { from: 'business', text: 'Unas líneas en el fade, o una figura geométrica. Andrés es muy bueno en diseños si quieres ir con él.', delay: 25000 },
    { from: 'client', text: 'Uy eso me gusta. Sí, quiero diseño. Cuánto sale todo?', delay: 28000 },
    { from: 'business', text: 'High fade + diseño = $33.000. Si agregas barba perfilada son $45.000 y cejas $53.000 el combo total.', delay: 25000 },
    { from: 'client', text: 'Voy con todo. Corte, diseño, barba y cejas. Cambio completo', delay: 22000 },
    { from: 'business', text: 'Así se habla! $53.000 el cambio total. ¿Cuándo quieres venir?', delay: 22000 },
    { from: 'client', text: 'Este sábado puede ser? Quiero estar listo para una fiesta el sábado en la noche', delay: 30000 },
    { from: 'business', text: 'El sábado con Andrés hay espacio a las 10:00 AM y a la 1:00 PM. ¿Cuál te sirve?', delay: 25000 },
    { from: 'client', text: 'La de la 1 para salir fresco para la noche jaja', delay: 22000 },
    { from: 'business', text: 'Jaja buena estrategia! Agenda aquí: https://book.weibook.co/alpelo-peluqueria Sábado 1:00 PM con Andrés.', delay: 25000 },
    { from: 'client', text: 'Ya agendé. Oye y cuánto demora todo eso junto?', delay: 35000 },
    { from: 'business', text: 'High fade + diseño + barba + cejas toma aproximadamente 1 hora y 15 minutos. Andrés se toma su tiempo para que quede perfecto.', delay: 28000 },
    { from: 'client', text: 'Ok, entonces de 1 a 2:15 más o menos. Bien', delay: 22000 },
    { from: 'client', text: 'Oye y tienen productos para estilizar? Quiero mantener el look en la fiesta', delay: 25000 },
    { from: 'business', text: 'Sí! Tenemos cera mate ($15.000) y pomada con brillo ($18.000). Para un high fade te recomiendo la cera mate, da textura sin verse grasoso.', delay: 30000 },
    { from: 'client', text: 'La cera mate suena bien. La compro el sábado', delay: 22000 },
    { from: 'business', text: 'Te la separo! Andrés te enseña cómo aplicarla después del corte para que sepas mantener el estilo en casa.', delay: 25000 },
    { from: 'client', text: 'Buenísimo. Una última cosa, puedo pagar con tarjeta?', delay: 20000 },
    { from: 'business', text: 'Sí! Tarjeta débito/crédito, Nequi, Daviplata o efectivo.', delay: 20000 },
    { from: 'client', text: 'Por tarjeta entonces. Bueno Lina, nos vemos el sábado. Voy a quedar como nuevo!', delay: 28000 },
    { from: 'business', text: 'Vas a quedar increíble Cristian! Sábado 1:00 PM con Andrés, cambio de look completo + cera mate. A romperla en la fiesta!', delay: 25000 },
  ],

  // ── Conv-19: Jhon Fredy Blanco (INBOUND — quiere cita hoy) — 10 msgs ──
  'conv-19': [
    { from: 'business', text: 'Hola Jhon Fredy! Déjame revisar disponibilidad para hoy...', delay: 18000 },
    { from: 'business', text: 'Hoy a las 2:00 PM hay espacio con Julián y a las 4:30 PM con Victor. ¿Cuál te sirve?', delay: 20000 },
    { from: 'client', text: 'La de las 4:30 con Victor por fa', delay: 30000 },
    { from: 'business', text: 'Listo! ¿Corte + barba como siempre?', delay: 22000 },
    { from: 'client', text: 'Sí, lo de siempre. Pero hoy quiero que me deje el fade más bajo que la última vez', delay: 25000 },
    { from: 'business', text: 'Le dejo la nota a Victor: low fade, más bajo que la vez anterior. ¿Algo más?', delay: 22000 },
    { from: 'client', text: 'No, eso es todo. Cuánto es?', delay: 20000 },
    { from: 'business', text: 'Corte + barba $37.000. Efectivo, Nequi o tarjeta.', delay: 20000 },
    { from: 'client', text: 'Dale, llevo efectivo. Nos vemos a las 4:30', delay: 22000 },
    { from: 'business', text: 'Te esperamos Jhon Fredy! Hoy 4:30 PM con Victor, low fade + barba. Nos vemos!', delay: 22000 },
  ],

  // ── Conv-20: Oscar Mauricio Jaimes (INBOUND — pregunta precios) — 20 msgs ──
  'conv-20': [
    { from: 'business', text: 'Hola Oscar! El corte hipster está en $25.000. ¿Te gustaría agendar?', delay: 18000 },
    { from: 'client', text: 'Y con barba cuánto sale?', delay: 28000 },
    { from: 'business', text: 'Corte hipster + barba = $37.000. Y si le agregas cejas queda en $45.000.', delay: 22000 },
    { from: 'client', text: 'Ok. Y tienen el servicio de alisado con keratina?', delay: 30000 },
    { from: 'business', text: 'Sí! El alisado con keratina sale en $85.000. Toma aproximadamente 2 horas. Queda muy bien en cabello rebelde.', delay: 28000 },
    { from: 'client', text: 'Uy 2 horas es harto. Pero me interesa. Mi cabello es muy crespo y no sé qué hacer con él', delay: 30000 },
    { from: 'business', text: 'Con la keratina el cabello queda liso y manejable por 3-4 meses. Es la mejor opción para cabello crespo. Victor tiene mucha experiencia con eso.', delay: 30000 },
    { from: 'client', text: 'Mmm suena bien. Puedo hacer corte + keratina el mismo día?', delay: 25000 },
    { from: 'business', text: 'Sí, se recomienda hacer primero la keratina y luego el corte. Tomaría unas 2 horas y media en total. $110.000 el combo.', delay: 28000 },
    { from: 'client', text: 'Ok déjame pensarlo. Por ahora me hago solo el corte hipster', delay: 25000 },
    { from: 'business', text: 'Perfecto! ¿Cuándo quieres venir?', delay: 20000 },
    { from: 'client', text: 'Este viernes puede ser. Qué horarios hay?', delay: 28000 },
    { from: 'business', text: 'Viernes con Julián: 9:00 AM, 11:00 AM, 2:00 PM. ¿Cuál te sirve?', delay: 22000 },
    { from: 'client', text: 'Las 11 está bien. Julián hace buen corte hipster?', delay: 25000 },
    { from: 'business', text: 'Julián es muy bueno con el hipster! Es uno de los estilos que más hace. Le queda impecable.', delay: 25000 },
    { from: 'client', text: 'Dale, con Julián entonces. Cómo agendo?', delay: 22000 },
    { from: 'business', text: 'Agenda aquí: https://book.weibook.co/alpelo-peluqueria Elige viernes 11:00 AM.', delay: 22000 },
    { from: 'client', text: 'Listo, ya agendé. Gracias por toda la info', delay: 35000 },
    { from: 'business', text: 'Con gusto Oscar! Viernes 11:00 AM con Julián, corte hipster $25.000. Nos vemos!', delay: 22000 },
    { from: 'client', text: 'Nos vemos, gracias Lina!', delay: 20000 },
  ],

  // ── Conv-21: Daniela Fernanda Rueda (INBOUND — disponibilidad mañana) — 15 msgs ──
  'conv-21': [
    { from: 'business', text: 'Hola Daniela! Sí, mañana hay disponibilidad. ¿Qué servicio te interesa?', delay: 18000 },
    { from: 'client', text: 'Quiero semipermanente + pedicure. Las dos cosas se pueden el mismo día?', delay: 28000 },
    { from: 'business', text: 'Sí! Semipermanente ($28.000) + Pedicure Tradicional ($18.000) = $46.000. Con Josemith las dos.', delay: 25000 },
    { from: 'client', text: 'Perfecto. A qué hora hay espacio?', delay: 22000 },
    { from: 'business', text: 'Mañana a las 9:00 AM, 11:30 AM y 2:00 PM. ¿Cuál prefieres?', delay: 22000 },
    { from: 'client', text: 'Las 11:30 está bien', delay: 25000 },
    { from: 'business', text: 'Agenda aquí: https://book.weibook.co/alpelo-peluqueria Elige mañana 11:30 AM.', delay: 22000 },
    { from: 'client', text: 'Listo, ya agendé. Oye y puedo llevar mi propio esmalte?', delay: 30000 },
    { from: 'business', text: 'Sí, puedes llevar tu esmalte sin problema! Aunque Josemith tiene una carta de colores muy completa por si quieres ver opciones.', delay: 28000 },
    { from: 'client', text: 'Ah bueno, entonces veo allá. ¿Cuánto demora todo junto?', delay: 22000 },
    { from: 'business', text: 'Semipermanente toma 40 min y pedicure 35 min. En total como 1 hora y 15 minutos.', delay: 25000 },
    { from: 'client', text: 'Ok, perfecto. Entro a las 11:30 y salgo tipo 12:45', delay: 22000 },
    { from: 'business', text: 'Exacto! Justo para almorzar después.', delay: 20000 },
    { from: 'client', text: 'Jaja sí, eso mismo pensé. Bueno Lina, nos vemos mañana!', delay: 22000 },
    { from: 'business', text: 'Nos vemos Daniela! Mañana 11:30 AM con Josemith. Que tengas buena tarde.', delay: 22000 },
  ],

  // ── Conv-22: Yesid Orlando Mantilla (INBOUND — reagendar) — 10 msgs ──
  'conv-22': [
    { from: 'business', text: 'Hola Yesid! Claro, te ayudo a reagendar. ¿Para qué día te queda mejor?', delay: 18000 },
    { from: 'client', text: 'El viernes o sábado, por la mañana', delay: 30000 },
    { from: 'business', text: 'Viernes 9:00 AM o sábado 10:00 AM con tu barbero de siempre. ¿Cuál prefieres?', delay: 25000 },
    { from: 'client', text: 'Sábado 10 AM está bien', delay: 22000 },
    { from: 'business', text: 'Listo! Te reagendé: sábado 10:00 AM. Corte + cejas como siempre.', delay: 22000 },
    { from: 'client', text: 'Perfecto. Oye, esta vez quiero probar el corte con navaja. Ustedes hacen eso?', delay: 35000 },
    { from: 'business', text: 'Sí! El acabado con navaja le da un terminado más natural al fade. No tiene costo adicional, es parte del corte.', delay: 28000 },
    { from: 'client', text: 'Genial, entonces que me hagan con navaja esta vez', delay: 22000 },
    { from: 'business', text: 'Le dejo la nota al barbero: acabado con navaja. Nos vemos el sábado Yesid!', delay: 22000 },
    { from: 'client', text: 'Gracias Lina, nos vemos!', delay: 18000 },
  ],

  // ── Conv-23: Luis García (NUEVO — no es cliente, pregunta cómo agendar) — 20 msgs ──
  'conv-23': [
    { from: 'business', text: 'Hola Luis! Bienvenido a Al Pelo. Puedes agendar tu cita aquí: https://book.weibook.co/alpelo-peluqueria ¿Qué servicio te interesa?', delay: 18000 },
    { from: 'client', text: 'Gracias! Quiero un corte pero no sé cuál elegir. Nunca he ido a una barbería profesional', delay: 35000 },
    { from: 'business', text: 'No te preocupes! Nuestros barberos te asesoran cuando llegues. ¿Qué tipo de cabello tienes? Liso, ondulado, rizado?', delay: 25000 },
    { from: 'client', text: 'Liso, medio grueso', delay: 22000 },
    { from: 'business', text: 'Con cabello liso y grueso hay muchas opciones: fade clásico, textured crop, pompadour... ¿Quieres algo moderno o más clásico?', delay: 28000 },
    { from: 'client', text: 'Algo moderno, que se vea bien para la oficina pero no tan loco', delay: 30000 },
    { from: 'business', text: 'Un mid fade con textura arriba es perfecto para eso. Profesional pero con estilo. Es nuestro corte más solicitado.', delay: 28000 },
    { from: 'client', text: 'Suena bien! Cuánto cuesta?', delay: 22000 },
    { from: 'business', text: 'El corte está en $25.000. Si quieres agregar barba son $37.000.', delay: 22000 },
    { from: 'client', text: 'Solo corte por ahora. Con quién me recomiendan?', delay: 25000 },
    { from: 'business', text: 'Te recomiendo a Victor, es nuestro barbero estrella. Muy detallista y tiene años de experiencia con fades.', delay: 25000 },
    { from: 'client', text: 'Dale, con Victor. Cuándo hay espacio?', delay: 22000 },
    { from: 'business', text: 'Esta semana: jueves 2:00 PM, viernes 9:00 AM, sábado 11:30 AM. ¿Cuál te sirve?', delay: 25000 },
    { from: 'client', text: 'Viernes 9 AM, así arranco bien el día', delay: 28000 },
    { from: 'business', text: 'Agenda aquí: https://book.weibook.co/alpelo-peluqueria Elige viernes 9:00 AM. ¿Quién te recomendó Al Pelo?', delay: 25000 },
    { from: 'client', text: 'Un compañero del trabajo, Carlos Mendoza. Él siempre sale con el corte brutal', delay: 30000 },
    { from: 'business', text: 'Carlos es cliente VIP nuestro! Por ser referido de Carlos tienes 10% de descuento: $22.500 en vez de $25.000.', delay: 28000 },
    { from: 'client', text: 'Qué genial! Ya agendé por el link', delay: 35000 },
    { from: 'business', text: 'Perfecto Luis! Viernes 9:00 AM con Victor, mid fade, $22.500. Menciona a Carlos cuando llegues. Te va a encantar!', delay: 25000 },
    { from: 'client', text: 'Listo, muchas gracias Lina! Ahí nos vemos el viernes', delay: 22000 },
  ],
};

// Fallback responses for user-initiated messages and new chats
const clientAutoReplies = [
  'Ok, perfecto!',
  'Gracias, quedo pendiente',
  'Dale, listo!',
  'Buenísimo, gracias!',
  'Ok, ya agendo por el link',
  'Genial, nos vemos entonces!',
  'Listo, muchas gracias!',
];

const linaResponses = [
  'Perfecto! Quedo pendiente de cualquier cosa que necesites.',
  'Listo! Si necesitas algo más, me escribes por aquí.',
  'Excelente! Te esperamos en Al Pelo.',
  'Cualquier duda adicional, con gusto te ayudo.',
  'Recuerda que puedes agendar tu cita aquí: https://book.weibook.co/alpelo-peluqueria',
];

// ===== NEW CHAT ICON =====
const NewChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

// ===== MAIN INBOX =====
const Inbox = () => {
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [messageInput, setMessageInput] = useState('');
  const [showClientInfo, setShowClientInfo] = useState(false);
  const [localMessages, setLocalMessages] = useState({ ...mockWhatsAppMessages });
  const [aiMode, setAiMode] = useState({});
  const [showBlast, setShowBlast] = useState(false);
  const [typingState, setTypingState] = useState({}); // { convId: 'business'|'client' }
  const [customConversations, setCustomConversations] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatStep, setNewChatStep] = useState('phone');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  // Tracks conversations the user has manually opened (read)
  const [readConvs, setReadConvs] = useState(new Set());
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const timeoutsRef = useRef([]);
  const b = 'inbox';

  // Helper: add/remove typing for a conv (tracks WHO is typing)
  const startTyping = useCallback((convId, from) => {
    setTypingState((prev) => ({ ...prev, [convId]: from }));
  }, []);

  const stopTyping = useCallback((convId) => {
    setTypingState((prev) => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });
  }, []);

  // Helper: schedule a timeout and track it for cleanup
  const scheduleTimeout = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // Initialize all conversations with AI mode ON
  useEffect(() => {
    const initial = {};
    mockWhatsAppConversations.forEach((c) => { initial[c.id] = true; });
    setAiMode(initial);
  }, []);

  // Cleanup all timeouts
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // All conversations: mock + custom
  const allConversations = useMemo(() => {
    return [...mockWhatsAppConversations, ...customConversations];
  }, [customConversations]);

  // Compute live preview: last message from localMessages
  const getConvPreview = useCallback((conv) => {
    const msgs = localMessages[conv.id];
    if (!msgs || msgs.length === 0) return { text: conv.lastMessage, from: conv.lastMessageFrom, time: conv.lastMessageTime };
    const last = msgs[msgs.length - 1];
    return { text: last.text, from: last.from, time: last.time };
  }, [localMessages]);

  // Compute unread: count trailing client messages (if user hasn't manually read)
  const getUnread = useCallback((convId) => {
    if (readConvs.has(convId)) {
      // User opened this conv — check if new client msgs arrived AFTER they opened
      // For simplicity: if last msg is from business, 0. If from client, count trailing.
      const msgs = localMessages[convId];
      if (!msgs || msgs.length === 0) return 0;
      if (msgs[msgs.length - 1].from === 'business') return 0;
    }
    const msgs = localMessages[convId];
    if (!msgs || msgs.length === 0) return 0;
    let count = 0;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].from === 'client') count++;
      else break;
    }
    return count;
  }, [localMessages, readConvs]);

  // Filter conversations
  const conversations = useMemo(() => {
    let filtered = [...allConversations];

    if (filter === 'unread') {
      filtered = filtered.filter((c) => getUnread(c.id) > 0);
    } else if (filter === 'vip') {
      const vipIds = allClients.filter((c) => c.status === STATUS.VIP).map((c) => c.id);
      filtered = filtered.filter((c) => vipIds.includes(c.clientId));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => c.clientName.toLowerCase().includes(q));
    }

    // Sort by latest message time (live)
    return filtered.sort((a, _b) => {
      const aTime = getConvPreview(a).time;
      const bTime = getConvPreview(_b).time;
      return new Date(bTime) - new Date(aTime);
    });
  }, [filter, searchQuery, allConversations, getConvPreview, getUnread]);

  const selectedConv = allConversations.find((c) => c.id === selectedConvId);
  const messages = selectedConvId ? (localMessages[selectedConvId] || []) : [];
  const selectedClient = selectedConv
    ? allClients.find((c) => c.id === selectedConv.clientId)
    : null;

  const isAiActive = selectedConvId ? (aiMode[selectedConvId] !== false) : true;
  const isSelectedTyping = !!typingState[selectedConvId];
  const selectedTypingFrom = typingState[selectedConvId] || null;

  // Scroll to bottom when messages change or typing starts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedConvId, isSelectedTyping]);

  // Focus input when conversation selected
  useEffect(() => {
    if (selectedConvId) inputRef.current?.focus();
  }, [selectedConvId]);

  // === SIMULATION ENGINE ===

  // Simulate typing → message from business (Lina) — typing on RIGHT
  const simulateLinaMessage = useCallback((convId, text, delayBefore = 1000) => {
    scheduleTimeout(() => {
      startTyping(convId, 'business');

      const typeDuration = 1500 + Math.random() * 2000;
      scheduleTimeout(() => {
        stopTyping(convId);

        const msgId = `lina-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const linaMsg = {
          id: msgId,
          from: 'business',
          text,
          time: new Date().toISOString(),
          status: 'sent',
        };

        setLocalMessages((prev) => ({
          ...prev,
          [convId]: [...(prev[convId] || []), linaMsg],
        }));

        // Delivery status
        scheduleTimeout(() => {
          setLocalMessages((prev) => ({
            ...prev,
            [convId]: (prev[convId] || []).map((m) =>
              m.id === msgId ? { ...m, status: 'delivered' } : m
            ),
          }));
        }, 1200);

        // Read status
        scheduleTimeout(() => {
          setLocalMessages((prev) => ({
            ...prev,
            [convId]: (prev[convId] || []).map((m) =>
              m.id === msgId ? { ...m, status: 'read' } : m
            ),
          }));
        }, 3500);
      }, typeDuration);
    }, delayBefore);
  }, [scheduleTimeout, startTyping, stopTyping]);

  // Simulate typing → message from client — typing on LEFT
  const simulateClientMessage = useCallback((convId, text, delayBefore = 1500) => {
    scheduleTimeout(() => {
      startTyping(convId, 'client');

      const typeDuration = 1200 + Math.random() * 1800;
      scheduleTimeout(() => {
        stopTyping(convId);

        const clientMsg = {
          id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from: 'client',
          text,
          time: new Date().toISOString(),
          status: 'read',
        };

        setLocalMessages((prev) => ({
          ...prev,
          [convId]: [...(prev[convId] || []), clientMsg],
        }));
      }, typeDuration);
    }, delayBefore);
  }, [scheduleTimeout, startTyping, stopTyping]);

  // Full simulation chain: client types → Lina responds → client replies
  const simulateFullExchange = useCallback((convId, clientText, linaText, clientReply, startDelay = 0) => {
    // 1. Client types their message (only if provided - for unread they already have a msg)
    if (clientText) {
      simulateClientMessage(convId, clientText, startDelay);
      // 2. Lina responds
      simulateLinaMessage(convId, linaText, startDelay + 3500 + Math.random() * 1500);
      // 3. Client replies
      if (clientReply) {
        simulateClientMessage(convId, clientReply, startDelay + 8000 + Math.random() * 2000);
      }
    } else {
      // Just Lina responds to existing unread
      simulateLinaMessage(convId, linaText, startDelay);
      // Client replies after Lina
      if (clientReply) {
        simulateClientMessage(convId, clientReply, startDelay + 5000 + Math.random() * 2000);
      }
    }
  }, [simulateClientMessage, simulateLinaMessage]);

  // After user sends a message → trigger client reply then Lina
  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConvId) return;

    const msgId = `msg-${Date.now()}`;
    const newMsg = {
      id: msgId,
      from: 'business',
      text: messageInput.trim(),
      time: new Date().toISOString(),
      status: 'sent',
    };

    setLocalMessages((prev) => ({
      ...prev,
      [selectedConvId]: [...(prev[selectedConvId] || []), newMsg],
    }));
    setMessageInput('');

    // Delivery + read status
    scheduleTimeout(() => {
      setLocalMessages((prev) => ({
        ...prev,
        [selectedConvId]: (prev[selectedConvId] || []).map((m) =>
          m.id === msgId ? { ...m, status: 'delivered' } : m
        ),
      }));
    }, 800);

    scheduleTimeout(() => {
      setLocalMessages((prev) => ({
        ...prev,
        [selectedConvId]: (prev[selectedConvId] || []).map((m) =>
          m.id === msgId ? { ...m, status: 'read' } : m
        ),
      }));
    }, 2500);

    // Client response
    const clientReply = clientAutoReplies[Math.floor(Math.random() * clientAutoReplies.length)];
    simulateClientMessage(selectedConvId, clientReply, 2000 + Math.random() * 2000);

    // If AI active, Lina follows up
    if (aiMode[selectedConvId] !== false) {
      const linaText = linaResponses[Math.floor(Math.random() * linaResponses.length)];
      simulateLinaMessage(selectedConvId, linaText, 7000 + Math.random() * 2000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleAiMode = () => {
    if (!selectedConvId) return;
    setAiMode((prev) => ({ ...prev, [selectedConvId]: !prev[selectedConvId] }));
  };

  // === SCRIPT PLAYER — Plays ALL liveScripts on mount ===
  // Uses raw setTimeout + functional state updates (no stale closures)
  useEffect(() => {
    const ids = [];
    const schedule = (fn, ms) => { const id = setTimeout(fn, ms); ids.push(id); };

    Object.entries(liveScripts).forEach(([convId, script]) => {
      let cumulative = 0;

      script.forEach((step) => {
        cumulative += step.delay;
        const startAt = cumulative;
        const typingDuration = step.from === 'business'
          ? 1500 + Math.random() * 2000
          : 1200 + Math.random() * 1800;

        // 1. Show typing indicator
        schedule(() => {
          setTypingState((prev) => ({ ...prev, [convId]: step.from }));
        }, startAt);

        // 2. Stop typing + add message
        schedule(() => {
          setTypingState((prev) => {
            const next = { ...prev };
            delete next[convId];
            return next;
          });

          const msgId = `${step.from}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const msg = {
            id: msgId,
            from: step.from,
            text: step.text,
            time: new Date().toISOString(),
            status: step.from === 'business' ? 'sent' : 'read',
          };

          setLocalMessages((prev) => ({
            ...prev,
            [convId]: [...(prev[convId] || []), msg],
          }));

          // Business messages: sent → delivered → read
          if (step.from === 'business') {
            schedule(() => {
              setLocalMessages((prev) => ({
                ...prev,
                [convId]: (prev[convId] || []).map((m) =>
                  m.id === msgId ? { ...m, status: 'delivered' } : m
                ),
              }));
            }, 1200);
            schedule(() => {
              setLocalMessages((prev) => ({
                ...prev,
                [convId]: (prev[convId] || []).map((m) =>
                  m.id === msgId ? { ...m, status: 'read' } : m
                ),
              }));
            }, 3500);
          }
        }, startAt + typingDuration);

        // Advance cumulative to include typing time
        cumulative += typingDuration;
      });
    });

    // Store for cleanup
    timeoutsRef.current.push(...ids);

    return () => ids.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick templates for new chats
  const quickTemplates = useMemo(() => [
    { id: 'welcome', label: 'Bienvenida', text: `Hola{nombre}, soy Lina de Al Pelo! Bienvenido/a. ¿En qué te puedo ayudar? Si quieres agendar una cita, puedes hacerlo aquí: https://book.weibook.co/alpelo-peluqueria` },
    { id: 'prices', label: 'Precios', text: `Hola{nombre}, soy Lina de Al Pelo. Estos son nuestros servicios más solicitados:\n- Corte: $25.000\n- Barba: $12.000\n- Corte + Barba: $37.000\n\nAgenda tu cita: https://book.weibook.co/alpelo-peluqueria` },
    { id: 'promo', label: 'Promoción', text: `Hola{nombre}, soy Lina de Al Pelo. Tenemos una promoción especial para ti! Agenda esta semana y recibe 10% de descuento en tu primer servicio: https://book.weibook.co/alpelo-peluqueria` },
    { id: 'reactivation', label: 'Reactivación', text: `Hola{nombre}, soy Lina de Al Pelo. Te extrañamos! Hace rato no te vemos por acá. Agenda tu cita y ven a ponerte Al Pelo: https://book.weibook.co/alpelo-peluqueria` },
  ], []);

  const handleNewChatNext = () => {
    if (!newChatPhone.trim()) return;
    setNewChatStep('template');
  };

  // Create new conversation with template
  const handleCreateNewChat = (templateText) => {
    const convId = `conv-new-${Date.now()}`;
    const name = newChatName.trim() || newChatPhone.trim();
    const nameTag = newChatName.trim() ? ` ${newChatName.trim().split(' ')[0]}` : '';
    const msgText = (templateText || '').replace('{nombre}', nameTag);

    const newConv = {
      id: convId,
      clientId: null,
      clientName: name,
      phone: newChatPhone.trim(),
      lastMessage: msgText.slice(0, 50) + '...',
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      status: 'active',
      lastMessageFrom: 'business',
    };

    const firstMsgId = `msg-${Date.now()}`;
    const firstMsg = {
      id: firstMsgId,
      from: 'business',
      text: msgText,
      time: new Date().toISOString(),
      status: 'sent',
    };

    setCustomConversations((prev) => [...prev, newConv]);
    setLocalMessages((prev) => ({ ...prev, [convId]: [firstMsg] }));
    setAiMode((prev) => ({ ...prev, [convId]: true }));
    setSelectedConvId(convId);
    setShowNewChat(false);
    setNewChatPhone('');
    setNewChatName('');
    setNewChatStep('phone');
    setSelectedTemplate(null);

    // Delivery + read
    scheduleTimeout(() => {
      setLocalMessages((prev) => ({
        ...prev,
        [convId]: (prev[convId] || []).map((m) =>
          m.id === firstMsgId ? { ...m, status: 'delivered' } : m
        ),
      }));
    }, 1000);

    scheduleTimeout(() => {
      setLocalMessages((prev) => ({
        ...prev,
        [convId]: (prev[convId] || []).map((m) =>
          m.id === firstMsgId ? { ...m, status: 'read' } : m
        ),
      }));
    }, 3000);

    // Simulate client response after template, then Lina follows up
    const clientReply = clientAutoReplies[Math.floor(Math.random() * clientAutoReplies.length)];
    simulateClientMessage(convId, clientReply, 3500 + Math.random() * 2000);
    const linaFollow = linaResponses[Math.floor(Math.random() * linaResponses.length)];
    simulateLinaMessage(convId, linaFollow, 8000 + Math.random() * 2000);
  };

  const totalUnread = allConversations.reduce((sum, c) => sum + getUnread(c.id), 0);

  // Date separator helper
  const getDateLabel = (dateStr) => {
    const now = new Date('2026-03-04T12:00:00');
    const d = new Date(dateStr);
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDate = '';
    messages.forEach((msg) => {
      const dateKey = new Date(msg.time).toDateString();
      if (dateKey !== lastDate) {
        groups.push({ type: 'date', label: getDateLabel(msg.time), key: `date-${dateKey}` });
        lastDate = dateKey;
      }
      groups.push({ type: 'message', data: msg, key: msg.id });
    });
    return groups;
  }, [messages]);

  return (
    <div className={`${b} ${selectedConvId ? `${b}--chat-open` : ''}`}>
      {/* ===== CONVERSATION LIST PANEL ===== */}
      <div className={`${b}__list-panel`}>
        <div className={`${b}__list-header`}>
          <h2 className={`${b}__list-title`}>Chats</h2>
          <div className={`${b}__list-header-actions`}>
            <button
              className={`${b}__new-chat-btn`}
              onClick={() => setShowNewChat(true)}
              title="Nuevo chat"
            >
              <NewChatIcon />
            </button>
            <button
              className={`${b}__blast-trigger ${showBlast ? `${b}__blast-trigger--active` : ''}`}
              onClick={() => setShowBlast(!showBlast)}
              title="Campaña de reactivación"
            >
              {Icons.megaphone}
            </button>
            {totalUnread > 0 && (
              <span className={`${b}__unread-total`}>{totalUnread}</span>
            )}
          </div>
        </div>

        {/* Blast Panel */}
        {showBlast && <BlastPanel onClose={() => setShowBlast(false)} />}

        {/* New Chat Panel */}
        {showNewChat && (
          <div className={`${b}__new-chat-panel`}>
            <div className={`${b}__new-chat-header`}>
              <h3 className={`${b}__new-chat-title`}>
                {newChatStep === 'phone' ? 'Nuevo chat' : 'Elegir plantilla'}
              </h3>
              <button className={`${b}__new-chat-close`} onClick={() => { setShowNewChat(false); setNewChatStep('phone'); }}>
                {Icons.close}
              </button>
            </div>

            {newChatStep === 'phone' ? (
              <div className={`${b}__new-chat-form`}>
                <input
                  type="text"
                  className={`${b}__new-chat-input`}
                  placeholder="Número (ej: +573001234567)"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNewChatNext()}
                  autoFocus
                />
                <input
                  type="text"
                  className={`${b}__new-chat-input`}
                  placeholder="Nombre (opcional)"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNewChatNext()}
                />
                <button
                  className={`${b}__new-chat-submit`}
                  onClick={handleNewChatNext}
                  disabled={!newChatPhone.trim()}
                >
                  Siguiente
                </button>
              </div>
            ) : (
              <div className={`${b}__new-chat-templates`}>
                <p className={`${b}__new-chat-templates-hint`}>
                  Elige una plantilla para iniciar la conversación con <strong>{newChatName || newChatPhone}</strong>
                </p>
                {quickTemplates.map((tpl) => {
                  const nameTag = newChatName.trim() ? ` ${newChatName.trim().split(' ')[0]}` : '';
                  const preview = tpl.text.replace('{nombre}', nameTag);
                  return (
                    <button
                      key={tpl.id}
                      className={`${b}__new-chat-tpl`}
                      onClick={() => handleCreateNewChat(tpl.text)}
                    >
                      <span className={`${b}__new-chat-tpl-label`}>{tpl.label}</span>
                      <span className={`${b}__new-chat-tpl-preview`}>
                        {preview.length > 80 ? preview.slice(0, 80) + '...' : preview}
                      </span>
                    </button>
                  );
                })}
                <button
                  className={`${b}__new-chat-back`}
                  onClick={() => setNewChatStep('phone')}
                >
                  ← Volver
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className={`${b}__search`}>
          <span className={`${b}__search-icon`}>{Icons.search}</span>
          <input
            type="text"
            className={`${b}__search-input`}
            placeholder="Buscar o empezar un chat nuevo"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className={`${b}__filters`}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'unread', label: 'No leídos' },
            { id: 'vip', label: 'VIP' },
          ].map((f) => (
            <button
              key={f.id}
              className={`${b}__filter ${filter === f.id ? `${b}__filter--active` : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div className={`${b}__conv-list`}>
          {conversations.length > 0 ? conversations.map((conv) => {
            const isVip = allClients.find((c) => c.id === conv.clientId)?.status === STATUS.VIP;
            return (
              <div
                key={conv.id}
                className={`${b}__conv-item ${selectedConvId === conv.id ? `${b}__conv-item--active` : ''} ${getUnread(conv.id) > 0 ? `${b}__conv-item--unread` : ''}`}
                onClick={() => { setSelectedConvId(conv.id); setShowBlast(false); setReadConvs((prev) => new Set([...prev, conv.id])); }}
              >
                <div
                  className={`${b}__conv-avatar ${isVip ? `${b}__conv-avatar--vip` : ''}`}
                  style={!isVip ? { background: getAvatarColor(conv.clientName) } : undefined}
                >
                  {getInitials(conv.clientName)}
                </div>
                <div className={`${b}__conv-content`}>
                  {(() => {
                    const preview = getConvPreview(conv);
                    const previewText = preview.text || '';
                    const isTyping = !!typingState[conv.id];
                    return (
                      <>
                        <div className={`${b}__conv-top`}>
                          <span className={`${b}__conv-name`}>
                            {conv.clientName.split(' ').slice(0, 2).join(' ')}
                          </span>
                          <span className={`${b}__conv-time`}>{formatConvTime(preview.time)}</span>
                        </div>
                        <div className={`${b}__conv-bottom`}>
                          <p className={`${b}__conv-preview`}>
                            {isTyping ? (
                              <span className={`${b}__conv-typing-text`}>escribiendo...</span>
                            ) : (
                              <>
                                {preview.from === 'business' && (
                                  <span className={`${b}__conv-check-inline`}>
                                    <MessageStatus status="read" />
                                  </span>
                                )}
                                {previewText.length > 45 ? previewText.slice(0, 45) + '...' : previewText}
                              </>
                            )}
                          </p>
                          {getUnread(conv.id) > 0 && !isTyping && (
                            <span className={`${b}__conv-badge`}>{getUnread(conv.id)}</span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          }) : (
            <div className={`${b}__empty`}>
              <p>No se encontraron conversaciones</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== CHAT VIEW PANEL ===== */}
      <div className={`${b}__chat-panel`}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className={`${b}__chat-header`}>
              <button className={`${b}__back-btn`} onClick={() => setSelectedConvId(null)}>
                {Icons.back}
              </button>
              <div className={`${b}__chat-avatar`} style={{ background: getAvatarColor(selectedConv.clientName) }}>
                {getInitials(selectedConv.clientName)}
              </div>
              <div className={`${b}__chat-info`}>
                <span className={`${b}__chat-name`}>{selectedConv.clientName}</span>
                <span className={`${b}__chat-status ${isSelectedTyping ? `${b}__chat-status--typing` : ''}`}>
                  {isSelectedTyping ? 'escribiendo...' : selectedConv.status === 'active' ? 'en línea' : 'últ. vez hoy'}
                </span>
              </div>

              {/* AI/Human Toggle */}
              <button
                className={`${b}__ai-toggle ${isAiActive ? `${b}__ai-toggle--ai` : `${b}__ai-toggle--human`}`}
                onClick={toggleAiMode}
                title={isAiActive ? 'Lina IA activa — clic para modo manual' : 'Modo manual — clic para activar Lina IA'}
              >
                {isAiActive ? Icons.robot : Icons.user}
                <span>{isAiActive ? 'Lina IA' : 'Manual'}</span>
              </button>

              <button
                className={`${b}__info-btn ${showClientInfo ? `${b}__info-btn--active` : ''}`}
                onClick={() => setShowClientInfo(!showClientInfo)}
              >
                {showClientInfo ? Icons.close : Icons.info}
              </button>
            </div>

            <div className={`${b}__chat-body-wrapper`}>
              {/* Messages */}
              <div className={`${b}__messages`}>
                <div className={`${b}__messages-inner`}>
                  {/* Encryption notice */}
                  <div className={`${b}__encryption-notice`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                    </svg>
                    Los mensajes están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos.
                  </div>

                  {groupedMessages.map((item) => {
                    if (item.type === 'date') {
                      return (
                        <div key={item.key} className={`${b}__date-separator`}>
                          <span>{item.label}</span>
                        </div>
                      );
                    }

                    const msg = item.data;
                    return (
                      <div
                        key={msg.id}
                        className={`${b}__message ${msg.from === 'business' ? `${b}__message--sent` : `${b}__message--received`}`}
                      >
                        <div className={`${b}__message-bubble`}>
                          {msg.from === 'business' && (
                            <span className={`${b}__bubble-tail ${b}__bubble-tail--sent`} />
                          )}
                          {msg.from === 'client' && (
                            <span className={`${b}__bubble-tail ${b}__bubble-tail--received`} />
                          )}
                          <p className={`${b}__message-text`}>{msg.text}</p>
                          <div className={`${b}__message-meta`}>
                            <span className={`${b}__message-time`}>{formatTime(msg.time)}</span>
                            {msg.from === 'business' && <MessageStatus status={msg.status} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing indicator — RIGHT for business (Lina), LEFT for client */}
                  {isSelectedTyping && (
                    <div className={`${b}__message ${selectedTypingFrom === 'business' ? `${b}__message--sent` : `${b}__message--received`}`}>
                      <div className={`${b}__message-bubble ${b}__message-bubble--typing`}>
                        <span className={`${b}__bubble-tail ${selectedTypingFrom === 'business' ? `${b}__bubble-tail--sent` : `${b}__bubble-tail--received`}`} />
                        <div className={`${b}__typing-indicator`}>
                          <span className={`${b}__typing-dot`} />
                          <span className={`${b}__typing-dot`} />
                          <span className={`${b}__typing-dot`} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Client Info Sidebar */}
              {showClientInfo && selectedClient && (
                <div className={`${b}__client-sidebar`}>
                  <div className={`${b}__client-header`}>
                    <div className={`${b}__client-avatar-lg`} style={{ background: getAvatarColor(selectedClient.name) }}>
                      {getInitials(selectedClient.name)}
                    </div>
                    <h3 className={`${b}__client-name-lg`}>{selectedClient.name}</h3>
                    <span className={`${b}__client-status-badge ${b}__client-status-badge--${selectedClient.status}`}>
                      {selectedClient.status === 'vip' ? 'VIP' : selectedClient.status === 'activo' ? 'Activo' : selectedClient.status === 'nuevo' ? 'Nuevo' : selectedClient.status === 'en_riesgo' ? 'En riesgo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className={`${b}__client-details`}>
                    <div className={`${b}__client-detail`}>
                      <span className={`${b}__client-label`}>Teléfono</span>
                      <span className={`${b}__client-value`}>{selectedClient.phone}</span>
                    </div>
                    <div className={`${b}__client-detail`}>
                      <span className={`${b}__client-label`}>Visitas</span>
                      <span className={`${b}__client-value`}>{selectedClient.totalVisits}</span>
                    </div>
                    <div className={`${b}__client-detail`}>
                      <span className={`${b}__client-label`}>Gasto total</span>
                      <span className={`${b}__client-value`}>{formatCurrency(selectedClient.totalSpent)}</span>
                    </div>
                    <div className={`${b}__client-detail`}>
                      <span className={`${b}__client-label`}>Servicio favorito</span>
                      <span className={`${b}__client-value`}>{selectedClient.favoriteService}</span>
                    </div>
                    <div className={`${b}__client-detail`}>
                      <span className={`${b}__client-label`}>Última visita</span>
                      <span className={`${b}__client-value`}>{daysSince(selectedClient.lastVisit)} días</span>
                    </div>
                    {selectedClient.notes && (
                      <div className={`${b}__client-detail`}>
                        <span className={`${b}__client-label`}>Notas</span>
                        <span className={`${b}__client-value`}>{selectedClient.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI Mode indicator bar */}
            {isAiActive && (
              <div className={`${b}__ai-bar`}>
                <span className={`${b}__ai-bar-dot`} />
                Lina IA está respondiendo este chat automáticamente
              </div>
            )}

            {/* Input Area */}
            <div className={`${b}__input-area`}>
              <button className={`${b}__input-action`} title="Usar plantilla">
                {Icons.template}
              </button>
              <div className={`${b}__input-wrapper`}>
                <textarea
                  ref={inputRef}
                  className={`${b}__input`}
                  placeholder={isAiActive ? 'Lina IA está activa... escribe para intervenir' : 'Escribe un mensaje...'}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
              </div>
              <button
                className={`${b}__send-btn ${messageInput.trim() ? `${b}__send-btn--active` : ''}`}
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
              >
                {Icons.send}
              </button>
            </div>
          </>
        ) : (
          <div className={`${b}__empty-chat`}>
            <div className={`${b}__empty-chat-bg`}>
              <div className={`${b}__empty-chat-icon`}>
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
                </svg>
              </div>
              <h3 className={`${b}__empty-chat-title`}>Al Pelo WhatsApp</h3>
              <p className={`${b}__empty-chat-text`}>Envía y recibe mensajes con tus clientes.<br />Lina IA se encarga de responder por ti.</p>
              <div className={`${b}__empty-chat-features`}>
                <span>Respuestas automáticas con IA</span>
                <span>Envío masivo de plantillas</span>
                <span>Toggle IA / Manual por chat</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
