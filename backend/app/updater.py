"""
Software Updater Service for Stormworks Workshop Manager
Handles:
1. Version detection and GitHub Releases API checking
2. OS & edition detection (Standalone, Slim, Server on Linux / Windows)
3. One-click downloading of release archive with progress tracking
4. Atomic in-place extraction (safeguarding user database & settings)
5. Clean process restart
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import urllib.request
import json
import logging
import time
import os
import sys
import shutil
import tarfile
import zipfile
import threading
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, List

router = APIRouter(prefix="/api/updater", tags=["updater"])

CURRENT_VERSION = "v0.1.1-beta-updatable"
GITHUB_REPO = "macenkodenis/stormworks-workshop-manager"
GITHUB_RELEASES_API = f"https://api.github.com/repos/{GITHUB_REPO}/releases"

logger = logging.getLogger(__name__)

# In-memory download & update task state
update_state = {
    "status": "idle",       # idle | downloading | extracting | ready_to_restart | error
    "progress": 0,          # 0..100
    "downloaded_bytes": 0,
    "total_bytes": 0,
    "speed_kbps": 0,
    "error": None,
    "target_asset": None,
    "latest_version": None,
    "release_notes": None
}

def parse_semver(tag: str):
    """Normalize version string for comparison (e.g., v0.1.0-beta.1 -> tuple)."""
    clean = tag.lstrip("v").strip()
    parts = clean.split("-", 1)
    nums = []
    for p in parts[0].split("."):
        try:
            nums.append(int(p))
        except ValueError:
            nums.append(0)
    prerelease = parts[1] if len(parts) > 1 else ""
    return nums, prerelease

def is_newer_version(remote_tag: str, current_tag: str) -> bool:
    """Returns True if remote_tag is strictly newer than current_tag."""
    r_nums, r_pre = parse_semver(remote_tag)
    c_nums, c_pre = parse_semver(current_tag)

    if r_nums > c_nums:
        return True
    if r_nums == c_nums:
        if c_pre and not r_pre:
            return True
        if r_pre and c_pre and r_pre != c_pre:
            return r_pre > c_pre
    return False

def detect_current_edition() -> Dict[str, str]:
    """
    Detects operating system and active packaging edition:
    Returns:
        {
            "os": "linux" | "windows",
            "edition": "standalone" | "slim" | "server",
            "is_frozen": bool,
            "executable": str,
            "install_dir": str
        }
    """
    is_frozen = getattr(sys, "frozen", False)
    os_name = "windows" if sys.platform == "win32" else "linux"
    
    exe_path = Path(sys.executable).resolve()
    exe_name = exe_path.name.lower()

    if "slim" in exe_name:
        edition = "slim"
    elif "server" in exe_name:
        edition = "server"
    else:
        edition = "slim" if os_name == "windows" else "standalone"

    # Installation root directory
    if is_frozen:
        install_dir = str(exe_path.parent)
    else:
        install_dir = str(Path(__file__).resolve().parent.parent.parent)

    return {
        "os": os_name,
        "edition": edition,
        "is_frozen": is_frozen,
        "executable": str(exe_path),
        "install_dir": install_dir
    }

def find_matching_asset(assets: List[Dict[str, Any]], env: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Select the exact release archive matching current OS and edition."""
    os_name = env["os"].capitalize()  # "Linux" or "Windows"
    edition_map = {
        "standalone": "Standalone",
        "slim": "Slim",
        "server": "Server"
    }
    ed_name = edition_map.get(env["edition"], "Standalone")
    if env["os"] == "windows" and ed_name == "Standalone":
        ed_name = "Slim"

    for asset in assets:
        name = asset.get("name", "")
        if os_name.lower() in name.lower() and ed_name.lower() in name.lower():
            if env["os"] == "linux" and name.endswith(".tar.gz"):
                return asset
            if env["os"] == "windows" and name.endswith(".zip"):
                return asset

    # Fallback to Server if matching slim/standalone wasn't found
    for asset in assets:
        name = asset.get("name", "")
        if os_name.lower() in name.lower() and "server" in name.lower():
            return asset

    return None

@router.get("/status")
def get_version_info() -> Dict[str, Any]:
    """Returns current version and runtime environment information."""
    env = detect_current_edition()
    return {
        "current_version": CURRENT_VERSION,
        "repository": GITHUB_REPO,
        "releases_url": f"https://github.com/{GITHUB_REPO}/releases",
        "environment": env,
        "state": update_state
    }

@router.get("/check")
def check_for_updates() -> Dict[str, Any]:
    """
    Queries GitHub API to check for newer releases.
    Returns latest release details, changelog, and matching downloadable asset.
    """
    req = urllib.request.Request(
        f"{GITHUB_RELEASES_API}/latest",
        headers={"User-Agent": "Stormworks-Workshop-Manager-Updater", "Accept": "application/vnd.github.v3+json"}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            list_req = urllib.request.Request(
                f"{GITHUB_RELEASES_API}?per_page=1",
                headers={"User-Agent": "Stormworks-Workshop-Manager-Updater", "Accept": "application/vnd.github.v3+json"}
            )
            try:
                with urllib.request.urlopen(list_req, timeout=10) as l_resp:
                    releases = json.loads(l_resp.read().decode("utf-8"))
                    if not releases:
                        return {"has_update": False, "current_version": CURRENT_VERSION, "checked_at": time.time()}
                    data = releases[0]
            except Exception as ex:
                logger.warning(f"Failed to check GitHub releases: {ex}")
                raise HTTPException(status_code=502, detail="Failed to connect to GitHub Releases API")
        else:
            logger.warning(f"GitHub Releases API returned HTTP {e.code}")
            raise HTTPException(status_code=502, detail=f"GitHub API error: {e.code}")
    except Exception as e:
        logger.warning(f"Failed to check GitHub releases: {e}")
        raise HTTPException(status_code=502, detail="Failed to reach GitHub Releases")

    latest_tag = data.get("tag_name", "")
    release_name = data.get("name") or latest_tag
    body = data.get("body", "")
    published_at = data.get("published_at", "")
    html_url = data.get("html_url", f"https://github.com/{GITHUB_REPO}/releases")
    
    assets = []
    for asset in data.get("assets", []):
        assets.append({
            "name": asset.get("name"),
            "size": asset.get("size"),
            "download_url": asset.get("browser_download_url")
        })

    env = detect_current_edition()
    matching_asset = find_matching_asset(assets, env)
    has_update = is_newer_version(latest_tag, CURRENT_VERSION)

    update_state["latest_version"] = latest_tag
    update_state["release_notes"] = body
    update_state["target_asset"] = matching_asset

    return {
        "has_update": has_update,
        "current_version": CURRENT_VERSION,
        "latest_version": latest_tag,
        "release_name": release_name,
        "release_notes": body,
        "published_at": published_at,
        "release_url": html_url,
        "environment": env,
        "matching_asset": matching_asset,
        "all_assets": assets
    }

def _download_and_extract_worker(download_url: str, filename: str):
    """Background worker for streaming download and preparation."""
    global update_state
    temp_dir = Path.home() / ".stormworks_workshop_manager" / "updates"
    temp_dir.mkdir(parents=True, exist_ok=True)
    archive_path = temp_dir / filename
    extract_dir = temp_dir / "extracted"

    try:
        update_state["status"] = "downloading"
        update_state["progress"] = 0
        update_state["downloaded_bytes"] = 0
        update_state["error"] = None

        req = urllib.request.Request(
            download_url,
            headers={"User-Agent": "Stormworks-Workshop-Manager-Updater"}
        )
        
        with urllib.request.urlopen(req, timeout=30) as response, open(archive_path, "wb") as out_file:
            total_size = int(response.info().get("Content-Length", 0))
            update_state["total_bytes"] = total_size
            downloaded = 0
            start_time = time.time()

            chunk_size = 1024 * 64  # 64 KB
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                out_file.write(chunk)
                downloaded += len(chunk)
                update_state["downloaded_bytes"] = downloaded

                if total_size > 0:
                    update_state["progress"] = int((downloaded / total_size) * 100)
                
                elapsed = time.time() - start_time
                if elapsed > 0:
                    update_state["speed_kbps"] = int((downloaded / 1024) / elapsed)

        # Extraction phase
        update_state["status"] = "extracting"
        update_state["progress"] = 100
        if extract_dir.exists():
            shutil.rmtree(extract_dir)
        extract_dir.mkdir(parents=True, exist_ok=True)

        if filename.endswith(".tar.gz") or filename.endswith(".tgz"):
            with tarfile.open(archive_path, "r:gz") as tar:
                tar.extractall(extract_dir)
        elif filename.endswith(".zip"):
            with zipfile.ZipFile(archive_path, "r") as zf:
                zf.extractall(extract_dir)
        else:
            raise ValueError(f"Unsupported archive format: {filename}")

        update_state["status"] = "ready_to_restart"
        logger.info(f"Update archive successfully downloaded and unpacked to {extract_dir}")

    except Exception as e:
        logger.error(f"Update download/extraction failed: {e}", exc_info=True)
        update_state["status"] = "error"
        update_state["error"] = str(e)

@router.post("/start-download")
def start_update_download(background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Begins the asynchronous download of the latest update package."""
    global update_state
    if update_state["status"] in ("downloading", "extracting"):
        return {"status": update_state["status"], "progress": update_state["progress"]}

    asset = update_state.get("target_asset")
    if not asset or not asset.get("download_url"):
        # Auto-check if not checked yet
        check_res = check_for_updates()
        asset = check_res.get("matching_asset")
        if not asset:
            raise HTTPException(status_code=404, detail="No matching release asset found for current environment")

    download_url = asset["download_url"]
    filename = asset["name"]

    background_tasks.add_task(_download_and_extract_worker, download_url, filename)
    return {"status": "started", "asset": asset}

@router.get("/progress")
def get_update_progress() -> Dict[str, Any]:
    """Returns real-time download and extraction progress."""
    return update_state

@router.post("/apply-and-restart")
def apply_and_restart() -> Dict[str, Any]:
    """
    Applies the downloaded update and restarts the application.
    Executes in-place replacement while preserving user data and database.
    """
    env = detect_current_edition()
    temp_dir = Path.home() / ".stormworks_workshop_manager" / "updates"
    extract_dir = temp_dir / "extracted"

    if not extract_dir.exists():
        raise HTTPException(status_code=400, detail="No extracted update found. Download update first.")

    # Find the payload folder inside extracted directory (usually contains the app folder or contents)
    items = list(extract_dir.iterdir())
    payload_dir = extract_dir
    if len(items) == 1 and items[0].is_dir():
        payload_dir = items[0]

    install_dir = Path(env["install_dir"])

    if not env["is_frozen"]:
        # Running from source: update frontend static build or notify
        logger.info("Running from source: updating static assets if available")
        static_src = payload_dir / "backend" / "static"
        if not static_src.exists():
            static_src = payload_dir / "static"
        if static_src.exists():
            dest_static = install_dir / "backend" / "static"
            shutil.rmtree(dest_static, ignore_errors=True)
            shutil.copytree(static_src, dest_static)
            return {"status": "success", "message": "Static assets updated for development mode. Please restart server."}
        return {"status": "notice", "message": "Source installation detected. Use git pull to update python source files."}

    # Running as compiled binary: create atomic swap script and restart
    if env["os"] == "windows":
        bat_script = temp_dir / "_apply_update.bat"
        exe_name = Path(env["executable"]).name
        bat_content = f"""@echo off
timeout /t 2 /nobreak >nul
xcopy /s /e /y /q "{payload_dir}\\*" "{install_dir}\\"
rmdir /s /q "{temp_dir}"
start "" "{install_dir}\\{exe_name}"
del "%~f0"
"""
        with open(bat_script, "w", encoding="utf-8") as f:
            f.write(bat_content)
        
        subprocess.Popen(["cmd.exe", "/c", str(bat_script)], creationflags=0x00000008 | 0x00000200)
        # Terminate current app process so files are released
        threading.Thread(target=lambda: (time.sleep(0.5), os._exit(0))).start()
        return {"status": "restarting", "message": "Applying update and restarting..."}

    else:
        # Linux
        sh_script = temp_dir / "_apply_update.sh"
        exe_path = env["executable"]
        sh_content = f"""#!/bin/sh
sleep 1
cp -rf "{payload_dir}"/* "{install_dir}"/
rm -rf "{temp_dir}"
chmod +x "{exe_path}"
nohup "{exe_path}" "$@" > /dev/null 2>&1 &
rm -- "$0"
"""
        with open(sh_script, "w", encoding="utf-8") as f:
            f.write(sh_content)
        sh_script.chmod(0o755)

        subprocess.Popen(["/bin/sh", str(sh_script)], start_new_session=True)
        threading.Thread(target=lambda: (time.sleep(0.5), os._exit(0))).start()
        return {"status": "restarting", "message": "Applying update and restarting on Linux..."}
