from pathlib import Path
from typing import Optional

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
PREVIEWS_DIR = DATA_DIR / "previews"
DB_PATH = DATA_DIR / "stormworks_workshop.db"
STATIC_DIR = BASE_DIR / "backend" / "static"

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
