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
  // Vocales con tilde y ü
  á: [1, 2, 3, 5, 6], é: [2, 3, 4, 6], í: [3, 4], ó: [3, 4, 6], ú: [2, 3, 4, 5, 6], ü: [1, 2, 5, 6],
  // Signos. ¡! y ¿? comparten celda: abren y cierran igual.
  '-': [3, 6], ',': [2], '.': [3], '¡': [2, 3, 5], '¿': [2, 6],
};

export const LETTER_NAMES = {
  a: 'a', b: 'be', c: 'ce', d: 'de', e: 'e', f: 'efe', g: 'ge', h: 'hache', i: 'i', j: 'jota',
  k: 'ka', l: 'ele', m: 'eme', n: 'ene', ñ: 'eñe', o: 'o', p: 'pe', q: 'cu', r: 'erre', s: 'ese',
  t: 'te', u: 'u', v: 'uve', w: 'uve doble', x: 'equis', y: 'i griega', z: 'zeta',
  á: 'a con tilde', é: 'e con tilde', í: 'i con tilde', ó: 'o con tilde', ú: 'u con tilde',
  ü: 'u con diéresis',
  '-': 'guion', ',': 'coma', '.': 'punto', '¡': 'exclamación', '¿': 'interrogación',
};

// Signos dichos en una frase; las letras van como «la «a»».
const SIGN_PHRASES = {
  '-': 'el guion', ',': 'la coma', '.': 'el punto',
  '¡': 'la exclamación (¡ o !)', '¿': 'la interrogación (¿ o ?)',
};

export function theChar(char) {
  return SIGN_PHRASES[char] ?? `la «${char}»`;
}

export const LEVELS = [
  { id: 1, name: 'Bosque de los Diez', letters: [...'abcdefghij'] },
  { id: 2, name: 'Cuevas del Tercer Punto', letters: [...'klmnopqrst'] },
  { id: 3, name: 'Costa de las Mareas', letters: [...'uvxyz'] },
];

// Grupos para el calentamiento.
export const GROUPS = [
  { id: 'serie1', name: 'Serie 1', desc: 'a–j · solo puntos 1, 2, 4 y 5', letters: [...'abcdefghij'] },
  { id: 'serie2', name: 'Serie 2', desc: 'k–t · la serie 1 + el punto 3', letters: [...'klmnopqrst'] },
  { id: 'serie3', name: 'Serie 3', desc: 'u v x y z · a–e + los puntos 3 y 6', letters: [...'uvxyz'] },
  { id: 'espanol', name: 'Propias del español', desc: 'ñ y w', letters: ['ñ', 'w'] },
  { id: 'tildes', name: 'Vocales con tilde', desc: 'á é í ó ú · y la ü', letters: [...'áéíóúü'] },
];

export const ALL_LETTERS = GROUPS.flatMap((group) => group.letters);

export function groupOf(letter) {
  return GROUPS.find((group) => group.letters.includes(letter)) ?? null;
}

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

// ---------- Números ----------
// Signo de número (puntos 3-4-5-6) seguido de los dígitos, que son a–j: 1 = a … 9 = i, 0 = j.

export const NUMBER_SIGN = maskFromDots([3, 4, 5, 6]);
const LETTER_BY_DIGIT = [...'jabcdefghi'];

export function digitMask(digit) {
  return maskOf(LETTER_BY_DIGIT[digit]);
}

// Celdas de un número entero no negativo: [signo, dígito, dígito…].
export function numberCells(n) {
  return [NUMBER_SIGN, ...[...String(n)].map((d) => digitMask(Number(d)))];
}
