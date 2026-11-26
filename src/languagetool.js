// Cliente del servidor LanguageTool propio (en el Mac, vía Tailscale).
// Sin DOM: recibe `fetch` como parámetro para poder probarlo con Node.
import { contextAround } from './checker.js';

export const IDIOMA = 'es';
export const TIMEOUT_MS = 10_000;

/**
 * Valida y normaliza la dirección del servidor. Solo se aceptan direcciones de la
 * red privada de Tailscale (https://….ts.net) o del propio equipo (localhost).
 * Devuelve '' si está vacía; lanza Error si no es válida.
 */
export function normalizarServidor(texto) {
  let t = String(texto || '').trim();
  if (!t) return '';
  if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
  let url;
  try { url = new URL(t); } catch { throw new Error('La dirección no es válida.'); }
  const host = url.hostname.toLowerCase();
  const esTailscale = url.protocol === 'https:' && host.endsWith('.ts.net');
  const esLocal = host === 'localhost' || host === '127.0.0.1';
  if (!esTailscale && !esLocal) {
    throw new Error('Por privacidad solo se aceptan direcciones https://….ts.net (Tailscale) o localhost.');
  }
  const ruta = url.pathname.replace(/\/+$/, '').replace(/\/v2(\/check)?$/, '');
  return `${url.protocol}//${url.host}${ruta}`;
}

async function pedir(fetchFn, servidor, texto, timeoutMs) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetchFn(`${servidor}/v2/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text: texto, language: IDIOMA }).toString(),
      signal: control.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}.`);
    return await r.json();
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('El servidor no respondió a tiempo.');
    // Chrome dice "Failed to fetch" y Safari "Load failed": no hubo conexión.
    if (err instanceof TypeError) throw new Error('No hubo conexión con el servidor (¿Mac apagado, dormido o sin Tailscale?).');
    throw err;
  } finally {
    clearTimeout(reloj);
  }
}

/** Comprueba la conexión. Devuelve { version } o lanza Error con un mensaje claro. */
export async function probarServidor(servidor, fetchFn = fetch, timeoutMs = TIMEOUT_MS) {
  let datos;
  try {
    datos = await pedir(fetchFn, servidor, 'Esto es una prueba.', timeoutMs);
  } catch (err) {
    throw new Error(`No se pudo conectar con LanguageTool: ${err.message || err}`);
  }
  if (!datos || !Array.isArray(datos.matches)) throw new Error('La respuesta no parece de LanguageTool.');
  return { version: (datos.software && datos.software.version) || '?' };
}

function esOrtografia(m) {
  const r = m.rule || {};
  return r.issueType === 'misspelling' || (r.category && r.category.id === 'TYPOS');
}

/** Convierte la respuesta de LanguageTool en hallazgos con el mismo formato que el motor local. */
export function convertirRespuesta(datos, textoNormalizado, pagina) {
  const out = [];
  for (const m of (datos && datos.matches) || []) {
    const inicio = m.offset;
    const fin = m.offset + m.length;
    if (!(inicio >= 0 && fin > inicio && fin <= textoNormalizado.length)) continue;
    const rule = m.rule || {};
    const orto = esOrtografia(m);
    out.push({
      pagina,
      tipo: orto ? 'ortografía' : 'gramática (LanguageTool)',
      motor: 'LanguageTool',
      regla: orto ? undefined : `lt:${rule.id || 'regla'}`,
      palabra: textoNormalizado.slice(inicio, fin).replace(/\s+/g, ' '),
      motivo: (m.message || rule.description || 'Posible error').replace(/\s+/g, ' ').trim(),
      sugerencias: (m.replacements || []).slice(0, 3).map((x) => x.value).filter(Boolean),
      contexto: contextAround(textoNormalizado, inicio, fin),
      inicio,
      fin,
    });
  }
  return out;
}

/**
 * Une los hallazgos locales con los de LanguageTool sin repetir:
 * se descarta el de LanguageTool si se solapa con uno local de ortografía siendo
 * también de ortografía, o si empieza en la misma posición que uno local.
 */
export function unirHallazgos(locales, deLT) {
  const extra = deLT.filter((lt) => !locales.some((l) => {
    const solapa = lt.inicio < l.fin && l.inicio < lt.fin;
    if (!solapa) return false;
    if (lt.tipo === 'ortografía' && l.tipo === 'ortografía') return true;
    return lt.inicio === l.inicio;
  }));
  return [...locales, ...extra].sort((a, b) => a.inicio - b.inicio || (a.motor ? 1 : -1));
}

export async function revisarConLT(servidor, textoNormalizado, pagina, fetchFn = fetch, timeoutMs = TIMEOUT_MS) {
  const datos = await pedir(fetchFn, servidor, textoNormalizado, timeoutMs);
  return { hallazgos: convertirRespuesta(datos, textoNormalizado, pagina), version: datos.software && datos.software.version };
}
