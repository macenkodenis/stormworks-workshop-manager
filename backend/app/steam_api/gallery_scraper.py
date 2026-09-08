import httpx
import re
from typing import List
from ..db.session import get_connection

async def get_workshop_gallery_images(item_id: str, default_preview_url: str = None) -> List[str]:
    """
    Fetches full screenshot gallery directly from Steam Workshop page for given item_id.
    Results are cached in SQLite for instant subsequent loads.
    """
    conn = get_connection()
    cur = conn.cursor()

    # Check if we already have column api_gallery_json or cached gallery
    # Let us ensure column exists
    try:
        cur.execute("SELECT api_gallery_json FROM workshop_items WHERE published_file_id = ?", (item_id,))
        row = cur.fetchone()
        if row and row["api_gallery_json"]:
            import json
            cached = json.loads(row["api_gallery_json"])
            if cached and isinstance(cached, list) and len(cached) > 0:
                conn.close()
                return cached
    except Exception:
        pass

    # Not cached, fetch from Steam Community page
    gallery_urls: List[str] = []
    url = f"https://steamcommunity.com/sharedfiles/filedetails/?id={item_id}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    }

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                html = resp.text
                
                # 1. Look for highlight_strip_screenshot img tags
                # Matches: <div ... class="...highlight_strip_screenshot..." ...> <img src="...">
                strip_imgs = re.findall(r'class="[^"]*highlight_strip_screenshot[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"', html)
                
                for img_url in strip_imgs:
                    # Clean query params like ?imw=116... to get full resolution
                    full_res = img_url.split("?")[0]
                    if full_res not in gallery_urls:
                        gallery_urls.append(full_res)
    except Exception as e:
        print(f"Error fetching gallery for item {item_id}: {e}")

    # Fallback to default preview if no extra gallery screenshots were found
    if not gallery_urls and default_preview_url:
        gallery_urls.append(default_preview_url)

    # Save to SQLite cache
    if gallery_urls:
        try:
            import json
            cur.execute("""
                UPDATE workshop_items
                SET api_gallery_json = ?
                WHERE published_file_id = ?
            """, (json.dumps(gallery_urls), item_id))
            conn.commit()
        except Exception:
            pass

    conn.close()
    return gallery_urls
