import React, { useState } from 'react';
import {
  HardDrive,
  CheckSquare,
  Square,
  Trash2,
  Sparkles,
  Plus,
  RotateCcw,
  PowerOff,
  Power,
  CheckCircle2
} from 'lucide-react';

export function RightActionSidebar({
  selectedCount,
  totalSelectedBytes,
  onSelectAllFiltered,
  onClearSelection,
  onOpenDryRun,
  onBulkDisable,
  onBulkToggleDisabled,
  onBulkToggleSubscription,
  selectedItems = [],
  filteredCount,
  onBulkAddTag,
  onBulkAddUserTag,
  onBulkClearTags,
  onBulkResetTags,
  availableUserTags = [],
  availableSteamTags = [],
  sidebarWidth = 290
}) {
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [sidebarStubNotice, setSidebarStubNotice] = useState(null);

  const allSelectedDisabled = selectedItems.length > 0 && selectedItems.every(it => it.is_disabled);
  const allSelectedUnsubscribed = selectedItems.length > 0 && selectedItems.every(it => it.is_unsubscribed);

  const handleBulkDisableClick = () => {
    if (selectedCount === 0) return;
    const target = !allSelectedDisabled;
    if (onBulkToggleDisabled) {
      onBulkToggleDisabled(target);
    } else if (onBulkDisable) {
      onBulkDisable(target);
    } else {
      setSidebarStubNotice(target ? 'Моди відключено' : 'Моди підключено');
      setTimeout(() => setSidebarStubNotice(null), 3000);
    }
  };

  const handleBulkSubscriptionClick = () => {
    if (selectedCount === 0) return;
    if (allSelectedUnsubscribed) {
      if (onBulkToggleSubscription) {
        onBulkToggleSubscription(false);
      } else {
        setSidebarStubNotice('Підписку на моди відновлено');
        setTimeout(() => setSidebarStubNotice(null), 3000);
      }
    } else {
      if (onOpenDryRun) {
        onOpenDryRun();
      } else {
        setSidebarStubNotice('Відкриття плану відписки...');
        setTimeout(() => setSidebarStubNotice(null), 3000);
      }
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    // When sidebar is narrow, reduce decimal places (2 -> 1 -> 0)
    let decimals = 2;
    if (sidebarWidth < 250) {
      decimals = 0;
    } else if (sidebarWidth < 275) {
      decimals = 1;
    }
    const formattedVal = decimals > 0 ? parseFloat(val.toFixed(decimals)) : Math.round(val);
    return `${formattedVal} ${sizes[i]}`;
  };

  const safeUserTags = Array.isArray(availableUserTags) ? availableUserTags : [];
  const safeSteamTags = Array.isArray(availableSteamTags) ? availableSteamTags : [];

  const searchFilter = (bulkTagInput || '').trim().toLowerCase();

  // Steam suggestions matching filter
  const filteredSteam = safeSteamTags
    .filter(t => typeof t === 'string' && (!searchFilter || t.toLowerCase().includes(searchFilter)))
    .map(t => ({ tag: t, type: 'steam' }));

  // User suggestions matching filter
  const filteredUser = safeUserTags
    .filter(t => typeof t === 'string' && (!searchFilter || t.toLowerCase().includes(searchFilter)))
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

  const handleApplyBulkTag = (e) => {
    if (e) e.preventDefault();
    const tag = bulkTagInput.trim();
    if (tag && selectedCount > 0) {
      if (onBulkAddTag) {
        onBulkAddTag(tag);
      } else if (onBulkAddUserTag) {
        onBulkAddUserTag(tag);
      }
      setBulkTagInput('');
    }
  };

  return (
    <aside className="w-full h-full bg-[#171d25] border border-[#22303e] rounded-lg p-3.5 flex flex-col shadow justify-between text-xs overflow-hidden">
      
      {/* Top Section */}
      <div className="space-y-3.5">
        
        {/* Selected Metrics Card */}
        <div className="bg-[#121922] border border-[#233547] rounded-lg p-3 space-y-2.5">
          <div>
            <span className="text-[10.5px] text-[#8f98a0] block">Вибрано модів</span>
            <div className="text-2xl font-bold text-white mt-0.5">
              {selectedCount} <span className="text-xs font-normal text-gray-400">з {filteredCount}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1e2a38] flex items-center justify-between gap-2 overflow-hidden">
            <div className="flex items-center gap-1 text-xs text-[#8f98a0] shrink-0 whitespace-nowrap">
              <HardDrive className="w-3.5 h-3.5 text-[#a4d053]" />
              <span>Сумарний об'єм:</span>
            </div>
            <strong
              className="text-sm text-[#a4d053] font-mono whitespace-nowrap shrink-0 text-right ml-auto"
              title={`${totalSelectedBytes?.toLocaleString() || 0} байт`}
            >
              {formatBytes(totalSelectedBytes)}
            </strong>
          </div>
        </div>

        {/* Quick Selection Buttons */}
        <div className="space-y-1.5 pt-0.5">
          <button
            onClick={onSelectAllFiltered}
            disabled={filteredCount === 0}
            className={`w-full flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded font-medium transition border ${
              filteredCount > 0
                ? 'bg-[#202e3d] hover:bg-[#2a3f54] text-[#c7d5e0] hover:text-white border-[#26374a] cursor-pointer'
                : 'bg-[#18202a] text-gray-500 border-[#202934] cursor-not-allowed opacity-60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#66c0f4]" />
            <span>Вибрати всі</span>
          </button>

          <button
            onClick={onClearSelection}
            disabled={selectedCount === 0}
            className={`w-full flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded transition border ${
              selectedCount > 0
                ? 'bg-[#1a232e] hover:bg-[#23303f] text-gray-400 hover:text-white border-[#202c38] cursor-pointer'
                : 'bg-[#161d26] text-gray-600 border-[#1c2430] cursor-not-allowed opacity-50'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Зняти вибір{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
          </button>
        </div>

        {/* Unified Tagging (Always rendered, grayed out when no selection) */}
        <div
          className={`rounded-lg p-2.5 space-y-2 transition-colors border ${
            selectedCount > 0
              ? 'bg-[#121922] border-[#293c50]'
              : 'bg-[#10161f] border-[#1c2633] opacity-60'
          }`}
        >
          <div
            className={`flex items-center gap-1.5 text-[11px] font-semibold ${
              selectedCount > 0 ? 'text-[#f49e42]' : 'text-gray-500'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Присвоїти тег вибраним{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
          </div>

          <form onSubmit={handleApplyBulkTag} className="flex items-center gap-1 min-w-0 w-full">
            <input
              type="text"
              disabled={selectedCount === 0}
              placeholder="Введіть назву тегу..."
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
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
                    ? 'Буде призначено/активовано як Steam-тег'
                    : 'Буде додано як власний тег'
                  : 'Додати тег до вибраних'
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

          {/* Combined filtered suggestions (User tags in orange, Steam tags in blue, color only) */}
          {combinedSuggestions.length > 0 && (
            <div className="pt-1.5 space-y-1">
              <span className="text-[10px] text-gray-500 block">
                {bulkTagInput.trim() ? 'Знайдені підказки:' : 'Рекомендовані теги:'}
              </span>
              <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-0.5">
                {combinedSuggestions.slice(0, 12).map(({ tag, type }, idx) => {
                  const isSteam = type === 'steam';
                  return (
                    <button
                      key={`bulk-sug-${type}-${tag}-${idx}`}
                      type="button"
                      disabled={selectedCount === 0}
                      onClick={() => {
                        if (onBulkAddTag) {
                          onBulkAddTag(tag);
                        } else if (onBulkAddUserTag) {
                          onBulkAddUserTag(tag);
                        }
                        setBulkTagInput('');
                      }}
                      className={`text-xs px-2 py-0.5 rounded-full border transition font-medium flex items-center gap-1 ${
                        selectedCount > 0
                          ? isSteam
                            ? 'bg-[#121c27] hover:bg-[#1a2d42] text-[#8ec8f6] hover:text-white border-[#22394f] cursor-pointer'
                            : 'bg-[#241c14] hover:bg-[#33271b] text-[#f4b366] hover:text-white border-[#47341e] cursor-pointer'
                          : 'bg-[#131b24] text-gray-600 border-[#19232f] cursor-not-allowed opacity-50'
                      }`}
                      title={`+ ${tag}`}
                    >
                      <span>+ {tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons: Clear all tags & Reset original tags */}
          <div className="pt-2 border-t border-[#1e2a38] flex flex-col gap-1.5">
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onBulkClearTags}
              className={`w-full flex items-center justify-center gap-1.5 text-xs py-1.5 px-2 rounded font-medium transition border ${
                selectedCount > 0
                  ? 'bg-[#1a1215] hover:bg-[#2d171b] text-[#ff6b6b] hover:text-[#ff8585] border-[#4a1f24] hover:border-[#66282e] cursor-pointer'
                  : 'bg-[#141820] text-gray-600 border-[#1a212a] cursor-not-allowed opacity-50'
              }`}
              title="Видалити користувацькі та деактивувати всі Steam-теги у вибраних модів"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Видалити всі теги</span>
            </button>

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onBulkResetTags}
              className={`w-full flex items-center justify-center gap-1.5 text-xs py-1.5 px-2 rounded font-medium transition border ${
                selectedCount > 0
                  ? 'bg-[#121c27] hover:bg-[#1a2d42] text-[#66c0f4] hover:text-[#99d6ff] border-[#22394f] hover:border-[#325373] cursor-pointer'
                  : 'bg-[#141820] text-gray-600 border-[#1a212a] cursor-not-allowed opacity-50'
              }`}
              title="Повернути початкові теги зі Steam та системний статус unsorted для вибраних модів"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Повернути оригінальні теги</span>
            </button>
          </div>
        </div>

        {/* Bulk Actions: Disable & Unsubscribe Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleBulkDisableClick}
            disabled={selectedCount === 0}
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow border ${
              selectedCount > 0
                ? allSelectedDisabled
                  ? 'bg-[#15251c] hover:bg-[#253f2c] text-[#a4d053] hover:text-white border-[#3b6346] active:scale-98 cursor-pointer'
                  : 'bg-[#16202c] hover:bg-[#1f2d3d] text-[#f4b366] hover:text-[#ffd699] border-[#2b3e52] hover:border-[#f49e42]/60 active:scale-98 cursor-pointer'
                : 'bg-[#222a33] text-gray-500 cursor-not-allowed border-[#2d3744]'
            }`}
            title={allSelectedDisabled ? 'Підключити вибрані моди' : 'Відключити вибрані моди'}
          >
            {allSelectedDisabled ? (
              <>
                <Power className="w-4 h-4 transition-colors text-[#a4d053]" />
                <span>Підключити</span>
              </>
            ) : (
              <>
                <PowerOff className="w-4 h-4 transition-colors text-[#f49e42]" />
                <span>Відключити</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleBulkSubscriptionClick}
            disabled={selectedCount === 0}
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow border ${
              selectedCount > 0
                ? allSelectedUnsubscribed
                  ? 'bg-[#121c27] hover:bg-[#1a2d42] text-[#66c0f4] hover:text-white border-[#2a475e] hover:border-[#38536f] active:scale-98 cursor-pointer'
                  : 'bg-[#1a1215] hover:bg-[#a82a2a] text-[#ff6b6b] hover:text-white border-[#a82a2a] hover:border-[#bd3333] active:scale-98 cursor-pointer shadow-red-950/20'
                : 'bg-[#222a33] text-gray-500 cursor-not-allowed border-[#2d3744]'
            }`}
            title={allSelectedUnsubscribed ? 'Підписатися назад на вибрані моди' : 'Відписатися від вибраних модів'}
          >
            {allSelectedUnsubscribed ? (
              <>
                <CheckCircle2 className="w-4 h-4 transition-colors text-[#66c0f4]" />
                <span>Підписатися</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 transition-colors" />
                <span>Відписатися</span>
              </>
            )}
          </button>

          {sidebarStubNotice && (
            <div className="bg-[#1a232e] border border-[#66c0f4]/40 text-[#8ec8f6] text-[10.5px] px-2.5 py-1.5 rounded-md text-center animate-in fade-in duration-200 shadow">
              {sidebarStubNotice}
            </div>
          )}
        </div>

      </div>

    </aside>
  );
}
