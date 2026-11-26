import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';
import { extractPages } from './pdftext.js';
import { normalizePageText } from './checker.js';
import { revisarConLT, unirHallazgos } from './languagetool.js';
import { jsPDF, autoTable } from '../vendor/jspdf/jspdf.mjs';
import { crearInforme, nombreInforme, aBase64, etiquetaTipo } from './report.js';
import { crearVisor, guardarArchivo } from './viewer.js';
import {
  cargarAjustes, guardarAjustes, filtrar, ignorar, restaurar, agregarPalabra,
} from './ajustes.js';
import { crearPanelAjustes } from './panel.js';
import { iniciarModoSinConexion } from './actualizacion.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const $ = (s) => document.querySelector(s);
const estado = $('#estado');
const entrada = $('#archivo');
const tabla = $('#resultados tbody');
const resumen = $('#resumen');
const acciones = $('#acciones');
const seccionIgnoradas = $('#ignoradas');
const tablaIgnoradas = $('#tabla-ignoradas tbody');

function setEstado(texto) { estado.textContent = texto; }

// ---------------------------------------------------------------------------
// Ajustes (diccionario personal, ignoradas, reglas). Se guardan en este dispositivo.
let ajustes = cargarAjustes(globalThis.localStorage);

function cambiarAjustes(nuevos) {
  const cambioDiccionario = nuevos.diccionario !== ajustes.diccionario;
  ajustes = nuevos;
  if (!guardarAjustes(globalThis.localStorage, ajustes)) {
    setEstado('Aviso: no se pudieron guardar los ajustes en este navegador. Exporta un respaldo.');
  }
  if (cambioDiccionario) llamar({ tipo: 'diccionario', palabras: ajustes.diccionario }).catch(() => {});
  render();
  panel.actualizar(ajustes);
}

// ---------------------------------------------------------------------------
// Worker de revisión
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

// ---------------------------------------------------------------------------
// Último resultado: vive solo en memoria mientras la app está abierta.
let ultimo = null; // { archivo, docId, fecha, paginas, motores, hallazgos }

function vista() {
  return ultimo ? filtrar(ajustes, ultimo.hallazgos, ultimo.docId) : { activos: [], ignorados: [] };
}

function boton(texto, clase, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = clase;
  b.textContent = texto;
  b.addEventListener('click', onClick);
  return b;
}

function celdaAcciones(h) {
  const td = document.createElement('td');
  const caja = document.createElement('div');
  caja.className = 'acciones-fila';
  td.append(caja);
  const normal = () => {
    caja.replaceChildren();
    if (h.tipo === 'ortografía') {
      caja.append(boton('+ Diccionario', 'mini', () => cambiarAjustes(agregarPalabra(ajustes, h.palabra))));
    }
    caja.append(boton('Ignorar', 'mini', elegir));
  };
  const elegir = () => {
    caja.replaceChildren(
      boton('Solo en este documento', 'mini', () => cambiarAjustes(ignorar(ajustes, h, 'documento', ultimo.docId, ultimo.archivo))),
      boton('Siempre', 'mini', () => cambiarAjustes(ignorar(ajustes, h, 'siempre', ultimo.docId, ultimo.archivo))),
      boton('Cancelar', 'mini sutil', normal),
    );
  };
  normal();
  return td;
}

function fila(h) {
  const tr = document.createElement('tr');
  const celdas = [String(h.pagina), h.palabra, etiquetaTipo(h), h.motivo, null, h.sugerencias.length ? h.sugerencias.join(', ') : '—'];
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
  tr.append(celdaAcciones(h));
  return tr;
}

function filaIgnorada(h) {
  const tr = document.createElement('tr');
  for (const c of [String(h.pagina), h.palabra, etiquetaTipo(h), h.motivo, h.alcance === 'siempre' ? 'Siempre' : 'Este documento']) {
    const td = document.createElement('td');
    td.textContent = c;
    tr.append(td);
  }
  const td = document.createElement('td');
  td.append(boton('Restaurar', 'mini', () => cambiarAjustes(restaurar(ajustes, h, ultimo.docId))));
  tr.append(td);
  return tr;
}

function render() {
  if (!ultimo) return;
  const { activos, ignorados } = vista();
  tabla.replaceChildren(...activos.map(fila));
  tablaIgnoradas.replaceChildren(...ignorados.map(filaIgnorada));
  seccionIgnoradas.hidden = ignorados.length === 0;
  $('#n-ignoradas').textContent = String(ignorados.length);
  const nota = ignorados.length ? ` (${ignorados.length} ignorada${ignorados.length === 1 ? '' : 's'})` : '';
  resumen.textContent = activos.length
    ? `${activos.length} posibles errores en “${ultimo.archivo}”${nota}.`
    : `No se encontraron errores en “${ultimo.archivo}”${nota}.`;
}

// ---------------------------------------------------------------------------
// Informe
let fuentes = null;
Promise.all(['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf'].map((f) =>
  fetch(new URL(`../vendor/pdfjs/standard_fonts/${f}`, import.meta.url)).then((r) => r.arrayBuffer())))
  .then(([regular, bold]) => { fuentes = { regular: aBase64(regular), bold: aBase64(bold) }; })
  .catch(() => { fuentes = null; }); // sin ellas se usa Helvetica estándar

function bytesInforme() {
  const { activos, ignorados } = vista();
  const doc = crearInforme(jsPDF, autoTable, { ...ultimo, hallazgos: activos, ignorados }, fuentes);
  return new Uint8Array(doc.output('arraybuffer'));
}

async function guardarInforme() {
  if (!ultimo) return;
  const r = await guardarArchivo(bytesInforme(), nombreInforme(ultimo.archivo), 'application/pdf');
  if (r === 'descargado') setEstado('Informe descargado.');
  else if (r === 'compartido') setEstado('Informe compartido.');
}

const visor = crearVisor(pdfjsLib, { onGuardar: guardarInforme });
$('#ver-informe').addEventListener('click', () => {
  if (ultimo) visor.abrir(bytesInforme()).catch((err) => setEstado('No se pudo mostrar el informe: ' + err.message));
});
$('#guardar-informe').addEventListener('click', guardarInforme);

// ---------------------------------------------------------------------------
// Panel de ajustes
const panel = crearPanelAjustes({
  obtener: () => ajustes,
  cambiar: cambiarAjustes,
  guardarArchivo,
  avisar: setEstado,
});
$('#abrir-ajustes').addEventListener('click', () => panel.abrir());

// ---------------------------------------------------------------------------
// Revisión
async function idDocumento(data, file) {
  // Huella del contenido, calculada en el dispositivo: reconoce el PDF aunque cambie de nombre.
  try {
    const hash = await crypto.subtle.digest('SHA-256', data);
    return 'sha256:' + [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `archivo:${file.name}:${file.size}`;
  }
}

// Uso sin internet + aviso de versión nueva (no se actualiza a mitad de una revisión).
let revisando = false;
iniciarModoSinConexion({ ocupado: () => revisando });

const listo = llamar({ tipo: 'init' })
  .then(async (r) => {
    if (ajustes.diccionario.length) await llamar({ tipo: 'diccionario', palabras: ajustes.diccionario });
    setEstado(`Diccionario cargado (${r.ms} ms). Elige un PDF.`);
    entrada.disabled = false;
  })
  .catch((err) => setEstado('No se pudo cargar el diccionario: ' + err.message));

entrada.addEventListener('change', async () => {
  const file = entrada.files[0];
  if (!file) return;
  await listo;
  tabla.replaceChildren();
  tablaIgnoradas.replaceChildren();
  seccionIgnoradas.hidden = true;
  resumen.textContent = '';
  acciones.hidden = true;
  ultimo = null;
  const todos = [];
  entrada.disabled = true;
  revisando = true;
  const t0 = performance.now();
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const docId = await idDocumento(data, file);
    // LanguageTool (opcional): si falla una vez, se sigue solo con el motor local.
    const servidor = ajustes.servidorLT;
    let ltActivo = Boolean(servidor);
    let ltVersion = '';
    let ltPaginas = 0;
    let ltError = '';
    const paginas = await extractPages(pdfjsLib, data, async (n, texto, tot) => {
      setEstado(`Revisando página ${n} de ${tot}${ltActivo ? ' (con LanguageTool)' : ''}…`);
      const normal = normalizePageText(texto);
      const [local, lt] = await Promise.all([
        llamar({ tipo: 'pagina', pagina: n, texto: normal }),
        ltActivo
          ? revisarConLT(servidor, normal, n).catch((err) => { ltActivo = false; ltError = err.message || String(err); return null; })
          : null,
      ]);
      if (lt) { ltPaginas++; ltVersion = lt.version || ltVersion; }
      todos.push(...(lt ? unirHallazgos(local.hallazgos, lt.hallazgos) : local.hallazgos));
    });
    const seg = ((performance.now() - t0) / 1000).toFixed(1);
    const motores = ['local'];
    if (servidor) {
      if (ltPaginas === paginas) motores.push(`LanguageTool${ltVersion ? ' ' + ltVersion : ''}`);
      else if (ltPaginas > 0) motores.push(`LanguageTool (solo ${ltPaginas} de ${paginas} páginas)`);
      else motores.push('LanguageTool no disponible');
    }
    ultimo = { archivo: file.name, docId, fecha: new Date(), paginas, motores, hallazgos: todos };
    render();
    acciones.hidden = false;
    setEstado(`Listo: ${paginas} páginas en ${seg} s. Motor: ${motores.join(' + ')}.` + (ltError ? ` ${ltError}` : ''));
  } catch (err) {
    setEstado('Error al leer el PDF: ' + err.message);
  } finally {
    revisando = false;
    entrada.disabled = false;
    entrada.value = '';
  }
});
