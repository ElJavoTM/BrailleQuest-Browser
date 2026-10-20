// Transcripción de textos en braille (p. ej. un PDF): celdas → caracteres que hay que escribir.
// Puro: sin DOM.
import { maskOf, maskFromDots, charOf, NUMBER_SIGN, digitMask } from './braille.js';

// Signo de mayúscula (puntos 4-6). Dos seguidos: toda la palabra en mayúsculas.
export const CAPITAL_SIGN = maskFromDots([4, 6]);

// Signos de puntuación (CBE). ¿? y ¡! comparten celda: abren y cierran igual.
const PUNCTUATION = [
  ['.', [3]], [',', [2]], [';', [2, 3]], [':', [2, 5]], ['¿', [2, 6]], ['¡', [2, 3, 5]],
  ['"', [2, 3, 6]], ['(', [1, 2, 6]], [')', [3, 4, 5]], ['-', [3, 6]], ['*', [3, 5]],
];
const PUNCT_BY_MASK = new Map(PUNCTUATION.map(([char, dots]) => [maskFromDots(dots), char]));

// Otras teclas que valen por el mismo signo.
const ALTERNATES = {
  '¿': ['?'], '¡': ['!'], '"': ['«', '»', '“', '”'],
};

// Caracteres en tinta que dibujan su propia celda en las fuentes braille de la ONCE (EDICO):
// cada letra se ve como su celda; «´» es el signo de mayúscula y «#» el de número.
// Las mayúsculas en tinta se dibujan igual que las minúsculas (la mayúscula la marca «´»).
const INK_EXTRA = new Map([
  ['´', CAPITAL_SIGN], ['#', NUMBER_SIGN],
  ['?', maskFromDots([2, 6])], ['!', maskFromDots([2, 3, 5])],
  ...PUNCTUATION.map(([char, dots]) => [char, maskFromDots(dots)]),
]);

// Celda que dibuja un carácter, 0 si es un espacio, o null si no es braille (viñetas, etc.).
export function inkCell(char) {
  const code = char.codePointAt(0);
  if (code >= 0x2800 && code <= 0x28ff) return code - 0x2800; // braille Unicode
  if (/\s/.test(char)) return 0;
  if (/[0-9]/.test(char)) return digitMask(Number(char));
  if (INK_EXTRA.has(char)) return INK_EXTRA.get(char);
  try {
    return maskOf(char.toLowerCase());
  } catch {
    return null;
  }
}

// Celdas de una línea de texto. Los espacios seguidos cuentan como uno.
export function cellsFromText(text) {
  const cells = [];
  for (const char of text) {
    const mask = inkCell(char);
    if (mask === null) continue;
    if (mask === 0 && (cells.length === 0 || cells.at(-1) === 0)) continue;
    cells.push(mask);
  }
  while (cells.at(-1) === 0) cells.pop();
  return cells;
}

const LETTER_TO_DIGIT = new Map([...'1234567890'].map((d) => [digitMask(Number(d)), d]));

// Agrupa las celdas en lo que se escribe en tinta: cada elemento tiene sus celdas y la respuesta.
// - space: hueco entre palabras (no se escribe).
// - char: una letra, número o signo. El signo de mayúscula o de número va con su carácter.
// - unknown: celda que no sé leer (se salta).
export function tokenize(cells) {
  const tokens = [];
  let caps = false; // palabra entera en mayúsculas (doble signo)
  let number = false; // tras el signo de número, a–j son dígitos
  for (let i = 0; i < cells.length; i++) {
    const mask = cells[i];
    if (mask === 0) {
      caps = false;
      number = false;
      tokens.push({ kind: 'space', cells: [0] });
      continue;
    }
    const prefix = [];
    let upper = caps;
    if (mask === CAPITAL_SIGN) {
      prefix.push(mask);
      if (cells[i + 1] === CAPITAL_SIGN) {
        prefix.push(cells[++i]);
        caps = true;
      }
      upper = true;
      i += 1;
    } else if (mask === NUMBER_SIGN) {
      prefix.push(mask);
      number = true;
      i += 1;
    }
    const cell = cells[i];
    const all = [...prefix, cell];
    if (cell === undefined || cell === 0) {
      // Signo suelto al final o antes de un espacio.
      tokens.push({ kind: 'unknown', cells: prefix });
      i -= 1;
      continue;
    }
    if (number && LETTER_TO_DIGIT.has(cell)) {
      tokens.push({ kind: 'char', cells: all, answer: LETTER_TO_DIGIT.get(cell) });
      continue;
    }
    number = false;
    const letter = charOf(cell);
    if (letter) {
      tokens.push({ kind: 'char', cells: all, answer: upper ? letter.toUpperCase() : letter });
    } else if (PUNCT_BY_MASK.has(cell) && !prefix.length) {
      tokens.push({ kind: 'char', cells: all, answer: PUNCT_BY_MASK.get(cell) });
    } else {
      tokens.push({ kind: 'unknown', cells: all });
    }
  }
  return tokens;
}

export function tokensFromText(text) {
  return tokenize(cellsFromText(text));
}

// ¿Vale lo escrito para este elemento?
export function accepts(token, typed) {
  if (token.kind !== 'char' || !typed) return false;
  return typed === token.answer || (ALTERNATES[token.answer] ?? []).includes(typed);
}

// Lo que hay que escribir en la línea, sin huecos ni celdas desconocidas.
export function inputTokens(tokens) {
  return tokens.filter((token) => token.kind === 'char');
}

// Corrige una línea: `typed[i]` es lo escrito para el i-ésimo elemento que se escribe.
export function checkLine(tokens, typed) {
  const results = inputTokens(tokens).map((token, i) => accepts(token, typed[i]));
  return { results, wrong: results.filter((ok) => !ok).length };
}

// Texto en tinta de la línea (para enseñar la solución).
export function solution(tokens) {
  return tokens.map((token) => (token.kind === 'space' ? ' ' : token.answer ?? '?')).join('');
}
