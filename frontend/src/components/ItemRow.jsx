import React, { useRef, useMemo } from 'react';
import { ExternalLink, HardDrive, Calendar, Clock, TagX } from 'lucide-react';
import { getTagDisplayPath, cleanDescription } from '../utils/tagUtils';
import { formatBytes, formatDate } from '../utils/formatters';
import { useDynamicTagFit } from '../hooks/useDynamicTagFit';
import { FavoriteStar, ItemStatusBadges } from './ItemBadges';
import { useI18n } from '../i18n/I18nContext';

function areItemRowPropsEqual(prev, next) {
  if (prev.item !== next.item) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isAnchor !== next.isAnchor) return false;
  if (prev.pendingAction !== next.pendingAction) return false;
  if (prev.cardSize !== next.cardSize) return false;
  if (prev.tagPathMap !== next.tagPathMap) return false;
  if (prev.tagFullPathMap !== next.tagFullPathMap) return false;

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
  tagFullPathMap,
  cardSize = 3,
  onToggleTag,
  onToggleUserTag,
  onContextMenu
}) {
  const { t, tTag } = useI18n();
  const previewSrc = `/api/previews/${item.published_file_id}`;

  // Unified tags: active Steam tags + User tags
  const deactivatedSet = useMemo(
    () => new Set((item.deactivated_steam_tags || []).map(t => String(t).toLowerCase())),
    [item.deactivated_steam_tags]
  );
  const displayTags = useMemo(() => {
    const activeSteamTags = (item.tags || []).filter(t => t && !deactivatedSet.has(String(t).toLowerCase())).map(t => ({
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
  const descriptionSnippet = useMemo(() => {
    if (cardSize === 1 || !item.description) return '';
    return cleanDescription(item.description);
  }, [item.description, cardSize]);

  // Dynamic tags fitting hook
  const rowRef = useRef(null);
  const tagsContainerRef = useRef(null);
  const defaultFit = Math.min(displayTags.length, cardSize === 1 ? 4 : cardSize === 2 ? 4 : 6);

  const {
    visibleTagCount,
    showTagsPopover,
    handleTagsMouseEnter,
    handleTagsMouseLeave
  } = useDynamicTagFit({
    displayTags,
    tagPathMap,
    cardSize,
    defaultFit,
    containerRef: tagsContainerRef,
    rootRef: rowRef
  });

  // Description line clamping directly based on card density (pure CSS, zero layout thrashing)
  const maxDescLines = cardSize === 1 ? 1 : cardSize === 2 ? 2 : 4;

  // Background style based on selection
  let cardBgClass = 'bg-[#141b23] hover:bg-[#1a232e]';
  if (isSelected) {
    cardBgClass = 'bg-[#15251c]';
  }

  // Adaptive thumbnail width based on card density (cardSize: 1 = S, 2 = M, 3 = L)
  const thumbWidthClass = cardSize === 1
    ? 'w-36 sm:w-40'
    : cardSize === 2
    ? 'w-36 sm:w-44'
    : 'w-52 sm:w-60 md:w-64';

  const authorName = item.creator_name || item.creator;

  return (
    <div
      ref={rowRef}
      onClick={(e) => onItemClick(e, item, index)}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenDetail(item);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onContextMenu) {
          onContextMenu(e, item);
        }
      }}
      id={`mod-card-${item.published_file_id}`}
      data-item-id={item.published_file_id}
      data-view-item="row"
      className={`group relative w-full min-w-0 max-w-full rounded-lg border transition duration-150 cursor-pointer flex flex-row items-stretch select-none ${
        showTagsPopover ? 'z-30' : ''
      } ${
        isAnchor ? 'border-[#66c0f4]' : isSelected ? 'border-transparent' : 'border-[#233547] hover:border-[#38536f]'
      } ${cardBgClass} ${isUnsubscribed ? 'grayscale' : ''}`}
      style={{
        contentVisibility: showTagsPopover ? 'visible' : 'auto',
        containIntrinsicSize: cardSize === 1 ? 'auto 92px' : cardSize === 2 ? 'auto 96px' : 'auto 124px',
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
        <FavoriteStar
          isFavorited={item.is_favorited}
          onToggle={onToggleFavorite}
          itemId={item.published_file_id}
          size="sm"
        />

        {/* Pending Planned Action Badge & Status Badges (top-right) */}
        <ItemStatusBadges
          itemId={item.published_file_id}
          pendingAction={pendingAction}
          onRemovePendingAction={onRemovePendingAction}
          isDisabled={isDisabled}
          isUnsubscribed={isUnsubscribed}
          size="sm"
        />

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
          decoding="async"
        />
      </div>

      {/* 2. Unified Content Section: title, meta, description, tags */}
      <div className={`@container flex-1 min-w-0 px-2.5 py-2 sm:px-3 sm:py-2 flex flex-col justify-between gap-1 h-full ${
        showTagsPopover ? 'overflow-visible' : 'overflow-hidden'
      }`}>
        
        {/* Top Header Section: Row 1 = Title + Author + Unsorted Badge; Row 2 = Dates & Size */}
        <div className="shrink-0 min-w-0 flex flex-col gap-y-1.5 overflow-hidden">
          {/* Row 1: Title on left (all remaining space), Author & optional Unsorted icon on right */}
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
                  title={t('item.openSteamPage')}
                >
                  ID: {item.published_file_id}
                  <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </a>
              )}
            </div>

            {/* Right corner: Author, and if unsorted: TagX icon at the very end */}
            <div className="flex items-center gap-1.5 shrink-0">
              {authorName && (
                <span
                  className="inline-flex items-center text-[10px] sm:text-[11px] text-[#8f98a0] min-w-0 shrink truncate max-w-[130px] sm:max-w-[170px]"
                  title={item.creator ? `${t('detail.author')} ${authorName} (SteamID: ${item.creator})` : `${t('detail.author')} ${authorName}`}
                >
                  <span className="shrink-0 mr-1 text-[#657484]">{t('detail.author').toLowerCase()}</span>
                  <span className="text-gray-300 font-medium truncate">{authorName}</span>
                </span>
              )}

              {/* Unsorted Icon: only shown if mod is NOT sorted, placed at the very end */}
              {!item.is_sorted && (
                <span
                  title={t('detail.unsorted')}
                  className="flex items-center justify-center text-[#f49e42] hover:text-[#ffb356] transition shrink-0 p-0.5"
                >
                  <TagX className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Dates and Size (present across all sizes S, M, L) */}
          <div className="shrink-0 min-w-0 flex items-center gap-2.5 sm:gap-3.5 flex-nowrap text-[10px] sm:text-[10.5px] text-[#8f98a0] leading-none overflow-hidden max-w-full">
            {/* Created / Subscribed timestamp */}
            {item.time_created && (
              <div
                className="inline-flex items-center gap-1 font-mono text-[#758494] whitespace-nowrap shrink-0"
                title={t('detail.createdAt')}
              >
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#657484] shrink-0" />
                <span>{formatDate(item.time_created)}</span>
              </div>
            )}

            {/* Updated timestamp */}
            {(item.time_updated || item.local_mtime) && (
              <div
                className="inline-flex items-center gap-1 font-mono text-[#758494] whitespace-nowrap shrink-0"
                title={t('detail.updatedAt')}
              >
                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#66c0f4] shrink-0" />
                <span>{formatDate(item.time_updated || item.local_mtime)}</span>
              </div>
            )}

            {/* Mod Size Badge */}
            {(item.local_size_bytes || item.api_file_size) && (
              <div
                className="inline-flex items-center gap-1 font-mono text-[#a4d053] whitespace-nowrap shrink-0"
                title={`${t('detail.localSize')} ${formatBytes(item.local_size_bytes || item.api_file_size)}`}
              >
                <HardDrive className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#a4d053] shrink-0" />
                <span>{formatBytes(item.local_size_bytes || item.api_file_size)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Middle Section: Dynamic multi-line description snippet for M and L cards */}
        {descriptionSnippet && (
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
        )}

        {/* Bottom Section: Tags Flow (single line with dynamic fit & remainder badge, zero overflow) */}
        {displayTags.length > 0 && (
          <div
            className="relative mt-auto pt-1 border-t border-[#233547]/40 min-w-0"
            onMouseEnter={handleTagsMouseEnter}
            onMouseLeave={handleTagsMouseLeave}
          >
            <div ref={tagsContainerRef} className={`flex items-center gap-1 w-full overflow-hidden min-w-0 ${showTagsPopover ? 'invisible' : ''}`}>
              {displayTags.slice(0, visibleTagCount).map(({ tag, type }, idx) => {
                const isUser = type === 'user';
                const isActive = isUser ? selectedUserTags.has(tag) : selectedSteamTags.has(tag);
                const displayLabel = tTag(getTagDisplayPath(tag, type, tagPathMap));
                const fullPath = tTag(getTagDisplayPath(tag, type, tagFullPathMap));

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
                    title={fullPath}
                  >
                    {displayLabel}
                  </span>
                );
              })}
              {displayTags.length > visibleTagCount && (
                <span
                  className="text-[10px] sm:text-[10.5px] text-gray-400 font-mono font-medium self-center shrink-0 whitespace-nowrap px-1 py-0.5 bg-[#17222f] rounded border border-[#233547] cursor-pointer hover:text-white hover:border-[#66c0f4]/60 transition"
                  title={`+${displayTags.length - visibleTagCount}`}
                >
                  +{displayTags.length - visibleTagCount}
                </span>
              )}
            </div>

            {/* Overflow Popover showing full list of tags */}
            {showTagsPopover && displayTags.length > visibleTagCount && (
              <div
                className="absolute -top-1.5 -left-1.5 -right-1.5 z-50 min-w-[calc(100%+12px)] max-h-72 overflow-y-auto bg-[#0e1622]/98 backdrop-blur-md border border-[#2c4257] rounded-lg shadow-2xl p-1.5 flex flex-col"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseEnter={handleTagsMouseEnter}
                onMouseLeave={handleTagsMouseLeave}
              >
                <div className="flex flex-wrap gap-1 items-center">
                  {displayTags.map(({ tag, type }, idx) => {
                    const isUser = type === 'user';
                    const isActive = isUser ? selectedUserTags.has(tag) : selectedSteamTags.has(tag);
                    const displayLabel = tTag(getTagDisplayPath(tag, type, tagPathMap));
                    const fullPath = tTag(getTagDisplayPath(tag, type, tagFullPathMap));
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
                        className={`text-[10.5px] sm:text-[11px] whitespace-nowrap leading-tight transition select-none cursor-pointer ${pillStyle}`}
                        title={fullPath}
                      >
                        {displayLabel}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}, areItemRowPropsEqual);
