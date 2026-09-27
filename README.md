# Stormworks Steam Workshop Manager

[![Release](https://img.shields.io/github/v/release/macenkodenis/stormworks-workshop-manager?include_prereleases&color=0284c7&style=flat-square)](https://github.com/macenkodenis/stormworks-workshop-manager/releases)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square)](https://www.gnu.org/licenses/gpl-3.0)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?style=flat-square&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square&logo=react)](https://react.dev)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows-brightgreen?style=flat-square)]()

A desktop and web utility for managing subscribed Steam Workshop creations for **Stormworks: Build and Rescue**. Supports offline metadata and image caching, hierarchical tagging with rule-based auto-classification, vehicle folder synchronization, and collection imports.

---

## Screenshots

### Workshop Catalog & Grid
![Main Interface](docs/screenshots/main_window.png)

### Tag Management & Batch Operations
![Tag Editor Sidebar](docs/screenshots/tag_editor_sidebar.png)

### Mod Action Planner & Batch Execution
![Action Plan](docs/screenshots/action_plan.png)

### Item Details & Gallery Viewer
![Item Detail Modal](docs/screenshots/item_detail.png)

### Collections & In-Game Vehicle Folders
| Workshop Collections | In-Game Craft Folders (`save.xml`) |
| :---: | :---: |
| ![Collections](docs/screenshots/collections.png) | ![Folders](docs/screenshots/folders.png) |

### Settings & Software Updates
![Settings Modal](docs/screenshots/settings.png)

---

## Features

* **Steam Discovery**: Automatically detects Steam installations, library folders, and subscribed items (`app_id: 573090`) across Linux (Native, SteamOS, Flatpak, Snap, Proton) and Windows.
* **Offline Metadata & Cache**: Stores vehicle descriptions, author details, preview thumbnails, and full screenshot galleries in a local SQLite database for offline browsing and filtering.
* **Vehicle Folder Management**: Synchronizes organizational folders directly into in-game vehicle directories (`save.xml`). Includes active game process detection to avoid write conflicts.
* **Hierarchical Tagging & Auto-Classifier**: User-defined tag tree with an automated rule engine that classifies vehicles based on keywords in titles, descriptions, and Workshop tags.
* **Collections & Presets**: Imports Steam Workshop Collections by URL or ID. Supports export and import of tag configurations (`.swtags` format).
* **Architecture**: FastAPI backend with a React 19 / Tailwind CSS interface. Deployable as a native desktop application or as a lightweight server accessible via web browser.
* **Built-in Update Checker**: Checks for the latest GitHub releases directly from the settings interface with changelog summaries.

---

## Editions & Distribution

The application is distributed in three editions for Linux and Windows:

| Edition | Linux Package | Windows Package | Archive Size | Runtime Details |
| :--- | :---: | :---: | :---: | :--- |
| **Standalone** | `...-Linux-Standalone-x86_64.tar.gz` | `...-Windows-Standalone-x64.zip` | ~220–240 MB | Bundled QtWebEngine (Chromium). Fully self-contained, no system runtime dependencies. |
| **Slim** | `...-Linux-Slim-x86_64.tar.gz` | `...-Windows-Slim-x64.zip` | ~20–38 MB | Uses system WebView (Edge WebView2 on Windows, WebKit2GTK 4.1 on Linux). |
| **Server** | `...-Server-Linux-x86_64.tar.gz` | `...-Server-Windows-x64.zip` | ~18–37 MB | Headless backend only; runs on port `57309` and opens in the system default browser. |

### Selection Notes

* **Windows**:
  * **Slim** is recommended for Windows 10/11: it utilizes the built-in Edge WebView2 runtime (Chromium), providing GPU acceleration with a ~21 MB archive size.
  * **Standalone** is intended for systems without WebView2.
  * **Server** allows running the service without a native application window.

* **Linux**:
  * **Standalone** provides full Chromium rendering out of the box, avoiding compositor or scroll latency issues present in WebKitGTK under certain Wayland/Mesa configurations.
  * **Server** runs the backend locally and displays the interface in your existing browser (Chromium/Firefox) with full hardware acceleration.
  * **Slim** requires `webkit2gtk-4.1`. If not installed, it falls back to browser mode automatically.

Binaries are available under [Releases](https://github.com/macenkodenis/stormworks-workshop-manager/releases).

---

## Supported Languages

The application interface is fully localized into 28 languages (covering all official Steam Workshop languages):

* English (`en`)
* Українська (`ua`)
* Deutsch (`de`)
* Français (`fr`)
* Italiano (`it`)
* Español (`es`)
* Español (Latinoamérica) (`latam`)
* Polski (`pl`)
* Português (`pt`)
* Português (Brasil) (`pt-br`)
* Čeština (`cs`)
* Dansk (`da`)
* Nederlands (`nl`)
* Suomi (`fi`)
* Ελληνικά (`el`)
* Magyar (`hu`)
* 日本語 (`ja`)
* 한국어 (`ko`)
* Norsk (`no`)
* Română (`ro`)
* 简体中文 (`zh-cn`)
* 繁體中文 (`zh-tw`)
* Svenska (`sv`)
* ไทย (`th`)
* Türkçe (`tr`)
* Български (`bg`)
* Tiếng Việt (`vi`)
* Bahasa Indonesia (`id`)

### Adding or Customizing Translations

Community contributions for additional languages or phrasing improvements are welcome. To add a new language:

1. Copy the reference translation file [`frontend/src/i18n/locales/en.json`](frontend/src/i18n/locales/en.json) to `frontend/src/i18n/locales/<language_code>.json`.
2. Translate the values under `"ui"` (interface labels) and optionally `"tags"` (default category names).
3. Add the language definition to `SUPPORTED_LANGUAGES` in [`frontend/src/i18n/languages.js`](frontend/src/i18n/languages.js):
   ```javascript
   { code: 'your_code', name: 'Native Language Name', steamLang: 'steam_language_identifier' }
   ```
4. Build the frontend (`cd frontend && npm run build`) and test the language selector in the settings menu.

---

## Running from Source

### Prerequisites
* Python 3.10+
* Node.js 18+ and npm

### 1. Clone the repository
```bash
git clone https://github.com/macenkodenis/stormworks-workshop-manager.git
cd stormworks-workshop-manager
```

### 2. Launching
* **Desktop Mode (Native Window)**:
  ```bash
  ./run_desktop.sh
  ```
* **Server Mode (Browser Mode at http://localhost:57309)**:
  ```bash
  ./run_server.sh
  ```
  *(Or with custom parameters: `python run_desktop.py --server --port 57309`)*

---

## Starter Tag Presets

A curated tag pack with vehicle categories (Aircraft, Maritime, Land, Microcontrollers, Missions) is included in [`presets/starter_tags_pack.swtags.json`](presets/starter_tags_pack.swtags.json).

To load it:
1. Open the application.
2. In the sidebar, select **Import Tags**.
3. Choose `presets/starter_tags_pack.swtags.json` and confirm.

---

## Building Binaries

To build binaries locally using PyInstaller:

```bash
# Build frontend first
cd frontend && npm install && npm run build && cd ..

# Then build individual editions:
pyinstaller desktop/desktop.spec        # Standalone
pyinstaller desktop/desktop_slim.spec   # Slim
pyinstaller desktop/server.spec         # Server
```

---

## Contributing

* Bug reports: [Open an issue](https://github.com/macenkodenis/stormworks-workshop-manager/issues/new?template=bug_report.md)
* Feature requests: [Open a request](https://github.com/macenkodenis/stormworks-workshop-manager/issues/new?template=feature_request.md)
* Code contributions: see [CONTRIBUTING.md](CONTRIBUTING.md)

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. See [LICENSE](LICENSE) for details.

The GPLv3 license ensures that this application and derivative works remain open-source and freely accessible to the Stormworks community, preventing closed-source redistribution.

---

Maintained by [SpaceCossaX](https://github.com/SpaceCossaX).
