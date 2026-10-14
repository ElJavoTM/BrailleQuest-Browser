import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEMS, SLOTS, createHero, heroLevel, slotUnlocked, rarityWeights, openChest, equip, loadout, itemOf,
} from '../src/loot.js';
import { createProgress, unlockNext, statOf, MASTERED_BOX } from '../src/learning.js';

test('catálogo: ids únicos, huecos y rarezas válidos, un objeto inicial por hueco', () => {
  assert.equal(new Set(ITEMS.map((item) => item.id)).size, ITEMS.length);
  for (const item of ITEMS) {
    assert.ok(item.slot in SLOTS, item.id);
    assert.ok(['comun', 'rara', 'epica'].includes(item.rarity), item.id);
  }
  for (const slot of Object.keys(SLOTS)) {
    assert.equal(ITEMS.filter((item) => item.slot === slot && item.start).length, 1, slot);
  }
});

test('el héroe empieza con lo inicial equipado', () => {
  const hero = createHero();
  assert.deepEqual(hero.equipped, { foco: 'orbe', sello: 'onda', aura: 'sin-aura' });
  assert.equal(hero.chests, 0);
});

test('nivel = 1 + caracteres dominados en todos los progresos', () => {
  const letters = createProgress();
  const numbers = createProgress();
  assert.equal(heroLevel([letters, numbers]), 1);
  unlockNext(letters, ['a', 'b']);
  unlockNext(letters, ['a', 'b']);
  unlockNext(numbers, ['1']);
  statOf(letters, 'a').box = MASTERED_BOX;
  statOf(letters, 'b').box = MASTERED_BOX - 1;
  statOf(numbers, '1').box = MASTERED_BOX;
  assert.equal(heroLevel([letters, numbers]), 3);
});

test('los huecos se abren por nivel', () => {
  assert.equal(slotUnlocked('foco', 1), true);
  assert.equal(slotUnlocked('sello', SLOTS.sello.level - 1), false);
  assert.equal(slotUnlocked('sello', SLOTS.sello.level), true);
});

test('jugar mejor sube las rarezas altas sin quitar ninguna', () => {
  const bad = rarityWeights(0);
  const good = rarityWeights(1);
  assert.ok(good.epica > bad.epica && good.rara > bad.rara && good.comun < bad.comun);
  assert.ok(good.comun > 0);
});

test('los cofres nunca repiten y acaban dándolo todo', () => {
  const hero = createHero();
  const pending = ITEMS.filter((item) => !item.start).length;
  const seen = new Set();
  for (let i = 0; i < pending; i++) {
    const item = openChest(hero, Math.random(), Math.random);
    assert.ok(item, `cofre ${i} vacío`);
    assert.ok(!seen.has(item.id), `repetido: ${item.id}`);
    seen.add(item.id);
  }
  assert.equal(openChest(hero, 1), null);
  assert.equal(hero.chests, pending);
});

test('si no quedan de una rareza, sale de otra', () => {
  const hero = createHero();
  hero.owned.push(...ITEMS.filter((item) => item.rarity === 'comun').map((item) => item.id));
  for (let i = 0; i < 5; i++) assert.notEqual(openChest(hero, 0, () => 0).rarity, 'comun');
});

test('equipar: solo lo que se tiene y en huecos abiertos', () => {
  const hero = createHero();
  assert.equal(equip(hero, 'rayo', 10), false); // no se tiene
  hero.owned.push('rayo', 'nova');
  assert.equal(equip(hero, 'rayo', 1), true);
  assert.equal(equip(hero, 'nova', SLOTS.sello.level - 1), false); // hueco cerrado
  assert.equal(hero.equipped.foco, 'rayo');
  assert.equal(itemOf('nope'), null);
});

test('loadout usa lo inicial en los huecos cerrados', () => {
  const hero = createHero();
  hero.owned.push('nova');
  hero.equipped.sello = 'nova';
  assert.equal(loadout(hero, 1).sello, 'onda');
  assert.equal(loadout(hero, SLOTS.sello.level).sello, 'nova');
});
