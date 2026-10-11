// Escenas del juego: menú, aventura (3 combates con ronda de lectura entre medias),
// práctica de lectura y calentamiento.
import {
  LEVELS, LETTER_NAMES, GROUPS, ALL_LETTERS, maskOf, charOf, unicodeOf,
} from './braille.js';
import {
  canUnlock, unlockNext, pickNext, needsHint, recordAnswer, statOf, isMastered, MAX_BOX,
  createProgress, createReview, scheduleReview, takeDueReview, readablePool, pickChoices,
} from './learning.js';
import { createCell, createKeyboard, polygonPoints, dotColorsOf } from './render.js';
import { createWarmup } from './warmup.js';

const BLOCKS_PER_SESSION = 3;
const HITS_PER_BLOCK = 12;
const MAX_NEW_PER_SESSION = 3;
const BREAK_SECONDS = 5;
const NEXT_TURN_MS = 750;
const RETRY_MS = 1300;
const READ_ITEMS_ADVENTURE = 6;
const READ_ITEMS_PRACTICE = 10;
const MIN_READ_LETTERS = 3;

const ENEMIES = [
  { name: 'Glitch Triangular', sides: 3, color: '#FF5CA8' },
  { name: 'Prisma Errante', sides: 4, color: '#4CC9F0' },
  { name: 'Hexágono Sombrío', sides: 6, color: '#B794F6' },
];

const PRAISE = ['¡Impacto!', '¡Directo!', '¡Limpio!', '¡Bien tirado!', '¡Eso es!', '¡Crítico!'];

const $ = (id) => document.getElementById(id);
const isEnter = (e) => e.code === 'Enter' || e.code === 'NumpadEnter';

// Lista de opciones navegable con flechas, números, Enter o ratón.
function createChoiceList(container, onPick) {
  let items = [];
  let selected = 0;

  function pick() {
    const item = items[selected];
    if (item && !item.disabled) onPick(item);
  }

  function render() {
    container.replaceChildren(...items.map((item, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'option';
      el.classList.toggle('selected', i === selected);
      el.classList.toggle('disabled', Boolean(item.disabled));
      el.innerHTML = `<kbd>${i + 1}</kbd><span><b>${item.name}</b><small>${item.disabled ? item.lockedText : item.desc}</small></span>`;
      el.addEventListener('click', () => {
        el.blur();
        selected = i;
        render();
        pick();
      });
      return el;
    }));
  }

  return {
    set(newItems) {
      items = newItems;
      selected = Math.max(items.findIndex((item) => !item.disabled), 0);
      render();
    },
    handleKey(e) {
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        e.preventDefault();
        const step = e.code === 'ArrowDown' ? 1 : -1;
        selected = (selected + step + items.length) % items.length;
        render();
      } else if (isEnter(e)) {
        e.preventDefault();
        pick();
      } else if (Number(e.key) >= 1 && Number(e.key) <= items.length) {
        e.preventDefault();
        selected = Number(e.key) - 1;
        render();
        pick();
      }
    },
  };
}

export function createGame({ data, settings, senses, fx, persist }) {
  const progress = data.progress;
  progress.reading ??= createProgress(); // estadísticas de lectura, separadas de las de escritura
  const level = LEVELS[0];
  const cell = createCell($('cell'));
  const keyboard = createKeyboard($('keyboard'));
  const readCell = createCell($('read-cell'));
  const warmup = createWarmup({ senses, fx, resetInput: () => input.reset() });
  let input = null;
  let screen = 'menu';
  let session = null;
  let block = null;
  let turn = null;
  let combo = 0;
  let breakReady = false;
  let read = null;

  // Los temporizadores pendientes se anulan al salir de un modo (token distinto).
  let token = 0;
  const later = (fn, ms) => {
    const current = token;
    setTimeout(() => { if (current === token) fn(); }, ms);
  };

  function showScreen(name) {
    screen = name;
    document.querySelectorAll('.screen').forEach((s) => {
      s.classList.toggle('active', s.id === `screen-${name}`);
    });
    document.body.dataset.screen = name;
  }

  function setHud(text) {
    $('hud-block').textContent = text;
    $('hud-combo').textContent = '';
  }

  // ---------- Menú ----------

  const modeList = createChoiceList($('menu-options'), (mode) => {
    senses.unlock(); // el audio necesita una interacción del usuario
    mode.start();
  });
  const groupList = createChoiceList($('group-options'), (group) => startWarmup(group));

  function showMenu() {
    token += 1;
    input?.disable();
    session = null;
    read = null;
    modeList.set([
      {
        name: 'Aventura',
        desc: 'Escribe braille para lanzar hechizos. 3 combates, unos 10 min.',
        start: startSession,
      },
      {
        name: 'Calentamiento',
        desc: 'Elige un grupo de letras, dibuja celdas y te digo qué letra es. Sin puntuación.',
        start: showGroups,
      },
      {
        name: 'Práctica de lectura',
        desc: `Lee ${READ_ITEMS_PRACTICE} celdas de las letras que ya sabes escribir.`,
        start: () => startReading('practice'),
        disabled: readablePool(progress).length < MIN_READ_LETTERS,
        lockedText: `Se desbloquea al escribir bien ${MIN_READ_LETTERS} letras en la Aventura.`,
      },
    ]);
    showScreen('menu');
  }

  // ---------- Calentamiento ----------

  function showGroups() {
    input.disable();
    const mine = progress.unlocked;
    groupList.set([
      ...(mine.length ? [{ name: 'Mis letras', desc: mine.join(' '), letters: [...mine] }] : []),
      ...GROUPS,
      { name: 'Todas', desc: `las ${ALL_LETTERS.length} letras`, letters: ALL_LETTERS },
    ]);
    showScreen('groups');
  }

  function startWarmup(group) {
    token += 1;
    warmup.start(group);
    setHud('Calentamiento');
    showScreen('warmup');
    input.enable();
  }

  // ---------- Aventura: sesión y bloques ----------

  function startSession() {
    token += 1;
    session = {
      block: 0, firstTry: 0, answered: 0, bestCombo: 0, newLetters: [], review: createReview(),
      readNext: true, readFirst: 0, readTotal: 0,
    };
    combo = 0;
    startBlock();
  }

  function message(text, tone = '') {
    const el = $('message');
    el.textContent = text;
    el.className = `message ${tone}`;
  }

  function startBlock() {
    const enemy = ENEMIES[session.block % ENEMIES.length];
    block = { enemy, hp: HITS_PER_BLOCK };
    $('enemy-shape').setAttribute('points', polygonPoints(enemy.sides, 46));
    $('enemy').style.setProperty('--enemy', enemy.color);
    $('enemy').classList.remove('defeated');
    $('enemy-name').textContent = enemy.name;
    setHud(`Bloque ${session.block + 1}/${BLOCKS_PER_SESSION}`);
    renderHp();
    renderCombo();
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

  // ---------- Aventura: turnos ----------

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
    if (screen === 'warmup') return warmup.onChange(mask, change);
    if (screen !== 'battle' || !turn) return;
    drawCell(mask);
    if (change) senses.dot(change.dot, change.on);
  }

  function onCommit(mask) {
    if (screen === 'warmup') return warmup.onCommit(mask);
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

    later(() => (block.hp <= 0 ? defeatEnemy() : nextTurn()), NEXT_TURN_MS);
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

    later(() => {
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
    later(() => {
      session.block += 1;
      if (session.block >= BLOCKS_PER_SESSION) endSession();
      else showBreak();
    }, 1200);
  }

  // ---------- Lectura (ronda de la aventura o práctica desde el menú) ----------

  // En la aventura, una de cada dos pausas, si ya hay suficientes letras que leer.
  function shouldRead() {
    return session.readNext && readablePool(progress).length >= MIN_READ_LETTERS;
  }

  function continueAfterBreak() {
    if (shouldRead()) {
      session.readNext = false;
      startReading('adventure');
    } else {
      session.readNext = true;
      startBlock();
    }
  }

  function startReading(mode) {
    if (mode === 'practice') token += 1;
    progress.reading.unlocked = readablePool(progress);
    read = {
      mode,
      items: mode === 'practice' ? READ_ITEMS_PRACTICE : READ_ITEMS_ADVENTURE,
      done: 0, firstTry: 0, letter: null, attempted: false, locked: false, review: createReview(),
    };
    const title = mode === 'practice' ? 'Práctica de lectura' : 'Ronda de lectura';
    setHud(title);
    $('read-banner').textContent = title;
    $('read-escape').textContent = mode === 'practice' ? 'volver al menú' : 'saltar la lectura';
    showScreen('reading');
    senses.speak(title);
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
    $('read-progress').replaceChildren(...Array.from({ length: read.items }, (_, i) => {
      const el = document.createElement('i');
      if (i < read.done) el.className = 'done';
      else if (i === read.done) el.className = 'current';
      return el;
    }));
  }

  function nextRead() {
    if (!read) return; // ronda saltada con Esc
    if (read.done >= read.items) return endReading();
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
        read.firstTry += 1;
        if (session) {
          session.readFirst += 1;
          session.readTotal += 1;
        }
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
      later(nextRead, NEXT_TURN_MS);
      return;
    }
    if (!read.attempted) {
      recordAnswer(progress.reading, read.letter, { correct: false, hinted: false, answeredAs: key });
      scheduleReview(read.review, read.letter);
      if (session) session.readTotal += 1;
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
    const { mode, firstTry, items } = read;
    read = null;
    senses.victory();
    if (mode === 'adventure') {
      readMessage('Lectura completada. ¡Al siguiente combate!', 'good');
      later(startBlock, 1300);
    } else {
      readMessage(`Práctica completada: ${firstTry}/${items} a la primera.`, 'good');
      later(showMenu, 2500);
    }
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
    later(() => {
      breakReady = true;
      $('break-msg').hidden = true;
      $('break-continue').hidden = false;
    }, BREAK_SECONDS * 1000);
  }

  function endSession() {
    $('end-stats').innerHTML = statsHtml();
    showScreen('end');
    senses.speak('Sesión completa');
  }

  // ---------- Teclas de navegación ----------

  window.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const esc = e.code === 'Escape';
    switch (screen) {
      case 'menu':
        modeList.handleKey(e);
        break;
      case 'groups':
        if (esc) showMenu();
        else groupList.handleKey(e);
        break;
      case 'warmup':
        if (esc) showGroups();
        break;
      case 'battle':
        if (esc) showMenu();
        break;
      case 'reading':
        if (!read) break;
        if (esc) {
          if (read.mode === 'practice') {
            showMenu();
          } else {
            read = null;
            startBlock();
          }
          break;
        }
        if (e.key.length === 1 && e.key.toLowerCase() in LETTER_NAMES) {
          e.preventDefault();
          if (!e.repeat) onReadKey(e.key.toLowerCase());
        }
        break;
      case 'break':
        if (!breakReady) break;
        if (isEnter(e)) {
          e.preventDefault();
          continueAfterBreak();
        } else if (esc) {
          endSession();
        }
        break;
      case 'end':
        if (isEnter(e)) {
          e.preventDefault();
          startSession();
        } else if (esc) {
          showMenu();
        }
        break;
    }
  });

  $('btn-menu').addEventListener('click', (e) => {
    e.currentTarget.blur();
    showMenu();
  });

  return {
    attachInput(i) { input = i; },
    onChange,
    onCommit,
    setLayout(layout) {
      keyboard.setLayout(layout);
      warmup.setLayout(layout);
    },
    showMenu,
  };
}
