import sqlite3
from typing import List, Dict, Any, Optional
from ..config import DB_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS workshop_items (
        published_file_id TEXT PRIMARY KEY,
        app_id INTEGER NOT NULL DEFAULT 573090,

        -- Steam API Data
        api_title TEXT,
        api_description TEXT,
        api_creator TEXT,
        api_preview_url TEXT,
        api_time_created INTEGER,
        api_time_updated INTEGER,
        api_file_size INTEGER,
        api_subscriptions INTEGER,
        api_favorited INTEGER,
        api_views INTEGER,
        api_tags TEXT, -- JSON array of tags
        api_result INTEGER,
        api_last_synced_at INTEGER,

        -- Local Filesystem Data
        local_path TEXT,
        local_size_bytes INTEGER,
        local_mtime INTEGER,
        is_present_locally INTEGER NOT NULL DEFAULT 1,
        local_manifest_size INTEGER,
        local_manifest_timeupdated INTEGER,
        local_metadata TEXT, -- JSON object

        -- Preview Cache Data
        local_preview_path TEXT,
        preview_downloaded_at INTEGER,

        -- Historical & User Data
        first_discovered_at INTEGER NOT NULL,
        last_verified_at INTEGER NOT NULL,
        is_unsubscribed INTEGER DEFAULT 0,
        unsubscribed_at INTEGER,
        user_notes TEXT
    );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_is_present ON workshop_items(is_present_locally);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_api_time_updated ON workshop_items(api_time_updated);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_local_size ON workshop_items(local_size_bytes);")

    # Add columns if they do not exist
    cur.execute("PRAGMA table_info(workshop_items);")
    existing_cols = {row[1] for row in cur.fetchall()}
    if "user_tags" not in existing_cols:
        cur.execute("ALTER TABLE workshop_items ADD COLUMN user_tags TEXT DEFAULT '[]';")
    if "deactivated_steam_tags" not in existing_cols:
        cur.execute("ALTER TABLE workshop_items ADD COLUMN deactivated_steam_tags TEXT DEFAULT '[]';")
    if "is_favorited" not in existing_cols:
        cur.execute("ALTER TABLE workshop_items ADD COLUMN is_favorited INTEGER DEFAULT 0;")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_is_favorited ON workshop_items(is_favorited);")
    if "original_steam_tags" not in existing_cols:
        cur.execute("ALTER TABLE workshop_items ADD COLUMN original_steam_tags TEXT;")
        cur.execute("UPDATE workshop_items SET original_steam_tags = api_tags WHERE original_steam_tags IS NULL;")
    if "is_disabled" not in existing_cols:
        cur.execute("ALTER TABLE workshop_items ADD COLUMN is_disabled INTEGER DEFAULT 0;")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_is_disabled ON workshop_items(is_disabled);")
    if "is_sorted" not in existing_cols:
        cur.execute("ALTER TABLE workshop_items ADD COLUMN is_sorted INTEGER DEFAULT NULL;")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_is_sorted ON workshop_items(is_sorted);")

    # Table for app settings / preferences (e.g. tag structure, groups, ordering)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)

    # Table for user-defined tags dictionary (persisting tags even with 0 items)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS custom_user_tags (
        tag TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
    );
    """)

    conn.commit()
    conn.close()
