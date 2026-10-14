import { test } from 'node:test';
import { digitMask } from '../src/braille.js';
import assert from 'node:assert/strict';
import {
  createProgress, canUnlock, unlockNext, needsHint, recordAnswer, pickNext, statOf,
  isMastered, MAX_BOX, MASTERED_BOX,
  createReview, scheduleReview, takeDueReview, REVIEW_ROUNDS, REVIEW_GAP,
  readablePool, pickChoices,
} from '../src/learning.js';

const ORDER = [...'abcdefghij'];

test('desbloquea en orden y se detiene al final', () => {
  const p = createProgress();
  assert.equal(unlockNext(p, ORDER), 'a');
  assert.equal(unlockNext(p, ORDER), 'b');
  assert.equal(unlockNext(p, ['a', 'b']), null);
});

test('solo se desbloquea cuando todas las letras están dominadas (MASTERED_BOX)', () => {
  const p = createProgress();
  assert.equal(canUnlock(p), true);
  unlockNext(p, ORDER);
  assert.equal(canUnlock(p), false);
  statOf(p, 'a').box = MASTERED_BOX - 1;
  assert.equal(canUnlock(p), false);
  statOf(p, 'a').box = MASTERED_BOX;
  assert.equal(canUnlock(p), true);
});

test('acierto con pista sube a la caja 1; sin pista, una caja más', () => {
  const p = createProgress();
  unlockNext(p, ORDER);
  assert.equal(needsHint(p, 'a'), true);
  recordAnswer(p, 'a', { correct: true, hinted: true });
  assert.equal(statOf(p, 'a').box, 1);
  assert.equal(needsHint(p, 'a'), false);
  recordAnswer(p, 'a', { correct: true, hinted: false });
  assert.equal(statOf(p, 'a').box, 2);
});

test('la caja no pasa de MAX_BOX y se domina en MASTERED_BOX', () => {
  const p = createProgress();
  for (let i = 0; i < MAX_BOX + 3; i++) recordAnswer(p, 'a', { correct: true, hinted: false });
  assert.equal(statOf(p, 'a').box, MAX_BOX);
  assert.equal(isMastered(p, 'a'), MAX_BOX >= MASTERED_BOX);
});

test('un fallo baja solo una caja y registra la confusión', () => {
  const p = createProgress();
  statOf(p, 'e').box = 3;
  recordAnswer(p, 'e', { correct: false, hinted: false, answeredAs: 'i' });
  assert.equal(statOf(p, 'e').box, 2);
  assert.deepEqual(p.confusions, { 'e>i': 1 });
  statOf(p, 'e').box = 0;
  recordAnswer(p, 'e', { correct: false, hinted: true });
  assert.equal(statOf(p, 'e').box, 0);
});

// Simula turnos: devuelve qué letra de refuerzo sale en cada uno (o null).
function runTurns(review, turns, other = 'x') {
  const out = [];
  let previous = 'e';
  for (let i = 0; i < turns; i++) {
    const letter = takeDueReview(review, previous);
    out.push(letter);
    previous = letter ?? other;
  }
  return out;
}

test('tras un fallo la letra vuelve REVIEW_ROUNDS veces, con REVIEW_GAP turnos entre medias', () => {
  const review = createReview();
  scheduleReview(review, 'e');
  const turns = runTurns(review, 1 + (REVIEW_GAP + 1) * REVIEW_ROUNDS + 3);
  const hits = turns.map((l, i) => (l === 'e' ? i : -1)).filter((i) => i >= 0);
  assert.equal(hits.length, REVIEW_ROUNDS);
  assert.equal(hits[0], REVIEW_GAP);
  assert.equal(hits[1] - hits[0], REVIEW_GAP + 1);
  assert.equal(review.length, 0);
});

test('fallar otra vez reinicia las rondas sin acumularlas', () => {
  const review = createReview();
  scheduleReview(review, 'e');
  scheduleReview(review, 'e');
  assert.equal(review.length, 1);
  assert.equal(review[0].left, REVIEW_ROUNDS);
});

test('el refuerzo nunca repite la letra del turno anterior', () => {
  const review = createReview();
  scheduleReview(review, 'e');
  review[0].dueIn = 0;
  assert.equal(takeDueReview(review, 'e'), null);
  assert.equal(takeDueReview(review, 'a'), 'e');
});

test('pickNext evita repetir la letra anterior si hay más', () => {
  const p = createProgress();
  unlockNext(p, ORDER);
  unlockNext(p, ORDER);
  for (let i = 0; i < 20; i++) assert.equal(pickNext(p, Math.random, 'a'), 'b');
  assert.equal(pickNext(createProgress()), null);
});

test('pickNext favorece las cajas bajas', () => {
  const p = createProgress();
  unlockNext(p, ORDER);
  unlockNext(p, ORDER);
  statOf(p, 'a').box = MAX_BOX; // peso 1
  statOf(p, 'b').box = 0; //       peso 6
  assert.equal(pickNext(p, () => 0.0), 'a');
  assert.equal(pickNext(p, () => 0.2), 'b');
});

test('readablePool solo incluye letras ya escritas bien al menos una vez', () => {
  const p = createProgress();
  ['a', 'b', 'c'].forEach(() => unlockNext(p, ORDER));
  statOf(p, 'a').box = 1;
  statOf(p, 'b').box = 3;
  assert.deepEqual(readablePool(p), ['a', 'b']);
});

test('pickChoices: la correcta + 2 distractores distintos', () => {
  const pool = [...'abcdefghij'];
  for (let i = 0; i < 20; i++) {
    const choices = pickChoices('e', pool);
    assert.equal(choices.length, 3);
    assert.ok(choices.includes('e'));
    assert.equal(new Set(choices).size, 3);
  }
});

test('pickChoices prioriza las letras con las que ya se confundió', () => {
  const choices = pickChoices('e', [...'abcdefghij'], { 'e>i': 2 });
  assert.ok(choices.includes('i'));
});

test('pickChoices funciona con pocas letras', () => {
  assert.deepEqual(pickChoices('a', ['a']), ['a']);
  assert.equal(pickChoices('a', ['a', 'b']).length, 2);
});

test('pickChoices con números: compara por la celda del último dígito', () => {
  const numbers = Array.from({ length: 10 }, (_, i) => String(i + 1));
  const lastDigit = (n) => digitMask(Number(n.at(-1)));
  for (let i = 0; i < 30; i++) {
    const choices = pickChoices('10', numbers, {}, Math.random, lastDigit);
    assert.equal(choices.length, 3);
    assert.ok(choices.includes('10'));
    assert.equal(new Set(choices).size, 3);
  }
});

test('progresión: sin fallos se desbloquean letras nuevas durante toda la sesión, no solo 3', () => {
  const p = createProgress();
  const order = [...'abcdefghij'];
  let previous = null;
  for (let turn = 0; turn < 36; turn++) { // una sesión: 3 bloques × 12 aciertos
    const letter = (canUnlock(p) && unlockNext(p, order)) || pickNext(p, Math.random, previous);
    recordAnswer(p, letter, { correct: true, hinted: needsHint(p, letter) });
    previous = letter;
  }
  assert.ok(p.unlocked.length >= 5, `solo ${p.unlocked.length} letras: ${p.unlocked.join('')}`);
  // Nunca hay más de una letra sin dominar a la vez.
  assert.ok(p.unlocked.filter((l) => !isMastered(p, l)).length <= 1);
});
