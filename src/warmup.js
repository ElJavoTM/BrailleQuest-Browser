// Calentamiento: sin puntuación ni progreso. Dibujas cualquier celda y el juego te dice qué letra es.
import { LETTER_NAMES, maskOf, charOf, groupOf, theChar } from './braille.js';
import { createCell, createKeyboard, dotColorsOf } from './render.js';

const $ = (id) => document.getElementById(id);

export function createWarmup({ senses, fx, resetInput }) {
  const cell = createCell($('warm-cell'));
  const keyboard = createKeyboard($('warm-keyboard'));
  const tried = new Set();
  let group = null;
  let tiles = new Map();

  function message(text, tone = '') {
    const el = $('warm-message');
    el.textContent = text;
    el.className = `message ${tone}`;
  }

  function renderCount() {
    const count = group.letters.filter((letter) => tried.has(letter)).length;
    $('warm-count').textContent = `${count}/${group.letters.length} probadas`;
  }

  function markMatch(letter) {
    for (const [l, tile] of tiles) tile.classList.toggle('match', l === letter);
  }

  function createTile(letter) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    const holder = document.createElement('div');
    const label = document.createElement('b');
    label.textContent = letter;
    tile.append(holder, label);
    const mini = createCell(holder);
    mini.el.classList.add('mini');
    mini.set(maskOf(letter));
    tile.addEventListener('click', () => {
      tile.blur();
      resetInput();
      show(letter);
    });
    return tile;
  }

  function start(newGroup) {
    group = newGroup;
    tried.clear();
    $('warm-title').textContent = group.name;
    tiles = new Map(group.letters.map((letter) => [letter, createTile(letter)]));
    $('warm-chart').replaceChildren(...tiles.values());
    cell.set(0);
    keyboard.set(0);
    $('warm-live').textContent = '';
    renderCount();
    message('Dibuja cualquier celda con el teclado y te digo qué letra es. También puedes pulsar una letra de la tabla.', 'info');
  }

  // Muestra una letra elegida en la tabla, con sus teclas encendidas.
  function show(letter) {
    const mask = maskOf(letter);
    cell.set(mask);
    keyboard.set(mask);
    $('warm-live').textContent = letter;
    reveal(letter, mask);
  }

  function reveal(letter, mask) {
    tried.add(letter);
    tiles.get(letter)?.classList.add('found');
    markMatch(letter);
    const other = group.letters.includes(letter) ? null : groupOf(letter);
    const where = other ? ` (está en ${other.name})` : '';
    message(`Es ${theChar(letter)}${where}.`, 'good');
    cell.flash('success');
    senses.cell(mask);
    senses.speak(LETTER_NAMES[letter]);
    fx.burstAt(cell.el, dotColorsOf(mask), 20);
    renderCount();
  }

  return {
    start,
    setLayout(layout) { keyboard.setLayout(layout); },

    // Identifica la letra en directo mientras se dibuja.
    onChange(mask, change) {
      cell.set(mask);
      keyboard.set(mask);
      if (change) senses.dot(change.dot, change.on);
      const letter = charOf(mask);
      $('warm-live').textContent = mask ? (letter ?? '?') : '';
      markMatch(letter);
    },

    onCommit(mask) {
      const letter = charOf(mask);
      if (letter) {
        reveal(letter, mask);
      } else {
        senses.cell(mask);
        message('Esa combinación no es ninguna letra. Prueba a quitar o añadir un punto.', 'bad');
      }
    },
  };
}
