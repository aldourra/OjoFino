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
mkdir -p vendor/pdfjs/standard_fonts vendor/jspdf
cp node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf node_modules/pdfjs-dist/standard_fonts/LICENSE_LIBERATION vendor/pdfjs/standard_fonts/
# jsPDF + AutoTable en un solo módulo; los complementos opcionales (html2canvas, dompurify, canvg) se omiten
echo "export { jsPDF } from 'jspdf'; export { autoTable } from 'jspdf-autotable';" > /tmp/ojofino-jspdf-entry.mjs
echo "export default {};" > /tmp/ojofino-vacio.mjs
npx esbuild /tmp/ojofino-jspdf-entry.mjs --bundle --format=esm --minify --platform=browser \
  --alias:html2canvas=/tmp/ojofino-vacio.mjs --alias:dompurify=/tmp/ojofino-vacio.mjs --alias:canvg=/tmp/ojofino-vacio.mjs \
  --outfile=vendor/jspdf/jspdf.mjs
cp node_modules/jspdf/LICENSE vendor/jspdf/LICENSE-jspdf
cp node_modules/jspdf-autotable/LICENSE.txt vendor/jspdf/LICENSE-jspdf-autotable
echo "vendor/ y dict/ actualizados"
