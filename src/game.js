// Escenas del juego: menú, aventura (3 combates con ronda de lectura entre medias),
// práctica de lectura y calentamiento.
import {
  LEVELS, LETTER_NAMES, GROUPS, ALL_LETTERS, maskOf, charOf, unicodeOf, numberCells, digitMask,
} from './braille.js';
import {
  canUnlock, unlockNext, pickNext, needsHint, recordAnswer, statOf, isMastered, MAX_BOX,
  createProgress, createReview, scheduleReview, takeDueReview, readablePool, pickChoices,
} from './learning.js';
import { createCell, createKeyboard, polygonPoints, dotColorsOf } from './render.js';
import { createWarmup } from './warmup.js';
import {
  SLOTS, RARITIES, ITEMS, itemOf, createHero, heroLevel, slotUnlocked, openChest, equip, loadout,
} from './loot.js';

const BLOCKS_PER_SESSION = 3;
const HITS_PER_BLOCK = 12;
const NEXT_TURN_MS = 750;
// Golpe: congelado con flashes y luego retroceso con retraso. Deben cuadrar con los % de
// @keyframes impact / impact-crit en main.css (110 ms de 640, 150 ms de 820).
const FREEZE_MS = { normal: 110, crit: 150 };
const IMPACT_MS = { normal: 640, crit: 820 };
const RETRY_MS = 1300;
const READ_ITEMS_ADVENTURE = 6;
// Ronda en orden (números): cada ORDER_EVERY turnos, del 1 al último aprendido, si hay ≥ MIN_ORDER.
const ORDER_EVERY = 8;
const MIN_ORDER = 3;
const READ_ITEMS_PRACTICE = 10;
const MIN_READ_LETTERS = 3;
const NUMBERS = Array.from({ length: 10 }, (_, i) => String(i + 1));

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
      if (item.tone) el.classList.add(...item.tone.split(' '));
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
    // `keep`: conserva la opción seleccionada (para volver a pintar la misma lista).
    set(newItems, { keep = false } = {}) {
      items = newItems;
      selected = keep ? Math.min(selected, items.length - 1)
        : Math.max(items.findIndex((item) => !item.disabled), 0);
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
  progress.numbers ??= createProgress(); // lectura de números del 1 al 10
  progress.numWrite ??= createProgress(); // escritura de números en la aventura
  progress.hero ??= createHero(); // equipo y cofres
  const hero = progress.hero;
  const heroLvl = () => heroLevel([progress, progress.numWrite]);
  const level = LEVELS[0];
  const cell = createCell($('cell'));
  const keyboard = createKeyboard($('keyboard'));
  let readCells = [];
  const warmup = createWarmup({ senses, fx, resetInput: () => input.reset() });
  let input = null;
  let screen = 'menu';
  let session = null;
  let block = null;
  let turn = null;
  let combo = 0;
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
    $('screen-battle').classList.remove('practice');
    input?.disable();
    session = null;
    read = null;
    modeList.set([
      {
        name: 'Aventura',
        desc: 'Escribe braille para lanzar hechizos. Letras o números · 3 combates, unos 10 min.',
        start: showSubjects,
      },
      {
        name: 'Equipo',
        desc: `Nivel ${heroLvl()} · ${hero.owned.length}/${ITEMS.length} objetos. Elige foco, sello y aura.`,
        start: showGear,
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
      {
        name: 'Números',
        desc: `Lee ${READ_ITEMS_PRACTICE} números del 1 al 10: signo de número (⠼) + las letras a–j.`,
        start: () => startReading('practice', 'numbers'),
      },
      {
        name: 'Contar del 1 al 10',
        desc: 'Escribe los números del 1 al 10 en orden, en bucle. Sin puntuación ni enemigos.',
        start: startCounting,
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

  // Qué se aprende en la aventura. Cada elemento se escribe con una o varias celdas
  // (un número = signo de número + sus dígitos) y tiene su propio progreso.
  const SUBJECTS = {
    letters: {
      name: 'Letras', desc: `${level.name}: aprende a escribir de la a a la j.`,
      progress: () => progress, order: level.letters, readKind: 'letters',
      cellsOf: (item) => [maskOf(item)], spoken: (item) => LETTER_NAMES[item],
      newBanner: 'Letra nueva', newLabel: 'letras nuevas', the: (item) => `la «${item}»`, yours: 'tuya',
    },
    numbers: {
      name: 'Números', desc: 'Del 1 al 10: signo de número (⠼) + los dígitos, que son las letras a–j.',
      progress: () => progress.numWrite, order: NUMBERS, readKind: 'numbers',
      given: 1, // el signo de número ya viene puesto: solo se escriben los dígitos
      ordered: true, // de vez en cuando, ronda en orden
      cellsOf: (item) => numberCells(Number(item)), spoken: (item) => item,
      newBanner: 'Número nuevo', newLabel: 'números nuevos', the: (item) => `el ${item}`, yours: 'tuyo',
    },
  };
  const subjectList = createChoiceList($('subject-options'), (subject) => startSession(subject));
  const sp = () => session.subject.progress();

  function showSubjects() {
    input.disable();
    subjectList.set(Object.values(SUBJECTS));
    showScreen('subjects');
  }

  function startSession(subject = session?.subject ?? SUBJECTS.letters) {
    token += 1;
    session = {
      subject, block: 0, firstTry: 0, answered: 0, bestCombo: 0, newLetters: [], review: createReview(),
      readNext: true, readFirst: 0, readTotal: 0, orderIn: ORDER_EVERY, orderQueue: [],
      levelSeen: heroLvl(), drop: null,
    };
    combo = 0;
    startBlock();
  }

  // Práctica de contar: 1 → 10 en bucle en la pantalla de combate, sin enemigo y sin tocar el progreso.
  function startCounting() {
    token += 1;
    session = {
      subject: SUBJECTS.numbers, practice: true, lap: 1, block: 0, firstTry: 0, answered: 0, bestCombo: 0,
      newLetters: [], review: createReview(), orderIn: Infinity, orderQueue: [],
    };
    block = null;
    combo = 0;
    $('screen-battle').classList.add('practice');
    applyAura();
    showScreen('battle');
    turn = null;
    nextTurn();
  }

  function message(text, tone = '') {
    const el = $('message');
    el.textContent = text;
    el.className = `message ${tone}`;
  }

  function startBlock() {
    const enemy = ENEMIES[session.block % ENEMIES.length];
    block = { enemy, hp: HITS_PER_BLOCK, firstTry: 0, answered: 0 };
    applyAura();
    $('enemy-shape').setAttribute('points', polygonPoints(enemy.sides, 46));
    $('enemy').style.setProperty('--enemy', enemy.color);
    $('enemy').classList.remove('defeated');
    $('enemy-name').textContent = enemy.name;
    setHud(`${session.subject.name} · Bloque ${session.block + 1}/${BLOCKS_PER_SESSION}`);
    renderHp();
    renderCombo();
    showScreen('battle');
    turn = null;
    nextTurn();
  }

  function renderHp() {
    $('hp-fill').style.transform = `scaleX(${block.hp / HITS_PER_BLOCK})`;
  }

  function renderCombo() {
    const el = $('hud-combo');
    el.textContent = combo >= 2 ? `Combo ×${combo}` : '';
    el.classList.toggle('hot', combo >= 5);
  }

  function renderCrystals() {
    const stats = sp();
    $('crystals').replaceChildren(...session.subject.order.map((item) => {
      const el = document.createElement('div');
      const unlocked = stats.unlocked.includes(item);
      el.className = 'crystal';
      el.textContent = item;
      if (!unlocked) el.classList.add('locked');
      else if (isMastered(stats, item)) el.classList.add('mastered');
      el.style.setProperty('--fill', unlocked ? statOf(stats, item).box / MAX_BOX : 0);
      if (turn?.item === item) el.classList.add('current');
      return el;
    }));
  }

  // Celdas del turno: las ya escritas, la actual y las que faltan (solo si hay más de una).
  function renderSequence() {
    const el = $('sequence');
    if (turn.cells.length < 2) return el.replaceChildren();
    el.replaceChildren(...turn.cells.map((mask, i) => {
      const slot = document.createElement('i');
      slot.textContent = i < turn.pos ? unicodeOf(mask) : '';
      slot.className = i < turn.pos ? 'done' : i === turn.pos ? 'current' : '';
      return slot;
    }));
  }

  // ---------- Aventura: turnos ----------

  const targetOf = (t) => t.cells[t.pos];

  // Qué va en la celda actual, dicho en palabras (para los números).
  function describeCell(t) {
    if (t.cells.length < 2) return '';
    if (t.pos === 0) return 'el signo de número (puntos 3-4-5-6)';
    const digit = t.item[t.pos - 1];
    return `el ${digit} (como la «${charOf(t.cells[t.pos])}»)`;
  }

  function nextTurn() {
    const { subject } = session;
    const stats = sp();
    if (session.practice) {
      if (turn?.item === '10') session.lap += 1;
      setHud(`Contar del 1 al 10 · vuelta ${session.lap}`);
    } else {
      maybeStartOrder();
    }
    const order = session.orderQueue.length;
    // Prioridad: ronda en orden → refuerzo de lo fallado → elemento nuevo → repaso normal.
    let item = session.practice ? NUMBERS[(NUMBERS.indexOf(turn?.item) + 1) % NUMBERS.length]
      : order ? session.orderQueue.shift() : takeDueReview(session.review, turn?.item);
    const isReview = !session.practice && !order && item !== null;
    let isNew = false;
    if (!item && canUnlock(stats)) {
      item = unlockNext(stats, subject.order);
      isNew = item !== null;
      if (isNew) session.newLetters.push(item);
    }
    item ??= pickNext(stats, Math.random, turn?.item);

    turn = {
      item, cells: subject.cellsOf(item), pos: subject.given ?? 0, hinted: needsHint(stats, item), attempted: false, isReview,
      inOrder: order > 0, orderLast: order === 1,
    };
    $('target').textContent = item;
    $('target').classList.remove('pop');
    void $('target').offsetWidth;
    $('target').classList.add('pop');
    $('banner').textContent = turn.inOrder ? 'En orden' : isNew ? subject.newBanner : isReview ? 'Revancha' : '';
    $('banner').classList.toggle('show', turn.inOrder || isNew || isReview);

    const multi = turn.cells.length > 1;
    const what = subject.the(item);
    if (session.practice) {
      message(item === '1' && session.lap > 1 ? `¡Vuelta ${session.lap - 1} completa! Otra vez desde el 1.`
        : turn.hinted ? `Escribe el ${item}. Sigue los puntos que brillan.` : `Escribe el ${item}.`, item === '1' ? 'good' : 'info');
    } else if (turn.inOrder) {
      const last = stats.unlocked.length;
      message(item === '1' ? `¡Ronda en orden! Del 1 al ${last}, sin saltarte ninguno.` : `En orden: ${item} de ${last}.`, 'info');
      if (item === '1') senses.speak(`En orden, del 1 al ${last}`);
    } else if (isNew) {
      message(multi
        ? `El signo de número ya está puesto. Copia ${item.length > 1 ? 'los dígitos que brillan' : 'el dígito que brilla'}.`
        : `Copia la celda que brilla: así se escribe ${what}.`, 'info');
      senses.speak(`${subject.newBanner}: ${subject.spoken(item)}`);
      turn.cells.forEach((mask, i) => senses.cell(mask, { start: 0.2 + i * 0.45 }));
    } else if (isReview) {
      message(turn.hinted ? `Otra vez ${what}. Sigue los puntos que brillan.` : `Otra vez ${what}. Esta vez es ${subject.yours}.`, 'info');
    } else if (turn.hinted) {
      message('Sigue los puntos que brillan.', 'info');
    } else {
      message(multi ? 'El signo de número ya está puesto: escribe los dígitos.' : 'Escribe la letra en braille.');
    }
    renderCrystals();
    renderSequence();
    drawCell(0);
    input.enable();
  }

  // La ronda en orden solo empieza si cabe entera en la vida que le queda al enemigo.
  function maybeStartOrder() {
    if (!session.subject.ordered || session.orderQueue.length) return;
    session.orderIn -= 1;
    const learned = session.subject.order.filter((item) => sp().unlocked.includes(item));
    if (session.orderIn > 0 || learned.length < MIN_ORDER || block.hp < learned.length) return;
    session.orderIn = ORDER_EVERY;
    session.orderQueue = learned;
  }

  function drawCell(mask, marks) {
    const ghost = turn?.hinted ? targetOf(turn) : 0;
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
    if (mask !== targetOf(turn)) return onWrong(mask);
    if (turn.pos < turn.cells.length - 1) return onCellDone(mask);
    onCorrect(mask);
  }

  // Una celda bien en un elemento de varias: se avanza a la siguiente sin lanzar el hechizo.
  function onCellDone(mask) {
    turn.pos += 1;
    cell.flash('success');
    senses.cell(mask);
    fx.burstAt(cell.el, dotColorsOf(mask), 10);
    message(`¡Bien! Ahora ${describeCell(turn)}.`, 'good');
    renderSequence();
    drawCell(0);
  }

  function onCorrect(mask) {
    input.disable();
    if (session.practice) return onCountCorrect(mask);
    const { item } = turn;
    if (!turn.attempted) {
      recordAnswer(sp(), item, { correct: true, hinted: turn.hinted });
      session.firstTry += 1;
      session.answered += 1;
      block.firstTry += 1;
      block.answered += 1;
    }
    turn.attempted = true;
    turn.pos = turn.cells.length;
    combo += 1;
    session.bestCombo = Math.max(session.bestCombo, combo);
    block.hp -= 1;
    persist();

    drawCell(mask);
    renderSequence();
    cell.flash('success');
    senses.success(mask, combo);
    senses.speak(session.subject.spoken(item));
    senses.vibrate([25, 30, 25]);
    // Más combo, hechizo más fuerte: proyectiles más grandes, más chispas y más temblor.
    const power = 1 + Math.min(combo, 10) * 0.08;
    const gear = loadout(hero, heroLvl());
    const colors = turn.cells.flatMap(dotColorsOf);
    const hitCombo = combo;
    fx.spell(cell.el, $('enemy-shape'), colors, {
      power,
      foco: gear.foco,
      onHit: () => hitEnemy(hitCombo, { colors, power, sello: gear.sello }),
    });
    const praise = turn.orderLast ? '¡Cuenta completa!' : turn.isReview ? '¡Revancha ganada!' : PRAISE[combo % PRAISE.length];
    message(combo >= 3 ? `${praise} Combo ×${combo}` : praise, 'good');
    renderHp();
    renderCombo();
    renderCrystals();

    // El último golpe espera a que el enemigo termine de salir despedido antes de derrotarlo.
    later(() => (block.hp <= 0 ? defeatEnemy() : nextTurn()), block.hp <= 0 ? NEXT_TURN_MS + 600 : NEXT_TURN_MS);
  }

  function onCountCorrect(mask) {
    turn.pos = turn.cells.length;
    combo += 1;
    session.bestCombo = Math.max(session.bestCombo, combo);
    drawCell(mask);
    renderSequence();
    cell.flash('success');
    senses.success(mask, combo);
    senses.speak(turn.item);
    senses.vibrate([25, 30, 25]);
    fx.burstAt(cell.el, turn.cells.flatMap(dotColorsOf), 18 + Math.min(combo, 10) * 3);
    message(turn.item === '10' ? '¡Hasta el 10!' : PRAISE[combo % PRAISE.length], 'good');
    renderCombo();
    later(nextTurn, NEXT_TURN_MS);
  }

  function onWrong(mask) {
    input.disable();
    const target = targetOf(turn);
    const multi = turn.cells.length > 1;
    const answeredAs = multi ? null : charOf(mask);
    if (!turn.attempted && !session.practice) {
      recordAnswer(sp(), turn.item, { correct: false, hinted: turn.hinted, answeredAs });
      scheduleReview(session.review, turn.item);
      session.answered += 1;
      if (block) block.answered += 1;
      persist();
    }
    turn.attempted = true;
    // El combo se reduce a la mitad en vez de perderse entero.
    combo = Math.floor(combo / 2);
    renderCombo();

    drawCell(mask, { ghost: target & ~mask, wrong: mask & ~target });
    cell.flash('shake');
    senses.error();
    senses.vibrate(80);
    if (multi) message(`Aquí va ${describeCell(turn)}. Fíjate en los puntos que brillan.`, 'bad');
    else {
      message(answeredAs
        ? `Eso es la «${answeredAs}». Fíjate en los puntos que brillan.`
        : 'Casi. Fíjate en los puntos que brillan.', 'bad');
    }

    // Reintento de la misma celda tras la pausa, o al momento si se pulsa Retroceso.
    turn.retry = () => {
      turn.retry = null;
      turn.hinted = true;
      drawCell(0);
      input.enable();
    };
    const { retry } = turn;
    later(() => { if (turn.retry === retry) retry(); }, RETRY_MS);
  }

  function onClear() {
    if (screen === 'battle') turn?.retry?.();
  }

  function restart(el, className) {
    el.classList.remove(className);
    void el.offsetWidth; // reinicia la animación CSS
    el.classList.add(className);
  }

  let hitTimer = null;

  // Impacto en dos tiempos: al llegar el hechizo el enemigo se congela y flashea; al acabar el
  // congelado salen a la vez el retroceso (CSS), el estallido, el sello, el temblor y el daño.
  function hitEnemy(hitCombo, { colors, power, sello }) {
    const crit = hitCombo >= 5;
    const kind = crit ? 'crit' : 'normal';
    const enemy = $('enemy');
    enemy.classList.toggle('crit', crit);
    restart(enemy, 'hit');
    clearTimeout(hitTimer);
    hitTimer = setTimeout(() => enemy.classList.remove('hit', 'crit'), IMPACT_MS[kind]);
    later(() => {
      fx.explode($('enemy-shape'), colors, { power, sello });
      sealFlash(sello);
      restart($('screen-battle'), crit ? 'quake-big' : 'quake');
      const pop = document.createElement('div');
      pop.className = `damage${crit ? ' crit' : ''}`;
      pop.textContent = crit ? `¡CRÍTICO! ×${hitCombo}` : hitCombo >= 3 ? `−1 ×${hitCombo}` : '−1';
      enemy.append(pop);
      setTimeout(() => pop.remove(), 900);
    }, FREEZE_MS[kind]);
  }

  function defeatEnemy() {
    clearTimeout(hitTimer);
    $('enemy').classList.remove('hit', 'crit'); // si no, la animación del golpe taparía la de derrota
    $('enemy').classList.add('defeated');
    fx.burstAt($('enemy-shape'), [block.enemy.color, '#ffffff'], 80);
    restart($('screen-battle'), 'quake-big');
    senses.victory();
    message(`${block.enemy.name} derrotado.`, 'good');
    // Cofre: siempre un objeto nuevo; acertar a la primera mejora la rareza.
    // levelSeen = nivel al empezar este combate, para anunciar si se ha subido.
    const quality = block.answered ? block.firstTry / block.answered : 0;
    session.drop = { item: openChest(hero, quality), levelBefore: session.levelSeen };
    session.levelSeen = heroLvl();
    persist();
    later(() => {
      session.block += 1;
      if (session.block >= BLOCKS_PER_SESSION) endSession();
      else showBreak();
    }, 1200);
  }

  // ---------- Lectura (ronda de la aventura o práctica desde el menú) ----------

  // En la aventura, una de cada dos pausas, si ya hay suficientes letras que leer.
  function shouldRead() {
    return session.readNext && readablePool(sp()).length >= MIN_READ_LETTERS;
  }

  function continueAfterBreak() {
    if (shouldRead()) {
      session.readNext = false;
      startReading('adventure', session.subject.readKind);
    } else {
      session.readNext = true;
      startBlock();
    }
  }

  // Dos tipos de lectura: letras (pulsa la letra) y números (signo de número + dígitos, teclea el número).
  const isNumbers = () => read.kind === 'numbers';
  const readStats = () => (isNumbers() ? progress.numbers : progress.reading);
  const cellsOf = (item) => (isNumbers() ? numberCells(Number(item)) : [maskOf(item)]);
  // Para elegir distractores se compara la última celda (el dígito de las unidades).
  const choiceMask = (item) => (isNumbers() ? digitMask(Number(item.at(-1))) : maskOf(item));
  const spoken = (item) => (isNumbers() ? item : LETTER_NAMES[item]);
  const written = (item) => cellsOf(item).map(unicodeOf).join('');

  function startReading(mode, kind = 'letters') {
    if (mode === 'practice') token += 1;
    progress.reading.unlocked = readablePool(progress);
    // En la aventura solo se leen los números que ya se han escrito bien; en la práctica, todos.
    progress.numbers.unlocked = mode === 'adventure' ? readablePool(progress.numWrite) : [...NUMBERS];
    read = {
      mode, kind,
      items: mode === 'practice' ? READ_ITEMS_PRACTICE : READ_ITEMS_ADVENTURE,
      done: 0, firstTry: 0, item: null, typed: '', attempted: false, locked: false, review: createReview(),
    };
    const title = kind === 'numbers' ? 'Práctica de números' : mode === 'practice' ? 'Práctica de lectura' : 'Ronda de lectura';
    setHud(title);
    $('read-banner').textContent = title;
    $('read-title').textContent = kind === 'numbers' ? '¿Qué número es?' : '¿Qué letra es?';
    $('read-typed').hidden = kind !== 'numbers';
    $('read-controls').innerHTML = (kind === 'numbers'
      ? 'Escribe el número con <kbd>0</kbd>–<kbd>9</kbd> · <kbd>Retroceso</kbd> borrar'
      : 'Pulsa la letra en tu teclado')
      + ` · <kbd>Esc</kbd> ${mode === 'practice' ? 'volver al menú' : 'saltar la lectura'}`;
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
    $('read-choices').replaceChildren(...choices.map((item) => {
      const el = document.createElement('div');
      el.className = 'choice';
      el.textContent = item;
      return el;
    }));
  }

  function showChoices() {
    const stats = readStats();
    renderChoices(pickChoices(read.item, stats.unlocked, isNumbers() ? stats.confusions : progress.confusions,
      Math.random, choiceMask));
  }

  function renderReadProgress() {
    $('read-progress').replaceChildren(...Array.from({ length: read.items }, (_, i) => {
      const el = document.createElement('i');
      if (i < read.done) el.className = 'done';
      else if (i === read.done) el.className = 'current';
      return el;
    }));
  }

  function renderTyped() {
    $('read-typed').textContent = read.typed || '·'.repeat(read.item.length);
  }

  function showReadCells(masks) {
    readCells = masks.map(() => document.createElement('div'));
    $('read-cell').replaceChildren(...readCells);
    readCells = readCells.map((holder, i) => {
      const c = createCell(holder);
      c.set(masks[i]);
      c.flash('pop');
      return c;
    });
  }

  const flashRead = (className) => readCells.forEach((c) => c.flash(className));

  function playCells(masks) {
    masks.forEach((mask, i) => senses.cell(mask, { start: i * 0.45 }));
  }

  function nextRead() {
    if (!read) return; // ronda saltada con Esc
    if (read.done >= read.items) return endReading();
    const stats = readStats();
    const item = takeDueReview(read.review, read.item) ?? pickNext(stats, Math.random, read.item);
    Object.assign(read, { item, typed: '', attempted: false, locked: false });
    const masks = cellsOf(item);
    showReadCells(masks);
    playCells(masks);
    // Pista: tres opciones mientras no se haya leído bien nunca.
    const hinted = statOf(stats, item).box === 0;
    if (hinted) showChoices();
    else renderChoices([]);
    if (isNumbers()) {
      renderTyped();
      readMessage(hinted ? '¿Cuál de estos es? Escríbelo.' : '¿Qué número es? Escríbelo.', 'info');
    } else {
      readMessage(hinted ? '¿Cuál de estas es? Pulsa su tecla.' : '¿Qué letra es? Pulsa su tecla.', 'info');
    }
    renderReadProgress();
  }

  // Números: los dígitos se acumulan y se comprueban al tener tantos como el número mostrado.
  function onReadDigit(digit) {
    if (read.locked) return;
    read.typed += digit;
    renderTyped();
    if (read.typed.length >= read.item.length) {
      const answer = read.typed;
      read.typed = '';
      onReadAnswer(answer);
      if (!read.locked) renderTyped();
    }
  }

  function onReadBackspace() {
    if (read.locked || !read.typed) return;
    read.typed = read.typed.slice(0, -1);
    renderTyped();
  }

  function onReadAnswer(answer) {
    if (read.locked) return;
    const stats = readStats();
    const { item } = read;
    const masks = cellsOf(item);
    if (answer === item) {
      read.locked = true;
      if (!read.attempted) {
        recordAnswer(stats, item, { correct: true, hinted: false });
        read.firstTry += 1;
        if (session) {
          session.readFirst += 1;
          session.readTotal += 1;
        }
      }
      read.done += 1;
      persist();
      flashRead('success');
      if (isNumbers()) $('read-typed').textContent = item;
      senses.success(masks.at(-1), read.done);
      senses.speak(spoken(item));
      senses.vibrate([25, 30, 25]);
      fx.burstAt($('read-cell'), masks.flatMap(dotColorsOf), 24);
      const what = isNumbers() ? `el ${item}` : `la «${item}»`;
      readMessage(read.attempted ? `¡Eso es, ${what}!` : `¡Leído! Es ${what}.`, 'good');
      renderReadProgress();
      later(nextRead, NEXT_TURN_MS);
      return;
    }
    if (!read.attempted) {
      recordAnswer(stats, item, { correct: false, hinted: false, answeredAs: answer });
      scheduleReview(read.review, item);
      if (session) session.readTotal += 1;
      persist();
    }
    read.attempted = true;
    flashRead('shake');
    senses.error();
    senses.vibrate(80);
    // Tras un fallo siempre se ofrecen las tres opciones.
    if (!$('read-choices').children.length) showChoices();
    readMessage(isNumbers()
      ? `El ${Number(answer)} se escribe ${written(String(Number(answer)))} — prueba otra vez.`
      : `La «${answer}» se ve así: ${written(answer)} — prueba con otra.`, 'bad');
  }

  function endReading() {
    const { mode, kind, firstTry, items } = read;
    senses.victory();
    if (mode === 'adventure') {
      read = null;
      readMessage('Lectura completada. ¡Al siguiente combate!', 'good');
      later(startBlock, 1300);
    } else {
      // La práctica espera: Enter hace otras 10, Esc vuelve al menú.
      read.finished = true;
      readMessage(`Práctica completada: ${firstTry}/${items} a la primera.`, 'good');
      $('read-controls').innerHTML = `<kbd>Enter</kbd> ${kind === 'numbers' ? 'otros' : 'otras'} ${items} · <kbd>Esc</kbd> volver al menú`;
    }
  }

  // ---------- Equipo y botín ----------

  function applyAura() {
    const aura = loadout(hero, heroLvl()).aura;
    for (const id of [...$('cell').classList]) if (id.startsWith('aura-')) $('cell').classList.remove(id);
    $('cell').classList.add(`aura-${aura}`);
  }

  // Parte del sello que no son partículas: destello (nova) o corrupción de pantalla (glitch).
  function sealFlash(sello) {
    if (sello === 'nova' || sello === 'supernova') restart($('screen-battle'), 'flash-nova');
    if (sello === 'glitch' || sello === 'supernova') restart($('screen-battle'), 'glitch');
  }

  const rarityName = (item) => RARITIES[item.rarity].name;

  // Tarjeta del cofre en la pausa o al final: objeto, nivel nuevo y huecos que se abren.
  function lootHtml() {
    const { drop } = session;
    if (!drop) return '';
    const lvl = heroLvl();
    const opened = Object.entries(SLOTS)
      .filter(([, slot]) => slot.level > drop.levelBefore && slot.level <= lvl)
      .map(([, slot]) => `Hueco nuevo: <b>${slot.name}</b> (${slot.desc}).`);
    const levelUp = lvl > drop.levelBefore ? `<p class="level-up">¡Nivel ${lvl}!</p>` : '';
    if (!drop.item) {
      return `${levelUp}<div class="loot-card"><b>Cofre vacío</b><small>Ya tienes todo el equipo. Respeto.</small></div>`;
    }
    const { item } = drop;
    const unlocked = slotUnlocked(item.slot, lvl);
    const equipped = hero.equipped[item.slot] === item.id;
    const action = !unlocked
      ? `<small class="muted">${SLOTS[item.slot].name} se abre en el nivel ${SLOTS[item.slot].level}.</small>`
      : equipped ? '<small class="good">Equipado.</small>'
        : '<small><kbd>E</kbd> equipar ahora</small>';
    return `${levelUp}${opened.map((t) => `<p class="slot-new">${t}</p>`).join('')}
      <div class="loot-card rarity-${item.rarity}">
        <div class="chest" aria-hidden="true"></div>
        <span class="loot-rarity">${rarityName(item)} · ${SLOTS[item.slot].name}</span>
        <b>${item.name}</b>
        <small>${item.desc}</small>
        ${action}
      </div>`;
  }

  function equipDrop() {
    if (screen === 'end' && session.block < BLOCKS_PER_SESSION) return; // salió con Esc: no hay cofre a la vista
    const item = session?.drop?.item;
    if (!item || !equip(hero, item.id, heroLvl())) return;
    persist();
    senses.success(0, 1);
    const el = $(screen === 'end' ? 'end-loot' : 'break-loot');
    el.innerHTML = lootHtml();
    el.querySelector('.loot-card')?.classList.add('no-anim');
  }

  const gearList = createChoiceList($('gear-options'), (option) => {
    if (equip(hero, option.id, heroLvl())) {
      persist();
      senses.success(0, 1);
    }
    renderGear(true);
  });

  function renderGear(keep = false) {
    const lvl = heroLvl();
    $('gear-summary').innerHTML = Object.entries(SLOTS).map(([id, slot]) => {
      const open = slotUnlocked(id, lvl);
      const item = itemOf(loadout(hero, lvl)[id]);
      return `<div class="${open ? '' : 'locked'}"><span>${slot.name}</span><b>${open ? item.name : `Nivel ${slot.level}`}</b></div>`;
    }).join('');
    $('gear-level').textContent = `Nivel ${lvl} · ${hero.owned.length}/${ITEMS.length} objetos · ${hero.chests} cofres abiertos`;
    const owned = ITEMS.filter((item) => hero.owned.includes(item.id));
    gearList.set(owned.map((item) => {
      const equipped = hero.equipped[item.slot] === item.id;
      return {
        id: item.id,
        name: `${SLOTS[item.slot].name} · ${item.name}${equipped ? ' ✓' : ''}`,
        desc: `${rarityName(item)} — ${item.desc}`,
        disabled: !slotUnlocked(item.slot, lvl),
        lockedText: `${rarityName(item)} — se equipa en el nivel ${SLOTS[item.slot].level}`,
        tone: `rarity-${item.rarity}${equipped ? ' equipped' : ''}`,
      };
    }), { keep });
  }

  function showGear() {
    input.disable();
    setHud('Equipo');
    renderGear();
    showScreen('gear');
  }

  // ---------- Pausa y final ----------

  function statsHtml() {
    const pct = session.answered ? Math.round((session.firstTry / session.answered) * 100) : 0;
    const { subject } = session;
    const stats = sp();
    const learned = subject.order.filter((item) => stats.unlocked.includes(item) && isMastered(stats, item));
    const reading = session.readTotal
      ? `<div><b>${session.readFirst}/${session.readTotal}</b><span>leídas a la primera</span></div>`
      : '';
    return `
      <div><b>${pct}%</b><span>a la primera</span></div>${reading}
      <div><b>×${session.bestCombo}</b><span>mejor combo</span></div>
      <div><b>${session.newLetters.join(' ') || '—'}</b><span>${subject.newLabel}</span></div>
      <div><b>${learned.length}/${subject.order.length}</b><span>dominadas</span></div>`;
  }

  // La pausa se recomienda (círculo de respiración) pero nunca bloquea: Enter sigue al momento.
  function showBreak() {
    $('break-title').textContent = `Bloque ${session.block}/${BLOCKS_PER_SESSION} completado`;
    $('break-stats').innerHTML = statsHtml();
    $('break-loot').innerHTML = lootHtml();
    $('break-continue').innerHTML = shouldRead()
      ? '<kbd>Enter</kbd> ronda de lectura · <kbd>Esc</kbd> terminar por hoy'
      : '<kbd>Enter</kbd> siguiente bloque · <kbd>Esc</kbd> terminar por hoy';
    showScreen('break');
  }

  function endSession() {
    $('end-stats').innerHTML = statsHtml();
    // El cofre solo se enseña si la sesión acaba al derrotar al último enemigo (no al salir con Esc).
    $('end-loot').innerHTML = session.block >= BLOCKS_PER_SESSION ? lootHtml() : '';
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
      case 'subjects':
        if (esc) showMenu();
        else subjectList.handleKey(e);
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
        if (read.finished) {
          if (isEnter(e)) {
            e.preventDefault();
            startReading(read.mode, read.kind);
          } else if (esc) {
            showMenu();
          }
          break;
        }
        if (esc) {
          if (read.mode === 'practice') {
            showMenu();
          } else {
            read = null;
            startBlock();
          }
          break;
        }
        if (isNumbers()) {
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            if (!e.repeat) onReadDigit(e.key);
          } else if (e.code === 'Backspace' || e.code === 'Delete') {
            e.preventDefault();
            onReadBackspace();
          }
        } else if (e.key.length === 1 && e.key.toLowerCase() in LETTER_NAMES) {
          e.preventDefault();
          if (!e.repeat) onReadAnswer(e.key.toLowerCase());
        }
        break;
      case 'gear':
        if (esc) showMenu();
        else gearList.handleKey(e);
        break;
      case 'break':
        if (e.code === 'KeyE') equipDrop();
        else if (isEnter(e)) {
          e.preventDefault();
          continueAfterBreak();
        } else if (esc) {
          endSession();
        }
        break;
      case 'end':
        if (e.code === 'KeyE') equipDrop();
        else if (isEnter(e)) {
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

  // Atajos del menú de depuración. Devuelven false si no se pueden usar en la pantalla actual.
  const debug = {
    defeatEnemy() {
      if (screen !== 'battle' || !block || session?.practice || block.hp <= 0) return false;
      token += 1; // anula el turno pendiente
      input.disable();
      block.hp = 0;
      renderHp();
      defeatEnemy();
      return true;
    },
    setCombo(n) {
      if (screen !== 'battle') return false;
      combo = n;
      renderCombo();
      return true;
    },
  };

  return {
    debug,
    attachInput(i) { input = i; },
    onChange,
    onCommit,
    onClear,
    setLayout(layout) {
      keyboard.setLayout(layout);
      warmup.setLayout(layout);
    },
    showMenu,
  };
}
