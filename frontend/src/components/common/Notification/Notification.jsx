const Notification = ({ message, type = 'info' }) => {
  if (!message) return null;

  return (
    <div className={`notification notification--${type}`}>
      <span className="notification__message">{message}</span>
    </div>
  );
};

export default Notification;
