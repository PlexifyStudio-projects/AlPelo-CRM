const INDUSTRIES = [
  { label: 'Peluquerías', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12L12 12"/><path d="M20 4L8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8L20 20"/></svg> },
  { label: 'Barberías', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M8 6l8 12M16 6L8 18"/><circle cx="12" cy="2" r="1" fill="currentColor"/></svg> },
  { label: 'Clínicas', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M12 14v4M10 16h4"/></svg> },
  { label: 'Restaurantes', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> },
  { label: 'Gimnasios', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5L17.5 17.5M6.5 17.5L17.5 6.5"/><path d="M2 12h4M18 12h4M12 2v4M12 18v4"/></svg> },
  { label: 'Spas', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c4-4 8-7.5 8-12A8 8 0 004 10c0 4.5 4 8 8 12z"/><path d="M12 12a3 3 0 100-6 3 3 0 000 6z"/></svg> },
  { label: 'Veterinarias', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/><path d="M8.5 14c0 3.5 2.5 6 3.5 6s3.5-2.5 3.5-6-2.5-4-3.5-4-3.5.5-3.5 4z"/></svg> },
  { label: 'Academias', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
  { label: 'Consultorios', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 105 2.6a2 2 0 01-1.1 1.8 1.6 1.6 0 00-.8 1.4V22"/><path d="M8 22h8"/><path d="M12 11v11"/><circle cx="12" cy="7" r="4"/></svg> },
  { label: 'Centros Estéticos', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/></svg> },
  { label: 'Estudios de Tatuaje', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> },
  { label: 'Ópticas', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="14" r="4"/><circle cx="17" cy="14" r="4"/><path d="M11 14h2M3 14H1M23 14h-2M7 10V4M17 10V4"/></svg> },
];

export default function TrustBar() {
  const items = [...INDUSTRIES, ...INDUSTRIES, ...INDUSTRIES];

  return (
    <section className="trust-bar" aria-label="Industrias">
      <div className="trust-bar__container">
        <p className="trust-bar__heading">
          Para cualquier negocio que gestione clientes
        </p>
      </div>
      <div className="trust-bar__marquee">
        <div className="trust-bar__track">
          {items.map((industry, i) => (
            <div className="trust-bar__brand" key={`${industry.label}-${i}`}>
              <span className="trust-bar__icon">{industry.icon}</span>
              <span className="trust-bar__label">{industry.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
