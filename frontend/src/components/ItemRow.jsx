import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ExternalLink, HardDrive, Calendar, Clock, CheckCircle2, Star, PowerOff, Power, Trash2, X } from 'lucide-react';
import { getTagDisplayPath, estimateTagWidth, observeElementResize } from '../utils/tagUtils';

// Helper to clean BBCode formatting
const cleanDescription = (raw) => {
  if (!raw) return '';
  return raw
    .replace(/\[\/?(b|i|u|h[1-6]|strike|spoiler|code|noparse|hr|list|\*|table|tr|th|td)\]/gi, '')
    .replace(/\[url=[^\]]*\]/gi, '')
    .replace(/\[\/url\]/gi, '')
    .replace(/\[img\].*?\[\/img\]/gi, '')
    .replace(/\r\n/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

function areItemRowPropsEqual(prev, next) {
  if (prev.item !== next.item) return false;
  if (prev.index !== next.index) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isAnchor !== next.isAnchor) return false;
  if (prev.pendingAction !== next.pendingAction) return false;
  if (prev.cardSize !== next.cardSize) return false;
  if (prev.tagPathMap !== next.tagPathMap) return false;

  // Check if any tags on this specific item changed active highlight state
  if (prev.selectedSteamTags !== next.selectedSteamTags) {
    const steamTags = next.item.tags || [];
    for (let i = 0; i < steamTags.length; i++) {
      const t = steamTags[i];
      if (prev.selectedSteamTags.has(t) !== next.selectedSteamTags.has(t)) {
        return false;
      }
    }
  }

  if (prev.selectedUserTags !== next.selectedUserTags) {
    const userTags = next.item.user_tags || [];
    for (let i = 0; i < userTags.length; i++) {
      const t = userTags[i];
      if (prev.selectedUserTags.has(t) !== next.selectedUserTags.has(t)) {
        return false;
      }
    }
  }

  return true;
}

export const ItemRow = React.memo(function ItemRow({
  item,
  index,
  isSelected,
  isAnchor,
  selectedSteamTags = new Set(),
  selectedUserTags = new Set(),
  onItemClick,
  onOpenDetail,
  onToggleFavorite,
  pendingAction = null,
  onRemovePendingAction,
  tagPathMap,
  cardSize = 3,
  onToggleTag,
  onToggleUserTag
}) {
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format: dd.mm.yy
  const formatDate = (unixTs) => {
    if (!unixTs) return '—';
    const d = new Date(unixTs * 1000);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  };

  const previewSrc = `/api/previews/${item.published_file_id}`;

  // Unified tags: active Steam tags + User tags
  const deactivatedSet = useMemo(() => new Set(item.deactivated_steam_tags || []), [item.deactivated_steam_tags]);
  const displayTags = useMemo(() => {
    const activeSteamTags = (item.tags || []).filter(t => !deactivatedSet.has(t)).map(t => ({
      tag: t,
      type: 'steam'
    }));
    const userTagsList = (item.user_tags || []).map(t => ({
      tag: t,
      type: 'user'
    }));
    const combined = [...userTagsList, ...activeSteamTags];
    return combined.sort((a, b) => {
      const aActive = a.type === 'user' ? selectedUserTags.has(a.tag) : selectedSteamTags.has(a.tag);
      const bActive = b.type === 'user' ? selectedUserTags.has(b.tag) : selectedSteamTags.has(b.tag);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return 0;
    });
  }, [item.tags, item.user_tags, deactivatedSet, selectedSteamTags, selectedUserTags]);

  const isDisabled = Boolean(item.is_disabled);
  const isUnsubscribed = Boolean(item.is_unsubscribed);
  const descriptionSnippet = useMemo(() => cleanDescription(item.description), [item.description]);

  // Tags overflow popover state
  const [showTagsPopover, setShowTagsPopover] = useState(false);
  const popoverTimeoutRef = useRef(null);

  const handleTagsMouseEnter = () => {
    if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
    if (displayTags.length > visibleTagCount) {
      setShowTagsPopover(true);
    }
  };

  const handleTagsMouseLeave = () => {
    popoverTimeoutRef.current = setTimeout(() => {
      setShowTagsPopover(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
    };
  }, []);

  // Dynamic tags fitting to fill entire row width without wrapping or overflowing
  const tagsContainerRef = useRef(null);
  // Fast initial estimate so rows don't need a forced layout reflow or immediate secondary re-render on mount
  const initialFit = Math.min(displayTags.length, cardSize === 1 ? 2 : cardSize === 2 ? 4 : 6);
  const [visibleTagCount, setVisibleTagCount] = useState(initialFit);

  useEffect(() => {
    const container = tagsContainerRef.current;
    if (!container || displayTags.length === 0) return;

    const computeFit = () => {
      if (typeof document !== 'undefined' && document.body.classList.contains('is-resizing')) return;
      const containerWidth = container.offsetWidth;
      if (containerWidth <= 0) return;

      let totalWidth = 0;
      let fitCount = 0;
      const gap = 4;
      const remainderReserve = 36; // Full reserve for "+N" badge including padding/border

      for (let i = 0; i < displayTags.length; i++) {
        const { tag, type } = displayTags[i];
        const displayLabel = getTagDisplayPath(tag, type, tagPathMap);
        const tagWidth = estimateTagWidth(displayLabel, false);
        const needed = totalWidth + tagWidth + (fitCount > 0 ? gap : 0);

        const hasMore = i < displayTags.length - 1;
        if (needed + (hasMore ? gap + remainderReserve : 0) <= containerWidth) {
          totalWidth = needed;
          fitCount++;
        } else {
          break;
        }
      }

      const nextFit = Math.max(1, fitCount);
      setVisibleTagCount(prev => prev === nextFit ? prev : nextFit);
    };

    // Defer measurement via rAF so initial mount does not cause layout thrashing
    const rafId = requestAnimationFrame(computeFit);
    const unobserve = observeElementResize(container, computeFit);

    return () => {
      cancelAnimationFrame(rafId);
      unobserve();
    };
  }, [displayTags, item.published_file_id, cardSize, tagPathMap]);

  // Description line clamping directly based on card density (pure CSS, zero layout thrashing)
  const maxDescLines = cardSize === 1 ? 1 : cardSize === 2 ? 2 : 4;

  // Background style based on selection
  let cardBgClass = 'bg-[#141b23] hover:bg-[#1a232e]';
  if (isSelected) {
    cardBgClass = 'bg-[#15251c]';
  }

  // Adaptive thumbnail width based on card density (cardSize: 1 = S, 2 = M, 3 = L)
  const thumbWidthClass = cardSize === 1
    ? 'w-28 sm:w-32'
    : cardSize === 2
    ? 'w-36 sm:w-44'
    : 'w-52 sm:w-60 md:w-64';

  const authorName = item.creator_name || item.creator;

  return (
    <div
      onClick={(e) => onItemClick(e, item, index)}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenDetail(item);
      }}
      data-view-item="row"
      className={`group relative rounded-lg border transition duration-150 cursor-pointer flex flex-row items-stretch select-none ${
        showTagsPopover ? 'z-40' : ''
      } ${
        isAnchor ? 'border-[#66c0f4]' : isSelected ? 'border-transparent' : 'border-[#233547] hover:border-[#38536f]'
      } ${cardBgClass} ${isUnsubscribed ? 'grayscale' : ''}`}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: cardSize === 1 ? '340px 72px' : cardSize === 2 ? '480px 96px' : '1000px 124px',
        filter: isUnsubscribed ? 'grayscale(100%)' : undefined,
        boxShadow: isAnchor
          ? '0 0 16px 3px rgba(102, 192, 244, 0.45), 0 0 4px 1px rgba(102, 192, 244, 0.6)'
          : undefined
      }}
    >
      {/* Inner Green Selection Glow / Inset Border */}
      {isSelected && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none z-20 transition-all duration-150"
          style={{
            boxShadow: 'inset 0 0 0 1.5px #a4d053, inset 0 0 14px 2px rgba(164, 208, 83, 0.4)'
          }}
        />
      )}

      {/* 1. Left Section: Thumbnail & Quick Status Badges */}
      <div className={`relative ${thumbWidthClass} shrink-0 bg-[#101822] overflow-hidden border-r border-[#233547] flex items-center justify-center aspect-video rounded-l-lg`}>
        {/* Favorite Star (top-left) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onToggleFavorite) {
              onToggleFavorite(item.published_file_id);
            }
          }}
          title={item.is_favorited ? 'Видалити з обраного' : 'Додати в обране'}
          className={`absolute top-1.5 left-1.5 z-10 p-1 rounded-md backdrop-blur-xs transition shadow cursor-pointer ${
            item.is_favorited
              ? 'bg-[#101822]/90 text-[#f6be3c] border border-[#f6be3c]/50 hover:bg-black/90'
              : 'bg-black/60 text-gray-400 border border-white/10 hover:text-white hover:bg-black/80'
          }`}
        >
          <Star
            className={`w-3.5 h-3.5 transition ${
              item.is_favorited ? 'fill-[#f6be3c] text-[#f6be3c] scale-105' : ''
            }`}
          />
        </button>

        {/* Pending Planned Action Badge & Status Badges (top-right) */}
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 pointer-events-auto">
          {pendingAction && (
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onRemovePendingAction) {
                  onRemovePendingAction(item.published_file_id);
                }
              }}
              title={`Заплановано: ${
                pendingAction === 'disable'
                  ? 'Вимкнути'
                  : pendingAction === 'enable'
                  ? 'Увімкнути'
                  : pendingAction === 'unsubscribe'
                  ? 'Відписатися'
                  : 'Підписатися'
              }. Натисніть, щоб скасувати`}
              className={`p-0.5 px-1.5 rounded-md backdrop-blur-xs transition shadow flex items-center gap-1 cursor-pointer group/badge ${
                pendingAction === 'disable'
                  ? 'bg-[#2b190d]/95 text-[#f49e42] border border-[#f49e42] hover:bg-[#3d2313]'
                  : pendingAction === 'enable'
                  ? 'bg-[#14281a]/95 text-[#a4d053] border border-[#a4d053] hover:bg-[#1d3d27]'
                  : pendingAction === 'unsubscribe'
                  ? 'bg-[#2b1014]/95 text-[#ff6b6b] border border-[#ff6b6b] hover:bg-[#40181e]'
                  : 'bg-[#102030]/95 text-[#66c0f4] border border-[#66c0f4] hover:bg-[#163047]'
              }`}
            >
              {pendingAction === 'disable' && <PowerOff className="w-3 h-3" />}
              {pendingAction === 'enable' && <Power className="w-3 h-3" />}
              {pendingAction === 'unsubscribe' && <Trash2 className="w-3 h-3" />}
              {pendingAction === 'subscribe' && <CheckCircle2 className="w-3 h-3" />}
              <span className="text-[9.5px] font-bold">План</span>
              <X className="w-2.5 h-2.5 opacity-60 group-hover/badge:opacity-100" />
            </div>
          )}

          {isDisabled && (
            <div
              title="Відключено"
              className="p-1 rounded-md backdrop-blur-xs transition shadow bg-[#1c140c]/90 text-[#f49e42] border border-[#f49e42]/60 flex items-center justify-center"
            >
              <PowerOff className="w-3 h-3" />
            </div>
          )}
          {isUnsubscribed && (
            <div
              title="Не підписаний"
              className="p-1 rounded-md backdrop-blur-xs transition shadow bg-[#201014]/90 text-[#ff6b6b] border border-[#ff6b6b]/60 flex items-center justify-center"
            >
              <Trash2 className="w-3 h-3" />
            </div>
          )}
        </div>

        {/* Thumbnail Image */}
        <img
          src={previewSrc}
          alt={item.title}
          onError={(e) => {
            if (item.preview_url && e.target.src !== item.preview_url) {
              e.target.src = item.preview_url;
            } else {
              e.target.style.display = 'none';
            }
          }}
          className={`w-full h-full object-cover group-hover:scale-105 transition duration-300 pointer-events-none ${
            isUnsubscribed ? 'grayscale' : ''
          }`}
          style={{
            filter: isUnsubscribed ? 'grayscale(100%)' : undefined
          }}
          loading="lazy"
        />
      </div>

      {/* 2. Unified Content Section: title, meta, description, tags */}
      <div className="@container flex-1 min-w-0 px-2.5 py-2 sm:px-3 sm:py-2 flex flex-col justify-between gap-1 h-full overflow-hidden">
        
        {/* Top Header Section: Row 1 = Title (all remaining space) + Right corner Status/Sorting */}
        <div className="shrink-0 min-w-0 flex flex-col gap-y-1 overflow-hidden">
          {/* Row 1: Title on left (all remaining space), Status & Sorting in right corner */}
          <div className="shrink-0 min-w-0 flex items-center justify-between gap-2 w-full">
            {/* Title & optional ID link: takes all available remaining space */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h3
                className={`${cardSize === 1 ? 'text-xs' : cardSize === 2 ? 'text-sm' : 'text-sm sm:text-base'} font-bold text-white group-hover:text-[#66c0f4] transition truncate min-w-0 flex-1 leading-tight`}
                title={item.title}
              >
                {item.title}
              </h3>

              {/* Mod ID is Workshop Link; shown when space permits on M & L (>= 420px), omitted on S */}
              {cardSize !== 1 && (
                <a
                  href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.published_file_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-[#66c0f4] hover:border-[#66c0f4]/50 items-center gap-1 font-mono text-[10px] sm:text-[10.5px] text-[#8f98a0] bg-[#101822] hover:bg-[#182535] px-1.5 py-0.5 rounded border border-[#233547] transition shrink-0 whitespace-nowrap hidden @min-[420px]:inline-flex"
                  title="Відкрити сторінку мода в Steam Workshop"
                >
                  ID: {item.published_file_id}
                  <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </a>
              )}
            </div>

            {/* Right corner: Status & Sorting badge (plus Author & Size in S mode) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* In S mode: show author & size with graceful responsive hiding (size drops before author) */}
              {cardSize === 1 && (
                <>
                  {authorName && (
                    <span
                      className="hidden @min-[260px]:inline-flex items-center text-[10.5px] text-[#8f98a0] min-w-0 shrink truncate max-w-[120px] mr-0.5"
                      title={item.creator ? `Автор: ${authorName} (SteamID: ${item.creator})` : `Автор: ${authorName}`}
                    >
                      <span className="shrink-0 mr-1 text-[#657484]">автор:</span>
                      <span className="text-gray-300 font-medium truncate">{authorName}</span>
                    </span>
                  )}
                  <div
                    className="hidden @min-[340px]:inline-flex items-center gap-1 font-mono text-[10px] text-[#a4d053] shrink-0 mr-1"
                    title={`Розмір: ${formatBytes(item.local_size_bytes || item.api_file_size)}`}
                  >
                    <HardDrive className="w-2.5 h-2.5 text-[#a4d053] shrink-0" />
                    <span>{formatBytes(item.local_size_bytes || item.api_file_size)}</span>
                  </div>
                </>
              )}

              {/* Status Indicator (full analogue of ItemDetailModal: highest priority, always visible in right corner) */}
              <div
                className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 text-[10px] sm:text-[10.5px] font-medium ${
                  isUnsubscribed
                    ? 'text-[#ff6b6b]'
                    : isDisabled
                    ? 'text-[#f49e42]'
                    : 'text-[#a4d053]'
                }`}
                title={`Статус: ${isUnsubscribed ? 'Видалений' : isDisabled ? 'Відключений' : 'Активний'}`}
              >
                {isUnsubscribed ? (
                  <Trash2 className="w-3 h-3 shrink-0" />
                ) : isDisabled ? (
                  <PowerOff className="w-3 h-3 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                )}
                <span>{isUnsubscribed ? 'Видалений' : isDisabled ? 'Відключений' : 'Активний'}</span>
              </div>

              {/* Organization Badge (shown if space allows, hidden in narrow edgecases) */}
              <span
                className={`hidden @min-[240px]:inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap shrink-0 ${
                  item.is_sorted
                    ? 'bg-[#14281a] text-[#a4d053] border-[#a4d053]/40'
                    : 'bg-[#2a1c10] text-[#f49e42] border-[#f49e42]/40'
                }`}
                title={item.is_sorted ? 'Організація: Відсортовано' : 'Організація: Не відсортовано'}
              >
                {item.is_sorted ? 'Відсортовано' : 'Не відсортовано'}
              </span>
            </div>
          </div>

          {/* Row 2 (for M and L cards): Author, Size, Dates — only if space permits */}
          {cardSize !== 1 && (
            <div className="shrink-0 min-w-0 flex items-center gap-2 sm:gap-2.5 flex-nowrap text-[10.5px] sm:text-[11px] text-[#8f98a0] leading-none overflow-hidden max-w-full">
              {/* Author Name (for L & M): drops if width < 280px */}
              {authorName && (
                <span
                  className="hidden @min-[280px]:inline-flex items-center text-[10.5px] sm:text-[11px] text-[#8f98a0] min-w-0 shrink truncate max-w-[170px]"
                  title={item.creator ? `Автор: ${authorName} (SteamID: ${item.creator})` : `Автор: ${authorName}`}
                >
                  <span className="shrink-0 mr-1 text-[#657484]">автор:</span>
                  <span className="text-gray-300 font-medium truncate">{authorName}</span>
                </span>
              )}

              {/* Mod Size Badge (for M & L): drops if width < 360px (BEFORE author drops at 280px!) */}
              <div
                className="hidden @min-[360px]:inline-flex items-center gap-1 font-mono text-[10px] sm:text-[10.5px] text-[#a4d053] whitespace-nowrap shrink-0"
                title={`Розмір: ${formatBytes(item.local_size_bytes || item.api_file_size)}`}
              >
                <HardDrive className="w-3 h-3 text-[#a4d053] shrink-0" />
                <span>{formatBytes(item.local_size_bytes || item.api_file_size)}</span>
              </div>

              {/* Updated timestamp (for M & L): drops if width < 440px */}
              <div
                className="hidden @min-[440px]:inline-flex items-center gap-1 font-mono text-[10px] sm:text-[10.5px] text-[#758494] whitespace-nowrap shrink-0"
                title="Дата оновлення"
              >
                <Calendar className="w-3 h-3 text-[#66c0f4] shrink-0" />
                <span>{formatDate(item.time_updated || item.local_mtime)}</span>
              </div>

              {/* Created timestamp (only in L mode): drops first if width < 540px */}
              {item.time_created && cardSize === 3 && (
                <div
                  className="hidden @min-[540px]:inline-flex items-center gap-1 font-mono text-[10px] sm:text-[10.5px] text-[#758494] whitespace-nowrap shrink-0"
                  title="Дата створення"
                >
                  <Clock className="w-3 h-3 text-gray-500 shrink-0" />
                  <span>{formatDate(item.time_created)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Middle Section: Dynamic multi-line description snippet that fills available vertical space */}
        {descriptionSnippet ? (
          <div className="flex-1 min-w-0 my-0.5 overflow-hidden flex items-center">
            <p
              className="text-xs text-[#8f98a0] leading-snug max-w-full"
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: maxDescLines,
                overflow: 'hidden'
              }}
              title={descriptionSnippet}
            >
              {descriptionSnippet}
            </p>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Bottom Section: Tags Flow (single line with dynamic fit & remainder badge, zero overflow) */}
        {displayTags.length > 0 && (
          <div
            className="relative mt-1 pt-1 border-t border-[#233547]/40 min-w-0"
            onMouseEnter={handleTagsMouseEnter}
            onMouseLeave={handleTagsMouseLeave}
          >
            <div ref={tagsContainerRef} className="flex items-center gap-1 w-full overflow-hidden min-w-0">
              {displayTags.slice(0, visibleTagCount).map(({ tag, type }, idx) => {
                const isUser = type === 'user';
                const isActive = isUser ? selectedUserTags.has(tag) : selectedSteamTags.has(tag);
                const displayLabel = getTagDisplayPath(tag, type, tagPathMap);

                let pillStyle = '';
                if (isActive) {
                  pillStyle = isUser
                    ? 'border border-[#f49e42] bg-[#332211] text-[#ffd699] font-semibold px-2 py-0.5 rounded-full shadow-xs'
                    : 'border border-[#66c0f4] bg-[#162738] text-[#cce8ff] font-semibold px-2 py-0.5 rounded-full shadow-xs';
                } else {
                  pillStyle = isUser
                    ? 'bg-[#151a22] text-[#f49e42] border border-[#233547]/50 px-1.5 py-0.5 rounded-md font-medium'
                    : 'bg-[#151a22] text-[#66c0f4] border border-[#233547]/50 px-1.5 py-0.5 rounded-md font-medium';
                }

                const hasOverflow = displayTags.length > visibleTagCount;
                const maxTagWidth = hasOverflow ? 'max-w-[calc(100%-40px)]' : 'max-w-[200px]';

                return (
                  <span
                    key={`${type}-${tag}-${idx}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const isCtrl = e.ctrlKey || e.metaKey;
                      if (isUser && onToggleUserTag) onToggleUserTag(tag, isCtrl);
                      else if (!isUser && onToggleTag) onToggleTag(tag, isCtrl);
                    }}
                    className={`text-[10.5px] sm:text-[11px] whitespace-nowrap leading-tight transition select-none truncate shrink-0 cursor-pointer hover:opacity-90 ${maxTagWidth} ${pillStyle}`}
                    title={`Фільтрувати за тегом: ${displayLabel}`}
                  >
                    {displayLabel}
                  </span>
                );
              })}
              {displayTags.length > visibleTagCount && (
                <span
                  className="text-[10px] sm:text-[10.5px] text-gray-400 font-mono font-medium self-center shrink-0 whitespace-nowrap px-1 py-0.5 bg-[#17222f] rounded border border-[#233547] cursor-pointer hover:text-white hover:border-[#66c0f4]/60 transition"
                  title={`Ще ${displayTags.length - visibleTagCount} прихованих тегів (наведіть курсор для перегляду)`}
                >
                  +{displayTags.length - visibleTagCount}
                </span>
              )}
            </div>

            {/* Overflow Popover showing full list of tags */}
            {showTagsPopover && displayTags.length > visibleTagCount && (
              <div
                className="absolute bottom-full left-0 mb-1.5 z-50 min-w-[240px] max-w-[420px] max-h-52 overflow-y-auto bg-[#0e1622]/98 backdrop-blur-md border border-[#2c4257] rounded-lg shadow-2xl p-2.5 flex flex-wrap gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseEnter={handleTagsMouseEnter}
                onMouseLeave={handleTagsMouseLeave}
              >
                <div className="w-full flex items-center justify-between pb-1.5 mb-0.5 border-b border-[#233547]/80 text-[11px] text-[#8f98a0]">
                  <span className="font-semibold text-gray-300">Всі теги ({displayTags.length})</span>
                  <span className="text-[10px] text-[#657484]">Ctrl+клік для кількох</span>
                </div>
                {displayTags.map(({ tag, type }, idx) => {
                  const isUser = type === 'user';
                  const isActive = isUser ? selectedUserTags.has(tag) : selectedSteamTags.has(tag);
                  const displayLabel = getTagDisplayPath(tag, type, tagPathMap);
                  let pillStyle = '';
                  if (isActive) {
                    pillStyle = isUser
                      ? 'border border-[#f49e42] bg-[#332211] text-[#ffd699] font-semibold px-2 py-0.5 rounded-full shadow-xs'
                      : 'border border-[#66c0f4] bg-[#162738] text-[#cce8ff] font-semibold px-2 py-0.5 rounded-full shadow-xs';
                  } else {
                    pillStyle = isUser
                      ? 'bg-[#151a22] text-[#f49e42] border border-[#233547]/50 px-1.5 py-0.5 rounded-md font-medium hover:border-[#f49e42]/60'
                      : 'bg-[#151a22] text-[#66c0f4] border border-[#233547]/50 px-1.5 py-0.5 rounded-md font-medium hover:border-[#66c0f4]/60';
                  }
                  return (
                    <span
                      key={`popover-${type}-${tag}-${idx}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const isCtrl = e.ctrlKey || e.metaKey;
                        if (isUser && onToggleUserTag) onToggleUserTag(tag, isCtrl);
                        else if (!isUser && onToggleTag) onToggleTag(tag, isCtrl);
                      }}
                      className={`text-xs whitespace-nowrap leading-tight transition select-none cursor-pointer ${pillStyle}`}
                      title={`Фільтрувати за тегом: ${displayLabel}`}
                    >
                      {displayLabel}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}, areItemRowPropsEqual);
