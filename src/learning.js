// Repetición espaciada tipo Leitner. Puro: sin DOM ni almacenamiento.
import { maskOf, dotDistance } from './braille.js';
// Cada letra vive en una "caja" de 0 a MAX_BOX; cuanto más baja, más a menudo sale.

export const MAX_BOX = 5;
export const MASTERED_BOX = 3;
// Una letra nueva solo se desbloquea cuando todas las anteriores llegan a esta caja.
export const UNLOCK_BOX = 2;

export function createProgress() {
  return { unlocked: [], stats: {}, confusions: {} };
}

export function statOf(progress, letter) {
  progress.stats[letter] ??= { seen: 0, correct: 0, box: 0 };
  return progress.stats[letter];
}

export function canUnlock(progress) {
  return progress.unlocked.every((letter) => statOf(progress, letter).box >= UNLOCK_BOX);
}

export function unlockNext(progress, order) {
  const next = order.find((letter) => !progress.unlocked.includes(letter));
  if (!next) return null;
  progress.unlocked.push(next);
  statOf(progress, next);
  return next;
}

// La pista (celda fantasma) se muestra mientras la letra esté en la caja 0.
export function needsHint(progress, letter) {
  return statOf(progress, letter).box === 0;
}

export function isMastered(progress, letter) {
  return statOf(progress, letter).box >= MASTERED_BOX;
}

// Registra solo el primer intento de cada turno.
// Un fallo baja solo una caja: se repasa más, pero no se pierde todo lo ganado.
export function recordAnswer(progress, letter, { correct, hinted, answeredAs = null }) {
  const stat = statOf(progress, letter);
  stat.seen += 1;
  if (correct) {
    stat.correct += 1;
    stat.box = hinted ? Math.max(stat.box, 1) : Math.min(stat.box + 1, MAX_BOX);
  } else {
    stat.box = Math.max(stat.box - 1, 0);
    if (answeredAs && answeredAs !== letter) {
      const key = `${letter}>${answeredAs}`;
      progress.confusions[key] = (progress.confusions[key] ?? 0) + 1;
    }
  }
}

// Refuerzo tras un fallo: la letra vuelve REVIEW_ROUNDS veces más en la sesión,
// con REVIEW_GAP turnos de otras letras entre medias.
export const REVIEW_ROUNDS = 2;
export const REVIEW_GAP = 2;

export function createReview() {
  return [];
}

// Un nuevo fallo de la misma letra reinicia sus rondas en vez de acumularlas.
export function scheduleReview(review, letter) {
  const item = review.find((r) => r.letter === letter);
  const fresh = { left: REVIEW_ROUNDS, dueIn: REVIEW_GAP + 1 };
  if (item) Object.assign(item, fresh);
  else review.push({ letter, ...fresh });
}

// Avanza un turno y devuelve la letra de refuerzo que toca ahora, si hay alguna.
export function takeDueReview(review, previous = null) {
  review.forEach((r) => { r.dueIn -= 1; });
  const item = review.find((r) => r.dueIn <= 0 && r.letter !== previous);
  if (!item) return null;
  item.left -= 1;
  item.dueIn = REVIEW_GAP + 1;
  if (item.left === 0) review.splice(review.indexOf(item), 1);
  return item.letter;
}

// Elige la siguiente letra con peso inverso a su caja, evitando repetir la anterior.
export function pickNext(progress, random = Math.random, previous = null) {
  const pool = progress.unlocked.length > 1
    ? progress.unlocked.filter((letter) => letter !== previous)
    : progress.unlocked;
  if (pool.length === 0) return null;
  const weights = pool.map((letter) => MAX_BOX + 1 - statOf(progress, letter).box);
  let roll = random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ---------- Lectura ----------

// Se puede leer una letra cuando ya se ha escrito bien al menos una vez.
export function readablePool(progress) {
  return progress.unlocked.filter((letter) => statOf(progress, letter).box >= 1);
}

// Opciones de pista para leer: la correcta + 2 distractores, priorizando
// las letras con las que ya se ha confundido y las que difieren en un solo punto.
export function pickChoices(letter, pool, confusions = {}, random = Math.random) {
  const score = (other) => 10 * ((confusions[`${letter}>${other}`] ?? 0) + (confusions[`${other}>${letter}`] ?? 0))
    + (dotDistance(maskOf(letter), maskOf(other)) === 1 ? 1 : 0)
    + random() * 0.5;
  const distractors = pool
    .filter((other) => other !== letter)
    .map((other) => [other, score(other)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([other]) => other);
  const choices = [...distractors];
  choices.splice(Math.floor(random() * (choices.length + 1)), 0, letter);
  return choices;
}
