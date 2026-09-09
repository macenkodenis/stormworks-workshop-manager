# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import os
import sys

# Paths
spec_dir = Path(SPECPATH) if 'SPECPATH' in globals() else Path(os.getcwd()) / 'desktop'
spec_root = spec_dir.resolve().parent
backend_dir = spec_root / 'backend'
static_dir = backend_dir / 'static'
icon_path = spec_root / 'frontend' / 'src' / 'assets' / 'stormworks_icon.png'

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
    'webview.platforms.qt',
    'qtpy',
    'PyQt6',
    'PyQt6.QtCore',
    'PyQt6.QtGui',
    'PyQt6.QtWidgets',
    'PyQt6.QtWebEngineCore',
    'PyQt6.QtWebEngineWidgets',
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
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='StormworksWorkshopManager',
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
    name='StormworksWorkshopManager',
)
