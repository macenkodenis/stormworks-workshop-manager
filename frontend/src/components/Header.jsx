import React, { useRef, useEffect, useState, useCallback } from 'react';
import stormworksIcon from '../assets/stormworks_icon.png';
import {
  Search,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Settings,
  ExternalLink,
  X,
  LayoutGrid,
  List
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function Header({
  onRefresh,
  onOpenSettings,
  isScanning,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
  viewMode,
  setViewMode,
  cardSize,
  setCardSize,
  leftWidth,
  rightWidth,
  headerLeftRef,
  headerRightRef
}) {
  const { t } = useI18n();
  const searchInputRef = useRef(null);
  const [localQuery, setLocalQuery] = useState(searchQuery || '');
  const debounceTimerRef = useRef(null);

  // Sync from props if external clear/reset occurs
  useEffect(() => {
    setLocalQuery(searchQuery || '');
  }, [searchQuery]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setLocalQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!val.trim()) {
      setSearchQuery('');
    } else {
      debounceTimerRef.current = setTimeout(() => {
        setSearchQuery(val);
      }, 120);
    }
  }, [setSearchQuery]);

  const handleClear = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setLocalQuery('');
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, [setSearchQuery]);

  // Global Ctrl+F / '/' shortcut to focus search input
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <header className="bg-[#171d25] border-b border-[#22303e] shadow-md z-40 sticky top-0 w-full">
      <div className="w-full max-w-none px-1.5 sm:px-2 py-1.5 flex flex-nowrap items-center justify-between overflow-hidden">
        
        {/* 1. Left Zone: Brand (Logo + 2-line Title, no enclosing box), aligned with Left Sidebar */}
        <div
          ref={headerLeftRef}
          style={{ width: leftWidth ? `${leftWidth}px` : 'auto' }}
          className="shrink-0 flex items-center justify-between"
        >
          <a
            href="https://steamcommunity.com/app/573090/workshop/"
            target="_blank"
            rel="noopener noreferrer"
            title={t('header.openWorkshop')}
            className="flex items-center gap-2.5 group select-none cursor-pointer"
          >
            <div className="w-9 h-9 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <img
                src={stormworksIcon}
                alt="Stormworks"
                className="w-full h-full object-contain filter drop-shadow"
              />
            </div>
            <div className="flex flex-col text-left leading-none">
              <span className="text-sm font-black text-white group-hover:text-[#66c0f4] transition-colors leading-tight tracking-wide">
                {t('header.title')}
              </span>
              <span className="text-xs font-mono text-[#66c0f4] group-hover:text-white transition-colors leading-tight">
                {t('header.subtitle')}
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#66c0f4] transition-colors shrink-0 ml-0.5 opacity-70 group-hover:opacity-100" />
          </a>
        </div>

        {/* Left gutter spacer matching the 12px (w-3) resizer */}
        <div className="w-3 shrink-0 hidden sm:block" />

        {/* 2. Middle Catalog Header: Left-pinned Display Controls, Stretched Search, Right-pinned Sorting */}
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2.5">
          
          {/* Left: View Mode (Grid / List) & Card Size (S / M / L) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Grid / List Mode Switcher */}
            <div className="flex items-center gap-0.5 bg-[#101822] border border-[#233547] rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setViewMode && setViewMode('grid')}
                title={t('header.viewGrid')}
                className={`p-1 rounded transition cursor-pointer flex items-center justify-center ${
                  viewMode === 'grid'
                    ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode && setViewMode('list')}
                title={t('header.viewList')}
                className={`p-1 rounded transition cursor-pointer flex items-center justify-center ${
                  viewMode === 'list'
                    ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* S / M / L Size Switcher */}
            <div className="flex items-center gap-0.5 bg-[#101822] border border-[#233547] rounded-md p-0.5 font-mono text-[10.5px]">
              <button
                type="button"
                onClick={() => setCardSize && setCardSize(1)}
                title={t('header.sizeSmall')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  cardSize === 1
                    ? 'bg-[#2a475e] text-[#66c0f4] font-bold border border-[#385b7a]'
                    : 'text-gray-400 hover:text-white bg-[#17212d] border border-transparent hover:border-[#2a3c4f]'
                }`}
              >
                S
              </button>
              <button
                type="button"
                onClick={() => setCardSize && setCardSize(2)}
                title={t('header.sizeMedium')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  cardSize === 2
                    ? 'bg-[#2a475e] text-[#66c0f4] font-bold border border-[#385b7a]'
                    : 'text-gray-400 hover:text-white bg-[#17212d] border border-transparent hover:border-[#2a3c4f]'
                }`}
              >
                M
              </button>
              <button
                type="button"
                onClick={() => setCardSize && setCardSize(3)}
                title={t('header.sizeLarge')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  cardSize === 3
                    ? 'bg-[#2a475e] text-[#66c0f4] font-bold border border-[#385b7a]'
                    : 'text-gray-400 hover:text-white bg-[#17212d] border border-transparent hover:border-[#2a3c4f]'
                }`}
              >
                L
              </button>
            </div>
          </div>

          {/* Center: Search Input stretched across all remaining available space */}
          <div className="relative flex-1 min-w-[80px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('header.searchPlaceholder')}
              value={localQuery}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleClear();
                  searchInputRef.current?.blur();
                }
              }}
              className="w-full bg-[#101822] border border-[#26374a] focus:border-[#66c0f4] rounded-md pl-8 pr-7 py-1 text-xs text-white placeholder-gray-500 focus:outline-none transition shadow-inner truncate"
            />
            {localQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
                title={t('header.clearSearch')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Sorting Controls with Direction Toggle at the start */}
          <div className="flex items-center bg-[#101822] border border-[#233547] rounded-md overflow-hidden shadow-xs shrink-0">
            {/* Direction toggle button at the start */}
            <button
              type="button"
              onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              title={sortDir === 'asc' ? t('header.sort.asc') : t('header.sort.desc')}
              className="px-2 py-1.5 hover:bg-[#1b2838] text-[#66c0f4] hover:text-white transition flex items-center justify-center cursor-pointer"
            >
              {sortDir === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Delicate internal 1px divider */}
            <div className="h-4 w-[1px] bg-[#223344] shrink-0" />

            {/* Select dropdown */}
            <div className="flex items-center pr-1.5 pl-1 py-1">
              <select
                value={sortBy}
                onChange={(e) => {
                  const newSort = e.target.value;
                  setSortBy(newSort);
                  if (newSort === 'title' || newSort === 'author') {
                    setSortDir('asc');
                  } else {
                    setSortDir('desc');
                  }
                }}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="updated" className="bg-[#171d25]">{t('header.sort.updated')}</option>
                <option value="discovered" className="bg-[#171d25]">{t('header.sort.discovered')}</option>
                <option value="title" className="bg-[#171d25]">{t('header.sort.titleAlpha')}</option>
                <option value="size" className="bg-[#171d25]">{t('header.sort.size')}</option>
                <option value="author" className="bg-[#171d25]">{t('header.sort.author')}</option>
                <option value="popular" className="bg-[#171d25]">{t('header.sort.popular')}</option>
                <option value="id" className="bg-[#171d25]">ID</option>
              </select>
            </div>
          </div>

        </div>

        {/* Right gutter spacer matching the 12px (w-3) resizer */}
        <div className="w-3 shrink-0 hidden sm:block" />

        {/* 3. Right Zone: Sync & Settings (Aligned with Right Sidebar width) */}
        <div
          ref={headerRightRef}
          style={{ width: rightWidth ? `${rightWidth}px` : 'auto' }}
          className="shrink-0 flex items-center justify-end gap-2 overflow-hidden"
        >
          <button
            type="button"
            onClick={onRefresh}
            disabled={isScanning}
            title={t('header.refreshQuickTooltip')}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-semibold text-white whitespace-nowrap shrink-0 transition shadow ${
              isScanning
                ? 'bg-[#2b3a4a] text-gray-400 cursor-not-allowed'
                : 'bg-[#2a475e] hover:bg-[#3d6585] active:bg-[#1e3445] cursor-pointer'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 pointer-events-none ${isScanning ? 'animate-spin text-[#66c0f4]' : ''}`} />
            <span className="hidden sm:inline pointer-events-none whitespace-nowrap">{isScanning ? t('header.refreshScanning') : t('header.quickSync')}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            title={`${t('header.settings')} (Ctrl+,)`}
            aria-label={t('header.settings')}
            className="flex items-center justify-center gap-1.5 px-2.5 h-8 rounded-md bg-[#2a475e] hover:bg-[#3d6585] active:bg-[#1e3445] text-gray-200 hover:text-white whitespace-nowrap shrink-0 transition shadow cursor-pointer text-xs font-semibold"
          >
            <Settings className="w-4 h-4 shrink-0 pointer-events-none" />
            <span className="hidden xl:inline pointer-events-none whitespace-nowrap">{t('header.settings')}</span>
          </button>
        </div>

      </div>
    </header>
  );
}
