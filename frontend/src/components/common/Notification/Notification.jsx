// Notification component — repurposed as inline notification display.
// Floating toasts have been removed. Notifications now live in the
// Header bell dropdown via NotificationContext.

const Notification = ({ message, type = 'info' }) => {
  if (!message) return null;

  return (
    <div className={`notification notification--${type}`}>
      <span className="notification__message">{message}</span>
    </div>
  );
};

export default Notification;
