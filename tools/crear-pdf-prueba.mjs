// Genera test/prueba.pdf con errores conocidos (requiere: npm install).
import { jsPDF } from 'jspdf';
import fs from 'fs';
const doc = new jsPDF();
// Página 1: ortografía
doc.text(['Este es un texto de prueva para el revisor.', 'La aplicacion corre en el iPad sin internet.',
  'Visita https://ejemplo.cl o escribe a aldo@ejemplo.cl.', 'El servicio OKE y la ONT funcionan bien.',
  'Una palabra cortada al final: compu-', 'tadora portátil.'], 15, 20);
// Línea armada con fragmentos separados (como hacen muchos PDF): debe leerse "Fragmentos unidos, bien."
let x = 15;
for (const parte of ['Frag', 'mentos', ' unidos', ',', ' bien.']) { doc.text(parte, x, 90); x += doc.getTextWidth(parte); }
// Página 2: gramática
doc.addPage();
doc.text(['Página dos: hiba a ir al supermercado.', 'Todo está correcto en esta línea.',
  'Revisé el el informe de el mes pasado.', '¿Que hora es. Mañana va haber reunión.',
  'Terminó el día. luego salió (sin cerrar.', 'Es lo mas importante para los casa.'], 15, 20);
fs.writeFileSync('test/prueba.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('test/prueba.pdf creado');
