// Prueba del informe: node test/informe.mjs [salida.pdf]
// Revisa test/prueba.pdf, genera el informe y lo vuelve a leer con pdf.js.
import fs from 'fs';
import nspell from '../vendor/nspell/nspell.mjs';
import { jsPDF, autoTable } from '../vendor/jspdf/jspdf.mjs';
import { createChecker } from '../src/checker.js';
import { extractPages } from '../src/pdftext.js';
import { crearInforme, aBase64 } from '../src/report.js';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const leer = (r) => fs.readFileSync(new URL(r, import.meta.url));
const checker = createChecker(nspell(leer('../dict/es_CL.aff').toString(), leer('../dict/es_CL.dic').toString()));
const hallazgos = [];
const paginas = await extractPages(pdfjs, new Uint8Array(leer('./prueba.pdf')), (n, t) => { hallazgos.push(...checker.checkPage(t, n)); });

const fuentes = {
  regular: aBase64(leer('../vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf')),
  bold: aBase64(leer('../vendor/pdfjs/standard_fonts/LiberationSans-Bold.ttf')),
};
const doc = crearInforme(jsPDF, autoTable, { archivo: 'prueba.pdf', fecha: new Date(2026, 10, 26, 17, 45), paginas, hallazgos }, fuentes);
const bytes = new Uint8Array(doc.output('arraybuffer'));
const salida = process.argv[2];
if (salida) fs.writeFileSync(salida, bytes);

// Releer el informe
let texto = '';
await extractPages(pdfjs, bytes.slice(), (n, t) => { texto += `\n[[${n}]]\n` + t; });
const plano = texto.replace(/\s+/g, ' ');
const fallas = [];
for (const h of hallazgos) if (!plano.includes(h.palabra)) fallas.push(`falta «${h.palabra}»`);
for (const esperado of ['OjoFino: informe de revisión', 'Archivo: prueba.pdf', '26-11-2026 17:45', 'Páginas: 2',
  '13 posibles errores: 4 de ortografía, 7 de gramática y 2 de gramática (posible).',
  'Palabras no reconocidas más frecuentes', 'Página 1 de', 'el documento no salió del dispositivo']) {
  if (!plano.includes(esperado)) fallas.push(`falta el texto «${esperado}»`);
}
// Informe vacío
const vacio = crearInforme(jsPDF, autoTable, { archivo: 'limpio.pdf', paginas: 1, hallazgos: [] }); // sin fuentes: Helvetica
let tv = '';
await extractPages(pdfjs, new Uint8Array(vacio.output('arraybuffer')), (n, t) => { tv += t; });
if (!tv.includes('No se encontraron errores.')) fallas.push('el informe vacío no dice «No se encontraron errores.»');

console.log(fallas.length ? 'FALLA\n  ' + fallas.join('\n  ') : `OK: informe con ${hallazgos.length} hallazgos verificado (${bytes.length} bytes)`);
process.exit(fallas.length ? 1 : 0);
