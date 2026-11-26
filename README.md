# OjoFino

Revisor de ortografía y gramática para PDF en español de Chile.
Funciona en local (iPad/Mac), sin IA y sin enviar documentos a la nube.
Entrega un informe en PDF con la página, la palabra y el motivo de cada error, sin corregir el original.

Estado: **fase 2 lista** (lectura del PDF, ortografía y gramática local). Ver `CLAUDE.md` para el plan y las fases.

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
npm test                # reglas de gramática + revisión completa de test/prueba.pdf
```

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `styles.css` | Interfaz |
| `src/app.js` | Selección del PDF y tabla de resultados |
| `src/pdftext.js` | Extracción de texto por página (pdf.js) |
| `src/checker.js` | Revisión ortográfica y unión con la gramática (sin dependencias del navegador) |
| `src/grammar.js` | Reglas de gramática locales |
| `src/worker.js` | Carga el diccionario y revisa sin bloquear la pantalla |
| `vendor/` | Librerías incluidas en el repositorio (sin CDN) |
| `dict/` | Diccionario Hunspell es_CL |
| `test/`, `tools/` | Pruebas y utilidades |

## Comportamiento actual

- Une palabras cortadas con guion al final de línea.
- Omite URLs, correos y rutas.
- Omite siglas en mayúsculas (OKE, ONT, TMF).
- Las sugerencias son solo referencia; nunca se modifica el PDF.

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

## Licencias de terceros

| Componente | Versión | Licencia |
|---|---|---|
| [pdf.js](https://github.com/mozilla/pdf.js) | 4.10.38 | Apache-2.0 |
| [nspell](https://github.com/wooorm/nspell) | 2.1.5 | MIT |
| Diccionario es_CL ([RLA-ES](https://github.com/sbosio/rla-es), vía [wooorm/dictionaries](https://github.com/wooorm/dictionaries)) | 2.0.0 | GPL-3.0 / LGPL-3.0 / MPL-1.1 |

Los textos de cada licencia están en `vendor/*/LICENSE` y `dict/LICENSE`.
