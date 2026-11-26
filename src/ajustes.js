// Ajustes del usuario: diccionario personal, correcciones ignoradas y reglas desactivadas.
// Lógica pura (sin DOM) para poder probarla con Node. El guardado recibe un "storage"
// compatible con localStorage.

export const CLAVE_STORAGE = 'ojofino.ajustes.v1';
const VERSION = 1;

export function ajustesVacios() {
  return { version: VERSION, diccionario: [], ignoradas: [], reglasDesactivadas: [] };
}

const normalizar = (t) => String(t).toLowerCase().replace(/\s+/g, ' ').trim();

/** Clave que identifica una alarma, independiente de la página y del documento. */
export function claveHallazgo(h) {
  if (h.tipo === 'ortografía') return `orto:${h.palabra}`;
  return `gram:${h.regla || h.tipo}:${normalizar(h.palabra)}`;
}

/**
 * ¿La palabra del diccionario personal acepta lo encontrado en el texto?
 * Igual que Hunspell: una entrada en minúsculas acepta su versión con mayúscula
 * inicial o toda en mayúsculas; una entrada con mayúsculas solo se acepta tal cual.
 */
function aceptaPalabra(entrada, palabra) {
  if (entrada === palabra) return true;
  if (entrada !== entrada.toLowerCase()) return palabra === entrada.toUpperCase();
  const min = palabra.toLowerCase();
  return min === entrada && (palabra === entrada[0].toUpperCase() + entrada.slice(1) || palabra === palabra.toUpperCase());
}

export function enDiccionario(aj, palabra) {
  return aj.diccionario.some((e) => aceptaPalabra(e, palabra));
}

/** Devuelve la entrada de ignoradas que aplica a este hallazgo, o null. */
export function buscarIgnorada(aj, h, docId) {
  const clave = claveHallazgo(h);
  return aj.ignoradas.find((i) => i.clave === clave && (i.alcance === 'siempre' || i.doc === docId)) || null;
}

/**
 * Separa los hallazgos en activos e ignorados según los ajustes.
 * Los que están en el diccionario o pertenecen a reglas desactivadas se omiten sin listarse.
 */
export function filtrar(aj, hallazgos, docId) {
  const desactivadas = new Set(aj.reglasDesactivadas);
  const activos = [];
  const ignorados = [];
  for (const h of hallazgos) {
    if (h.tipo === 'ortografía' && enDiccionario(aj, h.palabra)) continue;
    if (h.regla && desactivadas.has(h.regla)) continue;
    const ig = buscarIgnorada(aj, h, docId);
    if (ig) ignorados.push({ ...h, alcance: ig.alcance });
    else activos.push(h);
  }
  return { activos, ignorados };
}

export function ignorar(aj, h, alcance, docId, nombreDoc = '') {
  if (alcance !== 'siempre' && alcance !== 'documento') throw new Error('Alcance inválido: ' + alcance);
  const clave = claveHallazgo(h);
  const yaExiste = aj.ignoradas.some((i) => i.clave === clave && i.alcance === alcance && (alcance === 'siempre' || i.doc === docId));
  if (yaExiste) return aj;
  const entrada = {
    clave,
    alcance,
    palabra: h.palabra,
    tipo: h.tipo,
    motivo: h.motivo,
    fecha: new Date().toISOString(),
  };
  if (alcance === 'documento') Object.assign(entrada, { doc: docId, nombreDoc });
  return { ...aj, ignoradas: [...aj.ignoradas, entrada] };
}

/** Quita la ignorada que hoy oculta este hallazgo (la de alcance más específico primero). */
export function restaurar(aj, h, docId) {
  const clave = claveHallazgo(h);
  const quitar = (i) => i.clave === clave && (i.alcance === 'siempre' || i.doc === docId);
  return { ...aj, ignoradas: aj.ignoradas.filter((i) => !quitar(i)) };
}

/** Quita una entrada concreta de ignoradas (desde el panel de ajustes). */
export function quitarIgnorada(aj, entrada) {
  return { ...aj, ignoradas: aj.ignoradas.filter((i) => !(i.clave === entrada.clave && i.alcance === entrada.alcance && i.doc === entrada.doc)) };
}

function limpiarPalabra(p) {
  const w = String(p).normalize('NFC').trim();
  return /^\p{L}+(?:['’\-]\p{L}+)*$/u.test(w) ? w : null;
}

export function agregarPalabra(aj, palabra) {
  const w = limpiarPalabra(palabra);
  if (!w || aj.diccionario.includes(w)) return aj;
  const diccionario = [...aj.diccionario, w].sort((a, b) => a.localeCompare(b, 'es'));
  // Si la palabra estaba ignorada como error de ortografía, ya no hace falta.
  const ignoradas = aj.ignoradas.filter((i) => !(i.clave.startsWith('orto:') && aceptaPalabra(w, i.palabra)));
  return { ...aj, diccionario, ignoradas };
}

export function quitarPalabra(aj, palabra) {
  return { ...aj, diccionario: aj.diccionario.filter((w) => w !== palabra) };
}

export function alternarRegla(aj, id, activa) {
  const set = new Set(aj.reglasDesactivadas);
  if (activa) set.delete(id); else set.add(id);
  return { ...aj, reglasDesactivadas: [...set].sort() };
}

// ---------------------------------------------------------------------------
// Exportar / importar

export function diccionarioATexto(aj) {
  return aj.diccionario.join('\n') + (aj.diccionario.length ? '\n' : '');
}

export function respaldoAJson(aj) {
  return JSON.stringify({ app: 'OjoFino', ...aj, exportado: new Date().toISOString() }, null, 2);
}

/**
 * Importa un respaldo (.json) o un diccionario (.txt, una palabra por línea)
 * y lo une con los ajustes actuales. Devuelve { ajustes, resumen }.
 */
export function importar(aj, contenido, nombreArchivo = '') {
  const texto = String(contenido).replace(/^﻿/, '');
  const esJson = /\.json$/i.test(nombreArchivo) || /^\s*\{/.test(texto);
  let nuevo = aj;
  let palabras = 0;
  let ignoradas = 0;
  if (esJson) {
    let datos;
    try { datos = JSON.parse(texto); } catch { throw new Error('El archivo no es un JSON válido.'); }
    if (!datos || typeof datos !== 'object' || datos.app !== 'OjoFino') throw new Error('El archivo no es un respaldo de OjoFino.');
    for (const w of Array.isArray(datos.diccionario) ? datos.diccionario : []) {
      const antes = nuevo.diccionario.length;
      nuevo = agregarPalabra(nuevo, w);
      palabras += nuevo.diccionario.length - antes;
    }
    for (const i of Array.isArray(datos.ignoradas) ? datos.ignoradas : []) {
      if (!i || typeof i.clave !== 'string' || !['siempre', 'documento'].includes(i.alcance)) continue;
      if (nuevo.ignoradas.some((x) => x.clave === i.clave && x.alcance === i.alcance && x.doc === i.doc)) continue;
      const limpio = { clave: i.clave, alcance: i.alcance, palabra: String(i.palabra ?? ''), tipo: String(i.tipo ?? ''), motivo: String(i.motivo ?? ''), fecha: String(i.fecha ?? '') };
      if (i.alcance === 'documento') Object.assign(limpio, { doc: String(i.doc ?? ''), nombreDoc: String(i.nombreDoc ?? '') });
      nuevo = { ...nuevo, ignoradas: [...nuevo.ignoradas, limpio] };
      ignoradas++;
    }
    if (Array.isArray(datos.reglasDesactivadas)) {
      nuevo = { ...nuevo, reglasDesactivadas: [...new Set([...nuevo.reglasDesactivadas, ...datos.reglasDesactivadas.map(String)])].sort() };
    }
  } else {
    for (const linea of texto.split(/\r?\n/)) {
      const antes = nuevo.diccionario.length;
      nuevo = agregarPalabra(nuevo, linea);
      palabras += nuevo.diccionario.length - antes;
    }
  }
  return { ajustes: nuevo, resumen: { palabras, ignoradas } };
}

// ---------------------------------------------------------------------------
// Persistencia (localStorage u otro storage compatible). Nunca lanza errores.

export function cargarAjustes(storage) {
  try {
    const raw = storage && storage.getItem(CLAVE_STORAGE);
    if (!raw) return ajustesVacios();
    const datos = JSON.parse(raw);
    return {
      version: VERSION,
      diccionario: Array.isArray(datos.diccionario) ? datos.diccionario : [],
      ignoradas: Array.isArray(datos.ignoradas) ? datos.ignoradas : [],
      reglasDesactivadas: Array.isArray(datos.reglasDesactivadas) ? datos.reglasDesactivadas : [],
    };
  } catch {
    return ajustesVacios();
  }
}

export function guardarAjustes(storage, aj) {
  try {
    storage.setItem(CLAVE_STORAGE, JSON.stringify(aj));
    return true;
  } catch {
    return false;
  }
}
