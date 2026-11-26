import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';
import { extractPages } from './pdftext.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const $ = (s) => document.querySelector(s);
const estado = $('#estado');
const entrada = $('#archivo');
const tabla = $('#resultados tbody');
const resumen = $('#resumen');

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let seq = 0;
const pendientes = new Map();

function llamar(msg) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pendientes.set(id, { resolve, reject });
    worker.postMessage({ ...msg, id });
  });
}

worker.onmessage = (e) => {
  const p = pendientes.get(e.data.id);
  if (!p) return;
  pendientes.delete(e.data.id);
  if (e.data.tipo === 'error') p.reject(new Error(e.data.mensaje));
  else p.resolve(e.data);
};

function setEstado(texto) { estado.textContent = texto; }

function fila(h) {
  const tr = document.createElement('tr');
  const celdas = [
    String(h.pagina),
    h.palabra,
    h.tipo,
    h.motivo,
    null,
    h.sugerencias.length ? h.sugerencias.join(', ') : '—',
  ];
  celdas.forEach((c, i) => {
    const td = document.createElement('td');
    if (i === 4) {
      td.append(h.contexto.antes);
      const mark = document.createElement('mark');
      mark.textContent = h.contexto.palabra;
      td.append(mark, h.contexto.despues);
    } else {
      td.textContent = c;
    }
    tr.append(td);
  });
  return tr;
}

const listo = llamar({ tipo: 'init' })
  .then((r) => { setEstado(`Diccionario cargado (${r.ms} ms). Elige un PDF.`); entrada.disabled = false; })
  .catch((err) => setEstado('No se pudo cargar el diccionario: ' + err.message));

entrada.addEventListener('change', async () => {
  const file = entrada.files[0];
  if (!file) return;
  await listo;
  tabla.replaceChildren();
  resumen.textContent = '';
  entrada.disabled = true;
  const t0 = performance.now();
  let total = 0;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const paginas = await extractPages(pdfjsLib, data, async (n, texto, tot) => {
      setEstado(`Revisando página ${n} de ${tot}…`);
      const r = await llamar({ tipo: 'pagina', pagina: n, texto });
      r.hallazgos.forEach((h) => tabla.append(fila(h)));
      total += r.hallazgos.length;
    });
    const seg = ((performance.now() - t0) / 1000).toFixed(1);
    setEstado(`Listo: ${paginas} páginas en ${seg} s.`);
    resumen.textContent = total
      ? `${total} posibles errores en “${file.name}”.`
      : `No se encontraron errores en “${file.name}”.`;
  } catch (err) {
    setEstado('Error al leer el PDF: ' + err.message);
  } finally {
    entrada.disabled = false;
    entrada.value = '';
  }
});
