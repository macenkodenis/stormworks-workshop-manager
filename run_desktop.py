#!/usr/bin/env python3
"""
Root-level shortcut launcher for the Desktop Application.
Automatically switches to the project virtual environment (backend/venv)
so it can be launched with any python3 command or directly as ./run_desktop.py.
"""
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
VENV_DIR = PROJECT_ROOT / "backend" / "venv"
VENV_PYTHON = VENV_DIR / "bin" / "python"

# Auto-escalate to project venv if running with system python
if VENV_PYTHON.exists() and Path(sys.prefix).resolve() != VENV_DIR.resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), str(Path(__file__).resolve())] + sys.argv[1:])

# Ensure project root is in sys.path
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from desktop.run_desktop import main

if __name__ == '__main__':
    main()

