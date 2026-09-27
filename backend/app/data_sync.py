import os
import json
import time
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .config import BACKUPS_DIR
from .db.session import get_connection

router = APIRouter(prefix="/api/data", tags=["data-sync"])


def create_safety_backup() -> Path:
    """Creates a safety backup of the database before destructive import operations."""
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = int(time.time())
    iso_time = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUPS_DIR / f"auto_pre_import_{iso_time}_{timestamp}.json"

    conn = get_connection()
    cur = conn.cursor()

    # Dump workshop_items
    cur.execute("SELECT * FROM workshop_items")
    items_rows = [dict(r) for r in cur.fetchall()]

    # Dump app_settings
    cur.execute("SELECT * FROM app_settings")
    settings_rows = [dict(r) for r in cur.fetchall()]

    # Dump custom_user_tags
    cur.execute("SELECT * FROM custom_user_tags")
    tags_rows = [dict(r) for r in cur.fetchall()]

    # Dump steam_authors
    cur.execute("SELECT * FROM steam_authors")
    authors_rows = [dict(r) for r in cur.fetchall()]

    conn.close()

    backup_data = {
        "format": "stormworks_manager_full_backup",
        "version": 1,
        "backup_type": "auto_pre_import",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "app_settings": settings_rows,
        "custom_user_tags": tags_rows,
        "workshop_items": items_rows,
        "steam_authors": authors_rows,
    }

    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2)

    # Prune old auto-backups if more than 10
    auto_backups = sorted(BACKUPS_DIR.glob("auto_pre_import_*.json"), key=os.path.getmtime)
    if len(auto_backups) > 10:
        for old in auto_backups[:-10]:
            try:
                old.unlink()
            except Exception:
                pass

    return backup_file


class ExportTagsRequest(BaseModel):
    item_ids: Optional[List[str]] = None
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None


@router.post("/export-tags")
def export_tags_pack(req: ExportTagsRequest):
    conn = get_connection()
    cur = conn.cursor()

    # 1. Fetch tag structure
    cur.execute("SELECT value FROM app_settings WHERE key = 'tag_structure'")
    row = cur.fetchone()
    tag_structure = []
    if row and row["value"]:
        try:
            tag_structure = json.loads(row["value"])
        except Exception:
            tag_structure = []

    # 2. Fetch custom user tags
    cur.execute("SELECT tag FROM custom_user_tags ORDER BY tag ASC")
    custom_user_tags = [r["tag"] for r in cur.fetchall()]

    # 3. Fetch workshop items
    if req.item_ids and len(req.item_ids) > 0:
        placeholders = ",".join("?" for _ in req.item_ids)
        query = f"SELECT published_file_id, api_title, user_tags, api_tags, deactivated_steam_tags FROM workshop_items WHERE published_file_id IN ({placeholders})"
        cur.execute(query, req.item_ids)
        items_rows = cur.fetchall()
    else:
        # If no items selected, export all sorted items or items with user tags
        query = """
        SELECT published_file_id, api_title, user_tags, api_tags, deactivated_steam_tags
        FROM workshop_items
        WHERE is_sorted = 1 OR (user_tags IS NOT NULL AND user_tags != '[]' AND user_tags != '')
        """
        cur.execute(query)
        items_rows = cur.fetchall()
        if not items_rows:
            cur.execute("SELECT published_file_id, api_title, user_tags, api_tags, deactivated_steam_tags FROM workshop_items")
            items_rows = cur.fetchall()

    conn.close()

    items_dict: Dict[str, Any] = {}
    for r in items_rows:
        fid = str(r["published_file_id"])
        ut = []
        if r["user_tags"]:
            try:
                ut = json.loads(r["user_tags"])
            except Exception:
                ut = []

        at = []
        if r["api_tags"]:
            try:
                at = json.loads(r["api_tags"])
            except Exception:
                at = []

        dt = []
        if r["deactivated_steam_tags"]:
            try:
                dt = json.loads(r["deactivated_steam_tags"])
            except Exception:
                dt = []

        # Active steam tags are api_tags excluding deactivated_steam_tags
        active_steam = [t for t in at if t not in dt]

        items_dict[fid] = {
            "title": r["api_title"] or f"Item #{fid}",
            "user_tags": ut,
            "steam_tags": active_steam,
        }

    pack = {
        "format": "stormworks_tag_pack",
        "version": 1,
        "meta": {
            "title": req.title or "Stormworks Workshop Tags Pack",
            "author": req.author or "",
            "description": req.description or "",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "items_count": len(items_dict),
        },
        "tag_structure": tag_structure,
        "custom_user_tags": custom_user_tags,
        "items": items_dict,
    }

    return pack


@router.get("/export-backup")
def export_full_backup():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM workshop_items")
    items = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT * FROM app_settings")
    settings = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT * FROM custom_user_tags")
    custom_tags = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT * FROM steam_authors")
    authors = [dict(r) for r in cur.fetchall()]

    conn.close()

    backup = {
        "format": "stormworks_manager_full_backup",
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "app_settings": settings,
        "custom_user_tags": custom_tags,
        "workshop_items": items,
        "steam_authors": authors,
    }
    return backup


def normalize_tag_leaf(tag_str: str) -> str:
    """Extracts leaf tag name from any hierarchical path string, e.g. 'Role/Emergency/SAR' -> 'SAR'."""
    if not tag_str:
        return ""
    parts = [p.strip() for p in str(tag_str).split("/") if p.strip()]
    return parts[-1] if parts else str(tag_str).strip()


@router.post("/import/preview")
def preview_import(payload: Dict[str, Any]):
    if "data" in payload and isinstance(payload["data"], dict) and ("format" in payload["data"] or "items" in payload["data"] or "tag_structure" in payload["data"] or "workshop_items" in payload["data"]):
        payload = payload["data"]

    fmt = payload.get("format")

    if fmt == "stormworks_manager_full_backup":
        items = payload.get("workshop_items", [])
        return {
            "format": "stormworks_manager_full_backup",
            "exported_at": payload.get("exported_at"),
            "items_count": len(items),
            "custom_tags_count": len(payload.get("custom_user_tags", [])),
            "settings_count": len(payload.get("app_settings", [])),
        }

    if fmt != "stormworks_tag_pack":
        # Check if it's recognizable
        if "items" not in payload and "tag_structure" not in payload:
            raise HTTPException(status_code=400, detail="Невідомий формат файлу. Очікується .swtags.json або .swbackup.json")

    pack_items = payload.get("items", {})
    pack_structure = payload.get("tag_structure", [])
    pack_custom_tags = payload.get("custom_user_tags", [])

    conn = get_connection()
    cur = conn.cursor()

    # Extract all known Steam tags first for strict Steam tag priority
    cur.execute("SELECT api_tags, original_steam_tags FROM workshop_items WHERE api_tags IS NOT NULL OR original_steam_tags IS NOT NULL")
    all_steam_tags_set = set()
    for row in cur.fetchall():
        for col in ("api_tags", "original_steam_tags"):
            if row[col]:
                try:
                    for t in json.loads(row[col]):
                        if t and str(t).strip():
                            all_steam_tags_set.add(str(t).strip())
                except Exception:
                    pass
    steam_tags_lower = {t.lower() for t in all_steam_tags_set}

    # Load local tag structure
    cur.execute("SELECT value FROM app_settings WHERE key = 'tag_structure'")
    row = cur.fetchone()
    local_structure = []
    if row and row["value"]:
        try:
            local_structure = json.loads(row["value"])
        except Exception:
            local_structure = []

    # Load local custom tags (only clean leaf tags)
    cur.execute("SELECT tag FROM custom_user_tags")
    local_custom_tags = {normalize_tag_leaf(r["tag"]) for r in cur.fetchall() if "/" not in r["tag"] and r["tag"].lower() not in steam_tags_lower}

    # Clean incoming pack_custom_tags: leaf names only, never steam tags, unique
    clean_pack_custom = []
    for t in pack_custom_tags:
        leaf = normalize_tag_leaf(t)
        if leaf and leaf.lower() not in steam_tags_lower and leaf not in clean_pack_custom:
            clean_pack_custom.append(leaf)
    new_custom_tags = [t for t in clean_pack_custom if t not in local_custom_tags]

    # Query local workshop items matching pack items
    matched_diffs = []
    unmatched_ids = []

    if pack_items:
        pack_item_ids = list(pack_items.keys())
        placeholders = ",".join("?" for _ in pack_item_ids)
        query = f"""
        SELECT published_file_id, api_title, user_tags, api_tags, deactivated_steam_tags,
               original_steam_tags, is_sorted, local_preview_path, api_preview_url
        FROM workshop_items
        WHERE published_file_id IN ({placeholders})
        """
        cur.execute(query, pack_item_ids)
        local_items_map = {str(r["published_file_id"]): dict(r) for r in cur.fetchall()}

        for pid, pdata in pack_items.items():
            str_pid = str(pid)
            if str_pid not in local_items_map:
                unmatched_ids.append(str_pid)
                continue

            loc = local_items_map[str_pid]
            # Parse local user tags
            loc_user_tags = []
            if loc["user_tags"]:
                try:
                    loc_user_tags = [normalize_tag_leaf(t) for t in json.loads(loc["user_tags"]) if normalize_tag_leaf(t)]
                except Exception:
                    loc_user_tags = []

            # Parse local steam tags
            loc_api_tags = []
            if loc["api_tags"]:
                try:
                    loc_api_tags = json.loads(loc["api_tags"])
                except Exception:
                    loc_api_tags = []

            loc_deactivated = []
            if loc["deactivated_steam_tags"]:
                try:
                    loc_deactivated = json.loads(loc["deactivated_steam_tags"])
                except Exception:
                    loc_deactivated = []

            loc_active_steam = [t for t in loc_api_tags if t not in loc_deactivated]

            # Normalize pack tags: leaf names, and promote any steam tags to pack_steam
            raw_user = pdata.get("user_tags", [])
            raw_steam = pdata.get("steam_tags", [])

            pack_user = []
            pack_steam = [str(t).strip() for t in raw_steam if str(t).strip()]

            for ut in raw_user:
                leaf = normalize_tag_leaf(ut)
                if not leaf:
                    continue
                if leaf.lower() in steam_tags_lower:
                    if leaf not in pack_steam:
                        pack_steam.append(leaf)
                else:
                    if leaf not in pack_user:
                        pack_user.append(leaf)

            # Replace mode diff:
            # Added: tags in pack that user doesn't have
            # Removed: tags user has that are not in pack
            replace_added_user = [t for t in pack_user if t not in loc_user_tags]
            replace_removed_user = [t for t in loc_user_tags if t not in pack_user]
            replace_added_steam = [t for t in pack_steam if t not in loc_active_steam]
            replace_deactivated_steam = [t for t in loc_active_steam if t not in pack_steam]

            # Merge mode diff:
            # Added: tags in pack that user doesn't have
            # Removed: none (keep user's tags)
            merge_added_user = [t for t in pack_user if t not in loc_user_tags]
            merge_removed_user = []
            merge_added_steam = [t for t in pack_steam if t not in loc_active_steam]
            merge_deactivated_steam = []

            is_sorted = bool(loc["is_sorted"] or len(loc_user_tags) > 0)

            matched_diffs.append({
                "published_file_id": str_pid,
                "title": loc["api_title"] or pdata.get("title", f"Mod #{str_pid}"),
                "preview_url": loc["api_preview_url"] or "",
                "is_previously_sorted": is_sorted,
                "current_user_tags": loc_user_tags,
                "current_active_steam_tags": loc_active_steam,
                "pack_user_tags": pack_user,
                "pack_steam_tags": pack_steam,
                "replace_diff": {
                    "added_user": replace_added_user,
                    "removed_user": replace_removed_user,
                    "added_steam": replace_added_steam,
                    "deactivated_steam": replace_deactivated_steam,
                },
                "merge_diff": {
                    "added_user": merge_added_user,
                    "removed_user": merge_removed_user,
                    "added_steam": merge_added_steam,
                    "deactivated_steam": merge_deactivated_steam,
                }
            })

    conn.close()

    return {
        "format": "stormworks_tag_pack",
        "meta": payload.get("meta", {}),
        "total_pack_items": len(pack_items),
        "matched_count": len(matched_diffs),
        "unmatched_count": len(unmatched_ids),
        "matched_items": matched_diffs,
        "new_custom_tags": new_custom_tags,
        "known_steam_tags": sorted(list(all_steam_tags_set)),
        "has_tag_structure": bool(pack_structure and len(pack_structure) > 0),
        "pack_tag_structure": pack_structure,
        "local_tag_structure": local_structure,
    }


class AppliedItemTags(BaseModel):
    item_id: str
    user_tags: List[str]
    steam_tags: List[str]
    deactivated_steam_tags: List[str]


class ApplyImportRequest(BaseModel):
    import_tree: bool = True
    tag_structure: Optional[Any] = None
    custom_user_tags: Optional[List[str]] = None
    items: List[AppliedItemTags]


def normalize_and_deduplicate_tag_structure(tree, known_steam_tags=None):
    if not isinstance(tree, list):
        return []

    # If known_steam_tags not provided, load from database
    if known_steam_tags is None:
        try:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("SELECT api_tags, original_steam_tags FROM workshop_items WHERE api_tags IS NOT NULL OR original_steam_tags IS NOT NULL")
            known_steam_tags_set = set()
            for row in cur.fetchall():
                for col in ("api_tags", "original_steam_tags"):
                    if row[col]:
                        try:
                            for t in json.loads(row[col]):
                                if t and str(t).strip():
                                    known_steam_tags_set.add(str(t).strip().lower())
                        except Exception:
                            pass
            conn.close()
            known_steam_tags = known_steam_tags_set
        except Exception:
            known_steam_tags = set()
    else:
        known_steam_tags = {str(t).strip().lower() for t in known_steam_tags}

    result = []
    seen_tags = {}
    seen_folders = {}

    def get_node_key(node):
        if node.get('type') == 'folder':
            return f"folder:{str(node.get('name', '')).strip().lower()}"
        return f"tag:{str(node.get('tag', '')).strip().lower()}"

    def merge_into(target_list, incoming_nodes):
        for raw in incoming_nodes:
            if not isinstance(raw, dict):
                continue
            node = dict(raw)
            if node.get('tag'):
                node['tag'] = normalize_tag_leaf(node['tag'])
            tag_name_lower = str(node.get('tag', '')).strip().lower()

            if not tag_name_lower and not (node.get('type') == 'folder' and node.get('name')):
                continue

            # Steam priority: if tag is in known Steam tags, it MUST be steam!
            if node.get('type') == 'tag' and tag_name_lower in known_steam_tags:
                node['tagType'] = 'steam'
            else:
                tt = str(node.get('tagType', '')).lower()
                if tt in ('user', 'custom'):
                    node['tagType'] = 'user'
                elif node.get('type') == 'tag':
                    node['tagType'] = node.get('tagType') or 'steam'

            key = get_node_key(node)
            is_tag = node.get('type') == 'tag' and node.get('tag')
            is_folder = node.get('type') == 'folder' and node.get('name')

            if is_tag and key in seen_tags:
                existing = seen_tags[key]
                # Steam priority: if either was steam, stay steam
                if existing.get('tagType') == 'steam' or node.get('tagType') == 'steam' or tag_name_lower in known_steam_tags:
                    existing['tagType'] = 'steam'
                else:
                    existing['tagType'] = 'user'
                if node.get('children'):
                    merge_into(existing.setdefault('children', []), node['children'])
            elif is_folder and key in seen_folders:
                existing = seen_folders[key]
                if node.get('children'):
                    merge_into(existing.setdefault('children', []), node['children'])
            else:
                cloned = dict(node)
                children = cloned.get('children') or []
                cloned['children'] = []
                target_list.append(cloned)
                if is_tag:
                    seen_tags[key] = cloned
                elif is_folder:
                    seen_folders[key] = cloned
                if children:
                    merge_into(cloned['children'], children)

    merge_into(result, tree)
    return result


@router.post("/import/apply")
def apply_import_tags(payload: ApplyImportRequest):
    # Step 1: Create automatic safety backup before modifying anything
    backup_file = create_safety_backup()

    conn = get_connection()
    cur = conn.cursor()

    try:
        # Gather all known Steam tags first for strict validation
        cur.execute("SELECT api_tags, original_steam_tags FROM workshop_items WHERE api_tags IS NOT NULL OR original_steam_tags IS NOT NULL")
        all_steam_tags_set = set()
        for row in cur.fetchall():
            for col in ("api_tags", "original_steam_tags"):
                if row[col]:
                    try:
                        for t in json.loads(row[col]):
                            if t and str(t).strip():
                                all_steam_tags_set.add(str(t).strip())
                    except Exception:
                        pass
        steam_tags_lower = {t.lower() for t in all_steam_tags_set}

        # 1. Update tag structure if requested (normalized and deduplicated)
        if payload.import_tree and payload.tag_structure is not None:
            clean_tree = normalize_and_deduplicate_tag_structure(payload.tag_structure, steam_tags_lower)
            val = json.dumps(clean_tree)
            cur.execute(
                "INSERT INTO app_settings (key, value) VALUES ('tag_structure', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (val,)
            )

        # 2. Add custom tags if any (strictly leaf tags, never steam tags, never slashes!)
        now_ts = int(time.time())
        if payload.custom_user_tags:
            for tag in payload.custom_user_tags:
                leaf = normalize_tag_leaf(tag)
                if not leaf or leaf.lower() in steam_tags_lower:
                    continue
                cur.execute(
                    "INSERT OR IGNORE INTO custom_user_tags (tag, created_at) VALUES (?, ?)",
                    (leaf, now_ts)
                )

        # 3. Update workshop items tags (leaf tags only, promote steam tags to api_tags)
        for it in payload.items:
            fid = str(it.item_id)
            cur.execute("SELECT original_steam_tags, api_tags FROM workshop_items WHERE published_file_id = ?", (fid,))
            existing_row = cur.fetchone()
            orig_steam = []
            if existing_row and existing_row["original_steam_tags"]:
                try:
                    orig_steam = json.loads(existing_row["original_steam_tags"])
                except Exception:
                    orig_steam = []
            elif existing_row and existing_row["api_tags"]:
                try:
                    orig_steam = json.loads(existing_row["api_tags"])
                except Exception:
                    orig_steam = []
            orig_steam_clean = [str(t).strip() for t in orig_steam if str(t).strip()]

            clean_user = []
            clean_steam = [str(t).strip() for t in (it.steam_tags or []) if str(t).strip()]
            clean_deact = [str(t).strip() for t in (it.deactivated_steam_tags or []) if str(t).strip()]

            for ut in (it.user_tags or []):
                leaf = normalize_tag_leaf(ut)
                if not leaf:
                    continue
                if leaf.lower() in steam_tags_lower:
                    if leaf not in clean_steam:
                        clean_steam.append(leaf)
                    if leaf in clean_deact:
                        clean_deact.remove(leaf)
                else:
                    if leaf not in clean_user:
                        clean_user.append(leaf)
                    # Auto-register leaf tag in custom_user_tags
                    cur.execute(
                        "INSERT OR IGNORE INTO custom_user_tags (tag, created_at) VALUES (?, ?)",
                        (leaf, now_ts)
                    )

            # Preserve all original Steam tags from being deleted!
            # If an original steam tag is missing from clean_steam, it must NOT be deleted:
            # It is preserved in clean_steam and added to clean_deact (deactivated state).
            clean_steam_lower = {t.lower() for t in clean_steam}
            for ot in orig_steam_clean:
                if ot.lower() not in clean_steam_lower:
                    clean_steam.append(ot)
                    clean_steam_lower.add(ot.lower())
                clean_deact_lower = {t.lower() for t in clean_deact}
                imported_steam_lower = {str(t).strip().lower() for t in (it.steam_tags or [])}
                if ot.lower() not in clean_deact_lower and ot.lower() not in imported_steam_lower:
                    clean_deact.append(ot)

            user_tags_json = json.dumps(list(dict.fromkeys(clean_user)))
            api_tags_json = json.dumps(list(dict.fromkeys(clean_steam)))
            deactivated_json = json.dumps(list(dict.fromkeys(clean_deact)))

            cur.execute("""
                UPDATE workshop_items
                SET user_tags = ?,
                    api_tags = ?,
                    deactivated_steam_tags = ?,
                    is_sorted = 1
                WHERE published_file_id = ?
            """, (user_tags_json, api_tags_json, deactivated_json, fid))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Помилка застосування імпорту: {str(e)}")

    conn.close()
    return {
        "status": "ok",
        "applied_items_count": len(payload.items),
        "backup_file": backup_file.name
    }


class RestoreBackupRequest(BaseModel):
    backup_data: Dict[str, Any]


@router.post("/import/restore-backup")
def restore_full_backup(req: RestoreBackupRequest):
    data = req.backup_data
    if data.get("format") != "stormworks_manager_full_backup":
        raise HTTPException(status_code=400, detail="Невірний формат файлу повного бекапу")

    # Safety snapshot first
    backup_file = create_safety_backup()

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 1. Restore app_settings
        if "app_settings" in data:
            for s in data["app_settings"]:
                cur.execute("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (s["key"], s["value"]))

        # 2. Restore custom_user_tags
        if "custom_user_tags" in data:
            for t in data["custom_user_tags"]:
                cur.execute("INSERT OR REPLACE INTO custom_user_tags (tag, created_at) VALUES (?, ?)", (t["tag"], t["created_at"]))

        # 3. Restore workshop_items
        if "workshop_items" in data:
            for it in data["workshop_items"]:
                cols = [k for k in it.keys()]
                placeholders = ",".join("?" for _ in cols)
                updates = ",".join(f"{k} = excluded.{k}" for k in cols if k != "published_file_id")
                query = f"INSERT INTO workshop_items ({','.join(cols)}) VALUES ({placeholders}) ON CONFLICT(published_file_id) DO UPDATE SET {updates}"
                cur.execute(query, [it[k] for k in cols])

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Помилка відновлення бекапу: {str(e)}")

    conn.close()
    return {
        "status": "ok",
        "restored_items_count": len(data.get("workshop_items", [])),
        "safety_backup": backup_file.name
    }


@router.get("/backups")
def list_local_backups():
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    backups = []
    for p in sorted(BACKUPS_DIR.glob("*.json"), key=os.path.getmtime, reverse=True):
        stat = p.stat()
        backups.append({
            "filename": p.name,
            "size_bytes": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            "is_auto": p.name.startswith("auto_pre_import_")
        })
    return {"backups": backups}


@router.post("/backups/restore/{filename}")
def restore_local_backup_by_filename(filename: str):
    target = BACKUPS_DIR / filename
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Файл бекапу не знайдено")

    with open(target, "r", encoding="utf-8") as f:
        data = json.load(f)

    return restore_full_backup(RestoreBackupRequest(backup_data=data))


class SaveFileDialogRequest(BaseModel):
    suggested_filename: str
    content: str


@router.post("/save-file-dialog")
def save_file_dialog_endpoint(req: SaveFileDialogRequest):
    suggested = req.suggested_filename
    desktop_dir = Path.home() / "Desktop"
    if desktop_dir.exists():
        default_path = str(desktop_dir / suggested)
    else:
        default_path = str(Path.home() / suggested)

    chosen_path = None

    # Check for zenity or kdialog if GUI display available
    if os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"):
        if shutil.which("zenity"):
            try:
                proc = subprocess.run([
                    "zenity",
                    "--file-selection",
                    "--save",
                    "--confirm-overwrite",
                    f"--filename={default_path}",
                    "--title=Зберегти файл експорту тегів",
                    "--file-filter=Stormworks Tag Pack (*.swtags.json;*.json) | *.swtags.json *.json",
                    "--file-filter=All Files (*.*) | *"
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
                if proc.returncode == 0:
                    chosen_path = proc.stdout.strip()
                elif proc.returncode == 1:
                    return {"status": "cancelled"}
            except Exception as e:
                print("zenity error:", e)

        if not chosen_path and shutil.which("kdialog"):
            try:
                proc = subprocess.run([
                    "kdialog",
                    "--getsavefilename",
                    default_path,
                    "*.swtags.json *.json | Stormworks Tag Pack"
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
                if proc.returncode == 0 and proc.stdout.strip():
                    chosen_path = proc.stdout.strip()
                elif proc.returncode == 1:
                    return {"status": "cancelled"}
            except Exception as e:
                print("kdialog error:", e)

    if chosen_path:
        p = Path(chosen_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"status": "ok", "path": str(p)}

    return {"status": "unsupported"}

