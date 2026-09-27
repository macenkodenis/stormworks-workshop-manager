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

# Auto-switch to project venv if invoked with system python
PROJECT_ROOT = Path(__file__).resolve().parent.parent
VENV_DIR = PROJECT_ROOT / "backend" / "venv"
VENV_PYTHON = VENV_DIR / "bin" / "python"
if VENV_PYTHON.exists() and Path(sys.prefix).resolve() != VENV_DIR.resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), str(Path(__file__).resolve())] + sys.argv[1:])

# Add backend directory to sys.path so app modules can be resolved
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Import FastAPI application
from app.main import app
import uvicorn
import webview

WINDOW_STATE_FILE = PROJECT_ROOT / "data" / "window_state.json"

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

# Fix pywebview Qt bug on Linux and set application metadata/icon
try:
    import webview.platforms.qt as qt_platform
    from PyQt6.QtCore import QCoreApplication
    from PyQt6.QtGui import QGuiApplication, QIcon
    from PyQt6.QtWidgets import QApplication
    from PyQt6.QtWebEngineCore import QWebEnginePage

    # Set application identity for Wayland and X11 window managers
    QGuiApplication.setDesktopFileName("stormworks-workshop-manager")
    QCoreApplication.setApplicationName("stormworks-workshop-manager")
    QGuiApplication.setApplicationDisplayName("Stormworks Workshop Manager")

    def safe_onFeaturePermissionRequested(self, url, feature):
        try:
            self.setFeaturePermission(url, feature, QWebEnginePage.PermissionPolicy.PermissionGrantedByUser)
        except Exception as e:
            print(f"[!] Error in onFeaturePermissionRequested: {e}")

    qt_platform.BrowserView.WebPage.onFeaturePermissionRequested = safe_onFeaturePermissionRequested

    # Ensure application and window icon are always set to stormworks_icon, and persist window geometry/maximized state
    icon_file = PROJECT_ROOT / "frontend" / "src" / "assets" / "stormworks_icon.png"
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

        # Restore saved maximized state if present
        saved = load_window_state()
        if saved.get("maximized"):
            from PyQt6.QtCore import QTimer
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
except Exception as e:
    print(f"[!] Warning: Failed to configure Qt application properties: {e}")


def find_available_port(preferred=57309) -> int:
    """Find a free port on localhost, trying preferred port (57309) first."""
    # Check preferred port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', preferred))
            return preferred
        except OSError:
            pass

    # Try 57310 before dynamic port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', 57310))
            return 57310
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
    port = find_available_port(preferred=57309)
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

    class DesktopApi:
        def __init__(self):
            self.win = None

        def set_window(self, win):
            self.win = win

        def copy_to_clipboard(self, text):
            try:
                from PyQt6.QtWidgets import QApplication
                clipboard = QApplication.clipboard()
                if clipboard:
                    clipboard.setText(str(text))
                    return {"status": "ok"}
            except Exception as e:
                print(f"[!] Error in copy_to_clipboard: {e}")
            return {"status": "error"}

        def get_clipboard_text(self):
            try:
                from PyQt6.QtWidgets import QApplication
                clipboard = QApplication.clipboard()
                if clipboard:
                    return {"status": "ok", "text": clipboard.text() or ""}
            except Exception as e:
                print(f"[!] Error in get_clipboard_text: {e}")
            return {"status": "error", "text": ""}

        def save_file_dialog(self, filename, content):
            if not self.win:
                return {"status": "error", "detail": "Window not initialized"}
            try:
                res = self.win.create_file_dialog(
                    webview.SAVE_DIALOG,
                    save_filename=filename,
                    file_types=('Stormworks Tag Pack (*.swtags.json;*.json)', 'All files (*.*)')
                )
                if res:
                    path = res if isinstance(res, str) else res[0]
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    return {"status": "ok", "path": path}
            except Exception as e:
                print(f"[!] Error in save_file_dialog: {e}")
            return {"status": "cancelled"}

    desktop_api = DesktopApi()

    # Enable JavaScript DOM context menu events in PyQt WebEngine on Linux
    if sys.platform.startswith('linux'):
        try:
            from webview.platforms import qt
            from PyQt6 import QtCore

            _orig_init = qt.BrowserView.WebView.__init__
            def _custom_webview_init(self, *args, **kwargs):
                _orig_init(self, *args, **kwargs)
                self.setContextMenuPolicy(QtCore.Qt.ContextMenuPolicy.DefaultContextMenu)

            qt.BrowserView.WebView.__init__ = _custom_webview_init
            # Suppress standard browser context menu when not handled by JS
            qt.BrowserView.WebView.contextMenuEvent = lambda self, event: None
        except Exception as e:
            print(f"[!] Note on context menu setup: {e}")

    # 4. Create native desktop window with PyWebView
    saved_state = load_window_state()
    saved_maximized = bool(saved_state.get("maximized", False))
    saved_width = saved_state.get("width", 1440)
    saved_height = saved_state.get("height", 900)
    saved_x = saved_state.get("x")
    saved_y = saved_state.get("y")

    if not isinstance(saved_width, int) or saved_width < 800:
        saved_width = 1440
    if not isinstance(saved_height, int) or saved_height < 600:
        saved_height = 900

    create_window_kwargs = {
        "title": "Stormworks Workshop Manager",
        "url": f"http://127.0.0.1:{port}",
        "width": saved_width,
        "height": saved_height,
        "min_size": (1024, 700),
        "text_select": True,
        "zoomable": True,
        "background_color": "#121922",
        "maximized": saved_maximized,
        "js_api": desktop_api
    }
    if saved_x is not None and saved_y is not None:
        create_window_kwargs["x"] = saved_x
        create_window_kwargs["y"] = saved_y

    window = webview.create_window(**create_window_kwargs)
    desktop_api.set_window(window)

    # Select backend: on Linux use Qt (Chromium WebEngine); on Windows auto-select WebView2
    gui_engine = 'qt' if sys.platform.startswith('linux') else None

    # Persistent storage directory for cookies, localStorage and cache
    storage_dir = PROJECT_ROOT / "data" / "webview_storage"
    storage_dir.mkdir(parents=True, exist_ok=True)

    icon_path = PROJECT_ROOT / "frontend" / "src" / "assets" / "stormworks_icon.png"
    icon_param = str(icon_path) if icon_path.exists() else None

    try:
        webview.start(
            gui=gui_engine,
            debug=False,
            private_mode=False,
            storage_path=str(storage_dir),
            icon=icon_param
        )
    except KeyboardInterrupt:
        pass
    finally:
        print("\n[*] Desktop window closed. Shutting down embedded server...")
        server.should_exit = True
        server_thread.join(timeout=2.0)
        print("[✓] Clean exit completed.")

if __name__ == "__main__":
    main()
