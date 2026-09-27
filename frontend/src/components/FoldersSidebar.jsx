import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  MoreVertical,
  X,
  Check,
  Tag,
  AlertTriangle,
  FolderPlus,
  FileQuestion
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function FoldersSidebar({
  folders = [],
  selectedFolder = null,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  sidebarMode = 'folders',
  onModeChange,
  isGameRunning = false,
  savePathExists = true,
  uncategorizedCount = 0,
  selectedTags = new Set(),
  selectedUserTags = new Set(),
  onToggleTag,
  onToggleUserTag,
  onClearTags
}) {
  const { t, tTag } = useI18n();
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState('');
  const [activeMenuFolderName, setActiveMenuFolderName] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState(null);
  const [editFolderNameInput, setEditFolderNameInput] = useState('');

  const menuRef = useRef(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!activeMenuFolderName) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuFolderName(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuFolderName]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setIsCreating(false);
      return;
    }
    try {
      setCreateError('');
      await onCreateFolder(trimmed);
      setNewFolderName('');
      setIsCreating(false);
    } catch (err) {
      setCreateError(err.message || String(err));
    }
  };

  const handleStartRename = (folderName, e) => {
    e?.stopPropagation();
    setActiveMenuFolderName(null);
    setEditingFolderName(folderName);
    setEditFolderNameInput(folderName);
  };

  const handleSaveRename = async (folderName) => {
    const trimmed = editFolderNameInput.trim();
    if (!trimmed || trimmed === folderName) {
      setEditingFolderName(null);
      return;
    }
    try {
      await onRenameFolder(folderName, trimmed);
      setEditingFolderName(null);
      setEditFolderNameInput('');
    } catch (err) {
      console.error(err);
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

      {/* GAME RUNNING WARNING / SAVE NOT FOUND */}
      {isGameRunning && (
        <div className="my-1.5 p-1.5 bg-[#3a1a14] border border-[#7a3324] rounded text-[10.5px] text-[#ffb4a2] flex items-center gap-1.5 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-[#ff6b6b] shrink-0" />
          <span className="leading-tight">{t('folders.gameRunningWarning')}</span>
        </div>
      )}

      {!savePathExists && (
        <div className="my-1.5 p-1.5 bg-[#332211] border border-[#664422] rounded text-[10.5px] text-[#ffd699] flex items-center gap-1.5 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-[#f49e42] shrink-0" />
          <span className="leading-tight">{t('folders.saveNotFound')}</span>
        </div>
      )}

      {/* АКТИВНІ ФІЛЬТРИ ТЕГІВ */}
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

      {/* 2. ЗАГОЛОВОК ПАПОК ТА КНОПКА СТВОРЕННЯ */}
      <div className="pt-2 pb-1.5 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-[#66c0f4]" />
            <span>{t('folders.title')} ({folders.length})</span>
          </div>

          <div className="flex items-center gap-1">
            {!isCreating && (
              <button
                type="button"
                disabled={isGameRunning || !savePathExists}
                onClick={() => setIsCreating(true)}
                title={t('folders.newFolder')}
                className={`p-1 rounded bg-[#101822] border transition flex items-center justify-center ${
                  isGameRunning || !savePathExists
                    ? 'border-[#1e2834] text-gray-600 cursor-not-allowed opacity-50'
                    : 'border-[#233547] text-[#a4d053] hover:text-white hover:border-[#a4d053]/60 cursor-pointer'
                }`}
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
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t('folders.folderNamePlaceholder')}
                className="flex-1 bg-[#101822] border border-[#3b5978] rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#66c0f4]"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewFolderName('');
                    setCreateError('');
                  }
                }}
              />
              <button
                type="submit"
                className="p-1 rounded bg-[#1f3b26] hover:bg-[#285033] text-[#a4d053] border border-[#2d5c3a] transition cursor-pointer"
                title={t('folders.create')}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewFolderName('');
                  setCreateError('');
                }}
                className="p-1 rounded bg-[#2e1d20] hover:bg-[#3d2429] text-[#ff6b6b] border border-[#522b31] transition cursor-pointer"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
            {createError && (
              <span className="text-[10px] text-[#ff6b6b] px-1 mt-0.5 block">{createError}</span>
            )}
          </div>
        )}
      </div>

      {/* 3. СПИСОК ПАПОК (СКРОЛЛЮВАНИЙ) */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 mt-1 min-h-0">
        
        {/* Усі крафти (скидання вибору папки) */}
        <div
          onClick={() => onSelectFolder && onSelectFolder(null)}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition border text-xs select-none ${
            selectedFolder === null
              ? 'bg-[#203449] border-[#38628b] text-white font-medium shadow-xs'
              : 'bg-[#121922] hover:bg-[#1a2533] border-[#1d2b3a] text-gray-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${selectedFolder === null ? 'text-[#66c0f4]' : 'text-gray-400'}`} />
            <span className="truncate">{t('folders.allMods')}</span>
          </div>
        </div>

        {/* Без папки */}
        <div
          onClick={() => onSelectFolder && onSelectFolder('__UNCATEGORIZED__')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition border text-xs select-none ${
            selectedFolder === '__UNCATEGORIZED__'
              ? 'bg-[#203449] border-[#38628b] text-white font-medium shadow-xs'
              : 'bg-[#121922] hover:bg-[#1a2533] border-[#1d2b3a] text-gray-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileQuestion className={`w-3.5 h-3.5 shrink-0 ${selectedFolder === '__UNCATEGORIZED__' ? 'text-[#f49e42]' : 'text-gray-400'}`} />
            <span className="truncate">{t('folders.uncategorized')}</span>
          </div>
          <span className="text-[10px] text-gray-400 bg-[#0d131a] px-1.5 py-0.5 rounded border border-[#1b2736] shrink-0 font-mono">
            {uncategorizedCount}
          </span>
        </div>

        {/* Користувацькі папки з save.xml */}
        {folders.map(folder => {
          const isSelected = selectedFolder === folder.name;
          const isEditing = editingFolderName === folder.name;
          const isMenuOpen = activeMenuFolderName === folder.name;

          return (
            <div
              key={`ingame-folder-${folder.name}`}
              onClick={() => {
                if (!isEditing) {
                  onSelectFolder && onSelectFolder(isSelected ? null : folder.name);
                }
              }}
              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition border text-xs relative select-none ${
                isSelected
                  ? 'bg-[#203449] border-[#38628b] text-white font-medium shadow-xs'
                  : 'bg-[#121922] hover:bg-[#1a2533] border-[#1d2b3a] text-gray-300 hover:text-white'
              }`}
            >
              {isEditing ? (
                <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    autoFocus
                    value={editFolderNameInput}
                    onChange={(e) => setEditFolderNameInput(e.target.value)}
                    className="flex-1 bg-[#0d131a] border border-[#3b5978] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#66c0f4]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(folder.name);
                      if (e.key === 'Escape') setEditingFolderName(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveRename(folder.name)}
                    className="p-1 text-[#a4d053] hover:text-white cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingFolderName(null)}
                    className="p-1 text-[#ff6b6b] hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#66c0f4]' : 'text-gray-400 group-hover:text-gray-300'}`} />
                    <span className="truncate">{folder.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-gray-400 bg-[#0d131a] px-1.5 py-0.5 rounded border border-[#1b2736] shrink-0 font-mono">
                      {folder.count}
                    </span>

                    <button
                      type="button"
                      disabled={isGameRunning}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuFolderName(isMenuOpen ? null : folder.name);
                      }}
                      className={`p-1 rounded text-gray-400 hover:text-white hover:bg-[#1a2736] transition ${
                        isGameRunning ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                      }`}
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}

              {/* Context menu for folder */}
              {isMenuOpen && (
                <div
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-2 top-8 z-50 w-36 bg-[#0f1722] border border-[#2d4257] rounded-lg shadow-2xl p-1 text-xs space-y-0.5"
                >
                  <button
                    type="button"
                    onClick={(e) => handleStartRename(folder.name, e)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-gray-300 hover:text-white hover:bg-[#1c293a] transition cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3 text-[#66c0f4]" />
                    <span>{t('folders.rename')}</span>
                  </button>
                  <div className="h-[1px] bg-[#1d2a38] my-0.5" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuFolderName(null);
                      onDeleteFolder && onDeleteFolder(folder.name);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[#ff6b6b] hover:text-white hover:bg-[#3d181e] transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t('folders.delete')}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
