import { useEffect, useRef, useCallback } from 'react';

function createParticles(w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const baseR = Math.min(w, h) * 0.36;
  const particles = [];
  const count = 2200;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;

    // Most particles on the ring, some spray outward
    let dist;
    const rand = Math.random();
    if (rand < 0.6) {
      // Core ring
      dist = baseR + (Math.random() - 0.5) * baseR * 0.3;
    } else if (rand < 0.85) {
      // Inner spray
      dist = baseR * 0.7 + Math.random() * baseR * 0.15;
    } else {
      // Outer spray — particles that burst outward
      dist = baseR + baseR * 0.15 + Math.random() * baseR * 0.4;
    }

    // Spray effect — clusters of particles shoot outward at certain angles
    const sprayAngle = Math.floor(angle / (Math.PI / 8)) * (Math.PI / 8);
    const isSpray = Math.random() < 0.15;
    if (isSpray) {
      dist += Math.random() * baseR * 0.3;
    }

    const size = 0.5 + Math.random() * Math.random() * 4; // Bias toward smaller
    const opacity = 0.4 + Math.random() * 0.6;

    // Color: top = bright pink/red, sides = magenta, bottom = purple
    const normAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    // Shift so top of circle (visual top, -PI/2) is pink
    const colorAngle = (normAngle + Math.PI / 2) % (Math.PI * 2);
    const t = colorAngle / (Math.PI * 2);

    let r, g, b;
    if (t < 0.25) {
      // Top: bright pink/red
      r = 236 + Math.random() * 19;
      g = 50 + Math.random() * 40;
      b = 120 + t * 200;
    } else if (t < 0.5) {
      // Right: pink to magenta
      const s = (t - 0.25) / 0.25;
      r = 220 - s * 60;
      g = 60 + s * 20;
      b = 180 + s * 60;
    } else if (t < 0.75) {
      // Bottom: purple
      const s = (t - 0.5) / 0.25;
      r = 140 - s * 20;
      g = 58 + s * 30;
      b = 220 + s * 26;
    } else {
      // Left: purple to pink
      const s = (t - 0.75) / 0.25;
      r = 120 + s * 116;
      g = 80 - s * 20;
      b = 246 - s * 100;
    }

    particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      baseX: cx + Math.cos(angle) * dist,
      baseY: cy + Math.sin(angle) * dist,
      size,
      opacity,
      r: Math.min(255, Math.max(0, r)),
      g: Math.min(255, Math.max(0, g)),
      b: Math.min(255, Math.max(0, b)),
      angle,
      dist,
      speed: 0.0001 + Math.random() * 0.0005,
      wobbleSpeed: 0.3 + Math.random() * 1.5,
      wobbleAmount: 1 + Math.random() * 5,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return { particles, cx, cy, baseR };
}

export default function ParticleRing({ className = '' }) {
  const canvasRef = useRef(null);
  const dataRef = useRef({ particles: [], cx: 0, cy: 0, baseR: 0 });
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const frameRef = useRef(0);
  const timeRef = useRef(0);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -9999, y: -9999 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const w = container.offsetWidth;
      const h = container.offsetHeight || 500;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dataRef.current = createParticles(w, h);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      const { particles, cx, cy, baseR } = dataRef.current;
      const w = canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
      const h = canvas.height / (Math.min(window.devicePixelRatio || 1, 2));

      ctx.clearRect(0, 0, w, h);

      // Center glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.7);
      grad.addColorStop(0, `rgba(236, 72, 153, ${0.07 + Math.sin(t * 0.4) * 0.03})`);
      grad.addColorStop(0.6, `rgba(139, 92, 246, ${0.03 + Math.sin(t * 0.6) * 0.02})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const mouse = mouseRef.current;

      for (const p of particles) {
        p.angle += p.speed;
        const wobble = Math.sin(t * p.wobbleSpeed + p.phase) * p.wobbleAmount;
        const curDist = p.dist + wobble;

        p.baseX = cx + Math.cos(p.angle) * curDist;
        p.baseY = cy + Math.sin(p.angle) * curDist;

        // Mouse repulsion
        const dx = p.baseX - mouse.x;
        const dy = p.baseY - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const mR = 80;

        if (d < mR && d > 0) {
          const f = (mR - d) / mR;
          p.x += (p.baseX + (dx / d) * f * 30 - p.x) * 0.2;
          p.y += (p.baseY + (dy / d) * f * 30 - p.y) * 0.2;
        } else {
          p.x += (p.baseX - p.x) * 0.1;
          p.y += (p.baseY - p.y) * 0.1;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r | 0}, ${p.g | 0}, ${p.b | 0}, ${p.opacity})`;
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`particle-ring ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-hidden="true"
    />
  );
}
