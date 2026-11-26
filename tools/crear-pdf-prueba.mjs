// Genera test/prueba.pdf con errores conocidos (requiere: npm i -D jspdf).
import { jsPDF } from 'jspdf';
import fs from 'fs';
const doc = new jsPDF();
doc.text(['Este es un texto de prueva para el revisor.', 'La aplicacion corre en el iPad sin internet.',
  'Visita https://ejemplo.cl o escribe a aldo@ejemplo.cl.', 'El servicio OKE y la ONT funcionan bien.',
  'Una palabra cortada al final: compu-', 'tadora portátil.'], 15, 20);
doc.addPage();
doc.text(['Página dos: hiba a ir al supermercado.', 'Todo está correcto en esta línea.'], 15, 20);
fs.writeFileSync('test/prueba.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('test/prueba.pdf creado');
