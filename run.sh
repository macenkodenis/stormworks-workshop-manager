#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "=================================================="
echo "    Stormworks Steam Workshop Manager (MVP)       "
echo "=================================================="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed."
    exit 1
fi

# Ensure virtualenv exists
if [ ! -d "$PROJECT_DIR/backend/venv" ]; then
    echo "[1/3] Setting up Python virtual environment..."
    python3 -m venv "$PROJECT_DIR/backend/venv"
    "$PROJECT_DIR/backend/venv/bin/pip" install --upgrade pip
    "$PROJECT_DIR/backend/venv/bin/pip" install -r "$PROJECT_DIR/backend/requirements.txt"
fi

# Ensure frontend static build exists
if [ ! -f "$PROJECT_DIR/backend/static/index.html" ]; then
    echo "[2/3] Building frontend static assets..."
    cd "$PROJECT_DIR/frontend"
    npm install
    npm run build
    cd "$PROJECT_DIR"
fi

echo "[3/3] Starting local server at http://localhost:8000"
echo "Open your browser at: http://localhost:8000"
echo "Press Ctrl+C to stop."
echo "--------------------------------------------------"

"$PROJECT_DIR/backend/venv/bin/uvicorn" app.main:app --app-dir "$PROJECT_DIR/backend" --host 127.0.0.1 --port 8000
