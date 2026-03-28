import { useState, useEffect, useCallback } from 'react';

export default function ScrollTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      className={`scroll-top${isVisible ? ' scroll-top--visible' : ''}`}
      onClick={scrollToTop}
      aria-label="Volver arriba"
      type="button"
    >
      <svg
        className="scroll-top__icon"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 16V4" />
        <path d="M4 10l6-6 6 6" />
      </svg>
    </button>
  );
}
