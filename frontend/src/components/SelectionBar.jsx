import React from 'react';
import { CheckSquare, Square, Trash2, HardDrive, ListFilter } from 'lucide-react';

export function SelectionBar({
  selectedCount,
  totalSelectedBytes,
  onSelectAllFiltered,
  onClearSelection,
  onOpenDryRun,
  filteredCount
}) {
  if (selectedCount === 0) return null;

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl">
      <div className="bg-[#171d25]/95 backdrop-blur-md border border-[#2d4358] shadow-2xl rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Summary */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#66c0f4] animate-pulse" />
            <span className="text-sm font-semibold text-white">
              Вибрано: <strong className="text-[#66c0f4]">{selectedCount}</strong> модів
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#a4d053] font-mono bg-[#111922] px-2.5 py-1 rounded border border-[#233547]">
            <HardDrive className="w-3.5 h-3.5" />
            <span>{formatBytes(totalSelectedBytes)}</span>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onSelectAllFiltered}
            className="flex items-center gap-1.5 text-xs bg-[#202e3d] hover:bg-[#2b3e52] text-[#c7d5e0] px-3 py-1.5 rounded transition"
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#66c0f4]" />
            <span>Вибрати всі</span>
          </button>

          <button
            onClick={onClearSelection}
            className="flex items-center gap-1.5 text-xs bg-[#202e3d] hover:bg-[#2b3e52] text-gray-400 hover:text-white px-3 py-1.5 rounded transition"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Зняти вибір</span>
          </button>

          <button
            onClick={onOpenDryRun}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#1a1215] hover:bg-[#a82a2a] text-[#ff6b6b] hover:text-white border border-[#a82a2a] hover:border-[#bd3333] px-4 py-1.5 rounded shadow transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 transition-colors" />
            <span>Відписатися</span>
          </button>
        </div>

      </div>
    </div>
  );
}
