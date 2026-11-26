// Visor de PDF dentro de la app (pdf.js). Muestra el informe sin guardarlo.

const FUENTES = new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href;

export function crearVisor(pdfjsLib, { onGuardar }) {
  const capa = document.createElement('div');
  capa.className = 'visor';
  capa.hidden = true;
  capa.innerHTML = `
    <div class="visor-barra">
      <button type="button" data-accion="cerrar">Cerrar</button>
      <span class="visor-zoom">
        <button type="button" data-accion="menos" aria-label="Alejar">−</button>
        <span data-zoom>100 %</span>
        <button type="button" data-accion="mas" aria-label="Acercar">+</button>
      </span>
      <button type="button" data-accion="guardar" class="primario">Guardar</button>
    </div>
    <div class="visor-paginas" tabindex="0"></div>`;
  document.body.append(capa);

  const contenedor = capa.querySelector('.visor-paginas');
  const etiquetaZoom = capa.querySelector('[data-zoom]');
  let doc = null;
  let zoom = 1;
  let generacion = 0;

  async function dibujar() {
    const gen = ++generacion;
    contenedor.replaceChildren();
    etiquetaZoom.textContent = `${Math.round(zoom * 100)} %`;
    const anchoDisponible = Math.max(320, contenedor.clientWidth - 24);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      if (gen !== generacion) return;
      const base = page.getViewport({ scale: 1 });
      const escala = (anchoDisponible / base.width) * zoom;
      const vp = page.getViewport({ scale: escala * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
      canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
      contenedor.append(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    }
  }

  async function cerrar() {
    capa.hidden = true;
    document.body.classList.remove('sin-scroll');
    generacion++;
    contenedor.replaceChildren();
    if (doc) { await doc.destroy(); doc = null; }
  }

  capa.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'cerrar') cerrar();
    else if (accion === 'mas') { zoom = Math.min(3, zoom + 0.25); dibujar(); }
    else if (accion === 'menos') { zoom = Math.max(0.5, zoom - 0.25); dibujar(); }
    else if (accion === 'guardar') onGuardar();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !capa.hidden) cerrar(); });

  return {
    async abrir(bytes) {
      if (doc) await doc.destroy();
      zoom = 1;
      capa.hidden = false;
      document.body.classList.add('sin-scroll');
      // pdf.js transfiere el búfer al worker: se le pasa una copia.
      doc = await pdfjsLib.getDocument({
        data: bytes.slice(), standardFontDataUrl: FUENTES, isEvalSupported: false, verbosity: 0,
      }).promise;
      await dibujar();
    },
    cerrar,
  };
}

/** Guarda o comparte el PDF. En iPad abre el menú de compartir. */
export async function guardarPdf(bytes, nombre) {
  const archivo = new File([bytes], nombre, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return 'compartido';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelado';
      // Si compartir falla por otro motivo, se intenta la descarga.
    }
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'descargado';
}
