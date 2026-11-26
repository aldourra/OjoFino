// Pruebas de las reglas de gramática: node test/gramatica.mjs
// "marca": frases que deben generar al menos un hallazgo de esa regla.
// "no marca": frases correctas que NO deben generar hallazgos de esa regla.
import { REGLAS } from '../src/grammar.js';

const CASOS = {
  repetida: {
    marca: ['Revisé el el informe.', 'Que que pasó.'],
    noMarca: ['Revisé el informe.', 'Pasó en 2020 2021.'],
  },
  interrogacion: {
    marca: ['¿Vienes mañana.', 'Vienes mañana?', '¿Qué hora es? ¿Llegas'],
    noMarca: ['¿Vienes mañana?', 'Dijo: ¿de verdad? Sí.', 'El valor (?) no cuadra.', '¿Quién es? ¿de dónde viene?'],
  },
  exclamacion: {
    marca: ['¡Qué bien.', 'Qué bien!'],
    noMarca: ['¡Qué bien!', 'Si a != b, falla.'],
  },
  parentesis: {
    marca: ['El valor (sin cerrar es alto.', 'Esto no cierra) bien.', 'Dijo “hola y se fue.', 'Dijo "hola y se fue.'],
    noMarca: ['El valor (cerrado) es alto.', 'a) primera opción', '1) paso uno', 'Dijo “hola” y se fue.', 'Dijo "hola" y se fue.'],
  },
  mayuscula: {
    marca: ['Terminó el día. luego salió.', '¿Vienes? claro que sí.'],
    noMarca: ['Compró pan, leche, etc. y volvió.', 'Habló con el Sr. pérez.', 'Ver p. ej. el anexo.', 'Esperó... y nada.',
      'La versión 3.5 funciona.', 'Trabaja en Datos S.A. desde enero.', '¿Quién? ¿de dónde?'],
  },
  espacios: {
    marca: ['Hola , mundo.', 'Hola,mundo.', 'Fin del día.Luego salió.', 'Sí ; claro.'],
    noMarca: ['Hola, mundo.', 'Pesa 3,5 kilos.', 'Y entonces...', 'Fin del día. Luego salió.'],
  },
  contraccion: {
    marca: ['Salió de el edificio.', 'Fue a el centro.', 'De el resto no sé.'],
    noMarca: ['Salió del edificio.', 'Lo leyó en El Mercurio.', 'Habló de él.', 'Fue a El Quisco.'],
  },
  haber: {
    marca: ['Haber si vienes.', 'Mañana va haber reunión.', 'Voy haber qué pasa.'],
    noMarca: ['A ver si vienes.', 'Mañana va a haber reunión.', 'Debe haber sido él.'],
  },
  interrogativos: {
    marca: ['¿Que hora es?', '¿Como estás?', '¿Por que no viniste?', '¡Que bien!', '¿Donde quedó?'],
    noMarca: ['¿Qué hora es?', 'Dijo que vendría.', 'Lo hizo como pudo.', '¿Es verdad que vienes?'],
  },
  'tildes-contexto': {
    marca: ['Es lo mas importante.', 'Quiero mas de eso.', 'Tu eres el mejor.', 'Esto es para el.'],
    noMarca: ['Es lo más importante.', 'Tu casa es grande.', 'Esto es para él.', 'Esto es para el equipo.'],
  },
  concordancia: {
    marca: ['Revisamos los casa del barrio.', 'Tuvimos unas problema serio.'],
    noMarca: ['Revisamos las casas.', 'Las crisis pasan.', 'Los que vinieron.', 'Los cinco llegaron.',
      'Compré los PDF.', 'Usamos los iPad.', 'Todos los días.', 'Los lunes.'],
  },
};

let fallas = 0;
let total = 0;
for (const regla of REGLAS) {
  const casos = CASOS[regla.id];
  if (!casos) { console.log(`SIN PRUEBAS: ${regla.id}`); fallas++; continue; }
  for (const frase of casos.marca) {
    total++;
    const r = regla.buscar(frase);
    if (r.length === 0) { fallas++; console.log(`FALLA [${regla.id}] no marcó: ${frase}`); }
  }
  for (const frase of casos.noMarca) {
    total++;
    const r = regla.buscar(frase);
    if (r.length > 0) { fallas++; console.log(`FALLA [${regla.id}] falsa alarma: ${frase} → ${r.map((x) => x.motivo).join(' | ')}`); }
  }
}
console.log(fallas ? `${fallas} de ${total} casos fallaron` : `OK: ${total} casos de gramática correctos`);
process.exit(fallas ? 1 : 0);
