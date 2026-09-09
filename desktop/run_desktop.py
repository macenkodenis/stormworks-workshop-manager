#!/usr/bin/env python3
"""
Stormworks Workshop Manager - Desktop Application Runner
Runs the app in an isolated native desktop window (PyWebView + QtWebEngine).
Completely decoupled from the standalone browser server version.
"""
import os
import sys
import socket
import threading
import time
import urllib.request
from pathlib import Path

# Add backend directory to sys.path so app modules can be resolved
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Import FastAPI application
from app.main import app
import uvicorn
import webview

def find_available_port(preferred=8080) -> int:
    """Find a free port on localhost, trying preferred port first."""
    # Check preferred port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', preferred))
            return preferred
        except OSError:
            pass

    # Pick dynamic free port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def wait_for_server(port: int, timeout: float = 10.0) -> bool:
    """Poll localhost until the API responds with 200 OK."""
    start_time = time.time()
    url = f"http://127.0.0.1:{port}/api/items"
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.15)
    return False

def main():
    print("=" * 60)
    print("  Stormworks Workshop Manager - Desktop Application")
    print("=" * 60)

    # 1. Allocate an isolated local port
    port = find_available_port(preferred=8080)
    print(f"[*] Starting embedded background server on 127.0.0.1:{port}...")

    # 2. Configure and run Uvicorn server in a background daemon thread
    server_config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        access_log=False
    )
    server = uvicorn.Server(config=server_config)

    server_thread = threading.Thread(target=server.run, daemon=True, name="DesktopUvicornServer")
    server_thread.start()

    # 3. Wait for server readiness
    print("[*] Waiting for backend readiness...")
    if not wait_for_server(port, timeout=8.0):
        print("[!] Error: Backend server did not respond in time.")
        server.should_exit = True
        sys.exit(1)

    print(f"[✓] Backend ready! Launching native desktop window...")

    # 4. Create native desktop window with PyWebView
    window = webview.create_window(
        title="Stormworks Workshop Manager",
        url=f"http://127.0.0.1:{port}",
        width=1440,
        height=900,
        min_size=(1024, 700),
        text_select=True,
        zoomable=True,
        background_color="#121922"
    )

    # Select backend: on Linux use Qt (Chromium WebEngine); on Windows auto-select WebView2
    gui_engine = 'qt' if sys.platform.startswith('linux') else None

    try:
        webview.start(gui=gui_engine, debug=False)
    except KeyboardInterrupt:
        pass
    finally:
        print("\n[*] Desktop window closed. Shutting down embedded server...")
        server.should_exit = True
        server_thread.join(timeout=2.0)
        print("[✓] Clean exit completed.")

if __name__ == "__main__":
    main()
