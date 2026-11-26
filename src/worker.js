// Worker de revisión: carga el diccionario una vez y revisa páginas
// sin bloquear la interfaz.
import nspell from '../vendor/nspell/nspell.mjs';
import { createChecker } from './checker.js';

let checker = null;
let speller = null;
let agregadas = new Set();

async function init() {
  const [aff, dic] = await Promise.all([
    fetch('../dict/es_CL.aff').then((r) => r.text()),
    fetch('../dict/es_CL.dic').then((r) => r.text()),
  ]);
  const t0 = performance.now();
  speller = nspell(aff, dic);
  checker = createChecker(speller);
  return Math.round(performance.now() - t0);
}

self.onmessage = async (e) => {
  const { tipo, id } = e.data;
  try {
    if (tipo === 'init') {
      const ms = await init();
      self.postMessage({ tipo: 'listo', id, ms });
    } else if (tipo === 'diccionario') {
      // Sincroniza el diccionario personal: mejora las sugerencias y las revisiones siguientes.
      const nuevas = new Set(e.data.palabras);
      for (const w of agregadas) if (!nuevas.has(w)) speller.remove(w);
      for (const w of nuevas) if (!agregadas.has(w)) speller.add(w);
      agregadas = nuevas;
      checker = createChecker(speller); // limpia la caché de resultados
      self.postMessage({ tipo: 'ok', id });
    } else if (tipo === 'pagina') {
      const hallazgos = checker.checkPage(e.data.texto, e.data.pagina);
      self.postMessage({ tipo: 'resultado', id, pagina: e.data.pagina, hallazgos });
    }
  } catch (err) {
    self.postMessage({ tipo: 'error', id, mensaje: String(err && err.message || err) });
  }
};
