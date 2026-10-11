// Progreso y ajustes guardados en cookies propias (sin terceros).
// Una cookie admite ~4 KB, así que el JSON se reparte en trozos: bq_0, bq_1… y bq_n con el total.
// Si las cookies fallan (bloqueadas, modo privado), el juego sigue funcionando sin guardar.

const PREFIX = 'bq_';
const CHUNK_SIZE = 3500;
const MAX_AGE = 60 * 60 * 24 * 400; // 400 días, el máximo que aceptan los navegadores
const LEGACY_KEY = 'braille-quest:v1'; // versiones anteriores guardaban en localStorage

function readCookies() {
  return Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((pair) => {
    const i = pair.indexOf('=');
    return [pair.slice(0, i), pair.slice(i + 1)];
  }));
}

function writeCookie(name, value, maxAge = MAX_AGE) {
  document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function loadLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function load() {
  try {
    const cookies = readCookies();
    const count = Number(cookies[`${PREFIX}n`]);
    if (!count) return loadLegacy();
    let encoded = '';
    for (let i = 0; i < count; i++) {
      const part = cookies[`${PREFIX}${i}`];
      if (part === undefined) return loadLegacy(); // guardado incompleto
      encoded += part;
    }
    return JSON.parse(decodeURIComponent(encoded));
  } catch {
    return loadLegacy();
  }
}

export function save(data) {
  try {
    const encoded = encodeURIComponent(JSON.stringify(data));
    const previous = Number(readCookies()[`${PREFIX}n`]) || 0;
    const count = Math.ceil(encoded.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      writeCookie(`${PREFIX}${i}`, encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    writeCookie(`${PREFIX}n`, count);
    // Borra los trozos sobrantes si el guardado anterior ocupaba más.
    for (let i = count; i < previous; i++) writeCookie(`${PREFIX}${i}`, '', 0);
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* sin localStorage */ }
  } catch {
    // Sin cookies disponibles: se juega sin guardar.
  }
}
