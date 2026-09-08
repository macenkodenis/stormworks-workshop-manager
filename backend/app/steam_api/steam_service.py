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

DEBUG_PORT = 8080

class SteamService:
    @staticmethod
    def find_steam_root() -> Path:
        candidates = [
            Path.home() / ".local" / "share" / "Steam",
            Path.home() / ".steam" / "steam",
            Path.home() / ".steam" / "root",
        ]
        for p in candidates:
            if p.exists() and (p / "steamapps").exists():
                return p
        return Path.home() / ".local" / "share" / "Steam"

    @staticmethod
    def find_subscriptions_vdf() -> Optional[Path]:
        steam_root = SteamService.find_steam_root()
        userdata = steam_root / "userdata"
        if not userdata.exists():
            return None
        matches = list(userdata.glob(f"*/ugc/{APP_ID}_subscriptions.vdf"))
        if matches:
            return matches[0]
        return None

    @staticmethod
    def is_steam_running() -> bool:
        try:
            res = subprocess.run(["pgrep", "-f", "ubuntu12_32/steam"], capture_output=True)
            return res.returncode == 0
        except Exception:
            return False

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
        waits for termination, and relaunches with '-cef-enable-debugging'.
        """
        # 1. Graceful shutdown
        try:
            subprocess.run(["steam", "-shutdown"], capture_output=True, timeout=5)
        except Exception as e:
            print(f"Error executing steam -shutdown: {e}")

        # Wait up to 10 seconds for steam process to fully exit
        for _ in range(20):
            await asyncio.sleep(0.5)
            if not SteamService.is_steam_running():
                break

        # If still running, terminate gracefully with pkill
        if SteamService.is_steam_running():
            try:
                subprocess.run(["pkill", "-TERM", "-f", "ubuntu12_32/steam"], capture_output=True)
                await asyncio.sleep(1.0)
            except Exception:
                pass

        # 2. Relaunch steam with -cef-enable-debugging
        try:
            subprocess.Popen(
                ["steam", "-cef-enable-debugging"],
                start_new_session=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception as e:
            return {"status": "error", "message": f"Failed to launch steam: {e}"}

        # 3. Wait for CEF port to become available
        ready = False
        for _ in range(25):
            await asyncio.sleep(0.6)
            if SteamService.is_cef_debugging_active(port):
                ready = True
                break

        return {
            "status": "ok" if ready else "warning",
            "is_running": SteamService.is_steam_running(),
            "cef_debugging": ready,
            "debug_port": port,
            "message": "Steam restarted with debugging enabled!" if ready else "Steam launched, waiting for CEF port..."
        }

    @staticmethod
    async def execute_cef_rpc(js_expression: str, port: int = DEBUG_PORT) -> Dict[str, Any]:
        """
        Connects to Steam CEF via WebSocket and executes an expression using Chrome DevTools Protocol.
        """
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{port}/json", headers={"User-Agent": "SW-Manager"})
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                targets = json.loads(resp.read().decode())

            target_ws_url = None
            for t in targets:
                if t.get("webSocketDebuggerUrl"):
                    # Prefer page or clientui target
                    url = t.get("url", "")
                    if "steamui" in url or "clientui" in url or t.get("type") == "page":
                        target_ws_url = t["webSocketDebuggerUrl"]
                        break
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
                        return msg.get("result", {}).get("result", {})

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
    async def set_items_subscription(item_ids: List[str], is_subscribed: bool, mode: str = "hybrid") -> Dict[str, Any]:
        """
        High-level dispatcher for subscribing or unsubscribing items.
        Supports: 'mode_a', 'mode_b', 'hybrid'
        """
        if not item_ids:
            return {"status": "ok", "affected": 0, "mode_used": mode}

        cef_ready = SteamService.is_cef_debugging_active()
        use_mode_a = (mode == "mode_a") or (mode == "hybrid" and cef_ready)
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

        # Update local SQLite database
        conn = get_connection()
        cur = conn.cursor()
        unsub_int = 0 if is_subscribed else 1
        # When unsubscribed, also mark as disabled
        disabled_int = 0 if is_subscribed else 1
        cur.executemany(
            "UPDATE workshop_items SET is_unsubscribed = ?, is_disabled = ? WHERE published_file_id = ?",
            [(unsub_int, disabled_int, str(i)) for i in item_ids]
        )
        conn.commit()
        conn.close()

        return {
            "status": "ok",
            "affected": len(item_ids),
            "is_subscribed": is_subscribed,
            "mode_used": mode_used
        }
