// Bucle de juego de la Fase 1: sesión de 3 bloques; cada bloque es un combate.
// De vez en cuando, entre bloques, una ronda de lectura con las letras ya aprendidas.
import { LEVELS, LETTER_NAMES, maskOf, charOf, unicodeOf } from './braille.js';
import {
  canUnlock, unlockNext, pickNext, needsHint, recordAnswer, statOf, isMastered, MAX_BOX,
  createProgress, createReview, scheduleReview, takeDueReview, readablePool, pickChoices,
} from './learning.js';
import { createCell, createKeyboard, polygonPoints, dotColorsOf } from './render.js';

const BLOCKS_PER_SESSION = 3;
const HITS_PER_BLOCK = 12;
const MAX_NEW_PER_SESSION = 3;
const BREAK_SECONDS = 5;
const NEXT_TURN_MS = 750;
const RETRY_MS = 1300;
const READ_ITEMS = 6;
const MIN_READ_LETTERS = 3;

const ENEMIES = [
  { name: 'Glitch Triangular', sides: 3, color: '#FF5CA8' },
  { name: 'Prisma Errante', sides: 4, color: '#4CC9F0' },
  { name: 'Hexágono Sombrío', sides: 6, color: '#B794F6' },
];

const PRAISE = ['¡Impacto!', '¡Directo!', '¡Limpio!', '¡Bien tirado!', '¡Eso es!', '¡Crítico!'];

const $ = (id) => document.getElementById(id);

export function createGame({ data, settings, senses, fx, persist }) {
  const progress = data.progress;
  progress.reading ??= createProgress(); // estadísticas de lectura, separadas de las de escritura
  const level = LEVELS[0];
  const cell = createCell($('cell'));
  const readCell = createCell($('read-cell'));
  const keyboard = createKeyboard($('keyboard'));
  let input = null;
  let screen = 'start';
  let session = null;
  let block = null;
  let turn = null;
  let combo = 0;
  let breakReady = false;
  let read = null;

  function showScreen(name) {
    screen = name;
    document.querySelectorAll('.screen').forEach((s) => {
      s.classList.toggle('active', s.id === `screen-${name}`);
    });
    document.body.dataset.screen = name;
  }

  function message(text, tone = '') {
    const el = $('message');
    el.textContent = text;
    el.className = `message ${tone}`;
  }

  // ---------- Sesión y bloques ----------

  function startSession() {
    session = {
      block: 0, firstTry: 0, answered: 0, bestCombo: 0, newLetters: [], review: createReview(),
      readNext: true, readFirst: 0, readTotal: 0,
    };
    combo = 0;
    startBlock();
  }

  function startBlock() {
    const enemy = ENEMIES[session.block % ENEMIES.length];
    block = { enemy, hp: HITS_PER_BLOCK };
    $('enemy-shape').setAttribute('points', polygonPoints(enemy.sides, 46));
    $('enemy').style.setProperty('--enemy', enemy.color);
    $('enemy').classList.remove('defeated');
    $('enemy-name').textContent = enemy.name;
    $('hud-block').textContent = `Bloque ${session.block + 1}/${BLOCKS_PER_SESSION}`;
    renderHp();
    renderCombo();
    renderCrystals();
    showScreen('battle');
    turn = null;
    nextTurn();
  }

  function renderHp() {
    $('hp-fill').style.width = `${(block.hp / HITS_PER_BLOCK) * 100}%`;
  }

  function renderCombo() {
    const el = $('hud-combo');
    el.textContent = combo >= 2 ? `Combo ×${combo}` : '';
    el.classList.toggle('hot', combo >= 5);
  }

  function renderCrystals() {
    $('crystals').replaceChildren(...level.letters.map((letter) => {
      const el = document.createElement('div');
      const unlocked = progress.unlocked.includes(letter);
      el.className = 'crystal';
      el.textContent = letter;
      if (!unlocked) el.classList.add('locked');
      else if (isMastered(progress, letter)) el.classList.add('mastered');
      el.style.setProperty('--fill', unlocked ? statOf(progress, letter).box / MAX_BOX : 0);
      if (turn?.letter === letter) el.classList.add('current');
      return el;
    }));
  }

  // ---------- Turnos ----------

  function nextTurn() {
    // Prioridad: refuerzo de letras falladas → letra nueva → repaso normal.
    let letter = takeDueReview(session.review, turn?.letter);
    const isReview = letter !== null;
    let isNew = false;
    if (!letter && session.newLetters.length < MAX_NEW_PER_SESSION && canUnlock(progress)) {
      letter = unlockNext(progress, level.letters);
      isNew = letter !== null;
      if (isNew) session.newLetters.push(letter);
    }
    letter ??= pickNext(progress, Math.random, turn?.letter);

    turn = {
      letter, target: maskOf(letter), hinted: needsHint(progress, letter), attempted: false, isReview,
    };
    $('target').textContent = letter;
    $('target').classList.remove('pop');
    void $('target').offsetWidth;
    $('target').classList.add('pop');
    $('banner').textContent = isNew ? 'Letra nueva' : isReview ? 'Revancha' : '';
    $('banner').classList.toggle('show', isNew || isReview);

    if (isNew) {
      message(`Copia la celda que brilla: así se escribe la «${letter}».`, 'info');
      senses.speak(`Letra nueva: ${LETTER_NAMES[letter]}`);
      senses.cell(turn.target, { start: 0.2 });
    } else if (isReview) {
      message(turn.hinted ? `Otra vez la «${letter}». Sigue los puntos que brillan.` : `Otra vez la «${letter}». Esta vez es tuya.`, 'info');
    } else if (turn.hinted) {
      message('Sigue los puntos que brillan.', 'info');
    } else {
      message('Escribe la letra en braille.');
    }
    renderCrystals();
    drawCell(0);
    input.enable();
  }

  function drawCell(mask, marks) {
    const ghost = turn?.hinted ? turn.target : 0;
    cell.set(mask, marks ?? { ghost });
    keyboard.set(mask, marks ?? { ghost });
  }

  function onChange(mask, change) {
    if (screen !== 'battle' || !turn) return;
    drawCell(mask);
    if (change) senses.dot(change.dot, change.on);
  }

  function onCommit(mask) {
    if (screen !== 'battle' || !turn) return;
    if (mask === turn.target) onCorrect(mask);
    else onWrong(mask);
  }

  function onCorrect(mask) {
    input.disable();
    if (!turn.attempted) {
      recordAnswer(progress, turn.letter, { correct: true, hinted: turn.hinted });
      session.firstTry += 1;
      session.answered += 1;
    }
    turn.attempted = true;
    combo += 1;
    session.bestCombo = Math.max(session.bestCombo, combo);
    block.hp -= 1;
    persist();

    drawCell(mask);
    cell.flash('success');
    senses.success(mask, combo);
    senses.speak(LETTER_NAMES[turn.letter]);
    senses.vibrate([25, 30, 25]);
    fx.burstAt($('enemy-shape'), dotColorsOf(mask), 18 + Math.min(combo, 10) * 3);
    hitEnemy();
    const praise = turn.isReview ? '¡Revancha ganada!' : PRAISE[combo % PRAISE.length];
    message(combo >= 3 ? `${praise} Combo ×${combo}` : praise, 'good');
    renderHp();
    renderCombo();
    renderCrystals();

    setTimeout(() => (block.hp <= 0 ? defeatEnemy() : nextTurn()), NEXT_TURN_MS);
  }

  function onWrong(mask) {
    input.disable();
    const answeredAs = charOf(mask);
    if (!turn.attempted) {
      recordAnswer(progress, turn.letter, { correct: false, hinted: turn.hinted, answeredAs });
      scheduleReview(session.review, turn.letter);
      session.answered += 1;
      persist();
    }
    turn.attempted = true;
    // El combo se reduce a la mitad en vez de perderse entero.
    combo = Math.floor(combo / 2);
    renderCombo();

    drawCell(mask, { ghost: turn.target & ~mask, wrong: mask & ~turn.target });
    cell.flash('shake');
    senses.error();
    senses.vibrate(80);
    message(answeredAs
      ? `Eso es la «${answeredAs}». Fíjate en los puntos que brillan.`
      : 'Casi. Fíjate en los puntos que brillan.', 'bad');

    setTimeout(() => {
      turn.hinted = true;
      drawCell(0);
      input.enable();
    }, RETRY_MS);
  }

  function hitEnemy() {
    const enemy = $('enemy');
    enemy.classList.remove('hit');
    void enemy.offsetWidth;
    enemy.classList.add('hit');
  }

  function defeatEnemy() {
    $('enemy').classList.add('defeated');
    fx.burstAt($('enemy-shape'), [block.enemy.color, '#ffffff'], 80);
    senses.victory();
    message(`${block.enemy.name} derrotado.`, 'good');
    setTimeout(() => {
      session.block += 1;
      if (session.block >= BLOCKS_PER_SESSION) endSession();
      else showBreak();
    }, 1200);
  }

  // ---------- Pausa y final ----------

  function statsHtml() {
    const pct = session.answered ? Math.round((session.firstTry / session.answered) * 100) : 0;
    const learned = level.letters.filter((l) => progress.unlocked.includes(l) && isMastered(progress, l));
    const reading = session.readTotal
      ? `<div><b>${session.readFirst}/${session.readTotal}</b><span>leídas a la primera</span></div>`
      : '';
    return `
      <div><b>${pct}%</b><span>a la primera</span></div>${reading}
      <div><b>×${session.bestCombo}</b><span>mejor combo</span></div>
      <div><b>${session.newLetters.join(' ') || '—'}</b><span>letras nuevas</span></div>
      <div><b>${learned.length}/${level.letters.length}</b><span>dominadas</span></div>`;
  }

  function showBreak() {
    breakReady = false;
    $('break-title').textContent = `Bloque ${session.block}/${BLOCKS_PER_SESSION} completado`;
    $('break-stats').innerHTML = statsHtml();
    $('break-continue').innerHTML = shouldRead()
      ? '<kbd>Enter</kbd> ronda de lectura · <kbd>Esc</kbd> terminar por hoy'
      : '<kbd>Enter</kbd> siguiente bloque · <kbd>Esc</kbd> terminar por hoy';
    $('break-continue').hidden = true;
    $('break-msg').hidden = false;
    showScreen('break');
    setTimeout(() => {
      breakReady = true;
      $('break-msg').hidden = true;
      $('break-continue').hidden = false;
    }, BREAK_SECONDS * 1000);
  }

  // ---------- Ronda de lectura ----------

  // Una de cada dos pausas, si ya hay suficientes letras que leer.
  function shouldRead() {
    return session.readNext && readablePool(progress).length >= MIN_READ_LETTERS;
  }

  function continueAfterBreak() {
    if (shouldRead()) {
      session.readNext = false;
      startReading();
    } else {
      session.readNext = true;
      startBlock();
    }
  }

  function startReading() {
    progress.reading.unlocked = readablePool(progress);
    read = { done: 0, letter: null, attempted: false, locked: false, review: createReview() };
    $('hud-block').textContent = 'Ronda de lectura';
    $('hud-combo').textContent = '';
    showScreen('reading');
    senses.speak('Ronda de lectura');
    nextRead();
  }

  function readMessage(text, tone = '') {
    const el = $('read-message');
    el.textContent = text;
    el.className = `message ${tone}`;
  }

  function renderChoices(choices) {
    $('read-choices').replaceChildren(...choices.map((letter) => {
      const el = document.createElement('div');
      el.className = 'choice';
      el.textContent = letter;
      return el;
    }));
  }

  function renderReadProgress() {
    $('read-progress').replaceChildren(...Array.from({ length: READ_ITEMS }, (_, i) => {
      const el = document.createElement('i');
      if (i < read.done) el.className = 'done';
      else if (i === read.done) el.className = 'current';
      return el;
    }));
  }

  function nextRead() {
    if (!read) return; // ronda saltada con Esc
    if (read.done >= READ_ITEMS) return endReading();
    const reading = progress.reading;
    const letter = takeDueReview(read.review, read.letter) ?? pickNext(reading, Math.random, read.letter);
    Object.assign(read, { letter, attempted: false, locked: false });
    const mask = maskOf(letter);
    readCell.set(mask);
    readCell.flash('pop');
    senses.cell(mask);
    // Pista: tres opciones mientras esa letra no se haya leído bien nunca.
    const hinted = statOf(reading, letter).box === 0;
    renderChoices(hinted ? pickChoices(letter, reading.unlocked, progress.confusions) : []);
    readMessage(hinted ? '¿Cuál de estas es? Pulsa su tecla.' : '¿Qué letra es? Pulsa su tecla.', 'info');
    renderReadProgress();
  }

  function onReadKey(key) {
    if (read.locked) return;
    const mask = maskOf(read.letter);
    if (key === read.letter) {
      read.locked = true;
      if (!read.attempted) {
        recordAnswer(progress.reading, read.letter, { correct: true, hinted: false });
        session.readFirst += 1;
        session.readTotal += 1;
      }
      read.done += 1;
      persist();
      readCell.flash('success');
      senses.success(mask, read.done);
      senses.speak(LETTER_NAMES[read.letter]);
      senses.vibrate([25, 30, 25]);
      fx.burstAt(readCell.el, dotColorsOf(mask), 24);
      readMessage(read.attempted ? `¡Eso es, la «${read.letter}»!` : `¡Leída! Es la «${read.letter}».`, 'good');
      renderReadProgress();
      setTimeout(nextRead, NEXT_TURN_MS);
      return;
    }
    if (!read.attempted) {
      recordAnswer(progress.reading, read.letter, { correct: false, hinted: false, answeredAs: key });
      scheduleReview(read.review, read.letter);
      session.readTotal += 1;
      persist();
    }
    read.attempted = true;
    readCell.flash('shake');
    senses.error();
    senses.vibrate(80);
    // Tras un fallo siempre se ofrecen las tres opciones.
    if (!$('read-choices').children.length) {
      renderChoices(pickChoices(read.letter, progress.reading.unlocked, progress.confusions));
    }
    readMessage(`La «${key}» se ve así: ${unicodeOf(maskOf(key))} — prueba con otra.`, 'bad');
  }

  function endReading() {
    readMessage('Lectura completada. ¡Al siguiente combate!', 'good');
    senses.victory();
    read = null;
    setTimeout(startBlock, 1300);
  }

  function endSession() {
    $('end-stats').innerHTML = statsHtml();
    showScreen('end');
    senses.speak('Sesión completa');
  }

  // ---------- Navegación entre pantallas ----------

  window.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (screen === 'start') {
      e.preventDefault();
      begin();
    } else if (screen === 'break' && breakReady) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        continueAfterBreak();
      } else if (e.code === 'Escape') {
        endSession();
      }
    } else if (screen === 'reading' && read) {
      if (e.code === 'Escape') {
        read = null;
        startBlock();
        return;
      }
      const key = e.key.toLowerCase();
      if (key in LETTER_NAMES && key.length === 1) {
        e.preventDefault();
        if (!e.repeat) onReadKey(key);
      }
    } else if (screen === 'end' && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
      e.preventDefault();
      startSession();
    }
  });
  $('screen-start').addEventListener('click', () => begin());

  function begin() {
    if (screen !== 'start') return;
    senses.unlock();
    startSession();
  }

  return {
    attachInput(i) { input = i; },
    onChange,
    onCommit,
    setLayout(layout) { keyboard.setLayout(layout); },
    showScreen,
  };
}
