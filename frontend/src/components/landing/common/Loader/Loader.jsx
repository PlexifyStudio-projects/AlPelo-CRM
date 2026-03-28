export default function Loader() {
  return (
    <div className="loader" role="status" aria-label="Cargando">
      <div className="loader__spinner" />
      <span className="loader__sr-only">Cargando...</span>
    </div>
  );
}
