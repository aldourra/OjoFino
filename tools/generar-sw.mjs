// Genera la lista de archivos que el service worker guarda para funcionar sin internet,
// y una versión calculada a partir de su contenido. Uso: node tools/generar-sw.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Archivos y carpetas que forman la app publicada (lo mismo que copia el workflow de GitHub Pages).
export const PUBLICADOS = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'icons', 'src', 'vendor', 'dict'];
const NO_CACHEAR = new Set(['sw.js', 'icons/icono.svg']);

function listar(rel) {
  const abs = path.join(RAIZ, rel);
  if (fs.statSync(abs).isDirectory()) return fs.readdirSync(abs).sort().flatMap((f) => listar(path.posix.join(rel, f)));
  return [rel];
}

export function archivosApp() {
  return PUBLICADOS.flatMap(listar).filter((f) => !NO_CACHEAR.has(f) && !/(^|\/)LICENSE/.test(f)).sort();
}

export function generar() {
  const archivos = archivosApp();
  const hash = crypto.createHash('sha256');
  for (const f of archivos) hash.update(f).update(fs.readFileSync(path.join(RAIZ, f)));
  const version = hash.digest('hex').slice(0, 12);
  const sw = path.join(RAIZ, 'sw.js');
  const actual = fs.readFileSync(sw, 'utf8');
  const lista = ['./', ...archivos].map((f) => `  '${f}',`).join('\n');
  const nuevo = actual
    .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
    .replace(/const ARCHIVOS = \[[\s\S]*?\n\];/, `const ARCHIVOS = [\n${lista}\n];`);
  fs.writeFileSync(sw, nuevo);
  return { version, archivos };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const { version, archivos } = generar();
  console.log(`sw.js actualizado: versión ${version}, ${archivos.length} archivos`);
}
