import React, { useState } from 'react';
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
  Play
} from 'lucide-react';
import { getTagDisplayPath, resolveTagFromPath } from '../utils/tagUtils';

export function RightActionSidebar({
  selectedCount,
  totalSelectedBytes,
  onSelectAllFiltered,
  onClearSelection,
  onPlanAction,
  pendingActionsCount = 0,
  onOpenPlanModal,
  onClearPlan,
  pendingActions = {},
  selectedItems = [],
  filteredCount,
  onBulkAddTag,
  onBulkAddUserTag,
  onBulkClearTags,
  onBulkResetTags,
  availableUserTags = [],
  availableSteamTags = [],
  sidebarWidth = 290,
  tagPathMap,
  reverseTagPathMap
}) {
  const [bulkTagInput, setBulkTagInput] = useState('');

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
    .filter(t => {
      if (!searchFilter) return true;
      const displayPath = getTagDisplayPath(t, 'steam', tagPathMap).toLowerCase();
      return t.toLowerCase().includes(searchFilter) || displayPath.includes(searchFilter);
    })
    .map(t => ({ tag: t, type: 'steam' }));

  // User suggestions matching filter
  const filteredUser = safeUserTags
    .filter(t => {
      if (!searchFilter) return true;
      const displayPath = getTagDisplayPath(t, 'user', tagPathMap).toLowerCase();
      return t.toLowerCase().includes(searchFilter) || displayPath.includes(searchFilter);
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
    }
  };

  return (
    <aside className="w-full h-full bg-[#171d25] border border-[#22303e] rounded-lg flex flex-col shadow text-xs overflow-hidden select-none">
      
      {/* Scrollable Upper Section: metrics, selection & tagging */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 pr-2.5">
        
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

          {/* Combined filtered suggestions */}
          {combinedSuggestions.length > 0 && (
            <div className="pt-1.5 space-y-1">
              <span className="text-[10px] text-gray-500 block">
                {bulkTagInput.trim() ? 'Знайдені підказки:' : 'Рекомендовані теги:'}
              </span>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-0.5">
                {combinedSuggestions.slice(0, 12).map(({ tag, type }, idx) => {
                  const isSteam = type === 'steam';
                  const displayLabel = getTagDisplayPath(tag, type, tagPathMap);
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
                      className={`text-xs px-2 py-0.5 rounded-full border transition font-medium flex items-center gap-1 max-w-full truncate ${
                        selectedCount > 0
                          ? isSteam
                            ? 'bg-[#121c27] hover:bg-[#1a2d42] text-[#8ec8f6] hover:text-white border-[#22394f] cursor-pointer'
                            : 'bg-[#241c14] hover:bg-[#33271b] text-[#f4b366] hover:text-white border-[#47341e] cursor-pointer'
                          : 'bg-[#131b24] text-gray-600 border-[#19232f] cursor-not-allowed opacity-50'
                      }`}
                      title={`+ ${displayLabel}`}
                    >
                      <span className="truncate">+ {displayLabel}</span>
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
              title="Повернути початкові теги зі Steam та статус «не відсортовано» для вибраних модів"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Повернути оригінальні теги</span>
            </button>
          </div>
        </div>

      </div>

      {/* Permanently Pinned Bottom Action Dock: ALWAYS visible above screen edge */}
      <div className="p-3 bg-[#121922] border-t border-[#233547] space-y-2 shrink-0">
        
        {/* Planning Section Header */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#8f98a0]">
          <span className="flex items-center gap-1.5 text-[#66c0f4]">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Запланувати дію{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
          </span>
        </div>

        {/* 2 Adaptive Planning Buttons: [Вимкнути / Увімкнути] & [Відписатися / Підписатися] */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* Button 1: Adaptive Enable / Disable */}
          {isEnableAction ? (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => onPlanAction && onPlanAction('enable')}
              className={`py-2 px-2.5 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 border ${
                selectedCount > 0
                  ? 'bg-[#142618] hover:bg-[#1f3b25] text-[#a4d053] border-[#264d2e] hover:border-[#387344] active:scale-98 cursor-pointer shadow'
                  : 'bg-[#12171e] text-gray-600 border-[#1a212b] cursor-not-allowed opacity-50'
              }`}
              title="Запланувати увімкнення для вибраних модів"
            >
              <Power className="w-3.5 h-3.5 shrink-0 text-[#a4d053]" />
              <span className="truncate">Увімкнути</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => onPlanAction && onPlanAction('disable')}
              className={`py-2 px-2.5 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 border ${
                selectedCount > 0
                  ? 'bg-[#1a140d] hover:bg-[#2e2013] text-[#f49e42] border-[#4d3215] hover:border-[#734a1e] active:scale-98 cursor-pointer shadow'
                  : 'bg-[#12171e] text-gray-600 border-[#1a212b] cursor-not-allowed opacity-50'
              }`}
              title="Запланувати вимкнення для вибраних модів"
            >
              <PowerOff className="w-3.5 h-3.5 shrink-0 text-[#f49e42]" />
              <span className="truncate">Вимкнути</span>
            </button>
          )}

          {/* Button 2: Adaptive Subscribe / Unsubscribe */}
          {isSubscribeAction ? (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => onPlanAction && onPlanAction('subscribe')}
              className={`py-2 px-2.5 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 border ${
                selectedCount > 0
                  ? 'bg-[#101b26] hover:bg-[#172b3d] text-[#66c0f4] border-[#1e3b54] hover:border-[#2d5980] active:scale-98 cursor-pointer shadow'
                  : 'bg-[#12171e] text-gray-600 border-[#1a212b] cursor-not-allowed opacity-50'
              }`}
              title="Запланувати підписку на вибрані моди"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#66c0f4]" />
              <span className="truncate">Підписатися</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => onPlanAction && onPlanAction('unsubscribe')}
              className={`py-2 px-2.5 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 border ${
                selectedCount > 0
                  ? 'bg-[#201013] hover:bg-[#36181e] text-[#ff6b6b] border-[#4d1f25] hover:border-[#732a34] active:scale-98 cursor-pointer shadow'
                  : 'bg-[#12171e] text-gray-600 border-[#1a212b] cursor-not-allowed opacity-50'
              }`}
              title="Запланувати відписку від вибраних модів"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0 text-[#ff6b6b]" />
              <span className="truncate">Відписатися</span>
            </button>
          )}
        </div>

        {/* Plan status count & Clear button */}
        {pendingActionsCount > 0 && (
          <div className="flex items-center justify-between px-1 text-[11px] text-[#8f98a0] pt-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#a4d053] animate-pulse" />
              <span>У плані дій:</span>
              <strong className="text-white font-mono">{pendingActionsCount}</strong>
            </span>
            {onClearPlan && (
              <button
                type="button"
                onClick={onClearPlan}
                className="text-[11px] text-gray-400 hover:text-[#ff6b6b] transition cursor-pointer"
                title="Очистити всі заплановані дії"
              >
                Очистити
              </button>
            )}
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
