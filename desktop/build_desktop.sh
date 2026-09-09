#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "========================================================"
echo " Building Stormworks Workshop Manager Desktop Bundle"
echo "========================================================"

cd "$PROJECT_ROOT"

# 1. Build frontend static files
echo "[1/3] Building latest frontend bundle..."
cd frontend
npm run build
cd "$PROJECT_ROOT"

# 2. Package with PyInstaller
echo "[2/3] Bundling with PyInstaller..."
"$PROJECT_ROOT/backend/venv/bin/pyinstaller" --clean --noconfirm "$SCRIPT_DIR/desktop.spec"

echo "[3/3] Build complete!"
echo "Standalone application directory: $PROJECT_ROOT/dist/StormworksWorkshopManager"
echo "Executable binary: $PROJECT_ROOT/dist/StormworksWorkshopManager/StormworksWorkshopManager"
echo "========================================================"
