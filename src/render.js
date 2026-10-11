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
        k.innerHTML = `<b>${KEY_LABELS[layout][dot]}</b><small>${dot}</small>`;
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

  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.98;
      p.life -= 1;
      ctx.globalAlpha = Math.max(p.life / p.maxLife, 0);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (particles.length) requestAnimationFrame(frame);
    else running = false;
  }

  return {
    burstAt(element, colors, count = 28) {
      if (!enabled() || !colors.length) return;
      const r = element.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        const life = 40 + Math.random() * 30;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          size: 2 + Math.random() * 3,
          color: colors[i % colors.length],
          life, maxLife: life,
        });
      }
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    },
  };
}
