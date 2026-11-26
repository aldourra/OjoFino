// Worker de revisión: carga el diccionario una vez y revisa páginas
// sin bloquear la interfaz.
import nspell from '../vendor/nspell/nspell.mjs';
import { createChecker } from './checker.js';

let checker = null;

async function init() {
  const [aff, dic] = await Promise.all([
    fetch('../dict/es_CL.aff').then((r) => r.text()),
    fetch('../dict/es_CL.dic').then((r) => r.text()),
  ]);
  const t0 = performance.now();
  checker = createChecker(nspell(aff, dic));
  return Math.round(performance.now() - t0);
}

self.onmessage = async (e) => {
  const { tipo, id } = e.data;
  try {
    if (tipo === 'init') {
      const ms = await init();
      self.postMessage({ tipo: 'listo', id, ms });
    } else if (tipo === 'pagina') {
      const hallazgos = checker.checkPage(e.data.texto, e.data.pagina);
      self.postMessage({ tipo: 'resultado', id, pagina: e.data.pagina, hallazgos });
    }
  } catch (err) {
    self.postMessage({ tipo: 'error', id, mensaje: String(err && err.message || err) });
  }
};
