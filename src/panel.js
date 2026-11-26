// Panel "Mis ajustes": diccionario personal, ignoradas, reglas y respaldo.
import { REGLAS } from './grammar.js';
import {
  agregarPalabra, quitarPalabra, quitarIgnorada, alternarRegla,
  diccionarioATexto, respaldoAJson, importar, fijarServidorLT,
} from './ajustes.js';
import { normalizarServidor, probarServidor } from './languagetool.js';

const el = (tag, props = {}, ...hijos) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...hijos);
  return n;
};

function fechaArchivo() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function crearPanelAjustes({ obtener, cambiar, guardarArchivo, avisar }) {
  const capa = el('div', { className: 'panel', hidden: true });
  capa.innerHTML = `
    <div class="panel-barra">
      <h2>Mis ajustes</h2>
      <button type="button" data-accion="cerrar">Cerrar</button>
    </div>
    <div class="panel-cuerpo">
      <p class="panel-aviso" role="status"></p>
      <section>
        <h3>Diccionario personal <span data-n="dic"></span></h3>
        <p class="ayuda">Palabras que siempre se consideran bien escritas. Una entrada en minúsculas también acepta mayúscula inicial.</p>
        <form data-form="agregar" class="fila-form">
          <input type="text" name="palabra" placeholder="Agregar palabra" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Palabra nueva">
          <button type="submit" class="mini">Agregar</button>
        </form>
        <ul data-lista="dic" class="lista"></ul>
      </section>
      <section>
        <h3>Ignoradas <span data-n="ign"></span></h3>
        <p class="ayuda">Alarmas que no quieres volver a ver. Al restaurarlas vuelven a aparecer.</p>
        <ul data-lista="ign" class="lista"></ul>
      </section>
      <section>
        <h3>Reglas de gramática</h3>
        <ul data-lista="reglas" class="lista reglas"></ul>
      </section>
      <section>
        <h3>LanguageTool (opcional)</h3>
        <p class="ayuda">Servidor propio en tu Mac, accesible por Tailscale (https://…ts.net). Déjalo vacío para usar solo el motor local.</p>
        <form data-form="lt" class="fila-form">
          <input type="url" name="servidor" placeholder="https://mi-mac.tu-red.ts.net" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Dirección del servidor LanguageTool">
          <button type="submit" class="mini">Guardar</button>
          <button type="button" class="mini" data-accion="probar-lt">Probar conexión</button>
        </form>
        <p class="ayuda" data-estado-lt></p>
      </section>
      <section>
        <h3>Respaldo</h3>
        <p class="ayuda">Los ajustes se guardan solo en este dispositivo. Exporta un respaldo de vez en cuando.</p>
        <div class="fila-botones">
          <button type="button" class="mini" data-accion="exp-txt">Exportar diccionario (.txt)</button>
          <button type="button" class="mini" data-accion="exp-json">Exportar respaldo completo (.json)</button>
          <label class="mini boton-archivo">Importar (.json o .txt)
            <input type="file" accept=".json,.txt,application/json,text/plain" data-importar hidden>
          </label>
        </div>
      </section>
    </div>`;
  document.body.append(capa);

  const q = (s) => capa.querySelector(s);
  const aviso = (t) => { q('.panel-aviso').textContent = t; avisar(t); };

  function dibujar(aj) {
    q('[data-n="dic"]').textContent = `(${aj.diccionario.length})`;
    q('[data-n="ign"]').textContent = `(${aj.ignoradas.length})`;

    const dic = q('[data-lista="dic"]');
    dic.replaceChildren(...(aj.diccionario.length
      ? aj.diccionario.map((w) => el('li', {}, el('span', { textContent: w }),
          el('button', { type: 'button', className: 'mini sutil', textContent: 'Quitar', onclick: () => cambiar(quitarPalabra(obtener(), w)) })))
      : [el('li', { className: 'vacio', textContent: 'Sin palabras todavía.' })]));

    const ign = q('[data-lista="ign"]');
    ign.replaceChildren(...(aj.ignoradas.length
      ? aj.ignoradas.map((i) => el('li', {},
          el('span', {},
            el('strong', { textContent: i.palabra }),
            ` · ${i.tipo} · `,
            i.alcance === 'siempre' ? 'siempre' : `solo en “${i.nombreDoc || 'un documento'}”`),
          el('button', { type: 'button', className: 'mini sutil', textContent: 'Restaurar', onclick: () => cambiar(quitarIgnorada(obtener(), i)) })))
      : [el('li', { className: 'vacio', textContent: 'No hay alarmas ignoradas.' })]));

    const campoLT = q('[data-form="lt"] input');
    if (document.activeElement !== campoLT) campoLT.value = aj.servidorLT || '';

    const desactivadas = new Set(aj.reglasDesactivadas);
    q('[data-lista="reglas"]').replaceChildren(...REGLAS.map((r) => {
      const check = el('input', { type: 'checkbox', checked: !desactivadas.has(r.id) });
      check.addEventListener('change', () => cambiar(alternarRegla(obtener(), r.id, check.checked)));
      return el('li', {}, el('label', {}, check, ` ${r.nombre}`, r.confianza === 'posible' ? el('small', { textContent: ' (posible)' }) : ''));
    }));
  }

  q('[data-form="agregar"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.elements.palabra;
    const antes = obtener();
    const nuevo = agregarPalabra(antes, input.value);
    if (nuevo === antes) { aviso(input.value.trim() ? 'Palabra no válida o ya existente.' : ''); return; }
    input.value = '';
    cambiar(nuevo);
  });

  const estadoLT = (t) => { q('[data-estado-lt]').textContent = t; };
  function leerServidor() {
    try {
      return normalizarServidor(q('[data-form="lt"] input').value);
    } catch (err) {
      estadoLT(err.message);
      return null;
    }
  }
  q('[data-form="lt"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = leerServidor();
    if (url === null) return;
    cambiar(fijarServidorLT(obtener(), url));
    q('[data-form="lt"] input').value = url;
    estadoLT(url ? 'Guardado. Las próximas revisiones usarán LanguageTool.' : 'Sin servidor: se usa solo el motor local.');
  });

  capa.addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    const enc = new TextEncoder();
    if (accion === 'cerrar') cerrar();
    else if (accion === 'probar-lt') {
      const url = leerServidor();
      if (!url) { if (url === '') estadoLT('Escribe primero la dirección del servidor.'); return; }
      estadoLT('Probando…');
      try {
        const { version } = await probarServidor(url);
        estadoLT(`Conectado: LanguageTool ${version}.`);
      } catch (err) {
        estadoLT(err.message);
      }
    }
    else if (accion === 'exp-txt') {
      await guardarArchivo(enc.encode(diccionarioATexto(obtener())), `ojofino-diccionario-${fechaArchivo()}.txt`, 'text/plain');
    } else if (accion === 'exp-json') {
      await guardarArchivo(enc.encode(respaldoAJson(obtener())), `ojofino-respaldo-${fechaArchivo()}.json`, 'application/json');
    }
  });

  q('[data-importar]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { ajustes, resumen } = importar(obtener(), await file.text(), file.name);
      cambiar(ajustes);
      aviso(`Importado: ${resumen.palabras} palabras nuevas y ${resumen.ignoradas} ignoradas.`);
    } catch (err) {
      aviso('No se pudo importar: ' + err.message);
    }
  });

  function cerrar() {
    capa.hidden = true;
    document.body.classList.remove('sin-scroll');
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !capa.hidden) cerrar(); });

  return {
    abrir() { q('.panel-aviso').textContent = ''; estadoLT(''); dibujar(obtener()); capa.hidden = false; document.body.classList.add('sin-scroll'); },
    actualizar(aj) { if (!capa.hidden) dibujar(aj); },
    cerrar,
  };
}
