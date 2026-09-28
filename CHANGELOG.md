# Changelog

All notable changes to **Stormworks Steam Workshop Manager** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.1-beta-updatable] - 2026-09-27

### Added
* **In-Place Smart Auto-Updater**:
  * Integrated GitHub Releases update mechanism that automatically detects when new versions or hotfixes are published.
  * Checks for updates silently at startup and provides an explicit "Check for Updates" button in Settings.
  * Formatted changelog release notes viewer (`UpdateModal`) displaying Markdown notes for all missed versions.
  * Download progress bar with real-time speed, transferred bytes, and percentages.
  * Safe in-place package extraction that updates application binaries without modifying or resetting `stormworks_workshop.db`, user tags, or application preferences.
  * Automatic platform and edition detection (Linux/Windows, Standalone/Slim/Server) to ensure exact binary asset matching.
* **Full Collections & In-Game Folders Backup**:
  * Added `collections` and `collection_items` tables to `export_full_backup` and `create_safety_backup`.
  * Added vehicle folder group snapshot from game's `save.xml` into full backups.
  * Added collection and folder counts to `preview_import`.
  * Full backup restoration now restores all user collections, mod assignments, and folder configuration without key conflicts.
* **Localization & Screenshots**:
  * Added complete translations for the updater and backup system across all 28 supported Steam languages.
  * Captured clean English interface screenshots across all key sections for documentation.
  * Added localized translation guide in `README.md`.

* **Catalog Virtualization & Performance**:
  * Added progressive batch card rendering in `App.jsx` (initial 60 items + 40 on scroll), dramatically boosting scrolling FPS and responsiveness across 1500+ items.
  * Added instant Steam CDN fallback for workshop thumbnails when local cache is still synchronizing on fresh installs.
* **Windows Stability & Steam Integration**:
  * Resolved Python GIL deadlocks between Uvicorn and pywebview on Windows by isolating the backend in a dedicated OS subprocess with `atexit` termination.
  * Added automatic Steam discovery on Windows via Registry (`winreg`) and standard install locations.
  * Discontinued Windows Standalone in favor of native, GPU-accelerated Edge WebView2 (Slim) and Server editions.
  * Standardized Steam CEF debug launch messages to international English.

* **UI Scaling & Viewport Independence (Full % Migration)**:
  * Completely eliminated all viewport-height (`vh`, `h-screen`, `min-h-screen`) dependencies across the frontend, replacing them with percentage-based bounds (`h-full`, `max-h-[calc(100%-2rem)]`).
  * Unified all 7 application modals (Settings, Action Plan, Classifier Rules, In-Place Updater, Import Collection, Import Tags, Mod Detail) with pinned headers and footers (`shrink-0`), full `Escape` key dismissal, safe backdrop click handling (`mouseDownTargetRef`), and fallback overlay scrolling.
  * Unified "New Tags Detected" into a single seamless scroll container above the mod actions list in Action Plan Modal.
  * Added dynamic virtual bottom spacer (`bottomSpacerHeight`) to mod catalog in `App.jsx`, ensuring a perfectly stable scrollbar slider across 1500+ items without DOM spikes on Windows.
  * Updated Settings Modal with balanced two-column layout, dedicated update card, and high-contrast scrollbars.

### Fixed
* **Windows 11 Unicode Crash (Issue #1)**:
  * Resolved `UnicodeEncodeError: 'charmap' codec can't encode character '\u2713'` occurring in Western European and US Windows locales (`cp1252`/`cp437`).
  * Added automatic `sys.stdout` and `sys.stderr` UTF-8 reconfiguration with `errors="replace"` on Windows platforms.
  * Sanitized all terminal console status logs in `desktop/run_desktop.py` to universal ASCII equivalents (`[OK]`, `-`).
* **UI Scaling & Modals**:
  * Resolved Chromium CSS zoom bug where scaling UI down to 75% left a 25–40% black empty void at the bottom, and scaling to 125% pushed modal buttons off-screen.
  * Fixed trap state in dialogs by implementing global `Escape` listeners and click-outside dismissal across all modals.
  * Fixed modal overflow when many new tags accumulate in Action Plan Modal by placing tags and items under a single unified scrollbar.
  * Fixed catalog scrollbar thumb jumping and resizing during scrolling through large workshop libraries.
* **UI Polish**:
  * Removed redundant duplicate "Apply Plan" button from the bottom of the right action planner sidebar.
  * Prevented quick sync button wrapping on smaller screens.
  * Fixed mouse drag click behavior on settings modal.
  * Fixed tag structure initialization state on fresh databases.
  * Removed hardcoded Ukrainian strings in action plan and settings components to ensure 100% localization consistency.

---

## [0.1.0-beta.1] - 2026-09-27

### Added
* Initial public beta release.
* Automated Steam Workshop item discovery and local SQLite metadata caching (`app_id: 573090`).
* Hierarchical tag management system with user custom tags and automated rule-based classifier.
* Steam Workshop Collection import by URL and ID.
* Vehicle folder synchronization directly to game's `save.xml` with active game process lock detection.
* Batch Action Planner for staging, reviewing, and applying tag and folder changes.
* Tag Pack export and import (`.swtags.json`) with interactive diff preview.
* 28 supported languages covering all official Steam Workshop languages.
* Three distribution editions for Linux and Windows: Standalone (bundled Chromium), Slim (system WebView2 / WebKitGTK), and Server (headless browser mode).
