#!/usr/bin/env python3
"""Servidor LanguageTool SIMULADO para pruebas (no revisa nada de verdad).

Responde a POST /v2/check con el mismo formato que LanguageTool 6.x y marca
algunas palabras fijas. Uso: python3 tools/lt-simulado.py [puerto] [retardo_s]
"""
import json, re, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8081
RETARDO = float(sys.argv[2]) if len(sys.argv) > 2 else 0

REGLAS = [
    # (patrón, id, categoría, issueType, mensaje, reemplazo)
    (r"\bhiba\b", "MORFOLOGIK_RULE_ES", "TYPOS", "misspelling", "Se ha encontrado un posible error ortográfico.", "iba"),
    (r"\bel el\b", "ES_REPEATEDWORDS", "GRAMMAR", "duplication", "Posible error: palabra repetida.", "el"),
    (r"\bsupermercado\b", "SIMULADA_GRAMATICA", "GRAMMAR", "grammar", "Regla simulada de prueba.", "súper"),
    (r"\bvamo\b", "MORFOLOGIK_RULE_ES", "TYPOS", "misspelling", "Se ha encontrado un posible error ortográfico.", "vamos"),
]

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
    def do_OPTIONS(self):
        self.send_response(204); self._cors()
        self.send_header("Access-Control-Allow-Methods", "POST, GET"); self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    def do_POST(self):
        if not self.path.startswith("/v2/check"):
            self.send_response(404); self.end_headers(); return
        largo = int(self.headers.get("Content-Length", 0))
        datos = parse_qs(self.rfile.read(largo).decode("utf-8"))
        texto = datos.get("text", [""])[0]
        if RETARDO: time.sleep(RETARDO)
        matches = []
        for patron, rid, cat, issue, msg, rep in REGLAS:
            for m in re.finditer(patron, texto):
                matches.append({
                    "message": msg, "shortMessage": "", "replacements": [{"value": rep}],
                    "offset": m.start(), "length": m.end() - m.start(),
                    "context": {"text": texto[max(0, m.start()-20):m.end()+20], "offset": 0, "length": 0},
                    "sentence": "", "type": {"typeName": "Other"},
                    "rule": {"id": rid, "description": msg, "issueType": issue, "category": {"id": cat, "name": cat}},
                })
        cuerpo = json.dumps({"software": {"name": "LanguageTool", "version": "6.8-simulado"},
                             "language": {"name": "Spanish", "code": "es"}, "matches": matches}).encode()
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers(); self.wfile.write(cuerpo)
    def log_message(self, *a): pass

if __name__ == "__main__":
    print(f"LanguageTool simulado en http://localhost:{PUERTO}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PUERTO), H).serve_forever()
