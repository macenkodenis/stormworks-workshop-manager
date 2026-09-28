import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  FileUp,
  Upload,
  FolderTree,
  Folder,
  Tag,
  Tags,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
  Trash2,
  Undo,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  ShieldCheck,
  HardDrive,
  CheckSquare,
  Square
} from 'lucide-react';
import { mergeTagTrees, deduplicateTagTree, isUserTagNode, migrateTreeWithChildren } from '../utils/tagUtils';
import { useI18n } from '../i18n/I18nContext';

export function ImportTagsModal({
  isOpen,
  onClose,
  onImportSuccess,
  allUniqueSteamTags = []
}) {
  const { t } = useI18n();
  const [fileData, setFileData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Set of all known Steam tags (for Steam priority)
  const knownSteamTagsSet = useMemo(() => {
    const set = new Set();
    (allUniqueSteamTags || []).forEach(t => set.add(String(t).trim().toLowerCase()));
    (previewData?.known_steam_tags || []).forEach(t => set.add(String(t).trim().toLowerCase()));
    return set;
  }, [allUniqueSteamTags, previewData]);

  // Accordion open/close states
  const [isTreeSectionOpen, setIsTreeSectionOpen] = useState(true);
  const [isItemsSectionOpen, setIsItemsSectionOpen] = useState(true);

  // Section checkboxes
  const [importTree, setImportTree] = useState(true);
  const [treeMode, setTreeMode] = useState('merge'); // 'merge' | 'replace'
  const [importItems, setImportItems] = useState(true);

  // Global items configuration
  const [globalMode, setGlobalMode] = useState('replace'); // 'replace' | 'merge'
  const [hideUnsorted, setHideUnsorted] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Per-item modifications:
  // map from published_file_id -> {
  //   mode: 'replace' | 'merge',
  //   excludedTags: Set<string> (encoded as 'action:type:tagName'),
  //   isExcluded: boolean
  // }
  const [itemOverrides, setItemOverrides] = useState({});

  const fileInputRef = useRef(null);

  // Reset state when modal closes
  const handleClose = () => {
    setFileData(null);
    setPreviewData(null);
    setErrorMsg(null);
    setItemOverrides({});
    onClose();
  };

  const mouseDownTargetRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isApplying) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isApplying]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    setErrorMsg(null);
    setIsLoadingPreview(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const parsed = JSON.parse(text);
        setFileData(parsed);

        // Send to backend preview endpoint
        const res = await fetch('/api/data/import/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: parsed })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || t('importTags.errParse'));
        }

        const preview = await res.json();
        if (!preview) {
          throw new Error(t('importTags.errEmptyResponse'));
        }
        setPreviewData(preview);
        const hasTree = Boolean(preview.has_tag_structure);
        setImportTree(hasTree);
        setIsTreeSectionOpen(hasTree);
        setItemOverrides({});
      } catch (err) {
        setErrorMsg(err.message || t('importTags.errJson'));
      } finally {
        setIsLoadingPreview(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg(t('importTags.errReadDisk'));
      setIsLoadingPreview(false);
    };
    reader.readAsText(file);
  };

  const handleToggleImportTree = (checked) => {
    setImportTree(checked);
    setIsTreeSectionOpen(checked);
  };

  // Helper to toggle tag exclusion for an item
  const handleToggleTag = (itemId, tagKey) => {
    setItemOverrides(prev => {
      const current = prev[itemId] || { mode: globalMode, excludedTags: new Set(), isExcluded: false };
      const nextExcluded = new Set(current.excludedTags || []);
      if (nextExcluded.has(tagKey)) {
        nextExcluded.delete(tagKey);
      } else {
        nextExcluded.add(tagKey);
      }
      return {
        ...prev,
        [itemId]: {
          ...current,
          excludedTags: nextExcluded
        }
      };
    });
  };

  // Helper to toggle an item's mode (replace vs merge)
  const handleToggleItemMode = (itemId) => {
    setItemOverrides(prev => {
      const current = prev[itemId] || { mode: globalMode, excludedTags: new Set(), isExcluded: false };
      const currentMode = current.mode || globalMode;
      const nextMode = currentMode === 'replace' ? 'merge' : 'replace';
      return {
        ...prev,
        [itemId]: {
          ...current,
          mode: nextMode
        }
      };
    });
  };

  // Helper to exclude or restore a mod in the import plan
  const handleToggleExcludeItem = (itemId) => {
    setItemOverrides(prev => {
      const current = prev[itemId] || { mode: globalMode, excludedTags: new Set(), isExcluded: false };
      return {
        ...prev,
        [itemId]: {
          ...current,
          isExcluded: !current.isExcluded
        }
      };
    });
  };

  // Helper to reset a single item to default plan
  const handleResetItem = (itemId) => {
    setItemOverrides(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  // Filter and compute items for display
  const displayItems = useMemo(() => {
    if (!previewData?.matched_items) return [];

    return previewData.matched_items.filter(item => {
      const fid = item.published_file_id;
      const override = itemOverrides[fid] || {};
      const effectiveMode = override.mode || globalMode;
      const diffData = effectiveMode === 'replace' ? item.replace_diff : item.merge_diff;

      // Calculate whether this mod has any pending tag changes
      const hasChanges = (diffData.added_user.length > 0) ||
                         (diffData.added_steam.length > 0) ||
                         (diffData.removed_user && diffData.removed_user.length > 0) ||
                         (diffData.deactivated_steam && diffData.deactivated_steam.length > 0);

      // 1. By default showUnchanged is false: hide mods with no changes
      if (!showUnchanged && !hasChanges) {
        return false;
      }

      // 2. Hide unsorted toggle
      if (hideUnsorted && !item.is_previously_sorted) {
        return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesId = item.published_file_id?.includes(q);
        if (!matchesTitle && !matchesId) return false;
      }
      return true;
    });
  }, [previewData, hideUnsorted, showUnchanged, searchQuery, itemOverrides, globalMode]);

  // Count active items in plan
  const activeItemsCount = useMemo(() => {
    if (!previewData?.matched_items) return 0;
    return previewData.matched_items.filter(item => {
      const override = itemOverrides[item.published_file_id];
      return !override?.isExcluded;
    }).length;
  }, [previewData, itemOverrides]);

  // Handle final Apply
  const handleApply = async () => {
    if (!previewData) return;
    setIsApplying(true);
    setErrorMsg(null);

    try {
      if (previewData.format === 'stormworks_manager_full_backup') {
        // Restore full backup
        const res = await fetch('/api/data/import/restore-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup_data: fileData })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || t('importTags.errRestoreBackup'));
        }
        if (onImportSuccess) onImportSuccess();
        handleClose();
        return;
      }

      // Prepare tag pack payload
      const preparedItems = [];
      if (importItems && previewData.matched_items) {
        for (const item of previewData.matched_items) {
          const fid = item.published_file_id;
          const override = itemOverrides[fid];
          if (override?.isExcluded) {
            continue; // Skipped by user
          }

          const effectiveMode = override?.mode || globalMode;
          const excludedTags = override?.excludedTags || new Set();

          // Calculate final user tags
          let finalUserTags = [];
          if (effectiveMode === 'replace') {
            const added = item.replace_diff.added_user.filter(t => !excludedTags.has(`+user:${t}`));
            const keptFromLocal = item.replace_diff.removed_user.filter(t => excludedTags.has(`-user:${t}`));
            const unchanged = item.current_user_tags.filter(t => !item.replace_diff.removed_user.includes(t));
            finalUserTags = [...new Set([...unchanged, ...keptFromLocal, ...added])];
          } else {
            const added = item.merge_diff.added_user.filter(t => !excludedTags.has(`+user:${t}`));
            finalUserTags = [...new Set([...item.current_user_tags, ...added])];
          }

          // Calculate final active steam tags & deactivated tags
          let finalActiveSteam = [];
          let finalDeactivatedSteam = [];

          if (effectiveMode === 'replace') {
            const addedSteam = item.replace_diff.added_steam.filter(t => !excludedTags.has(`+steam:${t}`));
            const keptSteam = item.replace_diff.deactivated_steam.filter(t => excludedTags.has(`-steam:${t}`));
            const unchangedSteam = item.current_active_steam_tags.filter(t => !item.replace_diff.deactivated_steam.includes(t));
            finalActiveSteam = [...new Set([...unchangedSteam, ...keptSteam, ...addedSteam])];

            const newlyDeactivated = item.replace_diff.deactivated_steam.filter(t => !excludedTags.has(`-steam:${t}`));
            finalDeactivatedSteam = [...new Set(newlyDeactivated)];
          } else {
            const addedSteam = item.merge_diff.added_steam.filter(t => !excludedTags.has(`+steam:${t}`));
            finalActiveSteam = [...new Set([...item.current_active_steam_tags, ...addedSteam])];
            finalDeactivatedSteam = [];
          }

          // Normalize and validate finalUserTags and finalActiveSteam
          const normalizeLeaf = (t) => {
            if (!t) return '';
            const parts = String(t).split('/').filter(Boolean);
            return parts.length > 0 ? parts[parts.length - 1].trim() : String(t).trim();
          };

          const cleanUserTags = [];
          const cleanSteamTags = [...new Set(finalActiveSteam.map(normalizeLeaf).filter(Boolean))];

          finalUserTags.forEach(t => {
            const leaf = normalizeLeaf(t);
            if (!leaf) return;
            if (knownSteamTagsSet && knownSteamTagsSet.has(leaf.toLowerCase())) {
              if (!cleanSteamTags.includes(leaf)) cleanSteamTags.push(leaf);
            } else {
              if (!cleanUserTags.includes(leaf)) cleanUserTags.push(leaf);
            }
          });

          preparedItems.push({
            item_id: fid,
            user_tags: cleanUserTags,
            steam_tags: cleanSteamTags,
            deactivated_steam_tags: finalDeactivatedSteam.map(normalizeLeaf).filter(Boolean)
          });
        }
      }

      // Tree structure resolution with child migration and Steam priority
      let targetTree = null;
      if (importTree && previewData.pack_tag_structure) {
        if (treeMode === 'replace') {
          targetTree = migrateTreeWithChildren(previewData.local_tag_structure, previewData.pack_tag_structure, knownSteamTagsSet);
        } else {
          targetTree = mergeTagTrees(previewData.local_tag_structure, previewData.pack_tag_structure, knownSteamTagsSet);
        }
      }

      const normalizeLeaf = (t) => {
        if (!t) return '';
        const parts = String(t).split('/').filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1].trim() : String(t).trim();
      };

      const cleanCustomTags = (previewData.new_custom_tags || [])
        .map(normalizeLeaf)
        .filter(t => t && (!knownSteamTagsSet || !knownSteamTagsSet.has(t.toLowerCase())));

      const applyPayload = {
        import_tree: Boolean(importTree && targetTree),
        tag_structure: targetTree,
        custom_user_tags: [...new Set(cleanCustomTags)],
        items: preparedItems
      };

      const res = await fetch('/api/data/import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applyPayload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || t('importTags.errApplyChanges'));
      }

      if (onImportSuccess) onImportSuccess();
      handleClose();
    } catch (err) {
      setErrorMsg(err.message || t('importTags.errApplyImport'));
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        if (!isApplying && e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        className="w-full max-w-4xl h-full max-h-[calc(100%-2rem)] max-h-[850px] bg-[#1b2838] border border-[#2a475e] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#c7d5e0] my-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#171d25] border-b border-[#2a475e] shrink-0">
          <div className="flex items-center gap-2.5">
            <FileUp className="w-5 h-5 text-[#66c0f4]" />
            <div>
              <h2 className="text-base font-semibold text-white leading-tight">
                {t('importTags.title')}
              </h2>
              <span className="text-[11px] text-gray-400">
                {t('importTags.subtitle')}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isApplying}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#2a475e] transition cursor-pointer"
            title={t('importTags.closeEsc')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">

          {/* Error notification banner */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#2a171a] border border-[#522328] text-xs text-[#ff9999]">
              <AlertCircle className="w-4 h-4 text-[#ff6b6b] shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="block font-semibold">{t('importTags.errorLabel')}</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* 1. File Upload / Dropzone */}
          {!previewData && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#2d4b68] hover:border-[#66c0f4] bg-[#141e2b]/60 hover:bg-[#162232] rounded-xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.swtags.json,.swbackup.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-[#1b2838] border border-[#2a475e] group-hover:border-[#66c0f4] flex items-center justify-center text-[#66c0f4] transition shadow-lg">
                <Upload className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white group-hover:text-[#66c0f4] transition">
                  {isLoadingPreview ? t('importTags.dropzoneAnalyzing') : t('importTags.dropzoneSelect')}
                </div>
                <p className="text-xs text-gray-400">
                  {t('importTags.supportedFormats', {
                    tagExt: '.swtags.json',
                    backupExt: '.swbackup.json'
                  })}
                </p>
              </div>
              {isLoadingPreview && (
                <div className="flex items-center gap-2 text-xs text-[#66c0f4] mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('importTags.comparing')}</span>
                </div>
              )}
            </div>
          )}

          {/* 2. File loaded: Metadata summary */}
          {previewData && (
            <div className="bg-[#121922] border border-[#233547] rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {previewData.meta?.title || t('importTags.untitledPack')}
                    </span>
                    {previewData.meta?.author && (
                      <span className="text-[11px] bg-[#223447] text-[#66c0f4] px-2 py-0.5 rounded font-medium border border-[#314b66]">
                        {t('importTags.author', { author: previewData.meta.author })}
                      </span>
                    )}
                  </div>
                  {previewData.meta?.description && (
                    <p className="text-xs text-gray-400 mt-1">
                      {previewData.meta.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFileData(null);
                    setPreviewData(null);
                  }}
                  className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded bg-[#1b2633] hover:bg-[#233242] border border-[#2a3c50] transition cursor-pointer shrink-0"
                >
                  {t('importTags.changeFile')}
                </button>
              </div>

              {/* Summary Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#1e2a38]">
                <div className="bg-[#17212d] border border-[#233345] rounded-lg p-2">
                  <span className="text-[10px] text-gray-400 block">{t('importTags.inYourCollection')}</span>
                  <div className="text-base font-bold text-white mt-0.5">
                    {previewData.matched_count || 0}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      / {previewData.total_pack_items || 0}
                    </span>
                  </div>
                </div>

                <div className="bg-[#17212d] border border-[#233345] rounded-lg p-2">
                  <span className="text-[10px] text-gray-400 block">{t('importTags.newCustomTags')}</span>
                  <div className="text-base font-bold text-[#f49e42] mt-0.5">
                    +{previewData.new_custom_tags?.length || 0}
                  </div>
                </div>

                <div className="bg-[#17212d] border border-[#233345] rounded-lg p-2">
                  <span className="text-[10px] text-gray-400 block">{t('importTags.treeStructure')}</span>
                  <div className="text-base font-bold text-[#66c0f4] mt-0.5">
                    {previewData.has_tag_structure ? t('importTags.structurePresent') : t('importTags.structureAbsent')}
                  </div>
                </div>

                <div className="bg-[#17212d] border border-[#233345] rounded-lg p-2">
                  <span className="text-[10px] text-gray-400 block">{t('importTags.dataFormat')}</span>
                  <div className="text-xs font-mono font-bold text-[#a4d053] mt-1 truncate">
                    {previewData.format}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full Backup Restore Card */}
          {previewData?.format === 'stormworks_manager_full_backup' && (
            <div className="bg-[#142618] border border-[#2b5936] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#a4d053]">
                <HardDrive className="w-5 h-5" />
                <span>{t('importTags.fullBackupDetected')}</span>
              </div>
              <p className="text-xs text-gray-300">
                {t('importTags.fullBackupDesc', { count: previewData.items_count })}
              </p>
            </div>
          )}

          {/* TAG PACK: SECTION 1 - Tree Structure (Accordion with Checkbox) */}
          {previewData?.format === 'stormworks_tag_pack' && (
            <div className="border border-[#233547] rounded-xl overflow-hidden bg-[#121922]">
              {/* Accordion Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#17202c] border-b border-[#233547]">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={importTree}
                    onChange={(e) => handleToggleImportTree(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-[#66c0f4] focus:ring-[#66c0f4] cursor-pointer accent-[#66c0f4]"
                  />
                  <FolderTree className="w-4 h-4 text-[#66c0f4]" />
                  <span className="text-sm font-semibold text-white">
                    {t('importTags.sec1Title')}
                  </span>
                  {previewData.has_tag_structure && (
                    <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-[#172e1e] text-[#a4d053] border border-[#2b5936]">
                      {t('importTags.inPackBadge')}
                    </span>
                  )}
                </label>

                {importTree && (
                  <button
                    type="button"
                    onClick={() => setIsTreeSectionOpen(!isTreeSectionOpen)}
                    className="p-1 text-gray-400 hover:text-white transition cursor-pointer"
                  >
                    {isTreeSectionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Accordion Body: ONLY rendered if importTree is true AND isTreeSectionOpen is true */}
              {importTree && isTreeSectionOpen && (
                <div className="p-4 space-y-4">
                  <p className="text-xs text-gray-400">
                    {t('importTags.chooseMergeMode')}
                  </p>

                  {/* Mode selector */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className={`flex-1 flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                      treeMode === 'merge'
                        ? 'bg-[#1a2d42] border-[#66c0f4] text-white shadow'
                        : 'bg-[#101822] border-[#233547] text-gray-400 hover:text-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="treeMode"
                        value="merge"
                        checked={treeMode === 'merge'}
                        onChange={() => setTreeMode('merge')}
                        className="mt-0.5 accent-[#66c0f4]"
                      />
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold">{t('importTags.mergeTitle')}</div>
                        <div className="text-[11px] text-gray-400 leading-normal">
                          {t('importTags.mergeDesc')}
                        </div>
                      </div>
                    </label>

                    <label className={`flex-1 flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                      treeMode === 'replace'
                        ? 'bg-[#1a2d42] border-[#66c0f4] text-white shadow'
                        : 'bg-[#101822] border-[#233547] text-gray-400 hover:text-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="treeMode"
                        value="replace"
                        checked={treeMode === 'replace'}
                        onChange={() => setTreeMode('replace')}
                        className="mt-0.5 accent-[#66c0f4]"
                      />
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold">{t('importTags.replaceTitle')}</div>
                        <div className="text-[11px] text-gray-400 leading-normal">
                          {t('importTags.replaceDesc')}
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Comparative Tree Diff View (До / Після) */}
                  <TreeDiffViewer
                    localTree={previewData.local_tag_structure || []}
                    packTree={previewData.pack_tag_structure || []}
                    mode={treeMode}
                    knownSteamTagsSet={knownSteamTagsSet}
                  />

                </div>
              )}
            </div>
          )}

          {/* TAG PACK: SECTION 2 - Mod Tags & Diff View (Accordion with Checkbox) */}
          {previewData?.format === 'stormworks_tag_pack' && (
            <div className="border border-[#233547] rounded-xl overflow-hidden bg-[#121922]">
              {/* Accordion Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#17202c] border-b border-[#233547]">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={importItems}
                    onChange={(e) => setImportItems(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-[#66c0f4] focus:ring-[#66c0f4] cursor-pointer accent-[#66c0f4]"
                  />
                  <Tags className="w-4 h-4 text-[#f49e42]" />
                  <span className="text-sm font-semibold text-white">
                    {t('importTags.sec2Title', { count: activeItemsCount })}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsItemsSectionOpen(!isItemsSectionOpen)}
                  className="p-1 text-gray-400 hover:text-white transition cursor-pointer"
                >
                  {isItemsSectionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {/* Accordion Body */}
              {isItemsSectionOpen && (
                <div className={`p-4 space-y-3 transition-opacity ${importItems ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  
                  {/* Toolbar: Unified style settings + Search input in a single sleek row */}
                  <div className="flex items-center gap-2 pb-3 border-b border-[#1e2a38]">
                    
                    {/* Left: Mode Switch & Filter Buttons in unified style & height (h-8) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      
                      {/* 1. Global Mode Segmented Control */}
                      <div className="h-8 inline-flex items-center rounded-lg bg-[#0c1219] p-0.5 border border-[#233547]">
                        <button
                          type="button"
                          onClick={() => setGlobalMode('replace')}
                          className={`h-full px-2.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                            globalMode === 'replace'
                              ? 'bg-[#1b344d] text-[#66c0f4] shadow-xs'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          title={t('importTags.replaceTooltip')}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${globalMode === 'replace' ? 'bg-[#66c0f4]' : 'bg-transparent'}`} />
                          <span>{t('importTags.replaceBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGlobalMode('merge')}
                          className={`h-full px-2.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                            globalMode === 'merge'
                              ? 'bg-[#1b344d] text-[#66c0f4] shadow-xs'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          title={t('importTags.mergeTooltip')}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${globalMode === 'merge' ? 'bg-[#66c0f4]' : 'bg-transparent'}`} />
                          <span>{t('importTags.mergeBtn')}</span>
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="h-4 w-px bg-[#233547] mx-0.5 hidden sm:block" />

                      {/* 2. Quick Filter: Hide Unsorted Mods */}
                      <button
                        type="button"
                        onClick={() => setHideUnsorted(!hideUnsorted)}
                        className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium border transition cursor-pointer select-none ${
                          hideUnsorted
                            ? 'bg-[#162a3d] text-[#66c0f4] border-[#355b82]'
                            : 'bg-[#0c1219] text-gray-400 border-[#233547] hover:bg-[#141e2b] hover:text-white'
                        }`}
                        title={t('importTags.hideUnsortedTooltip')}
                      >
                        {hideUnsorted ? <EyeOff className="w-3.5 h-3.5 text-[#66c0f4]" /> : <Eye className="w-3.5 h-3.5 text-gray-500" />}
                        <span>{t('importTags.hideUnsortedBtn')}</span>
                      </button>

                      {/* 3. Filter: Show Unchanged Mods */}
                      <button
                        type="button"
                        onClick={() => setShowUnchanged(!showUnchanged)}
                        className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium border transition cursor-pointer select-none ${
                          showUnchanged
                            ? 'bg-[#162a3d] text-[#66c0f4] border-[#355b82]'
                            : 'bg-[#0c1219] text-gray-400 border-[#233547] hover:bg-[#141e2b] hover:text-white'
                        }`}
                        title={t('importTags.showUnchangedTooltip')}
                      >
                        {showUnchanged ? <CheckSquare className="w-3.5 h-3.5 text-[#66c0f4]" /> : <Square className="w-3.5 h-3.5 text-gray-500" />}
                        <span>{t('importTags.unchangedBtn')}</span>
                      </button>

                    </div>

                    {/* Right: Search Input (stays firmly on the same line, expands dynamically) */}
                    <div className="relative min-w-[130px] max-w-[220px] flex-1 ml-auto">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder={t('importTags.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-8 bg-[#0c1219] border border-[#233547] rounded-lg pl-8 pr-7 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#66c0f4] transition"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
                          title={t('importTags.clearSearchTooltip')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Mods Diff List */}
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {displayItems.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-500">
                        {searchQuery.trim()
                          ? t('importTags.noModsFoundSearch')
                          : t('importTags.noModsFoundFilter')}
                      </div>
                    ) : (
                      displayItems.map((item) => {
                        const fid = item.published_file_id;
                        const override = itemOverrides[fid] || {};
                        const isExcluded = Boolean(override.isExcluded);
                        const effectiveMode = override.mode || globalMode;
                        const excludedTags = override.excludedTags || new Set();

                        // Compute active diff lists based on mode
                        const diffData = effectiveMode === 'replace' ? item.replace_diff : item.merge_diff;

                        const hasChanges = (diffData.added_user.length > 0) ||
                                           (diffData.added_steam.length > 0) ||
                                           (diffData.removed_user && diffData.removed_user.length > 0) ||
                                           (diffData.deactivated_steam && diffData.deactivated_steam.length > 0);

                        return (
                          <div
                            key={fid}
                            className={`rounded-lg border p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-150 ${
                              isExcluded
                                ? 'bg-[#0f141a] border-[#182029] opacity-40'
                                : 'bg-[#101822] border-[#223347] hover:border-[#2f4966]'
                            }`}
                          >
                            {/* Left: Info & Badges */}
                            <div className="space-y-1.5 flex-1 min-w-0">
                              
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold truncate max-w-sm ${isExcluded ? 'line-through text-gray-500' : 'text-white'}`}>
                                  {item.title}
                                </span>
                                <span className="text-[10px] font-mono text-gray-500">
                                  ID: {fid}
                                </span>

                                {/* Status badge */}
                                {item.is_previously_sorted ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-[#1a2d42] text-[#66c0f4] border border-[#2d4d6e]">
                                    {t('importTags.badgeSorted')}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-[#161c24] text-gray-400 border border-[#242c38]">
                                    {t('importTags.badgeUnsorted')}
                                  </span>
                                )}

                                {isExcluded && (
                                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-[#2a171a] text-[#ff6b6b] border border-[#522328]">
                                    {t('importTags.badgeExcluded')}
                                  </span>
                                )}
                              </div>

                              {/* Interactive Tag Badges */}
                              {!isExcluded && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* 1. Added User Tags (+) -> ORANGE */}
                                  {diffData.added_user.map(tag => {
                                    const key = `+user:${tag}`;
                                    const isTagExcluded = excludedTags.has(key);
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleToggleTag(fid, key)}
                                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium transition cursor-pointer border select-none ${
                                          isTagExcluded
                                            ? 'bg-[#161d26] text-gray-600 border-[#222b37] line-through opacity-40'
                                            : 'bg-[#2a1d12] text-[#f49e42] border-[#54361e] hover:bg-[#3d2716]'
                                        }`}
                                        title={isTagExcluded ? t('importTags.tagExcludeTooltip') : t('importTags.addUserTagTooltip')}
                                      >
                                        + {tag}
                                      </button>
                                    );
                                  })}

                                  {/* 2. Added Steam Tags (+) -> BLUE (No '(Steam)' suffix) */}
                                  {diffData.added_steam.map(tag => {
                                    const key = `+steam:${tag}`;
                                    const isTagExcluded = excludedTags.has(key);
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleToggleTag(fid, key)}
                                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium transition cursor-pointer border select-none ${
                                          isTagExcluded
                                            ? 'bg-[#161d26] text-gray-600 border-[#222b37] line-through opacity-40'
                                            : 'bg-[#172535] text-[#66c0f4] border-[#24425e] hover:bg-[#20364c]'
                                        }`}
                                        title={isTagExcluded ? t('importTags.tagExcludeTooltip') : t('importTags.addSteamTagTooltip')}
                                      >
                                        + {tag}
                                      </button>
                                    );
                                  })}

                                  {/* 3. Removed User Tags (-) -> RED */}
                                  {diffData.removed_user?.map(tag => {
                                    const key = `-user:${tag}`;
                                    const isTagExcluded = excludedTags.has(key);
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleToggleTag(fid, key)}
                                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium transition cursor-pointer border select-none ${
                                          isTagExcluded
                                            ? 'bg-[#161d26] text-gray-600 border-[#222b37] line-through opacity-40'
                                            : 'bg-[#291418] text-[#ff6b6b] border-[#522129] hover:bg-[#3d1a21]'
                                        }`}
                                        title={isTagExcluded ? t('importTags.removeUserTagCancelTooltip') : t('importTags.removeUserTagTooltip')}
                                      >
                                        - {tag}
                                      </button>
                                    );
                                  })}

                                  {/* 4. Deactivated Steam Tags (-) -> RED (No '(Steam)' suffix) */}
                                  {diffData.deactivated_steam?.map(tag => {
                                    const key = `-steam:${tag}`;
                                    const isTagExcluded = excludedTags.has(key);
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleToggleTag(fid, key)}
                                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium transition cursor-pointer border select-none ${
                                          isTagExcluded
                                            ? 'bg-[#161d26] text-gray-600 border-[#222b37] line-through opacity-40'
                                            : 'bg-[#291418] text-[#ff6b6b] border-[#522129] hover:bg-[#3d1a21]'
                                        }`}
                                        title={isTagExcluded ? t('importTags.deactivateSteamCancelTooltip') : t('importTags.deactivateSteamTooltip')}
                                      >
                                        - {tag}
                                      </button>
                                    );
                                  })}

                                  {/* Unchanged note */}
                                  {!hasChanges && (
                                    <span className="text-[11px] text-gray-500 italic">
                                      {t('importTags.tagsIdentical')}
                                    </span>
                                  )}
                                </div>
                              )}

                            </div>

                            {/* Right: Actions for this mod */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              
                              {/* 1. Toggle Mode Button (Replace vs Merge) */}
                              {!isExcluded && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleItemMode(fid)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer ${
                                    effectiveMode === 'replace'
                                      ? 'bg-[#1d2d3e] text-[#66c0f4] border-[#2e4966] hover:bg-[#25394f]'
                                      : 'bg-[#262f1c] text-[#a4d053] border-[#3f522b] hover:bg-[#313c23]'
                                  }`}
                                  title={t('importTags.itemModeTooltip', {
                                    mode: effectiveMode === 'replace' ? 'Replace' : 'Merge'
                                  })}
                                >
                                  {effectiveMode === 'replace' ? t('importTags.modeReplaceBadge') : t('importTags.modeMergeBadge')}
                                </button>
                              )}

                              {/* 2. Reset Button (Restore default from file) */}
                              {override && Object.keys(override).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleResetItem(fid)}
                                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1e2a38] transition cursor-pointer"
                                  title={t('importTags.resetItemTooltip')}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 3. Exclude / Restore Button */}
                              {isExcluded ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleExcludeItem(fid)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-[#1c2e22] text-[#a4d053] border border-[#2b5936] hover:bg-[#25422e] transition cursor-pointer"
                                  title={t('importTags.restoreModTooltip')}
                                >
                                  <Undo className="w-3 h-3" />
                                  <span>{t('importTags.restoreBtn')}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleExcludeItem(fid)}
                                  className="p-1 rounded text-gray-400 hover:text-[#ff6b6b] hover:bg-[#29181b] transition cursor-pointer"
                                  title={t('importTags.excludeModTooltip')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#171d25] border-t border-[#2a475e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <ShieldCheck className="w-4 h-4 text-[#a4d053]" />
            <span className="hidden sm:inline">
              {t('importTags.safetyBackupNote')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isApplying}
              onClick={handleClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-[#1a232e] hover:bg-[#23303f] transition cursor-pointer"
            >
              {t('importTags.cancel')}
            </button>

            {previewData && (
              <button
                type="button"
                disabled={isApplying || (!importTree && !importItems)}
                onClick={handleApply}
                className="px-5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1c4d28] hover:bg-[#246334] active:bg-[#163d20] border border-[#3b8c4c] shadow transition cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isApplying
                    ? t('importTags.applying')
                    : previewData.format === 'stormworks_manager_full_backup'
                    ? t('importTags.restoreBackupBtn')
                    : t('importTags.applyChangesBtn', { count: activeItemsCount })}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Single Tree Node Item with real hierarchy, depth indentation, tree lines and expand/collapse
function TreeNodeItem({ node, depth = 0, isTarget, localKeySet, packKeySet, mode, collapsedIds, onToggleCollapse, knownSteamTagsSet = null }) {
  const { t } = useI18n();
  const isFolder = node.type === 'folder';
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isUserTag = !isFolder && isUserTagNode(node, knownSteamTagsSet);
  const compareKey = isFolder
    ? `folder:${String(node.name || '').trim().toLowerCase()}`
    : `tag:${String(node.tag || '').trim().toLowerCase()}`;
  const nodeKey = node.id || compareKey;
  const isCollapsed = collapsedIds.has(nodeKey);

  const isNew = isTarget && !localKeySet.has(compareKey);
  const isRemoved = !isTarget && mode === 'replace' && !packKeySet.has(compareKey);

  return (
    <div className="flex flex-col select-none">
      <div
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        className={`group flex items-center justify-between py-1 px-1.5 rounded text-xs transition my-0.5 ${
          isNew
            ? 'bg-[#142618] border border-[#2b5936] text-[#a4d053]'
            : isRemoved
            ? 'bg-[#291418] border border-[#522129] text-[#ff6b6b] line-through opacity-60'
            : 'hover:bg-[#141e2b] text-gray-300'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate mr-2">
          {/* Tree hierarchy branch marker if depth > 0 */}
          {depth > 0 && (
            <span className="text-gray-600 font-mono text-[10px] shrink-0 select-none">
              └─
            </span>
          )}

          {/* Expand/Collapse Chevron for parents with children */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(nodeKey);
              }}
              className="p-0.5 rounded hover:bg-[#223347] text-gray-400 hover:text-white shrink-0 transition cursor-pointer"
              title={isCollapsed ? t('importTags.expandSubtags') : t('importTags.collapseSubtags')}
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-3.5 h-3.5 shrink-0" />
          )}

          {/* Folder or Tag Icon */}
          {isFolder ? (
            <Folder className={`w-3.5 h-3.5 shrink-0 ${isNew ? 'text-[#a4d053]' : isRemoved ? 'text-[#ff6b6b]' : 'text-[#66c0f4]'}`} />
          ) : (
            <Tag className={`w-3 h-3 shrink-0 ${isUserTag ? 'text-[#f49e42]' : 'text-[#66c0f4]'}`} />
          )}

          {/* Tag Name Pill or Folder Name */}
          <span className={`truncate font-medium ${
            isFolder
              ? 'font-bold text-white'
              : isUserTag
              ? 'text-[#f49e42]'
              : 'text-[#66c0f4]'
          }`}>
            {isFolder ? node.name : node.tag}
          </span>

          {/* Sub-tag count badge if parent has children */}
          {hasChildren && (
            <span className="text-[10px] text-gray-500 font-mono ml-0.5">
              ({node.children.length})
            </span>
          )}
        </div>

        {/* Right: New or Removed badge */}
        <div className="shrink-0 flex items-center">
          {isNew && (
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-[#204526] text-[#a4d053] border border-[#2e6638] shadow-xs">
              {t('importTags.badgeNew')}
            </span>
          )}
          {isRemoved && (
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-[#3b171c] text-[#ff6b6b] border border-[#5c222a] shadow-xs">
              {t('importTags.badgeRemoved')}
            </span>
          )}
        </div>
      </div>

      {/* Recursively render children if expanded */}
      {hasChildren && !isCollapsed && (
        <div className="border-l border-[#1e2a38] ml-2.5">
          {node.children.map((childNode, idx) => (
            <TreeNodeItem
              key={childNode.id || `${nodeKey}-c-${idx}`}
              node={childNode}
              depth={depth + 1}
              isTarget={isTarget}
              localKeySet={localKeySet}
              packKeySet={packKeySet}
              mode={mode}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
              knownSteamTagsSet={knownSteamTagsSet}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Tree Diff Viewer with Side-by-Side Before/After and Real Hierarchy
function TreeDiffViewer({ localTree = [], packTree = [], mode = 'merge', knownSteamTagsSet = null }) {
  const { t } = useI18n();
  const [collapsedIds, setCollapsedIds] = useState(new Set());

  const handleToggleCollapse = (nodeKey) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedIds(new Set());
  };

  const handleCollapseAll = (treeData) => {
    const allParentKeys = new Set();
    const collect = (nodes) => {
      (nodes || []).forEach(n => {
        if (Array.isArray(n.children) && n.children.length > 0) {
          const isFolder = n.type === 'folder';
          const k = n.id || (isFolder ? `folder:${String(n.name || '').trim().toLowerCase()}` : `tag:${String(n.tag || '').trim().toLowerCase()}`);
          allParentKeys.add(k);
          collect(n.children);
        }
      });
    };
    collect(localTree);
    collect(packTree);
    setCollapsedIds(allParentKeys);
  };

  // Collect all keys from localTree (strictly keyed by tag name)
  const localKeySet = useMemo(() => {
    const set = new Set();
    const collect = (list) => {
      (list || []).forEach(n => {
        const isFolder = n.type === 'folder';
        const key = isFolder ? `folder:${String(n.name || '').trim().toLowerCase()}` : `tag:${String(n.tag || '').trim().toLowerCase()}`;
        set.add(key);
        if (Array.isArray(n.children)) collect(n.children);
      });
    };
    collect(localTree);
    return set;
  }, [localTree]);

  // Collect all keys from packTree (strictly keyed by tag name)
  const packKeySet = useMemo(() => {
    const set = new Set();
    const collect = (list) => {
      (list || []).forEach(n => {
        const isFolder = n.type === 'folder';
        const key = isFolder ? `folder:${String(n.name || '').trim().toLowerCase()}` : `tag:${String(n.tag || '').trim().toLowerCase()}`;
        set.add(key);
        if (Array.isArray(n.children)) collect(n.children);
      });
    };
    collect(packTree);
    return set;
  }, [packTree]);

  // Compute resulting target tree (deeply and recursively merged with uniqueness and child migration)
  const targetTree = useMemo(() => {
    if (mode === 'replace') return migrateTreeWithChildren(localTree, packTree, knownSteamTagsSet);
    return mergeTagTrees(localTree, packTree, knownSteamTagsSet);
  }, [localTree, packTree, mode, knownSteamTagsSet]);

  // Count new nodes in target tree
  const newCount = useMemo(() => {
    let count = 0;
    const countNew = (list) => {
      (list || []).forEach(n => {
        const isFolder = n.type === 'folder';
        const key = isFolder ? `folder:${String(n.name || '').trim().toLowerCase()}` : `tag:${String(n.tag || '').trim().toLowerCase()}`;
        if (!localKeySet.has(key)) count++;
        if (Array.isArray(n.children)) countNew(n.children);
      });
    };
    countNew(targetTree);
    return count;
  }, [targetTree, localKeySet]);

  return (
    <div className="space-y-2 pt-1">
      
      {/* Top Header Controls for Tree Diff */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-300">{t('importTags.treeDiffAnalysis')}</span>
          {newCount > 0 && (
            <span className="text-[#a4d053] font-semibold text-[11px] bg-[#142618] px-2 py-0.5 rounded border border-[#2b5936]">
              {t('importTags.newElementsCount', { count: newCount })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExpandAll}
            className="text-[11px] px-2 py-0.5 rounded bg-[#101822] hover:bg-[#1b2633] text-gray-300 hover:text-white border border-[#233547] transition cursor-pointer"
          >
            {t('importTags.expandAll')}
          </button>
          <button
            type="button"
            onClick={() => handleCollapseAll()}
            className="text-[11px] px-2 py-0.5 rounded bg-[#101822] hover:bg-[#1b2633] text-gray-300 hover:text-white border border-[#233547] transition cursor-pointer"
          >
            {t('importTags.collapseAll')}
          </button>
        </div>
      </div>

      {/* Two-Column Side-by-Side Tree View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        
        {/* Left Column: Before (Local Current Tree) */}
        <div className="bg-[#0b1016] border border-[#1e2a38] rounded-lg p-2.5 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1b2633] text-[11px] font-semibold text-gray-400">
            <span className="text-gray-300 font-bold">{t('importTags.treeBefore')}</span>
            <span className="text-gray-500 font-mono">{t('importTags.rootNodesCount', { count: (localTree || []).length })}</span>
          </div>
          <div className="max-h-60 overflow-y-auto pr-1 space-y-0.5">
            {(!localTree || localTree.length === 0) ? (
              <div className="text-[11px] text-gray-500 italic p-2">{t('importTags.emptyCategories')}</div>
            ) : (
              localTree.map((node, idx) => (
                <TreeNodeItem
                  key={node.id || `loc-${idx}`}
                  node={node}
                  depth={0}
                  isTarget={false}
                  localKeySet={localKeySet}
                  packKeySet={packKeySet}
                  mode={mode}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={handleToggleCollapse}
                  knownSteamTagsSet={knownSteamTagsSet}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column: After (Target Tree Result) */}
        <div className="bg-[#0b1016] border border-[#1e2a38] rounded-lg p-2.5 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1b2633] text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-[#66c0f4] font-bold">
              <span>{t('importTags.treeAfter')}</span>
              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-[#172535] text-[#66c0f4] border border-[#24425e]">
                {mode === 'replace' ? t('importTags.modeReplaceBadge') : t('importTags.modeMergeResult')}
              </span>
            </span>
            <span className="text-gray-500 font-mono">{t('importTags.rootNodesCount', { count: targetTree.length })}</span>
          </div>
          <div className="max-h-60 overflow-y-auto pr-1 space-y-0.5">
            {(!targetTree || targetTree.length === 0) ? (
              <div className="text-[11px] text-gray-500 italic p-2">{t('importTags.emptyCategories')}</div>
            ) : (
              targetTree.map((node, idx) => (
                <TreeNodeItem
                  key={node.id || `tgt-${idx}`}
                  node={node}
                  depth={0}
                  isTarget={true}
                  localKeySet={localKeySet}
                  packKeySet={packKeySet}
                  mode={mode}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={handleToggleCollapse}
                  knownSteamTagsSet={knownSteamTagsSet}
                />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}


