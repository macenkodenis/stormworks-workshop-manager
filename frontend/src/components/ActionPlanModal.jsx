import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  ClipboardList,
  PowerOff,
  Power,
  Trash2,
  CheckCircle2,
  HardDrive,
  AlertCircle,
  Loader2,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  HelpCircle,
  AlertTriangle,
  Plus,
  UserCheck,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

import { useI18n } from '../i18n/I18nContext';

function ItemTagAdder({ itemId, allExistingTags = [], onAddTag }) {
  const { t, tTag } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isCloudVisible, setIsCloudVisible] = useState(false);
  const inputRef = React.useRef(null);
  const containerRef = React.useRef(null);

  const matchingSuggestions = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return [];
    return allExistingTags
      .filter(tag => {
        const localized = (tTag(tag) || '').toLowerCase();
        const raw = (tag || '').toLowerCase();
        return raw.includes(q) || localized.includes(q);
      })
      .slice(0, 18);
  }, [inputValue, allExistingTags, tTag]);

  const handleOpen = (e) => {
    e.stopPropagation();
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClose = () => {
    setIsOpen(false);
    setInputValue('');
    setIsCloudVisible(false);
  };

  const submitTag = (tagToAdd) => {
    const finalTag = (tagToAdd || inputValue).trim();
    if (finalTag) {
      onAddTag(finalTag);
    }
    setInputValue('');
    setIsCloudVisible(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitTag();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center shrink-0 h-[22px]">
      {!isOpen ? (
        <button
          type="button"
          onClick={handleOpen}
          className="h-[20px] px-1.5 rounded bg-[#1e2a38] hover:bg-[#2b3e52] border border-[#354f6b] text-gray-300 hover:text-white flex items-center justify-center gap-1 text-[10px] transition cursor-pointer"
          title={t('plan.addTag')}
        >
          <Plus className="w-3 h-3 text-[#66c0f4]" />
          <span className="text-[10px] text-gray-400 hover:text-gray-200">{t('plan.addTag')}</span>
        </button>
      ) : (
        <div className="relative inline-flex items-center h-[22px] w-[170px] bg-[#121822] border border-[#3b5575] rounded overflow-visible animate-in fade-in duration-150">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsCloudVisible(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('plan.addTagInputPlaceholder')}
            className="w-full h-full bg-transparent px-1.5 text-[11px] text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              submitTag();
            }}
            disabled={!inputValue.trim()}
            className="px-1 h-full text-[#66c0f4] hover:text-white disabled:opacity-30 transition cursor-pointer flex items-center justify-center shrink-0"
            title={t('plan.addTag')}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="pr-1.5 h-full text-gray-500 hover:text-[#ff6b6b] transition cursor-pointer flex items-center justify-center shrink-0"
          >
            <X className="w-3 h-3" />
          </button>

          {/* Floating suggested tags cloud: hides on mouse leave as requested */}
          {isCloudVisible && matchingSuggestions.length > 0 && (
            <div
              onMouseLeave={() => setIsCloudVisible(false)}
              className="absolute left-0 top-[24px] z-50 bg-[#16212e] border border-[#3d5673] rounded-md shadow-2xl p-1.5 flex flex-wrap gap-1 max-w-[280px] max-h-[140px] overflow-y-auto"
            >
              {matchingSuggestions.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    submitTag(tag);
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-[#1f2f42] hover:bg-[#2f4969] text-[#93c5fd] hover:text-white border border-[#354f6e] transition cursor-pointer shrink-0"
                >
                  {tTag(tag)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ActionPlanModal({
  isOpen,
  onClose,
  onClearPlan,
  onExecutePlan,
  isExecuting = false,
  pendingActions = {},
  items = [],
  onRemoveFromPlan,
  steamMode = 'hybrid',
  steamStatus = null,
  tagStructure = []
}) {
  const { t, tTag } = useI18n();
  const [filterAction, setFilterAction] = useState('all'); // 'all' | 'disable' | 'enable' | 'unsubscribe' | 'subscribe' | 'autosort'
  const [displayOrder, setDisplayOrder] = useState('default');
  const [hoveredPreview, setHoveredPreview] = useState(null); // { id, title, previewUrl, x, y }

  // Classifier state
  const [classifierPreview, setClassifierPreview] = useState({}); // { [itemId]: classifiedData }
  const [itemOverrides, setItemOverrides] = useState({}); // { [itemId]: { assigned_tags?: string[], status?: string, is_sorted?: boolean } }
  const [newTagsDetected, setNewTagsDetected] = useState([]);
  const [tagAliases, setTagAliases] = useState({}); // { [newTag]: targetTag }
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [sortedTagsMode, setSortedTagsMode] = useState('default'); // 'default' | 'keep_old'
  const [isSortedMenuOpen, setIsSortedMenuOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setItemOverrides({});
      setSortedTagsMode('default');
      setIsSortedMenuOpen(false);
    }
  }, [isOpen]);

  const itemsMap = useMemo(() => {
    const map = new Map();
    items.forEach(it => map.set(it.published_file_id, it));
    return map;
  }, [items]);

  const planList = useMemo(() => {
    return Object.entries(pendingActions).map(([id, action]) => {
      const item = itemsMap.get(id) || { published_file_id: id, title: t('plan.modDefaultTitle', { id }), local_size_bytes: 0 };
      return {
        id,
        action,
        item
      };
    });
  }, [pendingActions, itemsMap, t]);

  // Extract all existing tag names from tagStructure for remapping dropdown
  const allExistingTags = useMemo(() => {
    const set = new Set();
    const traverse = (nodes) => {
      nodes.forEach(n => {
        const val = n.tag || n.name || n.id;
        if (val && !val.startsWith('tag-')) set.add(val);
        if (n.children && n.children.length) traverse(n.children);
      });
    };
    if (tagStructure && Array.isArray(tagStructure)) {
      traverse(tagStructure);
    }
    return Array.from(set).sort();
  }, [tagStructure]);

  // Autosort items list
  const autosortIds = useMemo(() => {
    return planList.filter(p => p.action === 'autosort').map(p => p.id);
  }, [planList]);

  // Fetch classification preview when modal opens or when tagAliases change
  useEffect(() => {
    if (!isOpen || autosortIds.length === 0) return;

    let isMounted = true;
    setIsLoadingPreview(true);

    fetch('/api/classifier/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_ids: autosortIds,
        tag_aliases: tagAliases
      })
    })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data && Array.isArray(data.items)) {
          const map = {};
          data.items.forEach(item => {
            map[item.item_id] = item;
          });
          setClassifierPreview(map);
          setNewTagsDetected(data.new_tags_detected || []);
        }
      })
      .catch(err => {
        console.error('Failed to preview classification:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, autosortIds.join(','), tagAliases]);

  const stats = useMemo(() => {
    let toDisable = 0;
    let toEnable = 0;
    let toUnsubscribe = 0;
    let toSubscribe = 0;
    let toAutosort = 0;
    let reclaimableBytes = 0;

    planList.forEach(({ action, item }) => {
      const size = item.local_size_bytes || item.api_file_size || 0;
      if (action === 'disable') {
        toDisable++;
        reclaimableBytes += size;
      } else if (action === 'enable') {
        toEnable++;
      } else if (action === 'unsubscribe') {
        toUnsubscribe++;
        reclaimableBytes += size;
      } else if (action === 'subscribe') {
        toSubscribe++;
      } else if (action === 'autosort') {
        toAutosort++;
      }
    });

    return {
      total: planList.length,
      toDisable,
      toEnable,
      toUnsubscribe,
      toSubscribe,
      toAutosort,
      reclaimableMb: (reclaimableBytes / (1024 * 1024)).toFixed(2)
    };
  }, [planList]);

  // Merge classifierPreview from server with user's manual itemOverrides
  const effectiveClassifierPreview = useMemo(() => {
    const map = {};
    for (const [id, item] of Object.entries(classifierPreview)) {
      const cleanAssigned = (item.assigned_tags || []).filter(
        t => t !== 'Autosorted' && t !== 'Uncertain' && t !== 'Very Uncertain' && t !== 'Manual'
      );

      let initialAssigned = cleanAssigned;
      if (sortedTagsMode === 'keep_old') {
        const modItem = itemsMap.get(id);
        const existingActive = [
          ...(modItem?.user_tags || []),
          ...((modItem?.tags || []).filter(t => !(modItem?.deactivated_steam_tags || []).includes(t)))
        ];
        // Unique existing active tags
        initialAssigned = Array.from(new Set(existingActive));
      }

      map[id] = { ...item, assigned_tags: initialAssigned };
    }
    for (const [id, override] of Object.entries(itemOverrides)) {
      if (map[id]) {
        map[id] = { ...map[id], ...override };
      } else {
        map[id] = {
          item_id: id,
          assigned_tags: [],
          core_tags: [],
          status: 'Autosorted',
          is_sorted: true,
          ...override
        };
      }
    }
    return map;
  }, [classifierPreview, itemOverrides, sortedTagsMode, itemsMap]);

  // Items in autosort that are completely uncertain (Very Uncertain)
  const veryUncertainAutosortIds = useMemo(() => {
    return autosortIds.filter(id => {
      const p = effectiveClassifierPreview[id];
      return p && (p.status === 'Very Uncertain' || (Array.isArray(p.assigned_tags) && p.assigned_tags.includes('Very Uncertain')));
    });
  }, [autosortIds, effectiveClassifierPreview]);

  const handleRemoveAllVeryUncertain = () => {
    if (!onRemoveFromPlan || veryUncertainAutosortIds.length === 0) return;
    veryUncertainAutosortIds.forEach(id => {
      onRemoveFromPlan(id);
    });
  };

  // Items in autosort that are already sorted (system flag is_sorted === 1/true or has user_tags)
  const sortedAutosortIds = useMemo(() => {
    return autosortIds.filter(id => {
      const it = itemsMap.get(id);
      return it && (it.is_sorted || (Array.isArray(it.user_tags) && it.user_tags.length > 0));
    });
  }, [autosortIds, itemsMap]);

  const handleRemoveAllSorted = () => {
    if (!onRemoveFromPlan || sortedAutosortIds.length === 0) return;
    sortedAutosortIds.forEach(id => {
      onRemoveFromPlan(id);
    });
  };

  const sortedAndFilteredPlanList = useMemo(() => {
    let list = filterAction === 'all' ? [...planList] : planList.filter(p => p.action === filterAction);

    if (displayOrder === 'default') return list;

    const getOrderRank = (item) => {
      const { action, id } = item;
      const classified = action === 'autosort' ? effectiveClassifierPreview[id] : null;
      const status = classified?.status || '';

      switch (displayOrder) {
        case 'autosorted_first':
          if (action === 'autosort' && status === 'Autosorted') return 0;
          if (action === 'autosort' && status === 'Manual') return 1;
          if (action === 'autosort' && status === 'Uncertain') return 2;
          if (action === 'autosort' && status === 'Very Uncertain') return 3;
          return 4;
        case 'uncertain_first':
          if (action === 'autosort' && status === 'Uncertain') return 0;
          if (action === 'autosort' && status === 'Very Uncertain') return 1;
          if (action === 'autosort' && status === 'Manual') return 2;
          if (action === 'autosort' && status === 'Autosorted') return 3;
          return 4;
        case 'very_uncertain_first':
          if (action === 'autosort' && status === 'Very Uncertain') return 0;
          if (action === 'autosort' && status === 'Uncertain') return 1;
          if (action === 'autosort' && status === 'Manual') return 2;
          if (action === 'autosort' && status === 'Autosorted') return 3;
          return 4;
        case 'disable_first':
          return action === 'disable' ? 0 : 1;
        case 'enable_first':
          return action === 'enable' ? 0 : 1;
        case 'unsubscribe_first':
          return action === 'unsubscribe' ? 0 : 1;
        case 'subscribe_first':
          return action === 'subscribe' ? 0 : 1;
        default:
          return 0;
      }
    };

    return [...list].sort((a, b) => getOrderRank(a) - getOrderRank(b));
  }, [planList, filterAction, displayOrder, effectiveClassifierPreview]);

  const handleRemoveProposedTag = (itemId, tagToRemove) => {
    setItemOverrides(prev => {
      const cur = prev[itemId] || effectiveClassifierPreview[itemId] || {};
      const baseAssigned = cur.assigned_tags || [];
      const updatedAssigned = baseAssigned.filter(t => t !== tagToRemove);
      return {
        ...prev,
        [itemId]: {
          ...cur,
          assigned_tags: updatedAssigned,
          status: 'Manual',
          is_sorted: true
        }
      };
    });
  };

  const handleAddTagToItem = (itemId, newTag) => {
    const trimmed = (newTag || '').trim();
    if (!trimmed) return;
    setItemOverrides(prev => {
      const cur = prev[itemId] || effectiveClassifierPreview[itemId] || {
        item_id: itemId,
        assigned_tags: [],
        core_tags: [],
        status: 'Autosorted',
        is_sorted: true
      };
      const baseAssigned = cur.assigned_tags || [];
      if (baseAssigned.includes(trimmed)) return prev;
      return {
        ...prev,
        [itemId]: {
          ...cur,
          assigned_tags: [...baseAssigned, trimmed],
          status: 'Manual',
          is_sorted: true
        }
      };
    });
  };

  const handleResetItemToPredicted = (itemId) => {
    setItemOverrides(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleSetItemStatus = (itemId, targetStatus) => {
    setItemOverrides(prev => {
      const cur = prev[itemId] || effectiveClassifierPreview[itemId] || {};
      return {
        ...prev,
        [itemId]: {
          ...cur,
          status: targetStatus,
          is_sorted: targetStatus !== 'Very Uncertain'
        }
      };
    });
  };

  if (!isOpen) return null;

  const isModeAActive = steamMode === 'mode_a' || (steamMode === 'hybrid' && steamStatus?.cef_debugging);

  const handleAliasChange = (newTag, targetTag) => {
    setTagAliases(prev => {
      const next = { ...prev };
      if (!targetTag || targetTag === newTag) {
        delete next[newTag];
      } else {
        next[newTag] = targetTag;
      }
      return next;
    });
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'disable':
        return (
          <span className="flex items-center gap-1 text-[#f49e42] bg-[#241a10] border border-[#4d3215] px-2 py-0.5 rounded text-[11px] font-semibold">
            <PowerOff className="w-3 h-3" />
            {t('plan.disable')}
          </span>
        );
      case 'enable':
        return (
          <span className="flex items-center gap-1 text-[#a4d053] bg-[#142618] border border-[#264d2e] px-2 py-0.5 rounded text-[11px] font-semibold">
            <Power className="w-3 h-3" />
            {t('plan.enable')}
          </span>
        );
      case 'unsubscribe':
        return (
          <span className="flex items-center gap-1 text-[#ff6b6b] bg-[#261215] border border-[#4d1f25] px-2 py-0.5 rounded text-[11px] font-semibold">
            <Trash2 className="w-3 h-3" />
            {t('plan.unsubscribe')}
          </span>
        );
      case 'subscribe':
        return (
          <span className="flex items-center gap-1 text-[#66c0f4] bg-[#112233] border border-[#234566] px-2 py-0.5 rounded text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            {t('plan.subscribe')}
          </span>
        );
      case 'autosort':
        return (
          <span className="flex items-center gap-1 text-[#b388ff] bg-[#1e152e] border border-[#4a2e7a] px-2 py-0.5 rounded text-[11px] font-semibold">
            <Sparkles className="w-3 h-3 text-[#b388ff]" />
            {t('plan.autosort')}
          </span>
        );
      default:
        return null;
    }
  };

  const renderStatusSwitcher = (itemId, status) => {
    let baseStyles = 'bg-[#261215] border-[#4d1f25] text-[#ff6b6b]';
    let currentIcon = <HelpCircle className="w-3 h-3 text-[#ff6b6b]" />;
    let currentText = t('plan.statusUncertain');

    if (status === 'Autosorted') {
      baseStyles = 'bg-[#142618] border-[#264d2e] text-[#a4d053]';
      currentIcon = <CheckCircle2 className="w-3 h-3 text-[#a4d053]" />;
      currentText = t('plan.statusConfident');
    } else if (status === 'Uncertain') {
      baseStyles = 'bg-[#2e2013] border-[#593917] text-[#f49e42]';
      currentIcon = <AlertTriangle className="w-3 h-3 text-[#f49e42]" />;
      currentText = t('plan.statusAttention');
    } else if (status === 'Manual') {
      baseStyles = 'bg-[#101f30] border-[#1d3d5e] text-[#66c0f4]';
      currentIcon = <UserCheck className="w-3 h-3 text-[#66c0f4]" />;
      currentText = t('plan.statusManual');
    }

    return (
      <div
        className={`w-[130px] h-[22px] px-1 rounded text-[10px] font-semibold border flex items-center justify-center shrink-0 transition-colors relative group/status select-none cursor-pointer overflow-hidden ${baseStyles}`}
      >
        {/* Normal display: current status badge */}
        <div className="flex items-center gap-1 group-hover/status:hidden w-full justify-center">
          {currentIcon}
          <span className="truncate">{currentText}</span>
        </div>

        {/* Hover display: 4 clickable icons replacing the badge without changing unified size */}
        <div className="hidden group-hover/status:flex items-center justify-center gap-2 w-full h-full bg-[#121720]/95 absolute inset-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSetItemStatus(itemId, 'Autosorted');
            }}
            title={t('plan.switchToConfident')}
            className={`p-0.5 rounded hover:scale-125 transition cursor-pointer ${
              status === 'Autosorted' ? 'text-[#a4d053] scale-110' : 'text-gray-400 hover:text-[#a4d053]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSetItemStatus(itemId, 'Uncertain');
            }}
            title={t('plan.switchToAttention')}
            className={`p-0.5 rounded hover:scale-125 transition cursor-pointer ${
              status === 'Uncertain' ? 'text-[#f49e42] scale-110' : 'text-gray-400 hover:text-[#f49e42]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSetItemStatus(itemId, 'Very Uncertain');
            }}
            title={t('plan.switchToUncertain')}
            className={`p-0.5 rounded hover:scale-125 transition cursor-pointer ${
              status === 'Very Uncertain' ? 'text-[#ff6b6b] scale-110' : 'text-gray-400 hover:text-[#ff6b6b]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSetItemStatus(itemId, 'Manual');
            }}
            title={t('plan.switchToManual')}
            className={`p-0.5 rounded hover:scale-125 transition cursor-pointer ${
              status === 'Manual' ? 'text-[#66c0f4] scale-110' : 'text-gray-400 hover:text-[#66c0f4]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const handleExecuteWithClassifier = () => {
    // Only pass items that are currently in autosortIds (i.e. not removed by user from plan)
    const currentAutosortIds = new Set(autosortIds);
    const activeClassifierItems = Object.values(effectiveClassifierPreview)
      .filter(ci => currentAutosortIds.has(ci.item_id))
      .map(ci => {
        // Dynamically append status tag based on ci.status (except 'Manual')
        const baseTags = (ci.assigned_tags || []).filter(
          t => t !== 'Autosorted' && t !== 'Uncertain' && t !== 'Very Uncertain' && t !== 'Manual'
        );
        const finalTags = [...baseTags];
        if (ci.status === 'Autosorted') {
          finalTags.push('Autosorted');
        } else if (ci.status === 'Uncertain') {
          finalTags.push('Uncertain');
        } else if (ci.status === 'Very Uncertain') {
          finalTags.push('Very Uncertain');
        }
        // If ci.status === 'Manual', no status tag is added

        // In 'keep_old' mode, do not deactivate existing tags on mod
        let finalDeactivated = ci.deactivated_tags || [];
        if (sortedTagsMode === 'keep_old') {
          const modItem = itemsMap.get(ci.item_id);
          const existingDeactivated = (modItem && modItem.deactivated_steam_tags) || [];
          finalDeactivated = existingDeactivated;
        }

        return {
          ...ci,
          assigned_tags: finalTags,
          deactivated_tags: finalDeactivated
        };
      });

    onExecutePlan({
      classifierItems: activeClassifierItems,
      tagAliases
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#171d25] border border-[#2d4358] rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#c7d5e0]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#233547] flex items-center justify-between bg-[#121820]">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-[#66c0f4]" />
            <h2 className="text-base font-bold text-white">
              {t('plan.titleWithCount', { count: stats.total })}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white p-1 rounded transition disabled:opacity-50 cursor-pointer"
            title={t('plan.backTitle')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode & Status Indicator Banner */}
        <div className="bg-[#1a2432] border-b border-[#24374b] px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{t('plan.targetMode')}</span>
            {isModeAActive ? (
              <span className="flex items-center gap-1.5 font-semibold text-[#a4d053] bg-[#14281a] px-2 py-0.5 rounded border border-[#275330]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('plan.modeA')}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-[#e5a93c] bg-[#2d2215] px-2 py-0.5 rounded border border-[#543e1d]">
                <AlertCircle className="w-3.5 h-3.5" />
                {t('plan.modeB')}
              </span>
            )}
          </div>
          {stats.toAutosort > 0 && (
            <span className="text-[11px] text-[#b388ff] font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {t('plan.autosortHint')}
            </span>
          )}
        </div>

        {/* Metrics Summary */}
        <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-b border-[#233547] bg-[#141b24]">
          <div className="bg-[#192330] p-3 rounded border border-[#26374a]">
            <span className="text-[11px] text-[#8f98a0] block">{t('plan.totalInPlan')}</span>
            <div className="text-lg font-bold text-white mt-0.5">
              {stats.total} <span className="text-xs font-normal text-gray-400">{t('plan.modsUnit')}</span>
            </div>
          </div>

          <div className="bg-[#192330] p-3 rounded border border-[#26374a]">
            <span className="text-[11px] text-[#8f98a0] block">{t('plan.freedSSD')}</span>
            <div className="text-lg font-bold text-[#a4d053] mt-0.5 flex items-center gap-1 font-mono">
              <HardDrive className="w-3.5 h-3.5" />
              <span>{stats.reclaimableMb} MB</span>
            </div>
          </div>

          <div className="bg-[#192330] p-3 rounded border border-[#26374a] col-span-2 sm:col-span-2 flex items-center justify-around gap-2 text-xs">
            <div className="text-center">
              <span className="text-[10px] text-gray-400 block">{t('plan.disable')}</span>
              <span className="font-bold text-[#f49e42] font-mono text-sm">{stats.toDisable}</span>
            </div>
            <div className="w-px h-6 bg-[#26374a]" />
            <div className="text-center">
              <span className="text-[10px] text-gray-400 block">{t('plan.enable')}</span>
              <span className="font-bold text-[#a4d053] font-mono text-sm">{stats.toEnable}</span>
            </div>
            <div className="w-px h-6 bg-[#26374a]" />
            <div className="text-center">
              <span className="text-[10px] text-gray-400 block">{t('plan.unsubscribe')}</span>
              <span className="font-bold text-[#ff6b6b] font-mono text-sm">{stats.toUnsubscribe}</span>
            </div>
            <div className="w-px h-6 bg-[#26374a]" />
            <div className="text-center">
              <span className="text-[10px] text-gray-400 block">{t('plan.autosort')}</span>
              <span className="font-bold text-[#b388ff] font-mono text-sm">{stats.toAutosort}</span>
            </div>
          </div>
        </div>

        {/* New Tags Detected Section (Interactive Remapping) */}
        {stats.toAutosort > 0 && newTagsDetected.length > 0 && (
          <div className="bg-[#1a1528] border-b border-[#3d2763] px-6 py-3 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#b388ff]" />
              <strong className="text-white">{t('plan.newTagsTitle')}</strong>
              <span className="text-gray-400 text-[11px]">{t('plan.newTagsHint')}</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {newTagsDetected.map(tag => (
                <div key={tag} className="flex items-center gap-1.5 bg-[#231a38] border border-[#4d3278] px-2.5 py-1 rounded">
                  <span className="font-mono text-[#e0b0ff] font-semibold">{tTag(tag)}</span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <select
                    value={tagAliases[tag] || tag}
                    onChange={(e) => handleAliasChange(tag, e.target.value)}
                    className="bg-[#130f1f] text-xs text-white border border-[#5c3e8e] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#b388ff] cursor-pointer"
                  >
                    <option value={tag}>{t('plan.createNewTag', { tag: tTag(tag) })}</option>
                    <optgroup label={t('plan.replaceExisting')}>
                      {allExistingTags.map(exist => (
                        <option key={exist} value={exist}>{tTag(exist)}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Filter Pills & Tools */}
        <div className="px-6 py-2 bg-[#121922] border-b border-[#233547] flex flex-col gap-2 text-xs">
          {/* Row 1: Action Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-400 mr-1 shrink-0 whitespace-nowrap">{t('plan.filter')}</span>
            <button
              type="button"
              onClick={() => setFilterAction('all')}
              className={`px-2.5 py-1 rounded text-xs transition cursor-pointer whitespace-nowrap shrink-0 ${
                filterAction === 'all'
                  ? 'bg-[#2a475e] text-white font-medium'
                  : 'bg-[#182330] text-gray-400 hover:text-white'
              }`}
            >
              {t('plan.filterAll', { count: stats.total })}
            </button>
            {stats.toAutosort > 0 && (
              <button
                type="button"
                onClick={() => setFilterAction('autosort')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  filterAction === 'autosort'
                    ? 'bg-[#b388ff] text-black font-semibold'
                    : 'bg-[#1e152e] text-[#b388ff] hover:bg-[#2b1c42]'
                }`}
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>{t('plan.filterAutosort', { count: stats.toAutosort })}</span>
              </button>
            )}
            {stats.toDisable > 0 && (
              <button
                type="button"
                onClick={() => setFilterAction('disable')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  filterAction === 'disable'
                    ? 'bg-[#f49e42] text-black font-semibold'
                    : 'bg-[#241a10] text-[#f49e42] hover:bg-[#332415]'
                }`}
              >
                <PowerOff className="w-3 h-3 shrink-0" />
                <span>{t('plan.filterDisable', { count: stats.toDisable })}</span>
              </button>
            )}
            {stats.toEnable > 0 && (
              <button
                type="button"
                onClick={() => setFilterAction('enable')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  filterAction === 'enable'
                    ? 'bg-[#a4d053] text-black font-semibold'
                    : 'bg-[#142618] text-[#a4d053] hover:bg-[#1f3b25]'
                }`}
              >
                <Power className="w-3 h-3 shrink-0" />
                <span>{t('plan.filterEnable', { count: stats.toEnable })}</span>
              </button>
            )}
            {stats.toUnsubscribe > 0 && (
              <button
                type="button"
                onClick={() => setFilterAction('unsubscribe')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  filterAction === 'unsubscribe'
                    ? 'bg-[#ff6b6b] text-black font-semibold'
                    : 'bg-[#261215] text-[#ff6b6b] hover:bg-[#3b191e]'
                }`}
              >
                <Trash2 className="w-3 h-3 shrink-0" />
                <span>{t('plan.filterUnsubscribe', { count: stats.toUnsubscribe })}</span>
              </button>
            )}
            {stats.toSubscribe > 0 && (
              <button
                type="button"
                onClick={() => setFilterAction('subscribe')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  filterAction === 'subscribe'
                    ? 'bg-[#66c0f4] text-black font-semibold'
                    : 'bg-[#112233] text-[#66c0f4] hover:bg-[#1a334d]'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>{t('plan.filterSubscribe', { count: stats.toSubscribe })}</span>
              </button>
            )}
          </div>

          {/* Row 2: Display Order Selector & Actions */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1c2a38]/60 w-full flex-nowrap">
            {/* Display Order Selector */}
            <div className="flex items-center gap-1.5 shrink-0 min-w-0">
              <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">{t('plan.order')}</span>
              <select
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="bg-[#182330] text-xs text-white border border-[#2d445d] rounded px-2 py-1 focus:outline-none focus:border-[#66c0f4] cursor-pointer whitespace-nowrap max-w-[170px] sm:max-w-[200px] truncate"
              >
                <option value="default">{t('plan.orderDefault')}</option>
                <option value="autosorted_first">{t('plan.orderAutosorted')}</option>
                <option value="uncertain_first">{t('plan.orderUncertain')}</option>
                <option value="very_uncertain_first">{t('plan.orderVeryUncertain')}</option>
                <option value="disable_first">{t('plan.orderDisable')}</option>
                <option value="enable_first">{t('plan.orderEnable')}</option>
                <option value="unsubscribe_first">{t('plan.orderUnsubscribe')}</option>
                <option value="subscribe_first">{t('plan.orderSubscribe')}</option>
              </select>
            </div>

            {/* Actions group */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Actions with Sorted Dropdown Menu */}
              {stats.toAutosort > 0 && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsSortedMenuOpen(prev => !prev)}
                    className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1.5 border font-medium whitespace-nowrap ${
                      sortedTagsMode === 'keep_old'
                        ? 'bg-[#1a2d42] hover:bg-[#223b56] text-[#66c0f4] border-[#385b7a]'
                        : 'bg-[#182330] hover:bg-[#202e3f] text-gray-300 hover:text-white border-[#2d445d]'
                    }`}
                    title={t('plan.sortedActions')}
                  >
                    <SlidersHorizontal className="w-3 h-3 text-[#66c0f4] shrink-0" />
                    <span>{t('plan.sortedActions')}</span>
                    {sortedTagsMode === 'keep_old' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#66c0f4] shrink-0" />
                    )}
                    <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                  </button>

                  {isSortedMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsSortedMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#101822] border border-[#2c4055] rounded-lg shadow-2xl p-1.5 min-w-[260px] flex flex-col gap-1 text-xs">
                        {/* Option 1: Default (Full Replacement) */}
                        <button
                          type="button"
                          onClick={() => {
                            setSortedTagsMode('default');
                            setIsSortedMenuOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition cursor-pointer ${
                            sortedTagsMode === 'default'
                              ? 'bg-[#172738] text-[#66c0f4] font-semibold'
                              : 'text-gray-300 hover:bg-[#182330] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <RotateCcw className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="whitespace-nowrap">{t('plan.sortedModeDefault')}</span>
                          </div>
                          {sortedTagsMode === 'default' && <Check className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />}
                        </button>

                        {/* Option 2: Keep Old Tags (Suggest additions) */}
                        <button
                          type="button"
                          onClick={() => {
                            setSortedTagsMode('keep_old');
                            setIsSortedMenuOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition cursor-pointer ${
                            sortedTagsMode === 'keep_old'
                              ? 'bg-[#172738] text-[#66c0f4] font-semibold'
                              : 'text-gray-300 hover:bg-[#182330] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5 text-[#a4d053] shrink-0" />
                            <span className="whitespace-nowrap">{t('plan.sortedModeKeepOld')}</span>
                          </div>
                          {sortedTagsMode === 'keep_old' && <Check className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />}
                        </button>

                        <div className="h-px bg-[#233547] my-0.5" />

                        {/* Option 3: Remove Already Sorted from Plan */}
                        <button
                          type="button"
                          disabled={sortedAutosortIds.length === 0}
                          onClick={() => {
                            handleRemoveAllSorted();
                            setIsSortedMenuOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition ${
                            sortedAutosortIds.length > 0
                              ? 'text-[#ff8e8e] hover:bg-[#261215] hover:text-white cursor-pointer'
                              : 'text-gray-600 cursor-not-allowed opacity-50'
                          }`}
                          title={t('plan.discardSortedTitle')}
                        >
                          <div className="flex items-center gap-2">
                            <Trash2 className="w-3.5 h-3.5 text-[#ff6b6b] shrink-0" />
                            <span className="whitespace-nowrap">{t('plan.discardSorted', { count: sortedAutosortIds.length })}</span>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {veryUncertainAutosortIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleRemoveAllVeryUncertain}
                  className="px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1.5 bg-[#261215] hover:bg-[#3d181d] text-[#ff8e8e] hover:text-white border border-[#522129] font-medium shrink-0 whitespace-nowrap"
                  title={t('plan.discardUncertainTitle')}
                >
                  <Trash2 className="w-3 h-3 text-[#ff6b6b] shrink-0" />
                  <span>{t('plan.discardUncertain', { count: veryUncertainAutosortIds.length })}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Items List Content */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto max-h-[380px]">
          {isLoadingPreview && autosortIds.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#b388ff] animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('plan.analyzing')}</span>
            </div>
          )}

          {sortedAndFilteredPlanList.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {t('plan.noItemsInFilter')}
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedAndFilteredPlanList.map(({ id, action, item }) => {
                const sizeBytes = item.local_size_bytes || item.api_file_size || 0;
                const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
                const classified = action === 'autosort' ? effectiveClassifierPreview[id] : null;

                return (
                  <div
                    key={id}
                    className="bg-[#192330] p-2.5 rounded border border-[#233547] hover:border-[#2f465e] flex flex-col gap-2 text-xs transition group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {getActionBadge(action)}
                        {classified && renderStatusSwitcher(id, classified.status)}
                        <span className="font-mono text-gray-500 text-[11px] shrink-0">#{id}</span>
                        <span
                          className="text-white font-medium truncate cursor-pointer hover:text-[#66c0f4] transition-colors"
                          title={item.title}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredPreview({
                              id,
                              title: item.title,
                              previewUrl: item.preview_url || item.api_preview_url,
                              x: rect.left,
                              y: rect.top
                            });
                          }}
                          onMouseLeave={() => setHoveredPreview(null)}
                        >
                          {item.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {action !== 'autosort' && (
                          <span className="text-gray-400 font-mono text-[11px]">
                            {sizeMb} MB
                          </span>
                        )}
                        {onRemoveFromPlan && (
                          <button
                            type="button"
                            onClick={() => onRemoveFromPlan(id)}
                            disabled={isExecuting}
                            className="text-gray-500 hover:text-[#ff6b6b] p-1 rounded transition hover:bg-[#261215] cursor-pointer"
                            title={t('plan.removeAction')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Classifier details if autosort */}
                    {classified && (
                      <div className="pl-2 border-l-2 border-[#4a2e7a] flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                        <span className="text-gray-400 shrink-0">{t('plan.assignedTags')}</span>
                        {(() => {
                          const assignedList = (classified.assigned_tags || []).filter(
                            t => t !== 'Autosorted' && t !== 'Uncertain' && t !== 'Very Uncertain' && t !== 'Manual'
                          );

                          // In 'keep_old' mode:
                          // Existing tags of the mod that are currently active
                          const modItem = itemsMap.get(id);
                          const existingActiveSet = new Set([
                            ...(modItem?.user_tags || []),
                            ...((modItem?.tags || []).filter(t => !(modItem?.deactivated_steam_tags || []).includes(t)))
                          ]);

                          // Newly predicted tags that are NOT in existing active tags and NOT yet accepted into assignedList
                          let unacceptedSuggested = [];
                          if (sortedTagsMode === 'keep_old') {
                            const rawPredicted = (classifierPreview[id]?.assigned_tags || []).filter(
                              t => t !== 'Autosorted' && t !== 'Uncertain' && t !== 'Very Uncertain' && t !== 'Manual'
                            );
                            const assignedSet = new Set(assignedList);
                            unacceptedSuggested = rawPredicted.filter(t => !assignedSet.has(t) && !existingActiveSet.has(t));
                          }

                          return (
                            <>
                              {assignedList.length === 0 && unacceptedSuggested.length === 0 && (
                                <span className="text-gray-500 italic shrink-0">-</span>
                              )}

                              {/* Active assigned tags */}
                              {assignedList.map(tag => {
                                const isOriginal = existingActiveSet.has(tag);
                                return (
                                  <span
                                    key={tag}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${
                                      isOriginal && sortedTagsMode === 'keep_old'
                                        ? 'bg-[#12241a] text-[#a4d053] border-[#254d33]'
                                        : 'bg-[#182a38] text-[#8ec8f6] border-[#2b4c6b]'
                                    }`}
                                    title={isOriginal && sortedTagsMode === 'keep_old' ? t('plan.existingTag') : undefined}
                                  >
                                    <span>{tTag(tag)}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveProposedTag(id, tag);
                                      }}
                                      className="hover:text-red-400 p-0.5 rounded-full hover:bg-black/20 transition cursor-pointer text-gray-400"
                                      title={t('plan.removeTag', { tag: tTag(tag) })}
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                );
                              })}

                              {/* In keep_old mode: Grey suggested additions that user can click to accept */}
                              {sortedTagsMode === 'keep_old' && unacceptedSuggested.map(tag => (
                                <button
                                  key={`sug-${tag}`}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddTagToItem(id, tag);
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed border-gray-600 bg-[#141b24]/70 text-gray-400 hover:text-white hover:border-[#66c0f4] hover:bg-[#1a2b3d] text-[10px] transition cursor-pointer"
                                  title={t('plan.proposedTagClick')}
                                >
                                  <Plus className="w-2.5 h-2.5 text-[#66c0f4]" />
                                  <span>{tTag(tag)}</span>
                                </button>
                              ))}
                            </>
                          );
                        })()}

                        {/* Interactive manual tag adder with animated slide-in and cloud */}
                        <ItemTagAdder
                          itemId={id}
                          allExistingTags={allExistingTags}
                          onAddTag={(newTag) => handleAddTagToItem(id, newTag)}
                        />

                        {/* Reset to auto predicted tags if item was manually modified */}
                        {itemOverrides[id] && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResetItemToPredicted(id);
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-gray-400 hover:text-[#66c0f4] hover:bg-[#1a2b3d] border border-[#2b4c6b]/60 transition cursor-pointer"
                            title={t('plan.resetToAutoTags')}
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>{t('plan.resetToAutoShort')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#121820] border-t border-[#233547] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isExecuting}
              className="px-4 py-2 rounded text-xs font-semibold bg-[#202e3d] hover:bg-[#2b3e52] text-gray-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
              title={t('plan.backTitle')}
            >
              {t('plan.back')}
            </button>

            {onClearPlan && (
              <button
                onClick={onClearPlan}
                disabled={isExecuting || stats.total === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium text-gray-400 hover:text-[#ff6b6b] hover:bg-[#261215] transition disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('plan.clear')}</span>
              </button>
            )}

            {veryUncertainAutosortIds.length > 0 && (
              <button
                onClick={handleRemoveAllVeryUncertain}
                disabled={isExecuting}
                className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium text-[#ff8e8e] hover:text-white bg-[#261215] hover:bg-[#3d181d] border border-[#522129] transition disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#ff6b6b]" />
                <span>{t('plan.discardUncertain', { count: veryUncertainAutosortIds.length })}</span>
              </button>
            )}
          </div>

          <button
            onClick={handleExecuteWithClassifier}
            disabled={isExecuting || stats.total === 0 || isLoadingPreview}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-[#1e5a2e] hover:bg-[#27753c] active:bg-[#174624] text-white border border-[#3b8c4c] shadow-lg shadow-green-950/40 transition duration-150 disabled:opacity-50 cursor-pointer"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#a4d053]" />
                <span>{t('plan.executing')}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-[#a4d053]" />
                <span>{t('plan.execute', { count: stats.total })}</span>
              </>
            )}
          </button>
        </div>

        {/* Floating Preview Popover on Title Hover */}
        {hoveredPreview && (
          <div
            className="fixed z-70 pointer-events-none shadow-2xl rounded-xl p-2 bg-[#121822] border border-[#3b5575] animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1.5"
            style={{
              left: Math.min(Math.max(16, hoveredPreview.x), typeof window !== 'undefined' ? window.innerWidth - 340 : 16),
              top: hoveredPreview.y > 260 ? hoveredPreview.y - 250 : hoveredPreview.y + 26,
              width: '320px'
            }}
          >
            <img
              src={`/api/previews/${hoveredPreview.id}`}
              alt={hoveredPreview.title}
              onError={(e) => {
                if (hoveredPreview.previewUrl && e.target.src !== hoveredPreview.previewUrl) {
                  e.target.src = hoveredPreview.previewUrl;
                }
              }}
              className="w-full h-[200px] object-cover rounded-lg bg-[#0b1017] shadow-inner"
              loading="eager"
            />
            <div className="text-xs font-semibold text-white truncate px-1">
              {hoveredPreview.title}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
