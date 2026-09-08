import httpx
import json
import time
from typing import List, Dict, Any
from ..config import STEAM_API_BATCH_SIZE, STEAM_API_TIMEOUT_SECONDS
from ..db.session import get_connection

STEAM_API_URL = "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/"

async def fetch_steam_api_details(item_ids: List[str]) -> Dict[str, Any]:
    """
    Fetches details for given publishedfileids from Steam Web API in batches.
    Does not require an API key for public items.
    """
    if not item_ids:
        return {"updated_count": 0, "failed_count": 0}

    results = []
    failed_count = 0

    async with httpx.AsyncClient(timeout=STEAM_API_TIMEOUT_SECONDS) as client:
        for i in range(0, len(item_ids), STEAM_API_BATCH_SIZE):
            batch = item_ids[i:i + STEAM_API_BATCH_SIZE]
            form_data = {"itemcount": str(len(batch))}
            for idx, item_id in enumerate(batch):
                form_data[f"publishedfileids[{idx}]"] = str(item_id)

            try:
                response = await client.post(
                    STEAM_API_URL,
                    data=form_data,
                    headers={"User-Agent": "StormworksWorkshopManager/1.0"}
                )
                if response.status_code == 200:
                    data = response.json()
                    details = data.get("response", {}).get("publishedfiledetails", [])
                    results.extend(details)
                else:
                    print(f"Steam API returned status {response.status_code} for batch {i}")
                    failed_count += len(batch)
            except Exception as e:
                print(f"Error requesting Steam API batch: {e}")
                failed_count += len(batch)

    # Update database with fetched data
    conn = get_connection()
    cur = conn.cursor()
    now = int(time.time())
    updated_count = 0

    for item in results:
        item_id = str(item.get("publishedfileid"))
        result_code = item.get("result", 1)
        title = item.get("title")
        description = item.get("description")
        creator = item.get("creator")
        preview_url = item.get("preview_url")
        time_created = item.get("time_created")
        time_updated = item.get("time_updated")
        file_size = item.get("file_size")
        subscriptions = item.get("subscriptions", 0)
        favorited = item.get("favorited", 0)
        views = item.get("views", 0)
        raw_tags = [t.get("tag") for t in item.get("tags", []) if isinstance(t, dict) and "tag" in t]
        tags_json = json.dumps(raw_tags)

        cur.execute("""
        UPDATE workshop_items SET
            api_title = ?,
            api_description = ?,
            api_creator = ?,
            api_preview_url = ?,
            api_time_created = ?,
            api_time_updated = ?,
            api_file_size = ?,
            api_subscriptions = ?,
            api_favorited = ?,
            api_views = ?,
            api_tags = ?,
            original_steam_tags = COALESCE(original_steam_tags, ?),
            api_result = ?,
            api_last_synced_at = ?
        WHERE published_file_id = ?
        """, (
            title, description, creator, preview_url, time_created,
            time_updated, file_size, subscriptions, favorited, views,
            tags_json, tags_json, result_code, now, item_id
        ))
        if cur.rowcount > 0:
            updated_count += 1

    conn.commit()
    conn.close()

    return {
        "total_requested": len(item_ids),
        "updated_count": updated_count,
        "failed_count": failed_count
    }
