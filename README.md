# OjoFino

Revisor de ortografía y gramática para PDF en español de Chile.
Funciona en local (iPad/Mac), sin IA y sin enviar documentos a la nube.
Entrega un informe en PDF con la página, la palabra y el motivo de cada error, sin corregir el original.

Estado: **versión 1.0** — las 6 fases del plan están completas. Funciona sin internet y se instala en el iPad.

- Publicada en <https://aldourra.github.io/OjoFino/>
- Publicar cambios: `docs/publicar.md`
- Probar en el iPad: `docs/prueba-ipad.md`
- LanguageTool en el Mac (opcional): `docs/languagetool-mac.md` Ver `CLAUDE.md` para el plan y las fases.

## Probar en el Mac

```sh
cd ~/git/OjoFino
npm run servir          # o: python3 -m http.server 8080
```

Abre <http://localhost:8080> y elige un PDF. (Abrir `index.html` directamente con doble clic no funciona:
los módulos de JavaScript necesitan un servidor local).

## Pruebas automáticas

```sh
npm install             # solo herramientas de desarrollo
npm test                # gramática, ajustes, LanguageTool (simulado), service worker, test/prueba.pdf e informe PDF
npm run sw              # actualiza la lista de archivos del modo sin conexión (tras cambiar la app)
```

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `styles.css` | Interfaz |
| `src/app.js` | Selección del PDF y tabla de resultados |
| `src/pdftext.js` | Extracción de texto por página (pdf.js) |
| `src/checker.js` | Revisión ortográfica y unión con la gramática (sin dependencias del navegador) |
| `src/grammar.js` | Reglas de gramática locales |
| `src/report.js` | Informe PDF (jsPDF + AutoTable) |
| `src/viewer.js` | Visor del informe dentro de la app y guardado/compartir |
| `src/ajustes.js` | Diccionario personal, ignoradas, reglas, respaldo (sin DOM) |
| `src/panel.js` | Panel "Mis ajustes" |
| `src/languagetool.js` | Cliente del servidor LanguageTool propio (opcional) |
| `docs/languagetool-mac.md` | Instalación de LanguageTool + Tailscale en el Mac |
| `tools/lt-simulado.py` | Servidor LanguageTool simulado para pruebas |
| `sw.js`, `src/actualizacion.js` | Modo sin conexión y aviso de versión nueva |
| `manifest.webmanifest`, `icons/` | Instalación en la pantalla de inicio |
| `.github/workflows/pages.yml` | Pruebas + publicación en GitHub Pages |
| `src/worker.js` | Carga el diccionario y revisa sin bloquear la pantalla |
| `vendor/` | Librerías incluidas en el repositorio (sin CDN) |
| `dict/` | Diccionario Hunspell es_CL |
| `test/`, `tools/` | Pruebas y utilidades |

## Comportamiento actual

- Une palabras cortadas con guion al final de línea.
- Omite URLs, correos y rutas.
- Omite siglas en mayúsculas (OKE, ONT, TMF).
- Las sugerencias son solo referencia; nunca se modifica el PDF.

## Informe

- **Ver informe**: lo genera en memoria y lo muestra dentro de la app (pdf.js), con zoom. No guarda nada.
- **Guardar informe PDF**: en iPad abre el menú de compartir (Archivos, Obsidian…); en otros navegadores lo descarga.
- Nombre: `<archivo>-revision-OjoFino.pdf`. A4 horizontal, con encabezado, resumen, tabla y "Página X de Y".
- Incrusta la fuente Liberation Sans para que se vea igual en cualquier visor.

## Diccionario personal e ignoradas

- **+ Diccionario** (ortografía): la palabra pasa a considerarse correcta. Una entrada en minúsculas
  también acepta mayúscula inicial o todo en mayúsculas; una con mayúsculas ("iPad") solo se acepta tal cual.
- **Ignorar → Solo en este documento**: oculta esa alarma en ese PDF (reconocido por una huella SHA-256
  de su contenido, calculada en el dispositivo; sirve aunque cambie de nombre).
- **Ignorar → Siempre**: oculta esa alarma en cualquier PDF. Ortografía: la palabra. Gramática: la regla
  para ese texto.
- Lo ignorado queda en la sección plegada **Ignoradas** (pantalla e informe), con **Restaurar**.
- **Mis ajustes**: diccionario, ignoradas, activar/desactivar reglas y respaldo
  (diccionario `.txt`, respaldo completo `.json`, importar cualquiera de los dos; al importar se une con lo existente).
- Se guarda en el almacenamiento local del navegador. Safari puede borrar los datos de una web que no se usa
  en 7 días, salvo que esté instalada en la pantalla de inicio (fase 6): conviene exportar un respaldo.

## LanguageTool (opcional)

Ver `docs/languagetool-mac.md`. En **Mis ajustes** se indica la dirección del servidor
(`https://….ts.net` o `localhost`; por privacidad se rechaza cualquier otra). Cada página se revisa
en paralelo con el motor local y LanguageTool; si coinciden en el mismo error se muestra una sola vez.
Si el servidor no responde en 10 s, se continúa solo con el motor local y se indica en el informe.
La página solo permite conexiones a `*.ts.net` y `localhost` (Content-Security-Policy).

## Instalación y uso sin internet

- En el iPad: Safari → Compartir → **Agregar a pantalla de inicio**. Instalada, Safari no borra sus datos por falta de uso.
- La primera vez guarda toda la app (unos 3,5 MB). Después funciona sin conexión.
- Cuando hay una versión publicada nueva aparece **"Hay una versión nueva — Actualizar"**; no se actualiza en medio de una revisión.

## Reglas de gramática

| Regla | Ejemplo | Confianza |
|---|---|---|
| Palabra repetida | "el el informe" | alta |
| Signos ¿? y ¡! | "¿Vienes mañana." | alta |
| Paréntesis y comillas | "(sin cerrar" | alta |
| Mayúscula tras punto | "Fin. luego" | alta |
| Espacios y puntuación | "hola ,mundo" | alta |
| del / al | "de el mes" | alta |
| a ver / haber | "haber si", "va haber" | alta |
| Tilde en interrogativos | "¿que hora es?" | alta |
| Tildes según contexto | "lo mas", "tu eres", "para el." | posible |
| Concordancia de número | "los casa" | posible |

No se revisan (quedan para LanguageTool, fase 5): espacios dobles, dequeísmo, hay/ahí/ay,
concordancia de género y frases que cruzan de una página a otra.

## Licencia

OjoFino se distribuye bajo la licencia MIT (ver `LICENSE`). Los componentes de terceros
mantienen sus propias licencias:

## Licencias de terceros

| Componente | Versión | Licencia |
|---|---|---|
| [pdf.js](https://github.com/mozilla/pdf.js) | 4.10.38 | Apache-2.0 |
| [nspell](https://github.com/wooorm/nspell) | 2.1.5 | MIT |
| [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 | MIT |
| [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 5.0.9 | MIT |
| Liberation Sans (incluida en pdf.js) | — | SIL Open Font License 1.1 |
| Diccionario es_CL ([RLA-ES](https://github.com/sbosio/rla-es), vía [wooorm/dictionaries](https://github.com/wooorm/dictionaries)) | 2.0.0 | GPL-3.0 / LGPL-3.0 / MPL-1.1 |

Los textos de cada licencia están en `vendor/*/LICENSE` y `dict/LICENSE`.
