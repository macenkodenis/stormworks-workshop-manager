import httpx
import os
import shutil
import time
from pathlib import Path
from typing import Optional, List
from ..config import PREVIEWS_DIR
from ..db.session import get_connection

async def ensure_preview_cached(item_id: str, preview_url: Optional[str], local_source: Optional[str], client: Optional[httpx.AsyncClient] = None) -> Optional[str]:
    """
    Ensures that a preview image is saved in the permanent cache directory.
    Priority:
    1. Already existing cache file.
    2. Local file from item directory (workshop_preview.png / mod.png).
    3. Download from Steam CDN preview_url.
    """
    target_file = PREVIEWS_DIR / f"{item_id}.jpg"
    if target_file.exists() and target_file.stat().st_size > 0:
        return str(target_file)

    # Try local source first if available
    if local_source and os.path.exists(local_source):
        try:
            shutil.copy2(local_source, target_file)
            return str(target_file)
        except Exception as e:
            print(f"Failed to copy local preview for {item_id}: {e}")

    # Fallback to Steam CDN
    if preview_url:
        try:
            if client:
                resp = await client.get(preview_url)
            else:
                async with httpx.AsyncClient(timeout=10.0) as cl:
                    resp = await cl.get(preview_url)
            if resp.status_code == 200 and len(resp.content) > 0:
                with open(target_file, "wb") as f:
                    f.write(resp.content)
                return str(target_file)
        except Exception as e:
            print(f"Failed to download preview for {item_id} from {preview_url}: {e}")

    return None

async def cache_previews_for_items(item_ids: List[str]):
    """
    Processes preview caching for a list of items.
    """
    conn = get_connection()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(item_ids))
    cur.execute(f"""
        SELECT published_file_id, api_preview_url, local_preview_path, local_path
        FROM workshop_items
        WHERE published_file_id IN ({placeholders})
    """, item_ids)
    rows = cur.fetchall()
    conn.close()

    now = int(time.time())
    updated = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for r in rows:
            item_id = r["published_file_id"]
            url = r["api_preview_url"]
            loc_prev = r["local_preview_path"]
            cached_path = await ensure_preview_cached(item_id, url, loc_prev, client=client)
            if cached_path:
                updated.append((cached_path, now, item_id))

    if updated:
        conn = get_connection()
        cur = conn.cursor()
        cur.executemany("""
            UPDATE workshop_items SET
                local_preview_path = ?,
                preview_downloaded_at = ?
            WHERE published_file_id = ?
        """, updated)
        conn.commit()
        conn.close()
