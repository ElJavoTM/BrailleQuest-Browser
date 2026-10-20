import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS_SERIE1, wordsFor, pickWords } from '../src/words.js';
import { LEVELS, maskOf } from '../src/braille.js';

test('las palabras del Bosque solo usan a–j, sin repetirse', () => {
  const allowed = new Set(LEVELS[0].letters);
  for (const word of WORDS_SERIE1) {
    assert.ok([...word].every((l) => allowed.has(l)), word);
    assert.doesNotThrow(() => [...word].map(maskOf), word);
  }
  assert.equal(new Set(WORDS_SERIE1).size, WORDS_SERIE1.length);
});

test('wordsFor filtra por las letras conocidas', () => {
  assert.deepEqual(wordsFor(WORDS_SERIE1, [...'ab']), []);
  assert.deepEqual(wordsFor(WORDS_SERIE1, [...'abc']), ['acaba']);
  assert.deepEqual(wordsFor(WORDS_SERIE1, [...'abcd']).sort(), ['acaba', 'cada', 'dada']);
  assert.ok(wordsFor(WORDS_SERIE1, [...'abcde']).length >= 3); // con a–e ya hay jefe
  assert.equal(wordsFor(WORDS_SERIE1, LEVELS[0].letters).length, WORDS_SERIE1.length);
});

test('pickWords: distintas, como mucho las que hay y de corta a larga', () => {
  const picked = pickWords(WORDS_SERIE1, 4);
  assert.equal(new Set(picked).size, 4);
  for (let i = 1; i < picked.length; i++) assert.ok(picked[i - 1].length <= picked[i].length);
  assert.equal(pickWords(['cada', 'dada'], 4).length, 2);
});
