import React, { useState, useMemo, useRef } from 'react';
import {
  HardDrive,
  CheckSquare,
  Square,
  Trash2,
  Sparkles,
  RotateCcw,
  PowerOff,
  Power,
  CheckCircle2,
  ClipboardList,
  Play,
  LayoutGrid,
  List,
  FileDown,
  FileUp,
  X,
  Tags,
  MoreVertical,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  ChevronDown,
  AlertTriangle,
  FileQuestion
} from 'lucide-react';
import { getTagDisplayPath, resolveTagFromPath, matchesTagSearch } from '../utils/tagUtils';
import { formatBytes } from '../utils/formatters';
import { TagPill } from './TagPill';
import { useI18n } from '../i18n/I18nContext';
import { TAG_TRANSLATIONS } from '../i18n/translations';

export function RightActionSidebar({
  selectedCount,
  totalSelectedBytes,
  onSelectAllFiltered,
  onClearSelection,
  onPlanAction,
  pendingActionsCount = 0,
  onOpenPlanModal,
  onClearPlan,
  selectedItems = [],
  filteredCount,
  onBulkAddTag,
  onBulkAddUserTag,
  onBulkClearTags,
  onBulkResetTags,
  onBulkRemoveItemTag,
  availableUserTags = [],
  availableSteamTags = [],
  sidebarWidth = 290,
  tagPathMap,
  tagFullPathMap,
  reverseTagPathMap,
  viewMode = 'grid',
  setViewMode,
  cardSize = 2,
  setCardSize,
  onExportTags,
  onOpenImportModal,
  sidebarMode = 'tags',
  onModeChange,
  collections = [],
  onBulkAddToCollection,
  onBulkRemoveFromCollection,
  onCreateCollectionFromSelection,
  selectedTags = new Set(),
  selectedUserTags = new Set(),
  onToggleTag,
  onToggleUserTag,
  selectedCollectionId = null,
  onSelectCollection,
  inGameFolders = [],
  itemToInGameFolder = {},
  itemToInGameFolders = {},
  onAssignInGameFolder,
  onRemoveFromInGameFolder,
  onCreateFolderFromSelection,
  foldersMode = 'single',
  isGameRunning = false,
  savePathExists = true
}) {
  const { t, tTag, customTagTranslations } = useI18n();
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const tagInputContainerRef = useRef(null);
  const dropdownRef = useRef(null);
  const bulkInputRef = useRef(null);
  const [selectedTagsTab, setSelectedTagsTab] = useState('common'); // 'common' | 'all'
  const [selectedColsTab, setSelectedColsTab] = useState('common'); // 'common' | 'all'
  const [selectedFoldersTab, setSelectedFoldersTab] = useState('common'); // 'common' | 'all'
  const [isAddColDropdownOpen, setIsAddColDropdownOpen] = useState(false);
  const [isAddFolderDropdownOpen, setIsAddFolderDropdownOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const addColDropdownRef = useRef(null);
  const addFolderDropdownRef = useRef(null);

  // 50px buffer proximity tracking for closing suggestions when cursor moves away
  React.useEffect(() => {
    if (!isSuggestionsOpen) return;

    const handleMouseMove = (e) => {
      if (!tagInputContainerRef.current) return;
      const inputRect = tagInputContainerRef.current.getBoundingClientRect();
      const dropRect = dropdownRef.current ? dropdownRef.current.getBoundingClientRect() : null;

      let minX = inputRect.left;
      let maxX = inputRect.right;
      let minY = inputRect.top;
      let maxY = inputRect.bottom;

      if (dropRect) {
        minX = Math.min(minX, dropRect.left);
        maxX = Math.max(maxX, dropRect.right);
        minY = Math.min(minY, dropRect.top);
        maxY = Math.max(maxY, dropRect.bottom);
      }

      const BUFFER = 50;
      const x = e.clientX;
      const y = e.clientY;

      if (
        x < minX - BUFFER ||
        x > maxX + BUFFER ||
        y < minY - BUFFER ||
        y > maxY + BUFFER
      ) {
        setIsSuggestionsOpen(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isSuggestionsOpen]);

  // Close suggestions when clicking outside
  React.useEffect(() => {
    if (!isSuggestionsOpen) return;
    const handleClickOutside = (e) => {
      if (
        tagInputContainerRef.current &&
        !tagInputContainerRef.current.contains(e.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target))
      ) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSuggestionsOpen]);

  // Close more menu when clicking outside
  React.useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpen]);

  // Close add-to-collection dropdown when clicking outside
  React.useEffect(() => {
    if (!isAddColDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (addColDropdownRef.current && !addColDropdownRef.current.contains(e.target)) {
        setIsAddColDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddColDropdownOpen]);

  // Close add-to-folder dropdown when clicking outside
  React.useEffect(() => {
    if (!isAddFolderDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (addFolderDropdownRef.current && !addFolderDropdownRef.current.contains(e.target)) {
        setIsAddFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddFolderDropdownOpen]);

  const formatSelectedBytes = (bytes) => {
    const decimals = sidebarWidth < 250 ? 0 : sidebarWidth < 275 ? 1 : 2;
    return formatBytes(bytes, decimals);
  };

  const safeUserTags = Array.isArray(availableUserTags) ? availableUserTags : [];
  const safeSteamTags = Array.isArray(availableSteamTags) ? availableSteamTags : [];

  const searchFilter = (bulkTagInput || '').trim().toLowerCase();

  // Steam suggestions matching filter across all languages
  const filteredSteam = safeSteamTags
    .filter(t => {
      if (!searchFilter) return true;
      const displayPath = getTagDisplayPath(t, 'steam', tagPathMap);
      const fullPath = getTagDisplayPath(t, 'steam', tagFullPathMap);
      return matchesTagSearch(t, searchFilter, {
        customTranslations: customTagTranslations,
        systemTranslations: TAG_TRANSLATIONS,
        displayPath,
        fullPath
      });
    })
    .map(t => ({ tag: t, type: 'steam' }));

  // User suggestions matching filter across all languages
  const filteredUser = safeUserTags
    .filter(t => {
      if (!searchFilter) return true;
      const displayPath = getTagDisplayPath(t, 'user', tagPathMap);
      const fullPath = getTagDisplayPath(t, 'user', tagFullPathMap);
      return matchesTagSearch(t, searchFilter, {
        customTranslations: customTagTranslations,
        systemTranslations: TAG_TRANSLATIONS,
        displayPath,
        fullPath
      });
    })
    .map(t => ({ tag: t, type: 'user' }));

  // Combine suggestions: custom user tags first, then steam tags, deduplicated
  const combinedSuggestions = [];
  const seenTagNames = new Set();

  filteredUser.forEach(item => {
    const lower = (item.tag || '').toLowerCase();
    if (lower && !seenTagNames.has(lower)) {
      seenTagNames.add(lower);
      combinedSuggestions.push(item);
    }
  });

  filteredSteam.forEach(item => {
    const lower = (item.tag || '').toLowerCase();
    if (lower && !seenTagNames.has(lower)) {
      seenTagNames.add(lower);
      combinedSuggestions.push(item);
    }
  });

  // Check if current typed input matches an available Steam tag (case-insensitive full match)
  const isSteamFullMatch = Boolean(
    bulkTagInput.trim() &&
    safeSteamTags.some(st => typeof st === 'string' && st.toLowerCase() === bulkTagInput.trim().toLowerCase())
  );

  // Compute tags across selected items
  const { commonTags, allTags } = useMemo(() => {
    if (!selectedItems || selectedItems.length === 0) {
      return { commonTags: [], allTags: [] };
    }

    const totalCount = selectedItems.length;
    const tagMap = new Map();

    selectedItems.forEach(item => {
      const userTags = Array.isArray(item.user_tags) ? item.user_tags : [];
      const deactivated = new Set(
        (Array.isArray(item.deactivated_steam_tags) ? item.deactivated_steam_tags : []).map(t => String(t).toLowerCase())
      );
      const activeSteamTags = (Array.isArray(item.tags) ? item.tags : []).filter(
        t => t && !deactivated.has(String(t).toLowerCase())
      );

      userTags.forEach(ut => {
        if (!ut) return;
        const key = `user:${ut.toLowerCase()}`;
        if (!tagMap.has(key)) {
          tagMap.set(key, { tag: ut, type: 'user', count: 0 });
        }
        tagMap.get(key).count += 1;
      });

      activeSteamTags.forEach(st => {
        if (!st) return;
        const key = `steam:${st.toLowerCase()}`;
        if (!tagMap.has(key)) {
          tagMap.set(key, { tag: st, type: 'steam', count: 0 });
        }
        tagMap.get(key).count += 1;
      });
    });

    const all = Array.from(tagMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });

    const common = all.filter(t => t.count === totalCount);

    return { commonTags: common, allTags: all };
  }, [selectedItems]);

  // Compute collections across selected items
  const { commonCollections, allCollections } = useMemo(() => {
    if (!selectedItems || selectedItems.length === 0 || !collections || collections.length === 0) {
      return { commonCollections: [], allCollections: [] };
    }
    const totalCount = selectedItems.length;
    const colCounts = new Map();

    selectedItems.forEach(item => {
      const cids = item.collection_ids || [];
      cids.forEach(cid => {
        colCounts.set(cid, (colCounts.get(cid) || 0) + 1);
      });
    });

    const all = [];
    const common = [];

    collections.forEach(col => {
      const count = colCounts.get(col.id) || 0;
      if (count > 0) {
        const entry = { ...col, count };
        all.push(entry);
        if (count === totalCount) {
          common.push(entry);
        }
      }
    });

    return { commonCollections: common, allCollections: all };
  }, [selectedItems, collections]);

  // 1. Disable / Enable logic:
  // "увімкнути тільки якщо всі виділені моди вимкнуті, інакше всі, або хоча-б один з вибраних увімкнутий то має залишатись кнопка вимкнути"
  const allSelectedDisabled = selectedItems.length > 0 && selectedItems.every(it => it.is_disabled);
  const isEnableAction = selectedItems.length > 0 && allSelectedDisabled;

  // 2. Subscribe / Unsubscribe logic:
  // "підписатись тільки якщо всі виділені моди відписані, інакше якщо хоча б один підписаний то кнопка відписатись"
  const allSelectedUnsubscribed = selectedItems.length > 0 && selectedItems.every(it => it.is_unsubscribed);
  const isSubscribeAction = selectedItems.length > 0 && allSelectedUnsubscribed;

  const handleApplyBulkTag = (e) => {
    if (e) e.preventDefault();
    const rawTag = bulkTagInput.trim();
    if (rawTag && selectedCount > 0) {
      const resolved = resolveTagFromPath(rawTag, reverseTagPathMap);
      const tag = resolved || rawTag;
      if (onBulkAddTag) {
        onBulkAddTag(tag);
      } else if (onBulkAddUserTag) {
        onBulkAddUserTag(tag);
      }
      setBulkTagInput('');
      setIsSuggestionsOpen(false);
    }
  };

  // Compute folders across selected items (supporting both single and multi-folder assignments)
  const { commonInGameFolders, allInGameFolders, uncategorizedFoldersCount } = useMemo(() => {
    if (!selectedItems || selectedItems.length === 0) {
      return { commonInGameFolders: [], allInGameFolders: [], uncategorizedFoldersCount: 0 };
    }
    const totalCount = selectedItems.length;
    const folderCounts = new Map();
    let uncategorized = 0;

    selectedItems.forEach(item => {
      const fid = String(item.published_file_id || item.id);
      let folders = itemToInGameFolders[fid];
      if (!folders || folders.length === 0) {
        const single = itemToInGameFolder[fid];
        folders = single ? [single] : [];
      }
      if (folders.length === 0) {
        uncategorized++;
      } else {
        folders.forEach(fName => {
          folderCounts.set(fName, (folderCounts.get(fName) || 0) + 1);
        });
      }
    });

    const all = [];
    const common = [];

    folderCounts.forEach((count, name) => {
      const entry = { name, count };
      all.push(entry);
      if (count === totalCount) {
        common.push(entry);
      }
    });

    all.sort((a, b) => a.name.localeCompare(b.name));
    common.sort((a, b) => a.name.localeCompare(b.name));

    return {
      commonInGameFolders: common,
      allInGameFolders: all,
      uncategorizedFoldersCount: uncategorized
    };
  }, [selectedItems, itemToInGameFolders, itemToInGameFolder]);

  return (
    <aside className="w-full h-full bg-[#171d25] border border-[#22303e] rounded-lg flex flex-col shadow text-xs overflow-hidden select-none">
      
      {/* Main Column: metrics, selection, planning & tagging */}
      <div className="flex-1 overflow-hidden flex flex-col p-2.5 space-y-2 min-h-0">
        
        {/* Selected Metrics Card with Export / Import */}
        <div className="bg-[#121922] border border-[#233547] rounded-lg p-2 space-y-1.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] text-[#8f98a0] block leading-none">{t('bulk.selectedMods')}</span>
              <div className="text-xl font-bold text-white mt-0.5 leading-none">
                {selectedCount} <span className="text-[11px] font-normal text-gray-400">{t('bulk.of')} {filteredCount}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#8f98a0] flex items-center justify-end gap-1 leading-none">
                <HardDrive className="w-3 h-3 text-[#a4d053]" />
                <span>{t('bulk.volume')}</span>
              </span>
              <strong
                className="text-xs text-[#a4d053] font-mono leading-none block mt-0.5"
                title={`${totalSelectedBytes?.toLocaleString() || 0} ${t('bulk.bytes')}`}
              >
                {formatSelectedBytes(totalSelectedBytes)}
              </strong>
            </div>
          </div>

          {/* Quick Selection Buttons & More Actions Menu */}
          <div className="pt-1.5 border-t border-[#1e2a38] flex items-center gap-1">
            <button
              type="button"
              onClick={onSelectAllFiltered}
              disabled={filteredCount === 0}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1 text-[11px] py-1.5 px-1 rounded font-medium transition border truncate ${
                filteredCount > 0
                  ? 'bg-[#202e3d] hover:bg-[#2a3f54] text-[#c7d5e0] hover:text-white border-[#26374a] cursor-pointer'
                  : 'bg-[#18202a] text-gray-500 border-[#202934] cursor-not-allowed opacity-60'
              }`}
              title={t('bulk.selectAll', { count: filteredCount })}
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
              <span className="truncate">{t('bulk.selectAll', { count: filteredCount })}</span>
            </button>

            <button
              type="button"
              onClick={onClearSelection}
              disabled={selectedCount === 0}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1 text-[11px] py-1.5 px-1 rounded transition border truncate ${
                selectedCount > 0
                  ? 'bg-[#1a232e] hover:bg-[#23303f] text-gray-400 hover:text-white border-[#202c38] cursor-pointer'
                  : 'bg-[#161d26] text-gray-600 border-[#1c2430] cursor-not-allowed opacity-50'
              }`}
              title="Clear selection"
            >
              <Square className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('bulk.clearSelection')}</span>
            </button>

            {/* Square More Actions Menu Button (⋮) matching the selection buttons design */}
            <div ref={moreMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(prev => !prev)}
                title="More actions"
                className={`w-7 h-[29px] rounded transition border cursor-pointer flex items-center justify-center ${
                  isMoreMenuOpen
                    ? 'bg-[#233547] text-[#66c0f4] border-[#3a5675] shadow-sm'
                    : 'bg-[#1a232e] hover:bg-[#23303f] text-gray-400 hover:text-white border-[#202c38]'
                }`}
              >
                <MoreVertical className="w-3.5 h-3.5 shrink-0" />
              </button>

              {isMoreMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-[#101822] border border-[#2d4257] rounded-lg shadow-2xl p-1 text-xs space-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onExportTags && onExportTags();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-gray-300 hover:text-white hover:bg-[#1b2838] transition cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-[11.5px] leading-tight">
                        {t('bulk.exportTags')}
                      </span>
                      <span className="text-[9.5px] text-gray-500 truncate">.swtags.json</span>
                    </div>
                  </button>

                  <div className="h-[1px] bg-[#1d2a38] my-0.5" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenImportModal && onOpenImportModal();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-gray-300 hover:text-white hover:bg-[#1b2838] transition cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-[#a4d053] shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-[11.5px] leading-tight">{t('bulk.importTags')}</span>
                      <span className="text-[9.5px] text-gray-500 truncate">.swtags.json / .swbackup.json</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Planning Section Card (Moved above tagging) */}
        <div className="bg-[#121922] border border-[#233547] rounded-lg p-2 space-y-1.5 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#8f98a0]">
            <span className="flex items-center gap-1.5 text-[#66c0f4]">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>{t('bulk.planAction')}{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
            </span>
          </div>

          {/* 2 Adaptive Planning Buttons: [Вимкнути / Увімкнути] & [Відписатися / Підписатися] */}
          <div className="grid grid-cols-2 gap-1.5">
            {isEnableAction ? (
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => onPlanAction && onPlanAction('enable')}
                className={`py-1.5 px-2 rounded font-bold text-xs transition flex items-center justify-center gap-1.5 border ${
                  selectedCount > 0
                    ? 'bg-[#142618] hover:bg-[#1f3b25] text-[#a4d053] border-[#264d2e] hover:border-[#387344] active:scale-98 cursor-pointer shadow'
                    : 'bg-[#12171e] text-gray-600 border-[#1a212b] cursor-not-allowed opacity-50'
                }`}
                title="Enable selected"
              >
                <Power className="w-3.5 h-3.5 shrink-0 text-[#a4d053]" />
                <span className="truncate">{t('bulk.enableSelected').split(' ')[0]}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => onPlanAction && onPlanAction('disable')}
                className={`py-1.5 px-2 rounded font-bold text-xs transition flex items-center justify-center gap-1.5 border ${
                  selectedCount > 0
                    ? 'bg-[#1a140d] hover:bg-[#2e2013] text-[#f49e42] border-[#4d3215] hover:border-[#734a1e] active:scale-98 cursor-pointer shadow'
                    : 'bg-[#12171e] text-gray-600 border-[#1a212b] cursor-not-allowed opacity-50'
                }`}
                title="Disable selected"
              >
                <PowerOff className="w-3.5 h-3.5 shrink-0 text-[#f49e42]" />
                <span className="truncate">{t('bulk.disableSelected').split(' ')[0]}</span>
              </button>
            )}

            {isSubscribeAction ? (
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => onPlanAction && onPlanAction('subscribe')}
                className={`py-1.5 px-2 rounded font-bold text-xs transition flex items-center justify-center gap-1.5 border ${
                  selectedCount > 0
                    ? 'bg-[#101b26] hover:bg-[#172b3d] text-[#66c0f4] border-[#1e3b54] hover:border-[#2d5980] active:scale-98 cursor-pointer shadow'
                    : 'bg-[#12171e] text-gray-600 border-[#1a212b] cursor-not-allowed opacity-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#66c0f4]" />
                <span className="truncate">{t('tags.status.subscribed')}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => onPlanAction && onPlanAction('unsubscribe')}
                className={`py-1.5 px-2 rounded font-bold text-xs transition flex items-center justify-center gap-1.5 border ${
                  selectedCount > 0
                    ? 'bg-[#201013] hover:bg-[#36181e] text-[#ff6b6b] border-[#4d1f25] hover:border-[#732a34] active:scale-98 cursor-pointer shadow'
                    : 'bg-[#12171e] text-gray-600 border-[#1a212b] cursor-not-allowed opacity-50'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0 text-[#ff6b6b]" />
                <span className="truncate">{t('tags.status.unsubscribed')}</span>
              </button>
            )}
          </div>

          {/* Autosort Planning Button */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => onPlanAction && onPlanAction('autosort')}
            className={`w-full py-1.5 px-2.5 rounded font-bold text-xs transition flex items-center justify-center gap-1.5 border ${
              selectedCount > 0
                ? 'bg-[#1b1528] hover:bg-[#2c2044] text-[#b388ff] border-[#4a2e7a] hover:border-[#6d43b3] active:scale-98 cursor-pointer shadow'
                : 'bg-[#12171e] text-gray-600 border-[#1a212b] cursor-not-allowed opacity-50'
            }`}
            title="Autosort"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#b388ff]" />
            <span className="truncate">{t('plan.previewTitle')}</span>
          </button>

          {/* Plan status count & Clear button */}
          {pendingActionsCount > 0 && (
            <div className="flex items-center justify-between px-1 text-[11px] text-[#8f98a0] pt-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#a4d053] animate-pulse" />
                <span>{t('bulk.planLabel')}:</span>
                <strong className="text-white font-mono">{pendingActionsCount}</strong>
              </span>
              {onClearPlan && (
                <button
                  type="button"
                  onClick={onClearPlan}
                  className="text-[11px] text-gray-400 hover:text-[#ff6b6b] transition cursor-pointer"
                  title="Clear plan"
                >
                  {t('plan.clear')}
                </button>
              )}
            </div>
          )}

          {/* Apply Plan Button */}
          <button
            type="button"
            onClick={onOpenPlanModal}
            disabled={pendingActionsCount === 0}
            className={`w-full py-1.5 px-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 shadow border ${
              pendingActionsCount > 0
                ? 'bg-[#1c4d28] hover:bg-[#246334] active:bg-[#163d20] text-white border-[#3b8c4c] shadow-md shadow-green-950/40 active:scale-98 cursor-pointer'
                : 'bg-[#182029] text-gray-500 cursor-not-allowed border-[#202b38]'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current text-[#a4d053]" />
            <span>{t('plan.execute', { count: pendingActionsCount })}</span>
          </button>
        </div>

        {/* Synchronized Mode Switcher: [ 🏷️ Теги | 📁 Колекції | 📂 Папки ] */}
        <div className="flex items-center bg-[#101822] border border-[#233547] rounded-md p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('tags')}
            className={`flex-1 py-1 px-1.5 rounded transition flex items-center justify-center gap-1 font-semibold text-[11px] cursor-pointer ${
              sidebarMode === 'tags'
                ? 'bg-[#2a475e] text-[#66c0f4] shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Tags className="w-3 h-3 shrink-0" />
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
          >
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('sidebar.tabFolders')}</span>
          </button>
        </div>

        {sidebarMode === 'tags' ? (
        /* Unified Tagging (Always rendered, grayed out when no selection) */
        <div
          className={`rounded-lg p-2.5 space-y-2 transition-colors border flex-1 min-h-0 flex flex-col ${
            selectedCount > 0
              ? 'bg-[#121922] border-[#293c50]'
              : 'bg-[#10161f] border-[#1c2633] opacity-60'
          }`}
        >
          <div
            className={`flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ${
              selectedCount > 0 ? 'text-[#f49e42]' : 'text-gray-500'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('bulk.assignTag')}{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
          </div>

          <div
            ref={tagInputContainerRef}
            className="relative shrink-0"
          >
            <form onSubmit={handleApplyBulkTag} className="flex items-center gap-1 min-w-0 w-full">
              <input
                ref={bulkInputRef}
                type="text"
                disabled={selectedCount === 0}
                placeholder={t('bulk.tagInputPlaceholder')}
                value={bulkTagInput}
                onFocus={() => {
                  if (selectedCount > 0) setIsSuggestionsOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSuggestionsOpen(false);
                    bulkInputRef.current?.blur();
                  }
                }}
                onChange={(e) => {
                  setBulkTagInput(e.target.value);
                  if (selectedCount > 0 && e.target.value.trim().length > 0) {
                    setIsSuggestionsOpen(true);
                  }
                }}
                className={`flex-1 min-w-0 border rounded px-2 py-1 text-xs placeholder-gray-500 focus:outline-none transition ${
                  selectedCount > 0
                    ? isSteamFullMatch
                      ? 'bg-[#0c1219] border-[#26374a] focus:border-[#66c0f4] text-white'
                      : 'bg-[#0c1219] border-[#26374a] focus:border-[#f49e42] text-white'
                    : 'bg-[#0a0f14] border-[#18222d] text-gray-600 cursor-not-allowed'
                }`}
              />
              <button
                type="submit"
                disabled={selectedCount === 0 || !bulkTagInput.trim()}
                title={
                  selectedCount > 0 && bulkTagInput.trim()
                    ? isSteamFullMatch
                      ? t('bulk.tagTitleSteam')
                      : t('bulk.tagTitleCustom')
                    : t('bulk.tagTitleAdd')
                }
                className={`shrink-0 px-2.5 py-1 rounded font-semibold text-xs transition flex items-center justify-center ${
                  selectedCount > 0 && bulkTagInput.trim()
                    ? isSteamFullMatch
                      ? 'bg-[#2a475e] hover:bg-[#385c7a] text-white cursor-pointer'
                      : 'bg-[#f49e42] hover:bg-[#e08b31] text-black cursor-pointer'
                    : 'bg-[#1d242d] text-gray-600 cursor-not-allowed'
                }`}
              >
                +
              </button>
            </form>

            {/* Floating Dropdown: Recommended / Filtered Suggestions */}
            {selectedCount > 0 && isSuggestionsOpen && combinedSuggestions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#101822] border border-[#2c3e52] rounded-lg shadow-2xl p-2.5 max-h-60 overflow-y-auto space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium px-0.5 border-b border-[#1f2b38] pb-1">
                  <span>{bulkTagInput.trim() ? t('bulk.foundHints') : t('bulk.recommendedTags')}</span>
                  <span className="text-gray-500 font-mono">{combinedSuggestions.length}</span>
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {combinedSuggestions.slice(0, 30).map(({ tag, type }, idx) => (
                    <TagPill
                      key={`bulk-sug-${type}-${tag}-${idx}`}
                      tag={tag}
                      type={type}
                      prefix="+"
                      displayLabel={getTagDisplayPath(tag, type, tagPathMap)}
                      title={`+ ${getTagDisplayPath(tag, type, tagFullPathMap)}`}
                      onClick={() => {
                        if (onBulkAddTag) {
                          onBulkAddTag(tag);
                        } else if (onBulkAddUserTag) {
                          onBulkAddUserTag(tag);
                        }
                        setBulkTagInput('');
                        setIsSuggestionsOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* NEW BLOCK: Selected Mods Tags (Common / All) */}
          <div className="pt-2 border-t border-[#1e2a38] space-y-1.5 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-1 shrink-0">
              <div
                className="flex items-center gap-1 text-[11px] font-semibold text-gray-300 min-w-0"
                title={t('bulk.selectionTagsTitle')}
              >
                <Tags className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                <span className="whitespace-nowrap truncate">{t('bulk.selectionTags')}</span>
              </div>

              {/* Mode Toggle [Спільні | Всі] */}
              <div className="flex items-center bg-[#0d141b] border border-[#1f2b38] rounded p-0.5 text-[10px] shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedTagsTab('common')}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer font-medium ${
                    selectedTagsTab === 'common'
                      ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Common tags"
                >
                  {t('bulk.commonTags')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTagsTab('all')}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer font-medium ${
                    selectedTagsTab === 'all'
                      ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="All tags"
                >
                  {t('bulk.allTags')}
                </button>
              </div>
            </div>

            {/* Tags Cloud with Delete buttons - flex-1 min-h-[40px] filling all available space */}
            <div className="flex-1 min-h-[40px] overflow-y-auto pr-1 flex flex-wrap gap-1 items-start content-start">
              {selectedCount === 0 ? (
                <span className="text-[10.5px] text-gray-500 italic py-1">
                  ...
                </span>
              ) : (selectedTagsTab === 'common' ? commonTags : allTags).length === 0 ? (
                <span className="text-[10.5px] text-gray-500 italic py-1">
                  {selectedTagsTab === 'common'
                    ? '-'
                    : '-'}
                </span>
              ) : (
                (selectedTagsTab === 'common' ? commonTags : allTags).map(({ tag, type, count }) => {
                  const isActive = type === 'user'
                    ? (selectedUserTags && typeof selectedUserTags.has === 'function' && selectedUserTags.has(tag))
                    : (selectedTags && typeof selectedTags.has === 'function' && selectedTags.has(tag));

                  return (
                    <TagPill
                      key={`selected-tag-${type}-${tag}`}
                      tag={tag}
                      type={type}
                      displayLabel={getTagDisplayPath(tag, type, tagPathMap)}
                      count={selectedTagsTab === 'all' ? count : undefined}
                      onClick={() => {
                        if (type === 'user' && onToggleUserTag) onToggleUserTag(tag);
                        else if (type === 'steam' && onToggleTag) onToggleTag(tag);
                      }}
                      title={tag}
                      className={isActive ? 'ring-2 ring-[#66c0f4] font-bold shadow-xs' : ''}
                      onRemove={() => {
                        if (onBulkRemoveItemTag) {
                          onBulkRemoveItemTag(tag, type);
                        }
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Action buttons: Clear all tags & Reset original tags */}
          <div className="pt-2 border-t border-[#1e2a38] grid grid-cols-2 gap-1.5 shrink-0">
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onBulkClearTags}
              className={`flex items-center justify-center gap-1 text-[11px] py-1.5 px-1.5 rounded font-medium transition border truncate ${
                selectedCount > 0
                  ? 'bg-[#1a1215] hover:bg-[#2d171b] text-[#ff6b6b] hover:text-[#ff8585] border-[#4a1f24] hover:border-[#66282e] cursor-pointer'
                  : 'bg-[#141820] text-gray-600 border-[#1a212a] cursor-not-allowed opacity-50'
              }`}
              title="Clear all tags"
            >
              <Trash2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{t('bulk.clearAllTags')}</span>
            </button>

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onBulkResetTags}
              className={`flex items-center justify-center gap-1 text-[11px] py-1.5 px-1.5 rounded font-medium transition border truncate ${
                selectedCount > 0
                  ? 'bg-[#121c27] hover:bg-[#1a2d42] text-[#66c0f4] hover:text-[#99d6ff] border-[#22394f] hover:border-[#325373] cursor-pointer'
                  : 'bg-[#141820] text-gray-600 border-[#1a212a] cursor-not-allowed opacity-50'
              }`}
              title="Reset tags"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span className="truncate">{t('bulk.resetAllTags')}</span>
            </button>
          </div>
        </div>
        ) : sidebarMode === 'collections' ? (
          /* Collections Management Container for Selection */
          <div
            className={`rounded-lg p-2.5 space-y-2 transition-colors border flex-1 min-h-0 flex flex-col ${
              selectedCount > 0
                ? 'bg-[#121922] border-[#293c50]'
                : 'bg-[#10161f] border-[#1c2633] opacity-60'
            }`}
          >
            <div
              className={`flex items-center justify-between text-[11px] font-semibold shrink-0 ${
                selectedCount > 0 ? 'text-[#66c0f4]' : 'text-gray-500'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{t('bulk.assignToCol')}{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
              </div>
            </div>

            {/* Quick Add Dropdown with Full-Width Button */}
            <div className="relative shrink-0 space-y-1.5" ref={addColDropdownRef}>
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => setIsAddColDropdownOpen(prev => !prev)}
                className={`w-full py-1.5 px-2.5 rounded font-semibold text-xs transition flex items-center justify-between border ${
                  selectedCount > 0
                    ? 'bg-[#101822] hover:bg-[#15212e] text-gray-200 hover:text-white border-[#26374a] cursor-pointer'
                    : 'bg-[#0e141b] text-gray-600 border-[#18222d] cursor-not-allowed'
                }`}
                title={t('bulk.addToCollection')}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <FolderPlus className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                  <span className="truncate">{t('bulk.addToCollection')}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 ml-1 shrink-0 text-gray-400" />
              </button>

              {/* Collections Dropdown List */}
              {isAddColDropdownOpen && selectedCount > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#101822] border border-[#2d4257] rounded-lg shadow-2xl p-1 max-h-60 overflow-y-auto space-y-1">
                  {/* Top Action: Create New From Selection */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddColDropdownOpen(false);
                      if (onCreateCollectionFromSelection) onCreateCollectionFromSelection();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-[#192b1e] text-[#a4d053] hover:text-[#b8e860] transition cursor-pointer text-xs font-semibold border border-dashed border-[#2d5535]"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0 text-[#a4d053]" />
                    <span className="truncate">{t('bulk.createNewFromSel')}</span>
                  </button>

                  {collections.length > 0 && (
                    <div className="text-[10px] text-gray-400 px-2 pt-1 font-medium border-t border-[#1d2a38]">
                      {t('bulk.selectExistingCol')}
                    </div>
                  )}

                  {collections.map(col => {
                    const inCommon = commonCollections.some(c => c.id === col.id);
                    const inAny = allCollections.some(c => c.id === col.id);

                    return (
                      <button
                        key={`add-to-col-${col.id}`}
                        type="button"
                        onClick={() => {
                          setIsAddColDropdownOpen(false);
                          if (onBulkAddToCollection) onBulkAddToCollection(col.id);
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left hover:bg-[#192635] text-gray-200 hover:text-white transition cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: col.color || '#66c0f4' }} />
                          <span className="truncate">{col.name}</span>
                        </div>
                        <span className="font-mono text-[10px] text-gray-500 shrink-0 ml-1">
                          {inCommon ? t('bulk.inCommonTag') : inAny ? t('bulk.inPartialTag') : '+'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BLOCK: Selected Mods Collections (Common / All) */}
            <div className="pt-2 border-t border-[#1e2a38] space-y-1.5 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between gap-1 shrink-0">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-300 min-w-0" title={t('bulk.selCollections')}>
                  <Folder className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                  <span className="whitespace-nowrap truncate">{t('bulk.selCollections')}</span>
                </div>

                {/* Mode Toggle [Спільні | Всі] */}
                <div className="flex items-center bg-[#0d141b] border border-[#1f2b38] rounded p-0.5 text-[10px] shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedColsTab('common')}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer font-medium ${
                      selectedColsTab === 'common'
                        ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Common"
                  >
                    {t('bulk.colCommon')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedColsTab('all')}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer font-medium ${
                      selectedColsTab === 'all'
                        ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="All"
                  >
                    {t('bulk.colAll')}
                  </button>
                </div>
              </div>

              {/* Collections Sequential List with Remove button (x) */}
              <div className="flex-1 min-h-[40px] overflow-y-auto pr-0.5 space-y-1">
                {selectedCount === 0 ? (
                  <span className="text-[10.5px] text-gray-500 italic py-1 block">
                    {t('bulk.selectModsToViewCols')}
                  </span>
                ) : (selectedColsTab === 'common' ? commonCollections : allCollections).length === 0 ? (
                  <span className="text-[10.5px] text-gray-500 italic py-1 block">
                    {selectedColsTab === 'common'
                      ? t('bulk.noCommonCols')
                      : t('bulk.notInCols')}
                  </span>
                ) : (
                  (selectedColsTab === 'common' ? commonCollections : allCollections).map(col => {
                    const isColActive = selectedCollectionId === col.id;

                    return (
                      <div
                        key={`col-row-${col.id}`}
                        onClick={() => onSelectCollection && onSelectCollection(isColActive ? null : col.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition cursor-pointer select-none border ${
                          isColActive
                            ? 'bg-[#1b3b5c] border-[#66c0f4] text-white shadow-xs'
                            : 'bg-[#101822] hover:bg-[#162332] border border-[#1e2a38] hover:border-[#2a3c50] text-gray-200 hover:text-white'
                        }`}
                        title={isColActive ? t('bulk.colFilterRemove') : t('bulk.colFilterTitle', { name: col.name })}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: col.color || '#66c0f4' }} />
                          <span className="truncate font-medium">{col.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {selectedColsTab === 'all' && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#162230] text-[#66c0f4] border border-[#233547]">
                              {col.count}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onBulkRemoveFromCollection) onBulkRemoveFromCollection(col.id);
                            }}
                            title={t('bulk.colRemoveSelected', { name: col.name })}
                            className="hover:text-[#ff6b6b] p-1 rounded cursor-pointer transition text-gray-400 hover:bg-[#2d171b]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* In-Game Folders Management Container for Selection */
          <div
            className={`rounded-lg p-2.5 space-y-2 transition-colors border flex-1 min-h-0 flex flex-col ${
              selectedCount > 0
                ? 'bg-[#121922] border-[#293c50]'
                : 'bg-[#10161f] border-[#1c2633] opacity-60'
            }`}
          >
            <div
              className={`flex items-center justify-between text-[11px] font-semibold shrink-0 ${
                selectedCount > 0 ? 'text-[#66c0f4]' : 'text-gray-500'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>{t('folders.assignFolderTitle')}{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
              </div>
            </div>

            {/* Game Running warning */}
            {isGameRunning && (
              <div className="p-1.5 bg-[#3a1a14] border border-[#7a3324] rounded text-[10.5px] text-[#ffb4a2] flex items-center gap-1.5 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-[#ff6b6b] shrink-0" />
                <span className="leading-tight">{t('folders.gameRunningWarning')}</span>
              </div>
            )}

            {!savePathExists && (
              <div className="p-1.5 bg-[#332211] border border-[#664422] rounded text-[10.5px] text-[#ffd699] flex items-center gap-1.5 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-[#f49e42] shrink-0" />
                <span className="leading-tight">{t('folders.saveNotFound')}</span>
              </div>
            )}

            {/* Quick Add Dropdown with Full-Width Button */}
            <div className="relative shrink-0 space-y-1.5" ref={addFolderDropdownRef}>
              <button
                type="button"
                disabled={selectedCount === 0 || isGameRunning || !savePathExists}
                onClick={() => setIsAddFolderDropdownOpen(prev => !prev)}
                className={`w-full py-1.5 px-2.5 rounded font-semibold text-xs transition flex items-center justify-between border ${
                  selectedCount > 0 && !isGameRunning && savePathExists
                    ? 'bg-[#101822] hover:bg-[#15212e] text-gray-200 hover:text-white border-[#26374a] cursor-pointer'
                    : 'bg-[#0e141b] text-gray-600 border-[#18222d] cursor-not-allowed'
                }`}
                title={t('folders.addToFolder')}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <FolderPlus className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                  <span className="truncate">{t('folders.addToFolder')}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 ml-1 shrink-0 text-gray-400" />
              </button>

              {/* Folders Dropdown List */}
              {isAddFolderDropdownOpen && selectedCount > 0 && !isGameRunning && savePathExists && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#101822] border border-[#2d4257] rounded-lg shadow-2xl p-1 max-h-60 overflow-y-auto space-y-1">
                  {/* Top Action: Create New */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddFolderDropdownOpen(false);
                      if (onCreateFolderFromSelection) onCreateFolderFromSelection();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-[#192b1e] text-[#a4d053] hover:text-[#b8e860] transition cursor-pointer text-xs font-semibold border border-dashed border-[#2d5535]"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0 text-[#a4d053]" />
                    <span className="truncate">{t('folders.createNewFolder')}</span>
                  </button>

                  {inGameFolders.length > 0 && (
                    <div className="text-[10px] text-gray-400 px-2 pt-1 font-medium border-t border-[#1d2a38]">
                      {t('folders.selectExistingFolder')}
                    </div>
                  )}

                  {inGameFolders.map(folder => {
                    const inCommon = commonInGameFolders.some(f => f.name === folder.name);
                    const inAny = allInGameFolders.some(f => f.name === folder.name);

                    return (
                      <button
                        key={`add-to-folder-${folder.name}`}
                        type="button"
                        onClick={() => {
                          setIsAddFolderDropdownOpen(false);
                          if (onAssignInGameFolder) {
                            onAssignInGameFolder(
                              folder.name,
                              selectedItems.map(it => String(it.published_file_id || it.id)),
                              foldersMode === 'multi' ? 'add' : 'set'
                            );
                          }
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left hover:bg-[#192635] text-gray-200 hover:text-white transition cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder className="w-3.5 h-3.5 shrink-0 text-[#66c0f4]" />
                          <span className="truncate">{folder.name}</span>
                        </div>
                        <span className="font-mono text-[10px] text-gray-500 shrink-0 ml-1">
                          {inCommon ? t('bulk.inCommonTag') : inAny ? t('bulk.inPartialTag') : '+'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BLOCK: Assigned In-Game Folders (Common / All) */}
            <div className="pt-2 border-t border-[#1e2a38] space-y-1.5 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between gap-1 shrink-0">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-300 min-w-0" title={t('folders.assignedFolders')}>
                  <FolderOpen className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                  <span className="whitespace-nowrap truncate">{t('folders.assignedFolders')}</span>
                </div>

                {/* Mode Toggle [Спільні | Всі] */}
                <div className="flex items-center bg-[#0d141b] border border-[#1f2b38] rounded p-0.5 text-[10px] shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedFoldersTab('common')}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer font-medium ${
                      selectedFoldersTab === 'common'
                        ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Common"
                  >
                    {t('folders.commonFolders')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFoldersTab('all')}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer font-medium ${
                      selectedFoldersTab === 'all'
                        ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="All"
                  >
                    {t('folders.allFolders')}
                  </button>
                </div>
              </div>

              {/* Sequential List of Folders */}
              <div className="flex-1 min-h-[40px] overflow-y-auto pr-0.5 space-y-1">
                {selectedCount === 0 ? (
                  <span className="text-[10.5px] text-gray-500 italic py-1 block">
                    {t('bulk.selectModsToViewCols')}
                  </span>
                ) : (selectedFoldersTab === 'common' ? commonInGameFolders : allInGameFolders).length === 0 && (selectedFoldersTab === 'common' || uncategorizedFoldersCount === 0) ? (
                  <span className="text-[10.5px] text-gray-500 italic py-1 block">
                    {selectedFoldersTab === 'common'
                      ? t('folders.noCommonFolders')
                      : t('folders.notInFolders')}
                  </span>
                ) : (
                  <>
                    {(selectedFoldersTab === 'common' ? commonInGameFolders : allInGameFolders).map(folder => (
                      <div
                        key={`folder-row-${folder.name}`}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs bg-[#101822] hover:bg-[#162332] border border-[#1e2a38] hover:border-[#2a3c50] text-gray-200 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <Folder className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                          <span className="truncate font-medium" title={folder.name}>
                            {folder.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {selectedFoldersTab === 'all' && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#162230] text-[#66c0f4] border border-[#233547]">
                              {folder.count}
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={isGameRunning || !savePathExists}
                            onClick={() => {
                              if (onRemoveFromInGameFolder) {
                                onRemoveFromInGameFolder(
                                  folder.name,
                                  selectedItems.map(it => String(it.published_file_id || it.id))
                                );
                              }
                            }}
                            title={t('folders.removeFromFolder')}
                            className="hover:text-[#ff6b6b] p-1 rounded cursor-pointer transition text-gray-400 hover:bg-[#2d171b] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Uncategorized Row in All mode */}
                    {uncategorizedFoldersCount > 0 && selectedFoldersTab === 'all' && (
                      <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs bg-[#101822] border border-[#1e2a38] text-gray-400">
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <FileQuestion className="w-3.5 h-3.5 text-[#f49e42] shrink-0" />
                          <span className="truncate font-medium italic">
                            {t('folders.uncategorized')}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#162230] text-[#f49e42] border border-[#233547] shrink-0">
                          {uncategorizedFoldersCount}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Remove from all folders button */}
              {selectedCount > 0 && allInGameFolders.length > 0 && (
                <div className="pt-2 border-t border-[#1e2a38] shrink-0">
                  <button
                    type="button"
                    disabled={isGameRunning || !savePathExists}
                    onClick={() => {
                      if (onAssignInGameFolder) {
                        onAssignInGameFolder(
                          null,
                          selectedItems.map(it => String(it.published_file_id || it.id)),
                          'set'
                        );
                      }
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#1c1417] hover:bg-[#2d181c] text-[#ff6b6b] border border-[#4a1f26] text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <Trash2 className="w-3 h-3 shrink-0" />
                    <span>{t('folders.removeFromAllFolders')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Big Apply Plan Button: ALWAYS visible and pinned */}
        <button
          type="button"
          onClick={onOpenPlanModal}
          disabled={pendingActionsCount === 0}
          className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow border ${
            pendingActionsCount > 0
              ? 'bg-[#1c4d28] hover:bg-[#246334] active:bg-[#163d20] text-white border-[#3b8c4c] shadow-lg shadow-green-950/40 active:scale-98 cursor-pointer'
              : 'bg-[#182029] text-gray-500 cursor-not-allowed border-[#202b38]'
          }`}
          title={
            pendingActionsCount > 0
              ? 'Відкрити вікно підтвердження та перегляду плану'
              : 'Заплануйте дії для модів, щоб застосувати їх разом'
          }
        >
          <Play className="w-3.5 h-3.5 fill-current text-[#a4d053]" />
          <span>Застосувати план{pendingActionsCount > 0 ? ` (${pendingActionsCount})` : ''}</span>
        </button>

      </div>

    </aside>
  );
}
