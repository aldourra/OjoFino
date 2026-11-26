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
for (const h of hallazgos) console.log(`p.${h.pagina}  [${h.tipo}${h.regla ? ':' + h.regla : ''}]  ${h.palabra}  →  ${h.sugerencias.join(', ') || '—'}  | ${h.motivo}`);
// iPad aparece porque no está en el diccionario: se resolverá con el diccionario personal (fase 4).
const esperado = [
  'p1 ortografía prueva', 'p1 ortografía aplicacion', 'p1 ortografía iPad',
  'p2 ortografía hiba',
  'p2 repetida', 'p2 contraccion', 'p2 interrogacion', 'p2 interrogativos', 'p2 haber',
  'p2 mayuscula', 'p2 parentesis', 'p2 tildes-contexto', 'p2 concordancia',
];
const obtenido = hallazgos.map((h) => h.regla ? `p${h.pagina} ${h.regla}` : `p${h.pagina} ortografía ${h.palabra}`);
const faltan = esperado.filter((e) => !obtenido.includes(e));
const sobran = obtenido.filter((o) => !esperado.includes(o));
const ok = faltan.length === 0 && sobran.length === 0;
console.log(ok ? `OK: ${obtenido.length} hallazgos, exactamente los esperados`
  : `FALLA\n  faltan: ${faltan.join(' | ') || '—'}\n  sobran: ${sobran.join(' | ') || '—'}`);
process.exit(ok ? 0 : 1);
