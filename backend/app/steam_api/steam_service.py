import asyncio
import glob
import json
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path
from typing import Dict, Any, List, Optional
import websockets

from ..config import APP_ID, BASE_DIR
from ..db.session import get_connection
from ..scanner.vdf_parser import parse_vdf, dumps_vdf
from ..scanner.steam_discovery import find_steam_root as discover_steam_root, find_subscriptions_vdf as discover_subscriptions_vdf

DEBUG_PORT = 8080

class SteamService:
    @staticmethod
    def find_steam_root() -> Path:
        root = discover_steam_root()
        if root:
            return root
        return Path.home() / ".local" / "share" / "Steam"

    @staticmethod
    def find_subscriptions_vdf() -> Optional[Path]:
        return discover_subscriptions_vdf(app_id=APP_ID)

    @staticmethod
    def get_steam_pid() -> Optional[int]:
        """Finds the main Steam client PID via pidfile or exact process match."""
        import sys
        if sys.platform == "win32":
            try:
                creationflags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
                res = subprocess.run(
                    ["tasklist", "/FI", "IMAGENAME eq steam.exe", "/FO", "CSV", "/NH"],
                    capture_output=True,
                    text=True,
                    creationflags=creationflags
                )
                for line in res.stdout.splitlines():
                    parts = line.strip().split(",")
                    if len(parts) >= 2 and "steam.exe" in parts[0].lower():
                        clean_pid = parts[1].strip('"')
                        if clean_pid.isdigit():
                            return int(clean_pid)
            except Exception:
                pass
            return None

        candidates = [
            Path.home() / ".steam" / "steam.pid",
            Path.home() / ".local" / "share" / "Steam" / "steam.pid"
        ]
        for p in candidates:
            if p.exists():
                try:
                    pid = int(p.read_text().strip())
                    # Check if process is actually alive
                    os.kill(pid, 0)
                    return pid
                except (ValueError, OSError):
                    pass
        # Fallback to exact process name match (avoids matching srt-logger / steamwebhelper args)
        try:
            res = subprocess.run(["pgrep", "-x", "steam"], capture_output=True, text=True)
            if res.returncode == 0 and res.stdout.strip():
                pids = [int(x) for x in res.stdout.strip().split() if x.isdigit()]
                if pids:
                    return pids[0]
        except Exception:
            pass
        return None

    @staticmethod
    def is_steam_running() -> bool:
        return SteamService.get_steam_pid() is not None

    @staticmethod
    def is_cef_debugging_active(port: int = DEBUG_PORT) -> bool:
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{port}/json", headers={"User-Agent": "SW-Manager"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                data = json.loads(resp.read().decode())
                return isinstance(data, list)
        except Exception:
            return False

    @staticmethod
    def get_status() -> Dict[str, Any]:
        running = SteamService.is_steam_running()
        cef_active = SteamService.is_cef_debugging_active()
        vdf_path = SteamService.find_subscriptions_vdf()
        user_id = vdf_path.parent.parent.name if vdf_path else None

        return {
            "is_running": running,
            "cef_debugging": cef_active,
            "debug_port": DEBUG_PORT,
            "vdf_available": vdf_path is not None and vdf_path.exists(),
            "subscriptions_vdf_path": str(vdf_path) if vdf_path else None,
            "steam_user_id": user_id,
            "preferred_mode": "mode_a" if cef_active else "mode_b"
        }

    @staticmethod
    async def restart_steam_with_debugging(port: int = DEBUG_PORT) -> Dict[str, Any]:
        """
        Gracefully shuts down Steam using 'steam -shutdown',
        waits for termination, verifies port availability, and relaunches with '-cef-enable-debugging'.
        """
        pid = SteamService.get_steam_pid()
        steam_root = SteamService.find_steam_root()
        import sys
        is_win = sys.platform == "win32"
        creationflags = subprocess.CREATE_NO_WINDOW if (is_win and hasattr(subprocess, "CREATE_NO_WINDOW")) else 0

        if pid is not None:
            # 1. Graceful shutdown
            try:
                if is_win:
                    steam_exe = steam_root / "steam.exe" if (steam_root / "steam.exe").exists() else Path("C:/Program Files (x86)/Steam/steam.exe")
                    subprocess.run([str(steam_exe), "-shutdown"], capture_output=True, timeout=5, creationflags=creationflags)
                else:
                    subprocess.run(["steam", "-shutdown"], capture_output=True, timeout=5)
            except Exception as e:
                print(f"Error executing steam -shutdown: {e}")

            # Wait up to 12 seconds for steam process to fully exit
            for _ in range(24):
                await asyncio.sleep(0.5)
                if not SteamService.is_steam_running():
                    break

            # If still running, terminate
            if SteamService.is_steam_running():
                current_pid = SteamService.get_steam_pid()
                if current_pid:
                    try:
                        if is_win:
                            subprocess.run(["taskkill", "/F", "/PID", str(current_pid)], capture_output=True, creationflags=creationflags)
                        else:
                            os.kill(current_pid, 15)
                    except OSError:
                        pass
                for _ in range(10):
                    await asyncio.sleep(0.5)
                    if not SteamService.is_steam_running():
                        break

            # Settle period for sockets and file locks to release
            await asyncio.sleep(1.0)

        # 2. Verify port 8080 is not held by another non-steam service
        import socket
        port_free = False
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(('127.0.0.1', port))
                port_free = True
            except OSError:
                port_free = False

        if not port_free and not SteamService.is_cef_debugging_active(port):
            return {
                "status": "error",
                "message": f"???? {port} ??????? ????? ?????????. ???? ?????, ????????? ???? {port}."
            }

        # 3. Relaunch steam with -cef-enable-debugging
        try:
            if is_win:
                steam_exe = steam_root / "steam.exe" if (steam_root / "steam.exe").exists() else Path("C:/Program Files (x86)/Steam/steam.exe")
                subprocess.Popen(
                    [str(steam_exe), "-cef-enable-debugging"],
                    creationflags=creationflags,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            else:
                import shutil
                steam_binary = shutil.which("steam") or "/usr/bin/steam"
                env = os.environ.copy()
                subprocess.Popen(
                    [steam_binary, "-cef-enable-debugging"],
                    start_new_session=True,
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
        except Exception as e:
            return {"status": "error", "message": f"Failed to launch steam: {e}"}

        # 4. Wait for CEF port to become available
        ready = False
        for _ in range(30):
            await asyncio.sleep(0.6)
            if SteamService.is_cef_debugging_active(port):
                ready = True
                break

        return {
            "status": "ok" if ready else "warning",
            "is_running": SteamService.is_steam_running(),
            "cef_debugging": ready,
            "debug_port": port,
            "message": "Steam restarted successfully with CEF debugging enabled!" if ready else "Steam launched, waiting for CEF debug port..."
        }

    @staticmethod
    async def execute_cef_rpc(js_expression: str, port: int = DEBUG_PORT) -> Dict[str, Any]:
        """
        Connects to Steam CEF via WebSocket and executes an expression using Chrome DevTools Protocol.
        Targets 'SharedJSContext' (steamloopback.host) where SteamClient.Apps API is available.
        """
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{port}/json", headers={"User-Agent": "SW-Manager"})
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                targets = json.loads(resp.read().decode())

            target_ws_url = None

            # Priority 1: SharedJSContext - this is where SteamClient.Apps lives
            for t in targets:
                title = t.get("title", "")
                url = t.get("url", "")
                ws = t.get("webSocketDebuggerUrl", "")
                if ws and ("SharedJSContext" in title or "steamloopback.host" in url):
                    target_ws_url = ws
                    break

            # Priority 2: Any page with steamloopback or steamui in URL
            if not target_ws_url:
                for t in targets:
                    url = t.get("url", "")
                    ws = t.get("webSocketDebuggerUrl", "")
                    if ws and ("steamui" in url or "clientui" in url):
                        target_ws_url = ws
                        break

            # Fallback: first available target
            if not target_ws_url and targets:
                target_ws_url = targets[0].get("webSocketDebuggerUrl")

            if not target_ws_url:
                raise RuntimeError("No WebSocket debugger URL found in Steam CEF targets")

            async with websockets.connect(target_ws_url) as ws:
                msg_id = 101
                cmd = {
                    "id": msg_id,
                    "method": "Runtime.evaluate",
                    "params": {
                        "expression": js_expression,
                        "returnByValue": True,
                        "awaitPromise": True
                    }
                }
                await ws.send(json.dumps(cmd))
                while True:
                    raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    msg = json.loads(raw)
                    if msg.get("id") == msg_id:
                        result = msg.get("result", {})
                        # Raise if there was an exception
                        if "exceptionDetails" in result:
                            exc = result["exceptionDetails"]
                            raise RuntimeError(f"JS exception: {exc.get('text','unknown')} - {exc.get('exception', {}).get('description','')}")
                        return result.get("result", {})

        except Exception as e:
            raise RuntimeError(f"Steam CEF RPC execution failed: {e}")

    @staticmethod
    def execute_vdf_disabled_toggle(item_ids: List[str], is_disabled: bool) -> int:
        """
        Mode B: Directly updates 'disabled_locally' in 573090_subscriptions.vdf
        and deletes or restores local files.
        """
        vdf_path = SteamService.find_subscriptions_vdf()
        if not vdf_path or not vdf_path.exists():
            raise FileNotFoundError("subscriptions.vdf not found in Steam userdata")

        with open(vdf_path, "r", encoding="utf-8", errors="ignore") as f:
            vdf_content = f.read()

        data = parse_vdf(vdf_content)
        sub_dict = data.get("subscribedfiles", {})

        target_val = "1" if is_disabled else "0"
        ids_set = set(item_ids)
        affected = 0

        # Subscribed files are numbered keys: "0", "1", ...
        for key, val in list(sub_dict.items()):
            if isinstance(val, dict) and "publishedfileid" in val:
                pid = str(val["publishedfileid"])
                if pid in ids_set:
                    val["disabled_locally"] = target_val
                    affected += 1

        # Write back to VDF
        new_vdf = dumps_vdf(data)
        with open(vdf_path, "w", encoding="utf-8") as f:
            f.write(new_vdf)

        # File handling: if disabled, remove local workshop folder
        steam_root = SteamService.find_steam_root()
        workshop_content = steam_root / "steamapps" / "workshop" / "content" / str(APP_ID)

        if is_disabled and workshop_content.exists():
            for item_id in item_ids:
                item_folder = workshop_content / str(item_id)
                if item_folder.exists() and item_folder.is_dir():
                    try:
                        shutil.rmtree(item_folder)
                    except Exception as e:
                        print(f"Failed to remove folder {item_folder}: {e}")

        return affected

    @staticmethod
    async def set_items_disabled(item_ids: List[str], is_disabled: bool, mode: str = "hybrid") -> Dict[str, Any]:
        """
        High-level dispatcher for setting items disabled or enabled.
        Supports: 'mode_a', 'mode_b', 'hybrid'
        """
        if not item_ids:
            return {"status": "ok", "affected": 0, "mode_used": mode}

        cef_ready = SteamService.is_cef_debugging_active()
        use_mode_a = (mode == "mode_a") or (mode == "hybrid" and cef_ready)

        mode_used = "mode_a" if use_mode_a else "mode_b"

        if use_mode_a:
            ids_json = json.dumps([str(x) for x in item_ids])
            js = f"SteamClient.Apps.SetWorkshopItemsDisabledLocally({APP_ID}, {ids_json}, {'true' if is_disabled else 'false'});"
            await SteamService.execute_cef_rpc(js)
        else:
            SteamService.execute_vdf_disabled_toggle(item_ids, is_disabled)

        # Update local SQLite database
        conn = get_connection()
        cur = conn.cursor()
        target_int = 1 if is_disabled else 0
        cur.executemany(
            "UPDATE workshop_items SET is_disabled = ? WHERE published_file_id = ?",
            [(target_int, str(i)) for i in item_ids]
        )
        conn.commit()
        conn.close()

        return {
            "status": "ok",
            "affected": len(item_ids),
            "is_disabled": is_disabled,
            "mode_used": mode_used
        }

    @staticmethod
    def execute_vdf_subscription_toggle(item_ids: List[str], is_subscribed: bool) -> int:
        """
        Mode B: Removes or restores entries in 573090_subscriptions.vdf for unsubscription.
        When unsubscribing: removes the entry from the VDF entirely.
        When subscribing: adds back a minimal entry with disabled_locally=0.
        Note: Steam must be closed for this to take effect (VDF is cached in memory).
        """
        vdf_path = SteamService.find_subscriptions_vdf()
        if not vdf_path or not vdf_path.exists():
            raise FileNotFoundError("subscriptions.vdf not found in Steam userdata")

        with open(vdf_path, "r", encoding="utf-8", errors="ignore") as f:
            vdf_content = f.read()

        data = parse_vdf(vdf_content)
        sub_dict = data.get("subscribedfiles", {})
        ids_set = set(item_ids)
        affected = 0

        if not is_subscribed:
            # Remove entries for unsubscribed items
            keys_to_remove = []
            for key, val in list(sub_dict.items()):
                if isinstance(val, dict) and "publishedfileid" in val:
                    if str(val["publishedfileid"]) in ids_set:
                        keys_to_remove.append(key)
                        affected += 1
            for k in keys_to_remove:
                del sub_dict[k]
        else:
            # Re-add entries for re-subscribed items (minimal, Steam will update on restart)
            import time
            existing_pids = set()
            for key, val in sub_dict.items():
                if isinstance(val, dict) and "publishedfileid" in val:
                    existing_pids.add(str(val["publishedfileid"]))

            # Find highest existing numeric key
            numeric_keys = [int(k) for k in sub_dict.keys() if k.isdigit()]
            next_key = max(numeric_keys, default=-1) + 1

            for item_id in item_ids:
                if str(item_id) not in existing_pids:
                    sub_dict[str(next_key)] = {
                        "publishedfileid": str(item_id),
                        "time_subscribed": str(int(time.time())),
                        "disabled_locally": "0"
                    }
                    next_key += 1
                    affected += 1

        new_vdf = dumps_vdf(data)
        with open(vdf_path, "w", encoding="utf-8") as f:
            f.write(new_vdf)

        return affected

    @staticmethod
    async def set_items_disabled(item_ids: List[str], is_disabled: bool, mode: str = "hybrid") -> Dict[str, Any]:
        """
        High-level dispatcher for setting items disabled or enabled.
        Supports: 'mode_a', 'mode_b', 'hybrid'

        Important: Mode B (VDF file edit) only works reliably when Steam is closed.
        When Steam is running, only Mode A (CEF WebSocket RPC via SharedJSContext) is effective.
        In hybrid mode: automatically uses Mode A if CEF debugging is available.
        """
        if not item_ids:
            return {"status": "ok", "affected": 0, "mode_used": mode}

        cef_ready = SteamService.is_cef_debugging_active()
        steam_running = SteamService.is_steam_running()

        use_mode_a = (mode == "mode_a") or (mode == "hybrid" and cef_ready)

        # Safety: if steam is running but CEF is not available and mode_b forced, warn
        if mode == "mode_b" and steam_running and not cef_ready:
            print(f"WARNING: Mode B requested but Steam is running without CEF debug port. "
                  f"VDF changes will not take effect until Steam restarts.")

        mode_used = "mode_a" if use_mode_a else "mode_b"

        if use_mode_a:
            ids_json = json.dumps([str(x) for x in item_ids])
            js = f"SteamClient.Apps.SetWorkshopItemsDisabledLocally({APP_ID}, {ids_json}, {'true' if is_disabled else 'false'});"
            await SteamService.execute_cef_rpc(js)
        else:
            SteamService.execute_vdf_disabled_toggle(item_ids, is_disabled)

        # Update local SQLite database
        conn = get_connection()
        cur = conn.cursor()
        target_int = 1 if is_disabled else 0
        cur.executemany(
            "UPDATE workshop_items SET is_disabled = ? WHERE published_file_id = ?",
            [(target_int, str(i)) for i in item_ids]
        )
        conn.commit()
        conn.close()

        return {
            "status": "ok",
            "affected": len(item_ids),
            "is_disabled": is_disabled,
            "mode_used": mode_used,
            "steam_running": steam_running,
            "cef_available": cef_ready
        }

    @staticmethod
    async def set_items_subscription(item_ids: List[str], is_subscribed: bool, mode: str = "hybrid") -> Dict[str, Any]:
        """
        High-level dispatcher for subscribing or unsubscribing items.
        Supports: 'mode_a', 'mode_b', 'hybrid'

        Important: Mode B (VDF file edit) only works reliably when Steam is closed.
        When Steam is running, only Mode A (CEF WebSocket RPC via SharedJSContext) is effective.
        """
        if not item_ids:
            return {"status": "ok", "affected": 0, "mode_used": mode}

        cef_ready = SteamService.is_cef_debugging_active()
        steam_running = SteamService.is_steam_running()

        use_mode_a = (mode == "mode_a") or (mode == "hybrid" and cef_ready)

        if mode == "mode_b" and steam_running and not cef_ready:
            print(f"WARNING: Mode B requested but Steam is running without CEF debug port. "
                  f"VDF changes will not take effect until Steam restarts.")

        mode_used = "mode_a" if use_mode_a else "mode_b"

        if use_mode_a:
            ids_json = json.dumps([str(x) for x in item_ids])
            sub_bool = "true" if is_subscribed else "false"
            js = f"""(() => {{
                const ids = {ids_json};
                for (const id of ids) {{
                    SteamClient.Apps.SubscribeWorkshopItem({APP_ID}, String(id), {sub_bool});
                }}
                return ids.length;
            }})();"""
            await SteamService.execute_cef_rpc(js)
        else:
            # Mode B: edit subscriptions.vdf directly (only effective when Steam is closed)
            SteamService.execute_vdf_subscription_toggle(item_ids, is_subscribed)

        # If unsubscribing: delete local folders to free disk space
        if not is_subscribed:
            steam_root = SteamService.find_steam_root()
            workshop_content = steam_root / "steamapps" / "workshop" / "content" / str(APP_ID)
            if workshop_content.exists():
                for item_id in item_ids:
                    item_folder = workshop_content / str(item_id)
                    if item_folder.exists() and item_folder.is_dir():
                        try:
                            shutil.rmtree(item_folder)
                        except Exception as e:
                            print(f"Failed to remove item folder {item_folder}: {e}")

        # Update local SQLite database (preserve existing is_disabled flag)
        conn = get_connection()
        cur = conn.cursor()
        unsub_int = 0 if is_subscribed else 1
        cur.executemany(
            "UPDATE workshop_items SET is_unsubscribed = ? WHERE published_file_id = ?",
            [(unsub_int, str(i)) for i in item_ids]
        )
        conn.commit()
        conn.close()

        return {
            "status": "ok",
            "affected": len(item_ids),
            "is_subscribed": is_subscribed,
            "mode_used": mode_used,
            "steam_running": steam_running,
            "cef_available": cef_ready
        }

