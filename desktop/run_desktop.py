#!/usr/bin/env python3
"""
Stormworks Workshop Manager - Application Runner
Supports:
  1. Desktop Mode (PyWebView with QtWebEngine, Edge WebView2, or WebKitGTK)
  2. Server Mode (--server / --headless) for lightweight browser-based usage.
"""
import argparse
import os
import sys
import socket
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

# Safe Unicode output handling for Windows terminals (e.g. cp1252 / cp437)
if sys.platform == "win32":
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr and hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Auto-switch to project venv if invoked with system python and running from source
PROJECT_ROOT = Path(__file__).resolve().parent.parent
VENV_DIR = PROJECT_ROOT / "backend" / "venv"
VENV_PYTHON = VENV_DIR / "bin" / "python"
if not getattr(sys, 'frozen', False) and VENV_PYTHON.exists() and Path(sys.prefix).resolve() != VENV_DIR.resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), str(Path(__file__).resolve())] + sys.argv[1:])

# Add backend directory to sys.path so app modules can be resolved
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Import FastAPI application
from app.main import app
from app.config import DATA_DIR
import uvicorn

WINDOW_STATE_FILE = DATA_DIR / "window_state.json"

def load_window_state():
    if WINDOW_STATE_FILE.exists():
        try:
            import json
            with open(WINDOW_STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_window_state(state):
    try:
        import json
        WINDOW_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(WINDOW_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"[!] Failed to save window state: {e}")

# Safe optional Qt initialization for Linux/PyQt environments
def setup_qt_environment():
    try:
        import webview.platforms.qt as qt_platform
        from PyQt6.QtCore import QCoreApplication, QTimer
        from PyQt6.QtGui import QGuiApplication, QIcon
        from PyQt6.QtWidgets import QApplication
        from PyQt6.QtWebEngineCore import QWebEnginePage

        QGuiApplication.setDesktopFileName("stormworks-workshop-manager")
        QCoreApplication.setApplicationName("stormworks-workshop-manager")
        QGuiApplication.setApplicationDisplayName("Stormworks Workshop Manager")

        def safe_onFeaturePermissionRequested(self, url, feature):
            try:
                self.setFeaturePermission(url, feature, QWebEnginePage.PermissionPolicy.PermissionGrantedByUser)
            except Exception as e:
                print(f"[!] Error in onFeaturePermissionRequested: {e}")

        qt_platform.BrowserView.WebPage.onFeaturePermissionRequested = safe_onFeaturePermissionRequested

        # Resolve icon
        icon_file = PROJECT_ROOT / "frontend" / "src" / "assets" / "stormworks_icon.png"
        if not icon_file.exists():
            icon_file = PROJECT_ROOT / "frontend" / "src" / "assets" / "stormworks_icon.ico"

        _orig_browser_init = qt_platform.BrowserView.__init__
        _orig_close_event = qt_platform.BrowserView.closeEvent

        def custom_browser_init(self, *args, **kwargs):
            _orig_browser_init(self, *args, **kwargs)
            app_inst = QApplication.instance()
            if icon_file.exists():
                app_icon = QIcon(str(icon_file))
                if app_inst:
                    app_inst.setWindowIcon(app_icon)
                self.setWindowIcon(app_icon)

            saved = load_window_state()
            if saved.get("maximized"):
                QTimer.singleShot(50, self.showMaximized)

        def custom_close_event(self, event):
            try:
                is_max = self.isMaximized()
                if is_max:
                    norm_geom = self.normalGeometry()
                    state = {
                        "maximized": True,
                        "width": norm_geom.width() if norm_geom.isValid() else self.width(),
                        "height": norm_geom.height() if norm_geom.isValid() else self.height(),
                        "x": norm_geom.x() if norm_geom.isValid() else self.x(),
                        "y": norm_geom.y() if norm_geom.isValid() else self.y()
                    }
                else:
                    state = {
                        "maximized": False,
                        "width": self.width(),
                        "height": self.height(),
                        "x": self.x(),
                        "y": self.y()
                    }
                save_window_state(state)
            except Exception as e:
                print(f"[!] Error saving window state on close: {e}")
            _orig_close_event(self, event)

        qt_platform.BrowserView.__init__ = custom_browser_init
        qt_platform.BrowserView.closeEvent = custom_close_event
        return True
    except Exception:
        return False

def find_available_port(preferred=57309, host="127.0.0.1") -> int:
    """Find a free port on localhost, trying preferred port (57309) first."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((host, preferred))
            return preferred
        except OSError:
            pass

    for candidate in range(57310, 57325):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind((host, candidate))
                return candidate
            except OSError:
                pass

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, 0))
        return s.getsockname()[1]

def wait_for_server(host: str, port: int, timeout: float = 10.0) -> bool:
    """Poll localhost until the API responds with 200 OK."""
    start_time = time.time()
    url = f"http://{host}:{port}/api/status"
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.15)
    return False

def run_server_mode(host: str, port: int, open_browser: bool = True):
    """Run in clean headless server mode without GUI dependencies."""
    print("=" * 65)
    print("  Stormworks Steam Workshop Manager - Server Edition")
    print("=" * 65)
    print(f"[*] Server address:  http://{host}:{port}")
    print(f"[*] API Status URL:  http://{host}:{port}/api/status")
    print(f"[*] Data directory:  {DATA_DIR}")
    print("-" * 65)
    print("Press Ctrl+C to stop the server.")
    print("=" * 65)

    if open_browser:
        def _open():
            time.sleep(1.0)
            webbrowser.open(f"http://{host}:{port}")
        threading.Thread(target=_open, daemon=True).start()

    server_config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=False
    )
    server = uvicorn.Server(config=server_config)
    try:
        server.run()
    except KeyboardInterrupt:
        print("\n[*] Stopping server...")
    print("[OK] Server stopped cleanly.")

def has_gtk_webkit() -> bool:
    try:
        import gi
        gi.require_version('WebKit2', '4.1')
        from gi.repository import WebKit2
        return True
    except Exception:
        try:
            import gi
            gi.require_version('WebKit2', '4.0')
            from gi.repository import WebKit2
            return True
        except Exception:
            return False

def run_gui_mode(host: str, port: int, requested_gui: str = "auto"):
    """Run native desktop GUI window with adaptive engine selection."""
    try:
        import webview
    except ImportError:
        print("[!] pywebview is not installed. Falling back to server mode in browser...")
        run_server_mode(host, port, open_browser=True)
        return

    # Check GUI engine
    has_qt = setup_qt_environment()
    gui_engine = None

    if requested_gui == "qt":
        gui_engine = "qt"
    elif requested_gui in ("edge", "edgechromium"):
        gui_engine = "edgechromium"
    elif requested_gui == "gtk":
        if not has_gtk_webkit():
            print("[!] Note: System WebKitGTK (webkit2gtk) was not detected on this system.")
            print("[*] Falling back to lightweight browser server mode...")
            run_server_mode(host, port, open_browser=True)
            return
        gui_engine = "gtk"
    elif requested_gui == "auto":
        if sys.platform.startswith("win"):
            # Windows: Edge WebView2 (native, GPU-accelerated, lightweight)
            gui_engine = "edgechromium"
        elif sys.platform.startswith("linux"):
            if has_qt:
                gui_engine = "qt"
            elif has_gtk_webkit():
                gui_engine = "gtk"
            else:
                print("[!] Note: Neither PyQt6 nor WebKitGTK found for native window.")
                print("[*] Automatically running in browser server mode...")
                run_server_mode(host, port, open_browser=True)
                return

    print("=" * 60)
    print("  Stormworks Workshop Manager - Desktop Application")
    print("=" * 60)
    print(f"[*] Engine: {gui_engine or 'auto'} | Port: {port}")

    import subprocess
    import atexit

    # Run the server in a separate process to avoid GIL deadlocks with WinForms/Cocoa GUI loops
    creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    if getattr(sys, 'frozen', False):
        server_cmd = [sys.executable, "--server", "--no-browser", "--port", str(port), "--host", host]
    else:
        server_cmd = [sys.executable, str(Path(__file__).resolve()), "--server", "--no-browser", "--port", str(port), "--host", host]

    server_proc = subprocess.Popen(
        server_cmd,
        creationflags=creationflags,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    def _terminate_server():
        if server_proc.poll() is None:
            try:
                server_proc.terminate()
                server_proc.wait(timeout=2.0)
            except Exception:
                try:
                    server_proc.kill()
                except Exception:
                    pass

    atexit.register(_terminate_server)

    print("[*] Waiting for backend readiness...")
    if not wait_for_server(host, port, timeout=15.0):
        print("[!] Error: Backend server did not respond in time.")
        _terminate_server()
        sys.exit(1)

    print("[OK] Backend ready! Opening application window...")

    saved_state = load_window_state()
    saved_width = saved_state.get("width", 1440)
    saved_height = saved_state.get("height", 900)
    if not isinstance(saved_width, int) or saved_width < 800:
        saved_width = 1440
    if not isinstance(saved_height, int) or saved_height < 600:
        saved_height = 900

    create_window_kwargs = {
        "title": "Stormworks Workshop Manager",
        "url": f"http://{host}:{port}",
        "width": saved_width,
        "height": saved_height,
        "min_size": (1024, 700),
        "text_select": True,
        "zoomable": True,
        "background_color": "#121922",
        "maximized": bool(saved_state.get("maximized", False))
    }
    if saved_state.get("x") is not None and saved_state.get("y") is not None:
        create_window_kwargs["x"] = saved_state["x"]
        create_window_kwargs["y"] = saved_state["y"]

    window = webview.create_window(**create_window_kwargs)

    storage_dir = DATA_DIR / "webview_storage"
    storage_dir.mkdir(parents=True, exist_ok=True)

    icon_path = PROJECT_ROOT / "frontend" / "src" / "assets" / "stormworks_icon.ico"
    if not icon_path.exists():
        icon_path = PROJECT_ROOT / "frontend" / "src" / "assets" / "stormworks_icon.png"

    try:
        webview.start(
            gui=gui_engine,
            debug=False,
            private_mode=False,
            storage_path=str(storage_dir),
            icon=str(icon_path) if icon_path.exists() else None
        )
    except Exception as e:
        print(f"[!] Native GUI launch failed ({e}). Falling back to browser server mode...")
        webbrowser.open(f"http://{host}:{port}")
        while server_proc.poll() is None:
            time.sleep(1.0)
    finally:
        print("\n[*] Desktop window closed. Shutting down embedded server...")
        _terminate_server()
        print("[OK] Clean exit completed.")

def main():
    import multiprocessing
    multiprocessing.freeze_support()

    parser = argparse.ArgumentParser(description="Stormworks Steam Workshop Manager")
    parser.add_argument("--server", "--headless", action="store_true", help="Run in clean server mode without desktop window")
    parser.add_argument("--gui", default="auto", choices=["auto", "qt", "edge", "gtk"], help="Specify desktop webview engine")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=57309, help="Preferred port (default: 57309)")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open browser in server mode")

    args = parser.parse_args()

    # Automatically default to server mode if binary or script is named server
    exe_name = Path(sys.executable).stem.lower() if getattr(sys, 'frozen', False) else Path(sys.argv[0]).stem.lower()
    is_server = args.server or ("server" in exe_name)

    port = find_available_port(preferred=args.port, host=args.host)

    if is_server:
        run_server_mode(host=args.host, port=port, open_browser=not args.no_browser)
    else:
        run_gui_mode(host=args.host, port=port, requested_gui=args.gui)

if __name__ == "__main__":
    main()
