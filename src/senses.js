// Sonido (Web Audio), voz y vibración. Todo se respeta según el panel sensorial.
import { dotsFromMask } from './braille.js';

// Escala pentatónica: cualquier combinación de puntos suena consonante.
// Columna izquierda (1-2-3) grave, derecha (4-5-6) aguda; arriba suena más alto.
const NOTE_BY_DOT = {
  1: 329.63, // Mi4
  2: 293.66, // Re4
  3: 261.63, // Do4
  4: 523.25, // Do5
  5: 440.0, //  La4
  6: 392.0, //  Sol4
};

export function createSenses(settings) {
  let ctx = null;
  let master = null;

  function volume() {
    if (!settings.sound) return 0;
    return settings.volume * (settings.calm ? 0.5 : 1);
  }

  function tone(freq, { start = 0, dur = 0.25, type = 'triangle', gain = 0.2 } = {}) {
    if (!ctx || !settings.sound) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    // El navegador solo permite audio tras una interacción del usuario.
    unlock() {
      if (!ctx) {
        ctx = new AudioContext();
        const limiter = ctx.createDynamicsCompressor();
        master = ctx.createGain();
        master.connect(limiter).connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      this.applySettings();
    },

    applySettings() {
      if (master) master.gain.value = volume();
    },

    dot(dot, on) {
      tone(NOTE_BY_DOT[dot] * (on ? 1 : 0.5), { dur: 0.2, gain: on ? 0.2 : 0.06 });
    },

    cell(mask, { start = 0 } = {}) {
      dotsFromMask(mask).forEach((dot, i) => {
        tone(NOTE_BY_DOT[dot], { start: start + i * 0.08, dur: 0.6, gain: 0.12 });
      });
    },

    success(mask, combo) {
      this.cell(mask);
      // Brillo final: sube de tono con el combo.
      const sparkle = 1046.5 * 2 ** (Math.min(combo, 8) / 12);
      tone(sparkle, { start: 0.3, dur: 0.35, type: 'sine', gain: 0.1 });
    },

    error() {
      tone(146.83, { dur: 0.22, type: 'sine', gain: 0.18 });
      tone(130.81, { start: 0.1, dur: 0.3, type: 'sine', gain: 0.15 });
    },

    victory() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        tone(freq, { start: i * 0.1, dur: 0.5, gain: 0.14 });
      });
    },

    speak(text) {
      if (!settings.voice || !('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
      if (voice) utterance.voice = voice;
      utterance.rate = 1.05;
      speechSynthesis.speak(utterance);
    },

    vibrate(pattern) {
      if (settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
    },
  };
}
