# OjoFino

Revisor de ortografía y gramática para PDF en español de Chile.
Funciona en local (iPad/Mac), sin IA y sin enviar documentos a la nube.
Entrega un informe en PDF con la página, la palabra y el motivo de cada error, sin corregir el original.

Estado: **fase 1 lista** (lectura del PDF + ortografía). Ver `CLAUDE.md` para el plan y las fases.

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
npm test                # revisa test/prueba.pdf y compara con los errores esperados
```

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `styles.css` | Interfaz |
| `src/app.js` | Selección del PDF y tabla de resultados |
| `src/pdftext.js` | Extracción de texto por página (pdf.js) |
| `src/checker.js` | Revisión ortográfica (sin dependencias del navegador) |
| `src/worker.js` | Carga el diccionario y revisa sin bloquear la pantalla |
| `vendor/` | Librerías incluidas en el repositorio (sin CDN) |
| `dict/` | Diccionario Hunspell es_CL |
| `test/`, `tools/` | Pruebas y utilidades |

## Comportamiento actual

- Une palabras cortadas con guion al final de línea.
- Omite URLs, correos y rutas.
- Omite siglas en mayúsculas (OKE, ONT, TMF).
- Las sugerencias son solo referencia; nunca se modifica el PDF.

## Licencias de terceros

| Componente | Versión | Licencia |
|---|---|---|
| [pdf.js](https://github.com/mozilla/pdf.js) | 4.10.38 | Apache-2.0 |
| [nspell](https://github.com/wooorm/nspell) | 2.1.5 | MIT |
| Diccionario es_CL ([RLA-ES](https://github.com/sbosio/rla-es), vía [wooorm/dictionaries](https://github.com/wooorm/dictionaries)) | 2.0.0 | GPL-3.0 / LGPL-3.0 / MPL-1.1 |

Los textos de cada licencia están en `vendor/*/LICENSE` y `dict/LICENSE`.
