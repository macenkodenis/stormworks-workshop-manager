import React from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Reusable TagPill component for displaying tags across the application.
 *
 * @param {Object} props
 * @param {string} props.tag - Tag identifier
 * @param {'steam'|'user'} props.type - Tag type ('steam' or 'user')
 * @param {string} [props.displayLabel] - Formatted or localized display label
 * @param {string} [props.title] - Tooltip text (null/empty to disable tooltip)
 * @param {number} [props.count] - Associated mod count (if applicable)
 * @param {Function} [props.onRemove] - Callback when removal/deletion is clicked
 * @param {Function} [props.onClick] - Callback when pill itself is clicked
 * @param {string} [props.prefix] - Prefix symbol (e.g. '+ ')
 * @param {'sm'|'md'} [props.size='md'] - Visual size variant
 * @param {boolean} [props.disabled=false] - Whether pill is interactive
 * @param {string} [props.className] - Additional CSS classes
 */
export function TagPill({
  tag,
  type = 'user',
  displayLabel,
  title,
  count,
  onRemove,
  onClick,
  prefix,
  size = 'md',
  disabled = false,
  className = ''
}) {
  const { t, tTag } = useI18n();
  const isSteam = type === 'steam';
  const label = displayLabel ? tTag(displayLabel) : tTag(tag);
  const isClickable = Boolean(onClick) && !disabled;
  const hasRemove = Boolean(onRemove) && !disabled;
  const hasCount = typeof count === 'number';

  // Base styling for Steam vs User tags
  const colorStyles = isSteam
    ? 'bg-[#142232] text-[#8ec8f6] border-[#22405d]'
    : 'bg-[#2a1d12] text-[#f4b366] border-[#f49e42]/50';

  const hoverStyles = isClickable
    ? isSteam
      ? 'hover:bg-[#1c2f45] hover:text-white hover:border-[#385b7a] cursor-pointer'
      : 'hover:bg-[#382618] hover:text-white hover:border-[#f49e42] cursor-pointer'
    : '';

  const sizeStyles = size === 'sm'
    ? 'text-[10px] py-0.2 pl-1.5 pr-1'
    : 'text-[11px] py-0.5 pl-2 pr-1.5';

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      title={title || undefined}
      className={`group/stag inline-flex items-center gap-1 rounded-full border transition select-none ${colorStyles} ${hoverStyles} ${sizeStyles} ${className}`}
    >
      {/* Optional Prefix (e.g. '+' in suggestion dropdown) */}
      {prefix && <span className="opacity-80 font-bold shrink-0">{prefix}</span>}

      {/* Tag Label */}
      <span className="truncate max-w-[130px]">{label}</span>

      {/* Action / Count Area */}
      {(hasCount || hasRemove) && (
        <div className="relative flex items-center justify-center min-w-[14px] h-3.5 shrink-0">
          {/* Tag Mod Counter (fades out on hover if remove is available) */}
          {hasCount && (
            <span
              className={`text-[9.5px] opacity-80 font-mono font-semibold px-0.5 transition-opacity ${
                hasRemove ? 'group-hover/stag:opacity-0' : ''
              }`}
            >
              {count}
            </span>
          )}

          {/* Delete / Trash icon overlay */}
          {hasRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(e);
              }}
              className={`rounded-full p-0.5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition cursor-pointer flex items-center justify-center ${
                hasCount
                  ? 'absolute inset-0 m-auto opacity-0 group-hover/stag:opacity-100'
                  : 'opacity-70 group-hover/stag:opacity-100'
              }`}
              aria-label={t('item.removeTagAria', { tag: label })}
            >
              <Trash2 className="w-2.5 h-2.5 shrink-0" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TagPill;
