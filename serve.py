# Servidor local de desarrollo: como `python3 -m http.server`, pero sin caché,
# para que el navegador cargue siempre la última versión de los archivos.
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
handler = partial(NoCacheHandler, directory=str(Path(__file__).parent))
print(f'BrailleQuest en http://localhost:{port}  (Ctrl+C para salir)')
ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
