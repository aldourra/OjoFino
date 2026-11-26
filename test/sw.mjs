// Verifica que el service worker incluya todos los archivos de la app: node test/sw.mjs
import fs from 'fs';
import { archivosApp } from '../tools/generar-sw.mjs';
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const lista = [...sw.match(/const ARCHIVOS = \[([\s\S]*?)\n\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const fallas = [];
for (const f of archivosApp()) if (!lista.includes(f)) fallas.push(`falta en sw.js: ${f}`);
for (const f of lista) if (f !== './' && !fs.existsSync(new URL('../' + f, import.meta.url))) fallas.push(`no existe: ${f}`);
for (const f of ['./', 'index.html', 'src/app.js', 'src/worker.js', 'vendor/pdfjs/pdf.worker.min.mjs', 'dict/es_CL.dic', 'vendor/pdfjs/standard_fonts/LiberationSans-Bold.ttf']) {
  if (!lista.includes(f)) fallas.push(`archivo esencial sin guardar: ${f}`);
}
if (/const VERSION = 'dev'/.test(sw)) fallas.push('sw.js sin versión: ejecuta npm run sw');
console.log(fallas.length ? 'FALLA\n  ' + fallas.join('\n  ') : `OK: service worker con ${lista.length} archivos`);
process.exit(fallas.length ? 1 : 0);
