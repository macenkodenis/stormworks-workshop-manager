import React from 'react';
import { Star, PowerOff, Power, Trash2, CheckCircle2, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Reusable Favorite Star button for ItemCard and ItemRow.
 */
export function FavoriteStar({ isFavorited, onToggle, itemId, size = 'md' }) {
  const { t } = useI18n();
  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const paddingClass = size === 'sm' ? 'top-1.5 left-1.5 p-1' : 'top-2 left-2 p-1.5';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onToggle) onToggle(itemId);
      }}
      title={isFavorited ? t('item.removeFavorite') : t('item.addFavorite')}
      className={`absolute ${paddingClass} z-10 rounded-md backdrop-blur-xs transition shadow cursor-pointer ${
        isFavorited
          ? 'bg-[#101822]/90 text-[#f6be3c] border border-[#f6be3c]/50 hover:bg-black/90'
          : 'bg-black/60 text-gray-400 border border-white/10 hover:text-white hover:bg-black/80'
      }`}
    >
      <Star
        className={`${iconSizeClass} transition ${
          isFavorited ? 'fill-[#f6be3c] text-[#f6be3c] scale-105' : ''
        }`}
      />
    </button>
  );
}

/**
 * Reusable status badges container (Pending Action Plan badge, Disabled badge, Unsubscribed badge).
 */
export function ItemStatusBadges({
  itemId,
  pendingAction,
  onRemovePendingAction,
  isDisabled,
  isUnsubscribed,
  size = 'md'
}) {
  const { t } = useI18n();
  const isSm = size === 'sm';
  const iconSizeClass = isSm ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const positionClass = isSm ? 'top-1.5 right-1.5' : 'top-2 right-2';
  const badgePadClass = isSm ? 'p-0.5 px-1.5 text-[9.5px]' : 'p-1 px-1.5 text-[10px]';

  const actionLabel =
    pendingAction === 'disable'
      ? t('plan.disable')
      : pendingAction === 'enable'
      ? t('plan.enable')
      : pendingAction === 'unsubscribe'
      ? t('plan.unsubscribe')
      : t('plan.subscribe');

  return (
    <div className={`absolute ${positionClass} z-10 flex items-center gap-1 pointer-events-auto`}>
      {/* 1. Pending Action in Execution Plan */}
      {pendingAction && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onRemovePendingAction) onRemovePendingAction(itemId);
          }}
          title={t('item.planPlanned', { action: actionLabel })}
          className={`${badgePadClass} rounded-md backdrop-blur-xs transition shadow flex items-center gap-1 cursor-pointer group/badge ${
            pendingAction === 'disable'
              ? 'bg-[#2b190d]/95 text-[#f49e42] border border-[#f49e42] hover:bg-[#3d2313]'
              : pendingAction === 'enable'
              ? 'bg-[#14281a]/95 text-[#a4d053] border border-[#a4d053] hover:bg-[#1d3d27]'
              : pendingAction === 'unsubscribe'
              ? 'bg-[#2b1014]/95 text-[#ff6b6b] border border-[#ff6b6b] hover:bg-[#40181e]'
              : 'bg-[#102030]/95 text-[#66c0f4] border border-[#66c0f4] hover:bg-[#163047]'
          }`}
        >
          {pendingAction === 'disable' && <PowerOff className={iconSizeClass} />}
          {pendingAction === 'enable' && <Power className={iconSizeClass} />}
          {pendingAction === 'unsubscribe' && <Trash2 className={iconSizeClass} />}
          {pendingAction === 'subscribe' && <CheckCircle2 className={iconSizeClass} />}
          <span className="font-bold">{t('item.planBadge')}</span>
          <X className="w-2.5 h-2.5 opacity-60 group-hover/badge:opacity-100" />
        </div>
      )}

      {/* 2. Deactivated / Disabled state */}
      {isDisabled && (
        <div
          title={t('item.disabled')}
          className="p-1 rounded-md backdrop-blur-xs transition shadow bg-[#1c140c]/90 text-[#f49e42] border border-[#f49e42]/60 flex items-center justify-center"
        >
          <PowerOff className={iconSizeClass} />
        </div>
      )}

      {/* 3. Unsubscribed state */}
      {isUnsubscribed && (
        <div
          title={t('item.unsubscribed')}
          className="p-1 rounded-md backdrop-blur-xs transition shadow bg-[#201014]/90 text-[#ff6b6b] border border-[#ff6b6b]/60 flex items-center justify-center"
        >
          <Trash2 className={iconSizeClass} />
        </div>
      )}
    </div>
  );
}
