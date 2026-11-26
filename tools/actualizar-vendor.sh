#!/bin/sh
# Copia las librerías y el diccionario desde node_modules a vendor/ y dict/.
# Uso: npm install && npm run vendor
set -e
cp node_modules/pdfjs-dist/legacy/build/pdf.min.mjs node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs vendor/pdfjs/
cp node_modules/pdfjs-dist/LICENSE vendor/pdfjs/LICENSE
echo "export {default} from 'nspell';" > /tmp/ojofino-nspell-entry.mjs
npx esbuild /tmp/ojofino-nspell-entry.mjs --bundle --format=esm --minify --outfile=vendor/nspell/nspell.mjs
cp node_modules/nspell/license vendor/nspell/LICENSE
cp node_modules/dictionary-es-cl/index.aff dict/es_CL.aff
cp node_modules/dictionary-es-cl/index.dic dict/es_CL.dic
cp node_modules/dictionary-es-cl/license dict/LICENSE
echo "vendor/ y dict/ actualizados"
