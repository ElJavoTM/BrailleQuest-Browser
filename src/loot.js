// Personaje, equipo y botín. Puro: sin DOM ni almacenamiento.
// El nivel sale del dominio real (caracteres dominados), no de jugar mucho.
// El botín nunca se pierde ni se repite, y jugar mejor solo mejora la rareza (sin mecánicas de casino).
import { isMastered } from './learning.js';

export const SLOTS = {
  foco: { name: 'Foco', desc: 'cómo vuela el hechizo', level: 1 },
  sello: { name: 'Sello', desc: 'cómo estalla el impacto', level: 3 },
  aura: { name: 'Aura', desc: 'el halo de tu celda', level: 5 },
};

export const RARITIES = {
  comun: { name: 'Común', weight: 70 },
  rara: { name: 'Rara', weight: 25 },
  epica: { name: 'Épica', weight: 5 },
};

// `start: true` = se tiene desde el principio (no sale en cofres).
export const ITEMS = [
  { id: 'orbe', slot: 'foco', rarity: 'comun', start: true, name: 'Orbe', desc: 'Bolas de luz. Lo clásico.' },
  { id: 'cometa', slot: 'foco', rarity: 'comun', name: 'Cometa', desc: 'Cada proyectil deja estela.' },
  { id: 'rayo', slot: 'foco', rarity: 'rara', name: 'Rayo', desc: 'En línea recta y el doble de rápido.' },
  { id: 'gemelos', slot: 'foco', rarity: 'rara', name: 'Gemelos', desc: 'Dos proyectiles por cada punto.' },
  { id: 'espiral', slot: 'foco', rarity: 'epica', name: 'Espiral', desc: 'Los proyectiles giran en espiral hasta el blanco.' },

  { id: 'onda', slot: 'sello', rarity: 'comun', start: true, name: 'Onda', desc: 'Anillos de choque.' },
  { id: 'estrella', slot: 'sello', rarity: 'comun', name: 'Estrella', desc: 'El impacto estalla en ocho rayos.' },
  { id: 'nova', slot: 'sello', rarity: 'rara', name: 'Nova', desc: 'Triple anillo y destello de pantalla.' },
  { id: 'glitch', slot: 'sello', rarity: 'rara', name: 'Glitch', desc: 'La pantalla se corrompe un instante.' },
  { id: 'supernova', slot: 'sello', rarity: 'epica', name: 'Supernova', desc: 'Nova + estrella. Exagerado a propósito.' },

  { id: 'sin-aura', slot: 'aura', rarity: 'comun', start: true, name: 'Sin aura', desc: 'Celda limpia.' },
  { id: 'pulso', slot: 'aura', rarity: 'comun', name: 'Pulso', desc: 'Un halo cian que late.' },
  { id: 'circuito', slot: 'aura', rarity: 'comun', name: 'Circuito', desc: 'Un borde de luz que da vueltas.' },
  { id: 'prisma', slot: 'aura', rarity: 'rara', name: 'Prisma', desc: 'Halo con los seis colores de los puntos.' },
  { id: 'eclipse', slot: 'aura', rarity: 'epica', name: 'Eclipse', desc: 'Corona blanca sobre negro.' },
];

const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export function itemOf(id) {
  return BY_ID.get(id) ?? null;
}

export function createHero() {
  const start = ITEMS.filter((item) => item.start);
  return {
    owned: start.map((item) => item.id),
    equipped: Object.fromEntries(start.map((item) => [item.slot, item.id])),
    chests: 0,
  };
}

// Nivel = 1 + caracteres dominados en todos los progresos (letras, números…).
export function heroLevel(progresses) {
  return 1 + progresses.reduce(
    (sum, progress) => sum + progress.unlocked.filter((item) => isMastered(progress, item)).length, 0,
  );
}

export function slotUnlocked(slot, level) {
  return level >= SLOTS[slot].level;
}

// Rareza según cómo ha ido el combate: `quality` = aciertos a la primera (0–1).
// Jugar bien sube las rarezas altas; jugar mal nunca quita el cofre.
export function rarityWeights(quality) {
  const q = Math.min(Math.max(quality, 0), 1);
  return {
    comun: RARITIES.comun.weight - 40 * q,
    rara: RARITIES.rara.weight + 25 * q,
    epica: RARITIES.epica.weight + 15 * q,
  };
}

function pickWeighted(weights, random) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let roll = random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [key, w] of entries) {
    roll -= w;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1]?.[0] ?? null;
}

// Abre un cofre: un objeto que aún no se tiene. Si no queda de la rareza elegida,
// se busca en las demás (de la más alta a la más baja). Devuelve null si ya se tiene todo.
export function openChest(hero, quality, random = Math.random) {
  const pending = ITEMS.filter((item) => !hero.owned.includes(item.id));
  if (!pending.length) return null;
  const weights = rarityWeights(quality);
  const available = Object.fromEntries(
    Object.entries(weights).filter(([rarity]) => pending.some((item) => item.rarity === rarity)),
  );
  const rarity = pickWeighted(available, random);
  const pool = pending.filter((item) => item.rarity === rarity);
  const item = pool[Math.floor(random() * pool.length)];
  hero.owned.push(item.id);
  hero.chests += 1;
  return item;
}

export function equip(hero, id, level) {
  const item = itemOf(id);
  if (!item || !hero.owned.includes(id) || !slotUnlocked(item.slot, level)) return false;
  hero.equipped[item.slot] = id;
  return true;
}

// Lo que está equipado, contando solo los huecos abiertos (los cerrados usan lo inicial).
export function loadout(hero, level) {
  const start = createHero().equipped;
  return Object.fromEntries(Object.keys(SLOTS).map((slot) => [
    slot, slotUnlocked(slot, level) ? hero.equipped[slot] ?? start[slot] : start[slot],
  ]));
}
