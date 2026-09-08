import React from 'react';
import stormworksIcon from '../assets/stormworks_icon.png';
import {
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  HardDrive,
  RefreshCw,
  Settings,
  ExternalLink,
  X
} from 'lucide-react';

export function Header({
  status,
  onRefresh,
  onOpenSettings,
  isScanning,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
  cardSize,
  setCardSize,
  viewMode = 'grid',
  setViewMode,
  totalItems,
  filteredCount
}) {
  const searchInputRef = React.useRef(null);
  const totalFound = status?.scan_state?.total_found ?? totalItems ?? 0;
  const processed = status?.scan_state?.processed_count ?? totalItems ?? 0;
  const limit = status?.max_limit;

  // Global Ctrl+F / '/' shortcut to focus search input
  React.useEffect(() => {
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
    <header className="bg-[#171d25] border-b border-[#22303e] shadow-md z-30 sticky top-0 w-full">
      <div className="w-full max-w-none px-3 sm:px-5 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* 1. Brand / Game Name Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded bg-[#101822] border border-[#233547] flex items-center justify-center shadow p-1">
            <img
              src={stormworksIcon}
              alt="Stormworks"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xs bg-[#223447] text-[#66c0f4] px-2.5 py-1 rounded font-mono font-bold border border-[#314b66]">
            Stormworks: Build and Rescue
          </span>

          {/* Workshop Logo Link */}
          <a
            href="https://steamcommunity.com/app/573090/workshop/"
            target="_blank"
            rel="noopener noreferrer"
            title="Відкрити головну сторінку Steam Workshop у новій вкладці"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#101822] hover:bg-[#1b2838] border border-[#233547] hover:border-[#66c0f4] text-gray-300 hover:text-white transition group shadow select-none"
          >
            {/* Steam Logo SVG */}
            <svg
              className="w-4 h-4 fill-current text-[#66c0f4] group-hover:text-white transition-colors shrink-0"
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M.329 10.333A8.01 8.01 0 0 0 7.99 16C12.414 16 16 12.418 16 8s-3.586-8-8.009-8A8.006 8.006 0 0 0 0 7.468l.003.006 4.304 1.769A2.2 2.2 0 0 1 5.62 8.88l1.96-2.844-.001-.04a3.046 3.046 0 0 1 3.042-3.043 3.046 3.046 0 0 1 3.042 3.043 3.047 3.047 0 0 1-3.111 3.044l-2.804 2a2.223 2.223 0 0 1-3.075 2.11 2.22 2.22 0 0 1-1.312-1.568L.33 10.333Z"/>
              <path d="M4.868 12.683a1.715 1.715 0 0 0 1.318-3.165 1.7 1.7 0 0 0-1.263-.02l1.023.424a1.261 1.261 0 1 1-.97 2.33l-.99-.41a1.7 1.7 0 0 0 .882.84Zm3.726-6.687a2.03 2.03 0 0 0 2.027 2.029 2.03 2.03 0 0 0 2.027-2.029 2.03 2.03 0 0 0-2.027-2.027 2.03 2.03 0 0 0-2.027 2.027m2.03-1.527a1.524 1.524 0 1 1-.002 3.048 1.524 1.524 0 0 1 .002-3.048"/>
            </svg>
            <span className="text-xs font-semibold text-gray-300 group-hover:text-[#66c0f4] transition-colors hidden sm:inline">
              Workshop
            </span>
            <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-[#66c0f4] transition-colors shrink-0" />
          </a>
        </div>

        {/* 2. Global Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Пошук за назвою, автором, ID... (Ctrl+F, Esc для скидання)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                searchInputRef.current?.blur();
              }
            }}
            className="w-full bg-[#101822] border border-[#26374a] focus:border-[#66c0f4] rounded-md pl-9 pr-8 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
              title="Очистити пошук (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 3. Sorting & Card Size Controls */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Sorting Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#101822] border border-[#26374a] rounded-md px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#66c0f4]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="size" className="bg-[#171d25]">Розмір на диску</option>
              <option value="updated" className="bg-[#171d25]">Дата оновлення</option>
              <option value="title" className="bg-[#171d25]">Назва (A-Z)</option>
              <option value="id" className="bg-[#171d25]">PublishedFileID</option>
            </select>
          </div>

          {/* Sort Direction Toggle Button */}
          <button
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'За зростанням' : 'За спаданням'}
            className="bg-[#202e3d] hover:bg-[#2a3c4f] border border-[#26374a] text-xs text-[#66c0f4] px-2.5 py-1 rounded-md font-mono font-bold transition cursor-pointer"
          >
            {sortDir === 'asc' ? '▲' : '▼'}
          </button>

          {/* View Mode (Grid / List) & Density Selector */}
          <div className="flex items-center gap-2 bg-[#101822] px-2 py-1 rounded-md border border-[#26374a]">
            {/* Mode Switcher Buttons */}
            <div className="flex items-center gap-0.5 bg-[#17212d] p-0.5 rounded border border-[#233547]">
              <button
                type="button"
                onClick={() => setViewMode && setViewMode('grid')}
                title="Режим: Сітка"
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
                title="Режим: Список"
                className={`p-1 rounded transition cursor-pointer flex items-center justify-center ${
                  viewMode === 'list'
                    ? 'bg-[#2a475e] text-[#66c0f4] font-bold shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Density Range Slider */}
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={cardSize}
              onChange={(e) => setCardSize(Number(e.target.value))}
              className="w-12 sm:w-14 accent-[#66c0f4] cursor-pointer h-1 bg-[#202e3d] rounded-lg"
              title={
                viewMode === 'grid'
                  ? cardSize === 1
                    ? 'Компактна сітка (S)'
                    : cardSize === 2
                    ? 'Стандартна сітка (M)'
                    : 'Велика сітка (L)'
                  : cardSize === 1
                  ? 'Список: декілька модів на рядок (вузька картка, S)'
                  : cardSize === 2
                  ? 'Список: декілька модів на рядок (широка картка, M)'
                  : 'Список: 1 мод на рядок (L)'
              }
            />

            {/* S / M / L Button Group */}
            <div className="flex items-center gap-0.5 font-mono text-[10px]">
              <button
                onClick={() => setCardSize(1)}
                title={viewMode === 'grid' ? 'Компактна сітка (S)' : 'Список: вузькі картки (S)'}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${cardSize === 1 ? 'bg-[#2a475e] text-[#66c0f4] font-bold' : 'text-gray-500 hover:text-white'}`}
              >
                S
              </button>
              <button
                onClick={() => setCardSize(2)}
                title={viewMode === 'grid' ? 'Стандартна сітка (M)' : 'Список: широкі картки (M)'}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${cardSize === 2 ? 'bg-[#2a475e] text-[#66c0f4] font-bold' : 'text-gray-500 hover:text-white'}`}
              >
                M
              </button>
              <button
                onClick={() => setCardSize(3)}
                title={viewMode === 'grid' ? 'Велика сітка (L)' : 'Список: 1 мод на рядок (L)'}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${cardSize === 3 ? 'bg-[#2a475e] text-[#66c0f4] font-bold' : 'text-gray-500 hover:text-white'}`}
              >
                L
              </button>
            </div>
          </div>

        </div>

        {/* 4. Stats Counter & Sync Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          <div className="flex items-center gap-2 bg-[#101822] border border-[#233547] px-2.5 py-1 rounded-md text-xs">
            <HardDrive className="w-3.5 h-3.5 text-[#66c0f4]" />
            <span className="text-gray-300">
              <strong className="text-white">{filteredCount}</strong>
              <span className="text-gray-500 mx-1">/</span>
              <span className="text-gray-400">{processed || totalFound || filteredCount}</span>
              {limit && totalFound > processed && (
                <span className="text-gray-500 text-[11px] ml-1">({totalFound})</span>
              )}
            </span>
            {limit && (
              <span className="bg-[#384b22] text-[#a4d053] px-1 py-0.2 rounded text-[9px] font-semibold uppercase tracking-wider ml-1">
                MVP {limit}
              </span>
            )}
          </div>

          <button
            onClick={onRefresh}
            disabled={isScanning}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-white transition shadow ${
              isScanning
                ? 'bg-[#2b3a4a] text-gray-400 cursor-not-allowed'
                : 'bg-[#2a475e] hover:bg-[#3d6585] active:bg-[#1e3445]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[#66c0f4]' : ''}`} />
            <span className="hidden sm:inline">{isScanning ? 'Синхронізація...' : 'Оновити'}</span>
          </button>

          <button
            onClick={onOpenSettings}
            title="Налаштування"
            className="flex items-center justify-center p-1.5 rounded-md bg-[#2a475e] hover:bg-[#3d6585] active:bg-[#1e3445] text-gray-200 hover:text-white transition shadow"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

        </div>

      </div>
    </header>
  );
}
