import { revisarGramatica } from './grammar.js';

// Núcleo de revisión ortográfica y gramatical. Sin dependencias del navegador:
// se usa igual en el worker y en las pruebas con Node.

// Palabra: letras Unicode, con apóstrofo o guion interno opcional.
const WORD_RE = /\p{L}+(?:['’\-]\p{L}+)*/gu;
// Fragmentos que no se revisan: URLs, correos y rutas.
const SKIP_RE = /(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+|(?:\/[\w.\-]+){2,}/gi;

const CONTEXT_CHARS = 40;

/**
 * Une el texto de una página corrigiendo palabras cortadas con guion
 * al final de línea ("pala-\nbra" -> "palabra").
 */
export function normalizePageText(text) {
  return text
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t]*\n[ \t]*/g, '\n');
}

export function contextAround(text, start, end) {
  const from = Math.max(0, start - CONTEXT_CHARS);
  const to = Math.min(text.length, end + CONTEXT_CHARS);
  const pre = (from > 0 ? '…' : '') + text.slice(from, start);
  const post = text.slice(end, to) + (to < text.length ? '…' : '');
  return {
    antes: pre.replace(/\s+/g, ' '),
    palabra: text.slice(start, end),
    despues: post.replace(/\s+/g, ' '),
  };
}

function maskSkipped(text) {
  // Reemplaza URLs/correos por espacios para conservar las posiciones.
  return text.replace(SKIP_RE, (m) => ' '.repeat(m.length));
}

/**
 * Crea un revisor a partir de una instancia de nspell.
 * opciones.ignorarMayusculas: omite siglas en mayúsculas (OKE, ONT, TMF).
 */
export function createChecker(speller, opciones = {}) {
  const { ignorarMayusculas = true, maxSugerencias = 3, gramatica = true } = opciones;
  const reglasDesactivadas = new Set(opciones.reglasDesactivadas || []);
  const cacheCorrect = new Map();
  const cacheSuggest = new Map();

  function isCorrect(word) {
    if (cacheCorrect.has(word)) return cacheCorrect.get(word);
    let ok = speller.correct(word);
    if (!ok && /[\-'’]/.test(word)) {
      // Compuestos con guion: correcto si cada parte lo es.
      ok = word.split(/[\-'’]/).every((p) => p.length === 0 || speller.correct(p));
    }
    cacheCorrect.set(word, ok);
    return ok;
  }

  function suggest(word) {
    if (cacheSuggest.has(word)) return cacheSuggest.get(word);
    const s = speller.suggest(word).slice(0, maxSugerencias);
    cacheSuggest.set(word, s);
    return s;
  }

  /** Revisa el texto de una página. Devuelve una lista de hallazgos ordenada por posición. */
  function checkPage(rawText, pagina) {
    const text = normalizePageText(rawText);
    const masked = maskSkipped(text);
    const hallazgos = [];
    if (gramatica) {
      for (const g of revisarGramatica(masked, reglasDesactivadas)) {
        hallazgos.push({
          pagina,
          tipo: g.confianza === 'posible' ? 'gramática (posible)' : 'gramática',
          regla: g.regla,
          palabra: text.slice(g.start, g.end).replace(/\s+/g, ' '),
          motivo: g.motivo,
          sugerencias: g.sugerencia ? [g.sugerencia] : [],
          contexto: contextAround(text, g.start, g.end),
          inicio: g.start,
          fin: g.end,
        });
      }
    }
    for (const m of masked.matchAll(WORD_RE)) {
      const word = m[0];
      if (word.length < 2) continue;
      if (ignorarMayusculas && word.length > 1 && word === word.toUpperCase()) continue;
      if (isCorrect(word)) continue;
      const ctx = contextAround(text, m.index, m.index + word.length);
      hallazgos.push({
        pagina,
        tipo: 'ortografía',
        palabra: word,
        motivo: 'Palabra no encontrada en el diccionario es_CL',
        sugerencias: suggest(word),
        contexto: ctx,
        inicio: m.index,
        fin: m.index + word.length,
      });
    }
    // inicio/fin: posición en el texto normalizado de la página (sirve para cruzar con LanguageTool).
    hallazgos.sort((a, b) => a.inicio - b.inicio);
    return hallazgos;
  }

  return { checkPage, isCorrect, suggest };
}
