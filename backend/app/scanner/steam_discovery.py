import os
import sys
from pathlib import Path
from typing import List, Optional
from .vdf_parser import parse_vdf

POSSIBLE_STEAM_ROOTS = [
    Path.home() / ".local/share/Steam",
    Path.home() / ".steam/steam",
    Path.home() / ".var/app/com.valvesoftware.Steam/.local/share/Steam",
    Path.home() / "snap/steam/common/.local/share/Steam"
]

def find_steam_root() -> Optional[Path]:
    if sys.platform == "win32":
        try:
            import winreg
            for root_key, subkey, val_name in [
                (winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam", "SteamPath"),
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath"),
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Valve\Steam", "InstallPath"),
            ]:
                try:
                    with winreg.OpenKey(root_key, subkey) as key:
                        val, _ = winreg.QueryValueEx(key, val_name)
                        if val:
                            p = Path(val).resolve()
                            if p.exists() and (p / "steamapps").is_dir():
                                return p
                except Exception:
                    pass
        except ImportError:
            pass

        win_candidates = []
        p86 = os.environ.get("ProgramFiles(x86)")
        if p86:
            win_candidates.append(Path(p86) / "Steam")
        pf = os.environ.get("ProgramFiles")
        if pf:
            win_candidates.append(Path(pf) / "Steam")
        win_candidates.extend([
            Path("C:/Program Files (x86)/Steam"),
            Path("C:/Program Files/Steam"),
            Path("C:/Steam"),
            Path("D:/Steam"),
            Path("E:/Steam"),
        ])
        for p in win_candidates:
            if p.exists() and (p / "steamapps").is_dir():
                return p.resolve()
        return None

    for p in POSSIBLE_STEAM_ROOTS:
        if p.exists() and (p / "steamapps").is_dir():
            return p.resolve()
    return None

def find_steam_libraries(steam_root: Optional[Path] = None) -> List[Path]:
    if not steam_root:
        steam_root = find_steam_root()
    if not steam_root:
        return []

    libraries = [steam_root]
    vdf_path = steam_root / "steamapps" / "libraryfolders.vdf"
    if vdf_path.exists():
        try:
            with open(vdf_path, "r", encoding="utf-8", errors="ignore") as f:
                data = parse_vdf(f.read())
            folders = data.get("libraryfolders", {})
            for key, val in folders.items():
                if isinstance(val, dict) and "path" in val:
                    lib_path = Path(val["path"]).resolve()
                    if lib_path not in libraries and lib_path.exists():
                        libraries.append(lib_path)
        except Exception as e:
            print(f"Warning: Failed to parse libraryfolders.vdf: {e}")

    return libraries

def find_subscriptions_vdf(app_id: Optional[int] = None, steam_root: Optional[Path] = None) -> Optional[Path]:
    from ..config import APP_ID
    target_app_id = app_id or APP_ID
    if not steam_root:
        steam_root = find_steam_root()
    if not steam_root:
        return None
    userdata = steam_root / "userdata"
    if not userdata.exists():
        return None
    matches = list(userdata.glob(f"*/ugc/{target_app_id}_subscriptions.vdf"))
    if matches:
        return matches[0]
    return None
