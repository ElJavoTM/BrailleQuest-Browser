import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { load, save } from '../src/storage.js';

// Simula document.cookie y localStorage del navegador.
let jar;
let legacy;
beforeEach(() => {
  jar = new Map();
  legacy = new Map();
  globalThis.document = {
    get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; '); },
    set cookie(str) {
      const [pair, ...attrs] = str.split('; ');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      if (attrs.includes('Max-Age=0')) jar.delete(name);
      else jar.set(name, pair.slice(i + 1));
    },
  };
  globalThis.localStorage = {
    getItem: (k) => legacy.get(k) ?? null,
    removeItem: (k) => legacy.delete(k),
  };
});

test('guarda y recupera los datos', () => {
  const data = { settings: { volume: 0.5 }, progress: { unlocked: ['a', 'ñ'], stats: {} } };
  save(data);
  assert.deepEqual(load(), data);
});

test('sin datos devuelve null', () => {
  assert.equal(load(), null);
});

test('reparte datos grandes en varias cookies de menos de 4 KB', () => {
  const stats = Object.fromEntries([...'abcdefghijklmnopqrstuvwxyz'].map((l) => [l, { seen: 999, correct: 999, box: 5 }]));
  const data = { progress: { stats, reading: { stats }, confusions: { 'e>i': 3 } }, note: 'x'.repeat(5000) };
  save(data);
  assert.ok(Number(jar.get('bq_n')) > 1);
  for (const [, value] of jar) assert.ok(value.length < 4000);
  assert.deepEqual(load(), data);
});

test('borra los trozos sobrantes al guardar algo más pequeño', () => {
  save({ big: 'x'.repeat(9000) });
  const before = Number(jar.get('bq_n'));
  save({ small: true });
  assert.equal(jar.get('bq_n'), '1');
  for (let i = 1; i < before; i++) assert.equal(jar.has(`bq_${i}`), false);
  assert.deepEqual(load(), { small: true });
});

test('recupera el progreso antiguo de localStorage y lo migra a cookies', () => {
  legacy.set('braille-quest:v1', JSON.stringify({ progress: { unlocked: ['a'] } }));
  const data = load();
  assert.deepEqual(data, { progress: { unlocked: ['a'] } });
  save(data);
  assert.equal(legacy.size, 0);
  assert.deepEqual(load(), data);
});

test('un guardado incompleto no rompe el juego', () => {
  jar.set('bq_n', '3');
  jar.set('bq_0', '%7B');
  assert.equal(load(), null);
});
