// Extracción de texto por página con pdf.js. Todo ocurre en el dispositivo.

/**
 * Convierte el contenido de texto de pdf.js en una cadena con saltos de línea.
 */
export function textContentToString(content) {
  let out = '';
  for (const item of content.items) {
    if (!('str' in item)) continue;
    out += item.str;
    if (item.hasEOL) out += '\n';
    else if (item.str && !item.str.endsWith(' ')) out += ' ';
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
