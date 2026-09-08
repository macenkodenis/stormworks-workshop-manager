import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { TagsSidebar } from './components/TagsSidebar';
import { RightActionSidebar } from './components/RightActionSidebar';
import { ItemCard } from './components/ItemCard';
import { ItemRow } from './components/ItemRow';
import { ActionPlanModal } from './components/ActionPlanModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { ControlsHintOverlay } from './components/ControlsHintOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import { buildTagPathMap } from './utils/tagUtils';

export function App() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Search and Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('size');
  const [sortDir, setSortDir] = useState('desc');

  // Card Size: 1 = S, 2 = M, 3 = L
  const [cardSize, setCardSize] = useState(() => {
    const saved = localStorage.getItem('sw_card_size');
    return saved ? Number(saved) : 2;
  });

  const handleSetCardSize = (size) => {
    setCardSize(size);
    localStorage.setItem('sw_card_size', String(size));
  };

  // View Mode: 'grid' (Tiles) or 'list' (Horizontal Rows)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('sw_view_mode') || 'grid';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('sw_view_mode', mode);
  };

  // Show/Hide Floating Control Hints Overlay
  const [showControlHints, setShowControlHints] = useState(() => {
    const saved = localStorage.getItem('sw_show_control_hints');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleShowControlHints = (val) => {
    setShowControlHints(val);
    localStorage.setItem('sw_show_control_hints', String(val));
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
  const mainRef = useRef(null);

  const handleLeftResizeStart = (e) => {
    e.preventDefault();
    isResizingLeftRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = leftWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleRightResizeStart = (e) => {
    e.preventDefault();
    isResizingRightRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeftRef.current) {
        const delta = e.clientX - startXRef.current;
        const newWidth = Math.min(Math.max(startWidthRef.current + delta, 200), 500);
        setLeftWidth(newWidth);
        localStorage.setItem('sw_left_width', String(newWidth));
      } else if (isResizingRightRef.current) {
        const delta = startXRef.current - e.clientX;
        const newWidth = Math.min(Math.max(startWidthRef.current + delta, 220), 500);
        setRightWidth(newWidth);
        localStorage.setItem('sw_right_width', String(newWidth));
      }
    };

    const handleMouseUp = () => {
      if (isResizingLeftRef.current || isResizingRightRef.current) {
        isResizingLeftRef.current = false;
        isResizingRightRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [leftWidth, rightWidth]);

  // Dynamic Sticky Sidebar geometry: dynamically anchors sidebar bottom to the screen bottom across all zoom levels
  const [stickySidebarStyle, setStickySidebarStyle] = useState({
    top: '4.25rem',
    height: 'calc(100vh - 5rem)'
  });

  const updateSidebarGeometry = useCallback(() => {
    const zoomStr = document.documentElement.style.zoom;
    let z = 1;
    if (zoomStr) {
      const parsed = parseFloat(zoomStr);
      if (!isNaN(parsed) && parsed > 0) {
        z = zoomStr.endsWith('%') ? parsed / 100 : parsed;
      }
    }

    const header = document.querySelector('header');
    const headerBottomVisual = header ? header.getBoundingClientRect().bottom : (53 * z);
    const cssHeaderBottom = headerBottomVisual / z;
    const cssTop = cssHeaderBottom + 12; // 12px gap below header (py-3)
    const cssViewportH = window.innerHeight / z;
    // Keep 12px padding above bottom of screen (scaled proportionally in CSS pixels)
    const cssHeight = Math.max(cssViewportH - cssTop - 12, 200);

    setStickySidebarStyle({
      top: `${cssTop}px`,
      height: `${cssHeight}px`
    });
  }, []);

  // Initialize saved zoom and observe changes to window size, zoom and header dimensions
  useEffect(() => {
    const savedZoom = localStorage.getItem('sw_ui_zoom');
    if (savedZoom) {
      document.documentElement.style.zoom = `${savedZoom}%`;
    }

    updateSidebarGeometry();

    window.addEventListener('resize', updateSidebarGeometry);

    const mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'style') {
          updateSidebarGeometry();
        }
      }
    });

    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    });

    let headerObserver = null;
    const headerEl = document.querySelector('header');
    if (headerEl && window.ResizeObserver) {
      headerObserver = new ResizeObserver(() => {
        updateSidebarGeometry();
      });
      headerObserver.observe(headerEl);
    }

    return () => {
      window.removeEventListener('resize', updateSidebarGeometry);
      mutationObserver.disconnect();
      if (headerObserver) headerObserver.disconnect();
    };
  }, [updateSidebarGeometry]);

  // Tag Filtering (Steam tags)
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [tagMode, setTagMode] = useState('AND');

  // System Filters: { status: 'subscribed' | 'unsubscribed' | null, sort: 'sorted' | 'unsorted' | null, connection: 'enabled' | 'disabled' | null }
  const [systemFilter, setSystemFilter] = useState({ status: null, sort: null, connection: null });

  // Custom User Tags: Set of selected user tag names
  const [selectedUserTags, setSelectedUserTags] = useState(new Set());
  // Persistent pool of custom user tags created by user (even with 0 items)
  const [extraUserTags, setExtraUserTags] = useState(new Set());

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [anchorId, setAnchorId] = useState(null);
  const [anchorIndex, setAnchorIndex] = useState(null);

  // Modal states
  const [pendingActions, setPendingActions] = useState({}); // { [itemId]: 'disable' | 'enable' | 'unsubscribe' | 'subscribe' }
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isExecutingPlan, setIsExecutingPlan] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Steam Integration State
  const [steamMode, setSteamMode] = useState(() => localStorage.getItem('sw_steam_mode') || 'hybrid');
  const [steamStatus, setSteamStatus] = useState(null);
  const [isRestartingSteam, setIsRestartingSteam] = useState(false);

  const handleSetSteamMode = (mode) => {
    setSteamMode(mode);
    localStorage.setItem('sw_steam_mode', mode);
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
      const [statusRes, itemsRes, customTagsRes] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/items?sort_by=size&sort_dir=desc').then(r => r.json()),
        fetch('/api/custom-user-tags').then(r => r.json()).catch(() => ({ tags: [] }))
      ]);
      setStatus(statusRes);
      setItems(itemsRes.items || []);
      if (customTagsRes && Array.isArray(customTagsRes.tags)) {
        setExtraUserTags(new Set(customTagsRes.tags));
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Refresh / Rescan
  const handleRefresh = async () => {
    setIsScanning(true);
    try {
      await fetch('/api/scan', { method: 'POST' });
      const poll = setInterval(async () => {
        const s = await fetch('/api/status').then(r => r.json());
        setStatus(s);
        if (!s.scan_state?.is_scanning) {
          clearInterval(poll);
          setIsScanning(false);
          const itemsRes = await fetch(`/api/items?sort_by=${sortBy}&sort_dir=${sortDir}`).then(r => r.json());
          setItems(itemsRes.items || []);
        }
      }, 1500);
    } catch (err) {
      console.error('Scan trigger failed:', err);
      setIsScanning(false);
    }
  };

  // Re-fetch items when backend sorting changes
  useEffect(() => {
    fetch(`/api/items?sort_by=${sortBy}&sort_dir=${sortDir}`)
      .then(r => r.json())
      .then(res => setItems(res.items || []))
      .catch(console.error);
  }, [sortBy, sortDir]);

  // Tag Structure state for hierarchical folders
  const [tagStructure, setTagStructure] = useState([]);

  useEffect(() => {
    fetch('/api/tag-structure')
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.structure)) {
          setTagStructure(data.structure);
        }
      })
      .catch(err => console.warn('Failed to load tag structure in App:', err));
  }, []);

  const { tagPathMap, reverseTagPathMap } = useMemo(() => {
    return buildTagPathMap(tagStructure);
  }, [tagStructure]);

  // Search filtered base pool
  const searchFilteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter(it => {
      const titleMatch = it.title?.toLowerCase().includes(q);
      const idMatch = it.published_file_id.includes(q);
      const creatorMatch = it.creator?.includes(q);
      const descMatch = it.description?.toLowerCase().includes(q);
      const tagsMatch = (it.tags || []).some(t => {
        const path = tagPathMap ? (tagPathMap.get(`steam:${t}`) || tagPathMap.get(t) || '') : '';
        return t.toLowerCase().includes(q) || path.toLowerCase().includes(q);
      });
      const userTagsMatch = (it.user_tags || []).some(t => {
        const path = tagPathMap ? (tagPathMap.get(`user:${t}`) || tagPathMap.get(t) || '') : '';
        return t.toLowerCase().includes(q) || path.toLowerCase().includes(q);
      });
      return titleMatch || idMatch || creatorMatch || descMatch || tagsMatch || userTagsMatch;
    });
  }, [items, searchQuery, tagPathMap]);

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

    searchFilteredItems.forEach(it => {
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

      const isItemSorted = it.is_sorted !== undefined ? it.is_sorted : (it.user_tags && it.user_tags.length > 0);
      if (isItemSorted) {
        sorted++;
      } else {
        unsorted++;
      }

      if (it.is_favorited) {
        favorited++;
      }
    });

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

  // Dynamic counts for STEAM tags (excluding deactivated tags for each item)
  const steamTagsWithCounts = useMemo(() => {
    const selectedArr = Array.from(selectedTags);
    const hasSelection = selectedArr.length > 0;

    const getActiveSteamTags = (it) => {
      const deactivated = new Set(it.deactivated_steam_tags || []);
      return (it.tags || []).filter(t => !deactivated.has(t));
    };

    return allUniqueSteamTags.map(tag => {
      let count = 0;
      if (!hasSelection) {
        count = searchFilteredItems.filter(it => getActiveSteamTags(it).includes(tag)).length;
      } else if (tagMode === 'AND') {
        if (selectedTags.has(tag)) {
          count = searchFilteredItems.filter(it => {
            const itemTags = getActiveSteamTags(it);
            return selectedArr.every(t => itemTags.includes(t));
          }).length;
        } else {
          const testGroup = [...selectedArr, tag];
          count = searchFilteredItems.filter(it => {
            const itemTags = getActiveSteamTags(it);
            return testGroup.every(t => itemTags.includes(t));
          }).length;
        }
      } else {
        count = searchFilteredItems.filter(it => getActiveSteamTags(it).includes(tag)).length;
      }
      return { tag, count };
    });
  }, [allUniqueSteamTags, searchFilteredItems, selectedTags, tagMode]);

  // Extract all USER custom tags and their dynamic counts in stable order
  const userTagsWithCounts = useMemo(() => {
    const userTagCounts = new Map();
    // Include all explicitly created user tags
    extraUserTags.forEach(t => {
      userTagCounts.set(t, 0);
    });

    items.forEach(it => {
      (it.user_tags || []).forEach(t => {
        if (!userTagCounts.has(t)) userTagCounts.set(t, 0);
      });
    });

    // Count appearances in current searchFilteredItems
    userTagCounts.forEach((_, tag) => {
      const count = searchFilteredItems.filter(it => (it.user_tags || []).includes(tag)).length;
      userTagCounts.set(tag, count);
    });

    return Array.from(userTagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }, [items, searchFilteredItems, extraUserTags]);

  const allAvailableUserTags = useMemo(() => {
    return userTagsWithCounts.map(u => u.tag);
  }, [userTagsWithCounts]);

  // Toggle Steam tag selection
  const handleToggleTag = (tag) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  // Toggle User tag selection
  const handleToggleUserTag = (tag) => {
    setSelectedUserTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  // Batch set Steam and User tags (from group or range selections)
  const handleBatchSetTags = (steamTagsToSelect, userTagsToSelect, mode = 'set') => {
    // mode: 'set' (replace selection with provided), 'toggle' (toggle these tags), 'add' (add these tags), 'remove' (remove these tags)
    if (mode === 'set') {
      setSelectedTags(new Set(steamTagsToSelect));
      setSelectedUserTags(new Set(userTagsToSelect));
    } else if (mode === 'add') {
      setSelectedTags(prev => {
        const next = new Set(prev);
        steamTagsToSelect.forEach(t => next.add(t));
        return next;
      });
      setSelectedUserTags(prev => {
        const next = new Set(prev);
        userTagsToSelect.forEach(t => next.add(t));
        return next;
      });
    } else if (mode === 'remove') {
      setSelectedTags(prev => {
        const next = new Set(prev);
        steamTagsToSelect.forEach(t => next.delete(t));
        return next;
      });
      setSelectedUserTags(prev => {
        const next = new Set(prev);
        userTagsToSelect.forEach(t => next.delete(t));
        return next;
      });
    }
  };

  const handleClearAllFilters = () => {
    setSelectedTags(new Set());
    setSelectedUserTags(new Set());
    setSystemFilter({ status: null, sort: null, favorite: null });
  };

  // Toggle favorite on backend and local state
  const handleToggleFavorite = async (itemId) => {
    const currentItem = items.find(it => it.published_file_id === itemId);
    const nextVal = currentItem ? !currentItem.is_favorited : true;

    // Optimistic update
    setItems(prev => prev.map(it => {
      if (it.published_file_id === itemId) {
        return { ...it, is_favorited: nextVal };
      }
      return it;
    }));

    if (detailItem && detailItem.published_file_id === itemId) {
      setDetailItem(prev => (prev ? { ...prev, is_favorited: nextVal } : prev));
    }

    try {
      await fetch(`/api/items/${itemId}/favorited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorited: nextVal })
      });
    } catch (err) {
      console.error('Failed to update favorite status:', err);
    }
  };

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
    try {
      await fetch(`/api/items/${itemId}/user-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      });
      // Update local state
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
      if (detailItem && detailItem.published_file_id === itemId) {
        setDetailItem(prev => (prev ? {
          ...prev,
          user_tags: tags,
          is_sorted: true
        } : prev));
      }
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

  // Clear all tags for a single item (deactivates steam tags, deletes user tags, unsorted)
  const handleClearItemTags = async (itemId) => {
    try {
      await fetch(`/api/items/${itemId}/clear-tags`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to clear item tags:', err);
    }
    setItems(prev => prev.map(it => {
      if (it.published_file_id === itemId) {
        const allTags = Array.isArray(it.tags) ? it.tags : [];
        return {
          ...it,
          user_tags: [],
          deactivated_steam_tags: [...allTags],
          is_sorted: false
        };
      }
      return it;
    }));
    if (detailItem && detailItem.published_file_id === itemId) {
      setDetailItem(prev => {
        if (!prev) return prev;
        const allTags = Array.isArray(prev.tags) ? prev.tags : [];
        return {
          ...prev,
          user_tags: [],
          deactivated_steam_tags: [...allTags],
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
        const allTags = Array.isArray(it.tags) ? it.tags : [];
        return {
          ...it,
          user_tags: [],
          deactivated_steam_tags: [...allTags],
          is_sorted: false
        };
      }
      return it;
    }));
    if (detailItem && selectedIds.has(detailItem.published_file_id)) {
      setDetailItem(prev => {
        if (!prev) return prev;
        const allTags = Array.isArray(prev.tags) ? prev.tags : [];
        return {
          ...prev,
          user_tags: [],
          deactivated_steam_tags: [...allTags],
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

  const handleRemoveFromPlan = (itemId) => {
    setPendingActions(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleClearPlan = () => {
    setPendingActions({});
    setIsPlanModalOpen(false);
  };

  const handleExecutePlan = async () => {
    const planEntries = Object.entries(pendingActions);
    if (!planEntries.length) return;

    setIsExecutingPlan(true);
    try {
      const toDisable = [];
      const toEnable = [];
      const toUnsubscribe = [];
      const toSubscribe = [];

      planEntries.forEach(([id, action]) => {
        if (action === 'disable') toDisable.push(id);
        else if (action === 'enable') toEnable.push(id);
        else if (action === 'unsubscribe') toUnsubscribe.push(id);
        else if (action === 'subscribe') toSubscribe.push(id);
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

        if (disableSet.has(id)) is_disabled = true;
        if (enableSet.has(id)) is_disabled = false;
        if (unsubSet.has(id)) {
          is_unsubscribed = true;
          is_disabled = true;
        }
        if (subSet.has(id)) is_unsubscribed = false;

        if (is_disabled !== it.is_disabled || is_unsubscribed !== it.is_unsubscribed) {
          return { ...it, is_disabled, is_unsubscribed };
        }
        return it;
      }));

      // Update detailItem if it was involved
      if (detailItem && pendingActions[detailItem.published_file_id]) {
        const id = detailItem.published_file_id;
        setDetailItem(prev => {
          if (!prev) return prev;
          let is_disabled = prev.is_disabled;
          let is_unsubscribed = prev.is_unsubscribed;
          if (disableSet.has(id)) is_disabled = true;
          if (enableSet.has(id)) is_disabled = false;
          if (unsubSet.has(id)) {
            is_unsubscribed = true;
            is_disabled = true;
          }
          if (subSet.has(id)) is_unsubscribed = false;
          return { ...prev, is_disabled, is_unsubscribed };
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

  // Final Filtered Items for Main Cards Grid
  const filteredItems = useMemo(() => {
    const selectedSteamTagsArray = Array.from(selectedTags);
    const selectedUserTagsArray = Array.from(selectedUserTags);

    return searchFilteredItems.filter(it => {
      // 1. System Status Filter (Subscribed / Unsubscribed)
      if (systemFilter.status === 'subscribed' && it.is_unsubscribed) return false;
      if (systemFilter.status === 'unsubscribed' && !it.is_unsubscribed) return false;

      // 1b. Connection Filter (Enabled / Disabled)
      if (systemFilter.connection === 'enabled' && it.is_disabled) return false;
      if (systemFilter.connection === 'disabled' && !it.is_disabled) return false;

      // 2. System Sort Filter (Sorted / Unsorted)
      const isSorted = it.is_sorted !== undefined ? it.is_sorted : ((it.user_tags || []).length > 0);
      if (systemFilter.sort === 'sorted' && !isSorted) return false;
      if (systemFilter.sort === 'unsorted' && isSorted) return false;

      // 3. System Favorite Filter
      if (systemFilter.favorite && !it.is_favorited) return false;

      // 4. Steam Tags Filter (AND / OR) - ONLY ACTIVE STEAM TAGS PARTICIPATE
      if (selectedSteamTagsArray.length > 0) {
        const deactivated = new Set(it.deactivated_steam_tags || []);
        const activeSteamTags = (it.tags || []).filter(t => !deactivated.has(t));
        if (tagMode === 'AND') {
          if (!selectedSteamTagsArray.every(tag => activeSteamTags.includes(tag))) return false;
        } else {
          if (!selectedSteamTagsArray.some(tag => activeSteamTags.includes(tag))) return false;
        }
      }

      // 5. User Custom Tags Filter (AND / OR)
      if (selectedUserTagsArray.length > 0) {
        const itemUserTags = it.user_tags || [];
        if (tagMode === 'AND') {
          if (!selectedUserTagsArray.every(tag => itemUserTags.includes(tag))) return false;
        } else {
          if (!selectedUserTagsArray.some(tag => itemUserTags.includes(tag))) return false;
        }
      }

      return true;
    });
  }, [searchFilteredItems, systemFilter, selectedTags, selectedUserTags, tagMode]);

  // Selection handlers
  const handleItemClick = (e, item, index) => {
    const id = item.published_file_id;

    if (e.shiftKey && anchorIndex !== null) {
      const start = Math.min(anchorIndex, index);
      const end = Math.max(anchorIndex, index);
      const rangeIds = filteredItems.slice(start, end + 1).map(it => it.published_file_id);

      setSelectedIds(prev => {
        const next = new Set(prev);
        rangeIds.forEach(rangeId => next.add(rangeId));
        return next;
      });
      setAnchorId(id);
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          if (anchorId === id) setAnchorId(null);
        } else {
          next.add(id);
          setAnchorId(id);
        }
        return next;
      });
      setAnchorIndex(index);
    } else {
      if (selectedIds.has(id) && selectedIds.size === 1) {
        setSelectedIds(new Set());
        setAnchorId(null);
        setAnchorIndex(null);
      } else {
        setSelectedIds(new Set([id]));
        setAnchorId(id);
        setAnchorIndex(index);
      }
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredItems.map(i => i.published_file_id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setAnchorId(null);
    setAnchorIndex(null);
  };

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

  // Grid column class according to viewMode & cardSize, with responsive scale for wide viewports
  const gridClass = useMemo(() => {
    if (viewMode === 'list') {
      if (cardSize === 1) {
        // S: multiple mods per row, narrow horizontal cards
        return 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 4xl:grid-cols-4 gap-2.5';
      }
      if (cardSize === 2) {
        // M: multiple mods per row, wide horizontal cards
        return 'grid-cols-1 xl:grid-cols-2 gap-2.5';
      }
      // L: 1 mod per row (full width)
      return 'grid-cols-1 gap-2.5';
    }

    if (cardSize === 1) {
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-9 gap-3';
    }
    if (cardSize === 3) {
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-5';
    }
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 gap-4';
  }, [cardSize, viewMode]);

  // Mod index in current filtered list for modal navigation
  const currentDetailIndex = useMemo(() => {
    if (!detailItem) return -1;
    return filteredItems.findIndex(it => it.published_file_id === detailItem.published_file_id);
  }, [detailItem, filteredItems]);

  const handleNavigateDetail = (direction) => {
    if (currentDetailIndex === -1 || filteredItems.length <= 1) return;
    let nextIndex = currentDetailIndex + direction;
    if (nextIndex < 0) nextIndex = filteredItems.length - 1;
    if (nextIndex >= filteredItems.length) nextIndex = 0;
    setDetailItem(filteredItems[nextIndex]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e141b] flex flex-col items-center justify-center text-[#66c0f4]">
        <Loader2 className="w-10 h-10 animate-spin mb-3" />
        <span className="text-sm font-medium">Завантаження каталогу Stormworks Workshop...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e141b] flex flex-col w-full">
      
      {/* Unified Top Header Bar */}
      <Header
        status={status}
        onRefresh={handleRefresh}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isScanning={isScanning}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortDir={sortDir}
        setSortDir={setSortDir}
        cardSize={cardSize}
        setCardSize={handleSetCardSize}
        viewMode={viewMode}
        setViewMode={handleSetViewMode}
        totalItems={items.length}
        filteredCount={filteredItems.length}
      />

      {/* Main 3-column Layout (Edge-to-Edge full width) */}
      <div className="w-full max-w-none px-3 sm:px-5 lg:px-6 py-3 flex-1 flex items-start">
        
        {/* Left Column: Tags Sidebar with dynamic width */}
        <div style={{ width: `${leftWidth}px`, ...stickySidebarStyle }} className="shrink-0 sticky transition-[top,height] duration-75">
          <TagsSidebar
            steamTagsWithCounts={steamTagsWithCounts}
            selectedTags={selectedTags}
            onToggleTag={handleToggleTag}
            onClearTags={handleClearAllFilters}
            tagMode={tagMode}
            setTagMode={setTagMode}
            systemFilter={systemFilter}
            setSystemFilter={setSystemFilter}
            systemCounts={systemCounts}
            userTagsWithCounts={userTagsWithCounts}
            selectedUserTags={selectedUserTags}
            onToggleUserTag={handleToggleUserTag}
            onCreateUserTag={handleCreateUserTag}
            onDeleteUserTag={handleDeleteUserTag}
            onBatchSetTags={handleBatchSetTags}
            onTagStructureChange={setTagStructure}
          />
        </div>

        {/* Left Resizer Drag Handle */}
        <div
          onMouseDown={handleLeftResizeStart}
          style={stickySidebarStyle}
          className="w-3.5 sticky cursor-col-resize flex items-center justify-center group shrink-0 select-none z-10 transition-[top,height] duration-75"
          title="Перетягніть для зміни ширини панелі тегів"
        >
          <div className="w-1 h-12 rounded-full bg-[#202e3e] group-hover:bg-[#66c0f4] group-active:bg-[#66c0f4] transition" />
        </div>

        {/* Center Column: Direct Items Grid / List */}
        <main ref={mainRef} className="flex-1 min-w-0 px-2 relative">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-[#171d25] rounded-xl border border-[#233547]">
              <p className="text-[#8f98a0] text-sm">Жодного моду не знайдено за заданими критеріями фільтрації.</p>
              {(searchQuery || selectedTags.size > 0 || selectedUserTags.size > 0 || systemFilter.status || systemFilter.sort || systemFilter.favorite || systemFilter.connection) && (
                <button
                  onClick={() => { setSearchQuery(''); handleClearAllFilters(); }}
                  className="mt-3 text-xs text-[#66c0f4] hover:underline"
                >
                  Скинути всі фільтри та теги
                </button>
              )}
            </div>
          ) : (
            <div className={`grid ${gridClass}`}>
              {filteredItems.map((item, index) => {
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
                      onOpenDetail={(it) => setDetailItem(it)}
                      onToggleFavorite={handleToggleFavorite}
                      pendingAction={pendingActions[item.published_file_id] || null}
                      onRemovePendingAction={handleRemoveFromPlan}
                      tagPathMap={tagPathMap}
                      cardSize={cardSize}
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
                    onOpenDetail={(it) => setDetailItem(it)}
                    onToggleFavorite={handleToggleFavorite}
                    pendingAction={pendingActions[item.published_file_id] || null}
                    onRemovePendingAction={handleRemoveFromPlan}
                    tagPathMap={tagPathMap}
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
          style={stickySidebarStyle}
          className="w-3.5 sticky cursor-col-resize flex items-center justify-center group shrink-0 select-none z-10 transition-[top,height] duration-75"
          title="Перетягніть для зміни ширини панелі дій"
        >
          <div className="w-1 h-12 rounded-full bg-[#202e3e] group-hover:bg-[#66c0f4] group-active:bg-[#66c0f4] transition" />
        </div>

        {/* Right Column: Permanent Action & Selection Sidebar */}
        <div style={{ width: `${rightWidth}px`, ...stickySidebarStyle }} className="shrink-0 sticky transition-[top,height] duration-75">
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
            availableUserTags={allAvailableUserTags}
            availableSteamTags={allAvailableSteamTags}
            sidebarWidth={rightWidth}
            tagPathMap={tagPathMap}
            reverseTagPathMap={reverseTagPathMap}
          />
        </div>

      </div>

      {/* Detail Modal */}
      {detailItem && (
        <ErrorBoundary onReset={() => setDetailItem(null)}>
          <ItemDetailModal
            item={detailItem}
            onClose={() => setDetailItem(null)}
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
            reverseTagPathMap={reverseTagPathMap}
            onNavigatePrev={() => handleNavigateDetail(-1)}
            onNavigateNext={() => handleNavigateDetail(1)}
            hasNavigation={filteredItems.length > 1}
            currentIndex={currentDetailIndex}
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
      />
    </div>
  );
}

export default App;
