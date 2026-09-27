import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Layers,
  Sparkles,
  Power,
  PowerOff,
  Trash2,
  Edit2,
  MoreVertical,
  X,
  Plus,
  DownloadCloud,
  Check,
  Tag,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function CollectionsSidebar({
  collections = [],
  selectedCollectionId = null,
  onSelectCollection,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onApplyPreset,
  onToggleAllItems,
  onSubscribeMissing,
  onOpenImportModal,
  sidebarWidth = 270,
  sidebarMode = 'collections',
  onModeChange,
  selectedTags = new Set(),
  selectedUserTags = new Set(),
  onToggleTag,
  onToggleUserTag,
  onClearTags
}) {
  const { t, tTag } = useI18n();
  const [isCreating, setIsCreating] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [createError, setCreateError] = useState('');
  const [activeMenuColId, setActiveMenuColId] = useState(null);
  const [editingColId, setEditingColId] = useState(null);
  const [editColName, setEditColName] = useState('');
  const [presetLoadingId, setPresetLoadingId] = useState(null);

  const menuRef = useRef(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!activeMenuColId) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuColId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuColId]);

  const handleCreateSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = newColName.trim();
    if (!trimmed) {
      setCreateError(t('collections.nameEmpty'));
      return;
    }
    try {
      await onCreateCollection(trimmed);
      setNewColName('');
      setIsCreating(false);
      setCreateError('');
    } catch (err) {
      setCreateError(err.message || t('collections.createError'));
    }
  };

  const handleSaveRename = async (colId) => {
    const trimmed = editColName.trim();
    if (!trimmed) return;
    try {
      await onUpdateCollection(colId, { name: trimmed });
      setEditingColId(null);
      setEditColName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleApplyPresetClick = async (colId, e) => {
    e?.stopPropagation();
    setActiveMenuColId(null);
    setPresetLoadingId(colId);
    try {
      await onApplyPreset(colId);
    } finally {
      setPresetLoadingId(null);
    }
  };

  return (
    <aside className="w-full h-full bg-[#171d25] border border-[#22303e] rounded-lg p-2.5 flex flex-col shadow text-xs select-none overflow-hidden">
      
      {/* 1. СИНХРОНІЗОВАНИЙ ТОГЛ [ ТЕГИ | КОЛЕКЦІЇ | ПАПКИ ] */}
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

      {/* АКТИВНІ ФІЛЬТРИ ТЕГІВ В МЕНЮ КОЛЕКЦІЙ */}
      {(selectedTags.size > 0 || selectedUserTags.size > 0) && (
        <div className="pt-2 pb-2 border-b border-[#22303e]/60 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Tag className="w-3.5 h-3.5 text-[#f49e42] shrink-0" />
              <span className="truncate">{t('collections.activeTags', { count: selectedTags.size + selectedUserTags.size })}</span>
            </div>
            <button
              type="button"
              onClick={onClearTags}
              title={t('tags.resetFilters')}
              className="text-[10.5px] text-[#ff6b6b] hover:text-white bg-[#22171a] hover:bg-[#381c22] px-1.5 py-0.5 rounded border border-[#4d232a] hover:border-[#732a35] flex items-center gap-1 shrink-0 transition cursor-pointer select-none"
            >
              <X className="w-3 h-3" />
              <span className="font-semibold">{t('collections.resetTags')}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
            {Array.from(selectedTags).map(tName => (
              <span
                key={`col-active-steam-${tName}`}
                className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#162738] text-[#cce8ff] border border-[#2f557a] flex items-center gap-1 shadow-xs select-none"
              >
                <span className="truncate max-w-[120px]">{tTag(tName)}</span>
                <button
                  type="button"
                  onClick={() => onToggleTag && onToggleTag(tName)}
                  className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                  title={t('context.removeFromFilter')}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {Array.from(selectedUserTags).map(tName => (
              <span
                key={`col-active-user-${tName}`}
                className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#332211] text-[#ffd699] border border-[#5c3e1e] flex items-center gap-1 shadow-xs select-none"
              >
                <span className="truncate max-w-[120px]">{tTag(tName)}</span>
                <button
                  type="button"
                  onClick={() => onToggleUserTag && onToggleUserTag(tName)}
                  className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                  title={t('context.removeFromFilter')}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 2. ЗАГОЛОВОК КОЛЕКЦІЙ ТА КНОПКИ ДІЙ */}
      <div className="pt-2 pb-1.5 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#66c0f4]" />
            <span>{t('collections.title')} ({collections.length})</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenImportModal}
              title={t('collections.importSteam')}
              className="p-1 rounded bg-[#101822] border border-[#233547] text-[#66c0f4] hover:text-white hover:border-[#66c0f4]/60 transition cursor-pointer flex items-center justify-center"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
            </button>
            {!isCreating && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                title={t('collections.newCollection')}
                className="p-1 rounded bg-[#101822] border border-[#233547] text-[#a4d053] hover:text-white hover:border-[#a4d053]/60 transition cursor-pointer flex items-center justify-center"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Create Input */}
        {isCreating && (
          <div className="mt-1.5 mb-0.5">
            <form onSubmit={handleCreateSubmit} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                placeholder={t('collections.namePlaceholder')}
                value={newColName}
                onChange={(e) => {
                  setNewColName(e.target.value);
                  if (createError) setCreateError('');
                }}
                className={`flex-1 bg-[#101822] border ${createError ? 'border-red-500' : 'border-[#2d4358] focus:border-[#a4d053]'} rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none`}
              />
              <button
                type="submit"
                className="bg-[#1e3825] hover:bg-[#284a32] text-[#a4d053] px-2 py-1 rounded text-xs font-semibold border border-[#335c3c] cursor-pointer"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewColName('');
                  setCreateError('');
                }}
                className="text-gray-400 hover:text-white px-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
            {createError && (
              <div className="text-[11px] text-red-400 mt-1 px-1 leading-tight">
                {createError}
              </div>
            )}
          </div>
        )}

        {/* Active Filter Pill (if a collection is selected) */}
        {selectedCollectionId !== null && (
          <div className="mt-2 px-1 flex items-center justify-between bg-[#121c27] border border-[#1e3347] rounded p-1 text-[11px]">
            <span className="text-gray-300 truncate">
              {t('collections.activeFilter')} <strong className="text-[#66c0f4]">{collections.find(c => c.id === selectedCollectionId)?.name || t('collections.title')}</strong>
            </span>
            <button
              type="button"
              onClick={() => onSelectCollection(null)}
              className="text-gray-400 hover:text-[#ff6b6b] p-0.5 rounded cursor-pointer ml-1"
              title={t('collections.clearFilter')}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* 3. ПРОКРУЧУВАНИЙ СПИСОК КОЛЕКЦІЙ */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-1 mt-1 text-xs">
        {collections.length === 0 ? (
          <div className="p-3 text-center rounded bg-[#101822] border border-[#1e2a38] text-gray-500 mt-2 space-y-1">
            <p>{t('collections.noCollections')}</p>
            <p className="text-[10.5px]">{t('collections.noCollectionsHint')}</p>
          </div>
        ) : (
          collections.map((col) => {
            const isSelected = selectedCollectionId === col.id;
            const isMenuOpen = activeMenuColId === col.id;
            const isRenaming = editingColId === col.id;

            return (
              <div
                key={col.id}
                onClick={() => {
                  if (isRenaming) return;
                  // Toggle collection filter
                  onSelectCollection(isSelected ? null : col.id);
                }}
                className={`relative group rounded-md p-1.5 transition border cursor-pointer ${
                  isSelected
                    ? 'bg-[#152433] border-[#385c7a] shadow-sm'
                    : 'bg-[#121922] hover:bg-[#16212d] border-[#1f2b38] hover:border-[#2d3f52]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Folder
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: col.color || '#66c0f4' }}
                    />
                    
                    {isRenaming ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          autoFocus
                          value={editColName}
                          onChange={(e) => setEditColName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(col.id);
                            if (e.key === 'Escape') setEditingColId(null);
                          }}
                          className="flex-1 min-w-0 bg-[#0c1219] border border-[#385c7a] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(col.id)}
                          className="text-[#a4d053] hover:text-white p-0.5 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingColId(null)}
                          className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="truncate font-medium text-gray-200 group-hover:text-white" title={col.name}>
                        {col.name}
                      </div>
                    )}
                  </div>

                  {/* Counts & Action button */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`font-mono text-[10.5px] px-1.5 py-0.2 rounded font-bold ${
                        isSelected
                          ? 'bg-[#2a475e] text-[#66c0f4]'
                          : 'bg-[#182330] text-gray-400 group-hover:text-gray-200'
                      }`}
                      title={t('collections.itemsCount', { count: col.items_count })}
                    >
                      {col.items_count}
                    </span>

                    {/* Context Menu Trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuColId(isMenuOpen ? null : col.id);
                      }}
                      className={`p-1 rounded hover:bg-[#202e3e] text-gray-400 hover:text-white transition cursor-pointer ${
                        isMenuOpen ? 'bg-[#202e3e] text-white' : ''
                      }`}
                      title={t('collections.options')}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub-counters indicators: enabled / disabled / unsubscribed */}
                {col.items_count > 0 && !isRenaming && (
                  <div className="flex items-center gap-2 mt-1 pt-1 border-t border-[#1b2633] text-[9.5px] font-mono text-gray-400">
                    <span className="text-[#a4d053]">
                      {t('collections.enabledCount', { count: col.enabled_count })}
                    </span>
                    <span className="text-[#f49e42]">
                      {t('collections.disabledCount', { count: col.disabled_count })}
                    </span>
                    {col.unsubscribed_count > 0 && (
                      <span className="text-[#ff6b6b]">
                        {t('collections.unsubCount', { count: col.unsubscribed_count })}
                      </span>
                    )}
                  </div>
                )}

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div
                    ref={menuRef}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-1 top-8 z-50 w-48 bg-[#101822] border border-[#2d4257] rounded-lg shadow-2xl p-1 text-xs space-y-0.5"
                  >
                    {/* Apply Preset */}
                    <button
                      type="button"
                      onClick={(e) => handleApplyPresetClick(col.id, e)}
                      disabled={presetLoadingId === col.id}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-gray-200 hover:text-white hover:bg-[#1a2d42] transition cursor-pointer"
                      title={t('collections.presetMode')}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                      <span className="font-semibold text-[11px]">
                        {presetLoadingId === col.id ? t('collections.applyingPreset') : t('collections.applyPreset')}
                      </span>
                    </button>

                    <div className="h-[1px] bg-[#1d2a38] my-0.5" />

                    {/* Enable all */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuColId(null);
                        onToggleAllItems && onToggleAllItems(col.id, true);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-gray-300 hover:text-white hover:bg-[#182330] transition cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5 text-[#a4d053] shrink-0" />
                      <span className="text-[11px]">{t('collections.enableAll')}</span>
                    </button>

                    {/* Disable all */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuColId(null);
                        onToggleAllItems && onToggleAllItems(col.id, false);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-gray-300 hover:text-white hover:bg-[#182330] transition cursor-pointer"
                    >
                      <PowerOff className="w-3.5 h-3.5 text-[#f49e42] shrink-0" />
                      <span className="text-[11px]">{t('collections.disableAll')}</span>
                    </button>

                    {/* Subscribe missing if any */}
                    {col.unsubscribed_count > 0 && onSubscribeMissing && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuColId(null);
                          onSubscribeMissing(col.id);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[#66c0f4] hover:text-white hover:bg-[#1a2b3d] transition cursor-pointer"
                        title={t('collections.subscribeMissing', { count: col.unsubscribed_count })}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px]">{t('collections.subscribeMissing', { count: col.unsubscribed_count })}</span>
                      </button>
                    )}

                    <div className="h-[1px] bg-[#1d2a38] my-0.5" />

                    {/* Steam Workshop link */}
                    {col.steam_collection_id && (
                      <a
                        href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${col.steam_collection_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setActiveMenuColId(null)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-gray-300 hover:text-white hover:bg-[#182330] transition cursor-pointer"
                        title={t('collections.openSteam')}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                        <span className="text-[11px]">{t('collections.openSteam')}</span>
                      </a>
                    )}

                    {/* Rename */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuColId(null);
                        setEditingColId(col.id);
                        setEditColName(col.name);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-gray-300 hover:text-white hover:bg-[#182330] transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-[11px]">{t('collections.rename')}</span>
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuColId(null);
                        if (window.confirm(t('collections.deleteConfirm', { name: col.name }))) {
                          onDeleteCollection(col.id);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[#ff6b6b] hover:text-white hover:bg-[#33181c] transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px]">{t('collections.delete')}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
