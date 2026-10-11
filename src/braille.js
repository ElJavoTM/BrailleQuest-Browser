// Braille español (CBE), grado 1.
// Cada celda es una máscara de 6 bits: el punto n ocupa el bit (n - 1),
// igual que en el bloque Unicode de braille (U+2800).

export const DOTS = [1, 2, 3, 4, 5, 6];

const DOTS_BY_CHAR = {
  // Serie 1: puntos 1-2-4-5
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
  f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  // Serie 2: serie 1 + punto 3
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
  p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  // Serie 3: a–e + puntos 3 y 6
  u: [1, 3, 6], v: [1, 2, 3, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
  // Propias del español
  ñ: [1, 2, 4, 5, 6], w: [2, 4, 5, 6],
};

export const LETTER_NAMES = {
  a: 'a', b: 'be', c: 'ce', d: 'de', e: 'e', f: 'efe', g: 'ge', h: 'hache', i: 'i', j: 'jota',
  k: 'ka', l: 'ele', m: 'eme', n: 'ene', ñ: 'eñe', o: 'o', p: 'pe', q: 'cu', r: 'erre', s: 'ese',
  t: 'te', u: 'u', v: 'uve', w: 'uve doble', x: 'equis', y: 'i griega', z: 'zeta',
};

export const LEVELS = [
  { id: 1, name: 'Bosque de los Diez', letters: [...'abcdefghij'] },
  { id: 2, name: 'Cuevas del Tercer Punto', letters: [...'klmnopqrst'] },
  { id: 3, name: 'Costa de las Mareas', letters: [...'uvxyz'] },
];

export function maskFromDots(dots) {
  return dots.reduce((mask, dot) => mask | (1 << (dot - 1)), 0);
}

export function dotsFromMask(mask) {
  return DOTS.filter((dot) => hasDot(mask, dot));
}

export function hasDot(mask, dot) {
  return (mask & (1 << (dot - 1))) !== 0;
}

const MASK_BY_CHAR = Object.fromEntries(
  Object.entries(DOTS_BY_CHAR).map(([char, dots]) => [char, maskFromDots(dots)]),
);
const CHAR_BY_MASK = new Map(Object.entries(MASK_BY_CHAR).map(([char, mask]) => [mask, char]));

export function maskOf(char) {
  const mask = MASK_BY_CHAR[char];
  if (mask === undefined) throw new Error(`Carácter sin tabla braille: ${char}`);
  return mask;
}

export function charOf(mask) {
  return CHAR_BY_MASK.get(mask) ?? null;
}

// Número de puntos en los que se diferencian dos celdas.
export function dotDistance(a, b) {
  return dotsFromMask(a ^ b).length;
}

export function unicodeOf(mask) {
  return String.fromCodePoint(0x2800 + mask);
}
