import React from 'react';
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

  // Background style based on selection
  let cardBgClass = 'bg-[#141b23] hover:bg-[#1a232e]';
  if (isSelected) {
    cardBgClass = 'bg-[#15251c]';
  }

  // Adaptive thumbnail width based on card density (cardSize: 1 = S, 2 = M, 3 = L)
  const thumbWidthClass = cardSize === 1
    ? 'w-32 sm:w-36'
    : cardSize === 2
    ? 'w-40 sm:w-48'
    : 'w-48 sm:w-56 md:w-64';

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
      <div className={`relative ${thumbWidthClass} shrink-0 bg-[#101822] overflow-hidden border-r border-[#233547] flex items-center justify-center aspect-video sm:aspect-auto`}>
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
      <div className="flex-1 min-w-0 p-2.5 sm:p-3 flex flex-col justify-between gap-1.5">
        
        {/* Row 1: Title, ID, Steam link, Author, Status Badges & Dates */}
        <div>
          <div className={`flex items-start justify-between gap-2 ${cardSize === 3 ? 'flex-wrap sm:flex-nowrap' : 'flex-wrap'}`}>
            
            {/* Title & primary links */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3
                  className={`${cardSize === 1 ? 'text-xs' : 'text-sm'} font-bold text-white group-hover:text-[#66c0f4] transition truncate max-w-full leading-tight`}
                  title={item.title}
                >
                  {item.title}
                </h3>
                <span className="font-mono text-[10px] sm:text-[10.5px] text-[#8f98a0] bg-[#101822] px-1.5 py-0.5 rounded border border-[#233547] shrink-0">
                  ID: {item.published_file_id}
                </span>
                <a
                  href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.published_file_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-[#66c0f4] flex items-center gap-1 text-[10.5px] sm:text-[11px] text-[#8f98a0] transition shrink-0"
                  title="Відкрити в Steam Workshop"
                >
                  Steam <ExternalLink className="w-3 h-3" />
                </a>
                {item.creator && cardSize !== 1 && (
                  <span className="text-[10.5px] sm:text-[11px] text-[#8f98a0] truncate shrink-0">
                    автор: <strong className="text-gray-300 font-normal">{item.creator}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Status indicators & Dates */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end text-[10.5px] sm:text-[11px]">
              {/* Organization Badge */}
              {item.is_sorted ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#14281a] text-[#a4d053] border border-[#a4d053]/40 whitespace-nowrap">
                  Відсортовано
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2a1c10] text-[#f49e42] border border-[#f49e42]/40 whitespace-nowrap">
                  Не відсортовано
                </span>
              )}

              {/* Status Badge */}
              <div className="flex items-center gap-1 text-[#5c7e10] whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3" />
                <span className="text-[10px] sm:text-[10.5px]">Встановлено</span>
              </div>

              {/* Updated timestamp */}
              <div className="flex items-center gap-1 font-mono text-[10px] sm:text-[10.5px] text-[#758494] whitespace-nowrap" title="Дата оновлення">
                <Calendar className="w-3 h-3 text-[#66c0f4]" />
                <span>{formatDate(item.time_updated || item.local_mtime)}</span>
              </div>

              {/* Created timestamp (in L mode) */}
              {item.time_created && cardSize === 3 && (
                <div className="hidden lg:flex items-center gap-1 font-mono text-[10.5px] text-[#758494] whitespace-nowrap" title="Дата створення">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span>{formatDate(item.time_created)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Clean Description Excerpt */}
          {descriptionSnippet && (
            <p className={`mt-1 text-xs text-[#8f98a0] leading-relaxed max-w-full ${cardSize === 1 ? 'line-clamp-1' : 'line-clamp-2'}`}>
              {descriptionSnippet}
            </p>
          )}
        </div>

        {/* Row 3: Tags Flow (User tags + Steam tags with hierarchical path display) */}
        {displayTags.length > 0 && (
          <div className="mt-1 flex items-center gap-1 flex-wrap overflow-hidden pt-1 border-t border-[#233547]/40 max-h-14">
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
          </div>
        )}

      </div>
    </div>
  );
}
