// Pruebas del cliente LanguageTool con un servidor falso: node test/languagetool.mjs
import fs from 'fs';
import nspell from '../vendor/nspell/nspell.mjs';
import { createChecker, normalizePageText } from '../src/checker.js';
import { extractPages } from '../src/pdftext.js';
import { normalizarServidor, probarServidor, revisarConLT, convertirRespuesta, unirHallazgos } from '../src/languagetool.js';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

let fallas = 0; let n = 0;
const ok = (c, m) => { n++; if (!c) { fallas++; console.log('FALLA: ' + m); } };
const lanza = async (fn, re) => { try { await fn(); return false; } catch (e) { return re.test(e.message); } };

// Direcciones
ok(normalizarServidor('mi-mac.tail1234.ts.net') === 'https://mi-mac.tail1234.ts.net', 'agrega https');
ok(normalizarServidor('https://mi-mac.tail1234.ts.net/v2/check/') === 'https://mi-mac.tail1234.ts.net', 'quita /v2/check');
ok(normalizarServidor('http://localhost:8081') === 'http://localhost:8081', 'localhost permitido');
ok(normalizarServidor('  ') === '', 'vacío desactiva');
ok(await lanza(() => normalizarServidor('https://api.languagetool.org'), /solo se aceptan/), 'rechaza servidores públicos');
ok(await lanza(() => normalizarServidor('http://mi-mac.tail1234.ts.net'), /solo se aceptan/), 'rechaza ts.net sin https');

// Servidor falso con el formato de LanguageTool
const respuesta = (texto) => {
  const matches = [];
  for (const [re, id, cat, issue, rep] of [[/hiba/g, 'MORFOLOGIK_RULE_ES', 'TYPOS', 'misspelling', 'iba'], [/el el/g, 'ES_REPEATEDWORDS', 'GRAMMAR', 'duplication', 'el'], [/supermercado/g, 'SIMULADA', 'GRAMMAR', 'grammar', 'súper']]) {
    for (const m of texto.matchAll(re)) matches.push({ message: `Mensaje ${id}`, replacements: [{ value: rep }], offset: m.index, length: m[0].length, rule: { id, issueType: issue, category: { id: cat } } });
  }
  return { software: { version: '6.8-falso' }, matches };
};
const enviados = [];
const fetchFalso = async (url, op) => {
  enviados.push({ url, op });
  const p = new URLSearchParams(op.body);
  return { ok: true, status: 200, json: async () => respuesta(p.get('text')) };
};
const fetchCaido = async () => { throw new TypeError("Failed to fetch"); };
const fetchLento = (url, op) => new Promise((_, rej) => op.signal.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { name: 'AbortError' }))));
const fetchError = async () => ({ ok: false, status: 500, json: async () => ({}) });

ok((await probarServidor('https://x.ts.net', fetchFalso)).version === '6.8-falso', 'probar: versión');
ok(enviados[0].url === 'https://x.ts.net/v2/check' && new URLSearchParams(enviados[0].op.body).get('language') === 'es', 'probar: POST /v2/check en español');
ok(enviados[0].op.credentials === 'omit', 'no envía cookies');
ok(await lanza(() => probarServidor('https://x.ts.net', fetchLento, 50), /no respondió a tiempo/), 'timeout con mensaje claro');
ok(await lanza(() => probarServidor('https://x.ts.net', fetchError), /respondió 500/), 'error HTTP con mensaje claro');
ok(await lanza(() => probarServidor('https://x.ts.net', fetchCaido), /Mac apagado/), 'sin conexión con mensaje claro');

// Conversión: ignora posiciones fuera del texto
const conv = convertirRespuesta({ matches: [{ offset: 0, length: 4, message: 'm', rule: { id: 'R' } }, { offset: 50, length: 3, rule: {} }] }, 'Hola mundo', 1);
ok(conv.length === 1 && conv[0].palabra === 'Hola' && conv[0].regla === 'lt:R' && conv[0].tipo === 'gramática (LanguageTool)', 'conversión básica');

// Integración con el PDF de prueba
const leer = (r) => fs.readFileSync(new URL(r, import.meta.url));
const checker = createChecker(nspell(leer('../dict/es_CL.aff').toString(), leer('../dict/es_CL.dic').toString()));
const todos = [];
await extractPages(pdfjs, new Uint8Array(leer('./prueba.pdf')), async (pag, texto) => {
  const normal = normalizePageText(texto);
  const local = checker.checkPage(normal, pag);
  const lt = await revisarConLT('https://x.ts.net', normal, pag, fetchFalso);
  todos.push(...unirHallazgos(local, lt.hallazgos));
});
const deLT = todos.filter((h) => h.motor === 'LanguageTool');
ok(deLT.length === 1 && deLT[0].palabra === 'supermercado', `solo se agrega lo nuevo de LanguageTool (obtenido: ${deLT.map((h) => h.palabra)})`);
ok(todos.filter((h) => h.palabra === 'hiba').length === 1, '«hiba» no se duplica (ortografía local + LT)');
ok(todos.filter((h) => h.palabra === 'el el').length === 1, '«el el» no se duplica (misma posición)');
ok(todos.length === 14, `total 13 locales + 1 de LT (obtenido ${todos.length})`);
const p2 = todos.filter((h) => h.pagina === 2).map((h) => h.inicio);
ok(p2.every((v, i) => i === 0 || p2[i - 1] <= v), 'ordenados por posición');

console.log(fallas ? `${fallas} de ${n} pruebas fallaron` : `OK: ${n} pruebas de LanguageTool correctas`);
process.exit(fallas ? 1 : 0);
