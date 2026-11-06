#!/usr/bin/env bash
#
# Starts the full CityZen dev stack in one shot:
#   - Backend API (Node/Express, nodemon)
#   - DistilBERT emotion service (Python, Flask)
#   - Web frontend (Vite dev server)
#
# Mobile (Expo) is intentionally left out -- it wants its own interactive
# foreground terminal (QR code, keypress shortcuts) and doesn't fit a
# backgrounded "start everything" script. Run it separately with:
#   npm run start:mobile
#
# Usage:
#   ./start.sh            # start backend + Python service + web
#   ./start.sh --no-web    # backend + Python service only
#
# Logs for each service are written under .start-logs/ in the repo root.
# Press Ctrl+C to stop everything.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
PY_DIR="$BACKEND_DIR/python_services"
WEB_DIR="$ROOT_DIR/frontend/urbanpulse-web"
LOG_DIR="$ROOT_DIR/.start-logs"

START_WEB=1
for arg in "$@"; do
  case "$arg" in
    --no-web) START_WEB=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

PIDS=()
cleanup() {
  echo ""
  echo "Stopping all services..."
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "== CityZen dev stack =="

if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "WARNING: backend/.env not found. The backend needs SUPABASE_URL, SUPABASE_ANON_KEY," >&2
  echo "         JWT_SECRET, and (for the two Python services) HF_TOKEN set there." >&2
fi

# --- Node dependencies -------------------------------------------------
for dir in "$ROOT_DIR" "$BACKEND_DIR" "$WEB_DIR"; do
  if [ ! -d "$dir/node_modules" ]; then
    echo "Installing npm dependencies in ${dir#$ROOT_DIR/}..."
    (cd "$dir" && npm install)
  fi
done

# --- Python virtualenv for python_services -----------------------------
if [ ! -d "$PY_DIR/venv" ]; then
  echo "Creating Python virtual environment for python_services..."
  python3 -m venv "$PY_DIR/venv"
fi
echo "Installing/updating Python dependencies (this can take a minute the first time, SHAP pulls in numpy/scipy)..."
"$PY_DIR/venv/bin/python" -m pip install --quiet --upgrade pip
"$PY_DIR/venv/bin/python" -m pip install --quiet -r "$PY_DIR/requirements.txt"

# --- Launch services -----------------------------------------------------
echo "Starting backend API (Node)..."
(cd "$BACKEND_DIR" && npm run dev) > "$LOG_DIR/backend.log" 2>&1 &
PIDS+=("$!")

echo "Starting DistilBERT emotion service (Python)..."
(cd "$PY_DIR" && ./venv/bin/python distilbert_emotion_service.py) > "$LOG_DIR/emotion-service.log" 2>&1 &
PIDS+=("$!")

if [ "$START_WEB" -eq 1 ]; then
  echo "Starting web frontend (Vite dev server)..."
  (cd "$WEB_DIR" && npm run dev) > "$LOG_DIR/web.log" 2>&1 &
  PIDS+=("$!")
fi

echo ""
echo "All services starting in the background."
echo "Logs: $LOG_DIR/*.log  (tail -f $LOG_DIR/backend.log, etc.)"
echo "Mobile app: run 'npm run start:mobile' in a separate terminal."
echo "Press Ctrl+C to stop everything."
echo ""

wait
