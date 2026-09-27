from .steam_api.gallery_scraper import get_workshop_gallery_images
from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Any
import asyncio
import json
import time
from pathlib import Path

from .config import APP_ID, MAX_WORKSHOP_ITEMS, STATIC_DIR, PREVIEWS_DIR
from .db.session import init_db, get_connection
from .scanner.workshop_scanner import scan_local_workshop
from .steam_api.client import fetch_steam_api_details, resolve_missing_authors, fetch_localized_descriptions
from .cache.preview_cache import cache_previews_for_items
from .steam_api.steam_service import SteamService
from .steam_api.collections_service import fetch_steam_collection_info, import_steam_collection, extract_collection_id
from .data_sync import router as data_sync_router, normalize_and_deduplicate_tag_structure
from .scanner.ingame_folders import (
    get_ingame_folders_data,
    create_folder,
    rename_folder,
    delete_folder,
    assign_items_to_folder,
    find_save_xml_path,
    is_game_running
)

app = FastAPI(title="Stormworks Workshop Manager API", version="0.1.0-beta.1")
app.include_router(data_sync_router)

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
    try:
        asyncio.create_task(resolve_missing_authors())
    except Exception:
        pass

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

async def run_incremental_sync(lang: str = "en"):
    scan_state["is_scanning"] = True
    scan_state["scan_type"] = "incremental"
    try:
        # Step 1: Scan local filesystem & manifest & subscriptions.vdf
        scan_res = scan_local_workshop()
        scan_state["total_found"] = scan_res["total_found_locally"]
        scan_state["processed_count"] = scan_res["processed_count"]

        # Step 2: Find items that don't have Steam API details yet (newly subscribed / fresh items)
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT published_file_id FROM workshop_items 
            WHERE (api_last_synced_at IS NULL OR api_title IS NULL OR api_title LIKE 'Item #%' OR api_title LIKE 'Mod #%')
              AND (is_unsubscribed = 0 OR is_present_locally = 1)
        """)
        new_ids = [str(r[0]) for r in cur.fetchall()]
        conn.close()

        if new_ids:
            print(f"[*] Quick sync: found {len(new_ids)} new/unsynced items. Fetching Steam details (lang={lang})...")
            await fetch_steam_api_details(new_ids, lang_code=lang)
            await cache_previews_for_items(new_ids)
        else:
            print("[*] Quick sync: all items already have Steam details.")

        # Step 3: If a non-English language is active, also check existing items for missing localized descriptions
        if lang and lang.lower() != "en":
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("""
                SELECT published_file_id, api_descriptions_json FROM workshop_items
                WHERE (is_unsubscribed = 0 OR is_present_locally = 1)
            """)
            rows = cur.fetchall()
            conn.close()
            missing_loc_ids = []
            for r in rows:
                p_id = str(r[0])
                descs_str = r[1]
                has_lang = False
                if descs_str:
                    try:
                        d = json.loads(descs_str)
                        if isinstance(d, dict) and d.get(lang.lower()):
                            has_lang = True
                    except Exception:
                        pass
                if not has_lang:
                    missing_loc_ids.append(p_id)
            if missing_loc_ids:
                print(f"[*] Quick sync: fetching localized descriptions for {len(missing_loc_ids)} items ({lang})...")
                await fetch_localized_descriptions(missing_loc_ids, lang_code=lang)

        scan_state["last_scan_info"] = scan_res
    except Exception as e:
        print(f"Error during incremental sync: {e}")
    finally:
        scan_state["is_scanning"] = False

async def run_full_sync(lang: str = "en"):
    scan_state["is_scanning"] = True
    scan_state["scan_type"] = "full"
    try:
        # Step 1: Scan local filesystem & manifest & subscriptions.vdf
        scan_res = scan_local_workshop()
        scan_state["total_found"] = scan_res["total_found_locally"]
        scan_state["processed_count"] = scan_res["processed_count"]
        selected_ids = scan_res["selected_ids"]

        # Step 2: Fetch Steam Web API details for all items (with localized description support)
        await fetch_steam_api_details(selected_ids, lang_code=lang)

        # Step 3: Cache previews locally for all items
        await cache_previews_for_items(selected_ids)

        scan_state["last_scan_info"] = scan_res
    except Exception as e:
        print(f"Error during full sync: {e}")
    finally:
        scan_state["is_scanning"] = False

@app.post("/api/scan")
async def trigger_scan(background_tasks: BackgroundTasks, full: bool = False, lang: Optional[str] = "en"):
    if scan_state["is_scanning"]:
        return {"status": "already_running", "scan_type": scan_state.get("scan_type", "incremental")}
    active_lang = (lang or "en").strip().lower()
    if full:
        background_tasks.add_task(run_full_sync, active_lang)
        return {"status": "started", "type": "full", "limit": MAX_WORKSHOP_ITEMS, "lang": active_lang}
    else:
        background_tasks.add_task(run_incremental_sync, active_lang)
        return {"status": "started", "type": "incremental", "lang": active_lang}

@app.post("/api/scan/full")
async def trigger_full_scan(background_tasks: BackgroundTasks, lang: Optional[str] = "en"):
    if scan_state["is_scanning"]:
        return {"status": "already_running", "scan_type": scan_state.get("scan_type", "full")}
    active_lang = (lang or "en").strip().lower()
    background_tasks.add_task(run_full_sync, active_lang)
    return {"status": "started", "type": "full", "limit": MAX_WORKSHOP_ITEMS, "lang": active_lang}

@app.get("/api/items")
def list_items(
    q: Optional[str] = None,
    tag: Optional[str] = None,
    favorited: Optional[bool] = None,
    collection_id: Optional[int] = None,
    lang: Optional[str] = "en",
    sort_by: str = Query("id", pattern="^(id|title|size|updated|created|discovered|author|popular)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$")
):
    conn = get_connection()
    cur = conn.cursor()

    query = """
    SELECT w.*, COALESCE(a.persona_name, w.api_creator) AS creator_name
    FROM workshop_items w
    LEFT JOIN steam_authors a ON w.api_creator = a.steam_id
    WHERE 1=1
    """
    params = []

    if q:
        query += " AND (w.api_title LIKE ? OR w.published_file_id LIKE ? OR w.api_description LIKE ? OR COALESCE(a.persona_name, w.api_creator) LIKE ?)"
        term = f"%{q}%"
        params.extend([term, term, term, term])

    if tag:
        query += " AND w.api_tags LIKE ?"
        params.append(f'%"{tag}"%')

    if favorited is not None:
        query += " AND w.is_favorited = ?"
        params.append(1 if favorited else 0)

    if collection_id is not None:
        query += " AND w.published_file_id IN (SELECT published_file_id FROM collection_items WHERE collection_id = ?)"
        params.append(collection_id)

    # Fetch mapping of item published_file_id to collection_ids
    cur.execute("SELECT published_file_id, collection_id FROM collection_items")
    col_map = {}
    for cr in cur.fetchall():
        pid = str(cr["published_file_id"])
        if pid not in col_map:
            col_map[pid] = []
        col_map[pid].append(cr["collection_id"])

    # Sorting
    sort_map = {
        "id": "CAST(w.published_file_id AS INTEGER)",
        "title": "w.api_title COLLATE NOCASE",
        "size": "COALESCE(w.local_size_bytes, w.api_file_size, 0)",
        "updated": "COALESCE(w.api_time_updated, w.local_mtime, 0)",
        "created": "COALESCE(w.api_time_created, 0)",
        "discovered": "COALESCE(w.first_discovered_at, w.local_mtime, 0)",
        "author": "COALESCE(a.persona_name, w.api_creator) COLLATE NOCASE",
        "popular": "COALESCE(w.api_subscriptions, 0)"
    }
    col = sort_map.get(sort_by, "CAST(w.published_file_id AS INTEGER)")
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
        is_favorited = bool(r["is_favorited"]) if "is_favorited" in r.keys() and r["is_favorited"] else False
        is_disabled = bool(r["is_disabled"]) if "is_disabled" in r.keys() and r["is_disabled"] else False

        # Localized description resolution with fallback to base English api_description
        item_description = r["api_description"]
        req_lang = (lang or "en").strip().lower()
        if "api_descriptions_json" in r.keys() and r["api_descriptions_json"]:
            try:
                descs_dict = json.loads(r["api_descriptions_json"])
                if isinstance(descs_dict, dict) and descs_dict.get(req_lang):
                    item_description = descs_dict[req_lang]
            except Exception:
                pass

        items.append({
            "published_file_id": r["published_file_id"],
            "collection_ids": col_map.get(str(r["published_file_id"]), []),
            "user_tags": user_tags,
            "deactivated_steam_tags": deactivated_steam_tags,
            "original_steam_tags": original_steam_tags,
            "is_favorited": is_favorited,
            "is_disabled": is_disabled,
            "is_sorted": is_sorted,
            "is_unsubscribed": bool(r["is_unsubscribed"]) if "is_unsubscribed" in r.keys() else False,
            "title": r["api_title"] or f"Item #{r['published_file_id']}",
            "description": item_description,
            "creator": r["api_creator"],
            "creator_name": r["creator_name"] if "creator_name" in r.keys() and r["creator_name"] else None,
            "preview_url": r["api_preview_url"],
            "has_local_preview": bool(r["local_preview_path"]),
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

@app.post("/api/authors/sync")
async def sync_authors(background_tasks: BackgroundTasks):
    background_tasks.add_task(resolve_missing_authors)
    return {"status": "started", "message": "Author name resolution running in background"}

@app.get("/api/previews/{item_id}")
def get_preview_image(item_id: str):
    preview_file = PREVIEWS_DIR / f"{item_id}.jpg"
    if preview_file.exists():
        return FileResponse(preview_file, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
    
    # Check if local item directory has a preview
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT local_preview_path FROM workshop_items WHERE published_file_id = ?", (item_id,))
    row = cur.fetchone()
    conn.close()

    if row and row["local_preview_path"] and Path(row["local_preview_path"]).exists():
        return FileResponse(row["local_preview_path"], headers={"Cache-Control": "public, max-age=86400"})

    raise HTTPException(status_code=404, detail="Preview not found")

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
    action: str = "add"  # "add" | "remove"

@app.post("/api/items/bulk-steam-tags")
def bulk_update_steam_tags(payload: BulkSteamTagPayload):
    tag = payload.tag.strip()
    if not tag:
        raise HTTPException(status_code=400, detail="Tag cannot be empty")

    conn = get_connection()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(payload.item_ids))
    cur.execute(
        f"SELECT published_file_id, api_tags, deactivated_steam_tags, original_steam_tags FROM workshop_items WHERE published_file_id IN ({placeholders})",
        payload.item_ids
    )
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

        orig = []
        if "original_steam_tags" in r.keys() and r["original_steam_tags"]:
            try:
                orig = json.loads(r["original_steam_tags"])
            except:
                orig = []
        orig_set = {str(t).strip().lower() for t in orig if str(t).strip()}

        if payload.action == "add":
            # Add tag to steam tags if not present
            exists = any(isinstance(t, str) and t.lower() == tag.lower() for t in tags)
            if not exists:
                tags.append(tag)
            # Reactivate if it was deactivated (remove from deactivated list)
            deact = [t for t in deact if isinstance(t, str) and t.lower() != tag.lower()]
        elif payload.action == "remove":
            # If tag is originally from Steam for this mod: DEACTIVATE it (keep in api_tags, add to deact)
            if tag.lower() in orig_set:
                if not any(isinstance(t, str) and t.lower() == tag.lower() for t in tags):
                    tags.append(tag)
                if not any(isinstance(t, str) and t.lower() == tag.lower() for t in deact):
                    deact.append(tag)
            else:
                # Manually added steam tag: REMOVE completely from api_tags
                tags = [t for t in tags if isinstance(t, str) and t.lower() != tag.lower()]
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
    cur.execute("SELECT api_tags, original_steam_tags FROM workshop_items WHERE published_file_id = ?", (item_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Original steam tags must never be deleted; they are preserved and all deactivated
    orig = row["original_steam_tags"] or row["api_tags"] or "[]"
    try:
        orig_tags = json.loads(orig)
    except:
        orig_tags = []
    
    cur.execute(
        "UPDATE workshop_items SET api_tags = ?, user_tags = '[]', deactivated_steam_tags = ?, is_sorted = 0 WHERE published_file_id = ?",
        (json.dumps(orig_tags), json.dumps(orig_tags), item_id)
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "item_id": item_id, "tags": orig_tags, "user_tags": [], "deactivated_steam_tags": orig_tags, "is_sorted": False}

@app.post("/api/items/bulk-clear-tags")
def bulk_clear_tags(payload: BulkItemIdsPayload):
    if not payload.item_ids:
        return {"status": "ok", "affected": 0}
    conn = get_connection()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(payload.item_ids))
    cur.execute(f"SELECT published_file_id, api_tags, original_steam_tags FROM workshop_items WHERE published_file_id IN ({placeholders})", payload.item_ids)
    rows = cur.fetchall()
    updated = []
    for r in rows:
        orig = r["original_steam_tags"] or r["api_tags"] or "[]"
        try:
            orig_tags = json.loads(orig)
        except:
            orig_tags = []
        updated.append((json.dumps(orig_tags), json.dumps(orig_tags), r["published_file_id"]))
    if updated:
        cur.executemany("UPDATE workshop_items SET api_tags = ?, user_tags = '[]', deactivated_steam_tags = ?, is_sorted = 0 WHERE published_file_id = ?", updated)
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

class RenameUserTagPayload(BaseModel):
    new_tag: str

@app.put("/api/user-tags/{tag_name}")
def rename_user_tag(tag_name: str, payload: RenameUserTagPayload):
    old_tag = tag_name.strip()
    new_tag = payload.new_tag.strip()

    if not old_tag:
        raise HTTPException(status_code=400, detail="Назва старого тегу не може бути порожньою")
    if not new_tag:
        raise HTTPException(status_code=400, detail="Нова назва тегу не може бути порожньою")

    if old_tag == new_tag:
        return {"status": "ok", "old_tag": old_tag, "new_tag": new_tag, "affected": 0}

    new_tag_lower = new_tag.lower()
    old_tag_lower = old_tag.lower()

    conn = get_connection()
    cur = conn.cursor()

    # 1. Check existing custom user tags (if changed, avoid collisions)
    if new_tag_lower != old_tag_lower:
        cur.execute("SELECT tag FROM custom_user_tags")
        user_rows = cur.fetchall()
        for r in user_rows:
            if r["tag"].lower() == new_tag_lower:
                conn.close()
                raise HTTPException(status_code=400, detail="Тег з такою назвою вже існує серед користувацьких тегів")

    # 2. Check collision with Steam tags across workshop items
    cur.execute("SELECT api_tags FROM workshop_items WHERE api_tags IS NOT NULL")
    items_rows = cur.fetchall()
    for r in items_rows:
        try:
            steam_tags = json.loads(r["api_tags"])
        except (json.JSONDecodeError, TypeError):
            continue
        for st in steam_tags:
            if st.lower() == new_tag_lower:
                conn.close()
                raise HTTPException(status_code=400, detail="Тег з такою назвою вже існує серед Steam тегів")

    # 3. Update custom_user_tags
    cur.execute("UPDATE custom_user_tags SET tag = ? WHERE tag = ?", (new_tag, old_tag))
    cur.execute("INSERT OR IGNORE INTO custom_user_tags (tag, created_at) VALUES (?, ?)", (new_tag, int(time.time())))

    # 4. Update workshop_items user_tags
    cur.execute("SELECT published_file_id, user_tags FROM workshop_items WHERE user_tags LIKE ?", (f'%"{old_tag}"%',))
    rows = cur.fetchall()

    updated = []
    for r in rows:
        tags = []
        if r["user_tags"]:
            try:
                tags = json.loads(r["user_tags"])
            except Exception:
                tags = []
        if old_tag in tags:
            new_tags = [new_tag if t == old_tag else t for t in tags]
            clean_tags = list(dict.fromkeys(new_tags))
            updated.append((json.dumps(clean_tags), r["published_file_id"]))

    if updated:
        cur.executemany("UPDATE workshop_items SET user_tags = ? WHERE published_file_id = ?", updated)

    # 5. Update saved tag_structure in app_settings if present
    try:
        cur.execute("SELECT value FROM app_settings WHERE key = 'tag_structure'")
        struct_row = cur.fetchone()
        if struct_row and struct_row["value"]:
            tree_data = json.loads(struct_row["value"])
            def rename_in_tree(nodes):
                for n in nodes:
                    if n.get("type") == "tag" and n.get("tag") == old_tag:
                        n["tag"] = new_tag
                        if n.get("id") == f"tag-user-{old_tag}":
                            n["id"] = f"tag-user-{new_tag}"
                    if isinstance(n.get("children"), list):
                        rename_in_tree(n["children"])
            if isinstance(tree_data, list):
                rename_in_tree(tree_data)
                cur.execute("UPDATE app_settings SET value = ? WHERE key = 'tag_structure'", (json.dumps(tree_data),))
    except Exception as e:
        print(f"Failed to update tag_structure on tag rename: {e}")

    conn.commit()
    conn.close()
    return {"status": "ok", "old_tag": old_tag, "new_tag": new_tag, "affected": len(updated)}


def db_get_item_field(item_id: str, field: str, default: Any = None) -> Any:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT {field} FROM workshop_items WHERE published_file_id = ?", (item_id,))
    row = cur.fetchone()
    conn.close()
    if not row or field not in row.keys() or row[field] is None:
        return default
    return row[field]

def db_update_item_field(item_id: str, field: str, value: Any):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"UPDATE workshop_items SET {field} = ? WHERE published_file_id = ?", (value, item_id))
    conn.commit()
    conn.close()

def db_bulk_update_item_field(item_ids: List[str], field: str, value: Any):
    if not item_ids:
        return
    conn = get_connection()
    cur = conn.cursor()
    cur.executemany(f"UPDATE workshop_items SET {field} = ? WHERE published_file_id = ?", [(value, i) for i in item_ids])
    conn.commit()
    conn.close()

class FavoritePayload(BaseModel):
    is_favorited: bool

@app.post("/api/items/{item_id}/favorited")
def set_item_favorited(item_id: str, payload: FavoritePayload):
    db_update_item_field(item_id, "is_favorited", 1 if payload.is_favorited else 0)
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
    clean_tree = normalize_and_deduplicate_tag_structure(payload.structure)
    val = json.dumps(clean_tree)
    cur.execute("INSERT INTO app_settings (key, value) VALUES ('tag_structure', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (val,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

class UserSettingsPayload(BaseModel):
    settings: Any

@app.get("/api/user-settings")
def get_user_settings():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT value FROM app_settings WHERE key = 'user_ui_settings'")
    row = cur.fetchone()
    conn.close()
    if row and row["value"]:
        try:
            return {"settings": json.loads(row["value"])}
        except Exception:
            return {"settings": {}}
    return {"settings": {}}

@app.post("/api/user-settings")
def save_user_settings(payload: UserSettingsPayload):
    conn = get_connection()
    cur = conn.cursor()
    val = json.dumps(payload.settings)
    cur.execute("INSERT INTO app_settings (key, value) VALUES ('user_ui_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (val,))
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
    if payload and payload.is_disabled is not None:
        target = payload.is_disabled
    else:
        target = not bool(db_get_item_field(item_id, "is_disabled", default=0))

    mode = payload.mode if payload and payload.mode else "hybrid"
    res = await SteamService.set_items_disabled([item_id], target, mode=mode)
    return {"status": "ok", "item_id": item_id, "is_disabled": target, "mode_used": res.get("mode_used")}

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
    if payload and payload.is_unsubscribed is not None:
        target = payload.is_unsubscribed
    else:
        target = not bool(db_get_item_field(item_id, "is_unsubscribed", default=0))

    mode = payload.mode if payload and payload.mode else "hybrid"
    # target = True means unsubscribing (is_subscribed = False), target = False means subscribing (is_subscribed = True)
    res = await SteamService.set_items_subscription([item_id], is_subscribed=(not target), mode=mode)
    return {"status": "ok", "item_id": item_id, "is_unsubscribed": target, "mode_used": res.get("mode_used")}

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
    if payload and payload.is_sorted is not None:
        target = payload.is_sorted
    else:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT is_sorted, user_tags FROM workshop_items WHERE published_file_id = ?", (item_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")

        if "is_sorted" in row.keys() and row["is_sorted"] is not None:
            curr = bool(row["is_sorted"])
        else:
            ut = []
            if "user_tags" in row.keys() and row["user_tags"]:
                try:
                    ut = json.loads(row["user_tags"])
                except Exception:
                    ut = []
            curr = len(ut) > 0
        target = not curr

    db_update_item_field(item_id, "is_sorted", 1 if target else 0)
    return {"status": "ok", "item_id": item_id, "is_sorted": target}

class BulkSortedPayload(BaseModel):
    item_ids: List[str]
    is_sorted: bool

@app.post("/api/items/bulk-set-sorted")
def bulk_set_sorted(payload: BulkSortedPayload):
    if not payload.item_ids:
        return {"status": "ok", "affected": 0, "is_sorted": payload.is_sorted}
    db_bulk_update_item_field(payload.item_ids, "is_sorted", 1 if payload.is_sorted else 0)
    return {"status": "ok", "affected": len(payload.item_ids), "is_sorted": payload.is_sorted}

# ==============================================================================
# Collections API Endpoints
# ==============================================================================

class CreateCollectionPayload(BaseModel):
    name: str
    description: Optional[str] = ""
    item_ids: Optional[List[str]] = None
    color: Optional[str] = "#66c0f4"
    icon: Optional[str] = "folder"

class UpdateCollectionPayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None

class CollectionItemsPayload(BaseModel):
    item_ids: List[str]
    action: str = "add"  # "add" | "remove"

class SteamCollectionPreviewPayload(BaseModel):
    collection_id: str

class ImportSteamCollectionPayload(BaseModel):
    collection_id: str
    auto_subscribe: bool = False
    name: Optional[str] = None

@app.get("/api/collections")
def get_collections():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
    SELECT c.*,
           COUNT(ci.published_file_id) as items_count,
           SUM(CASE WHEN w.is_disabled = 0 AND (w.is_unsubscribed = 0 OR w.is_unsubscribed IS NULL) THEN 1 ELSE 0 END) as enabled_count,
           SUM(CASE WHEN w.is_disabled = 1 AND (w.is_unsubscribed = 0 OR w.is_unsubscribed IS NULL) THEN 1 ELSE 0 END) as disabled_count,
           SUM(CASE WHEN w.is_unsubscribed = 1 THEN 1 ELSE 0 END) as unsubscribed_count
    FROM collections c
    LEFT JOIN collection_items ci ON c.id = ci.collection_id
    LEFT JOIN workshop_items w ON ci.published_file_id = w.published_file_id
    GROUP BY c.id
    ORDER BY c.created_at ASC
    """)
    rows = cur.fetchall()

    # Also fetch all item IDs for each collection
    cur.execute("SELECT collection_id, published_file_id FROM collection_items ORDER BY sort_order ASC")
    item_rows = cur.fetchall()
    conn.close()

    col_items_map = {}
    for r in item_rows:
        col_id = r["collection_id"]
        if col_id not in col_items_map:
            col_items_map[col_id] = []
        col_items_map[col_id].append(str(r["published_file_id"]))

    collections = []
    for r in rows:
        cid = r["id"]
        collections.append({
            "id": cid,
            "name": r["name"],
            "description": r["description"] or "",
            "steam_collection_id": r["steam_collection_id"],
            "color": r["color"] or "#66c0f4",
            "icon": r["icon"] or "folder",
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "items_count": r["items_count"] or 0,
            "enabled_count": r["enabled_count"] or 0,
            "disabled_count": r["disabled_count"] or 0,
            "unsubscribed_count": r["unsubscribed_count"] or 0,
            "item_ids": col_items_map.get(cid, [])
        })

    return {"collections": collections}

@app.post("/api/collections")
def create_collection(payload: CreateCollectionPayload):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Назва колекції не може бути порожньою")
    now = int(time.time())
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
    INSERT INTO collections (name, description, color, icon, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (name, payload.description or "", payload.color or "#66c0f4", payload.icon or "folder", now, now))
    col_id = cur.lastrowid

    if payload.item_ids:
        cur.executemany("""
        INSERT OR IGNORE INTO collection_items (collection_id, published_file_id, sort_order, added_at)
        VALUES (?, ?, ?, ?)
        """, [(col_id, str(iid), idx, now) for idx, iid in enumerate(payload.item_ids)])

    conn.commit()
    conn.close()
    return {"status": "ok", "id": col_id, "name": name}

@app.put("/api/collections/{col_id}")
def update_collection(col_id: int, payload: UpdateCollectionPayload):
    conn = get_connection()
    cur = conn.cursor()
    updates = []
    params = []
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            conn.close()
            raise HTTPException(status_code=400, detail="Назва колекції не може бути порожньою")
        updates.append("name = ?")
        params.append(name)
    if payload.description is not None:
        updates.append("description = ?")
        params.append(payload.description)
    if payload.color is not None:
        updates.append("color = ?")
        params.append(payload.color)
    if payload.icon is not None:
        updates.append("icon = ?")
        params.append(payload.icon)

    if updates:
        updates.append("updated_at = ?")
        params.append(int(time.time()))
        params.append(col_id)
        cur.execute(f"UPDATE collections SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    conn.close()
    return {"status": "ok", "id": col_id}

@app.delete("/api/collections/{col_id}")
def delete_collection(col_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM collections WHERE id = ?", (col_id,))
    cur.execute("DELETE FROM collection_items WHERE collection_id = ?", (col_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "id": col_id}

@app.post("/api/collections/{col_id}/items")
def manage_collection_items(col_id: int, payload: CollectionItemsPayload):
    if not payload.item_ids:
        return {"status": "ok", "affected": 0}
    conn = get_connection()
    cur = conn.cursor()
    now = int(time.time())

    if payload.action == "add":
        cur.executemany("""
        INSERT OR IGNORE INTO collection_items (collection_id, published_file_id, sort_order, added_at)
        VALUES (?, ?, 0, ?)
        """, [(col_id, str(iid), now) for iid in payload.item_ids])
    elif payload.action == "remove":
        placeholders = ",".join(["?"] * len(payload.item_ids))
        cur.execute(
            f"DELETE FROM collection_items WHERE collection_id = ? AND published_file_id IN ({placeholders})",
            [col_id] + [str(iid) for iid in payload.item_ids]
        )

    cur.execute("UPDATE collections SET updated_at = ? WHERE id = ?", (now, col_id))
    conn.commit()
    conn.close()
    return {"status": "ok", "collection_id": col_id, "affected": len(payload.item_ids)}

@app.post("/api/collections/{col_id}/apply-preset")
async def apply_collection_preset(col_id: int, mode: Optional[str] = "hybrid"):
    """
    Enables all subscribed items that belong to this collection,
    and disables all other subscribed workshop items.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT published_file_id FROM collection_items WHERE collection_id = ?", (col_id,))
    col_items = {str(r[0]) for r in cur.fetchall()}

    cur.execute("SELECT published_file_id, is_disabled, is_unsubscribed FROM workshop_items")
    all_items = cur.fetchall()
    conn.close()

    to_enable = []
    to_disable = []

    for r in all_items:
        pid = str(r["published_file_id"])
        is_dis = bool(r["is_disabled"])
        is_unsub = bool(r["is_unsubscribed"])
        if is_unsub:
            continue
        if pid in col_items:
            if is_dis:
                to_enable.append(pid)
        else:
            if not is_dis:
                to_disable.append(pid)

    if to_enable:
        await SteamService.set_items_disabled(to_enable, is_disabled=False, mode=mode or "hybrid")
    if to_disable:
        await SteamService.set_items_disabled(to_disable, is_disabled=True, mode=mode or "hybrid")

    return {
        "status": "ok",
        "collection_id": col_id,
        "enabled_count": len(to_enable),
        "disabled_count": len(to_disable),
        "total_in_preset": len(col_items)
    }

@app.post("/api/collections/steam-preview")
async def preview_steam_collection(payload: SteamCollectionPreviewPayload):
    try:
        data = await fetch_steam_collection_info(payload.collection_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/collections/import-steam")
async def import_steam_collection_endpoint(payload: ImportSteamCollectionPayload):
    try:
        res = await import_steam_collection(
            collection_id=payload.collection_id,
            auto_subscribe=payload.auto_subscribe,
            custom_name=payload.name
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -------------------------------------------------------------
# Classifier Endpoints
# -------------------------------------------------------------
class ClassifierPreviewPayload(BaseModel):
    item_ids: List[str]
    tag_aliases: Optional[dict] = None

class ClassifierApplyItem(BaseModel):
    item_id: str
    assigned_tags: List[str]
    deactivated_tags: List[str]
    is_sorted: bool

class ClassifierApplyPayload(BaseModel):
    items: List[ClassifierApplyItem]

class ClassifierRulesPayload(BaseModel):
    rules: dict

class TagTranslationPayload(BaseModel):
    tag: str
    translations: dict

@app.get("/api/classifier/rules")
def get_classifier_rules_endpoint():
    from .classifier.rules_service import load_classifier_rules
    return load_classifier_rules()

@app.post("/api/classifier/rules")
def save_classifier_rules_endpoint(payload: ClassifierRulesPayload):
    from .classifier.rules_service import save_classifier_rules
    save_classifier_rules(payload.rules)
    return {"status": "ok"}

@app.post("/api/classifier/tag-translation")
def update_single_tag_translation_endpoint(payload: TagTranslationPayload):
    from .classifier.rules_service import load_classifier_rules, save_classifier_rules
    rules = load_classifier_rules()
    tag = payload.tag
    if tag not in rules or not isinstance(rules[tag], dict):
        rules[tag] = {
            "is_mandatory_branch": False,
            "exclusions": {},
            "keywords": [],
            "negative_keywords": [],
            "numeric_ranges": [],
            "translations": {}
        }
    current_trans = rules[tag].get("translations", {})
    if not isinstance(current_trans, dict):
        current_trans = {}
    current_trans.update(payload.translations)
    rules[tag]["translations"] = current_trans
    save_classifier_rules(rules)
    return {"status": "ok", "tag": tag, "translations": rules[tag]["translations"]}

@app.get("/api/classifier/suggest-synonyms")
async def suggest_synonyms_endpoint(word: str = Query(..., min_length=1)):
    from .classifier.rules_service import fetch_synonyms_from_datamuse
    synonyms = await fetch_synonyms_from_datamuse(word)
    return {"word": word, "synonyms": synonyms}

@app.post("/api/classifier/preview")
async def preview_classification(payload: ClassifierPreviewPayload):
    from .classifier.auto_tagger import AutoClassifier
    from .classifier.rules_service import load_classifier_rules
    item_ids = payload.item_ids
    if not item_ids:
        return {"items": [], "new_tags_detected": []}

    # Load custom rules from DB
    custom_rules = load_classifier_rules()

    conn = get_connection()
    cur = conn.cursor()

    # Load tag structure to know existing tags
    cur.execute("SELECT value FROM app_settings WHERE key = 'tag_structure'")
    tag_row = cur.fetchone()
    tag_tree = json.loads(tag_row[0]) if tag_row else []

    def extract_tag_names(nodes):
        res = set()
        for n in nodes:
            tag_val = n.get("tag") or n.get("name") or n.get("id")
            if tag_val:
                res.add(tag_val)
            if "children" in n and n["children"]:
                res.update(extract_tag_names(n["children"]))
        return res

    known_tags = extract_tag_names(tag_tree)

    # Fetch items from DB
    placeholders = ",".join(["?"] * len(item_ids))
    cur.execute(f"""
        SELECT published_file_id, api_title, api_description, original_steam_tags, api_tags
        FROM workshop_items
        WHERE published_file_id IN ({placeholders})
    """, item_ids)

    rows = cur.fetchall()
    conn.close()

    results = []
    all_new_tags = set()

    for row in rows:
        p_id, title, desc, orig_tags_raw, api_tags_raw = row
        p_id_str = str(p_id)
        
        # Author tags
        author_tags = []
        if orig_tags_raw:
            try:
                author_tags = json.loads(orig_tags_raw)
            except:
                pass
        elif api_tags_raw:
            try:
                author_tags = json.loads(api_tags_raw)
            except:
                pass

        classified = AutoClassifier.classify_item(
            item_id=p_id_str,
            title=title or "",
            description=desc or "",
            original_steam_tags=author_tags,
            known_tags_set=known_tags,
            tag_aliases=payload.tag_aliases,
            custom_rules=custom_rules
        )

        results.append(classified)
        all_new_tags.update(classified.get("new_tags_detected", []))

    return {
        "items": results,
        "new_tags_detected": sorted(list(all_new_tags))
    }

@app.post("/api/classifier/apply")
def apply_classification(payload: ClassifierApplyPayload):
    if not payload.items:
        return {"status": "ok", "updated_count": 0}

    conn = get_connection()
    cur = conn.cursor()
    updated_count = 0

    try:
        cur.execute("BEGIN TRANSACTION")
        for it in payload.items:
            # We update user_tags, deactivated_steam_tags, and is_sorted
            cur.execute("""
                UPDATE workshop_items
                SET user_tags = ?,
                    deactivated_steam_tags = ?,
                    is_sorted = ?
                WHERE published_file_id = ?
            """, (
                json.dumps(it.assigned_tags),
                json.dumps(it.deactivated_tags),
                1 if it.is_sorted else 0,
                str(it.item_id)
            ))
            updated_count += 1

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

    conn.close()
    return {"status": "ok", "updated_count": updated_count}

def _get_custom_save_path() -> Optional[str]:
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT value FROM app_settings WHERE key = 'user_ui_settings'")
        row = cur.fetchone()
        conn.close()
        if row and row["value"]:
            settings = json.loads(row["value"])
            val = settings.get("stormworks_save_xml_path")
            if val and isinstance(val, str) and val.strip():
                return val.strip()
    except Exception:
        pass
    return None

def _get_custom_folders_mode() -> str:
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT value FROM app_settings WHERE key = 'user_ui_settings'")
        row = cur.fetchone()
        conn.close()
        if row and row["value"]:
            settings = json.loads(row["value"])
            val = settings.get("ingame_folders_mode")
            if val in ("single", "multi"):
                return val
    except Exception:
        pass
    return "single"

class InGameFolderCreatePayload(BaseModel):
    name: str

class InGameFolderRenamePayload(BaseModel):
    new_name: str

class InGameFolderAssignPayload(BaseModel):
    folder_name: Optional[str] = None
    item_ids: List[str]
    mode: Optional[str] = None
    action: Optional[str] = "set"

class InGameFolderValidatePathPayload(BaseModel):
    path: str

@app.get("/api/ingame-folders")
def get_ingame_folders():
    custom_path = _get_custom_save_path()
    return get_ingame_folders_data(custom_path)

@app.post("/api/ingame-folders")
def create_ingame_folder(payload: InGameFolderCreatePayload):
    custom_path = _get_custom_save_path()
    try:
        return create_folder(payload.name, custom_path)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/ingame-folders/{old_name}")
def rename_ingame_folder(old_name: str, payload: InGameFolderRenamePayload):
    custom_path = _get_custom_save_path()
    try:
        return rename_folder(old_name, payload.new_name, custom_path)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/ingame-folders/{folder_name}")
def delete_ingame_folder(folder_name: str):
    custom_path = _get_custom_save_path()
    try:
        return delete_folder(folder_name, custom_path)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ingame-folders/assign")
def assign_ingame_folder(payload: InGameFolderAssignPayload):
    custom_path = _get_custom_save_path()
    mode = payload.mode or _get_custom_folders_mode()
    action = payload.action or "set"
    try:
        return assign_items_to_folder(
            payload.folder_name,
            payload.item_ids,
            mode=mode,
            action=action,
            custom_path=custom_path
        )
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ingame-folders/validate-path")
def validate_ingame_save_path(payload: InGameFolderValidatePathPayload):
    target = Path(payload.path.strip()).expanduser() if payload.path.strip() else None
    if not target or not target.exists() or not target.is_file():
        return {"valid": False, "exists": False, "error": "File does not exist or is not a file"}
    try:
        import xml.etree.ElementTree as ET
        tree = ET.parse(target)
        root = tree.getroot()
        if root.tag != "save_data":
            return {"valid": False, "exists": True, "error": "File is not a valid Stormworks save.xml"}
        return {"valid": True, "exists": True, "path": str(target.resolve()), "error": None}
    except Exception as e:
        return {"valid": False, "exists": True, "error": f"Failed to parse XML: {str(e)}"}

@app.get("/")
def get_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(
            index_path,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    raise HTTPException(status_code=404, detail="Index not found")

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
