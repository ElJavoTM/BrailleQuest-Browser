// Arranque: carga datos, conecta sentidos, entrada, juego y panel sensorial.
import { load, save } from './storage.js';
import { createProgress } from './learning.js';
import { createSenses } from './senses.js';
import { createInput } from './input.js';
import { applyDotColors, createFx } from './render.js';
import { createGame } from './game.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_SETTINGS = {
  sound: true,
  volume: 0.7,
  voice: true,
  effects: !reducedMotion,
  vibration: true,
  keyboard: true,
  inputMode: 'toggle',
  layout: 'left',
  calm: false,
};

const stored = load();
const data = {
  settings: { ...DEFAULT_SETTINGS, ...stored?.settings },
  progress: stored?.progress ?? createProgress(),
};
const settings = data.settings;
const persist = () => save(data);

applyDotColors();
const senses = createSenses(settings);
const fx = createFx(document.getElementById('fx'), () => settings.effects && !settings.calm);
const game = createGame({ data, settings, senses, fx, persist });
const input = createInput(settings, { onChange: game.onChange, onCommit: game.onCommit });
game.attachInput(input);

const CONTROLS = {
  toggle: 'Pulsa las teclas para encender puntos · <kbd>Enter</kbd>/<kbd>Espacio</kbd> lanzar · <kbd>Retroceso</kbd> borrar',
  fast: 'Pulsa las teclas a la vez y suelta para lanzar',
};

function applySettings() {
  document.body.classList.toggle('calm', settings.calm);
  document.body.classList.toggle('no-fx', !settings.effects);
  document.body.classList.toggle('hide-keyboard', !settings.keyboard);
  document.getElementById('btn-calm').setAttribute('aria-pressed', settings.calm);
  document.querySelectorAll('.controls-input').forEach((el) => { el.innerHTML = CONTROLS[settings.inputMode]; });
  game.setLayout(settings.layout);
  senses.applySettings();
}

// ---------- Panel sensorial ----------

const dialog = document.getElementById('settings');
const form = dialog.querySelector('form');

function fillForm() {
  for (const el of form.elements) {
    if (!el.name || !(el.name in settings)) continue;
    if (el.type === 'checkbox') el.checked = settings[el.name];
    else if (el.type === 'radio') el.checked = settings[el.name] === el.value;
    else el.value = settings[el.name];
  }
}

form.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.name || !(el.name in settings)) return;
  if (el.type === 'checkbox') settings[el.name] = el.checked;
  else if (el.type === 'range') settings[el.name] = Number(el.value);
  else settings[el.name] = el.value;
  if (el.name === 'inputMode' || el.name === 'layout') input.reset();
  applySettings();
  persist();
});

document.getElementById('btn-settings').addEventListener('click', (e) => {
  e.currentTarget.blur();
  fillForm();
  dialog.showModal();
});
dialog.addEventListener('close', () => input.reset());

document.getElementById('btn-calm').addEventListener('click', (e) => {
  e.currentTarget.blur();
  settings.calm = !settings.calm;
  applySettings();
  persist();
});

applySettings();
game.showMenu();
