// Menú de depuración (sección plegable al final de Ajustes). Herramientas para probar el juego:
// dominar letras o números, conseguir equipo, forzar cofres, críticos o victorias, exportar,
// importar y borrar el progreso.
import { LEVELS } from './braille.js';
import { createProgress, statOf, MASTERED_BOX } from './learning.js';
import { createHero, openChest, ITEMS } from './loot.js';

const NUMBERS = Array.from({ length: 10 }, (_, i) => String(i + 1));

// ---------- Cambios en el progreso (puros, testeados) ----------

// Desbloquea y deja dominados todos los elementos de `order`.
export function masterAll(progress, order) {
  for (const item of order) {
    if (!progress.unlocked.includes(item)) progress.unlocked.push(item);
    const stat = statOf(progress, item);
    stat.box = Math.max(stat.box, MASTERED_BOX);
    stat.seen = Math.max(stat.seen, MASTERED_BOX);
    stat.correct = Math.max(stat.correct, MASTERED_BOX);
  }
}

export function giveAllItems(hero) {
  for (const item of ITEMS) if (!hero.owned.includes(item.id)) hero.owned.push(item.id);
}

// Comprueba que un JSON importado tiene pinta de partida de BrailleQuest.
export function isSaveData(value) {
  return Boolean(value && typeof value === 'object' && value.progress
    && Array.isArray(value.progress.unlocked) && typeof value.progress.stats === 'object');
}

// ---------- Panel ----------

const $ = (id) => document.getElementById(id);

export function createDebugPanel({ data, save, game, defaults }) {
  const status = $('debug-status');
  const say = (text) => { status.textContent = text; };

  // Los cambios de progreso se guardan al momento y se recarga la página:
  // así todo el juego arranca de cero con los datos nuevos.
  function commit(text) {
    save(data);
    say(`${text} Recargando…`);
    setTimeout(() => location.reload(), 600);
  }

  const ensure = () => {
    data.progress.numWrite ??= createProgress();
    data.progress.hero ??= createHero();
  };

  const actions = {
    'master-letters': () => {
      masterAll(data.progress, LEVELS[0].letters);
      commit(`Letras ${LEVELS[0].letters[0]}–${LEVELS[0].letters.at(-1)} dominadas.`);
    },
    'master-numbers': () => {
      ensure();
      masterAll(data.progress.numWrite, NUMBERS);
      commit('Números 1–10 dominados.');
    },
    'all-items': () => {
      ensure();
      giveAllItems(data.progress.hero);
      commit('Tienes todo el equipo.');
    },
    'open-chest': () => {
      ensure();
      const item = openChest(data.progress.hero, 1);
      save(data);
      say(item ? `Cofre: ${item.name} (${item.rarity}, ${item.slot}). Equípalo en Menú → Equipo.` : 'Cofre vacío: ya lo tienes todo.');
    },
    'reset-hero': () => {
      if (!confirm('¿Borrar el equipo y los cofres?')) return;
      data.progress.hero = createHero();
      commit('Equipo borrado.');
    },
    'reset-letters': () => {
      if (!confirm('¿Borrar el progreso de letras (escritura y lectura)?')) return;
      const { numbers, numWrite, hero } = data.progress;
      data.progress = { ...createProgress(), numbers, numWrite, hero };
      commit('Progreso de letras borrado.');
    },
    'reset-numbers': () => {
      if (!confirm('¿Borrar el progreso de números?')) return;
      delete data.progress.numbers;
      delete data.progress.numWrite;
      commit('Progreso de números borrado.');
    },
    'reset-all': () => {
      if (!confirm('¿Borrar TODO el progreso? Letras, números, equipo y cofres. No se puede deshacer.')) return;
      data.progress = createProgress();
      commit('Progreso borrado por completo.');
    },
    'reset-settings': () => {
      Object.assign(data.settings, defaults);
      commit('Ajustes por defecto.');
    },
    'win-block': () => {
      $('settings').close();
      if (!game.debug.defeatEnemy()) say('Solo funciona en mitad de un combate de la Aventura.');
    },
    'combo-5': () => {
      $('settings').close();
      if (!game.debug.setCombo(5)) say('Solo funciona en combate.');
    },
    export: () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `braillequest-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      say('Progreso exportado.');
    },
    import: () => $('debug-file').click(),
    show: () => {
      const pre = $('debug-dump');
      pre.hidden = !pre.hidden;
      if (pre.hidden) return;
      const json = JSON.stringify(data);
      const cookies = document.cookie.split('; ').filter((c) => c.startsWith('bq_')).length;
      pre.textContent = `${(json.length / 1024).toFixed(1)} KB · ${cookies} cookies\n\n${JSON.stringify(data, null, 2)}`;
    },
  };

  $('debug').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-debug]');
    if (!button) return;
    button.blur();
    actions[button.dataset.debug]?.();
  });

  $('debug-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!isSaveData(imported)) throw new Error('formato');
      if (!confirm('¿Sustituir tu progreso por el del archivo?')) return;
      data.progress = imported.progress;
      Object.assign(data.settings, imported.settings ?? {});
      commit('Progreso importado.');
    } catch {
      say('Ese archivo no es una partida de BrailleQuest.');
    }
  });
}
