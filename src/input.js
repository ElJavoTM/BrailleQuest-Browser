// Entrada con el teclado: el signo generador se dibuja con QAZ / WSX.
// Se usa event.code (posición física) para que funcione con cualquier distribución.

export const LAYOUTS = {
  left: { KeyQ: 1, KeyA: 2, KeyZ: 3, KeyW: 4, KeyS: 5, KeyX: 6 },
  right: { KeyU: 1, KeyJ: 2, KeyM: 3, KeyI: 4, KeyK: 5, Comma: 6 },
};

export const KEY_LABELS = {
  left: { 1: 'Q', 2: 'A', 3: 'Z', 4: 'W', 5: 'S', 6: 'X' },
  right: { 1: 'U', 2: 'J', 3: 'M', 4: 'I', 5: 'K', 6: ',' },
};

// Modo "toggle": cada tecla enciende/apaga su punto; Enter/Espacio confirma.
// Modo "fast": las teclas a la vez; la celda se confirma al soltar la última.
// Retroceso/Supr limpia la celda en cualquier modo; si la entrada está bloqueada
// (p. ej. mostrando un fallo) avisa con onClear para que el juego decida.
export function createInput(settings, { onChange, onCommit, onClear }) {
  let mask = 0;
  let enabled = false;
  const held = new Set();

  const ignored = (e) => e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey
    || document.querySelector('dialog[open]');
  const isClear = (e) => e.code === 'Backspace' || e.code === 'Delete';

  function reset() {
    mask = 0;
    held.clear();
    onChange(0, null);
  }

  function commit() {
    const committed = mask;
    mask = 0;
    held.clear();
    onCommit(committed);
  }

  window.addEventListener('keydown', (e) => {
    if (ignored(e)) return;
    if (isClear(e)) {
      e.preventDefault();
      if (enabled) reset();
      else onClear?.();
      return;
    }
    if (!enabled) return;
    const dot = LAYOUTS[settings.layout][e.code];
    if (dot) {
      e.preventDefault();
      if (e.repeat) return;
      const bit = 1 << (dot - 1);
      if (settings.inputMode === 'fast') {
        held.add(e.code);
        mask |= bit;
      } else {
        mask ^= bit;
      }
      onChange(mask, { dot, on: (mask & bit) !== 0 });
      return;
    }
    if (settings.inputMode !== 'toggle') return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      if (!e.repeat && mask) commit();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!enabled || settings.inputMode !== 'fast') return;
    if (!held.delete(e.code)) return;
    if (held.size === 0 && mask) commit();
  });

  // Si la ventana pierde el foco se pierden los keyup: empezar de cero.
  window.addEventListener('blur', () => { if (enabled) reset(); });

  return {
    enable() { enabled = true; },
    disable() { enabled = false; mask = 0; held.clear(); },
    reset,
  };
}
