from pathlib import Path
from typing import Dict, Any, List, Optional
import os
import time
import json
from concurrent.futures import ThreadPoolExecutor
from ..config import APP_ID, MAX_WORKSHOP_ITEMS
from .steam_discovery import find_steam_libraries, find_subscriptions_vdf
from .vdf_parser import parse_vdf
from .stormworks_meta import analyze_local_item
from ..db.session import get_connection

def scan_local_workshop() -> Dict[str, Any]:
    """
    Finds all installed Stormworks items across all Steam libraries.
    Synchronizes subscription and disabled states using 573090_subscriptions.vdf.
    Deterministically selects up to MAX_WORKSHOP_ITEMS sorted numerically by PublishedFileID.
    """
    # 1. Parse official Steam subscriptions VDF (if available)
    subscriptions_vdf_path = find_subscriptions_vdf()
    subscribed_vdf_map: Optional[Dict[str, bool]] = None
    if subscriptions_vdf_path and subscriptions_vdf_path.exists():
        try:
            with open(subscriptions_vdf_path, "r", encoding="utf-8", errors="ignore") as f:
                subscriptions_vdf_data = parse_vdf(f.read())
            subscriptions_dict = subscriptions_vdf_data.get("subscribedfiles", {})
            subscribed_vdf_map = {}
            for k, val in subscriptions_dict.items():
                if isinstance(val, dict) and "publishedfileid" in val:
                    published_file_id = str(val["publishedfileid"])
                    is_item_disabled = str(val.get("disabled_locally", "0")) == "1"
                    subscribed_vdf_map[published_file_id] = is_item_disabled
        except Exception as e:
            print(f"Error parsing subscriptions.vdf: {e}")

    # 2. Discover local files on disk
    steam_libraries = find_steam_libraries()
    all_found_items: Dict[str, Dict[str, Any]] = {}
    content_dir_found: Optional[str] = None

    for steam_library in steam_libraries:
        workshop_manifest_path = steam_library / "steamapps" / "workshop" / f"appworkshop_{APP_ID}.acf"
        content_dir = steam_library / "steamapps" / "workshop" / "content" / str(APP_ID)

        manifest_items: Dict[str, Dict[str, Any]] = {}
        if workshop_manifest_path.exists():
            try:
                with open(workshop_manifest_path, "r", encoding="utf-8", errors="ignore") as f:
                    workshop_manifest_data = parse_vdf(f.read())
                installed_manifest_items = workshop_manifest_data.get("AppWorkshop", {}).get("WorkshopItemsInstalled", {})
                for item_id, details in installed_manifest_items.items():
                    if isinstance(details, dict):
                        manifest_items[str(item_id)] = {
                            "manifest_size": int(details.get("size", 0)),
                            "manifest_timeupdated": int(details.get("timeupdated", 0))
                        }
            except Exception as e:
                print(f"Error parsing {workshop_manifest_path}: {e}")

        if content_dir.exists() and content_dir.is_dir():
            content_dir_found = str(content_dir)
            target_dirs = [d for d in content_dir.iterdir() if d.is_dir() and d.name.isdigit()]

            def _inspect_item(item_dir: Path):
                item_id = item_dir.name
                meta = analyze_local_item(item_dir)
                m_info = manifest_items.get(item_id, {})
                return item_id, {
                    "published_file_id": item_id,
                    "local_path": str(item_dir.resolve()),
                    "local_size_bytes": meta["local_size_bytes"],
                    "local_mtime": meta["local_mtime"],
                    "local_manifest_size": m_info.get("manifest_size"),
                    "local_manifest_timeupdated": m_info.get("manifest_timeupdated"),
                    "local_metadata": json.dumps({
                        "detected_type": meta["detected_type"],
                        "file_count": meta["file_count"],
                        "local_title": meta.get("local_title"),
                        "local_author": meta.get("local_author")
                    }),
                    "local_preview_file": meta["local_preview_file"],
                    "local_title": meta.get("local_title"),
                    "local_author": meta.get("local_author"),
                    "local_description": meta.get("local_description"),
                    "is_present_locally": 1
                }

            worker_count = min(32, max(4, (os.cpu_count() or 4) * 2))
            with ThreadPoolExecutor(max_workers=worker_count) as executor:
                for item_id, item_payload in executor.map(_inspect_item, target_dirs):
                    all_found_items[item_id] = item_payload

    total_found = len(all_found_items)

    conn = get_connection()
    cur = conn.cursor()
    now = int(time.time())

    # 3. Synchronize items found locally on disk
    batch_params = []
    for item_id, item_info in all_found_items.items():
        if subscribed_vdf_map is not None:
            is_unsubscribed = 0 if item_id in subscribed_vdf_map else 1
            is_disabled = 1 if (item_id in subscribed_vdf_map and subscribed_vdf_map[item_id]) else 0
        else:
            is_unsubscribed = 0
            is_disabled = 0

        batch_params.append((
            item_id,
            APP_ID,
            item_info["local_path"],
            item_info["local_size_bytes"],
            item_info["local_mtime"],
            1,
            is_unsubscribed,
            is_disabled,
            item_info["local_manifest_size"],
            item_info["local_manifest_timeupdated"],
            item_info["local_metadata"],
            item_info["local_preview_file"],
            now,
            now,
            item_info.get("local_title"),
            item_info.get("local_author"),
            item_info.get("local_description")
        ))

    if batch_params:
        cur.executemany("""
        INSERT INTO workshop_items (
            published_file_id, app_id, local_path, local_size_bytes, local_mtime,
            is_present_locally, is_unsubscribed, is_disabled,
            local_manifest_size, local_manifest_timeupdated,
            local_metadata, local_preview_path, first_discovered_at, last_verified_at,
            api_title, api_creator, api_description
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?
        )
        ON CONFLICT(published_file_id) DO UPDATE SET
            local_path = excluded.local_path,
            local_size_bytes = excluded.local_size_bytes,
            local_mtime = excluded.local_mtime,
            is_present_locally = 1,
            is_unsubscribed = excluded.is_unsubscribed,
            is_disabled = excluded.is_disabled,
            local_manifest_size = excluded.local_manifest_size,
            local_manifest_timeupdated = excluded.local_manifest_timeupdated,
            local_metadata = excluded.local_metadata,
            local_preview_path = COALESCE(workshop_items.local_preview_path, excluded.local_preview_path),
            api_title = COALESCE(workshop_items.api_title, excluded.api_title),
            api_creator = COALESCE(workshop_items.api_creator, excluded.api_creator),
            api_description = COALESCE(workshop_items.api_description, excluded.api_description),
            last_verified_at = excluded.last_verified_at
        """, batch_params)

    # 4. Synchronize items existing in DB that are NOT on disk
    cur.execute("SELECT published_file_id FROM workshop_items")
    db_pids = {str(r[0]) for r in cur.fetchall()}
    missing_on_disk = db_pids - set(all_found_items.keys())

    if missing_on_disk and subscribed_vdf_map is not None:
        missing_updates = []
        for pid in missing_on_disk:
            if pid in subscribed_vdf_map:
                # Subscribed in Steam, but no files locally (e.g. disabled in Steam or downloading)
                unsub = 0
                dis = 1 if subscribed_vdf_map[pid] else 0
            else:
                # NOT in subscriptions.vdf -> User unsubscribed directly in Steam!
                unsub = 1
                dis = 0
            missing_updates.append((0, unsub, dis, now, pid))

        cur.executemany("""
            UPDATE workshop_items
            SET is_present_locally = ?,
                is_unsubscribed = ?,
                is_disabled = ?,
                last_verified_at = ?
            WHERE published_file_id = ?
        """, missing_updates)

    # 5. Insert any items from subscriptions.vdf that aren't even in DB yet
    if subscribed_vdf_map is not None:
        new_vdf_pids = set(subscribed_vdf_map.keys()) - db_pids - set(all_found_items.keys())
        if new_vdf_pids:
            new_vdf_params = [
                (
                    pid,
                    APP_ID,
                    0,
                    0,
                    1 if subscribed_vdf_map[pid] else 0,
                    now,
                    now
                )
                for pid in new_vdf_pids
            ]
            cur.executemany("""
            INSERT OR IGNORE INTO workshop_items (
                published_file_id, app_id, is_present_locally, is_unsubscribed, is_disabled,
                first_discovered_at, last_verified_at, user_tags, deactivated_steam_tags
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, '[]', '[]'
            )
            """, new_vdf_params)

    conn.commit()

    # Deterministic selection strictly by numeric PublishedFileID ascending
    cur.execute("SELECT published_file_id FROM workshop_items WHERE is_unsubscribed = 0 OR is_present_locally = 1")
    active_ids = [str(r[0]) for r in cur.fetchall()]
    conn.close()

    sorted_ids = sorted(active_ids, key=lambda x: int(x))

    if MAX_WORKSHOP_ITEMS is not None and len(sorted_ids) > MAX_WORKSHOP_ITEMS:
        selected_ids = sorted_ids[:MAX_WORKSHOP_ITEMS]
        is_limited = True
    else:
        selected_ids = sorted_ids
        is_limited = False

    return {
        "total_found_locally": total_found,
        "processed_count": len(selected_ids),
        "limit_applied": MAX_WORKSHOP_ITEMS,
        "is_limited": is_limited,
        "content_dir": content_dir_found,
        "selected_ids": selected_ids
    }
