import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Position presets for each section ───────────────────────────
// Each key = section ID observed via IntersectionObserver
// Values: CSS properties applied to the avatar wrapper
// All positions use only top + left (never right/bottom)
// so CSS transitions work smoothly between all states.
const POSITIONS = {
  'lina-hero': {
    top: '40%',
    left: '10%',
    transform: 'translateY(-50%) scale(1)',
    opacity: 1,
  },
  'lina-capabilities': {
    top: '12%',
    left: 'calc(100vw - 320px)',
    transform: 'scale(0.55)',
    opacity: 0.9,
  },
  'lina-pipeline': {
    top: '18%',
    left: '2%',
    transform: 'scale(0.5)',
    opacity: 0.85,
  },
  'lina-intelligence': {
    top: '10%',
    left: 'calc(100vw - 300px)',
    transform: 'scale(0.45)',
    opacity: 0.8,
  },
  'lina-config': {
    top: '65%',
    left: '3%',
    transform: 'scale(0.5)',
    opacity: 0.85,
  },
  'lina-cta': {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) scale(0.4)',
    opacity: 0.35,
  },
};

export default function LinaAvatar() {
  const avatarRef = useRef(null);
  const irisRef = useRef(null);
  const [activeSection, setActiveSection] = useState('lina-hero');
  const mousePos = useRef({ x: 0.5, y: 0.5 });
  const rafId = useRef(null);

  // ─── Mouse tracking for iris/eye follow ────────────────────
  const handleMouseMove = useCallback((e) => {
    mousePos.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  }, []);

  // ─── Smooth iris animation loop ────────────────────────────
  useEffect(() => {
    let currentX = 0;
    let currentY = 0;

    const animate = () => {
      const targetX = (mousePos.current.x - 0.5) * 14;
      const targetY = (mousePos.current.y - 0.5) * 14;

      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      if (irisRef.current) {
        irisRef.current.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [handleMouseMove]);

  // ─── IntersectionObserver: detect which section is visible ──
  useEffect(() => {
    const sectionIds = Object.keys(POSITIONS);
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with highest intersection ratio
        let best = null;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.intersectionRatio) {
              best = entry;
            }
          }
        });
        if (best) {
          setActiveSection(best.target.id);
        }
      },
      { threshold: [0.1, 0.3, 0.5] }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // ─── Apply position based on active section ────────────────
  useEffect(() => {
    if (!avatarRef.current) return;
    const pos = POSITIONS[activeSection] || POSITIONS['lina-hero'];
    const el = avatarRef.current;

    el.style.top = pos.top;
    el.style.left = pos.left;
    el.style.transform = pos.transform;
    el.style.opacity = pos.opacity;
  }, [activeSection]);

  // Apply hero position immediately on mount (no wait for observer)
  useEffect(() => {
    if (!avatarRef.current) return;
    const hero = POSITIONS['lina-hero'];
    avatarRef.current.style.top = hero.top;
    avatarRef.current.style.left = hero.left;
    avatarRef.current.style.transform = hero.transform;
    avatarRef.current.style.opacity = hero.opacity;
  }, []);

  return (
    <div className="lina-avatar" ref={avatarRef} aria-hidden="true">
      {/* Ambient glow */}
      <div className="lina-avatar__glow" />


      {/* Outer holographic ring */}
      <div className="lina-avatar__ring lina-avatar__ring--outer" />
      <div className="lina-avatar__ring lina-avatar__ring--inner" />

      {/* Core orb */}
      <div className="lina-avatar__orb">
        {/* Holographic surface */}
        <div className="lina-avatar__surface" />

        {/* Iris — follows mouse */}
        <div className="lina-avatar__iris" ref={irisRef}>
          <div className="lina-avatar__pupil" />
          <div className="lina-avatar__pupil-reflection" />
        </div>

        {/* Light streaks across the orb */}
        <div className="lina-avatar__streak lina-avatar__streak--1" />
        <div className="lina-avatar__streak lina-avatar__streak--2" />
      </div>

      {/* Orbiting particles */}
      <div className="lina-avatar__particles">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="lina-avatar__particle"
            style={{ '--i': i }}
          />
        ))}
      </div>
    </div>
  );
}
