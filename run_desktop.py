#!/usr/bin/env python3
"""
Root-level shortcut launcher for the Desktop Application.
Runs completely independent of any browser server instance.
"""
import sys
from pathlib import Path

# Ensure desktop module is importable
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from desktop.run_desktop import main

if __name__ == '__main__':
    main()
