import React from 'react';
import { Search, ArrowUpDown, LayoutGrid } from 'lucide-react';

export function FilterBar({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
  cardSize,
  setCardSize,
  totalItems,
  filteredCount
}) {
  return (
    <div className="bg-[#171d25] border border-[#22303e] rounded-lg p-3.5 mb-4 shadow">
      
      {/* Top row: Search input + Sorting controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        
        {/* Search input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Пошук за назвою, автором або ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#101822] border border-[#26374a] focus:border-[#66c0f4] rounded pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none transition"
          />
        </div>

        {/* Sorting Dropdown and Toggle Button */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-[#66c0f4]" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#101822] border border-[#26374a] text-xs text-white rounded px-3 py-1.5 focus:outline-none focus:border-[#66c0f4]"
          >
            <option value="size">Сортувати: Розмір на диску</option>
            <option value="updated">Сортувати: Дата оновлення</option>
            <option value="title">Сортувати: Назва (A-Z)</option>
            <option value="id">Сортувати: PublishedFileID</option>
          </select>

          <button
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'За зростанням' : 'За спаданням'}
            className="bg-[#202e3d] hover:bg-[#2a3c4f] border border-[#26374a] text-xs text-[#66c0f4] px-3 py-1.5 rounded font-mono font-bold transition"
          >
            {sortDir === 'asc' ? '▲ Зростання' : '▼ Спадання'}
          </button>
        </div>

      </div>

      {/* Sub-row right under Sorting: Card size slider & Status counters */}
      <div className="mt-3 pt-2.5 border-t border-[#202c38] flex flex-wrap justify-between items-center gap-3 text-xs text-[#8f98a0]">
        
        {/* Left: item counter */}
        <div className="flex items-center gap-2">
          <span>
            Відображено: <strong className="text-white">{filteredCount}</strong> з <strong className="text-white">{totalItems}</strong> модів
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#66c0f4] hover:underline ml-2"
            >
              Очистити пошук ({searchQuery}) ×
            </button>
          )}
        </div>

        {/* Right (directly aligned under sorting buttons): Card size controller */}
        <div className="flex items-center gap-2.5 bg-[#101822] px-3 py-1 rounded border border-[#233547]">
          <LayoutGrid className="w-3.5 h-3.5 text-[#66c0f4]" />
          <span className="text-[11px] text-gray-300 font-medium">Розмір карток:</span>
          
          <input
            type="range"
            min="1"
            max="3"
            step="1"
            value={cardSize}
            onChange={(e) => setCardSize(Number(e.target.value))}
            className="w-20 accent-[#66c0f4] cursor-pointer h-1.5 bg-[#202e3d] rounded-lg"
            title={cardSize === 1 ? 'Компактний' : cardSize === 2 ? 'Середній' : 'Великий'}
          />

          <div className="flex items-center gap-1 font-mono text-[10px]">
            <button
              onClick={() => setCardSize(1)}
              className={`px-1.5 py-0.5 rounded transition ${cardSize === 1 ? 'bg-[#2a475e] text-[#66c0f4] font-bold' : 'text-gray-500 hover:text-white'}`}
            >
              S
            </button>
            <button
              onClick={() => setCardSize(2)}
              className={`px-1.5 py-0.5 rounded transition ${cardSize === 2 ? 'bg-[#2a475e] text-[#66c0f4] font-bold' : 'text-gray-500 hover:text-white'}`}
            >
              M
            </button>
            <button
              onClick={() => setCardSize(3)}
              className={`px-1.5 py-0.5 rounded transition ${cardSize === 3 ? 'bg-[#2a475e] text-[#66c0f4] font-bold' : 'text-gray-500 hover:text-white'}`}
            >
              L
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
