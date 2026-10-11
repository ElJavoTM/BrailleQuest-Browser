#!/usr/bin/env bash
# Arranca un servidor local y abre BrailleQuest en el navegador.
# Hace falta servidor porque los módulos JavaScript no cargan desde file://.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
URL="http://localhost:$PORT"

echo "BrailleQuest en $URL  (Ctrl+C para salir)"
( sleep 0.8 && open "$URL" ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
