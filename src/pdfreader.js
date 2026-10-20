// Leer un PDF: sube un texto en braille y tradúcelo carácter a carácter, línea a línea.
// Al terminar cada línea se corrige: los fallos se pueden repetir o ver la solución.
import { tokensFromText, inputTokens, checkLine } from './transcribe.js';
import { readPdfLines } from './pdftext.js';
import { createCell, dotColorsOf } from './render.js';

const $ = (id) => document.getElementById(id);
const isEnter = (e) => e.code === 'Enter' || e.code === 'NumpadEnter';
const STORE_KEY = 'braille-quest:pdf';
const CONTEXT_LINES = 2;

function loadDoc() {
  try {
    const doc = JSON.parse(localStorage.getItem(STORE_KEY));
    return doc?.lines?.length ? doc : null;
  } catch {
    return null;
  }
}

function saveDoc(doc) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(doc)); } catch { /* sin almacenamiento */ }
}

export function createPdfReader({ senses, fx, createChoiceList, showScreen, setHud }) {
  const fileInput = $('pdf-file');
  // Campo oculto que recibe lo que se escribe: así funcionan las teclas muertas (´ + u = ú, ¨ + u = ü)
  // y los métodos de entrada, que no llegan como una sola tecla en keydown.
  const textInput = $('pdf-input');
  // { name, lines: [{ page, text }], index, status: { [i]: 'ok' | 'fixed' | 'revealed' },
  //   saved: { [i]: { typed, revealed } } } — en `typed` solo queda lo que ya estaba bien.
  let doc = loadDoc();
  if (doc) doc.saved ??= {};
  let line = null; // línea en curso
  let busy = false;

  const startList = createChoiceList($('pdf-options'), (option) => option.start());

  function message(text, tone = '') {
    const el = $('pdf-message');
    el.textContent = text;
    el.className = `message ${tone}`;
  }

  function controls(html) {
    $('pdf-controls').innerHTML = html;
  }

  // ---------- Inicio: elegir PDF o continuar ----------

  function showStart() {
    line = null;
    textInput.blur();
    $('pdf-pick').hidden = false;
    $('pdf-work').hidden = true;
    $('pdf-title').textContent = 'Sube un PDF en braille';
    const options = [];
    if (doc) {
      const done = Object.keys(doc.status).length;
      options.push({
        name: `Continuar «${doc.name}»`,
        desc: `Línea ${doc.index + 1} de ${doc.lines.length} · ${done} traducidas`,
        start: () => openLine(doc.index),
      });
    }
    options.push({
      name: doc ? 'Subir otro PDF' : 'Elegir un PDF',
      desc: 'Un PDF hecho con fuente braille (EDICO) o con braille Unicode. También puedes soltarlo aquí.',
      start: () => fileInput.click(),
    });
    startList.set(options);
    message('');
    controls('<kbd>↑</kbd> <kbd>↓</kbd> elegir · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> menú');
    setHud('Leer un PDF');
    showScreen('pdf');
  }

  async function loadFile(file) {
    if (!file || busy) return;
    busy = true;
    message(`Leyendo «${file.name}»…`, 'info');
    try {
      const lines = (await readPdfLines(file))
        .filter((l) => inputTokens(tokensFromText(l.text)).length > 0);
      if (!lines.length) {
        message('No encuentro texto braille en este PDF. Si es una imagen escaneada no puedo leerlo: '
          + 'tiene que estar hecho con una fuente braille (como EDICO) o con braille Unicode.', 'bad');
        return;
      }
      doc = { name: file.name.replace(/\.pdf$/i, ''), lines, index: 0, status: {}, saved: {} };
      saveDoc(doc);
      openLine(0);
    } catch (err) {
      console.error(err);
      message('No he podido abrir ese archivo. ¿Seguro que es un PDF?', 'bad');
    } finally {
      busy = false;
      fileInput.value = '';
    }
  }

  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
  const screenEl = $('screen-pdf');
  screenEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    screenEl.classList.add('dragging');
  });
  screenEl.addEventListener('dragleave', () => screenEl.classList.remove('dragging'));
  screenEl.addEventListener('drop', (e) => {
    e.preventDefault();
    screenEl.classList.remove('dragging');
    loadFile(e.dataTransfer.files[0]);
  });

  // ---------- Línea ----------

  const writing = () => line && (line.state === 'typing' || line.state === 'fixing');

  function focusInput() {
    if (line && !document.querySelector('dialog[open]')) textInput.focus({ preventScroll: true });
  }

  function flushInput() {
    const text = textInput.value;
    textInput.value = '';
    for (const char of text) {
      if (!writing()) break;
      if (!/\s/.test(char)) type(char); // los huecos ya están puestos
    }
  }

  textInput.addEventListener('input', (e) => { if (!e.isComposing) flushInput(); });
  textInput.addEventListener('compositionend', flushInput);
  textInput.addEventListener('blur', () => setTimeout(focusInput, 0));
  $('pdf-work').addEventListener('click', focusInput);
  $('settings').addEventListener('close', focusInput); // al cerrar Ajustes, seguir escribiendo

  // `fresh`: empezar la línea de cero aunque haya algo guardado.
  function openLine(index, { fresh = false } = {}) {
    doc.index = Math.max(0, Math.min(index, doc.lines.length - 1));
    saveDoc(doc);
    const { text, page } = doc.lines[doc.index];
    const tokens = tokensFromText(text);
    const slots = inputTokens(tokens);
    const done = Boolean(doc.status[doc.index]);
    line = {
      tokens, slots,
      typed: slots.map(() => ''),
      editable: slots.map((_, i) => i), // posiciones que se pueden escribir ahora
      cursor: 0, // índice dentro de `editable`
      state: 'typing', // typing → checked → (fixing → checked)… → done
      results: null,
      revealed: new Set(),
      firstTry: !done,
      els: [],
    };
    if (!fresh) restore(doc.saved[doc.index], done);
    $('pdf-pick').hidden = true;
    $('pdf-work').hidden = false;
    $('pdf-title').textContent = doc.name;
    $('pdf-where').textContent = `Página ${page} · línea ${doc.index + 1} de ${doc.lines.length}`;
    $('pdf-bar').style.width = `${(Object.keys(doc.status).length / doc.lines.length) * 100}%`;
    renderContext();
    renderLine();
    announce();
    setHud(`Leer un PDF · ${doc.index + 1}/${doc.lines.length}`);
    showScreen('pdf');
    textInput.value = '';
    focusInput();
  }

  // Mensaje y teclas al abrir una línea, según cómo se dejó.
  function announce() {
    if (line.state === 'done') {
      message(doc.status[doc.index] === 'revealed'
        ? 'Esta línea ya la viste (en amarillo, lo que te enseñé).' : 'Esta línea ya la tenías bien.', 'good');
      controls(doneControls());
    } else if (line.state === 'checked') {
      const wrong = line.results.filter((ok) => ok === false).length;
      message(`${wrong === 1 ? 'Hay 1 fallo' : `Hay ${wrong} fallos`} de ${line.results.length} (en rojo).`, 'bad');
      controls(checkedControls());
    } else if (line.state === 'fixing') {
      const left = line.editable.filter((i) => !line.typed[i]).length;
      message(`Te guardé lo que tenías bien. ${left === 1 ? 'Falta 1 casilla' : `Faltan ${left} casillas`}.`, 'info');
      controls(typingControls());
    } else if (line.typed.some(Boolean)) {
      message('Sigues donde lo dejaste.', 'info');
      controls(typingControls());
    } else {
      message('Escribe en tinta lo que dice cada celda. Te corrijo al acabar la línea.', 'info');
      controls(typingControls());
    }
  }

  // Vuelve a poner la línea tal y como se dejó.
  function restore(saved, done) {
    if (saved?.state && saved.typed.length === line.slots.length) {
      line.typed = [...saved.typed];
      line.results = saved.results;
      line.revealed = new Set(saved.revealed);
      line.editable = saved.editable;
      line.cursor = saved.cursor;
      line.state = saved.state;
      line.firstTry = saved.firstTry;
      return;
    }
    // Línea terminada sin nada guardado (o guardada con una versión anterior).
    if (!done && !saved) return;
    const answers = line.slots.map((slot) => slot.answer);
    line.typed = line.slots.map((_, i) => saved?.typed?.[i] ?? '');
    line.revealed = new Set(saved?.revealed ?? []);
    line.firstTry = false;
    if (done) {
      line.typed = line.typed.map((t, i) => t || answers[i]);
      line.results = line.slots.map((_, i) => !line.revealed.has(i));
      line.state = 'done';
      line.cursor = -1;
      return;
    }
    line.results = line.typed.map((t) => (t ? true : null));
    line.editable = line.slots.flatMap((_, i) => (line.typed[i] ? [] : [i]));
    line.state = 'fixing';
  }

  // Guarda la línea tal cual (también lo escrito sin corregir), para no perderlo al cambiar de línea.
  function remember() {
    if (line.state === 'typing' && !line.typed.some(Boolean)) {
      delete doc.saved[doc.index];
    } else {
      doc.saved[doc.index] = {
        typed: line.typed, results: line.results, revealed: [...line.revealed],
        editable: line.editable, cursor: line.cursor, firstTry: line.firstTry,
        state: line.state === 'finished' ? 'done' : line.state,
      };
    }
    saveDoc(doc);
  }

  // Repetir una línea terminada desde cero (su estado, p. ej. «bien a la primera», se conserva).
  function redo() {
    delete doc.saved[doc.index];
    openLine(doc.index, { fresh: true });
    line.firstTry = false;
  }

  const LINES_KEYS = '<kbd>↑</kbd> <kbd>↓</kbd> otra línea · <kbd>Esc</kbd> menú';
  const doneControls = () => `<kbd>Enter</kbd> siguiente línea · <kbd>Retroceso</kbd> repetirla · ${LINES_KEYS}`;
  const checkedControls = () => `<kbd>Enter</kbd> corregir los fallos · <kbd>Tab</kbd> ver la solución · ${LINES_KEYS}`;
  const typingControls = () => 'Escribe cada carácter · <kbd>←</kbd> <kbd>→</kbd> moverte entre letras · '
    + `<kbd>Retroceso</kbd> borrar · ${LINES_KEYS}`;

  // Las líneas anteriores en tinta, para seguir el hilo del texto.
  function renderContext() {
    const from = Math.max(0, doc.index - CONTEXT_LINES);
    $('pdf-context').replaceChildren(...doc.lines.slice(from, doc.index).map((l, i) => {
      const p = document.createElement('p');
      const solved = doc.status[from + i];
      p.textContent = solved ? inkOf(l.text) : '· · ·';
      return p;
    }));
  }

  function inkOf(text) {
    return tokensFromText(text).map((t) => (t.kind === 'space' ? ' ' : t.answer ?? '?')).join('');
  }

  // Cada palabra es un bloque que no se parte: celdas arriba y la casilla para escribir debajo.
  function renderLine() {
    const row = $('pdf-line');
    const words = [];
    let word = null;
    let slot = 0;
    line.els = [];
    for (const token of line.tokens) {
      if (token.kind === 'space') {
        word = null;
        continue;
      }
      if (!word) {
        word = document.createElement('div');
        word.className = 'pdf-word';
        words.push(word);
      }
      const col = document.createElement('div');
      col.className = 'pdf-col';
      const cells = document.createElement('div');
      cells.className = 'pdf-cells';
      for (const mask of token.cells) {
        const holder = document.createElement('div');
        const cell = createCell(holder);
        cell.el.classList.add('mini', 'pdf-cell');
        cell.set(mask);
        cells.append(cell.el);
      }
      const box = document.createElement('div');
      box.className = 'pdf-slot';
      col.append(cells, box);
      if (token.kind === 'char') {
        const i = slot++;
        col.addEventListener('click', () => moveTo(i));
        line.els.push({ col, box });
      } else {
        col.classList.add('unknown');
        box.textContent = '?';
        col.title = 'No sé leer esta celda: se salta.';
      }
      word.append(col);
    }
    row.replaceChildren(...words);
    paint();
  }

  function current() {
    return line.editable[line.cursor];
  }

  function paint() {
    line.els.forEach(({ col, box }, i) => {
      box.textContent = line.typed[i];
      const result = line.results?.[i];
      col.classList.toggle('current', line.state !== 'done' && line.state !== 'checked' && current() === i);
      col.classList.toggle('ok', result === true);
      col.classList.toggle('ko', result === false && line.state !== 'fixing');
      col.classList.toggle('redo', line.state === 'fixing' && line.editable.includes(i));
      col.classList.toggle('revealed', Boolean(line.revealed?.has(i)));
    });
    line.els[current()]?.col.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    remember();
  }

  function step(delta) {
    if (line.state !== 'typing' && line.state !== 'fixing') return;
    line.cursor = Math.max(0, Math.min(line.cursor + delta, line.editable.length - 1));
    paint();
  }

  function moveTo(slot) {
    if (line.state !== 'typing' && line.state !== 'fixing') return;
    const at = line.editable.indexOf(slot);
    if (at === -1) return;
    line.cursor = at;
    paint();
  }

  function type(char) {
    const i = current();
    if (i === undefined) return;
    line.typed[i] = char;
    // Siguiente casilla vacía; si no queda ninguna, se corrige la línea.
    const next = line.editable.findIndex((slot, k) => k > line.cursor && !line.typed[slot]);
    const anyEmpty = line.editable.findIndex((slot) => !line.typed[slot]);
    if (next !== -1) line.cursor = next;
    else if (anyEmpty !== -1) line.cursor = anyEmpty;
    else return check();
    paint();
  }

  function erase() {
    const i = current();
    if (line.typed[i]) {
      line.typed[i] = '';
    } else if (line.cursor > 0) {
      line.cursor -= 1;
      line.typed[current()] = '';
    }
    paint();
  }

  function check() {
    const { results, wrong } = checkLine(line.tokens, line.typed);
    line.results = results;
    line.cursor = -1;
    const row = $('pdf-line');
    if (wrong === 0) {
      line.state = 'done';
      doc.status[doc.index] ??= line.firstTry ? 'ok' : 'fixed';
      paint();
      message(line.firstTry ? '¡Línea perfecta! Todo bien a la primera.' : '¡Ahora sí! Línea correcta.', 'good');
      controls(doneControls());
      senses.victory();
      senses.speak('Bien');
      fx.burstAt(row, dotColorsOf(0b111111), 30);
      $('pdf-bar').style.width = `${(Object.keys(doc.status).length / doc.lines.length) * 100}%`;
      return;
    }
    line.state = 'checked';
    line.firstTry = false;
    paint();
    const total = results.length;
    message(`${wrong === 1 ? 'Hay 1 fallo' : `Hay ${wrong} fallos`} de ${total} (en rojo).`, 'bad');
    controls(checkedControls());
    senses.error();
    senses.speak(wrong === 1 ? 'Un fallo' : `${wrong} fallos`);
    row.classList.remove('shake');
    void row.offsetWidth;
    row.classList.add('shake');
  }

  function fix() {
    line.editable = line.results.flatMap((ok, i) => (ok ? [] : [i]));
    for (const i of line.editable) line.typed[i] = '';
    line.cursor = 0;
    line.state = 'fixing';
    paint();
    message('Vuelve a escribir las casillas marcadas.', 'info');
    controls(typingControls());
  }

  function reveal() {
    line.revealed = new Set();
    line.results.forEach((ok, i) => {
      if (ok) return;
      line.revealed.add(i);
      line.typed[i] = line.slots[i].answer;
    });
    line.state = 'done';
    doc.status[doc.index] ??= 'revealed';
    paint();
    message('En amarillo, lo que ponía. Fíjate en esas celdas antes de seguir.', 'info');
    controls(doneControls());
  }

  function next() {
    if (doc.index + 1 < doc.lines.length) {
      openLine(doc.index + 1);
      return;
    }
    line.state = 'finished';
    const ok = Object.values(doc.status).filter((s) => s === 'ok').length;
    message(`¡Has terminado «${doc.name}»! ${ok} de ${doc.lines.length} líneas bien a la primera.`, 'good');
    controls('<kbd>↑</kbd> repasar líneas · <kbd>Esc</kbd> menú');
    senses.speak('Texto terminado');
  }

  // Teclas en la pantalla del PDF (Esc lo gestiona el juego).
  function handleKey(e) {
    if (!line) {
      startList.handleKey(e);
      return;
    }
    if (e.isComposing || e.key === 'Dead') return; // a medio componer una letra (´ + u)
    if (e.code === 'Tab') e.preventDefault(); // que el foco no salga del campo de escritura
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      e.preventDefault();
      const target = doc.index + (e.code === 'ArrowDown' ? 1 : -1);
      if (target >= 0 && target < doc.lines.length) openLine(target);
      return;
    }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault();
      step(e.code === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (line.state === 'checked') {
      if (isEnter(e)) {
        e.preventDefault();
        fix();
      } else if (e.code === 'Tab') {
        e.preventDefault();
        reveal();
      }
      return;
    }
    if (line.state === 'done') {
      if (isEnter(e)) {
        e.preventDefault();
        next();
      } else if (e.code === 'Backspace' || e.code === 'Delete') {
        e.preventDefault();
        redo();
      }
      return;
    }
    if (line.state === 'finished') return;
    // Escribiendo.
    if (e.code === 'Backspace' || e.code === 'Delete') {
      e.preventDefault();
      erase();
    } else if (e.code === 'Space' || isEnter(e)) {
      e.preventDefault(); // los huecos ya están puestos
    }
    // El resto de caracteres llegan por el campo oculto (flushInput).
  }

  return {
    start: showStart,
    handleKey,
    stop() {
      line = null;
      textInput.blur();
    },
  };
}
