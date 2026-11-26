// Service worker de OjoFino: guarda la app para que funcione sin internet.
// VERSION y ARCHIVOS los genera tools/generar-sw.mjs (no editar a mano).
const VERSION = '678adee4caa2';
const ARCHIVOS = [
  './',
  'dict/es_CL.aff',
  'dict/es_CL.dic',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icono-192.png',
  'icons/icono-512.png',
  'icons/icono-maskable-512.png',
  'index.html',
  'manifest.webmanifest',
  'src/actualizacion.js',
  'src/ajustes.js',
  'src/app.js',
  'src/checker.js',
  'src/grammar.js',
  'src/languagetool.js',
  'src/panel.js',
  'src/pdftext.js',
  'src/report.js',
  'src/viewer.js',
  'src/worker.js',
  'styles.css',
  'vendor/jspdf/jspdf.mjs',
  'vendor/nspell/nspell.mjs',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
  'vendor/pdfjs/standard_fonts/LiberationSans-Bold.ttf',
  'vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf',
];
const CACHE = `ojofino-${VERSION}`;

self.addEventListener('install', (e) => {
  // No se activa solo: la app pregunta antes de actualizar (ver src/actualizacion.js).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('ojofino-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Solo archivos propios. Las consultas a LanguageTool (otro origen) pasan directo.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)),
  );
});
