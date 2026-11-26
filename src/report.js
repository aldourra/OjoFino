// Genera el informe en PDF con jsPDF + AutoTable. Sin dependencias del navegador:
// recibe las clases ya cargadas para poder probarlo con Node.

const MARGEN = 10;              // mm
const ANCHOS = { pag: 12, palabra: 34, tipo: 30, motivo: 66, contexto: 95, sugerencia: 40 }; // suma 277 = A4 horizontal - márgenes
const PADDING = 1.6;
const TAM_TABLA = 8.5;

// Fuente: si se entregan los TTF de Liberation Sans (los mismos que usa pdf.js), se incrustan
// en el informe. Así todos los visores (Safari, Archivos, pdf.js) miden igual el texto y se
// pueden mostrar caracteres fuera de Latin-1. Sin TTF se usa Helvetica estándar.
let FUENTE = 'helvetica';
let UNICODE = false;

function registrarFuentes(doc, fuentes) {
  if (!fuentes) { FUENTE = 'helvetica'; UNICODE = false; return; }
  doc.addFileToVFS('LiberationSans-Regular.ttf', fuentes.regular);
  doc.addFileToVFS('LiberationSans-Bold.ttf', fuentes.bold);
  doc.addFont('LiberationSans-Regular.ttf', 'Liberation', 'normal');
  doc.addFont('LiberationSans-Bold.ttf', 'Liberation', 'bold');
  FUENTE = 'Liberation';
  UNICODE = true;
}

/** Convierte un ArrayBuffer/Uint8Array a base64 (formato que pide jsPDF). */
export function aBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}

// Caracteres que la fuente Helvetica estándar de PDF (WinAnsi) puede mostrar.
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function limpiar(texto) {
  let out = '';
  for (const ch of String(texto ?? '').normalize('NFC')) {
    const c = ch.codePointAt(0);
    if (ch === '\n' || ch === '\t') out += ' ';
    else if (UNICODE) out += /\p{Extended_Pictographic}/u.test(ch) ? '?' : ch;
    else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.includes(ch)) out += ch;
    else out += '?';
  }
  return out;
}

function fechaLocal(fecha) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(fecha.getDate())}-${p(fecha.getMonth() + 1)}-${fecha.getFullYear()} ${p(fecha.getHours())}:${p(fecha.getMinutes())}`;
}

/**
 * Parte el contexto en líneas que caben en `ancho`, midiendo la palabra marcada en negrita.
 * Devuelve [{ segmentos: [{ texto, negrita }] }].
 */
function lineasContexto(doc, ctx, ancho) {
  const tokens = [];
  const empujar = (texto, negrita) => {
    for (const t of limpiar(texto).split(/(\s+)/)) if (t) tokens.push({ texto: t, negrita });
  };
  empujar(ctx.antes, false);
  empujar(ctx.palabra, true);
  empujar(ctx.despues, false);

  const medir = (t) => {
    doc.setFont(FUENTE, t.negrita ? 'bold' : 'normal');
    return doc.getTextWidth(t.texto);
  };
  const lineas = [];
  let actual = [];
  let usado = 0;
  for (const t of tokens) {
    const esEspacio = /^\s+$/.test(t.texto);
    const w = medir(t);
    if (!esEspacio && usado + w > ancho && actual.length) {
      while (actual.length && /^\s+$/.test(actual[actual.length - 1].texto)) actual.pop();
      lineas.push(actual);
      actual = [];
      usado = 0;
    }
    if (esEspacio && actual.length === 0) continue;
    actual.push(t);
    usado += w;
  }
  if (actual.length) lineas.push(actual);
  doc.setFont(FUENTE, 'normal');
  return lineas;
}

function resumenPalabras(hallazgos, max = 10) {
  const conteo = new Map();
  for (const h of hallazgos) {
    if (h.tipo !== 'ortografía') continue;
    conteo.set(h.palabra, (conteo.get(h.palabra) || 0) + 1);
  }
  return [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, max);
}

/**
 * Crea el informe.
 * @param fuentes  { regular, bold } en base64 (opcional; ver registrarFuentes)
 * @returns jsPDF (usar .output('arraybuffer') o .output('blob'))
 */
export function crearInforme(jsPDF, autoTable, { archivo, fecha = new Date(), paginas, motores = ['local'], hallazgos, ignorados = [] }, fuentes = null) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registrarFuentes(doc, fuentes);
  doc.setProperties({ title: `Revisión OjoFino: ${archivo}`, creator: 'OjoFino' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();

  // Encabezado
  let y = MARGEN + 6;
  doc.setFont(FUENTE, 'bold'); doc.setFontSize(16);
  doc.text('OjoFino: informe de revisión', MARGEN, y);
  doc.setFont(FUENTE, 'normal'); doc.setFontSize(10);
  y += 7;
  doc.text(limpiar(`Archivo: ${archivo}`), MARGEN, y);
  y += 5;
  doc.text(limpiar(`Fecha: ${fechaLocal(fecha)}    Páginas: ${paginas}    Motor: ${motores.join(' + ')}`), MARGEN, y);

  // Resumen
  const nOrt = hallazgos.filter((h) => h.tipo === 'ortografía').length;
  const nGram = hallazgos.filter((h) => h.tipo === 'gramática').length;
  const nPos = hallazgos.filter((h) => h.tipo === 'gramática (posible)').length;
  const nLT = hallazgos.filter((h) => h.tipo === 'gramática (LanguageTool)').length;
  y += 8;
  doc.setFont(FUENTE, 'bold'); doc.setFontSize(11);
  const notaIgnoradas = ignorados.length ? ` (${ignorados.length} ignorada${ignorados.length === 1 ? '' : 's'}, al final)` : '';
  if (hallazgos.length === 0) {
    doc.text(`No se encontraron errores.${notaIgnoradas}`, MARGEN, y);
  } else {
    const partes = nLT
      ? `${nOrt} de ortografía, ${nGram} de gramática, ${nPos} de gramática (posible) y ${nLT} de LanguageTool`
      : `${nOrt} de ortografía, ${nGram} de gramática y ${nPos} de gramática (posible)`;
    doc.text(limpiar(`${hallazgos.length} posibles errores: ${partes}.${notaIgnoradas}`), MARGEN, y);
    const top = resumenPalabras(hallazgos);
    if (top.length) {
      y += 5.5;
      doc.setFont(FUENTE, 'normal'); doc.setFontSize(9);
      const texto = 'Palabras no reconocidas más frecuentes: ' + top.map(([w, n]) => (n > 1 ? `${w} (${n})` : w)).join(', ');
      const lineas = doc.splitTextToSize(limpiar(texto), anchoPagina - 2 * MARGEN);
      doc.text(lineas, MARGEN, y);
      y += (lineas.length - 1) * 4;
    }
  }
  doc.setFont(FUENTE, 'normal');

  // Tabla
  if (hallazgos.length) {
    const anchoCtx = ANCHOS.contexto - 2 * PADDING;
    doc.setFontSize(TAM_TABLA);
    const lineasPorFila = hallazgos.map((h) => lineasContexto(doc, h.contexto, anchoCtx));
    const cuerpo = hallazgos.map((h, i) => [
      String(h.pagina),
      limpiar(h.palabra),
      limpiar(etiquetaTipo(h)),
      limpiar(h.motivo),
      // Texto invisible que solo reserva la altura; el contexto se dibuja después con la negrita.
      lineasPorFila[i].map((l) => l.map((t) => t.texto).join('')).join('\n'),
      h.sugerencias && h.sugerencias.length ? limpiar(h.sugerencias.join(', ')) : '-',
    ]);

    autoTable(doc, {
      startY: y + 5,
      margin: { left: MARGEN, right: MARGEN, top: MARGEN + 4, bottom: MARGEN + 6 },
      head: [['Pág.', 'Palabra', 'Tipo', 'Motivo', 'Contexto', 'Sugerencia (referencia)']],
      body: cuerpo,
      theme: 'grid',
      rowPageBreak: 'avoid', // el contexto se dibuja a mano: la fila no debe partirse entre hojas
      styles: { font: FUENTE, fontSize: TAM_TABLA, cellPadding: PADDING, overflow: 'linebreak', lineColor: [210, 210, 205], lineWidth: 0.2, textColor: [29, 29, 27], valign: 'top' },
      headStyles: { fillColor: [47, 93, 80], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 247, 243] },
      columnStyles: {
        0: { cellWidth: ANCHOS.pag, halign: 'center' },
        1: { cellWidth: ANCHOS.palabra, fontStyle: 'bold' },
        2: { cellWidth: ANCHOS.tipo },
        3: { cellWidth: ANCHOS.motivo },
        4: { cellWidth: ANCHOS.contexto },
        5: { cellWidth: ANCHOS.sugerencia },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 4) data.cell.styles.textColor = data.cell.styles.fillColor || [255, 255, 255];
      },
      didDrawCell(data) {
        if (data.section !== 'body' || data.column.index !== 4) return;
        const lineas = lineasPorFila[data.row.index];
        const alto = TAM_TABLA * 0.3528 * 1.15; // pt -> mm × interlineado de AutoTable
        let yy = data.cell.y + PADDING + TAM_TABLA * 0.3528 * 0.85;
        doc.setTextColor(29, 29, 27);
        doc.setFontSize(TAM_TABLA);
        for (const linea of lineas) {
          // Agrupa los fragmentos del mismo estilo: así cada visor aplica su propio
          // espaciado dentro del tramo y solo se posiciona a mano el cambio de estilo.
          const tramos = [];
          for (const t of linea) {
            const ultimo = tramos[tramos.length - 1];
            if (ultimo && ultimo.negrita === t.negrita) ultimo.texto += t.texto;
            else tramos.push({ texto: t.texto, negrita: t.negrita });
          }
          let xx = data.cell.x + PADDING;
          for (const t of tramos) {
            doc.setFont(FUENTE, t.negrita ? 'bold' : 'normal');
            doc.text(t.texto, xx, yy);
            xx += doc.getTextWidth(t.texto);
          }
          yy += alto;
        }
        doc.setFont(FUENTE, 'normal');
      },
    });
  }

  // Sección de ignoradas
  if (ignorados.length) {
    let yIg = hallazgos.length ? doc.lastAutoTable.finalY + 10 : y + 10;
    if (yIg > altoPagina - MARGEN - 30) { doc.addPage(); yIg = MARGEN + 6; }
    doc.setFont(FUENTE, 'bold'); doc.setFontSize(11); doc.setTextColor(29, 29, 27);
    doc.text(`Ignoradas (${ignorados.length})`, MARGEN, yIg);
    doc.setFont(FUENTE, 'normal');
    autoTable(doc, {
      startY: yIg + 3,
      margin: { left: MARGEN, right: MARGEN, top: MARGEN + 4, bottom: MARGEN + 6 },
      head: [['Pág.', 'Palabra', 'Tipo', 'Motivo', 'Ignorada']],
      body: ignorados.map((h) => [
        String(h.pagina), limpiar(h.palabra), limpiar(etiquetaTipo(h)), limpiar(h.motivo),
        h.alcance === 'siempre' ? 'Siempre' : 'Solo en este documento',
      ]),
      theme: 'grid',
      styles: { font: FUENTE, fontSize: TAM_TABLA, cellPadding: PADDING, lineColor: [210, 210, 205], lineWidth: 0.2, textColor: [107, 107, 102], valign: 'top' },
      headStyles: { fillColor: [150, 150, 144], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: ANCHOS.pag, halign: 'center' },
        1: { cellWidth: ANCHOS.palabra },
        2: { cellWidth: ANCHOS.tipo },
        3: { cellWidth: ANCHOS.motivo + ANCHOS.contexto },
        4: { cellWidth: ANCHOS.sugerencia },
      },
    });
  }

  // Pie de página en todas las hojas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(FUENTE, 'normal'); doc.setFontSize(8); doc.setTextColor(107, 107, 102);
    doc.text('Generado localmente con OjoFino; el documento no salió del dispositivo.', MARGEN, altoPagina - MARGEN);
    doc.text(`Página ${p} de ${total}`, anchoPagina - MARGEN, altoPagina - MARGEN, { align: 'right' });
  }
  return doc;
}

/** Texto del tipo para mostrar: indica si el hallazgo vino de LanguageTool. */
export function etiquetaTipo(h) {
  return h.motor === 'LanguageTool' && !/LanguageTool/.test(h.tipo) ? `${h.tipo} (LanguageTool)` : h.tipo;
}

export function nombreInforme(archivo) {
  return archivo.replace(/\.pdf$/i, '') + '-revision-OjoFino.pdf';
}
