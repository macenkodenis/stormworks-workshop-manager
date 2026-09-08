import React, { useRef, useState, useLayoutEffect } from 'react';
import { ExternalLink, HardDrive, Calendar, Clock, CheckCircle2, Star, PowerOff, Power, Trash2, X } from 'lucide-react';
import { getTagDisplayPath } from '../utils/tagUtils';

export function ItemRow({
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
  cardSize = 3
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

  // Clean description from BBCode & formatting for clean 1-2 line snippet
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

  const previewSrc = `/api/previews/${item.published_file_id}`;

  // Unified tags: active Steam tags + User tags
  const deactivatedSet = new Set(item.deactivated_steam_tags || []);
  const activeSteamTags = (item.tags || []).filter(t => !deactivatedSet.has(t)).map(t => ({
    tag: t,
    type: 'steam'
  }));
  const userTagsList = (item.user_tags || []).map(t => ({
    tag: t,
    type: 'user'
  }));
  const displayTags = [...userTagsList, ...activeSteamTags];
  const isDisabled = Boolean(item.is_disabled);
  const isUnsubscribed = Boolean(item.is_unsubscribed);
  const descriptionSnippet = cleanDescription(item.description);

  // Dynamic tags fitting to fill entire row width without wrapping or overflowing
  const tagsContainerRef = useRef(null);
  const [visibleTagCount, setVisibleTagCount] = useState(displayTags.length);

  useLayoutEffect(() => {
    const container = tagsContainerRef.current;
    if (!container || displayTags.length === 0) return;

    const computeFit = () => {
      const containerWidth = container.offsetWidth;
      if (containerWidth <= 0) return;

      const children = Array.from(container.children);
      let totalWidth = 0;
      let fitCount = 0;
      const gap = 4;
      const remainderReserve = 32;

      for (let i = 0; i < displayTags.length; i++) {
        const child = children[i];
        if (!child) break;
        const childWidth = child.offsetWidth;
        const needed = totalWidth + childWidth + (fitCount > 0 ? gap : 0);

        const hasMore = i < displayTags.length - 1;
        if (needed + (hasMore ? gap + remainderReserve : 0) <= containerWidth) {
          totalWidth = needed;
          fitCount++;
        } else if (fitCount === 0 && needed <= containerWidth) {
          fitCount = 1;
          break;
        } else {
          break;
        }
      }

      setVisibleTagCount(Math.max(1, fitCount));
    };

    computeFit();

    const observer = new ResizeObserver(computeFit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [displayTags.length, item.published_file_id, cardSize]);

  // Dynamic description line-clamp calculation based on available vertical space
  const descContainerRef = useRef(null);
  const descTextRef = useRef(null);
  const [maxDescLines, setMaxDescLines] = useState(cardSize === 1 ? 1 : cardSize === 2 ? 2 : 4);

  useLayoutEffect(() => {
    const container = descContainerRef.current;
    if (!container || !descriptionSnippet) return;

    const computeLines = () => {
      const h = container.clientHeight;
      if (h <= 0) return;
      const computedLh = descTextRef.current
        ? parseFloat(window.getComputedStyle(descTextRef.current).lineHeight)
        : 18;
      const lh = computedLh && !isNaN(computedLh) && computedLh > 10 ? computedLh : 18;
      const lines = Math.max(1, Math.floor((h + 2) / lh));
      setMaxDescLines(cardSize === 1 ? 1 : lines);
    };

    computeLines();
    const ro = new ResizeObserver(computeLines);
    ro.observe(container);
    return () => ro.disconnect();
  }, [cardSize, descriptionSnippet]);

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
      className={`group relative rounded-lg border transition duration-150 cursor-pointer flex flex-row items-stretch select-none overflow-hidden ${
        isAnchor ? 'border-[#66c0f4]' : isSelected ? 'border-transparent' : 'border-[#233547] hover:border-[#38536f]'
      } ${cardBgClass} ${isUnsubscribed ? 'grayscale' : ''}`}
      style={{
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
      <div className={`relative ${thumbWidthClass} shrink-0 bg-[#101822] overflow-hidden border-r border-[#233547] flex items-center justify-center aspect-video`}>
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

        {/* Disk Size Badge (bottom-right of thumbnail) */}
        <div className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-xs text-[#a4d053] font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/40 flex items-center gap-1">
          <HardDrive className="w-2.5 h-2.5" />
          {formatBytes(item.local_size_bytes || item.api_file_size)}
        </div>
      </div>

      {/* 2. Unified Content Section: title, meta, description, tags */}
      <div className="@container flex-1 min-w-0 px-2.5 py-2 sm:px-3 sm:py-2 flex flex-col justify-between gap-1 h-full overflow-hidden">
        
        {/* Top Header Row: Title & ID on line 1, Metadata on right or line 2. Strict max 2 lines. */}
        <div className="shrink-0 min-w-0 flex items-center justify-between gap-x-3 gap-y-1 flex-wrap max-h-[50px] sm:max-h-[54px] overflow-hidden">
          {/* Title & Steam ID Workshop Link */}
          <div className="flex items-center gap-2 min-w-[min(100%,200px)] flex-1 max-w-full">
            <h3
              className={`${cardSize === 1 ? 'text-xs' : cardSize === 2 ? 'text-sm' : 'text-sm sm:text-base'} font-bold text-white group-hover:text-[#66c0f4] transition truncate min-w-0 flex-1 leading-tight`}
              title={item.title}
            >
              {item.title}
            </h3>

            {/* Mod ID is Workshop Link; shown when space permits (>= 380px), omitted on S */}
            {cardSize !== 1 && (
              <a
                href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.published_file_id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-[#66c0f4] hover:border-[#66c0f4]/50 items-center gap-1 font-mono text-[10px] sm:text-[10.5px] text-[#8f98a0] bg-[#101822] hover:bg-[#182535] px-1.5 py-0.5 rounded border border-[#233547] transition shrink-0 whitespace-nowrap hidden @min-[380px]:inline-flex"
                title="Відкрити сторінку мода в Steam Workshop"
              >
                ID: {item.published_file_id}
                <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </a>
            )}
          </div>

          {/* Metadata Bar (Badges, Author, Dates): flex-nowrap to guarantee max 1 line, drops dates then author if space is tight */}
          <div className="flex items-center gap-2 flex-nowrap text-[10.5px] sm:text-[11px] text-[#8f98a0] leading-none min-w-0 max-w-full overflow-hidden shrink-0">
            {/* Organization Badge */}
            {item.is_sorted ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#14281a] text-[#a4d053] border border-[#a4d053]/40 whitespace-nowrap shrink-0">
                Відсортовано
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2a1c10] text-[#f49e42] border border-[#f49e42]/40 whitespace-nowrap shrink-0">
                Не відсортовано
              </span>
            )}

            {/* Status Badge (for M & L) */}
            {cardSize !== 1 && (
              <div className="hidden @min-[260px]:inline-flex items-center gap-1 text-[#5c7e10] whitespace-nowrap shrink-0">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span className="text-[10px] sm:text-[10.5px]">Встановлено</span>
              </div>
            )}

            {/* Author Name (for L & M): drops if width < 360px */}
            {authorName && cardSize !== 1 && (
              <span
                className="hidden @min-[360px]:inline-flex items-center text-[10.5px] sm:text-[11px] text-[#8f98a0] min-w-0 shrink truncate max-w-[170px]"
                title={item.creator ? `Автор: ${authorName} (SteamID: ${item.creator})` : `Автор: ${authorName}`}
              >
                <span className="shrink-0 mr-1">автор:</span>
                <span className="text-gray-300 font-medium truncate">{authorName}</span>
              </span>
            )}

            {/* Updated timestamp (for M & L): drops if width < 480px (dates drop before author) */}
            {cardSize !== 1 && (
              <div
                className="hidden @min-[480px]:inline-flex items-center gap-1 font-mono text-[10px] sm:text-[10.5px] text-[#758494] whitespace-nowrap shrink-0"
                title="Дата оновлення"
              >
                <Calendar className="w-3 h-3 text-[#66c0f4] shrink-0" />
                <span>{formatDate(item.time_updated || item.local_mtime)}</span>
              </div>
            )}

            {/* Created timestamp (only in L mode): drops first if width < 580px */}
            {item.time_created && cardSize === 3 && (
              <div
                className="hidden @min-[580px]:inline-flex items-center gap-1 font-mono text-[10px] sm:text-[10.5px] text-[#758494] whitespace-nowrap shrink-0"
                title="Дата створення"
              >
                <Clock className="w-3 h-3 text-gray-500 shrink-0" />
                <span>{formatDate(item.time_created)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Middle Section: Dynamic multi-line description snippet that fills available vertical space */}
        {descriptionSnippet ? (
          <div ref={descContainerRef} className="flex-1 min-w-0 my-0.5 overflow-hidden flex items-center">
            <p
              ref={descTextRef}
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
          <div ref={tagsContainerRef} className="mt-1 flex items-center gap-1 w-full overflow-hidden pt-1 border-t border-[#233547]/40 min-w-0">
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

              return (
                <span
                  key={`${type}-${tag}-${idx}`}
                  className={`text-[10.5px] sm:text-[11px] whitespace-nowrap leading-tight transition select-none truncate max-w-[200px] shrink-0 ${pillStyle}`}
                  title={displayLabel}
                >
                  {displayLabel}
                </span>
              );
            })}
            {displayTags.length > visibleTagCount && (
              <span className="text-[10.5px] text-gray-500 font-mono self-center shrink-0">
                +{displayTags.length - visibleTagCount}
              </span>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
