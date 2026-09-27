import re
import time
import json
import httpx
from typing import Dict, Any, List, Optional
from ..config import APP_ID, STEAM_API_BATCH_SIZE, STEAM_API_TIMEOUT_SECONDS
from ..db.session import get_connection
from .client import scrape_workshop_details
from .steam_service import SteamService

COLLECTION_DETAILS_URL = "https://api.steampowered.com/ISteamRemoteStorage/GetCollectionDetails/v1/"
PUBLISHED_FILE_DETAILS_URL = "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/"

def extract_collection_id(input_str: str) -> Optional[str]:
    """Extracts numeric collection ID from URL or raw ID string."""
    if not input_str:
        return None
    cleaned = str(input_str).strip()
    match = re.search(r'(?:id=|\/sharedfiles\/filedetails\/\?id=|^)(\d+)', cleaned)
    if match:
        return match.group(1)
    return None

async def fetch_steam_collection_info(collection_id: str) -> Dict[str, Any]:
    """
    Fetches children items and metadata for a Steam Workshop collection.
    Returns metadata, item IDs, and local database availability stats.
    """
    col_id = extract_collection_id(collection_id)
    if not col_id:
        raise ValueError("Некоректний ID або посилання на колекцію Steam")

    async with httpx.AsyncClient(timeout=STEAM_API_TIMEOUT_SECONDS) as client:
        # 1. Fetch collection children list
        form_data = {
            "collectioncount": "1",
            "publishedfileids[0]": str(col_id)
        }
        resp = await client.post(
            COLLECTION_DETAILS_URL,
            data=form_data,
            headers={"User-Agent": "StormworksWorkshopManager/1.0"}
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Steam API повернув помилку {resp.status_code}")

        data = resp.json().get("response", {})
        details = data.get("collectiondetails", [])
        if not details or details[0].get("result") != 1:
            res_code = details[0].get("result") if details else "Unknown"
            raise RuntimeError(f"Колекцію не знайдено або вона приватна (код результату: {res_code})")

        children_raw = details[0].get("children", [])
        item_ids = [str(c["publishedfileid"]) for c in children_raw if "publishedfileid" in c]

        # 2. Fetch metadata of the collection itself
        meta_data = {
            "itemcount": "1",
            "publishedfileids[0]": str(col_id)
        }
        meta_resp = await client.post(
            PUBLISHED_FILE_DETAILS_URL,
            data=meta_data,
            headers={"User-Agent": "StormworksWorkshopManager/1.0"}
        )
        title = f"Collection #{col_id}"
        description = ""
        preview_url = None
        creator = None

        if meta_resp.status_code == 200:
            meta_json = meta_resp.json().get("response", {})
            file_details = meta_json.get("publishedfiledetails", [])
            if file_details:
                item_meta = file_details[0]
                title = item_meta.get("title") or title
                description = item_meta.get("description") or ""
                preview_url = item_meta.get("preview_url")
                creator = item_meta.get("creator")

        # Fallback to scraping if title is default
        if title == f"Collection #{col_id}":
            scraped = await scrape_workshop_details(col_id, client)
            if scraped:
                title = scraped.get("title") or title
                description = scraped.get("description") or description
                preview_url = scraped.get("preview_url") or preview_url
                creator = scraped.get("author") or creator

        # 3. Check stats against local SQLite database
        conn = get_connection()
        cur = conn.cursor()
        placeholders = ",".join(["?"] * len(item_ids)) if item_ids else ""
        existing_map = {}
        if placeholders:
            cur.execute(
                f"SELECT published_file_id, api_title, api_preview_url, local_preview_path, is_unsubscribed, is_disabled, is_present_locally FROM workshop_items WHERE published_file_id IN ({placeholders})",
                item_ids
            )
            for r in cur.fetchall():
                existing_map[str(r["published_file_id"])] = {
                    "title": r["api_title"],
                    "preview_url": r["api_preview_url"],
                    "local_preview_path": r["local_preview_path"],
                    "is_unsubscribed": bool(r["is_unsubscribed"]),
                    "is_disabled": bool(r["is_disabled"]),
                    "is_present_locally": bool(r["is_present_locally"])
                }
        conn.close()

        # 4. Fetch details for items needing titles / previews
        ids_needing_details = [iid for iid in item_ids if iid not in existing_map or not existing_map[iid].get("title")]
        remote_details_map = {}
        if ids_needing_details:
            async with httpx.AsyncClient(timeout=STEAM_API_TIMEOUT_SECONDS) as client:
                for i in range(0, len(ids_needing_details), STEAM_API_BATCH_SIZE):
                    batch = ids_needing_details[i:i + STEAM_API_BATCH_SIZE]
                    form_data = {"itemcount": str(len(batch))}
                    for idx, item_id in enumerate(batch):
                        form_data[f"publishedfileids[{idx}]"] = str(item_id)
                    try:
                        resp = await client.post(
                            PUBLISHED_FILE_DETAILS_URL,
                            data=form_data,
                            headers={"User-Agent": "StormworksWorkshopManager/1.0"}
                        )
                        if resp.status_code == 200:
                            b_details = resp.json().get("response", {}).get("publishedfiledetails", [])
                            for b_item in b_details:
                                b_pid = str(b_item.get("publishedfileid"))
                                remote_details_map[b_pid] = {
                                    "title": b_item.get("title") or f"Mod #{b_pid}",
                                    "preview_url": b_item.get("preview_url") or ""
                                }
                    except Exception:
                        pass

        items_details = []
        for iid in item_ids:
            local = existing_map.get(iid)
            remote = remote_details_map.get(iid, {})
            title_val = (local.get("title") if local else None) or remote.get("title") or f"Mod #{iid}"
            preview_val = (local.get("preview_url") if local else None) or remote.get("preview_url") or ""
            is_installed = bool(local and not local.get("is_unsubscribed"))

            items_details.append({
                "published_file_id": iid,
                "title": title_val,
                "preview_url": preview_val,
                "is_installed": is_installed
            })

        installed_count = sum(1 for iid in item_ids if iid in existing_map and not existing_map[iid]["is_unsubscribed"])
        unsubscribed_existing = sum(1 for iid in item_ids if iid in existing_map and existing_map[iid]["is_unsubscribed"])
        not_in_db_count = len(item_ids) - len(existing_map)

        return {
            "steam_collection_id": str(col_id),
            "title": title,
            "description": description,
            "preview_url": preview_url,
            "creator": creator,
            "total_items": len(item_ids),
            "installed_count": installed_count,
            "missing_count": not_in_db_count + unsubscribed_existing,
            "not_in_db_count": not_in_db_count,
            "item_ids": item_ids,
            "items_details": items_details
        }

async def import_steam_collection(
    collection_id: str,
    auto_subscribe: bool = False,
    custom_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Imports a collection from Steam Workshop into the local manager:
    1. Fetches metadata and children list from Steam API.
    2. For items not in local DB: fetches their Steam details and saves as unsubscribed items (or subscribes if auto_subscribe=True).
    3. Creates collection record and binds all items in collection_items.
    """
    info = await fetch_steam_collection_info(collection_id)
    item_ids = info["item_ids"]
    col_id = info["steam_collection_id"]

    name = custom_name.strip() if custom_name and custom_name.strip() else info["title"]
    description = info["description"]
    now = int(time.time())

    conn = get_connection()
    cur = conn.cursor()

    # Determine which items are missing from workshop_items
    placeholders = ",".join(["?"] * len(item_ids)) if item_ids else ""
    existing_ids = set()
    if placeholders:
        cur.execute(
            f"SELECT published_file_id FROM workshop_items WHERE published_file_id IN ({placeholders})",
            item_ids
        )
        existing_ids = {str(r[0]) for r in cur.fetchall()}

    missing_ids = [iid for iid in item_ids if iid not in existing_ids]

    # Fetch details for missing items from Steam Web API in batches
    if missing_ids:
        async with httpx.AsyncClient(timeout=STEAM_API_TIMEOUT_SECONDS) as client:
            for i in range(0, len(missing_ids), STEAM_API_BATCH_SIZE):
                batch = missing_ids[i:i + STEAM_API_BATCH_SIZE]
                form_data = {"itemcount": str(len(batch))}
                for idx, item_id in enumerate(batch):
                    form_data[f"publishedfileids[{idx}]"] = str(item_id)

                try:
                    resp = await client.post(
                        PUBLISHED_FILE_DETAILS_URL,
                        data=form_data,
                        headers={"User-Agent": "StormworksWorkshopManager/1.0"}
                    )
                    if resp.status_code == 200:
                        batch_details = resp.json().get("response", {}).get("publishedfiledetails", [])
                        for item in batch_details:
                            pid = str(item.get("publishedfileid"))
                            title = item.get("title") or f"Mod #{pid}"
                            desc = item.get("description") or ""
                            creator = item.get("creator")
                            preview_url = item.get("preview_url")
                            time_created = item.get("time_created")
                            time_updated = item.get("time_updated")
                            file_size = item.get("file_size")
                            raw_tags = [t.get("tag") for t in item.get("tags", []) if isinstance(t, dict) and "tag" in t]
                            tags_json = json.dumps(raw_tags) if raw_tags else '[]'

                            # Insert into workshop_items as unsubscribed
                            cur.execute("""
                            INSERT INTO workshop_items (
                                published_file_id, app_id, api_title, api_description,
                                api_creator, api_preview_url, api_time_created, api_time_updated,
                                api_file_size, api_tags, original_steam_tags, api_result,
                                api_last_synced_at, is_present_locally, is_unsubscribed, is_disabled,
                                first_discovered_at, last_verified_at, user_tags, deactivated_steam_tags
                            ) VALUES (
                                ?, ?, ?, ?,
                                ?, ?, ?, ?,
                                ?, ?, ?, ?,
                                ?, 0, 1, 1,
                                ?, ?, '[]', '[]'
                            )
                            ON CONFLICT(published_file_id) DO UPDATE SET
                                api_title = COALESCE(excluded.api_title, workshop_items.api_title),
                                api_description = COALESCE(excluded.api_description, workshop_items.api_description),
                                api_creator = COALESCE(excluded.api_creator, workshop_items.api_creator),
                                api_preview_url = COALESCE(excluded.api_preview_url, workshop_items.api_preview_url),
                                api_time_created = COALESCE(excluded.api_time_created, workshop_items.api_time_created),
                                api_time_updated = COALESCE(excluded.api_time_updated, workshop_items.api_time_updated),
                                api_file_size = COALESCE(excluded.api_file_size, workshop_items.api_file_size),
                                original_steam_tags = COALESCE(workshop_items.original_steam_tags, excluded.original_steam_tags),
                                api_tags = CASE
                                    WHEN workshop_items.is_sorted = 1 
                                         OR (workshop_items.deactivated_steam_tags IS NOT NULL AND workshop_items.deactivated_steam_tags != '[]') 
                                         OR (workshop_items.user_tags IS NOT NULL AND workshop_items.user_tags != '[]') 
                                    THEN workshop_items.api_tags
                                    ELSE COALESCE(excluded.api_tags, workshop_items.api_tags)
                                END,
                                api_last_synced_at = excluded.api_last_synced_at,
                                last_verified_at = excluded.last_verified_at
                            """, (
                                pid, APP_ID, title, desc,
                                creator, preview_url, time_created, time_updated,
                                file_size, tags_json, tags_json, item.get("result", 1),
                                now, now, now
                            ))
                except Exception as e:
                    print(f"Error fetching metadata for missing items batch: {e}")

    # Create Collection record
    cur.execute("""
    INSERT INTO collections (name, description, steam_collection_id, color, icon, created_at, updated_at)
    VALUES (?, ?, ?, '#66c0f4', 'folder', ?, ?)
    """, (name, description, col_id, now, now))
    created_col_id = cur.lastrowid

    # Insert items into collection_items
    collection_items_data = [(created_col_id, str(iid), idx, now) for idx, iid in enumerate(item_ids)]
    cur.executemany("""
    INSERT OR REPLACE INTO collection_items (collection_id, published_file_id, sort_order, added_at)
    VALUES (?, ?, ?, ?)
    """, collection_items_data)

    conn.commit()
    conn.close()

    # Handle auto-subscription if user requested it
    subscribed_count = 0
    if auto_subscribe and missing_ids:
        try:
            sub_res = await SteamService.set_items_subscription(missing_ids, is_subscribed=True)
            subscribed_count = sub_res.get("affected", 0)
        except Exception as e:
            print(f"Failed to auto-subscribe missing items: {e}")

    return {
        "status": "ok",
        "collection_id": created_col_id,
        "name": name,
        "steam_collection_id": col_id,
        "total_items": len(item_ids),
        "missing_imported_as_unsubscribed": len(missing_ids),
        "auto_subscribed_count": subscribed_count
    }
