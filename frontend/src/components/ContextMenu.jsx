import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Reusable dark-themed Steam-styled context menu with multi-level submenus
 * and viewport boundary collision detection.
 */
export function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);
  const [activeSubmenuIndex, setActiveSubmenuIndex] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: y, left: x });
  const [isPositioned, setIsPositioned] = useState(false);

  // Handle click outside, escape, resize
  useEffect(() => {
    let attached = false;

    const handleClickOutside = (e) => {
      if (!attached) return;
      if (menuRef.current) {
        if (menuRef.current.contains(e.target) || (e.target?.closest && e.target.closest('[data-context-menu]'))) {
          return;
        }
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleWindowResize = () => {
      onClose();
    };

    const handleWheel = (e) => {
      if (!attached) return;
      if (menuRef.current) {
        if (menuRef.current.contains(e.target) || (e.target?.closest && e.target.closest('[data-context-menu]'))) {
          return;
        }
        onClose();
      }
    };

    // Delay attaching listeners to prevent the opening contextmenu event from immediately closing the menu
    const timer = setTimeout(() => {
      attached = true;
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('wheel', handleWheel, { passive: true });
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', handleWindowResize);
    }, 40);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [onClose]);

  // Adjust coordinates: open downwards and to the right from the cursor,
  // or flush against viewport boundaries if it would overflow.
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let newX = x;
    let newY = y;

    // Flush to right edge if overflowing
    if (x + rect.width > window.innerWidth) {
      newX = Math.max(0, window.innerWidth - rect.width);
    }
    // Flush to bottom edge if overflowing
    if (y + rect.height > window.innerHeight) {
      newY = Math.max(0, window.innerHeight - rect.height);
    }

    setMenuPos({ top: newY, left: newX });
    setIsPositioned(true);
  }, [x, y]);

  return createPortal(
    <div
      ref={menuRef}
      data-context-menu="true"
      style={{
        position: 'fixed',
        top: `${menuPos.top}px`,
        left: `${menuPos.left}px`,
        zIndex: 99999,
        visibility: isPositioned ? 'visible' : 'hidden'
      }}
      className="w-56 bg-[#131b26] border border-[#2d4257] rounded-lg shadow-2xl py-1 text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`div-${index}`} className="h-[1px] bg-[#1f2d3d] my-1 mx-1.5" />;
        }

        const hasSubmenu = Array.isArray(item.submenu) && item.submenu.length > 0;
        const isSubmenuOpen = activeSubmenuIndex === index;

        return (
          <ContextMenuItem
            key={item.key || index}
            item={item}
            hasSubmenu={hasSubmenu}
            isSubmenuOpen={isSubmenuOpen}
            onMouseEnter={() => setActiveSubmenuIndex(index)}
            onMouseLeave={() => {
              if (activeSubmenuIndex === index) {
                // Keep submenu open if hovering within submenu
              }
            }}
            onCloseAll={onClose}
          />
        );
      })}
    </div>,
    document.body
  );
}

function ContextMenuItem({ item, hasSubmenu, isSubmenuOpen, onMouseEnter, onMouseLeave, onCloseAll }) {
  const itemRef = useRef(null);
  const submenuRef = useRef(null);
  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: '100%' });
  const [isSubmenuPositioned, setIsSubmenuPositioned] = useState(false);

  // Calculate submenu position: open downwards and to the right, or flush if overflowing
  useLayoutEffect(() => {
    if (isSubmenuOpen && itemRef.current && submenuRef.current) {
      const itemRect = itemRef.current.getBoundingClientRect();
      const subRect = submenuRef.current.getBoundingClientRect();

      let leftStyle = itemRect.width + 2;
      let topStyle = 0;

      // If opening to the right exceeds screen, open to the left
      if (itemRect.right + subRect.width > window.innerWidth) {
        leftStyle = -(subRect.width + 2);
        // If opening to the left also exceeds screen left edge, clamp flush to screen right
        if (itemRect.left + leftStyle < 0) {
          leftStyle = Math.max(-itemRect.left, window.innerWidth - subRect.width - itemRect.left);
        }
      }

      // If opening downwards exceeds screen bottom, shift up flush to screen bottom
      if (itemRect.top + subRect.height > window.innerHeight) {
        topStyle = Math.max(-itemRect.top, window.innerHeight - subRect.height - itemRect.top);
      }

      setSubmenuPos({ top: `${topStyle}px`, left: `${leftStyle}px` });
      setIsSubmenuPositioned(true);
    } else {
      setIsSubmenuPositioned(false);
    }
  }, [isSubmenuOpen]);

  const handleClick = (e) => {
    e?.stopPropagation?.();
    if (item.disabled) return;
    if (hasSubmenu) return;
    if (item.onClick) {
      item.onClick(e);
    }
    onCloseAll();
  };

  const Icon = item.icon;

  return (
    <div
      ref={itemRef}
      data-context-menu="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
      className={`relative flex items-center justify-between px-2.5 py-1.5 mx-1 rounded text-left transition ${
        item.disabled
          ? 'opacity-40 cursor-not-allowed text-gray-500'
          : item.danger
          ? 'text-[#ff6b6b] hover:bg-[#361c1c] hover:text-white cursor-pointer'
          : isSubmenuOpen
          ? 'bg-[#1e2f42] text-white'
          : 'text-gray-200 hover:bg-[#1b2838] hover:text-white cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 truncate pointer-events-none">
        {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${item.iconClassName || 'text-[#66c0f4]'}`} />}
        <span className="truncate">{item.label}</span>
      </div>

      <div className="flex items-center gap-1.5 ml-2 shrink-0 pointer-events-none">
        {item.badge && (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1f2d3d] text-gray-400 font-mono">
            {item.badge}
          </span>
        )}
        {item.shortcut && (
          <span className="text-[10px] text-gray-500 font-mono">{item.shortcut}</span>
        )}
        {hasSubmenu && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
      </div>

      {/* Nested Submenu */}
      {hasSubmenu && isSubmenuOpen && (
        <div
          ref={submenuRef}
          data-context-menu="true"
          style={{
            position: 'absolute',
            top: submenuPos.top,
            left: submenuPos.left,
            zIndex: 10000
          }}
          className="w-52 bg-[#131b26] border border-[#2d4257] rounded-lg shadow-2xl py-1 text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-75"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {item.submenu.map((sub, sIdx) => {
            if (sub.divider) {
              return <div key={`subdiv-${sIdx}`} className="h-[1px] bg-[#1f2d3d] my-1 mx-1.5" />;
            }
            const SubIcon = sub.icon;
            return (
              <div
                key={sub.key || sIdx}
                data-context-menu="true"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sub.disabled) return;
                  if (sub.onClick) sub.onClick(e);
                  onCloseAll();
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 mx-1 rounded text-left transition ${
                  sub.disabled
                    ? 'opacity-40 cursor-not-allowed text-gray-500'
                    : sub.danger
                    ? 'text-[#ff6b6b] hover:bg-[#361c1c] hover:text-white cursor-pointer'
                    : 'text-gray-200 hover:bg-[#1b2838] hover:text-white cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 truncate pointer-events-none">
                  {SubIcon && (
                    <SubIcon className={`w-3.5 h-3.5 shrink-0 ${sub.iconClassName || 'text-[#66c0f4]'}`} />
                  )}
                  <span className="truncate">{sub.label}</span>
                </div>
                {sub.badge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1f2d3d] text-gray-400 font-mono ml-2 pointer-events-none">
                    {sub.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
