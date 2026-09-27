import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Tag,
  TagX,
  createLucideIcon,
  X,
  ChevronDown,
  ChevronRight,
  GitBranch,
  BookmarkCheck,
  Plus,
  Star,
  Trash2,
  Power,
  ChevronsUpDown,
  ChevronsDownUp,
  CornerUpLeft,
  Check,
  Folder,
  FolderOpen,
  Copy,
  Edit2,
  EyeOff,
  Eye
} from 'lucide-react';
import { migrateLegacyTree, deduplicateTagTree, isUserTagNode, transliterate, matchesTagSearch } from '../utils/tagUtils';
import { ContextMenu } from './ContextMenu';
import { copyToClipboard } from '../utils/clipboardUtils';
import { useI18n } from '../i18n/I18nContext';
import { TAG_TRANSLATIONS } from '../i18n/translations';

const TagCheck = createLucideIcon('TagCheck', [
  ['path', { d: 'm16.5 6.5-3.914-3.914A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.43 2.43 0 0 0 3.42 0l1.79-1.79', key: 'tc-body' }],
  ['path', { d: 'm16 13 2 2 4-4', key: 'tc-check' }],
  ['circle', { cx: '7.5', cy: '7.5', r: '.5', fill: 'currentColor', key: 'tc-dot' }]
]);

export function TagsSidebar({
  steamTagsWithCounts,
  selectedTags,
  excludedTags = new Set(),
  onToggleTag,
  onToggleExcludeTag,
  onClearTags,
  // System Filters
  systemFilter,
  setSystemFilter,
  systemCounts,
  // User/Custom Tags
  userTagsWithCounts,
  selectedUserTags,
  onToggleUserTag,
  onCreateUserTag,
  onRenameUserTag,
  onDeleteUserTag,
  onBatchSetTags,
  onTagStructureChange,
  sidebarWidth = 270,
  sidebarMode = 'tags',
  onModeChange,
  collectionsCount = 0,
  collections = [],
  selectedCollectionId = null,
  onSelectCollection
}) {
  const { t, tTag, lang, translateTags, updateTagTranslations, customTagTranslations } = useI18n();
  const [filterQuery, setFilterQuery] = useState('');
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagError, setTagError] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [hideEmptyTags, setHideEmptyTags] = useState(() => localStorage.getItem('hide_empty_tags') === 'true');

  useEffect(() => {
    localStorage.setItem('hide_empty_tags', String(hideEmptyTags));
  }, [hideEmptyTags]);

  // Tag tree state: array of nodes:
  // Node: { id, type: 'tag', tag: string, tagType: 'steam' | 'user', children?: Node[] }
  const [tree, setTree] = useState([]);
  const [collapsedTags, setCollapsedTags] = useState(new Set());

  // Selection Anchor for Shift+click range selection
  const [anchorKey, setAnchorKey] = useState(null);

  // Custom Tag Rename State
  const [editingTagNodeId, setEditingTagNodeId] = useState(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editTagError, setEditTagError] = useState('');

  // Tag Context Menu & Subtag Creation State
  const [tagContextMenu, setTagContextMenu] = useState(null); // { x, y, items }
  const [subtagParentId, setSubtagParentId] = useState(null);
  const [subtagInput, setSubtagInput] = useState('');
  const [subtagError, setSubtagError] = useState('');

  // Custom Pointer-based Drag and Drop state
  const [draggedNode, setDraggedNode] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { targetId, position: 'before' | 'inside' | 'after' }
  const [dragCursorPos, setDragCursorPos] = useState(null); // { x, y }
  const dropTargetRef = useRef(null);
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef(null);
  const pointerDownInfoRef = useRef(null);
  const lastActualDropTimeRef = useRef(0);
  const tagsScrollRef = useRef(null);

  // Global cleanup to guarantee drag state is reset on blur/unmount
  useEffect(() => {
    const handleWindowBlur = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        draggedNodeRef.current = null;
        dropTargetRef.current = null;
        pointerDownInfoRef.current = null;
        setDraggedNode(null);
        setDropTarget(null);
        setDragCursorPos(null);
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Helper to test if a tag is a game version tag
  const isVersionTag = (tagName) => {
    const trimmed = (tagName || '').trim().toLowerCase();
    return /^v?\d+(\.\d+)/i.test(trimmed);
  };

  // Split Steam tags into general and version groups
  const { generalSteamTags, versionTags } = useMemo(() => {
    const general = [];
    const versions = [];
    steamTagsWithCounts.forEach((item) => {
      if (isVersionTag(item.tag)) {
        versions.push(item);
      } else {
        general.push(item);
      }
    });
    return { generalSteamTags: general, versionTags: versions };
  }, [steamTagsWithCounts]);

  // Counts lookup maps
  const steamCountsMap = useMemo(() => {
    const m = new Map();
    steamTagsWithCounts.forEach(t => m.set(t.tag, t.count));
    return m;
  }, [steamTagsWithCounts]);

  const userCountsMap = useMemo(() => {
    const m = new Map();
    userTagsWithCounts.forEach(t => m.set(t.tag, t.count));
    return m;
  }, [userTagsWithCounts]);

  // Active Steam tags: All Steam tags that exist in the workshop items database.
  // When filtering by a tag, tags with 0 matches in the filtered subset must NOT disappear,
  // but display with count 0 (only Steam tags that never existed in the catalog are excluded).
  const activeSteamTagNames = useMemo(() => {
    return new Set(generalSteamTags.map(t => t.tag));
  }, [generalSteamTags]);

  // Save tree structure whenever it changes (after initial load)
  const saveTreeToBackend = useCallback((newTree) => {
    if (onTagStructureChange) {
      onTagStructureChange(newTree);
    }
    fetch('/api/tag-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structure: newTree })
    }).catch(err => console.warn('Failed to save tag structure:', err));
  }, [onTagStructureChange]);

  // Load tree structure from backend API on mount
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    fetch('/api/tag-structure')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.structure) && data.structure.length > 0) {
          const migrated = deduplicateTagTree(migrateLegacyTree(data.structure));
          setTree(migrated);
          if (onTagStructureChange) {
            onTagStructureChange(migrated);
          }
          const hadLegacyGroups = JSON.stringify(data.structure).includes('"type":"group"');
          const hadDuplicates = JSON.stringify(migrated) !== JSON.stringify(data.structure);
          if (hadLegacyGroups || hadDuplicates) {
            saveTreeToBackend(migrated);
          }
        }
        hasLoadedRef.current = true;
      })
      .catch(err => {
        console.warn('Failed to load tag structure:', err);
        hasLoadedRef.current = true;
      });
  }, [onTagStructureChange, saveTreeToBackend]);

  // Stable string keys for tag names so effect only runs when tag names are added or removed, NOT when item counts change
  const generalSteamNamesKey = useMemo(() => {
    return generalSteamTags.map(t => t.tag).join('\0');
  }, [generalSteamTags]);

  const userTagNamesKey = useMemo(() => {
    return userTagsWithCounts.map(t => t.tag).join('\0');
  }, [userTagsWithCounts]);

  // Set of all known Steam tags (for strict Steam priority)
  const allSteamTagsSet = useMemo(() => {
    const set = new Set();
    if (generalSteamNamesKey) {
      generalSteamNamesKey.split('\0').forEach(t => {
        if (t) set.add(t.trim().toLowerCase());
      });
    }
    return set;
  }, [generalSteamNamesKey]);

  // Synchronize tree with available tags (strictly prevents duplicate tag names with Steam priority)
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    setTree(prevTree => {
      const cleanTree = deduplicateTagTree(prevTree, allSteamTagsSet);

      const presentTagMap = new Map(); // tagNameLower -> node
      const collectTags = (nodes) => {
        nodes.forEach(node => {
          if (node.type === 'tag' && node.tag) {
            presentTagMap.set(String(node.tag).trim().toLowerCase(), node);
          }
          if (Array.isArray(node.children)) {
            collectTags(node.children);
          }
        });
      };
      collectTags(cleanTree);

      let treeModified = JSON.stringify(cleanTree) !== JSON.stringify(prevTree);

      // 1. Steam tags have absolute priority: Ensure any tag in allSteamTagsSet has tagType = 'steam'
      generalSteamTags.forEach(({ tag }) => {
        const key = String(tag).trim().toLowerCase();
        const existing = presentTagMap.get(key);
        if (existing) {
          if (existing.tagType !== 'steam') {
            existing.tagType = 'steam';
            treeModified = true;
          }
        } else {
          const newNode = {
            id: `tag-steam-${tag}`,
            type: 'tag',
            tag: tag,
            tagType: 'steam',
            children: []
          };
          cleanTree.push(newNode);
          presentTagMap.set(key, newNode);
          treeModified = true;
        }
      });

      // 2. User tags: ONLY create/keep as 'user' if it is NOT a Steam tag!
      userTagsWithCounts.forEach(({ tag }) => {
        if (!tag || tag.includes('/')) return;
        const key = String(tag).trim().toLowerCase();
        const isSteam = allSteamTagsSet.has(key);
        const existing = presentTagMap.get(key);
        if (existing) {
          if (isSteam && existing.tagType !== 'steam') {
            existing.tagType = 'steam';
            treeModified = true;
          } else if (!isSteam && existing.tagType !== 'user') {
            existing.tagType = 'user';
            treeModified = true;
          }
        } else {
          const newNode = {
            id: isSteam ? `tag-steam-${tag}` : `tag-user-${tag}`,
            type: 'tag',
            tag: tag,
            tagType: isSteam ? 'steam' : 'user',
            children: []
          };
          cleanTree.push(newNode);
          presentTagMap.set(key, newNode);
          treeModified = true;
        }
      });

      if (!treeModified) {
        return prevTree;
      }

      saveTreeToBackend(cleanTree);
      return cleanTree;
    });
  }, [generalSteamNamesKey, userTagNamesKey, allSteamTagsSet]);

  // Visibility check: Steam tags with 0 items are hidden from sidebar, but user tags with 0 remain; plus filterQuery search
  // If hideEmptyTags is active, any tag (Steam or User) with count === 0 is hidden unless it is selected, excluded, or has visible children
  const isNodeVisible = useCallback(function checkNodeVisible(node) {
    const q = filterQuery.trim().toLowerCase();
    const matchesText = !q || matchesTagSearch(node.tag, q, {
      customTranslations: customTagTranslations,
      systemTranslations: TAG_TRANSLATIONS
    });

    const isUser = isUserTagNode(node, allSteamTagsSet);
    const count = !isUser ? (steamCountsMap.get(node.tag) || 0) : (userCountsMap.get(node.tag) || 0);

    let isSelfActive = true;
    if (hideEmptyTags) {
      const isChecked = (selectedTags && selectedTags.has(node.tag)) || (selectedUserTags && selectedUserTags.has(node.tag));
      const isExcluded = excludedTags && excludedTags.has(node.tag);
      isSelfActive = count > 0 || isChecked || isExcluded;
    } else if (!isUser) {
      isSelfActive = activeSteamTagNames.has(node.tag);
    }
    const hasVisibleChildren = Array.isArray(node.children) && node.children.some(checkNodeVisible);
    return (matchesText && isSelfActive) || hasVisibleChildren;
  }, [filterQuery, customTagTranslations, activeSteamTagNames, allSteamTagsSet, hideEmptyTags, steamCountsMap, userCountsMap, selectedTags, selectedUserTags, excludedTags]);

  const getAllParentTagIds = (nodes) => {
    let ids = [];
    nodes.forEach(n => {
      if (Array.isArray(n.children) && n.children.length > 0) {
        ids.push(n.id);
        ids = ids.concat(getAllParentTagIds(n.children));
      }
    });
    return ids;
  };

  const handleExpandAll = () => {
    setCollapsedTags(new Set());
  };

  const handleCollapseAll = () => {
    setCollapsedTags(new Set(getAllParentTagIds(tree)));
  };

  const handleToggleTagCollapse = (e, tagId) => {
    e.stopPropagation();
    setCollapsedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  // Helper to extract all tags recursively inside a node
  const collectTagsFromNode = (node, res = { steam: [], user: [] }) => {
    if (isUserTagNode(node)) {
      res.user.push(node.tag);
    } else {
      res.steam.push(node.tag);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(child => collectTagsFromNode(child, res));
    }
    return res;
  };

  // Flatten currently visible and expanded tree nodes into sequential list for Shift+click range selection
  const visibleLinearItems = useMemo(() => {
    const list = [];
    const traverse = (nodes) => {
      nodes.forEach(node => {
        if (!isNodeVisible(node)) return;
        list.push(node);
        if (Array.isArray(node.children) && node.children.length > 0) {
          if (!collapsedTags.has(node.id)) {
            traverse(node.children);
          }
        }
      });
    };
    traverse(tree);
    return list;
  }, [tree, collapsedTags, isNodeVisible]);

  // Multi-selection range logic (Shift+click)
  const handleRangeSelect = (targetNode) => {
    if (!anchorKey) {
      handleSingleSelect(targetNode, false, true);
      return;
    }

    const anchorIndex = visibleLinearItems.findIndex(n => n.id === anchorKey);
    const targetIndex = visibleLinearItems.findIndex(n => n.id === targetNode.id);

    if (anchorIndex === -1 || targetIndex === -1) {
      handleSingleSelect(targetNode, false, true);
      return;
    }

    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    const slice = visibleLinearItems.slice(start, end + 1);

    const steamToAdd = [];
    const userToAdd = [];

    slice.forEach(node => {
      const { steam, user } = collectTagsFromNode(node);
      steamToAdd.push(...steam.filter(t => activeSteamTagNames.has(t)));
      userToAdd.push(...user);
    });

    if (onBatchSetTags) {
      onBatchSetTags(steamToAdd, userToAdd, 'add');
    }
  };

  // Node Selection Handler (Tag)
  const handleNodeClick = (e, node) => {
    // Only ignore synthetic click immediately after an actual drop operation
    if (Date.now() - lastActualDropTimeRef.current < 250) {
      return;
    }
    isDraggingRef.current = false;
    draggedNodeRef.current = null;

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isShift) {
      handleRangeSelect(node);
      return;
    }

    handleSingleSelect(node, isCtrl, true);
  };

  const handleSingleSelect = (node, isCtrl, setAsAnchor = true) => {
    if (setAsAnchor) {
      setAnchorKey(node.id);
    }
    if (onToggleTag) onToggleTag(node.tag, isCtrl);
    else if (onToggleUserTag) onToggleUserTag(node.tag, isCtrl);
  };

  // Delete a user tag node: removes from tree and invokes backend deletion across items
  const handleDeleteUserTagNode = (e, node) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (!isUserTagNode(node, allSteamTagsSet)) return;

    // Remove from tree, unnesting any children into parent level
    const removeAndUnpack = (nodes) => {
      const next = [];
      for (const n of nodes) {
        if (n.id === node.id || (n.type === 'tag' && isUserTagNode(n) && (n.tag || '').toLowerCase() === (node.tag || '').toLowerCase())) {
          if (Array.isArray(n.children) && n.children.length > 0) {
            next.push(...n.children);
          }
        } else {
          const cloneNode = { ...n };
          if (Array.isArray(n.children)) {
            cloneNode.children = removeAndUnpack(n.children);
          }
          next.push(cloneNode);
        }
      }
      return next;
    };

    const updatedTree = removeAndUnpack(tree);
    setTree(updatedTree);
    saveTreeToBackend(updatedTree);

    if (onDeleteUserTag) {
      onDeleteUserTag(node.tag);
    }
  };

  // Quick action: Unnest a child tag back to the root level
  const handleUnnestTag = (e, tagId) => {
    e.stopPropagation();
    let extracted = null;
    const removeNode = (nodes) => {
      const next = [];
      for (const n of nodes) {
        if (n.id === tagId) {
          extracted = n;
        } else {
          const cloneNode = { ...n };
          if (Array.isArray(n.children)) {
            cloneNode.children = removeNode(n.children);
          }
          next.push(cloneNode);
        }
      }
      return next;
    };

    const filtered = removeNode(tree);
    if (extracted) {
      const updated = [...filtered, extracted];
      setTree(updated);
      saveTreeToBackend(updated);
    }
  };

  // Move a nested tag one level up (to parent's level, placed right after parent)
  const handleMoveUpLevel = (nodeId) => {
    const findPath = (nodes, currentPath = []) => {
      for (const n of nodes) {
        const nextPath = [...currentPath, n];
        if (n.id === nodeId) return nextPath;
        if (Array.isArray(n.children)) {
          const res = findPath(n.children, nextPath);
          if (res) return res;
        }
      }
      return null;
    };

    const path = findPath(tree);
    if (!path || path.length < 2) return; // Already at root or not found

    const targetNode = path[path.length - 1];
    const parentNode = path[path.length - 2];

    // 1. Remove targetNode from parentNode's children
    const removeTarget = (nodes) => {
      const res = [];
      for (const n of nodes) {
        if (n.id === targetNode.id) continue;
        const clone = { ...n };
        if (Array.isArray(n.children)) {
          clone.children = removeTarget(n.children);
        }
        res.push(clone);
      }
      return res;
    };

    // 2. Insert targetNode right after parentNode
    const insertAfterParent = (nodes) => {
      const res = [];
      for (const n of nodes) {
        res.push(n);
        if (n.id === parentNode.id) {
          res.push(targetNode);
        }
        if (Array.isArray(n.children)) {
          n.children = insertAfterParent(n.children);
        }
      }
      return res;
    };

    const cleanedTree = removeTarget(tree);
    const updatedTree = insertAfterParent(cleanedTree);
    const deduplicated = deduplicateTagTree(updatedTree);
    setTree(deduplicated);
    saveTreeToBackend(deduplicated);
  };

  // Start inline subtag creation under a specific parent node
  const handleStartCreateSubtag = (node) => {
    setSubtagParentId(node.id);
    setSubtagInput('');
    setSubtagError('');
    // Expand node if collapsed so the subtag input and children are visible
    setCollapsedTags(prev => {
      const next = new Set(prev);
      next.delete(node.id);
      return next;
    });
  };

  // Save the newly created subtag
  const handleSaveSubtag = (e, parentNode) => {
    if (e) e.preventDefault();
    const tag = subtagInput.trim();
    if (!tag) return;

    const tagLower = tag.toLowerCase();
    // Validate duplicates
    if (steamTagsWithCounts.some(st => st.tag.trim().toLowerCase() === tagLower)) {
      setSubtagError(t('tags.errSteamDuplicate'));
      return;
    }
    if (userTagsWithCounts.some(ut => ut.tag.trim().toLowerCase() === tagLower)) {
      setSubtagError(t('tags.errUserDuplicate'));
      return;
    }

    const newNodeId = `tag-user-${tag}`;
    const newNode = {
      id: newNodeId,
      type: 'tag',
      tag: tag,
      tagType: 'user',
      children: []
    };

    const insertChild = (nodes) => {
      return nodes.map(n => {
        if (n.id === parentNode.id) {
          const currentChildren = Array.isArray(n.children) ? n.children : [];
          return { ...n, children: [...currentChildren, newNode] };
        }
        if (Array.isArray(n.children)) {
          return { ...n, children: insertChild(n.children) };
        }
        return n;
      });
    };

    const updated = deduplicateTagTree(insertChild(tree));
    setTree(updated);
    saveTreeToBackend(updated);

    onCreateUserTag(tag);
    setSubtagParentId(null);
    setSubtagInput('');
    setSubtagError('');
  };

  // Open right-click context menu on a tag node
  const handleTagContextMenu = (e, node, depth) => {
    e.preventDefault();
    e.stopPropagation();

    const isUser = isUserTagNode(node, allSteamTagsSet);
    const isChecked = selectedTags ? selectedTags.has(node.tag) : (selectedUserTags ? selectedUserTags.has(node.tag) : false);
    const isExcluded = excludedTags ? excludedTags.has(node.tag) : false;

    const items = [
      // 1. Додати до фільтру / Прибрати з фільтру
      {
        key: 'tag-filter',
        label: isChecked ? t('context.removeFromFilter') : t('context.addToFilter'),
        icon: isChecked ? TagX : Tag,
        iconClassName: isChecked ? 'text-[#ff6b6b]' : 'text-[#66c0f4]',
        onClick: () => {
          if (onToggleTag) onToggleTag(node.tag, true);
          else if (onToggleUserTag) onToggleUserTag(node.tag, true);
        }
      },
      // 1b. Сховати моди з цим тегом / Припинити приховування
      {
        key: 'tag-exclude',
        label: isExcluded ? t('context.unhideTag') : t('context.hideTag'),
        icon: isExcluded ? Eye : EyeOff,
        iconClassName: isExcluded ? 'text-[#a4d053]' : 'text-[#ff6b6b]',
        onClick: () => {
          if (onToggleExcludeTag) onToggleExcludeTag(node.tag);
        }
      },
      // 2. Створити підтег
      {
        key: 'tag-create-subtag',
        label: t('context.createSubtag'),
        icon: Plus,
        iconClassName: 'text-[#f49e42]',
        onClick: () => handleStartCreateSubtag(node)
      },
      // 3. Винести на рівень вище (якщо depth > 0)
      ...(depth > 0 ? [
        {
          key: 'tag-move-up',
          label: t('context.moveUp'),
          icon: CornerUpLeft,
          iconClassName: 'text-[#66c0f4]',
          onClick: () => handleMoveUpLevel(node.id)
        }
      ] : []),
      { divider: true },
      // 4. Копіювати назву тегу
      {
        key: 'tag-copy-name',
        label: t('context.copyName'),
        icon: Copy,
        onClick: () => copyToClipboard(node.tag)
      },
      // 5. Дії для користувацьких тегів: Перейменувати та Видалити
      ...(isUser ? [
        { divider: true },
        {
          key: 'tag-rename',
          label: t('context.rename'),
          icon: Edit2,
          iconClassName: 'text-gray-300',
          onClick: () => handleStartRename(null, node)
        },
        {
          key: 'tag-delete',
          label: t('context.delete'),
          icon: Trash2,
          danger: true,
          onClick: (ev) => handleDeleteUserTagNode(ev || null, node)
        }
      ] : [])
    ];

    setTagContextMenu({
      x: e.clientX,
      y: e.clientY,
      items
    });
  };

  // Check if target is descendant of candidate (prevent cyclic nesting)
  const isDescendant = (parentCandidate, targetId) => {
    if (!parentCandidate || !Array.isArray(parentCandidate.children)) return false;
    for (const child of parentCandidate.children) {
      if (child.id === targetId) return true;
      if (isDescendant(child, targetId)) return true;
    }
    return false;
  };


  // Custom User Tag Rename Handlers
  const handleStartRename = (e, node) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (e?.preventDefault) e.preventDefault();
    if (!isUserTagNode(node, allSteamTagsSet)) return;
    setEditingTagNodeId(node.id);
    setEditingTagName(node.tag);
    setEditTagError('');
  };

  const handleCancelRename = () => {
    setEditingTagNodeId(null);
    setEditingTagName('');
    setEditTagError('');
  };

  const handleSaveRename = async (node) => {
    const oldTag = node.tag;
    const newTag = (editingTagName || '').trim();

    if (!newTag) {
      setEditTagError(t('tags.errEmpty'));
      return;
    }

    if (newTag === oldTag) {
      handleCancelRename();
      return;
    }

    const newTagLower = newTag.toLowerCase();
    const oldTagLower = oldTag.toLowerCase();

    // Check collision with Steam tags
    const isSteamDuplicate = steamTagsWithCounts.some(
      st => st.tag.trim().toLowerCase() === newTagLower
    );
    if (isSteamDuplicate) {
      setEditTagError(t('tags.errSteamDuplicate'));
      return;
    }

    // Check collision with other user tags
    const isUserDuplicate = userTagsWithCounts.some(
      ut => ut.tag.trim().toLowerCase() === newTagLower && ut.tag.trim().toLowerCase() !== oldTagLower
    );
    if (isUserDuplicate) {
      setEditTagError(t('tags.errUserDuplicate'));
      return;
    }

    // 1. Rename in tree structure
    const renameInNodes = (nodes) => {
      return nodes.map(n => {
        let updatedNode = { ...n };
        if (n.id === node.id || (n.type === 'tag' && n.tag === oldTag)) {
          updatedNode.tag = newTag;
          if (updatedNode.id === `tag-user-${oldTag}`) {
            updatedNode.id = `tag-user-${newTag}`;
          }
        }
        if (Array.isArray(n.children)) {
          updatedNode.children = renameInNodes(n.children);
        }
        return updatedNode;
      });
    };

    const updatedTree = renameInNodes(tree);
    setTree(updatedTree);
    saveTreeToBackend(updatedTree);

    // 2. Call parent handler to update backend & items
    if (onRenameUserTag) {
      try {
        await onRenameUserTag(oldTag, newTag);
      } catch (err) {
        setEditTagError(err.message || t('tags.errSave'));
        return;
      }
    }

    handleCancelRename();
  };

  // Helper to reorder tree upon drop
  const applyTreeDrop = (sourceNode, targetNodeId, position) => {
    if (!sourceNode || sourceNode.id === targetNodeId) return;

    const clone = JSON.parse(JSON.stringify(tree));
    let extracted = null;

    const removeNode = (nodes) => {
      const next = [];
      for (const n of nodes) {
        if (n.id === sourceNode.id) {
          extracted = n;
        } else {
          const cloneNode = { ...n };
          if (Array.isArray(n.children)) {
            cloneNode.children = removeNode(n.children);
          }
          next.push(cloneNode);
        }
      }
      return next;
    };

    let updatedTree = removeNode(clone);
    if (!extracted) {
      extracted = sourceNode;
    }

    if (position === 'inside') {
      const insertIntoTag = (nodes) => {
        return nodes.map(n => {
          if (n.id === targetNodeId) {
            return {
              ...n,
              children: [...(n.children || []), extracted]
            };
          }
          if (Array.isArray(n.children)) {
            return { ...n, children: insertIntoTag(n.children) };
          }
          return n;
        });
      };
      updatedTree = insertIntoTag(updatedTree);
      setCollapsedTags(prev => {
        const next = new Set(prev);
        next.delete(targetNodeId);
        return next;
      });
    } else {
      const insertAdjacent = (nodes) => {
        const next = [];
        for (const n of nodes) {
          if (n.id === targetNodeId) {
            if (position === 'before') {
              next.push(extracted);
              next.push(n);
            } else {
              next.push(n);
              next.push(extracted);
            }
          } else {
            const cloneNode = { ...n };
            if (Array.isArray(n.children)) {
              cloneNode.children = insertAdjacent(n.children);
            }
            next.push(cloneNode);
          }
        }
        return next;
      };
      updatedTree = insertAdjacent(updatedTree);
    }

    setTree(updatedTree);
    saveTreeToBackend(updatedTree);
    lastActualDropTimeRef.current = Date.now();
  };

  // Custom Pointer-based Drag & Drop (Guarantees zero OS drag deadlocks in Qt WebEngine)
  const handleTagPointerDown = (e, node) => {
    if (e.button !== 0) return;
    if (editingTagNodeId === node.id) return;
    if (e.target.closest('button, input, a')) return;

    pointerDownInfoRef.current = {
      node,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      ctrlKey: e.ctrlKey || e.metaKey,
      shiftKey: e.shiftKey
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
  };

  const handleGlobalPointerMove = (e) => {
    const downInfo = pointerDownInfoRef.current;
    if (!downInfo) return;

    if (!isDraggingRef.current) {
      const dist = Math.hypot(e.clientX - downInfo.startX, e.clientY - downInfo.startY);
      if (dist < 6) return;
      isDraggingRef.current = true;
      draggedNodeRef.current = downInfo.node;
      setDraggedNode(downInfo.node);
    }

    // Update floating drag pill position
    setDragCursorPos({ x: e.clientX, y: e.clientY });

    // Edge auto-scroll on tags list container
    if (tagsScrollRef.current) {
      const container = tagsScrollRef.current;
      const rect = container.getBoundingClientRect();
      const edgeZone = 40;
      if (e.clientY >= rect.top && e.clientY <= rect.top + edgeZone) {
        const intensity = Math.min(1, Math.max(0.1, (rect.top + edgeZone - e.clientY) / edgeZone));
        container.scrollTop -= Math.ceil(intensity * 14);
      } else if (e.clientY <= rect.bottom && e.clientY >= rect.bottom - edgeZone) {
        const intensity = Math.min(1, Math.max(0.1, (e.clientY - (rect.bottom - edgeZone)) / edgeZone));
        container.scrollTop += Math.ceil(intensity * 14);
      }
    }

    // Identify target element under cursor using data-tag-id
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const targetRow = el ? el.closest('[data-tag-id]') : null;
    if (!targetRow) {
      if (dropTargetRef.current !== null) {
        dropTargetRef.current = null;
        setDropTarget(null);
      }
      return;
    }

    const targetId = targetRow.getAttribute('data-tag-id');
    const currentDragged = draggedNodeRef.current;
    if (!currentDragged || currentDragged.id === targetId || isDescendant(currentDragged, targetId)) {
      if (dropTargetRef.current !== null) {
        dropTargetRef.current = null;
        setDropTarget(null);
      }
      return;
    }

    const rect = targetRow.getBoundingClientRect();
    const clientY = e.clientY - rect.top;
    const height = rect.height;
    let position = 'inside';
    if (clientY < height * 0.28) position = 'before';
    else if (clientY > height * 0.72) position = 'after';
    else position = 'inside';

    if (dropTargetRef.current?.targetId === targetId && dropTargetRef.current?.position === position) {
      return;
    }

    const nextTarget = { targetId, position };
    dropTargetRef.current = nextTarget;
    setDropTarget(nextTarget);
  };

  const handleGlobalPointerUp = (_e) => {
    window.removeEventListener('pointermove', handleGlobalPointerMove);
    window.removeEventListener('pointerup', handleGlobalPointerUp);
    window.removeEventListener('pointercancel', handleGlobalPointerUp);

    const downInfo = pointerDownInfoRef.current;
    pointerDownInfoRef.current = null;

    if (isDraggingRef.current) {
      const activeDrop = dropTargetRef.current;
      const activeDragged = draggedNodeRef.current;

      isDraggingRef.current = false;
      draggedNodeRef.current = null;
      dropTargetRef.current = null;
      setDraggedNode(null);
      setDropTarget(null);
      setDragCursorPos(null);

      if (activeDrop && activeDragged && activeDrop.targetId !== activeDragged.id) {
        applyTreeDrop(activeDragged, activeDrop.targetId, activeDrop.position);
      }
    } else if (downInfo) {
      // Normal click selection
      handleNodeClick(
        {
          ctrlKey: downInfo.ctrlKey || _e?.ctrlKey || _e?.metaKey || false,
          metaKey: _e?.metaKey || false,
          shiftKey: downInfo.shiftKey || _e?.shiftKey || false
        },
        downInfo.node
      );
    }
  };

  const handleAddNewTag = (e) => {
    e.preventDefault();
    const rawInput = newTagInput.trim();
    if (!rawInput) return;

    // Transliterate into system identifier
    const systemTag = transliterate(rawInput);
    const systemLower = systemTag.toLowerCase();
    const rawLower = rawInput.toLowerCase();

    // 1. Check collision with existing Steam tags (general and version)
    const isSteamDuplicate = steamTagsWithCounts.some(st => {
      const stLower = st.tag.trim().toLowerCase();
      const transLower = (tTag(st.tag) || '').trim().toLowerCase();
      return stLower === systemLower || stLower === rawLower || transLower === rawLower;
    });
    if (isSteamDuplicate) {
      setTagError(t('tags.errSteamDuplicate'));
      return;
    }

    // 2. Check collision with existing user tags
    const isUserDuplicate = userTagsWithCounts.some(ut => {
      const utLower = ut.tag.trim().toLowerCase();
      const transLower = (tTag(ut.tag) || '').trim().toLowerCase();
      return utLower === systemLower || utLower === rawLower || transLower === rawLower;
    });
    if (isUserDuplicate) {
      setTagError(t('tags.errUserDuplicate'));
      return;
    }

    // Determine translation to save according to user rules:
    // If translateTags is ON -> save only for current UI language (lang)
    // If translateTags is OFF -> save only as English translation (en)
    const newTranslations = translateTags
      ? { [lang]: rawInput }
      : { en: rawInput };

    // Register translation dynamically in I18nContext
    if (updateTagTranslations) {
      updateTagTranslations(systemTag, newTranslations);
    }

    // Save translation to backend rules
    fetch('/api/classifier/tag-translation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: systemTag, translations: newTranslations })
    }).catch(err => console.warn('Failed to save tag translation on backend:', err));

    // Immediately add to tree if not present
    const nodeId = `tag-user-${systemTag}`;
    setTree(prev => {
      const hasTag = (nodes) => {
        for (const n of nodes) {
          if (n.type === 'tag' && (n.tag || '').trim().toLowerCase() === systemLower) return true;
          if (Array.isArray(n.children) && hasTag(n.children)) return true;
        }
        return false;
      };
      if (hasTag(prev)) return prev;
      const newNode = {
        id: nodeId,
        type: 'tag',
        tag: systemTag,
        tagType: 'user',
        children: []
      };
      const updated = deduplicateTagTree([...prev, newNode]);
      saveTreeToBackend(updated);
      return updated;
    });

    onCreateUserTag(systemTag);
    setNewTagInput('');
    setTagError('');
    setIsCreatingTag(false);
  };

  const selectedVersionsCount = useMemo(() => {
    let count = 0;
    versionTags.forEach(({ tag }) => {
      if (selectedTags.has(tag)) count++;
    });
    return count;
  }, [versionTags, selectedTags]);

  // Кількість активних фільтрів для кнопки «Скинути»:
  // Враховує виділені теги (Steam / власні), приховані теги та Обране.
  // Системні фільтри (статус підписки, живлення/підключення, сортування) є стійкими режимами перегляду каталогу і не показують кнопку «Скинути».
  const totalActiveTags =
    (selectedTags ? selectedTags.size : 0) +
    (excludedTags ? excludedTags.size : 0) +
    (systemFilter.favorite ? 1 : 0);

  // Recursive Tree Node Renderer for Tags
  const renderTreeNode = (node, depth = 0) => {
    if (!isNodeVisible(node)) return null;

    const isTarget = dropTarget && dropTarget.targetId === node.id;
    const dropPos = isTarget ? dropTarget.position : null;

    let dropClass = '';
    if (dropPos === 'before') {
      dropClass = 'border-t-2 border-[#66c0f4]';
    } else if (dropPos === 'after') {
      dropClass = 'border-b-2 border-[#66c0f4]';
    } else if (dropPos === 'inside') {
      dropClass = 'ring-2 ring-[#66c0f4] bg-[#1a2d42]/70 rounded';
    }

    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isCollapsed = collapsedTags.has(node.id);

    const isUser = isUserTagNode(node, allSteamTagsSet);
    const isSteam = !isUser;
    const isChecked = selectedTags ? selectedTags.has(node.tag) : (selectedUserTags ? selectedUserTags.has(node.tag) : false);
    const isExcluded = excludedTags ? excludedTags.has(node.tag) : false;
    const count = isSteam ? (steamCountsMap.get(node.tag) || 0) : (userCountsMap.get(node.tag) || 0);

    // Style specs:
    // Inactive: plain colored text (orange for user #f49e42, blue for steam #66c0f4), no dots
    // Active: compact pill cloud with solid border matching tag color, contrast background & text
    // Excluded: red accent with strike-through indicating hidden mods
    let tagPillStyle = '';
    if (isExcluded) {
      tagPillStyle = 'border border-[#ff6b6b]/60 bg-[#2b1417] text-[#ff8e8e] line-through font-medium px-1.5 py-0 rounded-full shadow-xs opacity-80';
    } else if (isChecked) {
      tagPillStyle = isSteam
        ? 'border border-[#66c0f4] bg-[#1a2d42] text-[#cce8ff] font-semibold px-1.5 py-0 rounded-full shadow-xs'
        : 'border border-[#f49e42] bg-[#3a2818] text-[#ffd699] font-semibold px-1.5 py-0 rounded-full shadow-xs';
    } else {
      tagPillStyle = isSteam
        ? 'text-[#66c0f4] hover:text-[#99d6ff] font-normal px-1 py-0'
        : 'text-[#f49e42] hover:text-[#ffbe73] font-normal px-1 py-0';
    }

    const isEditing = editingTagNodeId === node.id;

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          data-tag-id={node.id}
          onPointerDown={(e) => handleTagPointerDown(e, node)}
          onContextMenu={(e) => handleTagContextMenu(e, node, depth)}
          onDoubleClick={(e) => {
            if (isUser) handleStartRename(e, node);
          }}
          style={{ paddingLeft: `${depth * 9 + 2}px` }}
          className={`group/tag flex items-center justify-between py-[1.5px] px-1 rounded cursor-pointer transition select-none hover:bg-[#121c27] ${draggedNode?.id === node.id ? 'opacity-40' : ''} ${dropClass}`}
          title={isUser ? `${node.tag} (${t('tags.doubleClickRename')})` : node.tag}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1 mr-1.5">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => handleToggleTagCollapse(e, node.id)}
                className="p-0.5 -ml-0.5 rounded hover:bg-[#253547] text-gray-400 hover:text-white shrink-0 transition"
                title={isCollapsed ? t('tags.expandSubtags') : t('tags.collapseSubtags')}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            ) : depth > 0 ? (
              <span className="w-2.5 h-3 shrink-0 flex items-center justify-center text-gray-600 text-[9px]">└</span>
            ) : null}

            {isEditing ? (
              <div
                className="flex items-center gap-1 min-w-0 flex-1 my-0.5"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  autoFocus
                  value={editingTagName}
                  onChange={(e) => {
                    setEditingTagName(e.target.value);
                    if (editTagError) setEditTagError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveRename(node);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelRename();
                    }
                  }}
                  className={`flex-1 min-w-0 bg-[#101822] border ${editTagError ? 'border-red-500' : 'border-[#f49e42]'} rounded px-1.5 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none`}
                />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSaveRename(node);
                  }}
                  className="p-1 rounded bg-[#3a2818] hover:bg-[#523720] text-[#ffd699] border border-[#f49e42]/60 transition shrink-0 cursor-pointer"
                  title={t('tags.saveTitle')}
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCancelRename();
                  }}
                  className="p-1 rounded bg-[#22171a] hover:bg-[#381c22] text-gray-400 hover:text-white transition shrink-0 cursor-pointer"
                  title={t('tags.cancelTitle')}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className={`text-xs leading-tight truncate transition ${tagPillStyle}`}>
                {tTag(node.tag)}
              </span>
            )}
          </div>

          {/* Right side: Fixed width container for counter / action icons (hidden during edit) */}
          {!isEditing && (
            <div className="relative flex items-center justify-end min-w-[30px] h-4 shrink-0">
              <span className={`text-[10.5px] font-mono px-0.5 rounded transition-opacity ${
                isExcluded ? 'opacity-0' : 'group-hover/tag:opacity-0'
              } ${
                isChecked
                  ? (isSteam ? 'text-[#66c0f4] font-bold' : 'text-[#f49e42] font-bold')
                  : 'text-gray-500'
              }`}>
                {count}
              </span>

              <div className={`absolute inset-0 flex items-center justify-end gap-1 transition-opacity ${
                isExcluded ? 'opacity-100' : 'opacity-0 group-hover/tag:opacity-100'
              }`}>
                {/* Hide / Exclude mods with this tag button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleExcludeTag) onToggleExcludeTag(node.tag);
                  }}
                  className={`p-0.5 rounded transition cursor-pointer ${
                    isExcluded
                      ? 'bg-[#3d181d] text-[#ff6b6b] hover:bg-[#522129]'
                      : 'hover:bg-[#203246] text-gray-400 hover:text-[#ff6b6b]'
                  }`}
                  title={isExcluded ? t('tags.unhideTagTitle') : t('tags.hideTagTitle')}
                >
                  <EyeOff className="w-3 h-3" />
                </button>

                {/* If tag has children, button to select tag + all children */}
                {hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const { steam, user } = collectTagsFromNode(node);
                      const visibleSteam = steam.filter(t => activeSteamTagNames.has(t));
                      if (onBatchSetTags) onBatchSetTags(visibleSteam, user, 'add');
                    }}
                    className="p-0.5 rounded hover:bg-[#203246] text-gray-400 hover:text-[#a4d053] transition cursor-pointer"
                    title={t('tags.selectAllChildTitle')}
                  >
                    <BookmarkCheck className="w-3 h-3" />
                  </button>
                )}

                {/* Delete user tag */}
                {!isSteam && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteUserTagNode(e, node)}
                    className="p-0.5 rounded hover:bg-[#341d24] text-gray-400 hover:text-[#ff6b6b] transition cursor-pointer"
                    title={t('tags.deleteUserTagTitle')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Inline error for custom tag renaming */}
        {isEditing && editTagError && (
          <div className="text-[10.5px] text-red-400 px-2 py-0.5 leading-tight ml-4">
            {editTagError}
          </div>
        )}

        {/* Inline subtag creation form */}
        {subtagParentId === node.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 9 + 4}px` }} className="my-1 pr-1">
            <form onSubmit={(e) => handleSaveSubtag(e, node)} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                placeholder={t('tags.subtagPlaceholder')}
                value={subtagInput}
                onChange={(e) => {
                  setSubtagInput(e.target.value);
                  if (subtagError) setSubtagError('');
                }}
                className={`flex-1 bg-[#101822] border ${subtagError ? 'border-red-500' : 'border-[#2d4358] focus:border-[#f49e42]'} rounded px-1.5 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none`}
              />
              <button
                type="submit"
                className="bg-[#47341e] hover:bg-[#5c4227] text-[#f4b366] px-1.5 py-0.5 rounded text-[11px] font-semibold border border-[#634832] cursor-pointer"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubtagParentId(null);
                  setSubtagInput('');
                  setSubtagError('');
                }}
                className="text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
                title={t('tags.cancel')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
            {subtagError && <p className="text-[10px] text-red-400 mt-0.5">{subtagError}</p>}
          </div>
        )}

        {/* Render nested children if expanded */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col space-y-0 border-l border-[#202e3e]/60 ml-1.5">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-full h-full bg-[#171d25] border border-[#22303e] rounded-lg p-2.5 flex flex-col shadow text-xs select-none overflow-hidden">

      {/* 0. СИНХРОНІЗОВАНИЙ ТОГЛ [ ТЕГИ | КОЛЕКЦІЇ | ПАПКИ ] */}
      <div className="pb-2 border-b border-[#202e3e] shrink-0">
        <div className="flex items-center bg-[#101822] border border-[#233547] rounded-md p-0.5">
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('tags')}
            className={`flex-1 py-1 px-1.5 rounded transition flex items-center justify-center gap-1 font-semibold text-[11px] cursor-pointer ${
              sidebarMode === 'tags'
                ? 'bg-[#2a475e] text-[#66c0f4] shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
            title={t('collections.switchToTags')}
          >
            <Tag className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('sidebar.tabTags')}</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('collections')}
            className={`flex-1 py-1 px-1.5 rounded transition flex items-center justify-center gap-1 font-semibold text-[11px] cursor-pointer ${
              sidebarMode === 'collections'
                ? 'bg-[#2a475e] text-[#66c0f4] shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
            title={t('collections.switchToCols')}
          >
            <Folder className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('sidebar.tabCollections')}</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('folders')}
            className={`flex-1 py-1 px-1.5 rounded transition flex items-center justify-center gap-1 font-semibold text-[11px] cursor-pointer ${
              sidebarMode === 'folders'
                ? 'bg-[#2a475e] text-[#66c0f4] shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
            title={t('folders.title')}
          >
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('sidebar.tabFolders')}</span>
          </button>
        </div>
      </div>

      {/* ФІЛЬТР ЗА КОЛЕКЦІЄЮ В МЕНЮ ТЕГІВ */}
      {collections.length > 0 && (
        <div className="pt-2 pb-2 border-b border-[#22303e]/60 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Folder className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
              <span className="truncate">{t('tags.collectionFilter').replace(':', '')}</span>
            </div>
            {selectedCollectionId && (
              <button
                type="button"
                onClick={() => onSelectCollection && onSelectCollection(null)}
                title={t('collections.clearFilter')}
                className="text-[10.5px] text-[#ff6b6b] hover:text-white bg-[#22171a] hover:bg-[#381c22] px-1.5 py-0.5 rounded border border-[#4d232a] hover:border-[#732a35] flex items-center gap-1 shrink-0 transition cursor-pointer select-none"
              >
                <X className="w-3 h-3" />
                <span className="font-semibold">{t('tags.resetFilters')}</span>
              </button>
            )}
          </div>
          <select
            value={selectedCollectionId || ''}
            onChange={(e) => onSelectCollection && onSelectCollection(e.target.value ? Number(e.target.value) : null)}
            className={`w-full border rounded px-2 py-1 text-xs focus:outline-none cursor-pointer transition ${
              selectedCollectionId
                ? 'bg-[#152332] border-[#2f557a] text-[#8ec8f6] font-semibold'
                : 'bg-[#101822] border-[#233547] text-gray-300'
            }`}
          >
            <option value="">{t('tags.allCollections')}</option>
            {collections.map(c => (
              <option key={`tags-col-${c.id}`} value={c.id}>
                {c.name} ({c.total_items || 0})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 1. СИСТЕМНІ ТЕГИ (Фіксовані нагорі) */}
      <div className="pt-2 pb-2 border-b border-[#22303e]/60 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <BookmarkCheck className="w-3.5 h-3.5 text-[#a4d053] shrink-0" />
            <span className="truncate">{t('tags.systemTitle')}</span>
          </div>

          {totalActiveTags > 0 && (
            <button
              onClick={onClearTags}
              title="Reset all filters"
              className="text-[10.5px] text-[#ff6b6b] hover:text-white bg-[#22171a] hover:bg-[#381c22] px-1.5 py-0.5 rounded border border-[#4d232a] hover:border-[#732a35] flex items-center gap-1 shrink-0 transition cursor-pointer select-none"
            >
              <X className="w-3 h-3" />
              <span className="font-semibold">{t('tags.resetFiltersCount', { count: totalActiveTags })}</span>
            </button>
          )}
        </div>

        <div className="space-y-1">
          {/* Єдиний рядок 4 системних кнопок: Обране, Відписані/Підписані, Підключені/Відключені, Відсортовані/Не відсортовані */}
          {/* Адаптивність до ширини: при sidebarWidth >= 310 є текст і лічильник; при 250..309 — символ і лічильник; при < 250 — тільки символ */}
          <div className="grid grid-cols-4 gap-1 bg-[#101822] p-1 rounded border border-[#202e3e] text-[11px]">
            {/* 1. ОБРАНЕ (двопозиційне: увімк / вимк) */}
            <button
              type="button"
              onClick={() => setSystemFilter(prev => ({ ...prev, favorite: prev.favorite ? null : true }))}
              title={systemFilter.favorite ? t('tags.favoriteTooltipOn') : t('tags.favoriteTooltipOff')}
              className={`py-1 px-1 rounded transition flex items-center justify-center gap-1 cursor-pointer select-none min-w-0 ${
                systemFilter.favorite
                  ? 'bg-[#3d3215] text-[#f6be3c] font-semibold border border-[#6b5620]'
                  : 'text-gray-400 hover:text-white hover:bg-[#16202c]'
              }`}
            >
              <Star className={`w-3.5 h-3.5 shrink-0 ${systemFilter.favorite ? 'fill-[#f6be3c] text-[#f6be3c]' : 'text-[#f6be3c]'}`} />
              {sidebarWidth >= 310 && <span className="truncate font-medium">{t('tags.favorite')}</span>}
              {sidebarWidth >= 250 && (
                <span className="font-mono text-[10px] opacity-80 shrink-0">
                  {systemFilter.favorite ? systemCounts.favorited : (systemCounts.favorited || 0)}
                </span>
              )}
            </button>

            {/* 2. ПІДПИСКА (3-позиційне циклічне: Підписані -> Відписані -> Всі) */}
            <button
              type="button"
              onClick={() => setSystemFilter(prev => {
                // Послідовний режим переключення: 'subscribed' -> 'unsubscribed' -> null ('всі') -> 'subscribed'
                if (prev.status === 'subscribed') return { ...prev, status: 'unsubscribed' };
                if (prev.status === 'unsubscribed') return { ...prev, status: null };
                return { ...prev, status: 'subscribed' };
              })}
              title={
                systemFilter.status === 'subscribed'
                  ? t('tags.status.subscribedTooltip')
                  : systemFilter.status === 'unsubscribed'
                  ? t('tags.status.unsubscribedTooltip')
                  : t('tags.status.allTooltip')
              }
              className={`py-1 px-1 rounded transition flex items-center justify-center gap-1 cursor-pointer select-none min-w-0 ${
                systemFilter.status === 'unsubscribed'
                  ? 'bg-[#3a1a1e] text-[#ff6b6b] font-semibold border border-[#682730]'
                  : systemFilter.status === 'subscribed'
                  ? 'bg-[#182838] text-[#66c0f4] font-semibold border border-[#2a4a68]'
                  : 'text-gray-400 hover:text-white hover:bg-[#16202c]'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0 text-[#ff6b6b]" />
              {sidebarWidth >= 310 && (
                <span className="truncate font-medium">
                  {systemFilter.status === 'unsubscribed' ? t('tags.status.unsubscribed') : systemFilter.status === 'subscribed' ? t('tags.status.subscribed') : t('tags.status.all')}
                </span>
              )}
              {sidebarWidth >= 250 && (
                <span className="font-mono text-[10px] opacity-80 shrink-0">
                  {systemFilter.status === 'unsubscribed'
                    ? systemCounts.unsubscribed
                    : systemFilter.status === 'subscribed'
                    ? systemCounts.subscribed
                    : (systemCounts.subscribed + systemCounts.unsubscribed)}
                </span>
              )}
            </button>

            {/* 3. ПІДКЛЮЧЕННЯ (3-позиційне циклічне: Всі -> Підключені -> Відключені -> Всі) */}
            <button
              type="button"
              onClick={() => setSystemFilter(prev => {
                // Послідовний режим переключення: null ('всі') -> 'enabled' -> 'disabled' -> null
                if (prev.connection === null || prev.connection === undefined) return { ...prev, connection: 'enabled' };
                if (prev.connection === 'enabled') return { ...prev, connection: 'disabled' };
                return { ...prev, connection: null };
              })}
              title={
                systemFilter.connection === 'enabled'
                  ? t('tags.disabled.activeTooltip')
                  : systemFilter.connection === 'disabled'
                  ? t('tags.disabled.disabledTooltip')
                  : t('tags.disabled.allTooltip')
              }
              className={`py-1 px-1 rounded transition flex items-center justify-center gap-1 cursor-pointer select-none min-w-0 ${
                systemFilter.connection === 'enabled'
                  ? 'bg-[#1e3428] text-[#a4d053] font-semibold border border-[#3b6346]'
                  : systemFilter.connection === 'disabled'
                  ? 'bg-[#3d2c1f] text-[#f49e42] font-semibold border border-[#634832]'
                  : 'text-gray-400 hover:text-white hover:bg-[#16202c]'
              }`}
            >
              <Power className="w-3.5 h-3.5 shrink-0 text-[#f49e42]" />
              {sidebarWidth >= 310 && (
                <span className="truncate font-medium">
                  {systemFilter.connection === 'enabled' ? t('tags.disabled.active') : systemFilter.connection === 'disabled' ? t('tags.disabled.disabled') : t('tags.disabled.all')}
                </span>
              )}
              {sidebarWidth >= 250 && (
                <span className="font-mono text-[10px] opacity-80 shrink-0">
                  {systemFilter.connection === 'enabled'
                    ? (systemCounts.enabled ?? 0)
                    : systemFilter.connection === 'disabled'
                    ? (systemCounts.disabled ?? 0)
                    : ((systemCounts.enabled ?? 0) + (systemCounts.disabled ?? 0))}
                </span>
              )}
            </button>

            {/* 4. СОРТУВАННЯ (3-позиційне циклічне: Всі -> Відсортовані -> Не відсортовані -> Всі) */}
            <button
              type="button"
              onClick={() => setSystemFilter(prev => {
                // Послідовний режим переключення: null ('всі') -> 'sorted' -> 'unsorted' -> null
                if (prev.sort === null || prev.sort === undefined) return { ...prev, sort: 'sorted' };
                if (prev.sort === 'sorted') return { ...prev, sort: 'unsorted' };
                return { ...prev, sort: null };
              })}
              title={
                systemFilter.sort === 'sorted'
                  ? t('tags.sorted.sortedTooltip')
                  : systemFilter.sort === 'unsorted'
                  ? t('tags.sorted.unsortedTooltip')
                  : t('tags.sorted.allTooltip')
              }
              className={`py-1 px-1 rounded transition flex items-center justify-center gap-1 cursor-pointer select-none min-w-0 ${
                systemFilter.sort === 'sorted'
                  ? 'bg-[#192b3a] text-[#66c0f4] font-semibold border border-[#2b4d6b]'
                  : systemFilter.sort === 'unsorted'
                  ? 'bg-[#3d2c1f] text-[#f49e42] font-semibold border border-[#634832]'
                  : 'text-gray-400 hover:text-white hover:bg-[#16202c]'
              }`}
            >
              {systemFilter.sort === 'sorted' ? (
                <TagCheck className="w-3.5 h-3.5 shrink-0 text-[#66c0f4]" />
              ) : systemFilter.sort === 'unsorted' ? (
                <TagX className="w-3.5 h-3.5 shrink-0 text-[#f49e42]" />
              ) : (
                <Tag className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              )}
              {sidebarWidth >= 310 && (
                <span className="truncate font-medium">
                  {systemFilter.sort === 'sorted' ? t('tags.sorted.sorted') : systemFilter.sort === 'unsorted' ? t('tags.sorted.unsorted') : t('tags.sorted.all')}
                </span>
              )}
              {sidebarWidth >= 250 && (
                <span className="font-mono text-[10px] opacity-80 shrink-0">
                  {systemFilter.sort === 'sorted'
                    ? systemCounts.sorted
                    : systemFilter.sort === 'unsorted'
                    ? systemCounts.unsorted
                    : (systemCounts.sorted + systemCounts.unsorted)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. ПОШУК ТА СТВОРЕННЯ ТЕГІВ */}
      <div className="pt-2 pb-1.5 space-y-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t('tags.searchTags')}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-[#101822] border border-[#233547] text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-[#66c0f4] placeholder-gray-500"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setHideEmptyTags(prev => !prev)}
            title={hideEmptyTags ? t('tags.showEmptyTags') : t('tags.hideEmptyTags')}
            className={`p-1 rounded border transition cursor-pointer shrink-0 ${
              hideEmptyTags
                ? 'bg-[#66c0f4] text-black border-[#66c0f4]'
                : 'bg-[#1e2a38] text-gray-300 hover:text-white border-[#2e4257] hover:bg-[#27384a]'
            }`}
          >
            {hideEmptyTags ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsCreatingTag(!isCreatingTag);
              setTagError('');
            }}
            title={t('tags.newTag')}
            className={`p-1 rounded border transition cursor-pointer shrink-0 ${
              isCreatingTag
                ? 'bg-[#f49e42] text-black border-[#f49e42]'
                : 'bg-[#1e2a38] text-gray-300 hover:text-white border-[#2e4257] hover:bg-[#27384a]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isCreatingTag && (
          <div className="p-2 rounded bg-[#101822] border border-[#f49e42]/60 animate-in fade-in">
            <form onSubmit={handleAddNewTag} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                placeholder={t('tags.newTagPlaceholder')}
                value={newTagInput}
                onChange={(e) => {
                  setNewTagInput(e.target.value);
                  if (tagError) setTagError('');
                }}
                className="flex-1 bg-[#172230] border border-[#2e4257] rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#f49e42]"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-[#f49e42] text-black font-semibold rounded text-xs hover:bg-[#ffad54] transition cursor-pointer"
              >
                {t('tags.addTag')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingTag(false);
                  setTagError('');
                }}
                className="text-gray-400 hover:text-white px-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
            {tagError && (
              <div className="text-[11px] text-red-400 mt-1 px-1 leading-tight">
                {tagError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. ПРОКРУЧУВАНИЙ СПИСОК ТЕГІВ (Тільки самі теги прокручуються) */}
      <div
        ref={tagsScrollRef}
        className="flex-1 overflow-y-auto min-h-0 pr-1 text-xs space-y-0"
      >
        {/* Render Tree Nodes */}
        <div className="space-y-0">
          {tree.map(node => renderTreeNode(node, 0))}
        </div>

        {/* Collapsible Versions Subsection */}
        {versionTags.length > 0 && (
          <div className="pt-1.5 mt-2 border-t border-[#202e3e]">
            <button
              onClick={() => setIsVersionsOpen(!isVersionsOpen)}
              className="w-full flex items-center justify-between p-1.5 rounded bg-[#121a24] hover:bg-[#182330] border border-[#202e3e] transition select-none group text-xs"
            >
              <div className="flex items-center gap-1.5 text-gray-300 group-hover:text-white">
                <GitBranch className="w-3.5 h-3.5 text-[#66c0f4]" />
                <span className="font-semibold text-[11px]">{t('tags.gameVersions')} ({versionTags.length})</span>
                {selectedVersionsCount > 0 && (
                  <span className="bg-[#66c0f4] text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-1">
                    {selectedVersionsCount}
                  </span>
                )}
              </div>
              {isVersionsOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {isVersionsOpen && (
              <div className="mt-1 pl-1 space-y-[1px] max-h-48 overflow-y-auto border-l-2 border-[#202e3e] ml-2">
                {versionTags.map(({ tag, count }) => {
                  const isChecked = selectedTags.has(tag);
                  const isExcluded = excludedTags ? excludedTags.has(tag) : false;
                  return (
                    <div
                      key={tag}
                      onClick={(e) => onToggleTag(tag, e.ctrlKey || e.metaKey)}
                      className="group/vtag flex items-center justify-between px-2 py-0.5 rounded text-[11px] cursor-pointer transition select-none hover:bg-[#121c27]"
                    >
                      <span className={`truncate font-mono ${
                        isExcluded
                          ? 'border border-[#ff6b6b]/60 bg-[#2b1417] text-[#ff8e8e] line-through px-1.5 py-0.5 rounded'
                          : isChecked
                          ? 'text-white font-bold bg-[#1a2d42] px-1.5 py-0.5 rounded border border-[#66c0f4]'
                          : 'text-gray-400 hover:text-gray-200'
                      }`} title={tag}>
                        {tag}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleExcludeTag) onToggleExcludeTag(tag);
                          }}
                          className={`p-0.5 rounded transition cursor-pointer ${
                            isExcluded
                              ? 'bg-[#3d181d] text-[#ff6b6b]'
                              : 'opacity-0 group-hover/vtag:opacity-100 hover:bg-[#203246] text-gray-400 hover:text-[#ff6b6b]'
                          }`}
                          title={isExcluded ? t('tags.unhideTagTitle') : t('tags.hideTagTitle')}
                        >
                          <EyeOff className="w-3 h-3" />
                        </button>
                        <span className={`text-[10px] font-mono shrink-0 px-1 py-0.2 rounded ${
                          isExcluded ? 'text-[#ff6b6b]' : isChecked ? 'text-[#66c0f4] font-bold' : 'text-gray-500'
                        }`}>
                          {count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tree.filter(isNodeVisible).length === 0 && (
          <div className="p-2 rounded bg-[#101822] border border-[#1e2a38] text-[11px] text-gray-500 text-center mt-2">
            {t('tags.noTags')}
          </div>
        )}
      </div>

      {/* Floating Drag Preview Pill */}
      {draggedNode && dragCursorPos && (
        <div
          className="fixed pointer-events-none z-[999999] px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-1.5 border select-none transition-none"
          style={{
            left: `${dragCursorPos.x + 12}px`,
            top: `${dragCursorPos.y + 12}px`,
            background: isUserTagNode(draggedNode, allSteamTagsSet) ? '#3a2818' : '#1a2d42',
            color: isUserTagNode(draggedNode, allSteamTagsSet) ? '#ffd699' : '#cce8ff',
            borderColor: isUserTagNode(draggedNode, allSteamTagsSet) ? '#f49e42' : '#66c0f4'
          }}
        >
          <Tag className="w-3 h-3" />
          <span>{draggedNode.tag || t('sidebar.tag')}</span>
        </div>
      )}

      {/* Tag Context Menu */}
      {tagContextMenu && (
        <ContextMenu
          x={tagContextMenu.x}
          y={tagContextMenu.y}
          items={tagContextMenu.items}
          onClose={() => setTagContextMenu(null)}
        />
      )}

    </aside>
  );
}
