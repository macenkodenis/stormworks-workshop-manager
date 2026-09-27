#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/backend/venv/bin/python" "$SCRIPT_DIR/desktop/run_desktop.py" --server "$@"
