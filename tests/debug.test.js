import { test } from 'node:test';
import assert from 'node:assert/strict';
import { masterAll, giveAllItems, isSaveData } from '../src/debug.js';
import { createProgress, isMastered, canUnlock } from '../src/learning.js';
import { createHero, ITEMS } from '../src/loot.js';

test('masterAll desbloquea y domina todo, sin bajar lo que ya estaba más alto', () => {
  const p = createProgress();
  p.unlocked.push('a');
  p.stats.a = { seen: 9, correct: 9, box: 5 };
  masterAll(p, [...'abc']);
  assert.deepEqual(p.unlocked, [...'abc']);
  assert.ok([...'abc'].every((l) => isMastered(p, l)));
  assert.equal(p.stats.a.box, 5);
  assert.equal(canUnlock(p), true);
});

test('giveAllItems da todo el catálogo sin duplicar', () => {
  const hero = createHero();
  giveAllItems(hero);
  giveAllItems(hero);
  assert.equal(hero.owned.length, ITEMS.length);
});

test('isSaveData reconoce una partida y rechaza otra cosa', () => {
  assert.equal(isSaveData({ settings: {}, progress: createProgress() }), true);
  assert.equal(isSaveData({ progress: { unlocked: 'a' } }), false);
  assert.equal(isSaveData(null), false);
  assert.equal(isSaveData([1, 2]), false);
});
