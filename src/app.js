import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';
import { extractPages } from './pdftext.js';
import { jsPDF, autoTable } from '../vendor/jspdf/jspdf.mjs';
import { crearInforme, nombreInforme, aBase64 } from './report.js';
import { crearVisor, guardarPdf } from './viewer.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const $ = (s) => document.querySelector(s);
const estado = $('#estado');
const entrada = $('#archivo');
const tabla = $('#resultados tbody');
const resumen = $('#resumen');
const acciones = $('#acciones');

// Último resultado: vive solo en memoria mientras la app está abierta.
let ultimo = null;

// Fuentes que se incrustan en el informe (las mismas que usa pdf.js). Se cargan al inicio
// para que generar el informe sea instantáneo y el menú de compartir funcione en Safari.
let fuentes = null;
Promise.all(['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf'].map((f) =>
  fetch(new URL(`../vendor/pdfjs/standard_fonts/${f}`, import.meta.url)).then((r) => r.arrayBuffer())))
  .then(([regular, bold]) => { fuentes = { regular: aBase64(regular), bold: aBase64(bold) }; })
  .catch(() => { fuentes = null; }); // sin ellas se usa Helvetica estándar

function bytesInforme() {
  const doc = crearInforme(jsPDF, autoTable, ultimo, fuentes);
  return new Uint8Array(doc.output('arraybuffer'));
}

async function guardarInforme() {
  if (!ultimo) return;
  const r = await guardarPdf(bytesInforme(), nombreInforme(ultimo.archivo));
  if (r === 'descargado') setEstado('Informe descargado.');
  else if (r === 'compartido') setEstado('Informe compartido.');
}

const visor = crearVisor(pdfjsLib, { onGuardar: guardarInforme });
$('#ver-informe').addEventListener('click', () => {
  if (ultimo) visor.abrir(bytesInforme()).catch((err) => setEstado('No se pudo mostrar el informe: ' + err.message));
});
$('#guardar-informe').addEventListener('click', guardarInforme);

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
  acciones.hidden = true;
  ultimo = null;
  const todos = [];
  entrada.disabled = true;
  const t0 = performance.now();
  let total = 0;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const paginas = await extractPages(pdfjsLib, data, async (n, texto, tot) => {
      setEstado(`Revisando página ${n} de ${tot}…`);
      const r = await llamar({ tipo: 'pagina', pagina: n, texto });
      r.hallazgos.forEach((h) => { tabla.append(fila(h)); todos.push(h); });
      total += r.hallazgos.length;
    });
    const seg = ((performance.now() - t0) / 1000).toFixed(1);
    ultimo = { archivo: file.name, fecha: new Date(), paginas, motores: ['local'], hallazgos: todos };
    acciones.hidden = false;
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
