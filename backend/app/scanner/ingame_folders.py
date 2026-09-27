import os
import platform
import shutil
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional
from .steam_discovery import find_steam_root, find_steam_libraries

def is_game_running() -> bool:
    """
    Checks if Stormworks process is currently running.
    """
    system = platform.system()
    if system == "Windows":
        try:
            res = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq stormworks64.exe"],
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
            )
            if "stormworks64.exe" in res.stdout.lower():
                return True
            res32 = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq stormworks.exe"],
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
            )
            return "stormworks.exe" in res32.stdout.lower()
        except Exception:
            return False
    else:
        # Linux / Unix
        try:
            res = subprocess.run(["pgrep", "-i", "stormworks"], capture_output=True, text=True)
            return res.returncode == 0 and bool(res.stdout.strip())
        except Exception:
            return False

def find_save_xml_path(custom_path: Optional[str] = None) -> Optional[Path]:
    """
    Discovers the path to save.xml.
    1. Checks custom_path if provided.
    2. On Windows: %APPDATA%/Stormworks/save.xml
    3. On Linux/Proton: Checks Steam libraries compatdata 573090.
    """
    if custom_path:
        cp = Path(custom_path).expanduser().resolve()
        if cp.exists() and cp.is_file():
            return cp

    system = platform.system()
    if system == "Windows":
        appdata = os.environ.get("APPDATA")
        if appdata:
            p = Path(appdata) / "Stormworks" / "save.xml"
            if p.exists():
                return p
        default_win = Path.home() / "AppData" / "Roaming" / "Stormworks" / "save.xml"
        if default_win.exists():
            return default_win

    # Linux / Proton discovery
    libraries = find_steam_libraries()
    steam_root = find_steam_root()
    if steam_root and steam_root not in libraries:
        libraries.append(steam_root)

    for lib in libraries:
        compat_users = lib / "steamapps" / "compatdata" / "573090" / "pfx" / "drive_c" / "users"
        if compat_users.exists():
            su = compat_users / "steamuser" / "AppData" / "Roaming" / "Stormworks" / "save.xml"
            if su.exists():
                return su
            matches = list(compat_users.glob("*/AppData/Roaming/Stormworks/save.xml"))
            if matches:
                return matches[0]

    # Common fallback paths on Linux
    fallbacks = [
        Path.home() / ".steam/steam/steamapps/compatdata/573090/pfx/drive_c/users/steamuser/AppData/Roaming/Stormworks/save.xml",
        Path.home() / ".local/share/Steam/steamapps/compatdata/573090/pfx/drive_c/users/steamuser/AppData/Roaming/Stormworks/save.xml",
        Path.home() / ".var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/compatdata/573090/pfx/drive_c/users/steamuser/AppData/Roaming/Stormworks/save.xml"
    ]
    for fb in fallbacks:
        if fb.exists():
            return fb

    return None

def _create_backup(save_path: Path):
    """
    Creates a timestamped backup of save.xml and maintains up to 10 latest backups.
    """
    try:
        backup_dir = save_path.parent / "backups_manager"
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_file = backup_dir / f"save.xml.bak_{int(time.time())}"
        shutil.copy2(save_path, backup_file)

        # Cleanup older backups (keep last 10)
        backups = sorted(backup_dir.glob("save.xml.bak_*"), key=lambda p: p.stat().st_mtime)
        if len(backups) > 10:
            for old_bak in backups[:-10]:
                try:
                    old_bak.unlink()
                except OSError:
                    pass
    except Exception as e:
        print(f"Warning: Failed to create save.xml backup: {e}")

def get_ingame_folders_data(custom_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Reads all in-game vehicle groups from save.xml.
    """
    save_path = find_save_xml_path(custom_path)
    game_running = is_game_running()

    if not save_path or not save_path.exists():
        return {
            "save_path": str(save_path) if save_path else None,
            "exists": False,
            "game_running": game_running,
            "folders": [],
            "item_to_folder": {}
        }

    folders: List[Dict[str, Any]] = []
    item_to_folder: Dict[str, str] = {}
    item_to_folders: Dict[str, List[str]] = {}

    try:
        tree = ET.parse(save_path)
        root = tree.getroot()
        ep = root.find("editor_preferences")
        if ep is not None:
            vg = ep.find("vehicle_groups")
            if vg is not None:
                for g in vg.findall("g"):
                    name = g.attrib.get("name", "").strip()
                    if not name:
                        continue
                    filenames: List[str] = []
                    fns_elem = g.find("filenames")
                    if fns_elem is not None:
                        for f in fns_elem.findall("f"):
                            val = f.attrib.get("value")
                            if val:
                                sval = str(val)
                                filenames.append(val)
                                if sval not in item_to_folder:
                                    item_to_folder[sval] = name
                                if sval not in item_to_folders:
                                    item_to_folders[sval] = []
                                if name not in item_to_folders[sval]:
                                    item_to_folders[sval].append(name)

                    folders.append({
                        "name": name,
                        "filenames": filenames,
                        "count": len(filenames)
                    })
    except Exception as e:
        print(f"Error reading save.xml in get_ingame_folders_data: {e}")

    return {
        "save_path": str(save_path),
        "exists": True,
        "game_running": game_running,
        "folders": folders,
        "item_to_folder": item_to_folder,
        "item_to_folders": item_to_folders
    }

def _load_and_prepare_xml(custom_path: Optional[str] = None):
    """
    Loads save.xml and ensures <editor_preferences> and <vehicle_groups> elements exist.
    """
    if is_game_running():
        raise RuntimeError("Stormworks is running. Please close the game before modifying folders.")

    save_path = find_save_xml_path(custom_path)
    if not save_path or not save_path.exists():
        raise FileNotFoundError(f"save.xml not found. Checked: {save_path or 'automatic paths'}")

    tree = ET.parse(save_path)
    root = tree.getroot()
    if root.tag != "save_data":
        raise ValueError("Invalid save.xml: root tag is not save_data")

    ep = root.find("editor_preferences")
    if ep is None:
        ep = ET.SubElement(root, "editor_preferences")

    vg = ep.find("vehicle_groups")
    if vg is None:
        vg = ET.SubElement(ep, "vehicle_groups")

    return save_path, tree, root, vg

def _write_xml_safely(save_path: Path, tree: ET.ElementTree):
    """
    Creates backup and safely writes out the XML tree.
    """
    _create_backup(save_path)
    if hasattr(ET, "indent"):
        ET.indent(tree, space="\t")
    tree.write(str(save_path), encoding="UTF-8", xml_declaration=True)

def create_folder(folder_name: str, custom_path: Optional[str] = None) -> Dict[str, Any]:
    clean_name = folder_name.strip()
    if not clean_name:
        raise ValueError("Folder name cannot be empty")

    save_path, tree, _, vg = _load_and_prepare_xml(custom_path)

    for g in vg.findall("g"):
        if g.attrib.get("name", "").strip().lower() == clean_name.lower():
            raise ValueError(f"Folder '{clean_name}' already exists")

    new_g = ET.SubElement(vg, "g", {"name": clean_name})
    ET.SubElement(new_g, "filenames")

    _write_xml_safely(save_path, tree)
    return get_ingame_folders_data(str(save_path))

def rename_folder(old_name: str, new_name: str, custom_path: Optional[str] = None) -> Dict[str, Any]:
    clean_new = new_name.strip()
    if not clean_new:
        raise ValueError("New folder name cannot be empty")

    save_path, tree, _, vg = _load_and_prepare_xml(custom_path)

    target_g = None
    for g in vg.findall("g"):
        curr_name = g.attrib.get("name", "").strip()
        if curr_name == old_name:
            target_g = g
        elif curr_name.lower() == clean_new.lower():
            raise ValueError(f"Folder '{clean_new}' already exists")

    if target_g is None:
        raise ValueError(f"Folder '{old_name}' not found")

    target_g.attrib["name"] = clean_new
    _write_xml_safely(save_path, tree)
    return get_ingame_folders_data(str(save_path))

def delete_folder(folder_name: str, custom_path: Optional[str] = None) -> Dict[str, Any]:
    save_path, tree, _, vg = _load_and_prepare_xml(custom_path)

    target_g = None
    for g in vg.findall("g"):
        if g.attrib.get("name", "").strip() == folder_name:
            target_g = g
            break

    if target_g is None:
        raise ValueError(f"Folder '{folder_name}' not found")

    vg.remove(target_g)
    _write_xml_safely(save_path, tree)
    return get_ingame_folders_data(str(save_path))

def assign_items_to_folder(
    folder_name: Optional[str],
    item_ids: List[str],
    mode: str = "single",
    action: str = "set",
    custom_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Assigns or removes item_ids to/from the specified folder_name.
    - action == "remove": removes item_ids from folder_name (or from all folders if folder_name is None).
    - action == "add": adds item_ids to folder_name (does not remove from other folders).
    - action == "set":
        - if mode == "single": removes item_ids from all other folders, then adds to folder_name.
        - if mode == "multi": adds item_ids to folder_name without removing from others.
    """
    save_path, tree, _, vg = _load_and_prepare_xml(custom_path)
    target_ids_set = {str(iid).strip() for iid in item_ids if str(iid).strip()}

    if action == "remove":
        # Remove from specific folder or all folders
        clean_target = folder_name.strip() if folder_name and folder_name.strip() else None
        for g in vg.findall("g"):
            g_name = g.attrib.get("name", "").strip()
            if clean_target is None or g_name.lower() == clean_target.lower():
                fns = g.find("filenames")
                if fns is not None:
                    to_remove = [f for f in fns.findall("f") if f.attrib.get("value", "").strip() in target_ids_set]
                    for f in to_remove:
                        fns.remove(f)
        _write_xml_safely(save_path, tree)
        return get_ingame_folders_data(str(save_path))

    # For "set" or "add":
    target_g = None
    if folder_name and folder_name.strip():
        clean_target = folder_name.strip()
        for g in vg.findall("g"):
            if g.attrib.get("name", "").strip().lower() == clean_target.lower():
                target_g = g
                break
        if target_g is None:
            target_g = ET.SubElement(vg, "g", {"name": clean_target})
            ET.SubElement(target_g, "filenames")

    if action == "set" and mode == "single":
        # In single-mode "set", remove from all groups first
        for g in vg.findall("g"):
            fns = g.find("filenames")
            if fns is not None:
                to_remove = [f for f in fns.findall("f") if f.attrib.get("value", "").strip() in target_ids_set]
                for f in to_remove:
                    fns.remove(f)

    # Now add to target_g if target_g is specified
    if target_g is not None:
        fns = target_g.find("filenames")
        if fns is None:
            fns = ET.SubElement(target_g, "filenames")

        existing_values = {f.attrib.get("value", "").strip() for f in fns.findall("f")}
        for iid in item_ids:
            clean_id = str(iid).strip()
            if clean_id and clean_id not in existing_values:
                ET.SubElement(fns, "f", {"value": clean_id})
                existing_values.add(clean_id)

    _write_xml_safely(save_path, tree)
    return get_ingame_folders_data(str(save_path))
