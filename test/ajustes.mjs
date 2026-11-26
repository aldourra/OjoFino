// Pruebas del diccionario personal e ignoradas: node test/ajustes.mjs
import {
  ajustesVacios, filtrar, ignorar, restaurar, agregarPalabra, quitarPalabra, quitarIgnorada,
  alternarRegla, importar, respaldoAJson, diccionarioATexto, cargarAjustes, guardarAjustes, enDiccionario,
} from '../src/ajustes.js';

let fallas = 0;
let n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fallas++; console.log('FALLA: ' + msg); } };
const palabras = (lista) => lista.map((h) => h.palabra).join(',');

const H = [
  { pagina: 1, tipo: 'ortografía', palabra: 'iPad', motivo: 'm' },
  { pagina: 2, tipo: 'ortografía', palabra: 'iPad', motivo: 'm' },
  { pagina: 1, tipo: 'ortografía', palabra: 'prueva', motivo: 'm' },
  { pagina: 2, tipo: 'gramática (posible)', regla: 'concordancia', palabra: 'los  casa', motivo: 'm' },
  { pagina: 3, tipo: 'gramática', regla: 'repetida', palabra: 'el el', motivo: 'm' },
  { pagina: 1, tipo: 'ortografía', palabra: 'kubernetes', motivo: 'm' },
  { pagina: 1, tipo: 'ortografía', palabra: 'Kubernetes', motivo: 'm' },
];
const DOC_A = 'sha256:aaa';
const DOC_B = 'sha256:bbb';

// Sin ajustes: todo activo
let aj = ajustesVacios();
ok(filtrar(aj, H, DOC_A).activos.length === H.length, 'sin ajustes todo debe estar activo');

// Ignorar solo en este documento: oculta todas las apariciones en ese doc, no en otro
aj = ignorar(aj, H[0], 'documento', DOC_A, 'a.pdf');
let r = filtrar(aj, H, DOC_A);
ok(palabras(r.ignorados) === 'iPad,iPad', 'documento: oculta las dos apariciones de iPad en A');
ok(r.ignorados.every((h) => h.alcance === 'documento'), 'documento: alcance marcado');
ok(filtrar(aj, H, DOC_B).ignorados.length === 0, 'documento: no afecta al documento B');
ok(ignorar(aj, H[1], 'documento', DOC_A) === aj, 'ignorar dos veces lo mismo no duplica');

// Ignorar siempre una regla de gramática para ese texto (normaliza espacios y mayúsculas)
aj = ignorar(aj, H[3], 'siempre', DOC_A, 'a.pdf');
ok(filtrar(aj, [{ ...H[3], palabra: 'Los casa' }], DOC_B).ignorados.length === 1, 'siempre: aplica en otro doc y normaliza el texto');
ok(filtrar(aj, [{ ...H[3], regla: 'otra' }], DOC_B).ignorados.length === 0, 'siempre: depende de la regla');

// Restaurar
aj = restaurar(aj, H[0], DOC_A);
ok(filtrar(aj, H, DOC_A).ignorados.every((h) => h.palabra !== 'iPad'), 'restaurar devuelve iPad');
aj = quitarIgnorada(aj, aj.ignoradas[0]);
ok(aj.ignoradas.length === 0, 'quitarIgnorada desde el panel');

// Diccionario personal
aj = agregarPalabra(aj, 'iPad');
aj = agregarPalabra(aj, 'kubernetes');
aj = agregarPalabra(aj, '  ');
aj = agregarPalabra(aj, 'dos palabras');
aj = agregarPalabra(aj, 'iPad');
ok(aj.diccionario.join(',') === 'iPad,kubernetes', 'diccionario: solo palabras válidas y sin duplicados');
r = filtrar(aj, H, DOC_A);
ok(palabras(r.activos) === 'prueva,los  casa,el el', 'diccionario: oculta iPad, kubernetes y Kubernetes');
ok(r.ignorados.length === 0, 'diccionario: no aparece en ignoradas');
ok(enDiccionario(aj, 'KUBERNETES') && !enDiccionario(aj, 'ipad') && enDiccionario(aj, 'IPAD'), 'diccionario: reglas de mayúsculas tipo Hunspell');
// Agregar al diccionario limpia ignoradas de ortografía de esa palabra
let aj2 = ignorar(ajustesVacios(), H[2], 'siempre', DOC_A);
aj2 = agregarPalabra(aj2, 'prueva');
ok(aj2.ignoradas.length === 0, 'agregar al diccionario quita la ignorada de esa palabra');
aj = quitarPalabra(aj, 'kubernetes');
ok(filtrar(aj, H, DOC_A).activos.some((h) => h.palabra === 'Kubernetes'), 'quitar palabra la vuelve a mostrar');

// Reglas desactivadas
aj = alternarRegla(aj, 'repetida', false);
ok(!filtrar(aj, H, DOC_A).activos.some((h) => h.regla === 'repetida'), 'regla desactivada se oculta');
aj = alternarRegla(aj, 'repetida', true);
ok(filtrar(aj, H, DOC_A).activos.some((h) => h.regla === 'repetida'), 'regla reactivada vuelve');

// Exportar / importar
aj = ignorar(aj, H[4], 'documento', DOC_B, 'b.pdf');
aj = alternarRegla(aj, 'concordancia', false);
const json = respaldoAJson(aj);
const imp = importar(ajustesVacios(), json, 'respaldo.json');
ok(JSON.stringify(imp.ajustes.diccionario) === JSON.stringify(aj.diccionario), 'json: diccionario');
ok(imp.ajustes.ignoradas.length === 1 && imp.ajustes.ignoradas[0].doc === DOC_B, 'json: ignoradas con documento');
ok(imp.ajustes.reglasDesactivadas.includes('concordancia'), 'json: reglas');
ok(importar(aj, json, 'r.json').resumen.palabras === 0, 'json: importar dos veces no duplica');
const txt = importar(ajustesVacios(), 'OKE\r\nONT\n\n  Schaman  \nmal palabra\n', 'dic.txt');
ok(txt.ajustes.diccionario.join(',') === 'OKE,ONT,Schaman' && txt.resumen.palabras === 3, 'txt: una palabra por línea');
ok(diccionarioATexto(txt.ajustes) === 'OKE\nONT\nSchaman\n', 'txt: exportar');
let error = '';
try { importar(aj, '{"otra":"app"}', 'x.json'); } catch (e) { error = e.message; }
ok(/no es un respaldo de OjoFino/.test(error), 'json ajeno se rechaza');

// Persistencia
const mem = new Map();
const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
ok(guardarAjustes(storage, aj), 'guardar');
ok(JSON.stringify(cargarAjustes(storage)) === JSON.stringify(aj), 'cargar devuelve lo guardado');
ok(cargarAjustes({ getItem: () => '{roto' }).diccionario.length === 0, 'datos dañados: ajustes vacíos');
ok(!guardarAjustes({ setItem: () => { throw new Error('lleno'); } }, aj), 'error al guardar no rompe');

console.log(fallas ? `${fallas} de ${n} pruebas fallaron` : `OK: ${n} pruebas de ajustes correctas`);
process.exit(fallas ? 1 : 0);
