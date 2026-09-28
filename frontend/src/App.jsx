import React, { useState, useEffect, useMemo, useRef, useCallback, useTransition } from 'react';
import { Header } from './components/Header';
import { TagsSidebar } from './components/TagsSidebar';
import { RightActionSidebar } from './components/RightActionSidebar';
import { ItemCard } from './components/ItemCard';
import { ItemRow } from './components/ItemRow';
import { ActionPlanModal } from './components/ActionPlanModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { UpdateModal } from './components/UpdateModal';
import { ImportTagsModal } from './components/ImportTagsModal';
import { CollectionsSidebar } from './components/CollectionsSidebar';
import { FoldersSidebar } from './components/FoldersSidebar';
import { ImportCollectionModal } from './components/ImportCollectionModal';
import { ClassifierRulesModal } from './components/ClassifierRulesModal';
import { ControlsHintOverlay } from './components/ControlsHintOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ContextMenu } from './components/ContextMenu';
import {
  Loader2,
  Power,
  PowerOff,
  Star,
  FolderPlus,
  Copy,
  ExternalLink,
  Maximize2,
  CheckSquare,
  Scissors,
  X
} from 'lucide-react';
import { buildTagPathMap, deduplicateTagTree } from './utils/tagUtils';
import { saveFileWithPrompt } from './utils/fileSaver';
import { copyToClipboard, readClipboardText } from './utils/clipboardUtils';
import { useI18n } from './i18n/I18nContext';

// Unified grid layout matrix for both view modes ('grid' and 'list') across all 3 card sizes (1 = S, 2 = M, 3 = L)
const GRID_LAYOUT_CONFIG = {
  // 1. Horizontal List view
  list: {
    1: { minWidth: '340px', gapClass: 'gap-2.5' }, // S: compact list row (~340px min)
    2: { minWidth: '480px', gapClass: 'gap-2.5' }, // M: standard list row (~480px min)
    3: { minWidth: '100%',   gapClass: 'gap-2.5' }, // L: 1 item per row (full width)
  },
  // 2. Tile Grid view
  // Option 1 (active): 6 cols S (~205px), 5 cols M (~250px), 4 cols L (~315px) at 1080p
  // Option 2 (backup reference): 1: '210px', 2: '280px', 3: '360px'
  grid: {
    1: { minWidth: '200px', gapClass: 'gap-3' },   // S: 6 cols at 1080p (~200–250px)
    2: { minWidth: '250px', gapClass: 'gap-3.5' }, // M: 5 cols at 1080p (~250–320px)
    3: { minWidth: '310px', gapClass: 'gap-4.5' }, // L: 4 cols at 1080p (~315–420px)
  }
};

export function App() {
  const { lang, t } = useI18n();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Non-blocking filter transitions for instant UI responsiveness
  const [, startFilterTransition] = useTransition();

  // Search and Sorting (non-blocking transition)
  const [searchQuery, setSearchQueryRaw] = useState('');
  const setSearchQuery = useCallback((val) => {
    startFilterTransition(() => {
      setSearchQueryRaw(val);
    });
  }, [startFilterTransition]);
  const [sortBy, setSortBy] = useState('updated');
  const [sortDir, setSortDir] = useState('desc');
  const pendingSortScrollTargetRef = useRef(null);

  // Card Size: 1 = S, 2 = M, 3 = L
  // Settings sync with SQLite backend
  const saveBackendSettings = useCallback((updatedPartial) => {
    fetch('/api/user-settings')
      .then(r => r.json())
      .then(data => {
        const current = data.settings || {};
        const merged = { ...current, ...updatedPartial };
        fetch('/api/user-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: merged })
        }).catch(err => console.error('Failed to save user settings:', err));
      })
      .catch(() => {
        fetch('/api/user-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: updatedPartial })
        }).catch(() => {});
      });
  }, []);

function normalizeCardSize(val) {
  if (val === 'S' || val === '1' || val === 1) return 1;
  if (val === 'M' || val === '2' || val === 2) return 2;
  if (val === 'L' || val === '3' || val === 3) return 3;
  const num = Number(val);
  return (num === 1 || num === 2 || num === 3) ? num : 2;
}

  const [cardSize, setCardSize] = useState(() => {
    const saved = localStorage.getItem('sw_card_size');
    return normalizeCardSize(saved);
  });

  const [, startLayoutTransition] = useTransition();

  const handleSetCardSize = (size) => {
    const norm = normalizeCardSize(size);
    startLayoutTransition(() => {
      setCardSize(norm);
    });
    localStorage.setItem('sw_card_size', String(norm));
    saveBackendSettings({ card_size: norm });
  };

  // View Mode: 'grid' (Tiles) or 'list' (Horizontal Rows)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('sw_view_mode') || 'grid';
  });

  const handleSetViewMode = (mode) => {
    startLayoutTransition(() => {
      setViewMode(mode);
    });
    localStorage.setItem('sw_view_mode', mode);
    saveBackendSettings({ view_mode: mode });
  };

  // Show/Hide Floating Control Hints Overlay
  const [showControlHints, setShowControlHints] = useState(() => {
    const saved = localStorage.getItem('sw_show_control_hints');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleShowControlHints = (val) => {
    setShowControlHints(val);
    localStorage.setItem('sw_show_control_hints', String(val));
    saveBackendSettings({ show_control_hints: val });
  };

  // Resizable Sidebars Widths
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('sw_left_width');
    return saved ? Number(saved) : 270;
  });

  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('sw_right_width');
    return saved ? Number(saved) : 290;
  });


  const isResizingLeftRef = useRef(false);
  const isResizingRightRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const leftSidebarContainerRef = useRef(null);
  const rightSidebarContainerRef = useRef(null);
  const headerLeftRef = useRef(null);
  const headerRightRef = useRef(null);
  const currentLeftWidthRef = useRef(leftWidth);
  const currentRightWidthRef = useRef(rightWidth);
  const mainRef = useRef(null);

  const handleLeftResizeStart = (e) => {
    e.preventDefault();
    isResizingLeftRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = leftWidth;
    currentLeftWidthRef.current = leftWidth;
    document.body.classList.add('is-resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleRightResizeStart = (e) => {
    e.preventDefault();
    isResizingRightRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightWidth;
    currentRightWidthRef.current = rightWidth;
    document.body.classList.add('is-resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingLeftRef.current && !isResizingRightRef.current) return;

      if (isResizingLeftRef.current) {
        const delta = e.clientX - startXRef.current;
        const newWidth = Math.min(Math.max(startWidthRef.current + delta, 200), 500);
        currentLeftWidthRef.current = newWidth;
        if (leftSidebarContainerRef.current) {
          leftSidebarContainerRef.current.style.width = `${newWidth}px`;
        }
        if (headerLeftRef.current) {
          headerLeftRef.current.style.width = `${newWidth}px`;
        }
      } else if (isResizingRightRef.current) {
        const delta = startXRef.current - e.clientX;
        const newWidth = Math.min(Math.max(startWidthRef.current + delta, 220), 500);
        currentRightWidthRef.current = newWidth;
        if (rightSidebarContainerRef.current) {
          rightSidebarContainerRef.current.style.width = `${newWidth}px`;
        }
        if (headerRightRef.current) {
          headerRightRef.current.style.width = `${newWidth}px`;
        }
      }
    };

    const handleMouseUp = () => {
      if (isResizingLeftRef.current) {
        isResizingLeftRef.current = false;
        document.body.classList.remove('is-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const finalWidth = currentLeftWidthRef.current;
        setLeftWidth(finalWidth);
        localStorage.setItem('sw_left_width', String(finalWidth));
        saveBackendSettings({ left_width: finalWidth });
        window.dispatchEvent(new Event('resize'));
      } else if (isResizingRightRef.current) {
        isResizingRightRef.current = false;
        document.body.classList.remove('is-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const finalWidth = currentRightWidthRef.current;
        setRightWidth(finalWidth);
        localStorage.setItem('sw_right_width', String(finalWidth));
        saveBackendSettings({ right_width: finalWidth });
        window.dispatchEvent(new Event('resize'));
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [leftWidth, rightWidth]);

  // Initialize saved zoom
  useEffect(() => {
    const savedZoom = localStorage.getItem('sw_ui_zoom');
    if (savedZoom) {
      document.documentElement.style.zoom = `${savedZoom}%`;
    }
  }, []);

  // Tag Filtering (Steam tags)
  const [selectedTags, setSelectedTags] = useState(new Set());

  // System Filters: { status: 'subscribed' | 'unsubscribed' | null, sort: 'sorted' | 'unsorted' | null, connection: 'enabled' | 'disabled' | null }
  // За замовчуванням увімкнено фільтр тільки по підписаним модам ('subscribed')
  const [systemFilter, setSystemFilter] = useState({ status: 'subscribed', sort: null, connection: null });

  // Custom User Tags: Set of selected user tag names
  const [selectedUserTags, setSelectedUserTags] = useState(new Set());
  // Persistent pool of custom user tags created by user (even with 0 items)
  const [extraUserTags, setExtraUserTags] = useState(new Set());
  // Excluded / Hidden tags (hide mods containing these tags)
  const [excludedTags, setExcludedTags] = useState(new Set());

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [anchorId, setAnchorId] = useState(null);
  const anchorIdRef = useRef(null);
  const [modContextMenu, setModContextMenu] = useState(null); // { x, y, item, forceSingle }
  const [inputContextMenu, setInputContextMenu] = useState(null);

  // Universal context menu for all text inputs and textareas across the entire app
  useEffect(() => {
    const handleGlobalContextMenu = (e) => {
      const target = e.target?.closest ? e.target.closest('input, textarea') : null;
      if (!target) return;

      if (target.tagName === 'INPUT' && ['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(target.type)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const value = target.value || '';
      const hasSelection = end > start;
      const selectedText = hasSelection ? value.slice(start, end) : '';
      const hasValue = value.length > 0;
      const isReadOnly = target.readOnly || target.disabled;

      const triggerInputEvents = (newValue) => {
        const proto = target.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) {
          setter.call(target, newValue);
        } else {
          target.value = newValue;
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const items = [
        {
          key: 'input-paste',
          label: t('context.paste'),
          icon: Copy,
          shortcut: 'Ctrl+V',
          disabled: isReadOnly,
          onClick: async () => {
            const clipText = await readClipboardText();
            if (!clipText) return;

            const before = value.slice(0, start);
            const after = value.slice(end);
            const newValue = before + clipText + after;

            triggerInputEvents(newValue);

            setTimeout(() => {
              target.focus();
              const newCursor = start + clipText.length;
              try {
                target.setSelectionRange(newCursor, newCursor);
              } catch (_) {}
            }, 10);
          }
        },
        {
          key: 'input-copy',
          label: t('context.copy'),
          icon: Copy,
          shortcut: 'Ctrl+C',
          disabled: !hasSelection,
          onClick: () => {
            if (selectedText) {
              copyToClipboard(selectedText);
            }
          }
        },
        {
          key: 'input-cut',
          label: t('context.cut'),
          icon: Scissors,
          shortcut: 'Ctrl+X',
          disabled: !hasSelection || isReadOnly,
          onClick: () => {
            if (selectedText) {
              copyToClipboard(selectedText);
              const before = value.slice(0, start);
              const after = value.slice(end);
              const newValue = before + after;

              triggerInputEvents(newValue);

              setTimeout(() => {
                target.focus();
                try {
                  target.setSelectionRange(start, start);
                } catch (_) {}
              }, 10);
            }
          }
        },
        { divider: true },
        {
          key: 'input-select-all',
          label: t('context.selectAll'),
          icon: CheckSquare,
          shortcut: 'Ctrl+A',
          disabled: !hasValue,
          onClick: () => {
            target.focus();
            try {
              target.select();
            } catch (_) {}
          }
        },
        {
          key: 'input-clear',
          label: t('context.clearField'),
          icon: X,
          disabled: !hasValue || isReadOnly,
          danger: true,
          onClick: () => {
            triggerInputEvents('');
            setTimeout(() => target.focus(), 10);
          }
        }
      ];

      setInputContextMenu({
        x: e.clientX,
        y: e.clientY,
        items
      });
    };

    document.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
  }, [t]);

  // Modal states
  const [pendingActions, setPendingActions] = useState({}); // { [itemId]: 'disable' | 'enable' | 'unsubscribe' | 'subscribe' }
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isExecutingPlan, setIsExecutingPlan] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Global shortcut (Ctrl+, or F2) to open/close Settings
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      const inInput = e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && (e.key === ',' || e.key === 'б' || e.key === 'Б')) {
        e.preventDefault();
        setIsSettingsOpen(prev => !prev);
      } else if (e.key === 'F2' && !inInput) {
        e.preventDefault();
        setIsSettingsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);
  const [isClassifierRulesOpen, setIsClassifierRulesOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [updateModalData, setUpdateModalData] = useState(null);

  const handleOpenDetail = useCallback((it) => {
    setDetailItem(it);
  }, []);

  // Collections State & Sidebar Modes (Fully decoupled: left and right are independent)
  const [leftSidebarMode, setLeftSidebarMode] = useState(() => localStorage.getItem('sw_left_sidebar_mode') || localStorage.getItem('sw_sidebar_mode') || 'tags');
  const [rightSidebarMode, setRightSidebarMode] = useState(() => localStorage.getItem('sw_right_sidebar_mode') || localStorage.getItem('sw_sidebar_mode') || 'tags');
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [isImportCollectionModalOpen, setIsImportCollectionModalOpen] = useState(false);

  const handleLeftModeChange = (mode) => {
    setLeftSidebarMode(mode);
    localStorage.setItem('sw_left_sidebar_mode', mode);
    saveBackendSettings({ left_sidebar_mode: mode, sidebar_mode: mode });
  };

  const handleRightModeChange = (mode) => {
    setRightSidebarMode(mode);
    localStorage.setItem('sw_right_sidebar_mode', mode);
    saveBackendSettings({ right_sidebar_mode: mode });
  };

  // In-Game Folders State (Stormworks save.xml)
  const [inGameFoldersData, setInGameFoldersData] = useState({
    folders: [],
    item_to_folder: {},
    save_path: null,
    exists: false,
    game_running: false
  });
  const [selectedInGameFolder, setSelectedInGameFolder] = useState(null);
  const [stormworksSavePath, setStormworksSavePath] = useState('');
  const [foldersMode, setFoldersMode] = useState(() => localStorage.getItem('sw_folders_mode') || 'single');

  const fetchInGameFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/ingame-folders');
      const data = await res.json();
      setInGameFoldersData(data);
    } catch (e) {
      console.error('Failed to fetch in-game folders:', e);
    }
  }, []);

  const handleCreateInGameFolder = async (name) => {
    const res = await fetch('/api/ingame-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create folder');
    }
    const data = await res.json();
    setInGameFoldersData(data);
  };

  const handleRenameInGameFolder = async (oldName, newName) => {
    const res = await fetch(`/api/ingame-folders/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: newName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to rename folder');
    }
    const data = await res.json();
    setInGameFoldersData(data);
    if (selectedInGameFolder === oldName) {
      setSelectedInGameFolder(newName);
    }
  };

  const handleDeleteInGameFolder = async (folderName) => {
    const res = await fetch(`/api/ingame-folders/${encodeURIComponent(folderName)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to delete folder');
    }
    const data = await res.json();
    setInGameFoldersData(data);
    if (selectedInGameFolder === folderName) {
      setSelectedInGameFolder(null);
    }
  };

  const handleAssignInGameFolder = async (folderName, itemIds, action = 'set') => {
    const res = await fetch('/api/ingame-folders/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder_name: folderName,
        item_ids: itemIds,
        mode: foldersMode,
        action: action
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to assign items to folder');
    }
    const data = await res.json();
    setInGameFoldersData(data);
  };

  const handleRemoveFromInGameFolder = async (folderName, itemIds) => {
    await handleAssignInGameFolder(folderName, itemIds, 'remove');
  };

  const handleSetFoldersMode = (mode) => {
    setFoldersMode(mode);
    localStorage.setItem('sw_folders_mode', mode);
    saveBackendSettings({ ingame_folders_mode: mode });
  };

  const handleSaveStormworksSavePath = (newPath) => {
    setStormworksSavePath(newPath);
    saveBackendSettings({ stormworks_save_xml_path: newPath });
    setTimeout(() => {
      fetchInGameFolders();
    }, 200);
  };

  // Steam Integration State
  const [steamMode, setSteamMode] = useState(() => localStorage.getItem('sw_steam_mode') || 'hybrid');
  const [steamStatus, setSteamStatus] = useState(null);
  const [isRestartingSteam, setIsRestartingSteam] = useState(false);

  const handleSetSteamMode = (mode) => {
    setSteamMode(mode);
    localStorage.setItem('sw_steam_mode', mode);
    saveBackendSettings({ steam_mode: mode });
  };

  const fetchSteamStatus = async () => {
    try {
      const res = await fetch('/api/steam/status').then(r => r.json());
      setSteamStatus(res);
    } catch (err) {
      console.error('Failed to fetch steam status:', err);
    }
  };

  const handleRestartSteam = async () => {
    setIsRestartingSteam(true);
    try {
      const res = await fetch('/api/steam/restart', { method: 'POST' }).then(r => r.json());
      if (res.status === 'ok') {
        setTimeout(fetchSteamStatus, 2000);
        setTimeout(fetchSteamStatus, 5000);
      }
    } catch (err) {
      console.error('Failed to restart steam:', err);
    } finally {
      setIsRestartingSteam(false);
    }
  };

  useEffect(() => {
    fetchSteamStatus();
    const interval = setInterval(fetchSteamStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Initial load
  const loadData = async () => {
    try {
      const [statusRes, itemsRes, customTagsRes, userSettingsRes, collectionsRes, ingameRes] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch(`/api/items?sort_by=updated&sort_dir=desc&lang=${lang}`).then(r => r.json()),
        fetch('/api/custom-user-tags').then(r => r.json()).catch(() => ({ tags: [] })),
        fetch('/api/user-settings').then(r => r.json()).catch(() => ({ settings: {} })),
        fetch('/api/collections').then(r => r.json()).catch(() => ({ collections: [] })),
        fetch('/api/ingame-folders').then(r => r.json()).catch(() => ({ folders: [], item_to_folder: {}, exists: false, game_running: false }))
      ]);
      setStatus(statusRes);
      setItems(itemsRes.items || []);
      if (ingameRes) {
        setInGameFoldersData(ingameRes);
      }
      if (collectionsRes && Array.isArray(collectionsRes.collections)) {
        setCollections(collectionsRes.collections);
      }
      if (customTagsRes && Array.isArray(customTagsRes.tags)) {
        setExtraUserTags(new Set(customTagsRes.tags));
      }
      if (userSettingsRes && userSettingsRes.settings) {
        const s = userSettingsRes.settings;
        if (s.left_sidebar_mode !== undefined && (s.left_sidebar_mode === 'tags' || s.left_sidebar_mode === 'collections' || s.left_sidebar_mode === 'folders')) {
          setLeftSidebarMode(s.left_sidebar_mode);
          localStorage.setItem('sw_left_sidebar_mode', s.left_sidebar_mode);
        } else if (s.sidebar_mode !== undefined && (s.sidebar_mode === 'tags' || s.sidebar_mode === 'collections' || s.sidebar_mode === 'folders')) {
          setLeftSidebarMode(s.sidebar_mode);
        }
        if (s.right_sidebar_mode !== undefined && (s.right_sidebar_mode === 'tags' || s.right_sidebar_mode === 'collections' || s.right_sidebar_mode === 'folders')) {
          setRightSidebarMode(s.right_sidebar_mode);
          localStorage.setItem('sw_right_sidebar_mode', s.right_sidebar_mode);
        } else if (s.sidebar_mode !== undefined && (s.sidebar_mode === 'tags' || s.sidebar_mode === 'collections' || s.sidebar_mode === 'folders')) {
          setRightSidebarMode(s.sidebar_mode);
        }
        if (s.stormworks_save_xml_path !== undefined) {
          setStormworksSavePath(s.stormworks_save_xml_path);
        }
        if (s.ingame_folders_mode !== undefined) {
          setFoldersMode(s.ingame_folders_mode);
          localStorage.setItem('sw_folders_mode', s.ingame_folders_mode);
        }
        if (s.card_size !== undefined) {
          const cs = normalizeCardSize(s.card_size);
          setCardSize(cs);
          localStorage.setItem('sw_card_size', String(cs));
        }
        if (s.view_mode !== undefined) {
          setViewMode(s.view_mode);
          localStorage.setItem('sw_view_mode', s.view_mode);
        }
        if (s.show_control_hints !== undefined) {
          const val = Boolean(s.show_control_hints);
          setShowControlHints(val);
          localStorage.setItem('sw_show_control_hints', String(val));
        }
        if (s.left_width !== undefined) {
          const lw = Math.min(Math.max(Number(s.left_width), 200), 500);
          setLeftWidth(lw);
          currentLeftWidthRef.current = lw;
          localStorage.setItem('sw_left_width', String(lw));
          if (leftSidebarContainerRef.current) leftSidebarContainerRef.current.style.width = `${lw}px`;
          if (headerLeftRef.current) headerLeftRef.current.style.width = `${lw}px`;
        }
        if (s.right_width !== undefined) {
          const rw = Math.min(Math.max(Number(s.right_width), 220), 500);
          setRightWidth(rw);
          currentRightWidthRef.current = rw;
          localStorage.setItem('sw_right_width', String(rw));
          if (rightSidebarContainerRef.current) rightSidebarContainerRef.current.style.width = `${rw}px`;
          if (headerRightRef.current) headerRightRef.current.style.width = `${rw}px`;
        }
        if (s.ui_zoom !== undefined) {
          localStorage.setItem('sw_ui_zoom', String(s.ui_zoom));
          document.documentElement.style.zoom = `${s.ui_zoom}%`;
        }
        if (s.steam_mode !== undefined) {
          setSteamMode(s.steam_mode);
          localStorage.setItem('sw_steam_mode', s.steam_mode);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Silent background update check on startup
    const checkUpdatesOnStart = async () => {
      try {
        const lastCheck = localStorage.getItem('sw_last_update_check');
        const now = Date.now();
        // Check at most once every 6 hours
        if (lastCheck && now - Number(lastCheck) < 6 * 3600 * 1000) {
          return;
        }
        localStorage.setItem('sw_last_update_check', String(now));
        const res = await fetch('/api/updater/check').then(r => r.json());
        if (res && res.has_update) {
          setUpdateModalData(res);
        }
      } catch (_) {}
    };

    const timer = setTimeout(checkUpdatesOnStart, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Collections Handlers
  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      if (data && Array.isArray(data.collections)) {
        setCollections(data.collections);
      }
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    }
  }, []);

  const handleCreateCollection = async (name, itemIds = null) => {
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, item_ids: itemIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || t('collections.createError'));
    await fetchCollections();
    if (itemIds && itemIds.length > 0) {
      setItems(prev => prev.map(it => {
        if (itemIds.includes(it.published_file_id)) {
          const current = it.collection_ids || [];
          if (!current.includes(data.id)) {
            return { ...it, collection_ids: [...current, data.id] };
          }
        }
        return it;
      }));
    }
    return data;
  };

  const handleUpdateCollection = async (colId, updates) => {
    const res = await fetch(`/api/collections/${colId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || t('collections.updateError'));
    }
    await fetchCollections();
  };

  const handleDeleteCollection = async (colId) => {
    const res = await fetch(`/api/collections/${colId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || t('collections.deleteError'));
    }
    if (selectedCollectionId === colId) {
      setSelectedCollectionId(null);
    }
    await fetchCollections();
    setItems(prev => prev.map(it => {
      if (it.collection_ids && it.collection_ids.includes(colId)) {
        return { ...it, collection_ids: it.collection_ids.filter(id => id !== colId) };
      }
      return it;
    }));
  };

  const handleBulkAddToCollection = async (colId, customItemIds = null) => {
    const itemIds = customItemIds || Array.from(selectedIds);
    if (!itemIds.length) return;
    const res = await fetch(`/api/collections/${colId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: itemIds, action: 'add' })
    });
    if (res.ok) {
      await fetchCollections();
      const idSet = new Set(itemIds);
      setItems(prev => prev.map(it => {
        if (idSet.has(it.published_file_id)) {
          const current = it.collection_ids || [];
          if (!current.includes(colId)) {
            return { ...it, collection_ids: [...current, colId] };
          }
        }
        return it;
      }));
    }
  };

  const handleBulkRemoveFromCollection = async (colId) => {
    if (selectedIds.size === 0) return;
    const itemIds = Array.from(selectedIds);
    const res = await fetch(`/api/collections/${colId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: itemIds, action: 'remove' })
    });
    if (res.ok) {
      await fetchCollections();
      setItems(prev => prev.map(it => {
        if (selectedIds.has(it.published_file_id) && it.collection_ids) {
          return { ...it, collection_ids: it.collection_ids.filter(id => id !== colId) };
        }
        return it;
      }));
    }
  };

  const handleCreateCollectionFromSelection = async () => {
    if (selectedIds.size === 0) return;
    const defaultName = t('bulk.colDefaultName', { count: selectedIds.size });
    const name = window.prompt(t('bulk.colPromptName'), defaultName);
    if (!name || !name.trim()) return;
    await handleCreateCollection(name.trim(), Array.from(selectedIds));
  };

  const handleCreateInGameFolderFromSelection = async () => {
    if (selectedIds.size === 0) return;
    const defaultName = t('folders.folderDefaultName', { count: selectedIds.size });
    const name = window.prompt(t('folders.folderPromptName'), defaultName);
    if (!name || !name.trim()) return;
    await handleCreateInGameFolder(name.trim());
    await handleAssignInGameFolder(name.trim(), Array.from(selectedIds), foldersMode === 'multi' ? 'add' : 'set');
  };

  const handleItemAddToCollection = async (colId, itemId) => {
    const res = await fetch(`/api/collections/${colId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: [itemId], action: 'add' })
    });
    if (res.ok) {
      await fetchCollections();
      setItems(prev => prev.map(it => {
        if (it.published_file_id === itemId) {
          const current = it.collection_ids || [];
          if (!current.includes(colId)) {
            return { ...it, collection_ids: [...current, colId] };
          }
        }
        return it;
      }));
      if (detailItem && detailItem.published_file_id === itemId) {
        setDetailItem(prev => {
          if (!prev) return prev;
          const current = prev.collection_ids || [];
          if (!current.includes(colId)) {
            return { ...prev, collection_ids: [...current, colId] };
          }
          return prev;
        });
      }
    }
  };

  const handleItemRemoveFromCollection = async (colId, itemId) => {
    const res = await fetch(`/api/collections/${colId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: [itemId], action: 'remove' })
    });
    if (res.ok) {
      await fetchCollections();
      setItems(prev => prev.map(it => {
        if (it.published_file_id === itemId && it.collection_ids) {
          return { ...it, collection_ids: it.collection_ids.filter(id => id !== colId) };
        }
        return it;
      }));
      if (detailItem && detailItem.published_file_id === itemId && detailItem.collection_ids) {
        setDetailItem(prev => prev ? ({
          ...prev,
          collection_ids: prev.collection_ids.filter(id => id !== colId)
        }) : prev);
      }
    }
  };

  const handleCreateCollectionWithItem = async (name, itemId) => {
    const col = await handleCreateCollection(name, [itemId]);
    if (col && col.id && itemId) {
      if (detailItem && detailItem.published_file_id === itemId) {
        setDetailItem(prev => {
          if (!prev) return prev;
          const current = prev.collection_ids || [];
          if (!current.includes(col.id)) {
            return { ...prev, collection_ids: [...current, col.id] };
          }
          return prev;
        });
      }
    }
    return col;
  };

  const handleApplyPreset = async (colId) => {
    try {
      const res = await fetch(`/api/collections/${colId}/apply-preset?mode=${steamMode}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t('collections.presetError'));

      const targetCol = collections.find(c => c.id === colId);
      const colItemIds = new Set(targetCol ? targetCol.item_ids : []);

      setItems(prev => prev.map(it => {
        if (it.is_unsubscribed) return it;
        if (colItemIds.has(it.published_file_id)) {
          return { ...it, is_disabled: false };
        } else {
          return { ...it, is_disabled: true };
        }
      }));
      await fetchCollections();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleAllItemsInCollection = async (colId, enable) => {
    const targetCol = collections.find(c => c.id === colId);
    if (!targetCol || !targetCol.item_ids || targetCol.item_ids.length === 0) return;

    const subscribedItemIds = items
      .filter(it => targetCol.item_ids.includes(it.published_file_id) && !it.is_unsubscribed)
      .map(it => it.published_file_id);

    if (subscribedItemIds.length === 0) return;

    await fetch('/api/items/bulk-set-disabled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: subscribedItemIds, is_disabled: !enable, mode: steamMode })
    });

    const targetSet = new Set(subscribedItemIds);
    setItems(prev => prev.map(it => {
      if (targetSet.has(it.published_file_id)) {
        return { ...it, is_disabled: !enable };
      }
      return it;
    }));
    await fetchCollections();
  };

  const handleSubscribeMissingInCollection = async (colId) => {
    const targetCol = collections.find(c => c.id === colId);
    if (!targetCol || !targetCol.item_ids) return;

    const missingIds = items
      .filter(it => targetCol.item_ids.includes(it.published_file_id) && it.is_unsubscribed)
      .map(it => it.published_file_id);

    if (missingIds.length === 0) return;

    await fetch('/api/items/bulk-set-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: missingIds, is_unsubscribed: false, mode: steamMode })
    });

    const subSet = new Set(missingIds);
    setItems(prev => prev.map(it => {
      if (subSet.has(it.published_file_id)) {
        return { ...it, is_unsubscribed: false, is_disabled: false };
      }
      return it;
    }));
    await fetchCollections();
  };

  // Trigger quick incremental sync (with optional language specification)
  const handleScan = async (syncLang = null) => {
    const targetLang = (typeof syncLang === 'string' && syncLang) ? syncLang : (typeof lang === 'string' ? lang : 'en');
    setIsScanning(true);
    try {
      await fetch(`/api/scan?full=false&lang=${targetLang}`, { method: 'POST' });
      const poll = setInterval(async () => {
        const s = await fetch('/api/status').then(r => r.json());
        setStatus(s);
        if (!s.scan_state?.is_scanning) {
          clearInterval(poll);
          setIsScanning(false);
          const itemsRes = await fetch(`/api/items?sort_by=${sortBy}&sort_dir=${sortDir}&lang=${targetLang}`).then(r => r.json());
          setItems(itemsRes.items || []);
        }
      }, 1000);
    } catch (err) {
      console.error('Scan trigger failed:', err);
      setIsScanning(false);
    }
  };
  const handleRefresh = handleScan;

  // Handle Full Library Sync (re-fetches Steam details for all items with active language)
  const handleFullSync = async (syncLang = null) => {
    const targetLang = (typeof syncLang === 'string' && syncLang) ? syncLang : (typeof lang === 'string' ? lang : 'en');
    setIsScanning(true);
    try {
      await fetch(`/api/scan?full=true&lang=${targetLang}`, { method: 'POST' });
      const poll = setInterval(async () => {
        const s = await fetch('/api/status').then(r => r.json());
        setStatus(s);
        if (!s.scan_state?.is_scanning) {
          clearInterval(poll);
          setIsScanning(false);
          const itemsRes = await fetch(`/api/items?sort_by=${sortBy}&sort_dir=${sortDir}&lang=${targetLang}`).then(r => r.json());
          setItems(itemsRes.items || []);
        }
      }, 1500);
    } catch (err) {
      console.error('Full scan trigger failed:', err);
      setIsScanning(false);
    }
  };

  // Re-fetch items when backend sorting or interface language changes
  const isFirstSortMountRef = useRef(true);
  useEffect(() => {
    if (isFirstSortMountRef.current) {
      isFirstSortMountRef.current = false;
      return;
    }
    fetch(`/api/items?sort_by=${sortBy}&sort_dir=${sortDir}&lang=${lang}`)
      .then(r => r.json())
      .then(res => setItems(res.items || []))
      .catch(console.error);
  }, [sortBy, sortDir, lang]);

  // Tag Structure state for hierarchical folders
  const [tagStructure, setTagStructure] = useState([]);

  useEffect(() => {
    fetch('/api/tag-structure')
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.structure)) {
          setTagStructure(deduplicateTagTree(data.structure));
        }
      })
      .catch(err => console.warn('Failed to load tag structure in App:', err));
  }, []);

  const { tagPathMap, tagFullPathMap, reverseTagPathMap } = useMemo(() => {
    return buildTagPathMap(tagStructure);
  }, [tagStructure]);

  // Precompute active Steam tags, sets and search index on each item once per items/tagMap update
  const enrichedItems = useMemo(() => {
    return items.map(it => {
      const deactivatedLower = new Set(
        (Array.isArray(it.deactivated_steam_tags) ? it.deactivated_steam_tags : []).map(t => String(t).trim().toLowerCase())
      );
      const activeSteamTags = (it.tags || []).filter(
        t => t && !deactivatedLower.has(String(t).trim().toLowerCase())
      );
      const activeSteamTagSet = new Set(activeSteamTags);
      const userTagSet = new Set(it.user_tags || []);

      // Precomputed search index (strictly excludes description for high performance)
      const searchParts = [
        it.title || '',
        it.published_file_id || '',
        it.creator || '',
        it.creator_name || '',
        ...activeSteamTags,
        ...(it.user_tags || [])
      ];
      if (tagPathMap) {
        activeSteamTags.forEach(t => {
          const sp = tagPathMap.get(`steam:${t}`) || tagPathMap.get(t);
          const fp = tagFullPathMap ? (tagFullPathMap.get(`steam:${t}`) || tagFullPathMap.get(t)) : null;
          if (sp) searchParts.push(sp);
          if (fp) searchParts.push(fp);
        });
        (it.user_tags || []).forEach(t => {
          const sp = tagPathMap.get(`user:${t}`) || tagPathMap.get(t);
          const fp = tagFullPathMap ? (tagFullPathMap.get(`user:${t}`) || tagFullPathMap.get(t)) : null;
          if (sp) searchParts.push(sp);
          if (fp) searchParts.push(fp);
        });
      }
      const _searchIndex = searchParts.join(' ').toLowerCase();

      // Only active tags (non-deactivated Steam tags and custom user tags) are part of filtering
      const allTagsLowerSet = new Set();
      activeSteamTags.forEach(t => {
        if (t) allTagsLowerSet.add(String(t).trim().toLowerCase());
      });
      (it.user_tags || []).forEach(t => {
        if (t) allTagsLowerSet.add(String(t).trim().toLowerCase());
      });

      return {
        ...it,
        _activeSteamTags: activeSteamTags,
        _activeSteamTagSet: activeSteamTagSet,
        _userTagSet: userTagSet,
        _allTagsLowerSet: allTagsLowerSet,
        _searchIndex
      };
    });
  }, [items, tagPathMap, tagFullPathMap]);

  // Fast search filtered base pool
  const searchFilteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return enrichedItems;
    return enrichedItems.filter(it => it._searchIndex.includes(q));
  }, [enrichedItems, searchQuery]);

  // Helper to test if a tag is a game version tag
  const isVersionTag = (tagName) => {
    const trimmed = (tagName || '').trim().toLowerCase();
    return /^v?\d+(\.\d+)/i.test(trimmed);
  };

  // System counts calculated on searchFilteredItems
  const systemCounts = useMemo(() => {
    let subscribed = 0;
    let unsubscribed = 0;
    let sorted = 0;
    let unsorted = 0;
    let favorited = 0;
    let enabled = 0;
    let disabled = 0;

    for (let i = 0; i < searchFilteredItems.length; i++) {
      const it = searchFilteredItems[i];
      if (it.is_unsubscribed) {
        unsubscribed++;
      } else {
        subscribed++;
      }

      if (it.is_disabled) {
        disabled++;
      } else {
        enabled++;
      }

      const isItemSorted = it.is_sorted !== undefined ? it.is_sorted : ((it.user_tags || []).length > 0);
      if (isItemSorted) {
        sorted++;
      } else {
        unsorted++;
      }

      if (it.is_favorited) {
        favorited++;
      }
    }

    return { subscribed, unsubscribed, sorted, unsorted, favorited, enabled, disabled };
  }, [searchFilteredItems]);

  // Extract all unique STEAM tags in stable alphabetical order (from all items' Steam tags)
  const allUniqueSteamTags = useMemo(() => {
    const set = new Set();
    items.forEach(it => {
      (it.tags || []).forEach(t => set.add(t));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Non-version Steam tags available for assignment in modal
  const allAvailableSteamTags = useMemo(() => {
    return allUniqueSteamTags.filter(t => !isVersionTag(t));
  }, [allUniqueSteamTags]);

  // Dynamic counts for STEAM tags (Optimized Single-Pass O(N) Tally Algorithm)
  const steamTagsWithCounts = useMemo(() => {
    const selectedArr = Array.from(selectedTags);
    const hasSelection = selectedArr.length > 0;
    const selectedLower = selectedArr.map(s => String(s).trim().toLowerCase());
    const selectedSetLower = new Set(selectedLower);

    // Fast Path 1: No selection -> Single pass tally across searchFilteredItems
    if (!hasSelection) {
      const tally = new Map();
      for (let i = 0; i < searchFilteredItems.length; i++) {
        const itemTags = searchFilteredItems[i]._allTagsLowerSet;
        if (!itemTags) continue;
        for (let k = 0; k < allUniqueSteamTags.length; k++) {
          const st = allUniqueSteamTags[k];
          if (itemTags.has(st.toLowerCase())) {
            tally.set(st, (tally.get(st) || 0) + 1);
          }
        }
      }
      return allUniqueSteamTags.map(tag => ({
        tag,
        count: tally.get(tag) || 0
      }));
    }

    // Fast Path 2: Selection active:
    // a) Filter matching items once (items that satisfy all selected tags)
    const matchingItems = [];
    for (let i = 0; i < searchFilteredItems.length; i++) {
      const it = searchFilteredItems[i];
      const tagSet = it._allTagsLowerSet;
      if (!tagSet) continue;
      let matchesAll = true;
      for (let j = 0; j < selectedLower.length; j++) {
        if (!tagSet.has(selectedLower[j])) {
          matchesAll = false;
          break;
        }
      }
      if (matchesAll) {
        matchingItems.push(it);
      }
    }
    const matchCount = matchingItems.length;

    // b) Single pass tally across matching items for any additional tag
    const tally = new Map();
    for (let i = 0; i < matchingItems.length; i++) {
      const itemTags = matchingItems[i]._allTagsLowerSet;
      for (let k = 0; k < allUniqueSteamTags.length; k++) {
        const st = allUniqueSteamTags[k];
        const stLower = st.toLowerCase();
        if (itemTags.has(stLower) && !selectedSetLower.has(stLower)) {
          tally.set(st, (tally.get(st) || 0) + 1);
        }
      }
    }

    return allUniqueSteamTags.map(tag => ({
      tag,
      count: selectedSetLower.has(tag.toLowerCase()) ? matchCount : (tally.get(tag) || 0)
    }));
  }, [allUniqueSteamTags, searchFilteredItems, selectedTags]);

  // Extract all USER custom tags and their dynamic counts (Optimized Single-Pass)
  const userTagsWithCounts = useMemo(() => {
    const userTagCounts = new Map();
    // Include all explicitly created user tags
    extraUserTags.forEach(t => {
      userTagCounts.set(t, 0);
    });

    enrichedItems.forEach(it => {
      (it.user_tags || []).forEach(t => {
        if (!userTagCounts.has(t)) userTagCounts.set(t, 0);
      });
    });

    const selectedArr = Array.from(selectedTags);
    const selectedLower = selectedArr.map(s => String(s).trim().toLowerCase());
    const selectedSetLower = new Set(selectedLower);

    let matchingItems = searchFilteredItems;
    if (selectedLower.length > 0) {
      matchingItems = [];
      for (let i = 0; i < searchFilteredItems.length; i++) {
        const it = searchFilteredItems[i];
        const tagSet = it._allTagsLowerSet;
        if (!tagSet) continue;
        let matchesAll = true;
        for (let j = 0; j < selectedLower.length; j++) {
          if (!tagSet.has(selectedLower[j])) {
            matchesAll = false;
            break;
          }
        }
        if (matchesAll) {
          matchingItems.push(it);
        }
      }
    }
    const matchCount = matchingItems.length;

    // Count appearances in current matching items in a single pass
    for (let i = 0; i < matchingItems.length; i++) {
      const it = matchingItems[i];
      const tags = it.user_tags;
      if (tags && tags.length > 0) {
        for (let j = 0; j < tags.length; j++) {
          const t = tags[j];
          if (!selectedSetLower.has(t.toLowerCase())) {
            userTagCounts.set(t, (userTagCounts.get(t) || 0) + 1);
          }
        }
      }
    }

    return Array.from(userTagCounts.entries())
      .map(([tag, count]) => ({
        tag,
        count: selectedSetLower.has(tag.toLowerCase()) ? matchCount : count
      }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }, [enrichedItems, searchFilteredItems, extraUserTags, selectedTags]);

  const allAvailableUserTags = useMemo(() => {
    return userTagsWithCounts.map(u => u.tag);
  }, [userTagsWithCounts]);

  // Unified tag selection (single-select on regular click, multi-select on Ctrl+click)
  const handleToggleTag = useCallback((tag, isCtrl = false) => {
    startFilterTransition(() => {
      // Remove from excluded tags if it was excluded
      setExcludedTags(prev => {
        if (!prev.has(tag)) return prev;
        const next = new Set(prev);
        next.delete(tag);
        return next;
      });

      if (isCtrl) {
        setSelectedTags(prev => {
          const next = new Set(prev);
          if (next.has(tag)) {
            next.delete(tag);
          } else {
            next.add(tag);
          }
          return next;
        });
      } else {
        setSelectedTags(prev => {
          if (prev.size === 1 && prev.has(tag)) {
            return new Set();
          }
          return new Set([tag]);
        });
      }
    });
  }, [startFilterTransition]);

  // Backward compatibility alias for any child component expecting onToggleUserTag
  const handleToggleUserTag = handleToggleTag;

  // Toggle tag exclusion / hiding (exclude mods containing this tag)
  const handleToggleExcludeTag = useCallback((tag) => {
    startFilterTransition(() => {
      setExcludedTags(prev => {
        const next = new Set(prev);
        if (next.has(tag)) {
          next.delete(tag);
        } else {
          next.add(tag);
        }
        return next;
      });
      // Remove from active positive filters if present
      setSelectedTags(prev => {
        if (!prev.has(tag)) return prev;
        const next = new Set(prev);
        next.delete(tag);
        return next;
      });
    });
  }, [startFilterTransition]);

  // Batch set tags (from group or range selections)
  const handleBatchSetTags = useCallback((steamTagsToSelect, userTagsToSelect, mode = 'set') => {
    startFilterTransition(() => {
      const allToSelect = [...(steamTagsToSelect || []), ...(userTagsToSelect || [])];
      if (mode === 'set') {
        setSelectedTags(new Set(allToSelect));
        setExcludedTags(prev => {
          const next = new Set(prev);
          allToSelect.forEach(t => next.delete(t));
          return next;
        });
      } else if (mode === 'add') {
        setSelectedTags(prev => {
          const next = new Set(prev);
          allToSelect.forEach(t => next.add(t));
          return next;
        });
        setExcludedTags(prev => {
          const next = new Set(prev);
          allToSelect.forEach(t => next.delete(t));
          return next;
        });
      } else if (mode === 'remove') {
        setSelectedTags(prev => {
          const next = new Set(prev);
          allToSelect.forEach(t => next.delete(t));
          return next;
        });
      }
    });
  }, [startFilterTransition]);

  const handleClearAllFilters = useCallback(() => {
    startFilterTransition(() => {
      setSelectedTags(new Set());
      setSelectedUserTags(new Set());
      setExcludedTags(new Set());
      // Системні фільтри (підписка, живлення/підключення, сортування) не скидаються автоматично разом із тегами
      setSystemFilter(prev => ({
        status: prev.status,
        sort: prev.sort,
        connection: prev.connection,
        favorite: null
      }));
    });
  }, [startFilterTransition]);

  // Toggle favorite on backend and local state
  const handleToggleFavorite = useCallback(async (itemId) => {
    let nextVal = true;
    setItems(prev => {
      const currentItem = prev.find(it => it.published_file_id === itemId);
      nextVal = currentItem ? !currentItem.is_favorited : true;
      return prev.map(it => {
        if (it.published_file_id === itemId) {
          return { ...it, is_favorited: nextVal };
        }
        return it;
      });
    });

    setDetailItem(prev => (prev && prev.published_file_id === itemId ? { ...prev, is_favorited: nextVal } : prev));

    try {
      await fetch(`/api/items/${itemId}/favorited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorited: nextVal })
      });
    } catch (err) {
      console.error('Failed to update favorite status:', err);
    }
  }, []);

  // Update item Steam tags and deactivated tags on backend and local state
  const handleUpdateItemSteamTags = async (itemId, newSteamTags, newDeactivatedTags) => {
    // Optimistic update
    setItems(prev => prev.map(it => {
      if (it.published_file_id === itemId) {
        return {
          ...it,
          tags: newSteamTags,
          deactivated_steam_tags: newDeactivatedTags,
          is_sorted: true
        };
      }
      return it;
    }));

    if (detailItem && detailItem.published_file_id === itemId) {
      setDetailItem(prev => (prev ? {
        ...prev,
        tags: newSteamTags,
        deactivated_steam_tags: newDeactivatedTags,
        is_sorted: true
      } : prev));
    }

    try {
      await fetch(`/api/items/${itemId}/steam-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: newSteamTags,
          deactivated_tags: newDeactivatedTags
        })
      });
    } catch (err) {
      console.error('Failed to update steam tags:', err);
    }
  };

  // Update item user tags on backend and local state
  const handleUpdateItemUserTags = async (itemId, tags) => {
    // Optimistic update
    setItems(prev => prev.map(it => {
      if (it.published_file_id === itemId) {
        return {
          ...it,
          user_tags: tags,
          is_sorted: true
        };
      }
      return it;
    }));

    setDetailItem(prev => (prev && prev.published_file_id === itemId ? {
      ...prev,
      user_tags: tags,
      is_sorted: true
    } : prev));

    try {
      await fetch(`/api/items/${itemId}/user-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      });
    } catch (err) {
      console.error('Failed to update user tags:', err);
    }
  };

  // Bulk add tag (Unified: if matches an existing Steam tag, applies/reactivates as Steam tag, otherwise as custom user tag)
  const handleBulkUnifiedAddTag = async (tag) => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !tag) return;
    const trimmed = (tag || '').trim();
    if (!trimmed) return;

    // Check if trimmed matches an available Steam tag (case-insensitive)
    const matchedSteamTag = (allAvailableSteamTags || []).find(
      st => typeof st === 'string' && st.toLowerCase() === trimmed.toLowerCase()
    );

    if (matchedSteamTag) {
      try {
        await fetch('/api/items/bulk-steam-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: ids, tag: matchedSteamTag })
        });
        // Optimistically update affected items
        setItems(prev => prev.map(it => {
          if (selectedIds.has(it.published_file_id)) {
            const existingTags = Array.isArray(it.tags) ? it.tags : [];
            const exists = existingTags.some(t => t.toLowerCase() === matchedSteamTag.toLowerCase());
            const updatedTags = exists ? existingTags : [...existingTags, matchedSteamTag];
            const existingDeact = Array.isArray(it.deactivated_steam_tags) ? it.deactivated_steam_tags : [];
            const updatedDeact = existingDeact.filter(t => t.toLowerCase() !== matchedSteamTag.toLowerCase());
            return {
              ...it,
              tags: updatedTags,
              deactivated_steam_tags: updatedDeact,
              is_sorted: true
            };
          }
          return it;
        }));
        if (detailItem && selectedIds.has(detailItem.published_file_id)) {
          setDetailItem(prev => {
            if (!prev) return prev;
            const existingTags = Array.isArray(prev.tags) ? prev.tags : [];
            const exists = existingTags.some(t => t.toLowerCase() === matchedSteamTag.toLowerCase());
            const updatedTags = exists ? existingTags : [...existingTags, matchedSteamTag];
            const existingDeact = Array.isArray(prev.deactivated_steam_tags) ? prev.deactivated_steam_tags : [];
            const updatedDeact = existingDeact.filter(t => t.toLowerCase() !== matchedSteamTag.toLowerCase());
            return {
              ...prev,
              tags: updatedTags,
              deactivated_steam_tags: updatedDeact,
              is_sorted: true
            };
          });
        }
      } catch (err) {
        console.error('Bulk steam tag update failed:', err);
      }
    } else {
      try {
        await fetch('/api/items/bulk-user-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: ids, tag: trimmed, action: 'add' })
        });
        // Add to extraUserTags
        setExtraUserTags(prev => new Set(prev).add(trimmed));
        fetch('/api/custom-user-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: trimmed })
        }).catch(() => {});

        // Optimistically update affected items
        setItems(prev => prev.map(it => {
          if (selectedIds.has(it.published_file_id)) {
            const existing = Array.isArray(it.user_tags) ? it.user_tags : [];
            const exists = existing.some(t => t.toLowerCase() === trimmed.toLowerCase());
            const updated = exists ? existing : [...existing, trimmed];
            return {
              ...it,
              user_tags: updated,
              is_sorted: true
            };
          }
          return it;
        }));
        if (detailItem && selectedIds.has(detailItem.published_file_id)) {
          setDetailItem(prev => {
            if (!prev) return prev;
            const existing = Array.isArray(prev.user_tags) ? prev.user_tags : [];
            const exists = existing.some(t => t.toLowerCase() === trimmed.toLowerCase());
            const updated = exists ? existing : [...existing, trimmed];
            return {
              ...prev,
              user_tags: updated,
              is_sorted: true
            };
          });
        }
      } catch (err) {
        console.error('Bulk user tag update failed:', err);
      }
    }
  };

  const handleBulkAddUserTag = handleBulkUnifiedAddTag;

  // Bulk remove or deactivate a tag from all selected items that have it
  const handleBulkRemoveItemTag = async (tag, tagType) => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !tag) return;

    if (tagType === 'steam') {
      try {
        await fetch('/api/items/bulk-steam-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: ids, tag: tag, action: 'remove' })
        });
      } catch (err) {
        console.error('Failed to bulk remove steam tag:', err);
      }

      setItems(prev => prev.map(it => {
        if (selectedIds.has(it.published_file_id)) {
          const orig = Array.isArray(it.original_steam_tags) ? it.original_steam_tags : [];
          const isOriginal = orig.some(t => typeof t === 'string' && t.toLowerCase() === tag.toLowerCase());

          let updatedTags = Array.isArray(it.tags) ? [...it.tags] : [];
          let updatedDeact = Array.isArray(it.deactivated_steam_tags) ? [...it.deactivated_steam_tags] : [];

          if (isOriginal) {
            // Keep in tags, add to deactivated_steam_tags
            if (!updatedDeact.some(t => t.toLowerCase() === tag.toLowerCase())) {
              updatedDeact.push(tag);
            }
          } else {
            // Manually added: remove completely
            updatedTags = updatedTags.filter(t => t.toLowerCase() !== tag.toLowerCase());
            updatedDeact = updatedDeact.filter(t => t.toLowerCase() !== tag.toLowerCase());
          }

          return {
            ...it,
            tags: updatedTags,
            deactivated_steam_tags: updatedDeact,
            is_sorted: true
          };
        }
        return it;
      }));

      if (detailItem && selectedIds.has(detailItem.published_file_id)) {
        setDetailItem(prev => {
          if (!prev) return prev;
          const orig = Array.isArray(prev.original_steam_tags) ? prev.original_steam_tags : [];
          const isOriginal = orig.some(t => typeof t === 'string' && t.toLowerCase() === tag.toLowerCase());

          let updatedTags = Array.isArray(prev.tags) ? [...prev.tags] : [];
          let updatedDeact = Array.isArray(prev.deactivated_steam_tags) ? [...prev.deactivated_steam_tags] : [];

          if (isOriginal) {
            if (!updatedDeact.some(t => t.toLowerCase() === tag.toLowerCase())) {
              updatedDeact.push(tag);
            }
          } else {
            updatedTags = updatedTags.filter(t => t.toLowerCase() !== tag.toLowerCase());
            updatedDeact = updatedDeact.filter(t => t.toLowerCase() !== tag.toLowerCase());
          }

          return {
            ...prev,
            tags: updatedTags,
            deactivated_steam_tags: updatedDeact,
            is_sorted: true
          };
        });
      }
    } else {
      // User tag
      try {
        await fetch('/api/items/bulk-user-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: ids, tag: tag, action: 'remove' })
        });
      } catch (err) {
        console.error('Failed to bulk remove user tag:', err);
      }

      setItems(prev => prev.map(it => {
        if (selectedIds.has(it.published_file_id)) {
          const existingUserTags = Array.isArray(it.user_tags) ? it.user_tags : [];
          const updatedUserTags = existingUserTags.filter(t => t.toLowerCase() !== tag.toLowerCase());
          return {
            ...it,
            user_tags: updatedUserTags,
            is_sorted: true
          };
        }
        return it;
      }));

      if (detailItem && selectedIds.has(detailItem.published_file_id)) {
        setDetailItem(prev => {
          if (!prev) return prev;
          const existingUserTags = Array.isArray(prev.user_tags) ? prev.user_tags : [];
          const updatedUserTags = existingUserTags.filter(t => t.toLowerCase() !== tag.toLowerCase());
          return {
            ...prev,
            user_tags: updatedUserTags,
            is_sorted: true
          };
        });
      }
    }
  };

  // Clear all tags for a single item (deactivates steam tags, deletes user tags, unsorted)
  const handleClearItemTags = async (itemId) => {
    try {
      await fetch(`/api/items/${itemId}/clear-tags`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to clear item tags:', err);
    }
    setItems(prev => prev.map(it => {
      if (it.published_file_id === itemId) {
        const origTags = Array.isArray(it.original_steam_tags) ? it.original_steam_tags : (it.tags || []);
        return {
          ...it,
          tags: [...origTags],
          user_tags: [],
          deactivated_steam_tags: [...origTags],
          is_sorted: false
        };
      }
      return it;
    }));
    if (detailItem && detailItem.published_file_id === itemId) {
      setDetailItem(prev => {
        if (!prev) return prev;
        const origTags = Array.isArray(prev.original_steam_tags) ? prev.original_steam_tags : (prev.tags || []);
        return {
          ...prev,
          tags: [...origTags],
          user_tags: [],
          deactivated_steam_tags: [...origTags],
          is_sorted: false
        };
      });
    }
  };

  // Revert all tag changes for a single item to original Steam tags (unsorted)
  const handleResetItemTags = async (itemId) => {
    try {
      await fetch(`/api/items/${itemId}/reset-tags`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to reset item tags:', err);
    }
    setItems(prev => prev.map(it => {
      if (it.published_file_id === itemId) {
        const origTags = Array.isArray(it.original_steam_tags) ? it.original_steam_tags : (it.tags || []);
        return {
          ...it,
          tags: [...origTags],
          user_tags: [],
          deactivated_steam_tags: [],
          is_sorted: false
        };
      }
      return it;
    }));
    if (detailItem && detailItem.published_file_id === itemId) {
      setDetailItem(prev => {
        if (!prev) return prev;
        const origTags = Array.isArray(prev.original_steam_tags) ? prev.original_steam_tags : (prev.tags || []);
        return {
          ...prev,
          tags: [...origTags],
          user_tags: [],
          deactivated_steam_tags: [],
          is_sorted: false
        };
      });
    }
  };

  // Bulk clear all tags for selected items
  const handleBulkClearTags = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await fetch('/api/items/bulk-clear-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: ids })
      });
    } catch (err) {
      console.error('Failed to bulk clear tags:', err);
    }
    setItems(prev => prev.map(it => {
      if (selectedIds.has(it.published_file_id)) {
        const origTags = Array.isArray(it.original_steam_tags) ? it.original_steam_tags : (it.tags || []);
        return {
          ...it,
          tags: [...origTags],
          user_tags: [],
          deactivated_steam_tags: [...origTags],
          is_sorted: false
        };
      }
      return it;
    }));
    if (detailItem && selectedIds.has(detailItem.published_file_id)) {
      setDetailItem(prev => {
        if (!prev) return prev;
        const origTags = Array.isArray(prev.original_steam_tags) ? prev.original_steam_tags : (prev.tags || []);
        return {
          ...prev,
          tags: [...origTags],
          user_tags: [],
          deactivated_steam_tags: [...origTags],
          is_sorted: false
        };
      });
    }
  };

  // Bulk reset tags to original Steam tags for selected items
  const handleBulkResetTags = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await fetch('/api/items/bulk-reset-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: ids })
      });
    } catch (err) {
      console.error('Failed to bulk reset tags:', err);
    }
    setItems(prev => prev.map(it => {
      if (selectedIds.has(it.published_file_id)) {
        const origTags = Array.isArray(it.original_steam_tags) ? it.original_steam_tags : (it.tags || []);
        return {
          ...it,
          tags: [...origTags],
          user_tags: [],
          deactivated_steam_tags: [],
          is_sorted: false
        };
      }
      return it;
    }));
    if (detailItem && selectedIds.has(detailItem.published_file_id)) {
      setDetailItem(prev => {
        if (!prev) return prev;
        const origTags = Array.isArray(prev.original_steam_tags) ? prev.original_steam_tags : (prev.tags || []);
        return {
          ...prev,
          tags: [...origTags],
          user_tags: [],
          deactivated_steam_tags: [],
          is_sorted: false
        };
      });
    }
  };

  // Toggle disabled state for a single item
  const handleToggleItemDisabled = async (itemId, targetState) => {
    setItems(prev => prev.map(it => {
      if (it.published_file_id === itemId) {
        return { ...it, is_disabled: targetState };
      }
      return it;
    }));
    if (detailItem && detailItem.published_file_id === itemId) {
      setDetailItem(prev => prev ? { ...prev, is_disabled: targetState } : prev);
    }
    try {
      await fetch(`/api/items/${itemId}/toggle-disabled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_disabled: targetState, mode: steamMode })
      });
    } catch (err) {
      console.error('Failed to toggle disabled:', err);
    }
  };

  // Bulk toggle disabled state for multiple items
  const handleBulkToggleDisabled = async (itemIds, targetState) => {
    if (!itemIds || !itemIds.length) return;
    const idSet = new Set(itemIds);
    setItems(prev => prev.map(it => {
      if (idSet.has(it.published_file_id)) {
        return { ...it, is_disabled: targetState };
      }
      return it;
    }));
    if (detailItem && idSet.has(detailItem.published_file_id)) {
      setDetailItem(prev => prev ? { ...prev, is_disabled: targetState } : prev);
    }
    try {
      await fetch('/api/items/bulk-set-disabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds, is_disabled: targetState, mode: steamMode })
      });
    } catch (err) {
      console.error('Failed to bulk toggle disabled:', err);
    }
  };

  // Bulk update favorite state
  const handleBulkFavorite = async (itemIds, targetFavorite) => {
    if (!itemIds || !itemIds.length) return;
    const idSet = new Set(itemIds);
    setItems(prev => prev.map(it => {
      if (idSet.has(it.published_file_id)) {
        return { ...it, is_favorited: targetFavorite };
      }
      return it;
    }));
    if (detailItem && idSet.has(detailItem.published_file_id)) {
      setDetailItem(prev => prev ? { ...prev, is_favorited: targetFavorite } : prev);
    }
    try {
      await Promise.all(itemIds.map(id =>
        fetch(`/api/items/${id}/favorited`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_favorited: targetFavorite })
        }).catch(() => {})
      ));
    } catch (err) {
      console.error('Failed to bulk update favorites:', err);
    }
  };

  // Toggle subscription for a single item
  const handleToggleItemSubscription = async (itemId, targetState) => {
    setItems(prev => prev.map(it => {
      if (it.published_file_id === itemId) {
        return { ...it, is_unsubscribed: targetState };
      }
      return it;
    }));
    if (detailItem && detailItem.published_file_id === itemId) {
      setDetailItem(prev => prev ? { ...prev, is_unsubscribed: targetState } : prev);
    }
    try {
      await fetch(`/api/items/${itemId}/toggle-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_unsubscribed: targetState, mode: steamMode })
      });
    } catch (err) {
      console.error('Failed to toggle subscription:', err);
    }
  };

  // Toggle sorted state for a single item
  const handleToggleItemSorted = async (itemId, targetState) => {
    setItems(prev => prev.map(it => {
      if (it.published_file_id === itemId) {
        return { ...it, is_sorted: targetState };
      }
      return it;
    }));
    if (detailItem && detailItem.published_file_id === itemId) {
      setDetailItem(prev => prev ? { ...prev, is_sorted: targetState } : prev);
    }
    try {
      await fetch(`/api/items/${itemId}/toggle-sorted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_sorted: targetState })
      });
    } catch (err) {
      console.error('Failed to toggle sorted:', err);
    }
  };

  // Mod Action Planning Handlers
  const handlePlanAction = (actionType) => {
    if (selectedIds.size === 0) return;
    setPendingActions(prev => {
      const next = { ...prev };
      // If all selected items already have this action, toggle it off
      const allHaveThis = Array.from(selectedIds).every(id => next[id] === actionType);
      selectedIds.forEach(id => {
        if (allHaveThis) {
          delete next[id];
        } else {
          next[id] = actionType;
        }
      });
      return next;
    });
  };

  const handleRemoveFromPlan = useCallback((itemId) => {
    setPendingActions(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const handleClearPlan = () => {
    setPendingActions({});
    setIsPlanModalOpen(false);
  };

  const handleExecutePlan = async (planOptions = {}) => {
    const planEntries = Object.entries(pendingActions);
    if (!planEntries.length) return;

    setIsExecutingPlan(true);
    try {
      const toDisable = [];
      const toEnable = [];
      const toUnsubscribe = [];
      const toSubscribe = [];
      const toAutosort = [];

      planEntries.forEach(([id, action]) => {
        if (action === 'disable') toDisable.push(id);
        else if (action === 'enable') toEnable.push(id);
        else if (action === 'unsubscribe') toUnsubscribe.push(id);
        else if (action === 'subscribe') toSubscribe.push(id);
        else if (action === 'autosort') toAutosort.push(id);
      });

      const tasks = [];
      if (toDisable.length > 0) {
        tasks.push(fetch('/api/items/bulk-set-disabled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: toDisable, is_disabled: true, mode: steamMode })
        }));
      }
      if (toEnable.length > 0) {
        tasks.push(fetch('/api/items/bulk-set-disabled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: toEnable, is_disabled: false, mode: steamMode })
        }));
      }
      if (toUnsubscribe.length > 0) {
        tasks.push(fetch('/api/items/bulk-set-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: toUnsubscribe, is_unsubscribed: true, mode: steamMode })
        }));
      }
      if (toSubscribe.length > 0) {
        tasks.push(fetch('/api/items/bulk-set-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: toSubscribe, is_unsubscribed: false, mode: steamMode })
        }));
      }

      // Handle autosort items
      let classifierAppliedMap = new Map();
      if (toAutosort.length > 0) {
        // If planOptions provided from ActionPlanModal with classifierItems
        let itemsToApply = [];
        if (planOptions && planOptions.classifierItems && planOptions.classifierItems.length > 0) {
          itemsToApply = planOptions.classifierItems.map(ci => ({
            item_id: ci.item_id,
            assigned_tags: ci.assigned_tags,
            deactivated_tags: ci.deactivated_tags,
            is_sorted: ci.is_sorted
          }));
        } else {
          // Preview on the fly if needed
          const prevRes = await fetch('/api/classifier/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_ids: toAutosort, tag_aliases: planOptions?.tagAliases || {} })
          });
          const prevData = await prevRes.json();
          if (prevData && prevData.items) {
            itemsToApply = prevData.items.map(ci => ({
              item_id: ci.item_id,
              assigned_tags: ci.assigned_tags,
              deactivated_tags: ci.deactivated_tags,
              is_sorted: ci.is_sorted
            }));
          }
        }

        if (itemsToApply.length > 0) {
          itemsToApply.forEach(it => classifierAppliedMap.set(it.item_id, it));
          tasks.push(fetch('/api/classifier/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToApply })
          }));
        }
      }

      await Promise.all(tasks);

      // Update local items state
      const disableSet = new Set(toDisable);
      const enableSet = new Set(toEnable);
      const unsubSet = new Set(toUnsubscribe);
      const subSet = new Set(toSubscribe);

      setItems(prev => prev.map(it => {
        const id = it.published_file_id;
        let is_disabled = it.is_disabled;
        let is_unsubscribed = it.is_unsubscribed;
        let user_tags = it.user_tags;
        let deactivated_steam_tags = it.deactivated_steam_tags;
        let is_sorted = it.is_sorted;

        if (disableSet.has(id)) is_disabled = true;
        if (enableSet.has(id)) is_disabled = false;
        if (unsubSet.has(id)) is_unsubscribed = true;
        if (subSet.has(id)) is_unsubscribed = false;

        if (classifierAppliedMap.has(id)) {
          const applied = classifierAppliedMap.get(id);
          user_tags = applied.assigned_tags;
          deactivated_steam_tags = applied.deactivated_tags;
          is_sorted = applied.is_sorted ? 1 : 0;
        }

        return {
          ...it,
          is_disabled,
          is_unsubscribed,
          user_tags,
          deactivated_steam_tags,
          is_sorted
        };
      }));

      // Update detailItem if it was involved
      if (detailItem && pendingActions[detailItem.published_file_id]) {
        const id = detailItem.published_file_id;
        setDetailItem(prev => {
          if (!prev) return prev;
          let is_disabled = prev.is_disabled;
          let is_unsubscribed = prev.is_unsubscribed;
          let user_tags = prev.user_tags;
          let deactivated_steam_tags = prev.deactivated_steam_tags;
          let is_sorted = prev.is_sorted;

          if (disableSet.has(id)) is_disabled = true;
          if (enableSet.has(id)) is_disabled = false;
          if (unsubSet.has(id)) is_unsubscribed = true;
          if (subSet.has(id)) is_unsubscribed = false;

          if (classifierAppliedMap.has(id)) {
            const applied = classifierAppliedMap.get(id);
            user_tags = applied.assigned_tags;
            deactivated_steam_tags = applied.deactivated_tags;
            is_sorted = applied.is_sorted ? 1 : 0;
          }

          return {
            ...prev,
            is_disabled,
            is_unsubscribed,
            user_tags,
            deactivated_steam_tags,
            is_sorted
          };
        });
      }

      // Reset plan and close modal
      setPendingActions({});
      setIsPlanModalOpen(false);
      fetchSteamStatus();
    } catch (err) {
      console.error('Failed to execute action plan:', err);
    } finally {
      setIsExecutingPlan(false);
    }
  };

  const handleExportTags = async () => {
    try {
      const selectedIdsList = Array.from(selectedIds);
      const payload = {
        item_ids: selectedIdsList.length > 0 ? selectedIdsList : null,
        title: selectedIdsList.length > 0
          ? t('export.tagsPackTitle', { count: selectedIdsList.length })
          : t('export.tagsPackFullTitle'),
        author: t('export.userAuthor'),
        description: t('export.description')
      };

      const res = await fetch('/api/data/export-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(t('export.errExportFailed'));
      }

      const data = await res.json();
      const jsonStr = JSON.stringify(data, null, 2);
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = selectedIdsList.length > 0
        ? `sw_tags_selected_${selectedIdsList.length}_${dateStr}_${timeStr}.swtags.json`
        : `sw_tags_pack_${dateStr}_${timeStr}.swtags.json`;

      const saveRes = await saveFileWithPrompt(filename, jsonStr);
      if (saveRes?.cancelled) {
        return; // User cancelled the save dialog
      }
    } catch (err) {
      console.error('Export tags failed:', err);
      alert(t('export.errExport', { msg: err.message || err }));
    }
  };

  const handleImportSuccess = () => {
    // Reload items, tag structure, custom tags and status
    fetch(`/api/items?sort_by=${sortBy}&sort_dir=${sortDir}`)
      .then(r => r.json())
      .then(res => setItems(res.items || []))
      .catch(console.error);

    fetch('/api/tag-structure')
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.structure)) {
          setTagStructure(data.structure);
        }
      })
      .catch(console.error);

    fetch('/api/custom-user-tags')
      .then(r => r.json())
      .then(res => {
        if (res && Array.isArray(res.tags)) {
          setExtraUserTags(new Set(res.tags));
        }
      })
      .catch(console.error);

    fetch('/api/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(console.error);
  };

  const handleCreateUserTag = async (tag) => {
    const trimmed = (tag || '').trim();
    if (!trimmed) return;

    // Add to persistent extraUserTags set
    setExtraUserTags(prev => new Set(prev).add(trimmed));

    // Save to backend custom_user_tags dictionary
    fetch('/api/custom-user-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: trimmed })
    }).catch(err => console.warn('Failed to save custom user tag:', err));

    // If items are selected, apply it to them; otherwise toggle it in active filter
    if (selectedIds.size > 0) {
      handleBulkAddUserTag(trimmed);
    } else {
      setSelectedUserTags(prev => new Set(prev).add(trimmed));
    }
  };

  // Delete a custom user tag across all items and filters
  const handleDeleteUserTag = async (tag) => {
    // Remove from extraUserTags
    setExtraUserTags(prev => {
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });

    // Remove from local items state
    setItems(prev => prev.map(it => {
      const existing = it.user_tags || [];
      if (existing.includes(tag)) {
        const updated = existing.filter(t => t !== tag);
        return {
          ...it,
          user_tags: updated,
          is_sorted: updated.length > 0
        };
      }
      return it;
    }));

    if (detailItem && (detailItem.user_tags || []).includes(tag)) {
      setDetailItem(prev => (prev ? {
        ...prev,
        user_tags: (prev.user_tags || []).filter(t => t !== tag),
        is_sorted: (prev.user_tags || []).filter(t => t !== tag).length > 0
      } : prev));
    }

    // Remove from active selection
    setSelectedUserTags(prev => {
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });

    try {
      await fetch(`/api/user-tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete user tag on backend:', err);
    }
  };

  // Rename a custom user tag across all items, selection, extraUserTags and backend
  const handleRenameUserTag = async (oldTag, newTag) => {
    const trimmedOld = (oldTag || '').trim();
    const trimmedNew = (newTag || '').trim();
    if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return;

    // 1. Update extraUserTags
    setExtraUserTags(prev => {
      const next = new Set(prev);
      next.delete(trimmedOld);
      next.add(trimmedNew);
      return next;
    });

    // 2. Update local items state
    setItems(prev => prev.map(it => {
      const existing = it.user_tags || [];
      if (existing.includes(trimmedOld)) {
        const updated = existing.map(t => (t === trimmedOld ? trimmedNew : t));
        const clean = Array.from(new Set(updated));
        return {
          ...it,
          user_tags: clean,
          is_sorted: clean.length > 0
        };
      }
      return it;
    }));

    // 3. Update detailItem if open
    if (detailItem && (detailItem.user_tags || []).includes(trimmedOld)) {
      setDetailItem(prev => {
        if (!prev) return prev;
        const updated = (prev.user_tags || []).map(t => (t === trimmedOld ? trimmedNew : t));
        const clean = Array.from(new Set(updated));
        return {
          ...prev,
          user_tags: clean,
          is_sorted: clean.length > 0
        };
      });
    }

    // 4. Update active filter selection
    setSelectedUserTags(prev => {
      if (!prev.has(trimmedOld)) return prev;
      const next = new Set(prev);
      next.delete(trimmedOld);
      next.add(trimmedNew);
      return next;
    });

    // 5. Send request to backend
    try {
      const resp = await fetch(`/api/user-tags/${encodeURIComponent(trimmedOld)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_tag: trimmedNew })
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || t('tags.errRename'));
      }
    } catch (err) {
      console.error('Failed to rename user tag on backend:', err);
      throw err;
    }
  };


  // Final Filtered Items for Main Cards Grid
  const filteredItems = useMemo(() => {
    const selectedTagsArray = Array.from(selectedTags);
    const selectedTagsLower = selectedTagsArray.map(t => String(t).trim().toLowerCase());
    const excludedTagsArray = excludedTags ? Array.from(excludedTags).map(t => String(t).trim().toLowerCase()) : [];

    return searchFilteredItems.filter(it => {
      // 0. Collection Filter
      if (selectedCollectionId !== null) {
        if (!it.collection_ids || !it.collection_ids.includes(selectedCollectionId)) return false;
      } else if (selectedInGameFolder !== null) {
        // 0b. In-Game Folder Filter
        const fid = String(it.published_file_id);
        const itemFolders = inGameFoldersData?.item_to_folders
          ? (inGameFoldersData.item_to_folders[fid] || [])
          : (inGameFoldersData?.item_to_folder && inGameFoldersData.item_to_folder[fid] ? [inGameFoldersData.item_to_folder[fid]] : []);
        if (selectedInGameFolder === '__UNCATEGORIZED__') {
          if (itemFolders.length > 0) return false;
        } else {
          if (!itemFolders.includes(selectedInGameFolder)) return false;
        }
      } else {
        // 1. System Status Filter (Subscribed / Unsubscribed)
        if (systemFilter.status === 'subscribed' && it.is_unsubscribed) return false;
        if (systemFilter.status === 'unsubscribed' && !it.is_unsubscribed) return false;
      }

      // 1b. Connection Filter (Enabled / Disabled)
      if (systemFilter.connection === 'enabled' && it.is_disabled) return false;
      if (systemFilter.connection === 'disabled' && !it.is_disabled) return false;

      // 2. System Sort Filter (Sorted / Unsorted)
      const isSorted = it.is_sorted !== undefined ? it.is_sorted : ((it.user_tags || []).length > 0);
      if (systemFilter.sort === 'sorted' && !isSorted) return false;
      if (systemFilter.sort === 'unsorted' && isSorted) return false;

      // 3. System Favorite Filter
      if (systemFilter.favorite && !it.is_favorited) return false;

      // 3b. Excluded Tags Filter: Item must NOT have any of the excluded tags
      if (excludedTagsArray.length > 0) {
        const allTags = it._allTagsLowerSet;
        if (allTags) {
          for (let i = 0; i < excludedTagsArray.length; i++) {
            if (allTags.has(excludedTagsArray[i])) {
              return false;
            }
          }
        }
      }

      // 4. Unified Tags Filter: Item must have all selected tags across steam or user tags
      if (selectedTagsLower.length > 0) {
        const allTags = it._allTagsLowerSet;
        if (!allTags) return false;
        for (let i = 0; i < selectedTagsLower.length; i++) {
          if (!allTags.has(selectedTagsLower[i])) return false;
        }
      }

      return true;
    });
  }, [searchFilteredItems, systemFilter, selectedTags, excludedTags, selectedCollectionId, selectedInGameFolder, inGameFoldersData]);

  const uncategorizedCount = useMemo(() => {
    if (!items || items.length === 0) return 0;
    const itemMultiMap = inGameFoldersData?.item_to_folders || {};
    const itemSingleMap = inGameFoldersData?.item_to_folder || {};
    return items.filter(it => {
      const fid = String(it.published_file_id);
      const multi = itemMultiMap[fid];
      if (multi && multi.length > 0) return false;
      if (itemSingleMap[fid]) return false;
      return true;
    }).length;
  }, [items, inGameFoldersData]);

  const updateAnchorId = useCallback((id) => {
    anchorIdRef.current = id;
    setAnchorId(id);
  }, []);

  // Progressive Catalog Chunk Rendering with Virtual Bottom Spacer
  // Ensures instant, freeze-free load on Windows while maintaining stable, accurate scrollbar
  const [visibleCount, setVisibleCount] = useState(80);
  const [columnCount, setColumnCount] = useState(5);

  useEffect(() => {
    setVisibleCount(80);
  }, [searchQuery, selectedTags, selectedUserTags, excludedTags, systemFilter, selectedCollectionId, selectedInGameFolder, sortBy, sortDir]);

  // Track actual grid columns dynamically
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;
    const updateColumns = () => {
      const config = GRID_LAYOUT_CONFIG[viewMode]?.[cardSize] || GRID_LAYOUT_CONFIG.grid[2];
      if (config.minWidth === '100%') {
        setColumnCount(1);
        return;
      }
      const containerWidth = mainEl.clientWidth - 32;
      const minColWidth = parseInt(config.minWidth) || 250;
      const cols = Math.max(1, Math.floor(containerWidth / (minColWidth + 14)));
      setColumnCount(cols);
    };
    updateColumns();
    const ro = new ResizeObserver(updateColumns);
    ro.observe(mainEl);
    return () => ro.disconnect();
  }, [viewMode, cardSize]);

  // Compute bottom spacer height for unmounted rows so scrollHeight is 100% stable
  const bottomSpacerHeight = useMemo(() => {
    const unmountedCount = Math.max(0, filteredItems.length - visibleCount);
    if (unmountedCount === 0) return 0;
    const unmountedRows = Math.ceil(unmountedCount / Math.max(1, columnCount));
    // Estimated row heights including gap
    let rowHeight = 354;
    if (viewMode === 'list') {
      rowHeight = cardSize === 1 ? 102 : cardSize === 2 ? 106 : 134;
    } else {
      rowHeight = cardSize === 1 ? 292 : cardSize === 2 ? 354 : 418;
    }
    return unmountedRows * rowHeight;
  }, [filteredItems.length, visibleCount, columnCount, viewMode, cardSize]);

  // Progressive background idle mounting + responsive scroll mounting
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;
    const handleCatalogScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = mainEl;
      if (scrollHeight <= 0) return;

      // Regular scroll threshold near bottom of rendered area
      if (scrollTop + clientHeight >= scrollHeight - bottomSpacerHeight - 800) {
        setVisibleCount(prev => (prev < filteredItems.length ? Math.min(prev + 80, filteredItems.length) : prev));
        return;
      }

      // Fast thumb drag support: jump directly to needed index
      const scrollRatio = (scrollTop + clientHeight) / scrollHeight;
      const neededItems = Math.min(filteredItems.length, Math.ceil(filteredItems.length * scrollRatio) + 40);
      if (neededItems > visibleCount) {
        setVisibleCount(neededItems);
      }
    };
    mainEl.addEventListener('scroll', handleCatalogScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleCatalogScroll);
  }, [filteredItems.length, bottomSpacerHeight, visibleCount]);

  // Idle background pre-rendering: smoothly mount remainder in background when CPU is free
  useEffect(() => {
    if (visibleCount >= filteredItems.length) return;
    const timer = setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + 80, filteredItems.length));
    }, 150);
    return () => clearTimeout(timer);
  }, [visibleCount, filteredItems.length]);

  // Selection handlers
  const handleItemClick = useCallback((e, item) => {
    const id = item.published_file_id;
    const currentAnchor = anchorIdRef.current;

    if (e.shiftKey && currentAnchor !== null) {
      const anchorIdx = filteredItems.findIndex(it => it.published_file_id === currentAnchor);
      const targetIdx = filteredItems.findIndex(it => it.published_file_id === id);
      if (anchorIdx !== -1 && targetIdx !== -1) {
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        const rangeIds = filteredItems.slice(start, end + 1).map(it => it.published_file_id);

        setSelectedIds(prev => {
          const next = new Set(prev);
          rangeIds.forEach(rangeId => next.add(rangeId));
          return next;
        });
        updateAnchorId(id);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      updateAnchorId(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      updateAnchorId(id);
      setSelectedIds(prev => {
        if (prev.has(id) && prev.size === 1) {
          return new Set();
        } else {
          return new Set([id]);
        }
      });
    }
  }, [filteredItems, updateAnchorId]);

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredItems.map(i => i.published_file_id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    updateAnchorId(null);
    setAnchorIndex(null);
  };

  // Helper to determine the last selected mod (fallback to last added in selection)
  const getLastSelectedId = useCallback(() => {
    if (anchorId && selectedIds.has(anchorId)) return anchorId;
    if (anchorIdRef.current && selectedIds.has(anchorIdRef.current)) return anchorIdRef.current;
    if (selectedIds.size > 0) {
      const arr = Array.from(selectedIds);
      return arr[arr.length - 1];
    }
    return null;
  }, [anchorId, selectedIds]);

  // Handlers for sort changes that record target mod to scroll to after re-ordering
  const handleSetSortBy = useCallback((newSort) => {
    const target = getLastSelectedId();
    if (target) {
      pendingSortScrollTargetRef.current = target;
    }
    setSortBy(newSort);
  }, [getLastSelectedId]);

  const handleSetSortDir = useCallback((newDir) => {
    const target = getLastSelectedId();
    if (target) {
      pendingSortScrollTargetRef.current = target;
    }
    setSortDir(newDir);
  }, [getLastSelectedId]);

  // Smoothly scroll to the selected mod after sorting change
  useEffect(() => {
    const targetId = pendingSortScrollTargetRef.current;
    if (!targetId) return;

    const exists = filteredItems.some(it => it.published_file_id === targetId);
    if (!exists) {
      pendingSortScrollTargetRef.current = null;
      return;
    }

    pendingSortScrollTargetRef.current = null;

    const timer = setTimeout(() => {
      const el = document.getElementById(`mod-card-${targetId}`) || document.querySelector(`[data-item-id="${targetId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [items, filteredItems]);

  // Handle right-click context menu on a mod card or row
  const handleModContextMenu = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();

    const inSelection = selectedIds.has(item.published_file_id);
    if (!inSelection) {
      setSelectedIds(new Set([item.published_file_id]));
      updateAnchorId(item.published_file_id);
    }

    setModContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      forceSingle: !inSelection
    });
  }, [selectedIds, updateAnchorId]);

  // Mod context menu structure with action-first items and target submenus
  const modContextMenuItems = useMemo(() => {
    if (!modContextMenu) return [];
    const item = modContextMenu.item;
    const isMulti = !modContextMenu.forceSingle && selectedIds.size >= 2 && selectedIds.has(item.published_file_id);
    const groupCount = isMulti ? selectedIds.size : filteredItems.length;
    const groupLabel = isMulti
      ? t('context.groupSelected', { count: groupCount })
      : t('context.groupAllOnScreen', { count: groupCount });
    const groupIds = isMulti
      ? Array.from(selectedIds)
      : filteredItems.map(it => it.published_file_id);

    // Collection submenus
    const singleCollectionSubmenu = collections.length > 0
      ? collections.map(col => ({
          key: `col-single-${col.id}`,
          label: col.name,
          badge: `${col.items_count || 0}`,
          onClick: () => handleItemAddToCollection(col.id, item.published_file_id)
        }))
      : [{ key: 'col-none-1', label: t('context.noColsCreated'), disabled: true }];

    const groupCollectionSubmenu = collections.length > 0
      ? collections.map(col => ({
          key: `col-group-${col.id}`,
          label: col.name,
          badge: `${col.items_count || 0}`,
          onClick: () => handleBulkAddToCollection(col.id, groupIds)
        }))
      : [{ key: 'col-none-2', label: t('context.noColsCreated'), disabled: true }];

    return [
      // 1. Підключити (Увімкнути)
      {
        key: 'enable',
        label: t('context.enable'),
        icon: Power,
        iconClassName: 'text-[#a4d053]',
        submenu: [
          {
            key: 'enable-single',
            label: t('context.onlyThisMod'),
            icon: Power,
            iconClassName: 'text-[#a4d053]',
            onClick: () => handleToggleItemDisabled(item.published_file_id, false)
          },
          {
            key: 'enable-group',
            label: groupLabel,
            icon: Power,
            iconClassName: 'text-[#a4d053]',
            onClick: () => handleBulkToggleDisabled(groupIds, false)
          }
        ]
      },
      // 2. Відключити (Вимкнути)
      {
        key: 'disable',
        label: t('context.disable'),
        icon: PowerOff,
        iconClassName: 'text-[#f49e42]',
        submenu: [
          {
            key: 'disable-single',
            label: t('context.onlyThisMod'),
            icon: PowerOff,
            iconClassName: 'text-[#f49e42]',
            onClick: () => handleToggleItemDisabled(item.published_file_id, true)
          },
          {
            key: 'disable-group',
            label: groupLabel,
            icon: PowerOff,
            iconClassName: 'text-[#f49e42]',
            onClick: () => handleBulkToggleDisabled(groupIds, true)
          }
        ]
      },
      // 3. В обране
      {
        key: 'favorite',
        label: t('context.favorite'),
        icon: Star,
        iconClassName: 'text-[#ffd700]',
        submenu: [
          {
            key: 'fav-single',
            label: item.is_favorited ? t('context.removeFavorite') : t('context.addFavorite'),
            icon: Star,
            iconClassName: 'text-[#ffd700]',
            onClick: () => handleToggleFavorite(item.published_file_id)
          },
          {
            key: 'fav-group',
            label: t('context.addGroupFavorite', { group: groupLabel.toLowerCase() }),
            icon: Star,
            iconClassName: 'text-[#ffd700]',
            onClick: () => handleBulkFavorite(groupIds, true)
          }
        ]
      },
      // 4. Додати до колекції
      {
        key: 'collection',
        label: t('context.addCol'),
        icon: FolderPlus,
        iconClassName: 'text-[#66c0f4]',
        submenu: [
          {
            key: 'col-single-wrap',
            label: t('context.onlyThisMod'),
            icon: FolderPlus,
            submenu: singleCollectionSubmenu
          },
          {
            key: 'col-group-wrap',
            label: groupLabel,
            icon: FolderPlus,
            submenu: groupCollectionSubmenu
          }
        ]
      },
      // 5. Копіювати
      {
        key: 'copy',
        label: t('context.copy'),
        icon: Copy,
        iconClassName: 'text-gray-300',
        submenu: [
          {
            key: 'copy-link',
            label: t('context.copyLink'),
            icon: Copy,
            onClick: () => copyToClipboard(`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.published_file_id}`)
          },
          {
            key: 'copy-id',
            label: t('context.copyId'),
            icon: Copy,
            badge: item.published_file_id,
            onClick: () => copyToClipboard(item.published_file_id)
          },
          {
            key: 'copy-group-ids',
            label: t('context.copyGroupIds', { label: groupLabel }),
            icon: Copy,
            onClick: () => copyToClipboard(groupIds.join(', '))
          }
        ]
      },
      { divider: true },
      // 6. Відкрити картку моду
      {
        key: 'open-detail',
        label: t('context.openCard'),
        icon: Maximize2,
        onClick: () => handleOpenDetail(item)
      },
      // 7. Відкрити в Steam Workshop
      {
        key: 'open-steam',
        label: t('context.openSteam'),
        icon: ExternalLink,
        iconClassName: 'text-[#66c0f4]',
        onClick: () => window.open(`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.published_file_id}`, '_blank')
      },
      { divider: true },
      // 8. Виділення
      {
        key: 'select-all',
        label: t('context.selectAllOnScreen', { count: filteredItems.length }),
        icon: CheckSquare,
        onClick: handleSelectAllFiltered
      },
      ...(selectedIds.size > 0 ? [
        {
          key: 'deselect-all',
          label: t('context.deselectAll'),
          icon: X,
          onClick: handleClearSelection
        }
      ] : [])
    ];
  }, [
    modContextMenu,
    selectedIds,
    filteredItems,
    collections,
    handleToggleItemDisabled,
    handleBulkToggleDisabled,
    handleToggleFavorite,
    handleBulkFavorite,
    handleItemAddToCollection,
    handleBulkAddToCollection,
    handleOpenDetail,
    t
  ]);

  // Calculate total selected bytes
  const totalSelectedBytes = useMemo(() => {
    let sum = 0;
    items.forEach(it => {
      if (selectedIds.has(it.published_file_id)) {
        sum += (it.local_size_bytes || it.api_file_size || 0);
      }
    });
    return sum;
  }, [items, selectedIds]);

  // List of currently selected item objects
  const selectedItemsList = useMemo(() => {
    return items.filter(it => selectedIds.has(it.published_file_id));
  }, [items, selectedIds]);

  // Unified dynamic layout calculation for both List and Grid views
  const { gridClassName, gridContainerStyle } = useMemo(() => {
    const config = GRID_LAYOUT_CONFIG[viewMode]?.[cardSize] || GRID_LAYOUT_CONFIG.grid[2];
    const isSingleColumn = config.minWidth === '100%';

    return {
      gridClassName: `grid w-full min-w-0 max-w-full ${config.gapClass}`,
      gridContainerStyle: {
        gridTemplateColumns: isSingleColumn
          ? 'minmax(0, 1fr)'
          : `repeat(auto-fill, minmax(min(100%, ${config.minWidth}), 1fr))`
      }
    };
  }, [viewMode, cardSize]);

  const lastKnownDetailIndexRef = useRef(0);

  // Mod index in current filtered list for modal navigation
  const currentDetailIndex = useMemo(() => {
    if (!detailItem) return -1;
    const idx = filteredItems.findIndex(it => it.published_file_id === detailItem.published_file_id);
    if (idx !== -1) {
      lastKnownDetailIndexRef.current = idx;
    }
    return idx;
  }, [detailItem, filteredItems]);

  const handleNavigateDetail = (direction) => {
    if (filteredItems.length === 0) return;
    let baseIndex = currentDetailIndex;
    if (baseIndex === -1) {
      // Current item dropped out of filteredItems (e.g. marked sorted)
      // Navigate smoothly using the last known position
      baseIndex = lastKnownDetailIndexRef.current;
      if (direction > 0) {
        let nextIndex = baseIndex;
        if (nextIndex >= filteredItems.length) nextIndex = 0;
        setDetailItem(filteredItems[nextIndex]);
        return;
      } else {
        let prevIndex = baseIndex - 1;
        if (prevIndex < 0) prevIndex = filteredItems.length - 1;
        setDetailItem(filteredItems[prevIndex]);
        return;
      }
    }

    let nextIndex = baseIndex + direction;
    if (nextIndex < 0) nextIndex = filteredItems.length - 1;
    if (nextIndex >= filteredItems.length) nextIndex = 0;
    setDetailItem(filteredItems[nextIndex]);
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-[#0e141b] flex flex-col items-center justify-center text-[#66c0f4]">
        <Loader2 className="w-10 h-10 animate-spin mb-3" />
        <span className="text-sm font-medium">{t('app.loading')}</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#0e141b] flex flex-col overflow-hidden">
      
      {/* Unified Top Header Bar */}
      <Header
        onRefresh={handleRefresh}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isScanning={isScanning}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={handleSetSortBy}
        sortDir={sortDir}
        setSortDir={handleSetSortDir}
        viewMode={viewMode}
        setViewMode={handleSetViewMode}
        cardSize={cardSize}
        setCardSize={handleSetCardSize}
        leftWidth={leftWidth}
        rightWidth={rightWidth}
        headerLeftRef={headerLeftRef}
        headerRightRef={headerRightRef}
      />

      {/* Main 3-column Layout (Edge-to-Edge full width) */}
      <div className="w-full max-w-none px-1.5 sm:px-2 pb-2 flex-1 min-h-0 flex items-stretch overflow-hidden">
        
        {/* Left Column: Tags or Collections Sidebar with dynamic width */}
        <div ref={leftSidebarContainerRef} style={{ width: `${leftWidth}px` }} className="shrink-0 h-full flex flex-col">
          {leftSidebarMode === 'tags' ? (
            <TagsSidebar
              steamTagsWithCounts={steamTagsWithCounts}
              selectedTags={selectedTags}
              excludedTags={excludedTags}
              onToggleTag={handleToggleTag}
              onToggleExcludeTag={handleToggleExcludeTag}
              onClearTags={handleClearAllFilters}
              systemFilter={systemFilter}
              setSystemFilter={setSystemFilter}
              systemCounts={systemCounts}
              userTagsWithCounts={userTagsWithCounts}
              selectedUserTags={selectedUserTags}
              onToggleUserTag={handleToggleUserTag}
              onCreateUserTag={handleCreateUserTag}
              onRenameUserTag={handleRenameUserTag}
              onDeleteUserTag={handleDeleteUserTag}
              onBatchSetTags={handleBatchSetTags}
              onTagStructureChange={setTagStructure}
              sidebarWidth={leftWidth}
              sidebarMode={leftSidebarMode}
              onModeChange={handleLeftModeChange}
              collectionsCount={collections.length}
              collections={collections}
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={setSelectedCollectionId}
            />
          ) : leftSidebarMode === 'collections' ? (
            <CollectionsSidebar
              collections={collections}
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={setSelectedCollectionId}
              onCreateCollection={handleCreateCollection}
              onUpdateCollection={handleUpdateCollection}
              onDeleteCollection={handleDeleteCollection}
              onApplyPreset={handleApplyPreset}
              onToggleAllItems={handleToggleAllItemsInCollection}
              onSubscribeMissing={handleSubscribeMissingInCollection}
              onOpenImportModal={() => setIsImportCollectionModalOpen(true)}
              sidebarWidth={leftWidth}
              sidebarMode={leftSidebarMode}
              onModeChange={handleLeftModeChange}
              selectedTags={selectedTags}
              selectedUserTags={selectedUserTags}
              onToggleTag={handleToggleTag}
              onToggleUserTag={handleToggleUserTag}
              onClearTags={handleClearAllFilters}
            />
          ) : (
            <FoldersSidebar
              folders={inGameFoldersData.folders}
              selectedFolder={selectedInGameFolder}
              onSelectFolder={setSelectedInGameFolder}
              onCreateFolder={handleCreateInGameFolder}
              onRenameFolder={handleRenameInGameFolder}
              onDeleteFolder={handleDeleteInGameFolder}
              sidebarMode={leftSidebarMode}
              onModeChange={handleLeftModeChange}
              isGameRunning={inGameFoldersData.game_running}
              savePathExists={inGameFoldersData.exists}
              uncategorizedCount={uncategorizedCount}
              selectedTags={selectedTags}
              selectedUserTags={selectedUserTags}
              onToggleTag={handleToggleTag}
              onToggleUserTag={handleToggleUserTag}
              onClearTags={handleClearAllFilters}
            />
          )}
        </div>

        {/* Left Resizer Drag Handle */}
        <div
          onMouseDown={handleLeftResizeStart}
          className="w-3 h-full cursor-col-resize flex items-center justify-center group shrink-0 select-none z-10"
          title={t('app.resizeTags')}
        >
          <div className="w-0.5 h-10 rounded-full bg-[#202e3e] group-hover:bg-[#66c0f4] group-active:bg-[#66c0f4] transition" />
        </div>

        {/* Center Column: Direct Items Grid / List */}
        <main ref={mainRef} className="flex-1 min-w-0 h-full overflow-y-auto relative pr-1.5 focus:outline-none">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-[#171d25] rounded-xl border border-[#233547]">
              <p className="text-[#8f98a0] text-sm">{t('app.noModsFound')}</p>
              {(searchQuery || selectedTags.size > 0 || selectedUserTags.size > 0 || excludedTags.size > 0 || systemFilter.favorite) && (
                <button
                  onClick={() => { setSearchQuery(''); handleClearAllFilters(); }}
                  className="mt-3 text-xs text-[#66c0f4] hover:underline cursor-pointer"
                >
                  {t('app.resetSearchAndTags')}
                </button>
              )}
            </div>
          ) : (
            <div
              className={gridClassName}
              style={{
                ...gridContainerStyle,
                paddingBottom: bottomSpacerHeight > 0 ? `${bottomSpacerHeight}px` : undefined
              }}
            >
              {filteredItems.slice(0, visibleCount).map((item, index) => {
                const isSelected = selectedIds.has(item.published_file_id);
                const isAnchor = anchorId === item.published_file_id;
                if (viewMode === 'list') {
                  return (
                    <ItemRow
                      key={item.published_file_id}
                      item={item}
                      index={index}
                      isSelected={isSelected}
                      isAnchor={isAnchor}
                      selectedSteamTags={selectedTags}
                      selectedUserTags={selectedUserTags}
                      onItemClick={handleItemClick}
                      onOpenDetail={handleOpenDetail}
                      onToggleFavorite={handleToggleFavorite}
                      pendingAction={pendingActions[item.published_file_id] || null}
                      onRemovePendingAction={handleRemoveFromPlan}
                      tagPathMap={tagPathMap}
                      tagFullPathMap={tagFullPathMap}
                      cardSize={cardSize}
                      onToggleTag={handleToggleTag}
                      onToggleUserTag={handleToggleUserTag}
                      onContextMenu={handleModContextMenu}
                    />
                  );
                }
                return (
                  <ItemCard
                    key={item.published_file_id}
                    item={item}
                    index={index}
                    isSelected={isSelected}
                    isAnchor={isAnchor}
                    selectedSteamTags={selectedTags}
                    selectedUserTags={selectedUserTags}
                    onItemClick={handleItemClick}
                    onOpenDetail={handleOpenDetail}
                    onToggleFavorite={handleToggleFavorite}
                    pendingAction={pendingActions[item.published_file_id] || null}
                    onRemovePendingAction={handleRemoveFromPlan}
                    tagPathMap={tagPathMap}
                    tagFullPathMap={tagFullPathMap}
                    cardSize={cardSize}
                    onToggleTag={handleToggleTag}
                    onToggleUserTag={handleToggleUserTag}
                    onContextMenu={handleModContextMenu}
                  />
                );
              })}
            </div>
          )}

          {/* Floating Controls Hints Window in Mod Tiles Zone (Bottom Right) */}
          {showControlHints && (
            <ControlsHintOverlay
              mainRef={mainRef}
              leftWidth={leftWidth}
              rightWidth={rightWidth}
              hasSelection={selectedIds.size > 0}
            />
          )}
        </main>

        {/* Right Resizer Drag Handle */}
        <div
          onMouseDown={handleRightResizeStart}
          className="w-3 h-full cursor-col-resize flex items-center justify-center group shrink-0 select-none z-10"
          title={t('app.resizeActions')}
        >
          <div className="w-0.5 h-10 rounded-full bg-[#202e3e] group-hover:bg-[#66c0f4] group-active:bg-[#66c0f4] transition" />
        </div>

        {/* Right Column: Permanent Action & Selection Sidebar */}
        <div ref={rightSidebarContainerRef} style={{ width: `${rightWidth}px` }} className="shrink-0 h-full flex flex-col">
          <RightActionSidebar
            selectedCount={selectedIds.size}
            totalSelectedBytes={totalSelectedBytes}
            onSelectAllFiltered={handleSelectAllFiltered}
            onClearSelection={handleClearSelection}
            onPlanAction={handlePlanAction}
            pendingActionsCount={Object.keys(pendingActions).length}
            onOpenPlanModal={() => setIsPlanModalOpen(true)}
            onClearPlan={handleClearPlan}
            pendingActions={pendingActions}
            selectedItems={selectedItemsList}
            filteredCount={filteredItems.length}
            onBulkAddTag={handleBulkUnifiedAddTag}
            onBulkAddUserTag={handleBulkUnifiedAddTag}
            onBulkClearTags={handleBulkClearTags}
            onBulkResetTags={handleBulkResetTags}
            onBulkRemoveItemTag={handleBulkRemoveItemTag}
            availableUserTags={allAvailableUserTags}
            availableSteamTags={allAvailableSteamTags}
            sidebarWidth={rightWidth}
            tagPathMap={tagPathMap}
            tagFullPathMap={tagFullPathMap}
            reverseTagPathMap={reverseTagPathMap}
            viewMode={viewMode}
            setViewMode={handleSetViewMode}
            cardSize={cardSize}
            setCardSize={handleSetCardSize}
            onExportTags={handleExportTags}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            sidebarMode={rightSidebarMode}
            onModeChange={handleRightModeChange}
            collections={collections}
            onBulkAddToCollection={handleBulkAddToCollection}
            onBulkRemoveFromCollection={handleBulkRemoveFromCollection}
            onCreateCollectionFromSelection={handleCreateCollectionFromSelection}
            selectedTags={selectedTags}
            selectedUserTags={selectedUserTags}
            onToggleTag={handleToggleTag}
            onToggleUserTag={handleToggleUserTag}
            selectedCollectionId={selectedCollectionId}
            onSelectCollection={setSelectedCollectionId}
            inGameFolders={inGameFoldersData.folders}
            itemToInGameFolder={inGameFoldersData.item_to_folder}
            itemToInGameFolders={inGameFoldersData.item_to_folders}
            onAssignInGameFolder={handleAssignInGameFolder}
            onRemoveFromInGameFolder={handleRemoveFromInGameFolder}
            onCreateFolderFromSelection={handleCreateInGameFolderFromSelection}
            foldersMode={foldersMode}
            isGameRunning={inGameFoldersData.game_running}
            savePathExists={inGameFoldersData.exists}
          />
        </div>

      </div>

      {/* Detail Modal */}
      {detailItem && (
        <ErrorBoundary onReset={() => setDetailItem(null)}>
          <ItemDetailModal
            item={detailItem}
            onClose={() => setDetailItem(null)}
            initialSidebarMode={leftSidebarMode}
            collections={collections}
            onAddToCollection={handleItemAddToCollection}
            onRemoveFromCollection={handleItemRemoveFromCollection}
            onCreateCollectionWithItem={handleCreateCollectionWithItem}
            onUpdateItemUserTags={handleUpdateItemUserTags}
            allAvailableUserTags={allAvailableUserTags}
            allAvailableSteamTags={allAvailableSteamTags}
            onToggleFavorite={handleToggleFavorite}
            onUpdateSteamTags={handleUpdateItemSteamTags}
            onClearItemTags={handleClearItemTags}
            onResetItemTags={handleResetItemTags}
            onToggleDisabled={handleToggleItemDisabled}
            onToggleSubscription={handleToggleItemSubscription}
            onToggleSorted={handleToggleItemSorted}
            selectedSteamTags={selectedTags}
            selectedUserTags={selectedUserTags}
            tagPathMap={tagPathMap}
            tagFullPathMap={tagFullPathMap}
            reverseTagPathMap={reverseTagPathMap}
            onNavigatePrev={() => handleNavigateDetail(-1)}
            onNavigateNext={() => handleNavigateDetail(1)}
            hasNavigation={filteredItems.length > 0 && (filteredItems.length > 1 || currentDetailIndex === -1)}
            currentIndex={currentDetailIndex !== -1 ? currentDetailIndex : Math.min(lastKnownDetailIndexRef.current, Math.max(0, filteredItems.length - 1))}
            totalCount={filteredItems.length}
          />
        </ErrorBoundary>
      )}

      {/* Mod Action Plan Modal */}
      {isPlanModalOpen && (
        <ActionPlanModal
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
          onClearPlan={handleClearPlan}
          onExecutePlan={handleExecutePlan}
          isExecuting={isExecutingPlan}
          pendingActions={pendingActions}
          items={items}
          onRemoveFromPlan={handleRemoveFromPlan}
          steamMode={steamMode}
          steamStatus={steamStatus}
          tagStructure={tagStructure}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        showControlHints={showControlHints}
        onToggleShowControlHints={handleToggleShowControlHints}
        steamStatus={steamStatus}
        steamMode={steamMode}
        onSetSteamMode={handleSetSteamMode}
        onRestartSteam={handleRestartSteam}
        isRestartingSteam={isRestartingSteam}
        onZoomChange={(newZoom) => saveBackendSettings({ ui_zoom: newZoom })}
        onFullSync={handleFullSync}
        onQuickSync={handleScan}
        isScanning={isScanning}
        onOpenClassifierRules={() => {
          setIsSettingsOpen(false);
          setIsClassifierRulesOpen(true);
        }}
        stormworksSavePath={stormworksSavePath}
        onSaveStormworksSavePath={handleSaveStormworksSavePath}
        ingameFoldersStatus={inGameFoldersData}
        foldersMode={foldersMode}
        onSetFoldersMode={handleSetFoldersMode}
        onOpenUpdateModal={(data) => {
          setIsSettingsOpen(false);
          setUpdateModalData(data);
        }}
      />

      {/* Software Update Modal */}
      {updateModalData && (
        <UpdateModal
          isOpen={Boolean(updateModalData)}
          onClose={() => setUpdateModalData(null)}
          updateData={updateModalData}
          onDone={() => setUpdateModalData(null)}
        />
      )}

      {/* Classifier Rules & Synonyms Modal */}
      {isClassifierRulesOpen && (
        <ClassifierRulesModal
          isOpen={isClassifierRulesOpen}
          onClose={() => setIsClassifierRulesOpen(false)}
          tagStructure={tagStructure}
        />
      )}

      {/* Import Tags Modal */}
      <ImportTagsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        allUniqueSteamTags={allUniqueSteamTags}
      />

      {/* Import Collection Modal */}
      <ImportCollectionModal
        isOpen={isImportCollectionModalOpen}
        onClose={() => setIsImportCollectionModalOpen(false)}
        onSuccess={async () => {
          await loadData();
          handleLeftModeChange('collections');
        }}
      />

      {/* Mod Context Menu */}
      {modContextMenu && (
        <ContextMenu
          x={modContextMenu.x}
          y={modContextMenu.y}
          items={modContextMenuItems}
          onClose={() => setModContextMenu(null)}
        />
      )}

      {/* Global Input Context Menu */}
      {inputContextMenu && (
        <ContextMenu
          x={inputContextMenu.x}
          y={inputContextMenu.y}
          items={inputContextMenu.items}
          onClose={() => setInputContextMenu(null)}
        />
      )}
    </div>
  );
}

export default App;
