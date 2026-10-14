import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, LETTER_NAMES, maskOf, charOf, maskFromDots, dotsFromMask, unicodeOf, dotDistance,
  NUMBER_SIGN, digitMask, numberCells,
} from '../src/braille.js';

test('serie 1 (a–j) según la tabla CBE', () => {
  const expected = {
    a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
    f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  };
  for (const [letter, dots] of Object.entries(expected)) {
    assert.deepEqual(dotsFromMask(maskOf(letter)), dots, letter);
  }
});

test('serie 2 (k–t) = serie 1 + punto 3', () => {
  const series1 = [...'abcdefghij'];
  [...'klmnopqrst'].forEach((letter, i) => {
    assert.equal(maskOf(letter), maskOf(series1[i]) | maskFromDots([3]), letter);
  });
});

test('serie 3 (u v x y z) = a–e + puntos 3 y 6', () => {
  const base = [...'abcde'];
  [...'uvxyz'].forEach((letter, i) => {
    assert.equal(maskOf(letter), maskOf(base[i]) | maskFromDots([3, 6]), letter);
  });
});

test('ñ y w', () => {
  assert.deepEqual(dotsFromMask(maskOf('ñ')), [1, 2, 4, 5, 6]);
  assert.deepEqual(dotsFromMask(maskOf('w')), [2, 4, 5, 6]);
});

test('cada letra tiene una celda distinta y se puede recuperar', () => {
  const letters = Object.keys(LETTER_NAMES);
  const masks = letters.map(maskOf);
  assert.equal(new Set(masks).size, letters.length);
  letters.forEach((letter) => assert.equal(charOf(maskOf(letter)), letter));
});

test('charOf devuelve null para celdas sin letra', () => {
  assert.equal(charOf(0), null);
  assert.equal(charOf(maskFromDots([3, 6])), null);
});

test('Unicode coincide con el bloque braille estándar', () => {
  assert.equal(unicodeOf(maskOf('a')), '⠁');
  assert.equal(unicodeOf(maskOf('j')), '⠚');
  assert.equal(unicodeOf(maskOf('z')), '⠵');
});

test('los niveles solo usan letras con tabla', () => {
  for (const level of LEVELS) level.letters.forEach((letter) => maskOf(letter));
});

test('maskOf rechaza caracteres desconocidos', () => {
  assert.throws(() => maskOf('?'));
});

test('dotDistance cuenta los puntos distintos', () => {
  assert.equal(dotDistance(maskOf('e'), maskOf('e')), 0);
  assert.equal(dotDistance(maskOf('e'), maskOf('i')), 4); // 1-5 vs 2-4
  assert.equal(dotDistance(maskOf('a'), maskOf('b')), 1);
});

test('números: signo 3-4-5-6 y dígitos = a–j (1 = a, 0 = j)', () => {
  assert.deepEqual(dotsFromMask(NUMBER_SIGN), [3, 4, 5, 6]);
  [...'jabcdefghi'].forEach((letter, digit) => assert.equal(digitMask(digit), maskOf(letter), String(digit)));
  assert.equal(numberCells(3).map(unicodeOf).join(''), '⠼⠉');
  assert.equal(numberCells(10).map(unicodeOf).join(''), '⠼⠁⠚');
});
