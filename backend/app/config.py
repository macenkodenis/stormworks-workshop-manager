import os
import sys
from pathlib import Path
from typing import Optional

# Base directories
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    # Running inside PyInstaller frozen bundle
    STATIC_DIR = Path(sys._MEIPASS) / "static"
    custom_data = os.environ.get("STORMWORKS_MANAGER_DATA_DIR")
    if custom_data:
        DATA_DIR = Path(custom_data)
    else:
        exe_dir = Path(sys.executable).parent
        if (exe_dir / "data").exists():
            DATA_DIR = exe_dir / "data"
        else:
            DATA_DIR = Path.home() / ".stormworks_workshop_manager" / "data"
    BASE_DIR = DATA_DIR.parent
else:
    # Running from source (browser server or desktop runner)
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    DATA_DIR = Path(os.environ.get("STORMWORKS_MANAGER_DATA_DIR", str(BASE_DIR / "data")))
    STATIC_DIR = BASE_DIR / "backend" / "static"

PREVIEWS_DIR = DATA_DIR / "previews"
DB_PATH = DATA_DIR / "stormworks_workshop.db"

# Stormworks AppID
APP_ID = 573090

# MVP Limit: Deterministically process up to this many items.
# Set to None for unlimited.
MAX_WORKSHOP_ITEMS: Optional[int] = None

# Steam API settings
STEAM_API_BATCH_SIZE = 50
STEAM_API_TIMEOUT_SECONDS = 15.0

# Ensure data directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)
