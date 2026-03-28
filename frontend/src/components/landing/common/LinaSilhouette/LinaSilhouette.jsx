import { useEffect, useRef, useCallback } from 'react';

const TAU = Math.PI * 2;
const C = {
  purple:      [139, 92, 246],
  purpleLight: [167, 139, 250],
  purpleDark:  [124, 58, 237],
  pink:        [236, 72, 153],
  orange:      [249, 115, 22],
  cyan:        [34, 211, 238],
  green:       [16, 185, 129],
  white:       [241, 245, 249],
  bg:          [12, 10, 26],
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, t) => a + (b - a) * t;

// ─── Node definitions ─────────────────────────────────────────────
const NODES = [
  { label: 'WhatsApp',    icon: 'chat',     color: C.green,       desc: 'Chat autónomo' },
  { label: 'Clientes',    icon: 'users',    color: C.purple,      desc: 'Gestión CRM' },
  { label: 'Campañas',    icon: 'send',     color: C.pink,        desc: 'Envío masivo' },
  { label: 'Agenda',      icon: 'calendar', color: C.cyan,        desc: 'Citas y horarios' },
  { label: 'Finanzas',    icon: 'chart',    color: C.orange,      desc: 'Métricas $' },
  { label: 'Pipeline',    icon: 'shield',   color: C.purpleLight, desc: '4 fases seguras' },
  { label: 'Lealtad',     icon: 'star',     color: [251, 191, 36], desc: 'Programa VIP' },
  { label: 'Equipo',      icon: 'team',     color: C.cyan,        desc: 'Rendimiento' },
];

// ─── Icon renderer ────────────────────────────────────────────────
function drawIcon(ctx, type, x, y, s, color, alpha) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha * 0.9);
  ctx.fillStyle = rgba(color, alpha * 0.9);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const h = s * 0.32;

  switch (type) {
    case 'chat':
      ctx.beginPath();
      ctx.roundRect(x - h, y - h * 0.7, h * 2, h * 1.4, h * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - h * 0.3, y + h * 0.7);
      ctx.lineTo(x - h * 0.5, y + h * 1.1);
      ctx.lineTo(x + h * 0.1, y + h * 0.7);
      ctx.stroke();
      // dots
      for (const dx of [-0.35, 0, 0.35]) {
        ctx.beginPath();
        ctx.arc(x + h * dx, y, h * 0.08, 0, TAU);
        ctx.fill();
      }
      break;
    case 'users':
      ctx.beginPath(); ctx.arc(x - h * 0.25, y - h * 0.25, h * 0.32, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + h * 0.35, y - h * 0.25, h * 0.28, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - h * 0.8, y + h * 0.7);
      ctx.quadraticCurveTo(x - h * 0.25, y + h * 0.15, x + h * 0.3, y + h * 0.7);
      ctx.stroke();
      break;
    case 'send':
      ctx.beginPath();
      ctx.moveTo(x - h * 0.8, y + h * 0.5);
      ctx.lineTo(x + h * 0.9, y);
      ctx.lineTo(x - h * 0.8, y - h * 0.5);
      ctx.lineTo(x - h * 0.3, y);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - h * 0.3, y);
      ctx.lineTo(x + h * 0.9, y);
      ctx.stroke();
      break;
    case 'calendar':
      ctx.beginPath(); ctx.roundRect(x - h * 0.7, y - h * 0.5, h * 1.4, h * 1.3, h * 0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - h * 0.7, y - h * 0.05); ctx.lineTo(x + h * 0.7, y - h * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - h * 0.35, y - h * 0.75); ctx.lineTo(x - h * 0.35, y - h * 0.45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + h * 0.35, y - h * 0.75); ctx.lineTo(x + h * 0.35, y - h * 0.45); ctx.stroke();
      // grid dots
      for (const dy of [0.25, 0.5]) for (const dx of [-0.3, 0, 0.3]) {
        ctx.beginPath(); ctx.arc(x + h * dx, y + h * dy, h * 0.06, 0, TAU); ctx.fill();
      }
      break;
    case 'chart':
      ctx.beginPath(); ctx.moveTo(x - h * 0.7, y + h * 0.65); ctx.lineTo(x + h * 0.7, y + h * 0.65); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - h * 0.7, y + h * 0.65); ctx.lineTo(x - h * 0.7, y - h * 0.6); ctx.stroke();
      // bars
      const bw = h * 0.25;
      ctx.fillStyle = rgba(color, alpha * 0.6);
      ctx.fillRect(x - h * 0.5, y + h * 0.15, bw, h * 0.5);
      ctx.fillStyle = rgba(color, alpha * 0.8);
      ctx.fillRect(x - h * 0.15, y - h * 0.3, bw, h * 0.95);
      ctx.fillStyle = rgba(color, alpha * 0.7);
      ctx.fillRect(x + h * 0.2, y - h * 0.05, bw, h * 0.7);
      break;
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.8);
      ctx.lineTo(x + h * 0.7, y - h * 0.35);
      ctx.quadraticCurveTo(x + h * 0.7, y + h * 0.6, x, y + h * 0.9);
      ctx.quadraticCurveTo(x - h * 0.7, y + h * 0.6, x - h * 0.7, y - h * 0.35);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - h * 0.25, y + h * 0.05);
      ctx.lineTo(x - h * 0.02, y + h * 0.3);
      ctx.lineTo(x + h * 0.3, y - h * 0.2);
      ctx.stroke();
      break;
    case 'star':
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5;
        const a2 = a + TAU / 10;
        ctx.lineTo(x + Math.cos(a) * h * 0.7, y + Math.sin(a) * h * 0.7);
        ctx.lineTo(x + Math.cos(a2) * h * 0.3, y + Math.sin(a2) * h * 0.3);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    case 'team':
      ctx.beginPath(); ctx.arc(x, y - h * 0.35, h * 0.28, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - h * 0.6, y + h * 0.55);
      ctx.quadraticCurveTo(x, y + h * 0.05, x + h * 0.6, y + h * 0.55);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x - h * 0.65, y - h * 0.15, h * 0.18, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + h * 0.65, y - h * 0.15, h * 0.18, 0, TAU); ctx.stroke();
      break;
  }
  ctx.restore();
}

// ─── Feature Node ─────────────────────────────────────────────────
class FeatureNode {
  constructor(cx, cy, orbitA, orbitB, tilt, speed, data, idx, total) {
    this.cx = cx; this.cy = cy;
    this.a = orbitA; this.b = orbitB;
    this.tilt = tilt; this.speed = speed;
    this.baseAngle = (idx / total) * TAU;
    this.data = data;
    this.size = 28;
    this.phase = Math.random() * TAU;
    this.hovered = false;
    this.hoverT = 0; // 0-1 animated
    this.x = 0; this.y = 0; this.depth = 0; this.scale = 1; this.alpha = 1;
  }

  update(time, mx, my) {
    const angle = this.baseAngle + time * this.speed;
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    this.x = this.cx + cosA * this.a;
    this.y = this.cy + sinA * this.b + cosA * this.tilt;
    this.depth = 0.5 + 0.5 * sinA;
    this.scale = 0.75 + this.depth * 0.45;
    this.alpha = 0.45 + this.depth * 0.55;

    // Hover detection
    if (mx !== null && my !== null) {
      const dx = this.x - mx, dy = this.y - my;
      this.hovered = (dx * dx + dy * dy) < (this.size * this.scale * 1.8) ** 2;
    } else {
      this.hovered = false;
    }
    // Smooth hover animation
    this.hoverT += ((this.hovered ? 1 : 0) - this.hoverT) * 0.12;
  }

  draw(ctx, time) {
    const s = this.size * this.scale;
    const ht = this.hoverT;
    const pulse = 1 + Math.sin(time * 1.5 + this.phase) * 0.04;
    const r = s * pulse * (1 + ht * 0.35);
    const a = this.alpha;
    const col = this.data.color;

    // Outer glow (stronger on hover)
    const glowR = r * (2.5 + ht * 1.5);
    const g = ctx.createRadialGradient(this.x, this.y, r * 0.5, this.x, this.y, glowR);
    g.addColorStop(0, rgba(col, (0.08 + ht * 0.12) * a));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, glowR, 0, TAU);
    ctx.fill();

    // Glass circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, TAU);
    // Glassmorphism fill
    const bgAlpha = (0.55 + ht * 0.25) * a;
    ctx.fillStyle = rgba(C.bg, bgAlpha);
    ctx.fill();
    // Border
    ctx.strokeStyle = rgba(col, (0.3 + ht * 0.5) * a);
    ctx.lineWidth = 1 + ht * 0.5;
    ctx.stroke();

    // Second border ring on hover
    if (ht > 0.01) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 1.2, 0, TAU);
      ctx.strokeStyle = rgba(col, ht * 0.15 * a);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Icon
    drawIcon(ctx, this.data.icon, this.x, this.y - r * 0.08, r, col, a * (0.8 + ht * 0.2));

    // Label
    const fontSize = Math.round(lerp(10, 12, ht) * this.scale);
    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = rgba(col, a * (0.75 + ht * 0.25));
    ctx.fillText(this.data.label, this.x, this.y + r + 14 * this.scale);

    // Description on hover
    if (ht > 0.2) {
      const descSize = Math.round(9 * this.scale);
      ctx.font = `400 ${descSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = rgba(C.white, ht * 0.5 * a);
      ctx.fillText(this.data.desc, this.x, this.y + r + 14 * this.scale + fontSize + 4);
    }
  }
}

// ─── Particle ring ────────────────────────────────────────────────
class Ring {
  constructor(cx, cy, rx, ry, tilt, speed, count, colors) {
    this.cx = cx; this.cy = cy; this.rx = rx; this.ry = ry;
    this.tilt = tilt; this.speed = speed;
    this.offset = Math.random() * TAU;
    this.dots = Array.from({ length: count }, () => ({
      angle: Math.random() * TAU,
      r: 0.4 + Math.random() * 1.6,
      color: pick(colors),
      alpha: 0.12 + Math.random() * 0.35,
      trail: 1.5 + Math.random() * 3,
    }));
  }
  draw(ctx, time) {
    const rot = time * this.speed + this.offset;
    for (const d of this.dots) {
      const a = d.angle + rot;
      const x = this.cx + Math.cos(a) * this.rx;
      const y = this.cy + Math.sin(a) * this.ry + Math.cos(a) * this.tilt;
      const depth = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(a));
      const al = d.alpha * depth;

      // Trail
      const ta = a - 0.18;
      const tx = this.cx + Math.cos(ta) * this.rx;
      const ty = this.cy + Math.sin(ta) * this.ry + Math.cos(ta) * this.tilt;
      const grad = ctx.createLinearGradient(tx, ty, x, y);
      grad.addColorStop(0, rgba(d.color, 0));
      grad.addColorStop(1, rgba(d.color, al * 0.35));
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y);
      ctx.strokeStyle = grad; ctx.lineWidth = d.trail; ctx.stroke();

      ctx.beginPath(); ctx.arc(x, y, d.r * depth, 0, TAU);
      ctx.fillStyle = rgba(d.color, al);
      ctx.fill();
    }
  }
}

// ─── Data flow connections ────────────────────────────────────────
function drawConnections(ctx, nodes, cx, cy, time) {
  for (const n of nodes) {
    const al = n.alpha * (0.06 + n.hoverT * 0.1);
    if (al <= 0) continue;
    const col = n.data.color;

    // Dashed line
    ctx.save();
    ctx.setLineDash([3, 10]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(n.x, n.y);
    ctx.strokeStyle = rgba(col, al);
    ctx.lineWidth = 0.6 + n.hoverT * 0.8;
    ctx.stroke();
    ctx.restore();

    // Traveling energy dots (2 per line)
    for (let i = 0; i < 2; i++) {
      const t = ((time * (0.4 + i * 0.15) + n.phase + i * 0.5) % 1);
      const ex = lerp(cx, n.x, t);
      const ey = lerp(cy, n.y, t);
      const dotR = 1.2 + n.hoverT * 1;
      ctx.beginPath(); ctx.arc(ex, ey, dotR, 0, TAU);
      ctx.fillStyle = rgba(col, (0.35 + n.hoverT * 0.3) * n.alpha);
      ctx.fill();
      // Tiny glow
      ctx.beginPath(); ctx.arc(ex, ey, dotR * 3, 0, TAU);
      ctx.fillStyle = rgba(col, 0.05 * n.alpha);
      ctx.fill();
    }
  }
}

// ─── Core ─────────────────────────────────────────────────────────
function drawCore(ctx, cx, cy, time, radius, hoverAny) {
  const breathe = 1 + Math.sin(time * 0.7) * 0.1;
  const r = radius * breathe;
  const boost = hoverAny ? 1.15 : 1;

  // Multiple glow layers
  const layers = [
    { m: 6,   a: 0.015 * boost },
    { m: 4,   a: 0.025 * boost },
    { m: 2.5, a: 0.05 * boost },
    { m: 1.6, a: 0.09 * boost },
  ];
  for (const l of layers) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * l.m);
    g.addColorStop(0, rgba(C.purple, l.a + Math.sin(time * 0.9) * 0.008));
    g.addColorStop(0.4, rgba(C.pink, l.a * 0.35));
    g.addColorStop(1, rgba(C.purple, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * l.m, 0, TAU); ctx.fill();
  }

  // Inner bright core
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  cg.addColorStop(0, rgba(C.white, 0.4 + Math.sin(time * 1.3) * 0.1));
  cg.addColorStop(0.35, rgba(C.purpleLight, 0.2));
  cg.addColorStop(0.7, rgba(C.purple, 0.05));
  cg.addColorStop(1, rgba(C.purple, 0));
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();

  // Center bright dot
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.18, 0, TAU);
  ctx.fillStyle = rgba(C.white, 0.75 + Math.sin(time * 2) * 0.15);
  ctx.fill();

  // "LINA" text
  const fontSize = Math.round(r * 0.55);
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(C.white, 0.65 + Math.sin(time * 0.6) * 0.12);
  ctx.fillText('LINA', cx, cy - 1);

  // "IA" subtitle
  const subSize = Math.round(r * 0.25);
  ctx.font = `500 ${subSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgba(C.purpleLight, 0.45 + Math.sin(time * 0.8) * 0.1);
  ctx.letterSpacing = '0.15em';
  ctx.fillText('I N T E L I G E N C I A', cx, cy + fontSize * 0.55);
}

// ─── Pulse wave ───────────────────────────────────────────────────
class Pulse {
  constructor(cx, cy, max) {
    this.cx = cx; this.cy = cy; this.max = max;
    this.r = 0; this.ok = true;
  }
  update(dt) {
    this.r += 50 * dt;
    if (this.r > this.max) this.ok = false;
  }
  draw(ctx) {
    if (!this.ok) return;
    const a = 0.14 * (1 - this.r / this.max);
    ctx.beginPath(); ctx.arc(this.cx, this.cy, this.r, 0, TAU);
    ctx.strokeStyle = rgba(C.purple, Math.max(0, a));
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

// ─── Spark ────────────────────────────────────────────────────────
class Spark {
  constructor(cx, cy, range) {
    const a = Math.random() * TAU, d = 15 + Math.random() * range;
    this.ox = cx + Math.cos(a) * d; this.oy = cy + Math.sin(a) * d;
    this.x = this.ox; this.y = this.oy;
    this.r = 0.3 + Math.random() * 1;
    this.color = pick([C.purple, C.purpleLight, C.purpleDark, C.pink]);
    this.alpha = 0.04 + Math.random() * 0.15;
    this.phase = Math.random() * TAU;
    this.sx = 0.3 + Math.random() * 1; this.sy = 0.3 + Math.random() * 1;
    this.ax = 2 + Math.random() * 5; this.ay = 2 + Math.random() * 5;
  }
  update(time, mx, my) {
    this.x = this.ox + Math.sin(time * this.sx + this.phase) * this.ax;
    this.y = this.oy + Math.cos(time * this.sy + this.phase) * this.ay;
    if (mx !== null) {
      const dx = this.x - mx, dy = this.y - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 110 && d > 0) { const f = (1 - d / 110) * 10; this.x += dx / d * f; this.y += dy / d * f; }
    }
  }
  draw(ctx) {
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fillStyle = rgba(this.color, this.alpha); ctx.fill();
  }
}

// ─── Component ────────────────────────────────────────────────────
export default function LinaSilhouette({ className = '' }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: null, y: null });
  const animRef = useRef(null);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = rect.width, h = rect.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = w * 0.5, cy = h * 0.48;
    const unit = Math.min(w, h);
    const coreR = unit * 0.085;

    // Particle rings
    const rings = [
      new Ring(cx, cy, unit * 0.17, unit * 0.06, 20, 0.45, 40, [C.purpleLight, C.white]),
      new Ring(cx, cy, unit * 0.28, unit * 0.095, -28, -0.25, 55, [C.purple, C.pink]),
      new Ring(cx, cy, unit * 0.42, unit * 0.085, 40, 0.15, 65, [C.purpleDark, C.purple, C.cyan]),
    ];

    // Feature nodes — large orbit
    const nodeA = unit * 0.38, nodeB = unit * 0.15, nodeTilt = 35;
    const nodes = NODES.map((d, i) =>
      new FeatureNode(cx, cy, nodeA, nodeB, nodeTilt, 0.1, d, i, NODES.length)
    );

    // Sparks
    const sparks = Array.from(
      { length: Math.min(130, Math.floor(unit * 0.25)) },
      () => new Spark(cx, cy, unit * 0.46)
    );

    let pulses = [], lastPulse = 0;
    const t0 = performance.now();
    let prev = t0;

    function loop(now) {
      const time = (now - t0) / 1000;
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x, my = mouseRef.current.y;

      // Sparks
      for (const s of sparks) { s.update(time, mx, my); s.draw(ctx); }

      // Pulses
      if (time - lastPulse > 3) { pulses.push(new Pulse(cx, cy, unit * 0.48)); lastPulse = time; }
      pulses = pulses.filter(p => p.ok);
      for (const p of pulses) { p.update(dt); p.draw(ctx); }

      // Rings
      for (const r of rings) r.draw(ctx, time);

      // Nodes
      for (const n of nodes) n.update(time, mx, my);

      // Connections (behind nodes)
      drawConnections(ctx, nodes, cx, cy, time);

      // Sort by depth, draw
      const sorted = [...nodes].sort((a, b) => a.depth - b.depth);
      for (const n of sorted) n.draw(ctx, time);

      // Core
      const anyHover = nodes.some(n => n.hoverT > 0.1);
      drawCore(ctx, cx, cy, time, coreR, anyHover);

      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    init();
    const onResize = () => { cancelAnimationFrame(animRef.current); init(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(animRef.current); };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      className={`lina-silhouette ${className}`}
      onMouseMove={(e) => {
        const r = canvasRef.current?.getBoundingClientRect();
        if (r) mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      }}
      onMouseLeave={() => { mouseRef.current = { x: null, y: null }; }}
      aria-hidden="true"
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'default' }}
    />
  );
}
