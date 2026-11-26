# OjoFino — Revisor de ortografía y gramática para PDF

## Objetivo
App web instalable (PWA) para iPad que revisa PDF con texto seleccionable en **español de Chile**,
**sin IA** y **sin enviar datos a ninguna nube**. El PDF nunca sale del dispositivo
(salvo hacia el servidor LanguageTool propio del usuario, ver "Motor opcional").

## Salida
Informe en **PDF** con una fila por hallazgo:
- Página
- Palabra o fragmento
- Tipo de error (ortografía / gramática)
- Motivo
- Contexto (frase alrededor)
- Sugerencia, solo como referencia

La app **nunca modifica el PDF original** ni aplica correcciones.

## Arquitectura (opción híbrida)
**Motor local (siempre disponible, en el navegador):**
- pdf.js → extracción de texto por página
- Hunspell `es_CL` (diccionarios de LibreOffice / rla-es) vía motor JS o WASM
- Reglas de gramática propias: palabras repetidas, ¿? y ¡! sin cerrar, mayúscula tras punto,
  espacios dobles, tildes frecuentes (más/mas, él/el, qué/que, tú/tu, sí/si…), concordancia básica
- jsPDF (o pdf-lib) → generación del informe

**Motor opcional (Mac del usuario):**
- Servidor LanguageTool local (Java o Docker) en el Mac
- Acceso desde el iPad vía Tailscale con HTTPS (`tailscale serve`), CORS habilitado (`--allow-origin`)
- Si no responde, la app continúa solo con el motor local y lo indica en el informe

**Diccionario personal:**
- Guardado en el iPad (IndexedDB/localStorage con try/catch)
- Exportar/importar como `.txt` (una palabra por línea) para respaldo y edición en Obsidian
- Pensado para términos técnicos (ej.: OKE, ONT, TMF)

## Restricciones
- Sin CDN: todas las librerías incluidas en el repositorio (vendored)
- Solo librerías open source, con licencias compatibles; documentar cada una en README
- Sin IA ni modelos de lenguaje
- Funciona offline después de la primera carga (service worker)
- Publicación en GitHub Pages (solo el código; nunca datos del usuario)
- Sin analítica, telemetría ni llamadas a terceros

## Fases
1. Lectura del PDF + revisión ortográfica con Hunspell (validar rendimiento del diccionario español en iPad)
2. Reglas de gramática locales
3. Informe en PDF
4. Diccionario personal
5. Conexión opcional con LanguageTool en el Mac
6. PWA offline + publicación en GitHub Pages

## Forma de trabajo
- Responder siempre en español, breve pero claro.
- **Antes de cada fase**, mostrar la propuesta (archivos, librerías, enfoque) y **esperar aprobación**.
- No inventar información; si falta algo o hay dudas, preguntar.
- Entorno del usuario: Mac, iPad, VS Code, Obsidian.
