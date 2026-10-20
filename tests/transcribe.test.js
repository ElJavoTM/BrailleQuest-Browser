import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPITAL_SIGN, inkCell, cellsFromText, tokenize, tokensFromText, accepts, inputTokens, checkLine, solution,
} from '../src/transcribe.js';
import { linesFromItems } from '../src/pdftext.js';
import { maskOf, maskFromDots, NUMBER_SIGN, digitMask } from '../src/braille.js';

test('las letras en tinta dibujan su celda; mayúsculas igual que minúsculas', () => {
  assert.equal(inkCell('e'), maskOf('e'));
  assert.equal(inkCell('E'), maskOf('e'));
  assert.equal(inkCell('ñ'), maskOf('ñ'));
  assert.equal(inkCell('´'), CAPITAL_SIGN);
  assert.equal(inkCell(' '), 0);
  assert.equal(inkCell('•'), null);
  assert.equal(inkCell('⠑'), maskOf('e')); // braille Unicode
});

test('cellsFromText salta lo que no es braille y junta los espacios', () => {
  assert.deepEqual(cellsFromText('• ´no  sé '), [CAPITAL_SIGN, maskOf('n'), maskOf('o'), 0, maskOf('s'), maskOf('é')]);
});

test('el signo de mayúscula va con su letra', () => {
  const tokens = tokensFromText('´EnzO');
  assert.deepEqual(inputTokens(tokens).map((t) => t.answer), ['E', 'n', 'z', 'o']);
  assert.deepEqual(tokens[0].cells, [CAPITAL_SIGN, maskOf('e')]);
});

test('doble signo de mayúscula: toda la palabra en mayúsculas', () => {
  const tokens = tokenize([CAPITAL_SIGN, CAPITAL_SIGN, maskOf('o'), maskOf('n'), maskOf('c'), maskOf('e'), 0, maskOf('y')]);
  assert.equal(solution(tokens), 'ONCE y');
});

test('signo de número: a–j son dígitos hasta el espacio', () => {
  const tokens = tokenize([NUMBER_SIGN, digitMask(1), digitMask(0), 0, maskOf('a')]);
  assert.equal(solution(tokens), '10 a');
  assert.deepEqual(tokens[0].cells, [NUMBER_SIGN, digitMask(1)]);
});

test('puntuación del cuento', () => {
  assert.equal(solution(tokensFromText('¡´sorprEsa¡ - gritó')), '¡Sorpresa¡ - gritó');
  assert.equal(solution(tokensFromText('"no", ¿tE')), '"no", ¿te');
  assert.equal(inputTokens(tokensFromText('amigos: la')).length, 9);
});

test('celdas que no sé leer quedan como desconocidas y no se escriben', () => {
  const tokens = tokenize([maskFromDots([5]), maskOf('a')]);
  assert.equal(tokens[0].kind, 'unknown');
  assert.equal(inputTokens(tokens).length, 1);
});

test('¿? y ¡! comparten celda: vale cualquiera', () => {
  const [open] = tokensFromText('¿');
  assert.ok(accepts(open, '¿'));
  assert.ok(accepts(open, '?'));
  assert.ok(!accepts(open, '!'));
  const [quote] = tokensFromText('"');
  assert.ok(accepts(quote, '«'));
});

test('checkLine cuenta los fallos; la mayúscula y la tilde importan', () => {
  const tokens = tokensFromText('´Había un');
  assert.deepEqual(checkLine(tokens, [...'Habíaun']), { results: Array(7).fill(true), wrong: 0 });
  const { results, wrong } = checkLine(tokens, [...'habiaun']);
  assert.equal(wrong, 2);
  assert.deepEqual(results, [false, true, true, false, true, true, true]);
  assert.equal(checkLine(tokens, ['H']).wrong, 6); // lo que falta cuenta como fallo
});

const item = (str, x, y, width = str.length * 21) => ({ str, transform: [21, 0, 0, 21, x, y], width, height: 21 });

test('linesFromItems agrupa por altura y ordena de arriba abajo', () => {
  const lines = linesFromItems([
    item('púas', 85, 707), item('´', 85, 740), item('Enzo', 106, 740), item(' ', 190, 740),
    item('El', 211, 740), item('', 85, 707), item('nErviosas', 190, 707),
  ]);
  assert.deepEqual(lines, ['´Enzo El', 'púas nErviosas']);
});
