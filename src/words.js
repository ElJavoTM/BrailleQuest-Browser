// Palabras para los jefes. Puro: sin DOM.
// Solo palabras reales en español, sin tildes, escritas únicamente con letras de la región.

// Bosque de los Diez: solo a–j.
export const WORDS_SERIE1 = [
  'cada', 'dada', 'cabe', 'beca', 'debe', 'bebe', 'idea', 'hada', 'haba', 'caja',
  'baja', 'deja', 'ceja', 'jefe', 'jefa', 'dice', 'hace', 'hice', 'hija', 'diga',
  'haga', 'bici', 'acaba', 'abeja', 'chica', 'ficha', 'fecha', 'dicha', 'hecha', 'bache',
  'hacia', 'cebada', 'bebida', 'bajada', 'cabida', 'decida', 'dedica',
];

// Palabras que se pueden escribir solo con `letters`.
export function wordsFor(words, letters) {
  const known = new Set(letters);
  return words.filter((word) => [...word].every((letter) => known.has(letter)));
}

// `count` palabras distintas al azar, de la más corta a la más larga (para ir calentando).
export function pickWords(words, count, random = Math.random) {
  const pool = [...words];
  const picked = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked.sort((a, b) => a.length - b.length);
}
