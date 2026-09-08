import React, { useRef, useState, useLayoutEffect } from 'react';
import { ExternalLink, HardDrive, Calendar, CheckCircle2, Star, PowerOff, Trash2 } from 'lucide-react';

export function ItemCard({
  item,
  index,
  isSelected,
  isAnchor,
  selectedSteamTags = new Set(),
  selectedUserTags = new Set(),
  onItemClick,
  onOpenDetail,
  onToggleFavorite
}) {
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format: dd.mm.yy (without time)
  const formatDate = (unixTs) => {
    if (!unixTs) return '—';
    const d = new Date(unixTs * 1000);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  };

  const previewSrc = `/api/previews/${item.published_file_id}`;

  // Unified tags for ItemCard: active Steam tags + User tags
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

  // Dynamic tags fitting to fill entire card width (single line)
  const tagsContainerRef = useRef(null);
  const [visibleTagCount, setVisibleTagCount] = useState(displayTags.length);

  useLayoutEffect(() => {
    const container = tagsContainerRef.current;
    if (!container || displayTags.length === 0) return;

    const computeFit = () => {
      const containerWidth = container.offsetWidth;
      if (containerWidth <= 0) return;

      const children = Array.from(container.children);
      // Last child is the remainder badge if visible
      let totalWidth = 0;
      let fitCount = 0;
      const gap = 4; // gap-1 is 4px
      const remainderReserve = 32; // Reserve ~32px for "+N" badge

      for (let i = 0; i < displayTags.length; i++) {
        const child = children[i];
        if (!child) break;
        const childWidth = child.offsetWidth;
        const needed = totalWidth + childWidth + (fitCount > 0 ? gap : 0);
        
        // If there are more tags after this one, reserve space for +N
        const hasMore = i < displayTags.length - 1;
        if (needed + (hasMore ? gap + remainderReserve : 0) <= containerWidth) {
          totalWidth = needed;
          fitCount++;
        } else if (fitCount === 0 && needed <= containerWidth) {
          // At least fit 1 if it can fit without remainder badge
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
  }, [displayTags.length, item.published_file_id]);

  // Determine card background based on active selection states
  let cardBgClass = 'bg-[#141b23] hover:bg-[#1a232e]';
  if (isSelected) {
    cardBgClass = 'bg-[#15251c]';
  }

  return (
    <div
      onClick={(e) => onItemClick(e, item, index)}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenDetail(item);
      }}
      className={`group relative rounded-lg border transition duration-150 cursor-pointer flex flex-col justify-between select-none ${
        isAnchor ? 'border-[#66c0f4]' : isSelected ? 'border-transparent' : 'border-[#233547] hover:border-[#38536f]'
      } ${cardBgClass} ${isUnsubscribed ? 'grayscale' : ''}`}
      style={{
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
      <div className="relative z-1 flex flex-col justify-between h-full rounded-lg overflow-hidden">
      {/* Top Image */}
      <div className="relative aspect-video w-full bg-[#101822] overflow-hidden border-b border-[#233547]">
        {/* Favorite Star in top left corner */}
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
          className={`absolute top-2 left-2 z-10 p-1.5 rounded-md backdrop-blur-xs transition shadow cursor-pointer ${
            item.is_favorited
              ? 'bg-[#101822]/90 text-[#f6be3c] border border-[#f6be3c]/50 hover:bg-black/90'
              : 'bg-black/60 text-gray-400 border border-white/10 hover:text-white hover:bg-black/80'
          }`}
        >
          <Star
            className={`w-4 h-4 transition ${
              item.is_favorited ? 'fill-[#f6be3c] text-[#f6be3c] scale-105' : ''
            }`}
          />
        </button>

        {/* Status badges in top right corner: Відключено & Не підписаний */}
        {(isDisabled || isUnsubscribed) && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 pointer-events-auto">
            {isDisabled && (
              <div
                title="Відключено"
                className="p-1.5 rounded-md backdrop-blur-xs transition shadow bg-[#1c140c]/90 text-[#f49e42] border border-[#f49e42]/60 flex items-center justify-center"
              >
                <PowerOff className="w-3.5 h-3.5" />
              </div>
            )}
            {isUnsubscribed && (
              <div
                title="Не підписаний"
                className="p-1.5 rounded-md backdrop-blur-xs transition shadow bg-[#201014]/90 text-[#ff6b6b] border border-[#ff6b6b]/60 flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        )}

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

        {/* Local size badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-xs text-[#a4d053] font-mono text-[11px] px-2 py-0.5 rounded border border-black/40 flex items-center gap-1">
          <HardDrive className="w-3 h-3" />
          {formatBytes(item.local_size_bytes || item.api_file_size)}
        </div>
      </div>

      {/* Item Body */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight group-hover:text-[#66c0f4] transition" title={item.title}>
              {item.title}
            </h3>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs text-[#8f98a0]">
            <span className="font-mono text-[11px]">ID: {item.published_file_id}</span>
            <a
              href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.published_file_id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-[#66c0f4] flex items-center gap-1 text-[11px]"
              title="Відкрити в Steam Workshop"
            >
              Steam <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Unified Tags: text-xs matching left column, fills entire width, remainder badge on overflow */}
          {displayTags.length > 0 && (
            <div ref={tagsContainerRef} className="mt-2.5 flex items-center gap-1 w-full overflow-hidden">
              {displayTags.slice(0, visibleTagCount).map(({ tag, type }, idx) => {
                const isUser = type === 'user';
                const isActive = isUser ? selectedUserTags.has(tag) : selectedSteamTags.has(tag);
                
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
                    className={`text-xs whitespace-nowrap leading-tight transition select-none truncate shrink-0 ${pillStyle}`}
                  >
                    {tag}
                  </span>
                );
              })}
              {displayTags.length > visibleTagCount && (
                <span className="text-xs text-gray-500 font-mono self-center shrink-0">
                  +{displayTags.length - visibleTagCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer info: updated date formatted as dd.mm.yy */}
        <div className="mt-3 pt-2 border-t border-[#233547]/60 flex items-center justify-between text-[11px] text-[#758494]">
          <div className="flex items-center gap-1 font-mono text-[10.5px]" title="Дата оновлення: dd.mm.yy">
            <Calendar className="w-3 h-3 text-[#66c0f4]" />
            <span>{formatDate(item.time_updated || item.local_mtime)}</span>
          </div>

          <div className="flex items-center gap-1 text-[#5c7e10]">
            <CheckCircle2 className="w-3 h-3" />
            <span>Встановлено</span>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}
