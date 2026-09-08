import httpx
import json
import time
import asyncio
import re
from typing import List, Dict, Any, Optional
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

    # Trigger background resolution of any newly discovered creators
    try:
        asyncio.create_task(resolve_missing_authors())
    except Exception:
        pass

    return {
        "total_requested": len(item_ids),
        "updated_count": updated_count,
        "failed_count": failed_count
    }

async def resolve_steam_author(client: httpx.AsyncClient, steam_id: str) -> Optional[str]:
    """Resolves Steam persona name from public Steam Community profile XML."""
    try:
        url = f"https://steamcommunity.com/profiles/{steam_id}/?xml=1"
        resp = await client.get(url, timeout=7.0, headers={"User-Agent": "StormworksWorkshopManager/1.0"})
        if resp.status_code == 200:
            m = re.search(r'<steamID><!\[CDATA\[(.*?)\]\]></steamID>', resp.text) or re.search(r'<steamID>(.*?)</steamID>', resp.text)
            if m:
                name = m.group(1).strip()
                if name:
                    return name
    except Exception:
        pass
    return None

async def resolve_missing_authors(limit: int = 500) -> Dict[str, Any]:
    """Finds creators with no cached persona_name and resolves them in batches."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
    SELECT DISTINCT w.api_creator
    FROM workshop_items w
    LEFT JOIN steam_authors a ON w.api_creator = a.steam_id
    WHERE w.api_creator IS NOT NULL AND w.api_creator != '' AND (a.persona_name IS NULL OR a.persona_name = '')
    LIMIT ?
    """, (limit,))
    missing_ids = [r[0] for r in cur.fetchall()]
    conn.close()

    if not missing_ids:
        return {"resolved": 0, "total": 0}

    sem = asyncio.Semaphore(6)

    async def fetch_one(client, sid):
        async with sem:
            name = await resolve_steam_author(client, sid)
            return sid, name

    resolved_count = 0
    async with httpx.AsyncClient() as client:
        for chunk in [missing_ids[i:i + 25] for i in range(0, len(missing_ids), 25)]:
            results = await asyncio.gather(*[fetch_one(client, sid) for sid in chunk])
            conn = get_connection()
            cur = conn.cursor()
            now = int(time.time())
            for sid, name in results:
                if name:
                    cur.execute("""
                    INSERT OR REPLACE INTO steam_authors (steam_id, persona_name, updated_at)
                    VALUES (?, ?, ?)
                    """, (sid, name, now))
                    resolved_count += 1
            conn.commit()
            conn.close()

    return {"resolved": resolved_count, "total": len(missing_ids)}

