import { useState, useCallback } from 'react';
import { Clipboard, Copy, Scissors, CheckSquare, Trash2 } from 'lucide-react';
import { readClipboardText, copyToClipboard } from '../utils/clipboardUtils';
import { useI18n } from '../i18n/I18nContext';

/**
 * Hook to provide context menu actions for HTML input and textarea elements.
 */
export function useInputContextMenu() {
  const [contextMenu, setContextMenu] = useState(null);
  const { t } = useI18n();

  const handleInputContextMenu = useCallback((e, inputRef, onValueChange) => {
    e.preventDefault();
    e.stopPropagation();

    const target = inputRef?.current || e.target;
    if (!target) return;

    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const value = target.value || '';
    const hasSelection = end > start;
    const selectedText = hasSelection ? value.slice(start, end) : '';
    const hasValue = value.length > 0;

    const items = [
      {
        key: 'paste',
        label: t('context.paste'),
        icon: Clipboard,
        shortcut: 'Ctrl+V',
        onClick: async () => {
          const clipText = await readClipboardText();
          if (!clipText) return;

          const before = value.slice(0, start);
          const after = value.slice(end);
          const newValue = before + clipText + after;

          if (onValueChange) {
            onValueChange(newValue);
          } else {
            target.value = newValue;
            target.dispatchEvent(new Event('input', { bubbles: true }));
          }

          // Restore focus and position cursor after pasted text
          setTimeout(() => {
            target.focus();
            const newCursor = start + clipText.length;
            target.setSelectionRange(newCursor, newCursor);
          }, 10);
        }
      },
      {
        key: 'copy',
        label: t('context.copy'),
        icon: Copy,
        shortcut: 'Ctrl+C',
        disabled: !hasSelection,
        onClick: () => {
          if (selectedText) {
            copyToClipboard(selectedText);
          }
        }
      },
      {
        key: 'cut',
        label: t('context.cut'),
        icon: Scissors,
        shortcut: 'Ctrl+X',
        disabled: !hasSelection,
        onClick: () => {
          if (selectedText) {
            copyToClipboard(selectedText);
            const before = value.slice(0, start);
            const after = value.slice(end);
            const newValue = before + after;

            if (onValueChange) {
              onValueChange(newValue);
            } else {
              target.value = newValue;
              target.dispatchEvent(new Event('input', { bubbles: true }));
            }

            setTimeout(() => {
              target.focus();
              target.setSelectionRange(start, start);
            }, 10);
          }
        }
      },
      { divider: true },
      {
        key: 'select-all',
        label: t('context.selectAll'),
        icon: CheckSquare,
        shortcut: 'Ctrl+A',
        disabled: !hasValue,
        onClick: () => {
          target.focus();
          target.select();
        }
      },
      {
        key: 'clear',
        label: t('context.clear'),
        icon: Trash2,
        disabled: !hasValue,
        danger: true,
        onClick: () => {
          if (onValueChange) {
            onValueChange('');
          } else {
            target.value = '';
            target.dispatchEvent(new Event('input', { bubbles: true }));
          }
          setTimeout(() => target.focus(), 10);
        }
      }
    ];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items
    });
  }, [t]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    handleInputContextMenu,
    closeContextMenu
  };
}
