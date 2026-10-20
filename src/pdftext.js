// Texto de un PDF, línea a línea, con pdf.js (en vendor/, se carga solo al usarlo).

const PDFJS = '../vendor/pdfjs/pdf.min.mjs';
const WORKER = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

// Agrupa los trozos de texto de una página en líneas, de arriba abajo y de izquierda a derecha.
// Puro: recibe los `items` de pdf.js ({ str, transform, width, height }).
export function linesFromItems(items) {
  const pieces = items
    .filter((item) => item.str)
    .map((item) => ({
      str: item.str, x: item.transform[4], y: item.transform[5],
      width: item.width, size: Math.abs(item.transform[3]) || item.height || 10,
    }));
  pieces.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const piece of pieces) {
    const row = rows.at(-1);
    if (row && Math.abs(row.y - piece.y) < piece.size * 0.4) row.pieces.push(piece);
    else rows.push({ y: piece.y, pieces: [piece] });
  }
  return rows.map((row) => {
    row.pieces.sort((a, b) => a.x - b.x);
    let text = '';
    let end = null;
    for (const piece of row.pieces) {
      // Hueco visible sin espacio en el texto: es un espacio.
      const charWidth = piece.width / Math.max([...piece.str].length, 1);
      if (end !== null && piece.x - end > charWidth * 0.5 && !/\s$/.test(text) && !/^\s/.test(piece.str)) {
        text += ' ';
      }
      text += piece.str;
      end = piece.x + piece.width;
    }
    return text.replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

// [{ page, text }] de todo el documento.
export async function readPdfLines(file) {
  const pdfjs = await import(PDFJS);
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const { items } = await page.getTextContent();
      for (const text of linesFromItems(items)) lines.push({ page: p, text });
    }
  } finally {
    doc.destroy();
  }
  return lines;
}
