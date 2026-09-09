import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Tag,
  X,
  ChevronDown,
  ChevronRight,
  GitBranch,
  BookmarkCheck,
  Plus,
  Star,
  Folder,
  FolderOpen,
  Trash2
} from 'lucide-react';

export function TagsSidebar({
  steamTagsWithCounts,
  selectedTags,
  onToggleTag,
  onClearTags,
  tagMode,
  setTagMode,
  // System Filters
  systemFilter,
  setSystemFilter,
  systemCounts,
  // User/Custom Tags
  userTagsWithCounts,
  selectedUserTags,
  onToggleUserTag,
  onCreateUserTag,
  onDeleteUserTag,
  onBatchSetTags,
  onTagStructureChange
}) {
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagError, setTagError] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  // Group tree state: array of nodes:
  // Node: { id, type: 'tag' | 'group', tag?: string, tagType?: 'steam' | 'user', name?: string, children?: Node[] }
  const [tree, setTree] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [tagFilterQuery, setTagFilterQuery] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [renameError, setRenameError] = useState('');

  // Selection Anchor for Shift+click range selection
  const [anchorKey, setAnchorKey] = useState(null);

  // Drag and Drop state
  const [draggedNode, setDraggedNode] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { targetId, position: 'before' | 'inside' | 'after' }
  const isDraggingRef = useRef(false);

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

  // Load tree structure from backend API on mount
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    fetch('/api/tag-structure')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.structure) && data.structure.length > 0) {
          setTree(data.structure);
          if (onTagStructureChange) {
            onTagStructureChange(data.structure);
          }
        }
        hasLoadedRef.current = true;
      })
      .catch(err => {
        console.warn('Failed to load tag structure:', err);
        hasLoadedRef.current = true;
      });
  }, []);

  // Save tree structure whenever it changes (after initial load)
  const saveTreeToBackend = (newTree) => {
    if (onTagStructureChange) {
      onTagStructureChange(newTree);
    }
    fetch('/api/tag-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structure: newTree })
    }).catch(err => console.warn('Failed to save tag structure:', err));
  };

  // Stable string keys for tag names so effect only runs when tag names are added or removed, NOT when item counts change
  const generalSteamNamesKey = useMemo(() => {
    return generalSteamTags.map(t => t.tag).join('\0');
  }, [generalSteamTags]);

  const userTagNamesKey = useMemo(() => {
    return userTagsWithCounts.map(t => t.tag).join('\0');
  }, [userTagsWithCounts]);

  // Synchronize tree with available tags (runs ONLY on structure changes, not on filter count changes)
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    setTree(prevTree => {
      const presentTags = new Set();
      const collectTags = (nodes) => {
        nodes.forEach(node => {
          if (node.type === 'tag') {
            presentTags.add(`${node.tagType || 'steam'}:${node.tag}`);
          } else if (node.type === 'group' && node.children) {
            collectTags(node.children);
          }
        });
      };
      collectTags(prevTree);

      const toAdd = [];

      // Add Steam tags if not present
      generalSteamTags.forEach(({ tag }) => {
        const key = `steam:${tag}`;
        if (!presentTags.has(key)) {
          toAdd.push({
            id: `tag-steam-${tag}`,
            type: 'tag',
            tag: tag,
            tagType: 'steam'
          });
        }
      });

      // Add User tags if not present
      userTagsWithCounts.forEach(({ tag }) => {
        const key = `user:${tag}`;
        if (!presentTags.has(key)) {
          toAdd.push({
            id: `tag-user-${tag}`,
            type: 'tag',
            tag: tag,
            tagType: 'user'
          });
        }
      });

      if (toAdd.length === 0) {
        return prevTree;
      }

      const updated = [...prevTree, ...toAdd];
      saveTreeToBackend(updated);
      return updated;
    });
  }, [generalSteamNamesKey, userTagNamesKey]);

  // Visibility check: Steam tags with 0 items are hidden from sidebar, but user tags with 0 remain; plus tagFilterQuery
  const isNodeVisible = (node) => {
    const q = tagFilterQuery.trim().toLowerCase();
    if (node.type === 'tag') {
      const matchesText = !q || (node.tag && node.tag.toLowerCase().includes(q));
      if (node.tagType === 'steam') {
        return matchesText && activeSteamTagNames.has(node.tag);
      }
      return matchesText;
    }
    if (node.type === 'group') {
      const groupMatches = !q || (node.name && node.name.toLowerCase().includes(q));
      if (!node.children || node.children.length === 0) return groupMatches;
      return groupMatches || node.children.some(child => isNodeVisible(child));
    }
    return false;
  };

  const getAllGroupIds = (nodes) => {
    let ids = [];
    nodes.forEach(n => {
      if (n.type === 'group') {
        ids.push(n.id);
        if (Array.isArray(n.children)) {
          ids = ids.concat(getAllGroupIds(n.children));
        }
      }
    });
    return ids;
  };

  const handleExpandAll = () => {
    setCollapsedGroups(new Set());
  };

  const handleCollapseAll = () => {
    setCollapsedGroups(new Set(getAllGroupIds(tree)));
  };

  // Helper to extract all tags recursively inside a node
  const collectTagsFromNode = (node, res = { steam: [], user: [] }) => {
    if (node.type === 'tag') {
      if (node.tagType === 'steam') {
        res.steam.push(node.tag);
      } else {
        res.user.push(node.tag);
      }
    } else if (node.type === 'group' && Array.isArray(node.children)) {
      node.children.forEach(child => collectTagsFromNode(child, res));
    }
    return res;
  };

  // Check if group is active
  const isGroupSelected = (groupNode) => {
    const { steam, user } = collectTagsFromNode(groupNode);
    const visibleSteam = steam.filter(t => activeSteamTagNames.has(t));
    const totalVisible = visibleSteam.length + user.length;
    if (totalVisible === 0) return false;

    const allSteamSelected = visibleSteam.every(t => selectedTags.has(t));
    const allUserSelected = user.every(t => selectedUserTags.has(t));
    return allSteamSelected && allUserSelected;
  };

  // Flatten currently visible and expanded tree nodes into sequential list for Shift+click range selection
  const visibleLinearItems = useMemo(() => {
    const list = [];
    const traverse = (nodes) => {
      nodes.forEach(node => {
        if (!isNodeVisible(node)) return;
        list.push(node);
        if (node.type === 'group') {
          if (!collapsedGroups.has(node.id) && Array.isArray(node.children)) {
            traverse(node.children);
          }
        }
      });
    };
    traverse(tree);
    return list;
  }, [tree, collapsedGroups, activeSteamTagNames]);

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

  // Node Selection Handler (Tag or Group)
  const handleNodeClick = (e, node) => {
    if (isDraggingRef.current) return;

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

    if (node.type === 'tag') {
      const isSteam = node.tagType === 'steam';
      if (isSteam) onToggleTag(node.tag);
      else onToggleUserTag(node.tag);
    } else if (node.type === 'group') {
      const { steam, user } = collectTagsFromNode(node);
      const visibleSteam = steam.filter(t => activeSteamTagNames.has(t));
      const isAlreadySelected = isGroupSelected(node);

      if (isAlreadySelected) {
        if (onBatchSetTags) onBatchSetTags(visibleSteam, user, 'remove');
      } else {
        if (onBatchSetTags) onBatchSetTags(visibleSteam, user, 'add');
      }
    }
  };

  // Toggle Collapse/Expand of group
  const handleToggleGroupCollapse = (e, groupId) => {
    e.stopPropagation();
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Helper to extract all existing group names from tree
  const getAllGroupNames = (nodes, excludeId = null) => {
    const names = [];
    const traverse = (items) => {
      items.forEach(it => {
        if (it.type === 'group') {
          if (!excludeId || it.id !== excludeId) {
            names.push(it.name);
          }
          if (it.children) traverse(it.children);
        }
      });
    };
    traverse(nodes);
    return names;
  };

  // Rename group on double-click
  const handleStartRename = (e, group) => {
    e.stopPropagation();
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setRenameError('');
  };

  const handleFinishRename = (groupId, save) => {
    if (save && editingGroupName.trim()) {
      const newName = editingGroupName.trim();
      
      // Check for collision with other groups (case-insensitive)
      const existingNames = getAllGroupNames(tree, groupId);
      const isDuplicate = existingNames.some(
        name => name.trim().toLowerCase() === newName.toLowerCase()
      );

      if (isDuplicate) {
        setRenameError('Папка з такою назвою вже існує');
        return; // Keep input open so user sees error and can change it
      }

      const updateName = (nodes) => {
        return nodes.map(n => {
          if (n.id === groupId) {
            return { ...n, name: newName };
          }
          if (n.type === 'group' && n.children) {
            return { ...n, children: updateName(n.children) };
          }
          return n;
        });
      };
      const updatedTree = updateName(tree);
      setTree(updatedTree);
      saveTreeToBackend(updatedTree);
    }
    setEditingGroupId(null);
    setEditingGroupName('');
    setRenameError('');
  };

  // Delete a group: unrolls/unpacks all children into the parent container (where the group was located)
  const handleDeleteGroup = (e, groupId) => {
    e.stopPropagation();
    const unpackGroup = (nodes) => {
      const next = [];
      for (const n of nodes) {
        if (n.id === groupId) {
          // Unroll children into this same level/directory
          if (Array.isArray(n.children) && n.children.length > 0) {
            next.push(...n.children);
          }
        } else {
          if (n.type === 'group' && n.children) {
            next.push({
              ...n,
              children: unpackGroup(n.children)
            });
          } else {
            next.push(n);
          }
        }
      }
      return next;
    };

    const updatedTree = unpackGroup(tree);
    setTree(updatedTree);
    saveTreeToBackend(updatedTree);
  };

  // Delete a user tag node: removes from tree and invokes backend deletion across items
  const handleDeleteUserTagNode = (e, node) => {
    e.stopPropagation();
    if (node.tagType !== 'user') return;

    // Remove from tree
    const removeTagNode = (nodes) => {
      const next = [];
      for (const n of nodes) {
        if (n.id === node.id || (n.type === 'tag' && n.tagType === 'user' && n.tag === node.tag)) {
          // omit
        } else {
          if (n.type === 'group' && n.children) {
            next.push({
              ...n,
              children: removeTagNode(n.children)
            });
          } else {
            next.push(n);
          }
        }
      }
      return next;
    };

    const updatedTree = removeTagNode(tree);
    setTree(updatedTree);
    saveTreeToBackend(updatedTree);

    // Call backend delete
    if (onDeleteUserTag) {
      onDeleteUserTag(node.tag);
    }
  };

  // Check if target is descendant of candidate (prevent cyclic nesting)
  const isDescendant = (parentGroup, targetId) => {
    if (!parentGroup.children) return false;
    for (const child of parentGroup.children) {
      if (child.id === targetId) return true;
      if (child.type === 'group' && isDescendant(child, targetId)) return true;
    }
    return false;
  };

  // Drag and Drop Logic
  const handleDragStart = (e, node) => {
    isDraggingRef.current = true;
    setDraggedNode(node);
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
    setDraggedNode(null);
    setDropTarget(null);
  };

  const handleDragOver = (e, node) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNode || draggedNode.id === node.id) {
      setDropTarget(null);
      return;
    }

    if (draggedNode.type === 'group' && isDescendant(draggedNode, node.id)) {
      setDropTarget(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clientY = e.clientY - rect.top;
    const height = rect.height;

    let position = 'inside';
    if (clientY < height * 0.28) {
      position = 'before';
    } else if (clientY > height * 0.72) {
      position = 'after';
    } else {
      position = 'inside';
    }

    setDropTarget({ targetId: node.id, position });
  };

  const handleDragLeave = (e, node) => {
    e.stopPropagation();
    if (dropTarget && dropTarget.targetId === node.id) {
      setDropTarget(null);
    }
  };

  const handleDrop = (e, targetNode) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNode || !dropTarget || draggedNode.id === targetNode.id) {
      setDraggedNode(null);
      setDropTarget(null);
      return;
    }

    const { position } = dropTarget;
    const clone = JSON.parse(JSON.stringify(tree));

    let extracted = null;
    const removeNode = (nodes) => {
      const next = [];
      for (const n of nodes) {
        if (n.id === draggedNode.id) {
          extracted = n;
        } else {
          if (n.type === 'group' && n.children) {
            n.children = removeNode(n.children);
          }
          next.push(n);
        }
      }
      return next;
    };

    let updatedTree = removeNode(clone);
    if (!extracted) {
      extracted = draggedNode;
    }

    // CASE 1: Drag tag directly onto another tag -> Create new group
    if (targetNode.type === 'tag' && extracted.type === 'tag' && position === 'inside') {
      const existingNames = getAllGroupNames(updatedTree).map(n => n.toLowerCase());
      let groupName = 'Нова група';
      if (existingNames.includes(groupName.toLowerCase())) {
        let counter = 1;
        while (existingNames.includes(`нова група (${counter})`)) {
          counter++;
        }
        groupName = `Нова група (${counter})`;
      }

      const newGroupId = `group-${Date.now()}`;
      const newGroup = {
        id: newGroupId,
        type: 'group',
        name: groupName,
        children: [extracted]
      };

      const replaceTagWithGroup = (nodes) => {
        const next = [];
        for (const n of nodes) {
          if (n.id === targetNode.id) {
            newGroup.children.push(n);
            next.push(newGroup);
          } else {
            if (n.type === 'group' && n.children) {
              n.children = replaceTagWithGroup(n.children);
            }
            next.push(n);
          }
        }
        return next;
      };

      updatedTree = replaceTagWithGroup(updatedTree);
    }
    // CASE 2: Drop inside a group
    else if (targetNode.type === 'group' && position === 'inside') {
      const insertIntoGroup = (nodes) => {
        return nodes.map(n => {
          if (n.id === targetNode.id) {
            return {
              ...n,
              children: [...(n.children || []), extracted]
            };
          }
          if (n.type === 'group' && n.children) {
            return { ...n, children: insertIntoGroup(n.children) };
          }
          return n;
        });
      };
      updatedTree = insertIntoGroup(updatedTree);
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.delete(targetNode.id);
        return next;
      });
    }
    // CASE 3: Insert before or after targetNode
    else {
      const insertAdjacent = (nodes) => {
        const next = [];
        for (const n of nodes) {
          if (n.id === targetNode.id) {
            if (position === 'before') {
              next.push(extracted);
              next.push(n);
            } else {
              next.push(n);
              next.push(extracted);
            }
          } else {
            if (n.type === 'group' && n.children) {
              n.children = insertAdjacent(n.children);
            }
            next.push(n);
          }
        }
        return next;
      };
      updatedTree = insertAdjacent(updatedTree);
    }

    setTree(updatedTree);
    saveTreeToBackend(updatedTree);
    setDraggedNode(null);
    setDropTarget(null);
  };

  const handleAddNewTag = (e) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    if (!tag) return;

    const tagLower = tag.toLowerCase();

    // 1. Check collision with existing Steam tags (general and version)
    const isSteamDuplicate = steamTagsWithCounts.some(
      st => st.tag.trim().toLowerCase() === tagLower
    );
    if (isSteamDuplicate) {
      setTagError('Тег з такою назвою вже існує в Steam тегах');
      return;
    }

    // 2. Check collision with existing user tags
    const isUserDuplicate = userTagsWithCounts.some(
      ut => ut.tag.trim().toLowerCase() === tagLower
    );
    if (isUserDuplicate) {
      setTagError('Тег з такою назвою вже існує в користувацьких тегах');
      return;
    }

    // Immediately add to tree if not present
    const nodeId = `tag-user-${tag}`;
    setTree(prev => {
      const hasTag = (nodes) => {
        for (const n of nodes) {
          if (n.type === 'tag' && n.tagType === 'user' && n.tag.toLowerCase() === tagLower) return true;
          if (n.type === 'group' && n.children && hasTag(n.children)) return true;
        }
        return false;
      };
      if (hasTag(prev)) return prev;
      const newNode = {
        id: nodeId,
        type: 'tag',
        tag: tag,
        tagType: 'user'
      };
      const updated = [...prev, newNode];
      saveTreeToBackend(updated);
      return updated;
    });

    onCreateUserTag(tag);
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

  const totalActiveTags =
    selectedTags.size +
    selectedUserTags.size +
    (systemFilter.status ? 1 : 0) +
    (systemFilter.sort ? 1 : 0) +
    (systemFilter.favorite ? 1 : 0);

  // Recursive Tree Node Renderer
  const renderTreeNode = (node, depth = 0) => {
    if (!isNodeVisible(node)) return null;

    const isGroup = node.type === 'group';
    const isTarget = dropTarget && dropTarget.targetId === node.id;
    const dropPos = isTarget ? dropTarget.position : null;

    let dropClass = '';
    if (dropPos === 'before') {
      dropClass = 'border-t-2 border-[#66c0f4]';
    } else if (dropPos === 'after') {
      dropClass = 'border-b-2 border-[#66c0f4]';
    } else if (dropPos === 'inside') {
      dropClass = isGroup
        ? 'ring-2 ring-[#66c0f4] bg-[#1a2b3c]/60 rounded'
        : 'ring-2 ring-[#f49e42] bg-[#3a2818]/60 rounded';
    }

    if (isGroup) {
      const isCollapsed = collapsedGroups.has(node.id);
      const isSelected = isGroupSelected(node);
      const isEditing = editingGroupId === node.id;
      const { steam, user } = collectTagsFromNode(node);
      const visibleSteamCount = steam.filter(t => activeSteamTagNames.has(t)).length;
      const totalTagsInGroup = visibleSteamCount + user.length;

      return (
        <div key={node.id} className={`flex flex-col select-none ${dropClass}`}>
          {/* Group Header Row */}
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, node)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, node)}
            onDragLeave={(e) => handleDragLeave(e, node)}
            onDrop={(e) => handleDrop(e, node)}
            onClick={(e) => handleNodeClick(e, node)}
            onDoubleClick={(e) => handleStartRename(e, node)}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            className={`group/header flex items-center justify-between py-1 px-1.5 rounded cursor-pointer transition ${
              isSelected
                ? 'bg-[#1e2f42] text-white font-semibold'
                : 'hover:bg-[#121c27] text-gray-300 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate mr-2">
              {/* Expand / Collapse Chevron Button */}
              <button
                type="button"
                onClick={(e) => handleToggleGroupCollapse(e, node.id)}
                className="p-0.5 rounded hover:bg-[#253547] text-gray-400 hover:text-white shrink-0 transition"
                title={isCollapsed ? 'Розгорнути групу' : 'Згорнути групу'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Group Folder Icon */}
              {isCollapsed ? (
                <Folder className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
              ) : (
                <FolderOpen className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
              )}

              {/* Group Name */}
              {isEditing ? (
                <div className="relative flex flex-col">
                  <input
                    type="text"
                    autoFocus
                    value={editingGroupName}
                    onChange={(e) => {
                      setEditingGroupName(e.target.value);
                      if (renameError) setRenameError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename(node.id, true);
                      if (e.key === 'Escape') handleFinishRename(node.id, false);
                    }}
                    onBlur={() => handleFinishRename(node.id, true)}
                    onClick={(e) => e.stopPropagation()}
                    className={`bg-[#0b1016] border ${renameError ? 'border-red-500' : 'border-[#66c0f4]'} text-xs text-white px-1 py-0.5 rounded focus:outline-none`}
                  />
                  {renameError && (
                    <span className="text-[10px] text-red-400 mt-0.5 leading-none">
                      {renameError}
                    </span>
                  )}
                </div>
              ) : (
                <span className="truncate text-xs font-semibold" title={`${node.name} (двічі клікніть для перейменування)`}>
                  {node.name}
                </span>
              )}
            </div>

            {/* Right actions: Total tags count, swapped with delete button on hover */}
            <div className="relative flex items-center justify-end w-6 h-5 shrink-0">
              <span className="text-[10px] font-mono text-gray-500 group-hover/header:opacity-0 transition-opacity">
                {totalTagsInGroup}
              </span>
              <button
                type="button"
                onClick={(e) => handleDeleteGroup(e, node.id)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/header:opacity-100 rounded hover:bg-[#341d24] text-gray-400 hover:text-[#ff6b6b] transition cursor-pointer"
                title="Видалити групу (розпакувати вкладені елементи)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Group Children */}
          {!isCollapsed && node.children && node.children.length > 0 && (
            <div className="flex flex-col space-y-0.5 border-l border-[#202e3e]/60 ml-2.5">
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // TAG NODE
    const isSteam = node.tagType === 'steam';
    const isChecked = isSteam ? selectedTags.has(node.tag) : selectedUserTags.has(node.tag);
    const count = isSteam ? (steamCountsMap.get(node.tag) || 0) : (userCountsMap.get(node.tag) || 0);

    // Style specs per instructions:
    // Inactive: plain colored text (orange for user #f49e42, blue for steam #66c0f4), no dots
    // Active: compact pill cloud with solid border matching tag color, contrast background & text
    let tagPillStyle = '';
    if (isChecked) {
      tagPillStyle = isSteam
        ? 'border border-[#66c0f4] bg-[#1a2d42] text-[#cce8ff] font-semibold px-2 py-0.5 rounded-full shadow-xs'
        : 'border border-[#f49e42] bg-[#3a2818] text-[#ffd699] font-semibold px-2 py-0.5 rounded-full shadow-xs';
    } else {
      tagPillStyle = isSteam
        ? 'text-[#66c0f4] hover:text-[#99d6ff] font-normal px-1 py-0.5'
        : 'text-[#f49e42] hover:text-[#ffbe73] font-normal px-1 py-0.5';
    }

    return (
      <div
        key={node.id}
        draggable
        onDragStart={(e) => handleDragStart(e, node)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, node)}
        onDragLeave={(e) => handleDragLeave(e, node)}
        onDrop={(e) => handleDrop(e, node)}
        onClick={(e) => handleNodeClick(e, node)}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        className={`group/tag flex items-center justify-between py-1 px-1.5 rounded cursor-pointer transition select-none hover:bg-[#121c27] ${dropClass}`}
        title={node.tag}
      >
        <div className="flex items-center gap-1.5 truncate mr-2">
          <span className={`text-xs truncate transition ${tagPillStyle}`}>
            {node.tag}
          </span>
        </div>

        {/* Right side: Fixed width container for counter / delete icon */}
        <div className="relative flex items-center justify-end min-w-[24px] h-5 shrink-0">
          <span className={`text-[11px] font-mono px-1 py-0.2 rounded transition-opacity ${
            !isSteam ? 'group-hover/tag:opacity-0' : ''
          } ${
            isChecked
              ? (isSteam ? 'text-[#66c0f4] font-bold' : 'text-[#f49e42] font-bold')
              : 'text-gray-500'
          }`}>
            {count}
          </span>
          {!isSteam && (
            <button
              type="button"
              onClick={(e) => handleDeleteUserTagNode(e, node)}
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/tag:opacity-100 rounded hover:bg-[#341d24] text-gray-400 hover:text-[#ff6b6b] transition cursor-pointer"
              title="Видалити користувацький тег"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-full h-full bg-[#171d25] border border-[#22303e] rounded-lg p-3 flex flex-col shadow overflow-hidden">

      {/* Sidebar Header */}
      <div className="pb-2.5 border-b border-[#22303e] space-y-2">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Tag className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
            <span className="text-xs font-bold text-white uppercase tracking-wider truncate">
              Фільтри
            </span>
          </div>

          {totalActiveTags > 0 && (
            <button
              onClick={onClearTags}
              title="Скинути всі активні фільтри"
              className="text-[11px] text-[#ff6b6b] hover:text-white bg-[#22171a] hover:bg-[#381c22] px-1.5 py-0.5 rounded border border-[#4d232a] hover:border-[#732a35] flex items-center gap-1 shrink-0 transition cursor-pointer select-none"
            >
              <X className="w-3 h-3" />
              <span className="font-semibold text-[10.5px]">Скинути ({totalActiveTags})</span>
            </button>
          )}
        </div>

        {/* AND / OR filter mode */}
        <div className="grid grid-cols-2 bg-[#101822] p-0.5 rounded border border-[#233547] text-[10px]">
          <button
            onClick={() => setTagMode('AND')}
            title="Показувати моди, які мають ВСІ вибрані теги"
            className={`py-0.5 rounded font-semibold text-center transition cursor-pointer ${
              tagMode === 'AND'
                ? 'bg-[#2a475e] text-[#66c0f4] shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ВСІ (AND)
          </button>
          <button
            onClick={() => setTagMode('OR')}
            title="Показувати моди, які мають ХОЧА Б ОДИН вибраний тег"
            className={`py-0.5 rounded font-semibold text-center transition cursor-pointer ${
              tagMode === 'OR'
                ? 'bg-[#2a475e] text-[#66c0f4] shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ОДИН (OR)
          </button>
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto mt-2 pr-1 space-y-3.5 text-xs">

        {/* 1. СИСТЕМНІ ТЕГИ */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
            <BookmarkCheck className="w-3 h-3 text-[#a4d053]" />
            <span>Системні мітки</span>
          </div>

          <div className="space-y-1">
            {/* Обране (Системний стан) */}
            <div className="bg-[#101822] p-1 rounded border border-[#202e3e] text-[11px]">
              <button
                onClick={() => setSystemFilter(prev => ({ ...prev, favorite: prev.favorite ? null : true }))}
                title="Показувати тільки обрані моди"
                className={`w-full py-1 px-2 rounded transition flex items-center justify-between ${
                  systemFilter.favorite
                    ? 'bg-[#3d3215] text-[#f6be3c] font-semibold border border-[#6b5620]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Star className={`w-3.5 h-3.5 ${systemFilter.favorite ? 'fill-[#f6be3c] text-[#f6be3c]' : 'text-gray-400'}`} />
                  <span className="truncate font-medium">Обране</span>
                </div>
                <span className="font-mono text-[10px] opacity-75">{systemCounts.favorited || 0}</span>
              </button>
            </div>

            {/* Підписка */}
            <div className="grid grid-cols-2 gap-1 bg-[#101822] p-1 rounded border border-[#202e3e] text-[11px]">
              <button
                onClick={() => setSystemFilter(prev => ({ ...prev, status: prev.status === 'subscribed' ? null : 'subscribed' }))}
                className={`py-1 px-1.5 rounded transition flex items-center justify-between ${
                  systemFilter.status === 'subscribed'
                    ? 'bg-[#2a475e] text-white font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="truncate">Підписані</span>
                <span className="font-mono text-[10px] opacity-75">{systemCounts.subscribed}</span>
              </button>

              <button
                onClick={() => setSystemFilter(prev => ({ ...prev, status: prev.status === 'unsubscribed' ? null : 'unsubscribed' }))}
                className={`py-1 px-1.5 rounded transition flex items-center justify-between ${
                  systemFilter.status === 'unsubscribed'
                    ? 'bg-[#2a475e] text-white font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="truncate">Відписані</span>
                <span className="font-mono text-[10px] opacity-75">{systemCounts.unsubscribed}</span>
              </button>
            </div>

            {/* Підключення / Відключення */}
            <div className="grid grid-cols-2 gap-1 bg-[#101822] p-1 rounded border border-[#202e3e] text-[11px]">
              <button
                onClick={() => setSystemFilter(prev => ({ ...prev, connection: prev.connection === 'enabled' ? null : 'enabled' }))}
                className={`py-1 px-1.5 rounded transition flex items-center justify-between ${
                  systemFilter.connection === 'enabled'
                    ? 'bg-[#1e3428] text-[#a4d053] font-semibold border border-[#3b6346]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="truncate">Підключені</span>
                <span className="font-mono text-[10px] opacity-75">{systemCounts.enabled ?? 0}</span>
              </button>

              <button
                onClick={() => setSystemFilter(prev => ({ ...prev, connection: prev.connection === 'disabled' ? null : 'disabled' }))}
                className={`py-1 px-1.5 rounded transition flex items-center justify-between ${
                  systemFilter.connection === 'disabled'
                    ? 'bg-[#3d2c1f] text-[#f49e42] font-semibold border border-[#634832]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="truncate">Відключені</span>
                <span className="font-mono text-[10px] opacity-75">{systemCounts.disabled ?? 0}</span>
              </button>
            </div>

            {/* Sorted / Unsorted */}
            <div className="grid grid-cols-2 gap-1 bg-[#101822] p-1 rounded border border-[#202e3e] text-[11px]">
              <button
                onClick={() => setSystemFilter(prev => ({ ...prev, sort: prev.sort === 'sorted' ? null : 'sorted' }))}
                title="Моди, до яких додано хоча б один користувацький тег або відсортовано вручну"
                className={`py-1 px-1.5 rounded transition flex items-center justify-between ${
                  systemFilter.sort === 'sorted'
                    ? 'bg-[#253f2c] text-[#a4d053] font-semibold border border-[#3b6346]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="truncate">Відсортовані</span>
                <span className="font-mono text-[10px] opacity-75">{systemCounts.sorted}</span>
              </button>

              <button
                onClick={() => setSystemFilter(prev => ({ ...prev, sort: prev.sort === 'unsorted' ? null : 'unsorted' }))}
                title="Моди без користувацьких тегів або не відсортовані"
                className={`py-1 px-1.5 rounded transition flex items-center justify-between ${
                  systemFilter.sort === 'unsorted'
                    ? 'bg-[#3d2c1f] text-[#f49e42] font-semibold border border-[#634832]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="truncate">Не відсортовані</span>
                <span className="font-mono text-[10px] opacity-75">{systemCounts.unsorted}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. ІЄРАРХІЧНЕ ДЕРЕВО ТЕГІВ ТА ГРУП */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3 h-3 text-[#66c0f4]" />
              <span>Теги ({tree.filter(isNodeVisible).length})</span>
            </div>
            {/* Легенда кольорів + Кнопка "Новий тег" */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[9.5px]">
                <span className="text-[#66c0f4] font-medium">Steam</span>
                <span className="text-gray-600">/</span>
                <span className="text-[#f49e42] font-medium">Власні</span>
              </span>
              {!isCreatingTag && (
                <button
                  onClick={() => setIsCreatingTag(true)}
                  className="text-[#f49e42] hover:text-white flex items-center gap-0.5 text-[10px] font-semibold"
                  title="Створити новий користувацький тег"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Tag Filter Input & Folder Controls */}
          <div className="flex items-center gap-1.5 mb-2 px-0.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Швидкий фільтр тегів..."
                value={tagFilterQuery}
                onChange={(e) => setTagFilterQuery(e.target.value)}
                className="w-full bg-[#101822] border border-[#233547] focus:border-[#66c0f4] rounded px-2 py-0.5 text-[11px] text-white placeholder-gray-500 focus:outline-none"
              />
              {tagFilterQuery && (
                <button
                  type="button"
                  onClick={() => setTagFilterQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 cursor-pointer"
                  title="Очистити фільтр тегів"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleExpandAll}
              title="Розгорнути всі папки"
              className="p-1 rounded bg-[#101822] border border-[#233547] text-gray-400 hover:text-[#66c0f4] hover:border-[#334d66] transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              title="Згорнути всі папки"
              className="p-1 rounded bg-[#101822] border border-[#233547] text-gray-400 hover:text-[#66c0f4] hover:border-[#334d66] transition cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Create Input */}
          {isCreatingTag && (
            <div className="mb-2">
              <form onSubmit={handleAddNewTag} className="flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Назва тегу..."
                  value={newTagInput}
                  onChange={(e) => {
                    setNewTagInput(e.target.value);
                    if (tagError) setTagError('');
                  }}
                  className={`flex-1 bg-[#101822] border ${tagError ? 'border-red-500' : 'border-[#2d4358] focus:border-[#f49e42]'} rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none`}
                />
                <button
                  type="submit"
                  className="bg-[#47341e] hover:bg-[#5c4227] text-[#f4b366] px-2 py-1 rounded text-xs font-semibold border border-[#634832]"
                >
                  OK
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

          {/* Render Tree Nodes */}
          <div className="space-y-0.5">
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
                  <span className="font-semibold text-[11px]">Версії гри ({versionTags.length})</span>
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
                <div className="mt-1 pl-1 space-y-0.5 max-h-48 overflow-y-auto border-l-2 border-[#202e3e] ml-2">
                  {versionTags.map(({ tag, count }) => {
                    const isChecked = selectedTags.has(tag);
                    return (
                      <div
                        key={tag}
                        onClick={() => onToggleTag(tag)}
                        className="flex items-center justify-between px-2 py-1 rounded text-[11px] cursor-pointer transition select-none hover:bg-[#121c27]"
                      >
                        <span className={`truncate font-mono ${
                          isChecked ? 'text-white font-bold bg-[#1a2d42] px-1.5 py-0.5 rounded border border-[#66c0f4]' : 'text-gray-400 hover:text-gray-200'
                        }`} title={tag}>
                          {tag}
                        </span>
                        <span className={`text-[10px] font-mono shrink-0 px-1 py-0.2 rounded ${
                          isChecked ? 'text-[#66c0f4] font-bold' : 'text-gray-500'
                        }`}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tree.filter(isNodeVisible).length === 0 && (
            <div className="p-2 rounded bg-[#101822] border border-[#1e2a38] text-[11px] text-gray-500 text-center">
              Немає тегів
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="pt-2 mt-2 border-t border-[#22303e] text-[10px] text-center text-[#758494]">
        {totalActiveTags === 0
          ? 'Показано всі моди'
          : `Активних фільтрів: ${totalActiveTags} [${tagMode}]`}
      </div>

    </aside>
  );
}
