import os
from pathlib import Path
from typing import Dict, Any, Optional

def analyze_local_item(item_dir: Path) -> Dict[str, Any]:
    """
    Analyzes local Stormworks files in item folder.
    Calculates exact disk size, mtime, detects item type and local preview.
    """
    total_size = 0
    latest_mtime = 0
    files_list = []
    has_vehicle_xml = False
    has_mod_xml = False
    has_microcontroller = False
    has_mission = False
    local_preview_file: Optional[str] = None

    try:
        for entry in item_dir.iterdir():
            if entry.is_file():
                st = entry.stat()
                total_size += st.st_size
                if st.st_mtime > latest_mtime:
                    latest_mtime = int(st.st_mtime)
                fname = entry.name.lower()
                files_list.append(entry.name)
                
                if fname == "vehicle.xml":
                    has_vehicle_xml = True
                elif fname == "mod.xml":
                    has_mod_xml = True
                elif fname.endswith(".xml") and "microcontroller" in fname:
                    has_microcontroller = True
                elif fname in ("workshop_preview.png", "mod.png", "preview.png"):
                    local_preview_file = str(entry.resolve())
            elif entry.is_dir():
                for root, dirs, files in os.walk(entry):
                    for f in files:
                        fp = Path(root) / f
                        st = fp.stat()
                        total_size += st.st_size
                        if st.st_mtime > latest_mtime:
                            latest_mtime = int(st.st_mtime)
                        if f.lower() in ("workshop_preview.png", "mod.png") and not local_preview_file:
                            local_preview_file = str(fp.resolve())
    except Exception as e:
        print(f"Error inspecting {item_dir}: {e}")

    detected_type = "Unknown"
    local_title: Optional[str] = None
    local_author: Optional[str] = None
    local_description: Optional[str] = None

    if has_vehicle_xml:
        detected_type = "Vehicle"
    elif has_mod_xml:
        detected_type = "Mod/Component"
        mod_file = item_dir / "mod.xml"
        if mod_file.exists():
            try:
                import xml.etree.ElementTree as ET
                tree = ET.parse(str(mod_file))
                root = tree.getroot()
                if root.tag == "mod":
                    local_title = root.attrib.get("name") or None
                    local_author = root.attrib.get("author") or None
                    local_description = root.attrib.get("desc") or None
            except Exception:
                pass
    elif has_microcontroller:
        detected_type = "Microcontroller"
    elif has_mission:
        detected_type = "Mission/Addon"

    return {
        "local_size_bytes": total_size,
        "local_mtime": latest_mtime,
        "detected_type": detected_type,
        "local_preview_file": local_preview_file,
        "local_title": local_title,
        "local_author": local_author,
        "local_description": local_description,
        "file_count": len(files_list)
    }
