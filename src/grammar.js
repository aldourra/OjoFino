// Reglas de gramática locales, sin IA. Cada regla recibe el texto de una página
// (ya normalizado y con URLs/correos enmascarados) y devuelve coincidencias:
//   { start, end, motivo, sugerencia }
// confianza: 'alta' (casi nunca se equivoca) o 'posible' (puede dar falsas alarmas).

const L = '\\p{L}';
const NO_L_ANTES = `(?<!${L})`;
const NO_L_DESPUES = `(?!${L})`;

function re(src, flags = 'gu') { return new RegExp(src, flags); }

function* coincidencias(regex, text) {
  regex.lastIndex = 0;
  for (const m of text.matchAll(regex)) yield m;
}

function conservarMayuscula(original, reemplazo) {
  return original[0] === original[0].toUpperCase()
    ? reemplazo[0].toUpperCase() + reemplazo.slice(1)
    : reemplazo;
}

// Abreviaturas comunes tras las que el punto no cierra la oración.
const ABREVIATURAS = new Set([
  'etc', 'sr', 'sra', 'srta', 'sres', 'dr', 'dra', 'ej', 'pág', 'págs', 'pag', 'núm', 'nro', 'art',
  'aprox', 'av', 'avda', 'cap', 'tel', 'ud', 'uds', 'vd', 'vs', 'máx', 'mín', 'depto', 'dpto',
  'cía', 'ltda', 'ing', 'lic', 'prof', 'gral', 'adj', 'obs', 'fig', 'vol', 'ed', 'op', 'cit',
  'inc', 'admin', 'coord', 'pbro', 'mr', 'mrs',
]);

// ---------------------------------------------------------------------------
// 1. Palabra repetida: "el el informe"
const RE_REPETIDA = re(`${NO_L_ANTES}(${L}+)[ \\t]*\\n?[ \\t]*(\\1)${NO_L_DESPUES}`, 'giu');
function palabraRepetida(text) {
  const out = [];
  for (const m of coincidencias(RE_REPETIDA, text)) {
    if (/^\d+$/.test(m[1])) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      motivo: `Palabra repetida: «${m[1]}»`,
      sugerencia: m[1],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Signos de interrogación y exclamación de apertura y cierre
const VENTANA_PREGUNTA = 400; // caracteres máximos entre ¿ y ?

function palabraJunto(text, pos, haciaAtras) {
  // Devuelve [start, end] que incluye el signo y la palabra vecina.
  if (haciaAtras) {
    let i = pos;
    while (i > 0 && /\s/.test(text[i - 1])) i--;
    while (i > 0 && /\p{L}/u.test(text[i - 1])) i--;
    return [i, pos + 1];
  }
  let j = pos + 1;
  while (j < text.length && /\s/.test(text[j])) j++;
  while (j < text.length && /\p{L}/u.test(text[j])) j++;
  return [pos, j];
}

function signosPareados(apertura, cierre, nombre) {
  return function (text) {
    const out = [];
    let abierto = -1;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === apertura) {
        if (abierto >= 0) {
          const [s, e] = palabraJunto(text, abierto, false);
          out.push({ start: s, end: e, motivo: `Falta el signo de cierre «${cierre}» de ${nombre}`, sugerencia: '' });
        }
        abierto = i;
      } else if (c === cierre) {
        // Ignora "(?)" o "(!)" y operadores como "!=".
        if (text[i - 1] === '(' && text[i + 1] === ')') continue;
        if (cierre === '!' && text[i + 1] === '=') continue;
        if (abierto >= 0 && i - abierto <= VENTANA_PREGUNTA) {
          abierto = -1;
        } else {
          if (abierto >= 0) {
            const [s, e] = palabraJunto(text, abierto, false);
            out.push({ start: s, end: e, motivo: `Falta el signo de cierre «${cierre}» de ${nombre}`, sugerencia: '' });
            abierto = -1;
          }
          // Si cierra una serie de signos (??, ?!) ya se reportó el primero.
          if (text[i - 1] === cierre) continue;
          const [s, e] = palabraJunto(text, i, true);
          out.push({ start: s, end: e, motivo: `Falta el signo de apertura «${apertura}» de ${nombre}`, sugerencia: '' });
        }
      }
    }
    if (abierto >= 0) {
      const [s, e] = palabraJunto(text, abierto, false);
      out.push({ start: s, end: e, motivo: `Falta el signo de cierre «${cierre}» de ${nombre}`, sugerencia: '' });
    }
    return out;
  };
}

// ---------------------------------------------------------------------------
// 3. Paréntesis y comillas sin cerrar
function parentesisYComillas(text) {
  const out = [];
  const pila = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') pila.push(i);
    else if (c === ')') {
      if (pila.length) { pila.pop(); continue; }
      // Ignora numeraciones de lista: "a)", "1)", "iv)" al inicio de línea.
      const linea = text.slice(text.lastIndexOf('\n', i - 1) + 1, i);
      if (/^\s*[\p{L}\d]{1,4}$/u.test(linea)) continue;
      out.push({ start: i, end: i + 1, motivo: 'Paréntesis de cierre sin apertura', sugerencia: '' });
    }
  }
  for (const i of pila) {
    const [s, e] = palabraJunto(text, i, false);
    out.push({ start: s, end: e, motivo: 'Paréntesis sin cerrar', sugerencia: '' });
  }
  for (const [a, b, nombre] of [['“', '”', 'comillas'], ['«', '»', 'comillas angulares']]) {
    let abierto = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === a) {
        if (abierto >= 0) {
          const [s, e] = palabraJunto(text, abierto, false);
          out.push({ start: s, end: e, motivo: `${nombre[0].toUpperCase() + nombre.slice(1)} sin cerrar`, sugerencia: '' });
        }
        abierto = i;
      } else if (text[i] === b) {
        if (abierto >= 0) abierto = -1;
        else out.push({ start: i, end: i + 1, motivo: `Cierre de ${nombre} sin apertura`, sugerencia: '' });
      }
    }
    if (abierto >= 0) {
      const [s, e] = palabraJunto(text, abierto, false);
      out.push({ start: s, end: e, motivo: `${nombre[0].toUpperCase() + nombre.slice(1)} sin cerrar`, sugerencia: '' });
    }
  }
  // Comillas rectas: si quedan impares, marca la última.
  const rectas = [...text.matchAll(/"/g)].map((m) => m.index);
  if (rectas.length % 2 === 1) {
    const i = rectas[rectas.length - 1];
    out.push({ start: i, end: i + 1, motivo: 'Comillas rectas sin pareja', sugerencia: '' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Mayúscula después de punto, ? o !
const RE_TRAS_PUNTO = /([.?!])(["”»)]?)(\s+)(\p{Ll}\p{L}*)/gu;
function mayusculaTrasPunto(text) {
  const out = [];
  for (const m of coincidencias(RE_TRAS_PUNTO, text)) {
    const signo = m[1];
    const iSigno = m.index;
    const palabra = m[4];
    const inicioPalabra = m.index + m[0].length - palabra.length;
    if (signo === '.') {
      if (text[iSigno - 1] === '.' || text[iSigno + 1] === '.') continue; // puntos suspensivos
      const antes = text.slice(Math.max(0, iSigno - 12), iSigno);
      const previa = (antes.match(/(\p{L}+)$/u) || [])[1];
      if (!previa) continue;                                  // número u otro símbolo: "3. el"
      if (previa.length === 1) continue;                      // iniciales y "p. ej."
      if (ABREVIATURAS.has(previa.toLowerCase())) continue;
      if (/\p{Lu}\.\p{Lu}$/u.test(antes + '.')) continue;     // siglas con puntos: "S.A."
    } else {
      // Tras ? o ! se permite minúscula si sigue otra pregunta/exclamación: "¿Quién? ¿de dónde?"
      const resto = text.slice(inicioPalabra - m[3].length - (m[2] ? 1 : 0), inicioPalabra);
      if (/[¿¡]/.test(resto)) continue;
    }
    out.push({
      start: inicioPalabra,
      end: inicioPalabra + palabra.length,
      motivo: `Debe ir en mayúscula después de «${signo}»`,
      sugerencia: palabra[0].toUpperCase() + palabra.slice(1),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. Espacios mal puestos junto a signos de puntuación
const RE_ESPACIO_ANTES = /(\p{L})([ \t]+)([,;:]|\.(?!\.))(?=\s|$)/gu;
const RE_SIN_ESPACIO_COMA = /(\p{L})([,;])(\p{L})/gu;
const RE_SIN_ESPACIO_PUNTO = /(\p{Ll}{2,})\.(\p{Lu}\p{Ll}+)/gu;
function espacios(text) {
  const out = [];
  for (const m of coincidencias(RE_ESPACIO_ANTES, text)) {
    const s = m.index + 1;
    out.push({ start: m.index, end: s + m[2].length + m[3].length, motivo: `Sobra el espacio antes de «${m[3]}»`, sugerencia: m[1] + m[3] });
  }
  for (const m of coincidencias(RE_SIN_ESPACIO_COMA, text)) {
    out.push({ start: m.index, end: m.index + 3, motivo: `Falta un espacio después de «${m[2]}»`, sugerencia: `${m[1]}${m[2]} ${m[3]}` });
  }
  for (const m of coincidencias(RE_SIN_ESPACIO_PUNTO, text)) {
    out.push({ start: m.index, end: m.index + m[0].length, motivo: 'Falta un espacio después del punto', sugerencia: `${m[1]}. ${m[2]}` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. "de el" -> "del", "a el" -> "al" (respeta nombres propios: "El Mercurio")
const RE_CONTRACCION = re(`${NO_L_ANTES}([Dd]e|[Aa])\\s+el${NO_L_DESPUES}`);
function contracciones(text) {
  const out = [];
  for (const m of coincidencias(RE_CONTRACCION, text)) {
    const sug = conservarMayuscula(m[1], m[1].toLowerCase() === 'de' ? 'del' : 'al');
    out.push({ start: m.index, end: m.index + m[0].length, motivo: `«${m[0]}» se contrae en «${sug}»`, sugerencia: sug });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 7. Confusiones frecuentes con "haber"
const RE_HABER_SI = re(`${NO_L_ANTES}haber\\s+si${NO_L_DESPUES}`, 'giu');
const RE_VA_HABER = re(`${NO_L_ANTES}(va|van|vas|voy|vamos|iba|iban|ibas|íbamos)\\s+haber${NO_L_DESPUES}`, 'giu');
function confusionesHaber(text) {
  const out = [];
  for (const m of coincidencias(RE_HABER_SI, text)) {
    out.push({ start: m.index, end: m.index + m[0].length, motivo: '«haber si» se escribe «a ver si»', sugerencia: conservarMayuscula(m[0], 'a ver si') });
  }
  for (const m of coincidencias(RE_VA_HABER, text)) {
    out.push({ start: m.index, end: m.index + m[0].length, motivo: `Falta la preposición «a»: «${m[1]} a haber»`, sugerencia: `${m[1]} a haber` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 8. Tilde en interrogativos y exclamativos: "¿que" -> "¿qué"
const INTERROGATIVOS = {
  que: 'qué', como: 'cómo', donde: 'dónde', adonde: 'adónde', cuando: 'cuándo', quien: 'quién',
  quienes: 'quiénes', cual: 'cuál', cuales: 'cuáles', cuanto: 'cuánto', cuanta: 'cuánta',
  cuantos: 'cuántos', cuantas: 'cuántas',
};
const RE_INTERROGATIVO = re(`([¿¡])\\s*(por\\s+)?(${Object.keys(INTERROGATIVOS).join('|')})${NO_L_DESPUES}`, 'giu');
function tildeInterrogativos(text) {
  const out = [];
  for (const m of coincidencias(RE_INTERROGATIVO, text)) {
    const palabra = m[3];
    const sug = conservarMayuscula(palabra, INTERROGATIVOS[palabra.toLowerCase()]);
    const start = m.index + m[0].length - palabra.length;
    out.push({ start, end: start + palabra.length, motivo: `En preguntas y exclamaciones lleva tilde: «${sug}»`, sugerencia: sug });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 9. (posible) Tildes según el contexto
const RE_MAS = re(`${NO_L_ANTES}((?:lo|el|la|los|las)\\s+)(mas)${NO_L_DESPUES}`, 'giu');
const RE_MAS_QUE = re(`${NO_L_ANTES}(mas)(\\s+(?:que|de)${NO_L_DESPUES})`, 'giu');
const VERBOS_TU = 'eres|estás|estas|tienes|puedes|sabes|vas|quieres|haces|dices|crees|piensas|necesitas|debes|sientes|serás|fuiste|mismo|misma';
const RE_TU = re(`${NO_L_ANTES}(tu)(\\s+(?:${VERBOS_TU})${NO_L_DESPUES})`, 'giu');
const RE_EL = re(`${NO_L_ANTES}((?:para|de|con|por|sin|a|según|entre|contra|hacia|ante|sobre|que)\\s+)(el)(\\s*[.,;:?!)])`, 'gu');
function tildesContexto(text) {
  const out = [];
  const add = (m, iPal, pal, sug, motivo) => {
    const start = m.index + iPal;
    out.push({ start, end: start + pal.length, motivo, sugerencia: conservarMayuscula(pal, sug) });
  };
  for (const m of coincidencias(RE_MAS, text)) add(m, m[1].length, m[2], 'más', 'Probablemente es «más» (cantidad), con tilde');
  for (const m of coincidencias(RE_MAS_QUE, text)) add(m, 0, m[1], 'más', 'Probablemente es «más» (cantidad), con tilde');
  for (const m of coincidencias(RE_TU, text)) add(m, 0, m[1], 'tú', 'Si es pronombre personal, lleva tilde: «tú»');
  for (const m of coincidencias(RE_EL, text)) add(m, m[1].length, m[2], 'él', 'Si es pronombre personal, lleva tilde: «él»');
  return out;
}

// ---------------------------------------------------------------------------
// 10. (posible) Concordancia de número: determinante plural + palabra singular
const DET_PLURALES = 'los|las|unos|unas|estos|estas|esos|esas|aquellos|aquellas|mis|tus|sus|nuestros|nuestras|vuestros|vuestras|muchos|muchas|varios|varias|algunos|algunas|ciertos|ciertas|otros|otras|todos|todas';
const RE_CONCORDANCIA = re(`${NO_L_ANTES}(${DET_PLURALES})(\\s+)(${L}+)${NO_L_DESPUES}`, 'giu');
// Palabras que pueden seguir a un determinante plural sin terminar en -s.
const SIGUIENTES_VALIDAS = new Set([
  'que', 'de', 'del', 'cual', 'cuyo', 'cuya', 'y', 'e', 'o', 'u', 'a', 'en', 'con', 'por', 'para',
  'cinco', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'quince', 'veinte', 'treinta', 'cuarenta',
  'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien', 'ciento', 'mil', 'millón',
  'veintiuno', 'demás', 'mismo', 'misma', 'hay', 'he', 'ha', 'han', 'cuales', 'cuantos', 'cuantas',
]);
function concordanciaNumero(text) {
  const out = [];
  for (const m of coincidencias(RE_CONCORDANCIA, text)) {
    const pal = m[3];
    const min = pal.toLowerCase();
    if (/[sxz]$/.test(min)) continue;                // plural o invariable (crisis, tórax, lápiz)
    if (pal === pal.toUpperCase()) continue;          // siglas: "los PDF"
    if (/\p{Lu}/u.test(pal.slice(1))) continue;        // nombres de producto: "iPad"
    if (SIGUIENTES_VALIDAS.has(min)) continue;
    // "todos/todas" seguido de artículo o demostrativo ya está cubierto por la siguiente palabra
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      motivo: `Posible falta de concordancia: «${m[1]}» es plural y «${pal}» parece singular`,
      sugerencia: '',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
export const REGLAS = [
  { id: 'repetida', nombre: 'Palabra repetida', confianza: 'alta', buscar: palabraRepetida },
  { id: 'interrogacion', nombre: 'Signos ¿?', confianza: 'alta', buscar: signosPareados('¿', '?', 'interrogación') },
  { id: 'exclamacion', nombre: 'Signos ¡!', confianza: 'alta', buscar: signosPareados('¡', '!', 'exclamación') },
  { id: 'parentesis', nombre: 'Paréntesis y comillas', confianza: 'alta', buscar: parentesisYComillas },
  { id: 'mayuscula', nombre: 'Mayúscula tras punto', confianza: 'alta', buscar: mayusculaTrasPunto },
  { id: 'espacios', nombre: 'Espacios y puntuación', confianza: 'alta', buscar: espacios },
  { id: 'contraccion', nombre: 'del / al', confianza: 'alta', buscar: contracciones },
  { id: 'haber', nombre: 'a ver / haber', confianza: 'alta', buscar: confusionesHaber },
  { id: 'interrogativos', nombre: 'Tilde en interrogativos', confianza: 'alta', buscar: tildeInterrogativos },
  { id: 'tildes-contexto', nombre: 'Tildes según contexto', confianza: 'posible', buscar: tildesContexto },
  { id: 'concordancia', nombre: 'Concordancia de número', confianza: 'posible', buscar: concordanciaNumero },
];

/**
 * Aplica las reglas activas. desactivadas: Set de ids a omitir (para la fase 4).
 */
export function revisarGramatica(text, desactivadas = new Set()) {
  const out = [];
  for (const regla of REGLAS) {
    if (desactivadas.has(regla.id)) continue;
    for (const h of regla.buscar(text)) out.push({ ...h, regla: regla.id, confianza: regla.confianza });
  }
  return out;
}
