// Dibujo: celda grande, teclado en pantalla, enemigo y partículas.
import { DOTS, hasDot, dotsFromMask } from './braille.js';
import { KEY_LABELS } from './input.js';

// Un color fijo por punto, en todo el juego. Pendiente de validar con daltonismo (ronda R1).
export const DOT_COLORS = {
  1: '#FFB020',
  2: '#4CC9F0',
  3: '#3DDC97',
  4: '#FF5CA8',
  5: '#B794F6',
  6: '#FF6B4A',
};

export function applyDotColors(root = document.documentElement) {
  for (const dot of DOTS) root.style.setProperty(`--dot-${dot}`, DOT_COLORS[dot]);
}

// Posición en la rejilla 2×3: puntos 1-2-3 a la izquierda, 4-5-6 a la derecha.
const GRID = { 1: [1, 1], 2: [2, 1], 3: [3, 1], 4: [1, 2], 5: [2, 2], 6: [3, 2] };

function setDotClasses(el, dot, mask, { ghost = 0, wrong = 0 }) {
  el.classList.toggle('on', hasDot(mask, dot));
  el.classList.toggle('ghost', hasDot(ghost, dot) && !hasDot(mask, dot));
  el.classList.toggle('wrong', hasDot(wrong, dot));
}

export function createCell(container) {
  const el = document.createElement('div');
  el.className = 'cell';
  const dots = DOTS.map((dot) => {
    const d = document.createElement('div');
    d.className = 'dot';
    d.dataset.dot = dot;
    d.style.gridRow = GRID[dot][0];
    d.style.gridColumn = GRID[dot][1];
    d.innerHTML = `<span>${dot}</span>`;
    el.append(d);
    return d;
  });
  container.replaceChildren(el);
  return {
    el,
    set(mask, marks = {}) {
      dots.forEach((d, i) => setDotClasses(d, DOTS[i], mask, marks));
    },
    flash(className) {
      el.classList.remove(className);
      void el.offsetWidth; // reinicia la animación CSS
      el.classList.add(className);
    },
  };
}

export function createKeyboard(container) {
  const el = document.createElement('div');
  el.className = 'keyboard';
  const keys = DOTS.map((dot) => {
    const k = document.createElement('div');
    k.className = 'key';
    k.dataset.dot = dot;
    k.style.gridRow = GRID[dot][0];
    k.style.gridColumn = GRID[dot][1];
    el.append(k);
    return k;
  });
  container.replaceChildren(el);
  return {
    setLayout(layout) {
      keys.forEach((k, i) => {
        const dot = DOTS[i];
        // El número del punto manda; la tecla física va pequeña debajo.
        k.innerHTML = `<b>${dot}</b><small>${KEY_LABELS[layout][dot]}</small>`;
      });
    },
    set(mask, marks = {}) {
      keys.forEach((k, i) => setDotClasses(k, DOTS[i], mask, marks));
    },
  };
}

export function polygonPoints(sides, radius) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return `${(radius * Math.cos(angle)).toFixed(1)},${(radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

export function dotColorsOf(mask) {
  return dotsFromMask(mask).map((dot) => DOT_COLORS[dot]);
}

// Partículas en un <canvas> a pantalla completa. Solo anima mientras hay partículas vivas.
// Tres tipos: chispas (caen con gravedad), proyectiles (vuelan en curva hacia un destino) y ondas.
export function createFx(canvas, enabled) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let running = false;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const centerOf = (element) => {
    const r = element.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  function glow(color, blur) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function step(p) {
    if (p.kind === 'bolt') {
      if (p.delay > 0) { p.delay -= 1; return; }
      p.t = Math.min(p.t + p.speed, 1);
      const u = 1 - p.t; // curva cuadrática de Bézier
      p.x = u * u * p.x0 + 2 * u * p.t * p.cx + p.t * p.t * p.x1;
      p.y = u * u * p.y0 + 2 * u * p.t * p.cy + p.t * p.t * p.y1;
      if (p.t >= 1) p.life = 0;
      glow(p.color, 16);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    p.life -= 1;
    ctx.globalAlpha = Math.max(p.life / p.maxLife, 0);
    if (p.kind === 'ring') {
      p.r += p.vr;
      p.vr *= 0.93;
      glow(p.color, 20);
      ctx.lineWidth = 4 * (p.life / p.maxLife) + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.98;
      glow(p.color, 12);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter((p) => p.life > 0);
    particles.forEach(step);
    if (particles.length) requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  function sparks({ x, y }, colors, count, power = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 5) * power;
      const life = 40 + Math.random() * 30;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 3 * power,
        color: colors[i % colors.length],
        life, maxLife: life,
      });
    }
  }

  function ring({ x, y }, color, power = 1) {
    particles.push({ kind: 'ring', x, y, r: 10, vr: 9 * power, color, life: 30, maxLife: 30 });
  }

  return {
    burstAt(element, colors, count = 28) {
      if (!enabled() || !colors.length) return;
      sparks(centerOf(element), colors, count);
      start();
    },
    // Hechizo: un proyectil por color sale de `from`, vuela hasta `to` y estalla allí.
    // `onHit` se llama al impactar (o al momento si los efectos están apagados).
    spell(from, to, colors, { power = 1, onHit } = {}) {
      if (!enabled() || !colors.length) {
        onHit?.();
        return;
      }
      const a = centerOf(from);
      const b = centerOf(to);
      const flight = 18; // fotogramas
      colors.forEach((color, i) => {
        const bend = (i - (colors.length - 1) / 2) * 70 + (Math.random() - 0.5) * 40;
        particles.push({
          kind: 'bolt', x: a.x, y: a.y, x0: a.x, y0: a.y, x1: b.x, y1: b.y,
          cx: (a.x + b.x) / 2 + bend, cy: Math.min(a.y, b.y) - 60 - Math.abs(bend) / 2,
          t: 0, speed: 1 / flight, delay: i * 2, size: 5 + power * 2, color, life: 1,
        });
      });
      start();
      const delayFrames = flight + (colors.length - 1) * 2;
      setTimeout(() => {
        sparks(b, colors, Math.round(20 * power), power);
        colors.forEach((color, i) => setTimeout(() => ring(b, color, power), i * 60));
        start();
        onHit?.();
      }, (delayFrames * 1000) / 60);
    },
  };
}
