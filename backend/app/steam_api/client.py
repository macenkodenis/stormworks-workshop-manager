import httpx
import json
import time
import asyncio
import re
from typing import List, Dict, Any, Optional
from ..config import STEAM_API_BATCH_SIZE, STEAM_API_TIMEOUT_SECONDS
from ..db.session import get_connection

from .languages import get_steam_language

STEAM_API_URL = "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/"

import html

async def scrape_workshop_details(item_id: str, client: httpx.AsyncClient, lang_code: str = "en") -> Optional[Dict[str, Any]]:
    """
    Scrapes public workshop details from Steam Community webpage.
    Supports fetching localized content (e.g. Ukrainian description) via Steam_Language cookie and query param.
    """
    steam_lang = get_steam_language(lang_code)
    url = f"https://steamcommunity.com/sharedfiles/filedetails/?id={item_id}&l={steam_lang}"
    headers = {
        "User-Agent": "curl/8.0",
        "Cookie": f"Steam_Language={steam_lang}; birthtime=568022401; mature_content=1"
    }
    try:
        resp = await client.get(
            url,
            timeout=8.0,
            follow_redirects=True,
            headers=headers
        )
        if resp.status_code != 200:
            return None
        text = resp.text

        title_m = re.search(r'<div class="workshopItemTitle">([^<]+)</div>', text)
        title = html.unescape(title_m.group(1).strip()) if title_m else None
        if not title:
            og_m = re.search(r'<meta property="og:title" content="Steam Workshop::([^"]+)">', text)
            title = html.unescape(og_m.group(1).strip()) if og_m else None

        # Tags
        tags = []
        for t in re.findall(r'<a[^>]+href="[^"]*requiredtags[^"]*"[^>]*>([^<]+)</a>', text):
            cleaned = html.unescape(t.strip())
            if cleaned and cleaned not in tags:
                tags.append(cleaned)

        # Author / Creator
        author_m = re.search(r'<div class="friendBlockContent">\s*([^<\r\n]+)', text)
        author = html.unescape(author_m.group(1).strip()) if author_m else None

        # Description
        desc_m = re.search(r'<div class="workshopItemDescription" id="highlightContent">([\s\S]*?)</div>', text)
        description = None
        if desc_m:
            raw = re.sub(r'<br\s*/?>', '\n', desc_m.group(1))
            description = html.unescape(re.sub(r'<[^>]+>', '', raw).strip())

        # Preview URL
        img_m = re.search(r'<img id="previewImageMain"[^>]*src="([^"]+)"', text) or re.search(r'<img id="previewImage"[^>]*src="([^"]+)"', text)
        preview_url = img_m.group(1).split("?")[0] if img_m else None

        if title or tags or author or description:
            return {
                "title": title,
                "author": author,
                "tags": tags,
                "description": description,
                "preview_url": preview_url
            }
    except Exception as e:
        print(f"Error scraping workshop page for {item_id} (lang={lang_code}): {e}")
    return None

async def fetch_steam_api_details(item_ids: List[str], lang_code: str = "en") -> Dict[str, Any]:
    """
    Fetches details for given publishedfileids from Steam Web API in batches.
    Also ensures descriptions for English (and active language if different) are populated
    without overwriting the base English api_description required by AutoClassifier.
    """
    if not item_ids:
        return {"updated_count": 0, "failed_count": 0}

    results = []
    failed_count = 0

    batches = [item_ids[i:i + STEAM_API_BATCH_SIZE] for i in range(0, len(item_ids), STEAM_API_BATCH_SIZE)]
    sem = asyncio.Semaphore(4)

    async def fetch_batch(client: httpx.AsyncClient, batch: List[str]):
        form_data = {"itemcount": str(len(batch))}
        for idx, item_id in enumerate(batch):
            form_data[f"publishedfileids[{idx}]"] = str(item_id)
        async with sem:
            try:
                response = await client.post(
                    STEAM_API_URL,
                    data=form_data,
                    headers={"User-Agent": "StormworksWorkshopManager/1.0"}
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("response", {}).get("publishedfiledetails", []), 0
                return [], len(batch)
            except Exception as e:
                print(f"Error requesting Steam API batch: {e}")
                return [], len(batch)

    async with httpx.AsyncClient(timeout=STEAM_API_TIMEOUT_SECONDS) as client:
        batch_tasks = [fetch_batch(client, b) for b in batches]
        batch_outputs = await asyncio.gather(*batch_tasks)
        for details, failed in batch_outputs:
            results.extend(details)
            failed_count += failed

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

            # If Steam API returned result != 1 or title was empty, try scraping public workshop page
            if (result_code != 1 or not title):
                scraped = await scrape_workshop_details(item_id, client, lang_code="en")
                if scraped:
                    title = scraped.get("title") or title
                    creator = scraped.get("author") or creator
                    if scraped.get("tags"):
                        raw_tags = scraped["tags"]
                    preview_url = scraped.get("preview_url") or preview_url
                    description = scraped.get("description") or description
                    if title:
                        result_code = 1

            tags_json = json.dumps(raw_tags) if raw_tags else '[]'

            # Load existing api_descriptions_json
            cur.execute("SELECT api_descriptions_json FROM workshop_items WHERE published_file_id = ?", (item_id,))
            row = cur.fetchone()
            descs = {}
            if row and row["api_descriptions_json"]:
                try:
                    descs = json.loads(row["api_descriptions_json"])
                except Exception:
                    descs = {}

            # Cache the base English description
            if description and "en" not in descs:
                descs["en"] = description

            descs_json = json.dumps(descs)

            cur.execute("""
            UPDATE workshop_items SET
                api_title = COALESCE(?, api_title),
                api_description = COALESCE(?, api_description),
                api_creator = COALESCE(?, api_creator),
                api_preview_url = COALESCE(?, api_preview_url),
                api_time_created = COALESCE(?, api_time_created),
                api_time_updated = COALESCE(?, api_time_updated),
                api_file_size = COALESCE(?, api_file_size),
                api_subscriptions = COALESCE(?, api_subscriptions),
                api_favorited = COALESCE(?, api_favorited),
                api_views = COALESCE(?, api_views),
                api_tags = CASE 
                    WHEN is_sorted = 1 
                         OR (deactivated_steam_tags IS NOT NULL AND deactivated_steam_tags != '[]') 
                         OR (user_tags IS NOT NULL AND user_tags != '[]') 
                    THEN api_tags
                    WHEN ? != '[]' THEN ? 
                    ELSE api_tags 
                END,
                original_steam_tags = COALESCE(original_steam_tags, CASE WHEN ? != '[]' THEN ? ELSE NULL END),
                api_result = ?,
                api_last_synced_at = ?,
                api_descriptions_json = ?
            WHERE published_file_id = ?
            """, (
                title, description, creator, preview_url, time_created,
                time_updated, file_size, subscriptions, favorited, views,
                tags_json, tags_json, tags_json, tags_json, result_code, now,
                descs_json, item_id
            ))
            if cur.rowcount > 0:
                updated_count += 1

        conn.commit()
        conn.close()

    # If the user's active language is not English, fetch localized descriptions for these items
    if lang_code and lang_code.lower() != "en":
        try:
            await fetch_localized_descriptions(item_ids, lang_code=lang_code)
        except Exception as e:
            print(f"Error fetching localized descriptions for {lang_code}: {e}")

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

async def fetch_localized_descriptions(item_ids: List[str], lang_code: str = "ua") -> Dict[str, Any]:
    """
    Fetches localized descriptions from Steam Community for given item_ids and saves them
    into api_descriptions_json under the key `lang_code`.
    Never overwrites the base English `api_description`.
    """
    if not item_ids or not lang_code or lang_code.lower() == "en":
        return {"updated_count": 0}

    sem = asyncio.Semaphore(5)

    async def fetch_one(client, item_id):
        async with sem:
            scraped = await scrape_workshop_details(item_id, client, lang_code=lang_code)
            return item_id, (scraped.get("description") if scraped else None)

    updated_count = 0
    async with httpx.AsyncClient() as client:
        for chunk in [item_ids[i:i + 20] for i in range(0, len(item_ids), 20)]:
            results = await asyncio.gather(*[fetch_one(client, target_item_id) for target_item_id in chunk])
            conn = get_connection()
            cur = conn.cursor()
            for target_item_id, localized_description in results:
                if localized_description:
                    cur.execute("SELECT api_description, api_descriptions_json FROM workshop_items WHERE published_file_id = ?", (target_item_id,))
                    row = cur.fetchone()
                    if row:
                        descs = {}
                        if row["api_descriptions_json"]:
                            try:
                                descs = json.loads(row["api_descriptions_json"])
                            except Exception:
                                descs = {}
                        if row["api_description"] and "en" not in descs:
                            descs["en"] = row["api_description"]

                        descs[lang_code.lower()] = localized_description
                        cur.execute("UPDATE workshop_items SET api_descriptions_json = ? WHERE published_file_id = ?", (json.dumps(descs), target_item_id))
                        updated_count += 1
            conn.commit()
            conn.close()

    return {"updated_count": updated_count, "lang": lang_code}

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

    async def fetch_one(client, author_steam_id):
        async with sem:
            name = await resolve_steam_author(client, author_steam_id)
            return author_steam_id, name

    resolved_count = 0
    async with httpx.AsyncClient() as client:
        for chunk in [missing_ids[i:i + 25] for i in range(0, len(missing_ids), 25)]:
            results = await asyncio.gather(*[fetch_one(client, author_steam_id) for author_steam_id in chunk])
            conn = get_connection()
            cur = conn.cursor()
            now = int(time.time())
            for author_steam_id, name in results:
                if name:
                    cur.execute("""
                    INSERT OR REPLACE INTO steam_authors (steam_id, persona_name, updated_at)
                    VALUES (?, ?, ?)
                    """, (author_steam_id, name, now))
                    resolved_count += 1
            conn.commit()
            conn.close()

    return {"resolved": resolved_count, "total": len(missing_ids)}

