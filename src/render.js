// Dibujo: celda grande, teclado en pantalla, enemigo y partículas.
import { DOTS, hasDot, dotsFromMask, digitMask } from './braille.js';
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
// El brillo sale de sprites precalculados (un degradado por color) y no de shadowBlur, que es muy lento.
const SPRITE_SIZE = 64;
const sprites = new Map();

function spriteOf(color) {
  if (!sprites.has(color)) {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_SIZE;
    const g = c.getContext('2d');
    const r = SPRITE_SIZE / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.45, `${color}55`);
    grad.addColorStop(1, `${color}00`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    sprites.set(color, c);
  }
  return sprites.get(color);
}

export function createFx(canvas, enabled) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let running = false;
  let last = 0;

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

  function glowAt(x, y, size, color) {
    const r = size * 3.2;
    ctx.drawImage(spriteOf(color), x - r, y - r, r * 2, r * 2);
  }

  // `k` = tiempo transcurrido en «fotogramas de 60 Hz»: la simulación va igual a 60, 120 Hz
  // o con fotogramas perdidos (antes avanzaba por fotograma y en pantallas de 120 Hz iba al doble).
  function step(p, k) {
    if (p.kind === 'bolt') {
      if (p.delay > 0) { p.delay -= k; return; }
      p.t = Math.min(p.t + p.speed * k, 1);
      const u = 1 - p.t; // curva cuadrática de Bézier
      p.x = u * u * p.x0 + 2 * u * p.t * p.cx + p.t * p.t * p.x1;
      p.y = u * u * p.y0 + 2 * u * p.t * p.cy + p.t * p.t * p.y1;
      if (p.spin) { // espiral: gira alrededor de la trayectoria y se cierra al llegar
        const angle = p.phase + p.t * Math.PI * 6;
        p.x += Math.cos(angle) * p.spin * u;
        p.y += Math.sin(angle) * p.spin * u;
      }
      if (p.trail && (p.trailAcc = (p.trailAcc ?? 0) + k) >= 1) {
        p.trailAcc = 0;
        trail.push({ x: p.x, y: p.y, size: p.size * 0.6, color: p.color, life: 10, maxLife: 10 });
      }
      glowAt(p.x, p.y, p.size, p.color);
      if (p.t >= 1) {
        p.life = 0;
        p.group.arrived();
      }
      return;
    }
    p.life -= k;
    const alpha = Math.max(p.life / p.maxLife, 0);
    ctx.globalAlpha = alpha;
    if (p.kind === 'ring') {
      p.r += p.vr * k;
      p.vr *= 0.93 ** k;
      const w = 4 * alpha + 1;
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = alpha * 0.25; // halo ancho y tenue + trazo fino: brillo sin shadowBlur
      ctx.lineWidth = w * 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = w;
      ctx.stroke();
    } else if (p.vx === undefined) { // estela: quieta
      glowAt(p.x, p.y, p.size * alpha, p.color);
    } else {
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vy += (p.gravity ?? 0.12) * k;
      p.vx *= 0.98 ** k;
      glowAt(p.x, p.y, p.size, p.color);
    }
    ctx.globalAlpha = 1;
  }

  const trail = []; // estela del foco Cometa, se añade a las partículas en cada fotograma

  function frame(now) {
    // Tope de 3 fotogramas por paso: tras un parón no hay saltos bruscos.
    const k = Math.min((now - last) / (1000 / 60), 3);
    last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    particles.push(...trail.splice(0));
    particles = particles.filter((p) => p.life > 0);
    ctx.globalCompositeOperation = 'lighter'; // los brillos se suman, como luz de neón
    for (const p of particles) step(p, k);
    ctx.globalCompositeOperation = 'source-over';
    if (particles.length) requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  // `rays` > 0: las chispas salen en ese número de rayos (sello Estrella) y sin gravedad.
  function sparks({ x, y }, colors, count, power = 1, rays = 0) {
    for (let i = 0; i < count; i++) {
      const angle = rays
        ? (Math.floor(Math.random() * rays) / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.08
        : Math.random() * Math.PI * 2;
      const speed = (rays ? 4 + Math.random() * 7 : 2 + Math.random() * 5) * power;
      const life = 40 + Math.random() * 30;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 3 * power,
        color: colors[i % colors.length],
        gravity: rays ? 0.02 : 0.12,
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
    // Hechizo: proyectiles (uno por color) salen de `from` y vuelan hasta `to`.
    // `foco` cambia el vuelo (orbe, cometa, rayo, gemelos, espiral). `onHit` se llama cuando llega
    // el último proyectil, en el mismo fotograma (o al momento si los efectos están apagados).
    spell(from, to, colors, { power = 1, foco = 'orbe', onHit } = {}) {
      if (!enabled() || !colors.length) {
        onHit?.();
        return;
      }
      const a = centerOf(from);
      const b = centerOf(to);
      const flight = foco === 'rayo' ? 9 : 18; // fotogramas de 60 Hz
      const shots = foco === 'gemelos' ? colors.flatMap((c) => [c, c]) : colors;
      let pending = shots.length;
      const group = { arrived: () => { if (--pending === 0) onHit?.(); } };
      shots.forEach((color, i) => {
        const spread = (i - (shots.length - 1) / 2) * (foco === 'gemelos' ? 45 : 70);
        const bend = foco === 'rayo' ? 0 : spread + (Math.random() - 0.5) * 40;
        particles.push({
          kind: 'bolt', group, x: a.x, y: a.y, x0: a.x, y0: a.y, x1: b.x, y1: b.y,
          cx: (a.x + b.x) / 2 + bend,
          cy: foco === 'rayo' ? (a.y + b.y) / 2 : Math.min(a.y, b.y) - 60 - Math.abs(bend) / 2,
          t: 0, speed: 1 / flight, delay: foco === 'rayo' ? i : i * 2, size: 5 + power * 2, color, life: 1,
          trail: foco === 'cometa',
          spin: foco === 'espiral' ? 34 : 0, phase: (i / shots.length) * Math.PI * 2,
        });
      });
      start();
    },
    // Estallido del impacto en `element`. `sello`: onda, estrella, nova, glitch, supernova.
    explode(element, colors, { power = 1, sello = 'onda' } = {}) {
      if (!enabled() || !colors.length) return;
      const b = centerOf(element);
      const star = sello === 'estrella' || sello === 'supernova';
      const nova = sello === 'nova' || sello === 'supernova';
      sparks(b, colors, Math.round((star ? 34 : 22) * power), power, star ? 8 : 0);
      if (sello === 'supernova') sparks(b, ['#ffffff', ...colors], Math.round(24 * power), power * 1.3);
      const rings = nova ? [...colors, '#ffffff', ...colors] : colors;
      rings.forEach((color, i) => ring(b, color, (nova ? 1.2 : 1) * power + i * 0.15));
      start();
    },
  };
}

// Mini signo generador (solo puntos) que recorre los dígitos 1 … 9, 0 en bucle.
const TICKER_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const TICKER_MS = 250; // 4 cambios por segundo

export function createDigitTicker(container) {
  const dots = DOTS.map((dot) => {
    const d = document.createElement('i');
    d.dataset.dot = dot;
    d.style.gridRow = GRID[dot][0];
    d.style.gridColumn = GRID[dot][1];
    return d;
  });
  container.replaceChildren(...dots);
  let timer = null;
  let index = 0;

  function show() {
    const mask = digitMask(TICKER_DIGITS[index]);
    dots.forEach((d, i) => d.classList.toggle('on', hasDot(mask, DOTS[i])));
    index = (index + 1) % TICKER_DIGITS.length;
  }

  return {
    // Se puede llamar en cada repetición de tecla: si ya está en marcha no hace nada.
    start() {
      if (timer) return;
      index = 0;
      show();
      container.hidden = false;
      timer = setInterval(show, TICKER_MS);
    },
    stop() {
      clearInterval(timer);
      timer = null;
      container.hidden = true;
    },
  };
}
