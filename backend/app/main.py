from .steam_api.gallery_scraper import get_workshop_gallery_images
from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Any
import json
import time
from pathlib import Path

from .config import APP_ID, MAX_WORKSHOP_ITEMS, STATIC_DIR, PREVIEWS_DIR
from .db.session import init_db, get_connection
from .scanner.workshop_scanner import scan_local_workshop
from .steam_api.client import fetch_steam_api_details
from .cache.preview_cache import cache_previews_for_items
from .unsubscribe.provider import UnsubscribeProvider
from .steam_api.steam_service import SteamService

app = FastAPI(title="Stormworks Workshop Manager API", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global scan status tracker
scan_state = {
    "is_scanning": False,
    "last_scan_info": None,
    "total_found": 0,
    "processed_count": 0,
    "limit": MAX_WORKSHOP_ITEMS
}

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/status")
def get_status():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM workshop_items")
    db_items_count = cur.fetchone()[0]
    conn.close()

    return {
        "app_id": APP_ID,
        "max_limit": MAX_WORKSHOP_ITEMS,
        "db_cached_items": db_items_count,
        "scan_state": scan_state
    }

async def run_full_sync():
    scan_state["is_scanning"] = True
    try:
        # Step 1: Scan local filesystem & manifest
        scan_res = scan_local_workshop()
        scan_state["total_found"] = scan_res["total_found_locally"]
        scan_state["processed_count"] = scan_res["processed_count"]
        selected_ids = scan_res["selected_ids"]

        # Step 2: Fetch Steam Web API details
        await fetch_steam_api_details(selected_ids)

        # Step 3: Cache previews locally
        await cache_previews_for_items(selected_ids)

        scan_state["last_scan_info"] = scan_res
    except Exception as e:
        print(f"Error during full sync: {e}")
    finally:
        scan_state["is_scanning"] = False

@app.post("/api/scan")
async def trigger_scan(background_tasks: BackgroundTasks):
    if scan_state["is_scanning"]:
        return {"status": "already_running"}
    background_tasks.add_task(run_full_sync)
    return {"status": "started", "limit": MAX_WORKSHOP_ITEMS}

@app.get("/api/items")
def list_items(
    q: Optional[str] = None,
    tag: Optional[str] = None,
    favorited: Optional[bool] = None,
    sort_by: str = Query("id", pattern="^(id|title|size|updated|created)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$")
):
    conn = get_connection()
    cur = conn.cursor()

    query = "SELECT * FROM workshop_items WHERE 1=1"
    params = []

    if q:
        query += " AND (api_title LIKE ? OR published_file_id LIKE ? OR api_description LIKE ?)"
        term = f"%{q}%"
        params.extend([term, term, term])

    if tag:
        query += " AND api_tags LIKE ?"
        params.append(f'%"{tag}"%')

    if favorited is not None:
        query += " AND is_favorited = ?"
        params.append(1 if favorited else 0)

    # Sorting
    sort_map = {
        "id": "CAST(published_file_id AS INTEGER)",
        "title": "api_title",
        "size": "COALESCE(local_size_bytes, api_file_size, 0)",
        "updated": "COALESCE(api_time_updated, local_mtime, 0)",
        "created": "COALESCE(api_time_created, 0)"
    }
    col = sort_map.get(sort_by, "CAST(published_file_id AS INTEGER)")
    query += f" ORDER BY {col} {sort_dir.upper()}"

    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    items = []
    for r in rows:
        tags = []
        if r["api_tags"]:
            try:
                tags = json.loads(r["api_tags"])
            except:
                tags = []
        
        user_tags = []
        if "user_tags" in r.keys() and r["user_tags"]:
            try:
                user_tags = json.loads(r["user_tags"])
            except:
                user_tags = []
        if "is_sorted" in r.keys() and r["is_sorted"] is not None:
            is_sorted = bool(r["is_sorted"])
        else:
            is_sorted = len(user_tags) > 0

        deactivated_steam_tags = []
        if "deactivated_steam_tags" in r.keys() and r["deactivated_steam_tags"]:
            try:
                deactivated_steam_tags = json.loads(r["deactivated_steam_tags"])
            except:
                deactivated_steam_tags = []

        original_steam_tags = []
        if "original_steam_tags" in r.keys() and r["original_steam_tags"]:
            try:
                original_steam_tags = json.loads(r["original_steam_tags"])
            except:
                original_steam_tags = tags
        else:
            original_steam_tags = tags

        is_favorited = bool(r["is_favorited"]) if "is_favorited" in r.keys() and r["is_favorited"] else False
        is_disabled = bool(r["is_disabled"]) if "is_disabled" in r.keys() and r["is_disabled"] else False

        items.append({
            "published_file_id": r["published_file_id"],
            "user_tags": user_tags,
            "deactivated_steam_tags": deactivated_steam_tags,
            "original_steam_tags": original_steam_tags,
            "is_favorited": is_favorited,
            "is_disabled": is_disabled,
            "is_sorted": is_sorted,
            "is_unsubscribed": bool(r["is_unsubscribed"]) if "is_unsubscribed" in r.keys() else False,
            "title": r["api_title"] or f"Item #{r['published_file_id']}",
            "description": r["api_description"],
            "creator": r["api_creator"],
            "preview_url": r["api_preview_url"],
            "has_local_preview": bool(r["local_preview_path"] and Path(r["local_preview_path"]).exists()),
            "time_created": r["api_time_created"],
            "time_updated": r["api_time_updated"],
            "api_file_size": r["api_file_size"],
            "local_size_bytes": r["local_size_bytes"],
            "local_mtime": r["local_mtime"],
            "is_present_locally": bool(r["is_present_locally"]),
            "tags": tags,
            "subscriptions": r["api_subscriptions"],
            "favorited": r["api_favorited"]
        })

    return {
        "total_items": len(items),
        "items": items
    }

@app.get("/api/previews/{item_id}")
def get_preview_image(item_id: str):
    preview_file = PREVIEWS_DIR / f"{item_id}.jpg"
    if preview_file.exists():
        return FileResponse(preview_file, media_type="image/jpeg")
    
    # Check if local item directory has a preview
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT local_preview_path FROM workshop_items WHERE published_file_id = ?", (item_id,))
    row = cur.fetchone()
    conn.close()

    if row and row["local_preview_path"] and Path(row["local_preview_path"]).exists():
        return FileResponse(row["local_preview_path"])

    raise HTTPException(status_code=404, detail="Preview not found")

class BulkItemRequest(BaseModel):
    item_ids: List[str]

@app.post("/api/unsubscribe/dry-run")
def dry_run_unsubscribe(payload: BulkItemRequest):
    return UnsubscribeProvider.generate_dry_run_plan(payload.item_ids)

@app.post("/api/unsubscribe/script")
def get_unsubscribe_script(payload: BulkItemRequest):
    script = UnsubscribeProvider.generate_browser_helper_script(payload.item_ids)
    return {"script": script}

# Serve frontend static build if present

@app.get("/api/items/{item_id}/gallery")
async def get_item_gallery(item_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT api_preview_url, local_preview_path FROM workshop_items WHERE published_file_id = ?", (item_id,))
    row = cur.fetchone()
    conn.close()

    default_preview = row["api_preview_url"] if row else None
    gallery = await get_workshop_gallery_images(item_id, default_preview)
    return {"item_id": item_id, "gallery": gallery}


class UserTagsPayload(BaseModel):
    tags: List[str]

class BulkAddTagPayload(BaseModel):
    item_ids: List[str]
    tag: str
    action: str = "add" # "add" or "remove"

@app.post("/api/items/{item_id}/user-tags")
def set_item_user_tags(item_id: str, payload: UserTagsPayload):
    conn = get_connection()
    cur = conn.cursor()
    tags_json = json.dumps(list(set(payload.tags)))
    cur.execute("UPDATE workshop_items SET user_tags = ?, is_sorted = 1 WHERE published_file_id = ?", (tags_json, item_id))
    conn.commit()
    conn.close()
    return {"status": "ok", "item_id": item_id, "user_tags": payload.tags, "is_sorted": True}

@app.post("/api/items/bulk-user-tags")
def bulk_update_user_tags(payload: BulkAddTagPayload):
    tag = payload.tag.strip()
    if not tag:
        raise HTTPException(status_code=400, detail="Tag cannot be empty")

    conn = get_connection()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(payload.item_ids))
    cur.execute(f"SELECT published_file_id, user_tags FROM workshop_items WHERE published_file_id IN ({placeholders})", payload.item_ids)
    rows = cur.fetchall()

    updated = []
    for r in rows:
        tags = []
        if r["user_tags"]:
            try:
                tags = json.loads(r["user_tags"])
            except:
                tags = []
        
        if payload.action == "add":
            exists = any(isinstance(t, str) and t.lower() == tag.lower() for t in tags)
            if not exists:
                tags.append(tag)
        elif payload.action == "remove":
            tags = [t for t in tags if isinstance(t, str) and t.lower() != tag.lower()]
        
        updated.append((json.dumps(sorted(tags)), r["published_file_id"]))

    if updated:
        cur.executemany("UPDATE workshop_items SET user_tags = ?, is_sorted = 1 WHERE published_file_id = ?", updated)
        conn.commit()
    conn.close()
    return {"status": "ok", "affected": len(updated)}

class BulkSteamTagPayload(BaseModel):
    item_ids: List[str]
    tag: str

@app.post("/api/items/bulk-steam-tags")
def bulk_update_steam_tags(payload: BulkSteamTagPayload):
    tag = payload.tag.strip()
    if not tag:
        raise HTTPException(status_code=400, detail="Tag cannot be empty")

    conn = get_connection()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(payload.item_ids))
    cur.execute(f"SELECT published_file_id, api_tags, deactivated_steam_tags FROM workshop_items WHERE published_file_id IN ({placeholders})", payload.item_ids)
    rows = cur.fetchall()

    updated = []
    for r in rows:
        tags = []
        if r["api_tags"]:
            try:
                tags = json.loads(r["api_tags"])
            except:
                tags = []
        
        deact = []
        if "deactivated_steam_tags" in r.keys() and r["deactivated_steam_tags"]:
            try:
                deact = json.loads(r["deactivated_steam_tags"])
            except:
                deact = []
        
        # Add tag to steam tags if not present
        exists = any(isinstance(t, str) and t.lower() == tag.lower() for t in tags)
        if not exists:
            tags.append(tag)
        
        # Reactivate if it was deactivated (remove from deactivated list)
        deact = [t for t in deact if isinstance(t, str) and t.lower() != tag.lower()]
        
        updated.append((json.dumps(tags), json.dumps(deact), r["published_file_id"]))

    if updated:
        cur.executemany("UPDATE workshop_items SET api_tags = ?, deactivated_steam_tags = ?, is_sorted = 1 WHERE published_file_id = ?", updated)
        conn.commit()
    conn.close()
    return {"status": "ok", "affected": len(updated)}

class BulkItemIdsPayload(BaseModel):
    item_ids: List[str]

@app.post("/api/items/{item_id}/clear-tags")
def clear_item_tags(item_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT api_tags FROM workshop_items WHERE published_file_id = ?", (item_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")
    
    tags = []
    if row["api_tags"]:
        try:
            tags = json.loads(row["api_tags"])
        except:
            tags = []
    
    cur.execute(
        "UPDATE workshop_items SET user_tags = '[]', deactivated_steam_tags = ?, is_sorted = 0 WHERE published_file_id = ?",
        (json.dumps(tags), item_id)
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "item_id": item_id, "user_tags": [], "deactivated_steam_tags": tags, "is_sorted": False}

@app.post("/api/items/bulk-clear-tags")
def bulk_clear_tags(payload: BulkItemIdsPayload):
    if not payload.item_ids:
        return {"status": "ok", "affected": 0}
    conn = get_connection()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(payload.item_ids))
    cur.execute(f"SELECT published_file_id, api_tags FROM workshop_items WHERE published_file_id IN ({placeholders})", payload.item_ids)
    rows = cur.fetchall()
    updated = []
    for r in rows:
        tags = []
        if r["api_tags"]:
            try:
                tags = json.loads(r["api_tags"])
            except:
                tags = []
        updated.append((json.dumps(tags), r["published_file_id"]))
    if updated:
        cur.executemany("UPDATE workshop_items SET user_tags = '[]', deactivated_steam_tags = ?, is_sorted = 0 WHERE published_file_id = ?", updated)
        conn.commit()
    conn.close()
    return {"status": "ok", "affected": len(updated)}

@app.post("/api/items/{item_id}/reset-tags")
def reset_item_tags(item_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT original_steam_tags, api_tags FROM workshop_items WHERE published_file_id = ?", (item_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")
    
    orig = row["original_steam_tags"] or row["api_tags"] or "[]"
    try:
        orig_tags = json.loads(orig)
    except:
        orig_tags = []
    
    cur.execute(
        "UPDATE workshop_items SET api_tags = ?, user_tags = '[]', deactivated_steam_tags = '[]', is_sorted = 0 WHERE published_file_id = ?",
        (json.dumps(orig_tags), item_id)
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "item_id": item_id, "tags": orig_tags, "user_tags": [], "deactivated_steam_tags": [], "is_sorted": False}

@app.post("/api/items/bulk-reset-tags")
def bulk_reset_tags(payload: BulkItemIdsPayload):
    if not payload.item_ids:
        return {"status": "ok", "affected": 0}
    conn = get_connection()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(payload.item_ids))
    cur.execute(f"SELECT published_file_id, original_steam_tags, api_tags FROM workshop_items WHERE published_file_id IN ({placeholders})", payload.item_ids)
    rows = cur.fetchall()
    updated = []
    for r in rows:
        orig = r["original_steam_tags"] or r["api_tags"] or "[]"
        try:
            orig_tags = json.loads(orig)
        except:
            orig_tags = []
        updated.append((json.dumps(orig_tags), r["published_file_id"]))
    if updated:
        cur.executemany("UPDATE workshop_items SET api_tags = ?, user_tags = '[]', deactivated_steam_tags = '[]', is_sorted = 0 WHERE published_file_id = ?", updated)
        conn.commit()
    conn.close()
    return {"status": "ok", "affected": len(updated)}

@app.get("/api/custom-user-tags")
def get_custom_user_tags():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT tag FROM custom_user_tags ORDER BY tag ASC")
    rows = cur.fetchall()
    conn.close()
    return {"tags": [r["tag"] for r in rows]}

class CreateUserTagPayload(BaseModel):
    tag: str

@app.post("/api/custom-user-tags")
def create_custom_user_tag(payload: CreateUserTagPayload):
    tag = payload.tag.strip()
    if not tag:
        raise HTTPException(status_code=400, detail="Tag cannot be empty")
    
    tag_lower = tag.lower()
    conn = get_connection()
    cur = conn.cursor()

    # 1. Check existing custom user tags (case-insensitive)
    cur.execute("SELECT tag FROM custom_user_tags")
    user_rows = cur.fetchall()
    for r in user_rows:
        if r["tag"].lower() == tag_lower:
            conn.close()
            raise HTTPException(status_code=400, detail="Тег з такою назвою вже існує серед користувацьких тегів")

    # 2. Check existing steam tags across workshop items (case-insensitive)
    cur.execute("SELECT api_tags FROM workshop_items WHERE api_tags IS NOT NULL")
    items_rows = cur.fetchall()
    for r in items_rows:
        try:
            steam_tags = json.loads(r["api_tags"])
        except (json.JSONDecodeError, TypeError):
            continue
        for st in steam_tags:
            if st.lower() == tag_lower:
                conn.close()
                raise HTTPException(status_code=400, detail="Тег з такою назвою вже існує серед Steam тегів")

    import time
    cur.execute("INSERT OR IGNORE INTO custom_user_tags (tag, created_at) VALUES (?, ?)", (tag, int(time.time())))
    conn.commit()
    conn.close()
    return {"status": "ok", "tag": tag}

@app.delete("/api/user-tags/{tag_name}")
def delete_user_tag_completely(tag_name: str):
    tag = tag_name.strip()
    if not tag:
        raise HTTPException(status_code=400, detail="Tag cannot be empty")
    
    conn = get_connection()
    cur = conn.cursor()

    # Also remove from custom_user_tags dictionary
    cur.execute("DELETE FROM custom_user_tags WHERE tag = ?", (tag,))

    cur.execute("SELECT published_file_id, user_tags FROM workshop_items WHERE user_tags LIKE ?", (f'%"{tag}"%',))
    rows = cur.fetchall()

    updated = []
    for r in rows:
        tags = []
        if r["user_tags"]:
            try:
                tags = json.loads(r["user_tags"])
            except:
                tags = []
        if tag in tags:
            new_tags = [t for t in tags if t != tag]
            updated.append((json.dumps(sorted(new_tags)), r["published_file_id"]))

    if updated:
        cur.executemany("UPDATE workshop_items SET user_tags = ? WHERE published_file_id = ?", updated)
    conn.commit()
    conn.close()
    return {"status": "ok", "tag": tag, "affected": len(updated)}

class FavoritePayload(BaseModel):
    is_favorited: bool

@app.post("/api/items/{item_id}/favorited")
def set_item_favorited(item_id: str, payload: FavoritePayload):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE workshop_items SET is_favorited = ? WHERE published_file_id = ?", (1 if payload.is_favorited else 0, item_id))
    conn.commit()
    conn.close()
    return {"status": "ok", "item_id": item_id, "is_favorited": payload.is_favorited}

class SteamTagsPayload(BaseModel):
    tags: Optional[List[str]] = None
    deactivated_tags: Optional[List[str]] = None

@app.post("/api/items/{item_id}/steam-tags")
def update_item_steam_tags(item_id: str, payload: SteamTagsPayload):
    conn = get_connection()
    cur = conn.cursor()
    updates = []
    params = []
    if payload.tags is not None:
        updates.append("api_tags = ?")
        params.append(json.dumps(payload.tags))
    if payload.deactivated_tags is not None:
        updates.append("deactivated_steam_tags = ?")
        params.append(json.dumps(list(set(payload.deactivated_tags))))
    
    if updates:
        updates.append("is_sorted = 1")
        params.append(item_id)
        cur.execute(f"UPDATE workshop_items SET {', '.join(updates)} WHERE published_file_id = ?", params)
        conn.commit()
    conn.close()
    return {
        "status": "ok",
        "item_id": item_id,
        "tags": payload.tags,
        "deactivated_tags": payload.deactivated_tags,
        "is_sorted": True
    }

class TagStructurePayload(BaseModel):
    structure: Any

@app.get("/api/tag-structure")
def get_tag_structure():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT value FROM app_settings WHERE key = 'tag_structure'")
    row = cur.fetchone()
    conn.close()
    if row and row["value"]:
        try:
            return {"structure": json.loads(row["value"])}
        except Exception:
            return {"structure": None}
    return {"structure": None}

@app.post("/api/tag-structure")
def save_tag_structure(payload: TagStructurePayload):
    conn = get_connection()
    cur = conn.cursor()
    val = json.dumps(payload.structure)
    cur.execute("INSERT INTO app_settings (key, value) VALUES ('tag_structure', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (val,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.get("/api/steam/status")
def get_steam_status():
    return SteamService.get_status()

@app.post("/api/steam/restart")
async def restart_steam_with_debugging():
    return await SteamService.restart_steam_with_debugging()

class ToggleDisabledPayload(BaseModel):
    is_disabled: Optional[bool] = None
    mode: Optional[str] = "hybrid"

@app.post("/api/items/{item_id}/toggle-disabled")
async def toggle_item_disabled(item_id: str, payload: Optional[ToggleDisabledPayload] = None):
    conn = get_connection()
    cur = conn.cursor()
    if payload and payload.is_disabled is not None:
        target = 1 if payload.is_disabled else 0
    else:
        cur.execute("SELECT is_disabled FROM workshop_items WHERE published_file_id = ?", (item_id,))
        row = cur.fetchone()
        curr = row["is_disabled"] if row and "is_disabled" in row.keys() and row["is_disabled"] else 0
        target = 0 if curr else 1
    conn.close()

    mode = payload.mode if payload and payload.mode else "hybrid"
    res = await SteamService.set_items_disabled([item_id], bool(target), mode=mode)
    return {"status": "ok", "item_id": item_id, "is_disabled": bool(target), "mode_used": res.get("mode_used")}

class BulkDisabledPayload(BaseModel):
    item_ids: List[str]
    is_disabled: bool
    mode: Optional[str] = "hybrid"

@app.post("/api/items/bulk-set-disabled")
async def bulk_set_disabled(payload: BulkDisabledPayload):
    if not payload.item_ids:
        return {"status": "ok", "affected": 0, "is_disabled": payload.is_disabled}
    mode = payload.mode or "hybrid"
    res = await SteamService.set_items_disabled(payload.item_ids, payload.is_disabled, mode=mode)
    return {"status": "ok", "affected": len(payload.item_ids), "is_disabled": payload.is_disabled, "mode_used": res.get("mode_used")}

class ToggleSubscriptionPayload(BaseModel):
    is_unsubscribed: Optional[bool] = None
    mode: Optional[str] = "hybrid"

@app.post("/api/items/{item_id}/toggle-subscription")
async def toggle_item_subscription(item_id: str, payload: Optional[ToggleSubscriptionPayload] = None):
    conn = get_connection()
    cur = conn.cursor()
    if payload and payload.is_unsubscribed is not None:
        target = 1 if payload.is_unsubscribed else 0
    else:
        cur.execute("SELECT is_unsubscribed FROM workshop_items WHERE published_file_id = ?", (item_id,))
        row = cur.fetchone()
        curr = row["is_unsubscribed"] if row and "is_unsubscribed" in row.keys() and row["is_unsubscribed"] else 0
        target = 0 if curr else 1
    conn.close()

    mode = payload.mode if payload and payload.mode else "hybrid"
    # target = 1 means unsubscribing (is_subscribed = False), target = 0 means subscribing (is_subscribed = True)
    res = await SteamService.set_items_subscription([item_id], is_subscribed=(target == 0), mode=mode)
    return {"status": "ok", "item_id": item_id, "is_unsubscribed": bool(target), "mode_used": res.get("mode_used")}

class BulkSubscriptionPayload(BaseModel):
    item_ids: List[str]
    is_unsubscribed: bool
    mode: Optional[str] = "hybrid"

@app.post("/api/items/bulk-set-subscription")
async def bulk_set_subscription(payload: BulkSubscriptionPayload):
    if not payload.item_ids:
        return {"status": "ok", "affected": 0, "is_unsubscribed": payload.is_unsubscribed}
    mode = payload.mode or "hybrid"
    res = await SteamService.set_items_subscription(payload.item_ids, is_subscribed=(not payload.is_unsubscribed), mode=mode)
    return {"status": "ok", "affected": len(payload.item_ids), "is_unsubscribed": payload.is_unsubscribed, "mode_used": res.get("mode_used")}

class ToggleSortedPayload(BaseModel):
    is_sorted: Optional[bool] = None

@app.post("/api/items/{item_id}/toggle-sorted")
def toggle_item_sorted(item_id: str, payload: Optional[ToggleSortedPayload] = None):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT is_sorted, user_tags FROM workshop_items WHERE published_file_id = ?", (item_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    if payload and payload.is_sorted is not None:
        target = 1 if payload.is_sorted else 0
    else:
        if "is_sorted" in row.keys() and row["is_sorted"] is not None:
            curr = bool(row["is_sorted"])
        else:
            ut = []
            if "user_tags" in row.keys() and row["user_tags"]:
                try:
                    ut = json.loads(row["user_tags"])
                except:
                    ut = []
            curr = len(ut) > 0
        target = 0 if curr else 1

    cur.execute("UPDATE workshop_items SET is_sorted = ? WHERE published_file_id = ?", (target, item_id))
    conn.commit()
    conn.close()
    return {"status": "ok", "item_id": item_id, "is_sorted": bool(target)}

class BulkSortedPayload(BaseModel):
    item_ids: List[str]
    is_sorted: bool

@app.post("/api/items/bulk-set-sorted")
def bulk_set_sorted(payload: BulkSortedPayload):
    if not payload.item_ids:
        return {"status": "ok", "affected": 0, "is_sorted": payload.is_sorted}
    conn = get_connection()
    cur = conn.cursor()
    target = 1 if payload.is_sorted else 0
    cur.executemany("UPDATE workshop_items SET is_sorted = ? WHERE published_file_id = ?", [(target, i) for i in payload.item_ids])
    conn.commit()
    conn.close()
    return {"status": "ok", "affected": len(payload.item_ids), "is_sorted": payload.is_sorted}

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
