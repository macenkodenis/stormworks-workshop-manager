import React, { useState, useEffect, useRef } from 'react';
import { MousePointerClick } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function ControlsHintOverlay({ mainRef, leftWidth, rightWidth, hasSelection = false }) {
  const { t } = useI18n();
  const overlayRef = useRef(null);
  const [rightPos, setRightPos] = useState(null);
  const [isHidden, setIsHidden] = useState(false);

  // Update horizontal position based on the right boundary of the main grid area
  useEffect(() => {
    const updatePosition = () => {
      if (typeof document !== 'undefined' && document.body.classList.contains('is-resizing')) return;
      if (mainRef && mainRef.current) {
        const rect = mainRef.current.getBoundingClientRect();
        // Position at right edge of the main tiles zone with a comfortable margin
        const calculatedRight = Math.max(16, window.innerWidth - rect.right + 20);
        setRightPos(calculatedRight);
      }
    };

    updatePosition();

    // Recalculate on window resize
    window.addEventListener('resize', updatePosition);

    // Also observe size changes of mainRef
    let resizeObserver = null;
    if (mainRef && mainRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(updatePosition);
      resizeObserver.observe(mainRef.current);
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [mainRef, leftWidth, rightWidth]);

  // Track cursor position to hide overlay when approaching
  useEffect(() => {
    const PROXIMITY_THRESHOLD = 85; // Distance in pixels to trigger fade-out

    const handleMouseMove = (e) => {
      if (typeof document !== 'undefined' && document.body.classList.contains('is-resizing')) return;
      if (!overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Compute shortest Euclidean distance from (mouseX, mouseY) to the overlay rectangle
      const dx = Math.max(rect.left - mouseX, 0, mouseX - rect.right);
      const dy = Math.max(rect.top - mouseY, 0, mouseY - rect.bottom);
      const dist = Math.hypot(dx, dy);

      if (dist < PROXIMITY_THRESHOLD) {
        setIsHidden(true);
      } else {
        setIsHidden(false);
      }
    };

    const handleMouseLeave = () => {
      setIsHidden(false);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      id="controls-hint-overlay"
      style={{
        right: rightPos != null ? `${rightPos}px` : '320px',
        bottom: hasSelection ? '88px' : '24px',
        opacity: isHidden ? 0 : 0.92,
        transform: isHidden ? 'translateY(8px) scale(0.96)' : 'translateY(0) scale(1)',
      }}
      className="fixed z-30 pointer-events-none transition-all duration-200 ease-out select-none
        bg-[#101721]/95 backdrop-blur-md border border-[#233547]/90 rounded-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.65)]
        w-64 text-left"
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-white font-bold text-xs mb-2 pb-1.5 border-b border-[#1e2a38]/80">
        <div className="p-1 rounded-md bg-[#162231] border border-[#2c4056]">
          <MousePointerClick className="w-3.5 h-3.5 text-[#66c0f4]" />
        </div>
        <span className="tracking-wide">{t('hints.title')}</span>
      </div>

      {/* Shortcuts list */}
      <ul className="space-y-1 text-[11px] text-[#9bb0c1] leading-relaxed">
        <li className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#66c0f4] shrink-0" />
          <span>
            <strong className="text-[#66c0f4] font-semibold">{t('hints.click')}</strong> {t('hints.clickDesc')}
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a4d053] shrink-0" />
          <span>
            <strong className="text-[#a4d053] font-semibold">{t('hints.shiftClick')}</strong> {t('hints.shiftClickDesc')}
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
          <span>
            <strong className="text-white font-semibold">{t('hints.ctrlClick')}</strong> {t('hints.ctrlClickDesc')}
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
          <span>
            <strong className="text-white font-semibold">{t('hints.doubleClick')}</strong> {t('hints.doubleClickDesc')}
          </span>
        </li>
      </ul>
    </div>
  );
}
