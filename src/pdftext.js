// Extracción de texto por página con pdf.js. Todo ocurre en el dispositivo.

/**
 * Convierte el contenido de texto de pdf.js en una cadena con saltos de línea.
 */
export function textContentToString(content) {
  // Decide si hay espacio entre dos fragmentos según su distancia real en la
  // página: muchos PDF parten palabras o separan la puntuación en fragmentos
  // distintos, y agregar siempre un espacio crearía errores falsos.
  let out = '';
  let prev = null;
  let finDeLinea = true;
  for (const item of content.items) {
    if (!('str' in item)) continue;
    if (item.str === '') {
      if (item.hasEOL && !out.endsWith('\n')) { out += '\n'; finDeLinea = true; }
      continue;
    }
    if (prev && !finDeLinea) {
      const alto = item.height || prev.height || 10;
      const mismaLinea = Math.abs(item.transform[5] - prev.transform[5]) < alto * 0.5;
      if (!mismaLinea) {
        out += '\n';
      } else {
        const hueco = item.transform[4] - (prev.transform[4] + prev.width);
        if (hueco > alto * 0.15 && !out.endsWith(' ') && !item.str.startsWith(' ')) out += ' ';
      }
    }
    out += item.str;
    finDeLinea = !!item.hasEOL;
    if (finDeLinea) out += '\n';
    prev = item;
  }
  return out;
}

/**
 * Recorre las páginas de un PDF y llama a onPage(numero, texto, total).
 * @param pdfjsLib  módulo pdf.js ya cargado
 * @param data      Uint8Array con el PDF
 */
export async function extractPages(pdfjsLib, data, onPage) {
  const doc = await pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    disableAutoFetch: true,
    useSystemFonts: false,
    verbosity: 0, // solo errores; se extrae texto, no se dibujan fuentes
  }).promise;
  const total = doc.numPages;
  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    await onPage(n, textContentToString(content), total);
    page.cleanup();
  }
  await doc.destroy();
  return total;
}
