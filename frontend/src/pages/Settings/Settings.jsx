import Card from '../../components/common/Card/Card';
import { useNotification } from '../../context/NotificationContext';

const Settings = () => {
  const { addNotification } = useNotification();

  const handleToggle = (setting) => {
    addNotification(`${setting} actualizado`, 'info');
  };

  return (
    <div className="settings">
      <div className="settings__header">
        <h2 className="settings__title">Configuración</h2>
        <p className="settings__subtitle">Personaliza tu experiencia</p>
      </div>

      <div className="settings__content">
        <Card title="Notificaciones" className="settings__card">
          <div className="settings__option">
            <div className="settings__option-info">
              <span className="settings__option-label">Notificaciones de citas</span>
              <span className="settings__option-desc">Recibir alertas cuando se agende una cita</span>
            </div>
            <button className="settings__toggle settings__toggle--active" onClick={() => handleToggle('Notificaciones de citas')}>
              <span className="settings__toggle-knob" />
            </button>
          </div>
          <div className="settings__option">
            <div className="settings__option-info">
              <span className="settings__option-label">Alertas de mensajería</span>
              <span className="settings__option-desc">Notificar cuando se complete un envío masivo</span>
            </div>
            <button className="settings__toggle settings__toggle--active" onClick={() => handleToggle('Alertas de mensajería')}>
              <span className="settings__toggle-knob" />
            </button>
          </div>
          <div className="settings__option">
            <div className="settings__option-info">
              <span className="settings__option-label">Sonidos</span>
              <span className="settings__option-desc">Reproducir sonido con las notificaciones</span>
            </div>
            <button className="settings__toggle" onClick={() => handleToggle('Sonidos')}>
              <span className="settings__toggle-knob" />
            </button>
          </div>
        </Card>

        <Card title="Integraciones" className="settings__card">
          <div className="settings__option">
            <div className="settings__option-info">
              <span className="settings__option-label">WhatsApp Business</span>
              <span className="settings__option-desc">Conectar con la API de WhatsApp Business</span>
            </div>
            <span className="settings__status settings__status--pending">Pendiente</span>
          </div>
          <div className="settings__option">
            <div className="settings__option-info">
              <span className="settings__option-label">Meta (Facebook/Instagram)</span>
              <span className="settings__option-desc">Conectar con Meta Business Suite</span>
            </div>
            <span className="settings__status settings__status--pending">Pendiente</span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
