// Prueba de la fase 1 con Node: node test/prueba.mjs [archivo.pdf]
import fs from 'fs';
import nspell from '../vendor/nspell/nspell.mjs';
import { createChecker } from '../src/checker.js';
import { extractPages } from '../src/pdftext.js';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const archivo = process.argv[2] || new URL('./prueba.pdf', import.meta.url);
const t0 = Date.now();
const checker = createChecker(nspell(fs.readFileSync(new URL('../dict/es_CL.aff', import.meta.url), 'utf8'),
                                     fs.readFileSync(new URL('../dict/es_CL.dic', import.meta.url), 'utf8')));
console.log(`Diccionario: ${Date.now() - t0} ms`);
const hallazgos = [];
await extractPages(pdfjs, new Uint8Array(fs.readFileSync(archivo)), (n, texto) => {
  hallazgos.push(...checker.checkPage(texto, n));
});
for (const h of hallazgos) console.log(`p.${h.pagina}  ${h.palabra}  →  ${h.sugerencias.join(', ') || '—'}  | ${h.contexto.antes}[${h.contexto.palabra}]${h.contexto.despues}`);
// iPad aparece porque no está en el diccionario: se resolverá con el diccionario personal (fase 4).
const esperado = ['prueva', 'aplicacion', 'iPad', 'hiba'];
const encontrados = hallazgos.map((h) => h.palabra);
const ok = esperado.every((w) => encontrados.includes(w)) && encontrados.length === esperado.length;
console.log(ok ? 'OK: se detectaron exactamente los errores esperados' : `FALLA: esperado ${esperado}, obtenido ${encontrados}`);
process.exit(ok ? 0 : 1);
