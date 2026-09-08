from pathlib import Path
from typing import Dict, Any, List, Optional
import time
import json
from ..config import APP_ID, MAX_WORKSHOP_ITEMS
from .steam_discovery import find_steam_libraries
from .vdf_parser import parse_vdf
from .stormworks_meta import analyze_local_item
from ..db.session import get_connection

def scan_local_workshop() -> Dict[str, Any]:
    """
    Finds all installed Stormworks items across all Steam libraries.
    Deterministically selects up to MAX_WORKSHOP_ITEMS sorted numerically by PublishedFileID.
    """
    libraries = find_steam_libraries()
    all_found_items: Dict[str, Dict[str, Any]] = {}
    content_dir_found: Optional[str] = None

    for lib in libraries:
        acf_path = lib / "steamapps" / "workshop" / f"appworkshop_{APP_ID}.acf"
        content_dir = lib / "steamapps" / "workshop" / "content" / str(APP_ID)

        manifest_items: Dict[str, Dict[str, Any]] = {}
        if acf_path.exists():
            try:
                with open(acf_path, "r", encoding="utf-8", errors="ignore") as f:
                    acf_data = parse_vdf(f.read())
                installed = acf_data.get("AppWorkshop", {}).get("WorkshopItemsInstalled", {})
                for item_id, details in installed.items():
                    if isinstance(details, dict):
                        manifest_items[str(item_id)] = {
                            "manifest_size": int(details.get("size", 0)),
                            "manifest_timeupdated": int(details.get("timeupdated", 0))
                        }
            except Exception as e:
                print(f"Error parsing {acf_path}: {e}")

        if content_dir.exists() and content_dir.is_dir():
            content_dir_found = str(content_dir)
            for item_dir in content_dir.iterdir():
                if item_dir.is_dir() and item_dir.name.isdigit():
                    item_id = item_dir.name
                    meta = analyze_local_item(item_dir)
                    m_info = manifest_items.get(item_id, {})
                    all_found_items[item_id] = {
                        "published_file_id": item_id,
                        "local_path": str(item_dir.resolve()),
                        "local_size_bytes": meta["local_size_bytes"],
                        "local_mtime": meta["local_mtime"],
                        "local_manifest_size": m_info.get("manifest_size"),
                        "local_manifest_timeupdated": m_info.get("manifest_timeupdated"),
                        "local_metadata": json.dumps({
                            "detected_type": meta["detected_type"],
                            "file_count": meta["file_count"]
                        }),
                        "local_preview_file": meta["local_preview_file"],
                        "is_present_locally": 1
                    }

    total_found = len(all_found_items)
    
    # Deterministic selection strictly by numeric PublishedFileID ascending
    sorted_ids = sorted(all_found_items.keys(), key=lambda x: int(x))
    
    if MAX_WORKSHOP_ITEMS is not None and len(sorted_ids) > MAX_WORKSHOP_ITEMS:
        selected_ids = sorted_ids[:MAX_WORKSHOP_ITEMS]
        is_limited = True
    else:
        selected_ids = sorted_ids
        is_limited = False

    selected_items = {k: all_found_items[k] for k in selected_ids}

    # Save to SQLite
    conn = get_connection()
    cur = conn.cursor()
    now = int(time.time())

    batch_params = [
        (
            item_id,
            APP_ID,
            it["local_path"],
            it["local_size_bytes"],
            it["local_mtime"],
            1,
            it["local_manifest_size"],
            it["local_manifest_timeupdated"],
            it["local_metadata"],
            it["local_preview_file"],
            now,
            now
        )
        for item_id, it in selected_items.items()
    ]

    if batch_params:
        cur.executemany("""
        INSERT INTO workshop_items (
            published_file_id, app_id, local_path, local_size_bytes, local_mtime,
            is_present_locally, local_manifest_size, local_manifest_timeupdated,
            local_metadata, local_preview_path, first_discovered_at, last_verified_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(published_file_id) DO UPDATE SET
            local_path = excluded.local_path,
            local_size_bytes = excluded.local_size_bytes,
            local_mtime = excluded.local_mtime,
            is_present_locally = 1,
            local_manifest_size = excluded.local_manifest_size,
            local_manifest_timeupdated = excluded.local_manifest_timeupdated,
            local_metadata = excluded.local_metadata,
            local_preview_path = COALESCE(workshop_items.local_preview_path, excluded.local_preview_path),
            last_verified_at = excluded.last_verified_at
        """, batch_params)

    conn.commit()
    conn.close()

    return {
        "total_found_locally": total_found,
        "processed_count": len(selected_items),
        "limit_applied": MAX_WORKSHOP_ITEMS,
        "is_limited": is_limited,
        "content_dir": content_dir_found,
        "selected_ids": selected_ids
    }
