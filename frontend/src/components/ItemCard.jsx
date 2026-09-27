import React, { useRef, useMemo } from 'react';
import { ExternalLink, HardDrive, Calendar, Clock, Trash2, PowerOff, CheckCircle2 } from 'lucide-react';
import { getTagDisplayPath, cleanDescription } from '../utils/tagUtils';
import { formatBytes, formatDate } from '../utils/formatters';
import { useDynamicTagFit } from '../hooks/useDynamicTagFit';
import { FavoriteStar, ItemStatusBadges } from './ItemBadges';
import { useI18n } from '../i18n/I18nContext';

function areItemCardPropsEqual(prev, next) {
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

export const ItemCard = React.memo(function ItemCard({
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
  cardSize = 2,
  onToggleTag,
  onToggleUserTag,
  onContextMenu
}) {
  const { t, tTag } = useI18n();
  const previewSrc = item.has_local_preview
    ? `/api/previews/${item.published_file_id}`
    : (item.preview_url || '');

  // Unified tags for ItemCard: active Steam tags + User tags
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
  const authorName = item.creator_name || item.creator;
  const descriptionSnippet = useMemo(() => {
    if (cardSize !== 3 || !item.description) return '';
    return cleanDescription(item.description);
  }, [item.description, cardSize]);

  // Dynamic tags fitting hook
  const cardRef = useRef(null);
  const tagsContainerRef = useRef(null);
  const defaultFit = Math.min(displayTags.length, cardSize === 1 ? 2 : cardSize === 2 ? 3 : 5);

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
    rootRef: cardRef
  });

  // Determine card background based on active selection states
  let cardBgClass = 'bg-[#141b23] hover:bg-[#1a232e]';
  if (isSelected) {
    cardBgClass = 'bg-[#15251c]';
  }

  return (
    <div
      ref={cardRef}
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
      data-view-item="card"
      className={`group relative rounded-lg border transition duration-150 cursor-pointer flex flex-col justify-between select-none ${
        showTagsPopover ? 'z-30' : ''
      } ${
        isAnchor ? 'border-[#66c0f4]' : isSelected ? 'border-transparent' : 'border-[#233547] hover:border-[#38536f]'
      } ${cardBgClass} ${isUnsubscribed ? 'grayscale' : ''}`}
      style={{
        contentVisibility: showTagsPopover ? 'visible' : 'auto',
        containIntrinsicSize: cardSize === 3 ? '440px 480px' : cardSize === 2 ? '340px 380px' : '260px 320px',
        filter: isUnsubscribed ? 'grayscale(100%)' : undefined,
        boxShadow: isAnchor
          ? '0 0 16px 3px rgba(102, 192, 244, 0.45), 0 0 4px 1px rgba(102, 192, 244, 0.6)'
          : undefined
      }}
    >
      {/* 1. INNER LAYER: GREEN SELECTION GLOW / GRADIENT (casts inward into card content, flush against outer border) */}
      {isSelected && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none z-20 transition-all duration-150"
          style={{
            boxShadow: 'inset 0 0 0 1.5px #a4d053, inset 0 0 14px 2px rgba(164, 208, 83, 0.4)'
          }}
        />
      )}

      {/* Content wrapper with rounded corners to keep image and content cleanly clipped */}
      <div className="relative z-1 flex flex-col justify-between h-full rounded-lg">
        {/* Top Image */}
        <div className="relative aspect-video w-full bg-[#101822] overflow-hidden border-b border-[#233547] rounded-t-lg">
        {/* Favorite Star in top left corner */}
        <FavoriteStar
          isFavorited={item.is_favorited}
          onToggle={onToggleFavorite}
          itemId={item.published_file_id}
          size="md"
        />

        {/* Pending Planned Action Badge & Status badges in top right corner */}
        <ItemStatusBadges
          itemId={item.published_file_id}
          pendingAction={pendingAction}
          onRemovePendingAction={onRemovePendingAction}
          isDisabled={isDisabled}
          isUnsubscribed={isUnsubscribed}
          size="md"
        />

        {/* Preview image */}
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

      {/* Item Body */}
      <div className={`@container ${cardSize === 3 ? 'p-3.5 sm:p-4' : 'p-3'} flex-1 flex flex-col`}>
        {/* Upper Text Content (Title, Meta, Description) - takes available space */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`${cardSize === 3 ? 'text-base font-bold' : 'text-sm font-semibold'} text-white line-clamp-2 leading-tight group-hover:text-[#66c0f4] transition`}
              title={item.title}
            >
              {item.title}
            </h3>
          </div>

          {/* Info line under title */}
          {cardSize === 3 ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-[#8f98a0] min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                {authorName && (
                  <span
                    className="truncate text-[11.5px] sm:text-xs text-[#8f98a0] min-w-0 flex items-center max-w-[170px]"
                    title={item.creator ? `${t('item.author', { name: authorName })} (SteamID: ${item.creator})` : t('item.author', { name: authorName })}
                  >
                    <span className="text-[#657484] mr-1 shrink-0">{t('item.authorLabel')}</span>
                    <span className="text-gray-300 font-medium truncate">{authorName}</span>
                  </span>
                )}
                <a
                  href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.published_file_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-[#66c0f4] hover:border-[#66c0f4]/50 items-center gap-1 font-mono text-[10.5px] text-[#8f98a0] bg-[#101822] hover:bg-[#182535] px-1.5 py-0.5 rounded border border-[#233547] transition shrink-0 whitespace-nowrap inline-flex"
                  title={t('item.openSteamPage')}
                >
                  ID: {item.published_file_id}
                  <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </a>
              </div>

              {/* Organization badge for L mode */}
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap shrink-0 ${
                  item.is_sorted
                    ? 'bg-[#14281a] text-[#a4d053] border-[#a4d053]/40'
                    : 'bg-[#2a1c10] text-[#f49e42] border-[#f49e42]/40'
                }`}
                title={item.is_sorted ? `${t('detail.organization')}: ${t('detail.sorted')}` : `${t('detail.organization')}: ${t('detail.unsorted')}`}
              >
                {item.is_sorted ? t('detail.sorted') : t('detail.unsorted')}
              </span>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between gap-1.5 text-xs text-[#8f98a0] min-w-0">
              {authorName ? (
                <span
                  className="truncate text-[11px] text-[#8f98a0] min-w-0 flex items-center"
                  title={item.creator ? `${t('detail.author')} ${authorName} (SteamID: ${item.creator})` : `${t('detail.author')} ${authorName}`}
                >
                  <span className="text-[#657484] mr-1 shrink-0">{t('detail.author').toLowerCase()}</span>
                  <span className="text-gray-300 font-medium truncate">{authorName}</span>
                </span>
              ) : (
                <span className="font-mono text-[11px] text-[#8f98a0]">ID: {item.published_file_id}</span>
              )}
              <a
                href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.published_file_id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-[#66c0f4] flex items-center gap-1 text-[11px] shrink-0"
                title={t('item.openSteam')}
              >
                Steam <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Partial description for L cards */}
          {cardSize === 3 && descriptionSnippet && (
            <div className="mt-2 text-xs sm:text-[12.5px] text-[#8f98a0] leading-relaxed">
              <p
                style={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 3,
                  overflow: 'hidden'
                }}
                title={descriptionSnippet}
              >
                {descriptionSnippet}
              </p>
            </div>
          )}
        </div>

        {/* Unified Tags: text-xs matching left column, fills entire width, remainder badge on overflow */}
        {displayTags.length > 0 && (
          <div
            className={`relative ${cardSize === 3 ? 'mt-3' : 'mt-2.5'} min-w-0 shrink-0`}
            onMouseEnter={handleTagsMouseEnter}
            onMouseLeave={handleTagsMouseLeave}
          >
              <div ref={tagsContainerRef} className={`flex items-center gap-1 w-full overflow-hidden ${showTagsPopover ? 'invisible' : ''}`}>
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
                  const maxTagWidth = hasOverflow ? 'max-w-[calc(100%-40px)]' : 'max-w-full';

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
                      className={`text-xs whitespace-nowrap leading-tight transition select-none truncate shrink-0 cursor-pointer hover:opacity-90 ${maxTagWidth} ${pillStyle}`}
                      title={fullPath}
                    >
                      {displayLabel}
                    </span>
                  );
                })}
                {displayTags.length > visibleTagCount && (
                  <span
                    className="text-[10.5px] text-gray-400 font-mono font-medium self-center shrink-0 whitespace-nowrap px-1 py-0.5 bg-[#17222f] rounded border border-[#233547] cursor-pointer hover:text-white hover:border-[#66c0f4]/60 transition"
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
                          className={`text-xs whitespace-nowrap leading-tight transition select-none cursor-pointer ${pillStyle}`}
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

        {/* Footer info: updated date, mod size, created date (L mode), and status */}
        <div className={`${cardSize === 3 ? 'mt-3.5 pt-2.5' : 'mt-3 pt-2'} border-t border-[#233547]/60 flex items-center justify-between gap-1 text-[11px] text-[#758494] min-w-0 shrink-0`}>
          <div className="flex items-center gap-2 font-mono text-[10.5px] min-w-0">
            {/* Local size badge: hidden if width < 130px (hiding priority before author) */}
            <div
              className="hidden @min-[130px]:flex items-center gap-1 text-[#a4d053] shrink-0"
              title={`${t('detail.localSize')} ${formatBytes(item.local_size_bytes || item.api_file_size)}`}
            >
              <HardDrive className="w-3 h-3 text-[#a4d053] shrink-0" />
              <span>{formatBytes(item.local_size_bytes || item.api_file_size)}</span>
            </div>

            {/* Date badge: drops first if container < 210px */}
            <div
              className="hidden @min-[210px]:flex items-center gap-1 text-[#758494] shrink-0"
              title={`${t('detail.updatedAt')} ${formatDate(item.time_updated || item.local_mtime)}`}
            >
              <Calendar className="w-3 h-3 text-[#66c0f4] shrink-0" />
              <span>{formatDate(item.time_updated || item.local_mtime)}</span>
            </div>

            {/* Created date for L mode: drops if width < 360px */}
            {cardSize === 3 && item.time_created && (
              <div
                className="hidden @min-[360px]:flex items-center gap-1 text-[#758494] shrink-0"
                title={`${t('detail.createdAt')} ${formatDate(item.time_created)}`}
              >
                <Clock className="w-3 h-3 text-gray-500 shrink-0" />
                <span>{formatDate(item.time_created)}</span>
              </div>
            )}
          </div>

          {/* Status Indicator (analogue of ItemDetailModal) */}
          <div
            className={`flex items-center gap-1 font-medium text-[11px] ${
              isUnsubscribed
                ? 'text-[#ff6b6b]'
                : isDisabled
                ? 'text-[#f49e42]'
                : 'text-[#a4d053]'
            }`}
            title={`${t('detail.status')}: ${isUnsubscribed ? t('detail.statusUnsubscribed') : isDisabled ? t('detail.statusDisabled') : t('detail.statusActive')}`}
          >
            {isUnsubscribed ? (
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
            ) : isDisabled ? (
              <PowerOff className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{isUnsubscribed ? t('detail.statusUnsubscribed') : isDisabled ? t('detail.statusDisabled') : t('detail.statusActive')}</span>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}, areItemCardPropsEqual);
