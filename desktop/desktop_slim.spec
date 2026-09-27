# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import os
import sys

# Paths
spec_dir = Path(SPECPATH) if 'SPECPATH' in globals() else Path(os.getcwd()) / 'desktop'
spec_root = spec_dir.resolve().parent
backend_dir = spec_root / 'backend'
static_dir = backend_dir / 'static'
icon_ico = spec_root / 'frontend' / 'src' / 'assets' / 'stormworks_icon.ico'
icon_png = spec_root / 'frontend' / 'src' / 'assets' / 'stormworks_icon.png'
icon_path = icon_ico if icon_ico.exists() else icon_png

datas = [
    (str(static_dir), 'static'),
]

hiddenimports = [
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'fastapi',
    'fastapi.staticfiles',
    'fastapi.middleware.cors',
    'starlette',
    'starlette.middleware',
    'starlette.middleware.cors',
    'starlette.staticfiles',
    'sqlite3',
    'httpx',
    'pydantic',
    'webview',
    'webview.platforms.edgechromium',
    'webview.platforms.mshtml',
    'webview.platforms.gtk',
    'webview.platforms.winforms',
]

# Exclude heavy bundled Chromium / Qt libraries for Slim version
excludes = [
    'PyQt6',
    'PyQt6.QtCore',
    'PyQt6.QtGui',
    'PyQt6.QtWidgets',
    'PyQt6.QtWebEngineCore',
    'PyQt6.QtWebEngineWidgets',
    'webview.platforms.qt',
    'qtpy',
    'tkinter',
]

a = Analysis(
    [str(spec_root / 'desktop' / 'run_desktop.py')],
    pathex=[str(spec_root), str(backend_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
)

# Filter out bulky Linux system desktop icon sets (keeps it truly slim)
a.datas = [d for d in a.datas if not (d[0].startswith('share/icons') or d[0].startswith('share/themes'))]

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='StormworksWorkshopManager-Slim',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(icon_path) if icon_path.exists() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='StormworksWorkshopManager-Slim',
)
