import Button from '../../components/common/Button/Button';

const NotFound = ({ onGoHome }) => {
  return (
    <div className="not-found">
      <h1 className="not-found__code">404</h1>
      <p className="not-found__message">Página no encontrada</p>
      <Button variant="primary" onClick={onGoHome}>Volver al inicio</Button>
    </div>
  );
};

export default NotFound;
