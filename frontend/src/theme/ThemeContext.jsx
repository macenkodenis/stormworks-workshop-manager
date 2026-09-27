import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Auto-discover all theme JSON files in ./themes/*.json at startup
const themeModules = import.meta.glob('./themes/*.json', { eager: true });

function buildCssFromTheme(themeDef) {
  const { id, isDark, colors = {}, buttons = {}, customCss = '' } = themeDef;
  if ((!colors || Object.keys(colors).length === 0) && (!buttons || Object.keys(buttons).length === 0)) {
    return customCss || '';
  }

  const rules = [];

  // Color scheme
  rules.push(`[data-theme="${id}"] { color-scheme: ${isDark ? 'dark' : 'light'} !important; }`);

  // Body & Canvas
  if (colors.bodyBg) {
    rules.push(`[data-theme="${id}"] body { background-color: ${colors.bodyBg} !important; color: ${colors.textPrimary || (isDark ? '#c7d5e0' : '#1e293b')} !important; }`);
  }
  if (colors.canvasBg) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#0e141b\\] { background-color: ${colors.canvasBg} !important; }`);
  }

  // Header, Sidebars & Modal Headers
  if (colors.surfaceHeader) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#171d25\\], [data-theme="${id}"] .bg-\\[\\#151d27\\], [data-theme="${id}"] .bg-\\[\\#121820\\] { background-color: ${colors.surfaceHeader} !important; }`);
  }

  // Primary Content Cards & Modals
  if (colors.cardPrimary) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#1b2838\\], [data-theme="${id}"] .bg-\\[\\#141b23\\], [data-theme="${id}"] .bg-\\[\\#101721\\], [data-theme="${id}"] .bg-\\[\\#101721\\]\\/95, [data-theme="${id}"] .bg-\\[\\#16202c\\], [data-theme="${id}"] .bg-\\[\\#121923\\], [data-theme="${id}"] .bg-\\[\\#0e1622\\], [data-theme="${id}"] .bg-\\[\\#0e1620\\], [data-theme="${id}"] .bg-\\[\\#090d13\\], [data-theme="${id}"] .bg-\\[\\#151a22\\], [data-theme="${id}"] .bg-\\[\\#121a24\\], [data-theme="${id}"] .bg-\\[\\#121c27\\], [data-theme="${id}"] .bg-\\[\\#141820\\], [data-theme="${id}"] .bg-\\[\\#161c24\\], [data-theme="${id}"] .bg-\\[\\#131922\\], [data-theme="${id}"] .bg-\\[\\#141b24\\], [data-theme="${id}"] .bg-\\[\\#0d131b\\], [data-theme="${id}"] .bg-\\[\\#0b1016\\], [data-theme="${id}"] .bg-\\[\\#0d141d\\], [data-theme="${id}"] .bg-\\[\\#0a0f15\\], [data-theme="${id}"] .bg-\\[\\#0a0f14\\], [data-theme="${id}"] .bg-\\[\\#0d131a\\], [data-theme="${id}"] .bg-\\[\\#0f141a\\], [data-theme="${id}"] .bg-\\[\\#12161c\\], [data-theme="${id}"] .bg-\\[\\#1e2229\\], [data-theme="${id}"] .bg-\\[\\#17202c\\], [data-theme="${id}"] .bg-\\[\\#172535\\], [data-theme="${id}"] .bg-\\[\\#1a2432\\], [data-theme="${id}"] .bg-\\[\\#19222c\\], [data-theme="${id}"] .bg-\\[\\#192330\\] { background-color: ${colors.cardPrimary} !important; }`);
  }

  // Secondary Cards, Inputs, Previews, Modal Subpanels
  if (colors.cardSecondary) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#101822\\], [data-theme="${id}"] .bg-\\[\\#101822\\]\\/90, [data-theme="${id}"] .bg-\\[\\#121822\\], [data-theme="${id}"] .bg-\\[\\#121922\\], [data-theme="${id}"] .bg-\\[\\#10161f\\], [data-theme="${id}"] .bg-\\[\\#18202a\\], [data-theme="${id}"] .bg-\\[\\#182029\\], [data-theme="${id}"] .bg-\\[\\#12171e\\], [data-theme="${id}"] .bg-\\[\\#0c1219\\], [data-theme="${id}"] .bg-\\[\\#0a0f14\\], [data-theme="${id}"] .bg-\\[\\#0d141b\\], [data-theme="${id}"] .bg-\\[\\#131c26\\], [data-theme="${id}"] .bg-\\[\\#0d141d\\]\\/60, [data-theme="${id}"] .bg-\\[\\#141d27\\], [data-theme="${id}"] .bg-\\[\\#17212d\\], [data-theme="${id}"] .bg-\\[\\#121720\\], [data-theme="${id}"] .bg-\\[\\#1a1426\\], [data-theme="${id}"] .bg-\\[\\#1a212c\\], [data-theme="${id}"] .bg-\\[\\#1b2533\\], [data-theme="${id}"] .bg-\\[\\#1a2330\\], [data-theme="${id}"] .bg-\\[\\#1b2633\\], [data-theme="${id}"] .bg-\\[\\#1a2530\\], [data-theme="${id}"] .bg-\\[\\#141e2b\\]\\/60, [data-theme="${id}"] .bg-\\[\\#162232\\], [data-theme="${id}"] .bg-\\[\\#162a3d\\], [data-theme="${id}"] .bg-\\[\\#1d2d3e\\], [data-theme="${id}"] .bg-\\[\\#20364c\\], [data-theme="${id}"] .bg-\\[\\#223347\\], [data-theme="${id}"] .bg-\\[\\#223447\\], [data-theme="${id}"] .bg-\\[\\#25394f\\], [data-theme="${id}"] .bg-\\[\\#121920\\], [data-theme="${id}"] .bg-\\[\\#1b2531\\] { background-color: ${colors.cardSecondary} !important; }`);
  }

  // Interactive Elements
  if (colors.interactive) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#202e3d\\], [data-theme="${id}"] .bg-\\[\\#23303f\\], [data-theme="${id}"] .bg-\\[\\#2a3f54\\], [data-theme="${id}"] .bg-\\[\\#203246\\], [data-theme="${id}"] .bg-\\[\\#253547\\], [data-theme="${id}"] .bg-\\[\\#27384a\\], [data-theme="${id}"] .bg-\\[\\#192b3a\\], [data-theme="${id}"] .bg-\\[\\#172230\\], [data-theme="${id}"] .bg-\\[\\#162738\\], [data-theme="${id}"] .bg-\\[\\#15212e\\], [data-theme="${id}"] .bg-\\[\\#142230\\], [data-theme="${id}"] .bg-\\[\\#182330\\], [data-theme="${id}"] .bg-\\[\\#202e3e\\], [data-theme="${id}"] .bg-\\[\\#1e2f42\\], [data-theme="${id}"] .bg-\\[\\#1e3445\\], [data-theme="${id}"] .bg-\\[\\#2b3a4a\\], [data-theme="${id}"] .bg-\\[\\#162534\\], [data-theme="${id}"] .bg-\\[\\#1f374a\\], [data-theme="${id}"] .bg-\\[\\#26384d\\], [data-theme="${id}"] .bg-\\[\\#202d3b\\], [data-theme="${id}"] .bg-\\[\\#102030\\]\\/95 { background-color: ${colors.interactive} !important; }`);
  }

  // General Hover states
  if (colors.hoverBg) {
    rules.push(`[data-theme="${id}"] .hover\\:bg-\\[\\#16202c\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#182330\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#203246\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#253547\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#1a2330\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#1b2838\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#1f2d3d\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#2b3e52\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#172b3d\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#202e3e\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#202d3b\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#23303f\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#23354a\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#16212d\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#15202c\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#1a2636\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#162232\\]:hover { background-color: ${colors.hoverBg} !important; }`);
  }
  if (colors.cardHoverBg) {
    rules.push(`[data-theme="${id}"] .hover\\:bg-\\[\\#2a475e\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#3d6585\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#1a232e\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#182535\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#16222f\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#121c27\\]:hover { background-color: ${colors.cardHoverBg} !important; }`);
  }

  // Selected Card in Grid/List
  if (colors.selectedCardBg) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#15251c\\] { background-color: ${colors.selectedCardBg} !important; }`);
  }

  // ItemCard Badges: Sorted & Unsorted
  if (colors.badgeUnsortedBg) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#2a1c10\\] { background-color: ${colors.badgeUnsortedBg} !important; color: ${colors.badgeUnsortedText || '#b45309'} !important; border-color: ${colors.badgeUnsortedBorder || '#fcd34d'} !important; }`);
  }
  if (colors.badgeSortedBg) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#14281a\\] { background-color: ${colors.badgeSortedBg} !important; color: ${colors.badgeSortedText || '#15803d'} !important; border-color: ${colors.badgeSortedBorder || '#86efac'} !important; }`);
  }

  // Tag Overflow Count Badge (+1)
  if (colors.tagOverflowBg) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#17222f\\] { background-color: ${colors.tagOverflowBg} !important; color: ${colors.tagOverflowText || '#2b4964'} !important; border-color: ${colors.tagOverflowBorder || '#bad2ea'} !important; }`);
  }

  // Tag Pills (Inactive & active base)
  if (colors.tagSteamBg) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#142232\\], [data-theme="${id}"] .bg-\\[\\#1c2f45\\], [data-theme="${id}"] .bg-\\[\\#141e29\\] { background-color: ${colors.tagSteamBg} !important; color: ${colors.tagSteamText || '#0284c7'} !important; border-color: ${colors.tagSteamBorder || '#7dd3fc'} !important; }`);
  }
  if (colors.tagUserBg) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#2a1d12\\], [data-theme="${id}"] .bg-\\[\\#382618\\], [data-theme="${id}"] .bg-\\[\\#1b1e24\\] { background-color: ${colors.tagUserBg} !important; color: ${colors.tagUserText || '#b45309'} !important; border-color: ${colors.tagUserBorder || '#fcd34d'} !important; }`);
  }

  // Tags Overflow Popover
  if (colors.tagsPopoverBg) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#0e1622\\]\\/98 { background-color: ${colors.tagsPopoverBg} !important; border-color: ${colors.tagsPopoverBorder || '#c4d9ed'} !important; }`);
  }

  // Scrollbars
  const scrollbarTrack = colors.scrollbarTrack || (isDark ? '#101822' : '#eaf2f9');
  const scrollbarThumb = colors.scrollbarThumb || (isDark ? '#2a475e' : '#bad2ea');
  const scrollbarThumbHover = colors.scrollbarThumbHover || (isDark ? '#385d7b' : '#8bb5dc');

  rules.push(`[data-theme="${id}"] * { scrollbar-color: ${scrollbarThumb} ${scrollbarTrack} !important; }`);
  rules.push(`[data-theme="${id}"] ::-webkit-scrollbar-track { background-color: ${scrollbarTrack} !important; }`);
  rules.push(`[data-theme="${id}"] ::-webkit-scrollbar-thumb { background-color: ${scrollbarThumb} !important; border-radius: 4px; }`);
  rules.push(`[data-theme="${id}"] ::-webkit-scrollbar-thumb:hover { background-color: ${scrollbarThumbHover} !important; }`);

  // Photo Overlay Controls (Arrows, Counter, Fullscreen, Favorite Star on Images)
  if (!isDark || colors.photoOverlayBg) {
    const ovBg = colors.photoOverlayBg || 'rgba(255, 255, 255, 0.88)';
    const ovText = colors.photoOverlayText || '#1e293b';
    const ovBorder = colors.photoOverlayBorder || 'rgba(196, 217, 237, 0.9)';
    const ovHoverBg = colors.photoOverlayHoverBg || '#ffffff';
    rules.push(`[data-theme="${id}"] .bg-black\\/60, [data-theme="${id}"] .bg-black\\/70 { background-color: ${ovBg} !important; color: ${ovText} !important; border-color: ${ovBorder} !important; }`);
    rules.push(`[data-theme="${id}"] .border-black\\/40, [data-theme="${id}"] .border-white\\/10 { border-color: ${ovBorder} !important; }`);
    rules.push(`[data-theme="${id}"] .bg-black\\/60:hover, [data-theme="${id}"] .bg-black\\/70:hover, [data-theme="${id}"] .hover\\:bg-black\\/90:hover, [data-theme="${id}"] .hover\\:bg-black\\/80:hover { background-color: ${ovHoverBg} !important; color: ${ovText} !important; }`);
  }

  // Borders - Base structural border color (defined BEFORE buttons so button borders can override)
  if (colors.borderColor) {
    rules.push(`[data-theme="${id}"] [class*="border-\\[\\#"] { border-color: ${colors.borderColor} !important; }`);
  }

  // Dividers
  if (colors.dividerBg) {
    rules.push(`[data-theme="${id}"] .bg-\\[\\#223242\\], [data-theme="${id}"] .bg-\\[\\#1c2a38\\], [data-theme="${id}"] .bg-\\[\\#1f2d3d\\], [data-theme="${id}"] .bg-\\[\\#1d2a38\\], [data-theme="${id}"] .bg-\\[\\#1e2a38\\] { background-color: ${colors.dividerBg} !important; }`);
  }

  // ==========================================
  // UNIFIED BUTTON COLOR ROLES (buttons.*)
  // ==========================================

  // 1. Primary Button (Call-to-Action: e.g. "Готово", "Зберегти")
  if (buttons.primary) {
    const { bg, text, border, hoverBg } = buttons.primary;
    rules.push(`[data-theme="${id}"] .btn-primary { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || bg} !important; }`);
    if (hoverBg) {
      rules.push(`[data-theme="${id}"] .btn-primary:hover { background-color: ${hoverBg} !important; }`);
    }
  }

  // 2. Secondary Button (Default UI actions: e.g. "Виділити всі", Search icon button, more menus)
  if (buttons.secondary) {
    const { bg, text, border, hoverBg } = buttons.secondary;
    rules.push(`[data-theme="${id}"] .bg-\\[\\#1a232e\\] { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || 'transparent'} !important; }`);
    if (hoverBg) {
      rules.push(`[data-theme="${id}"] .hover\\:bg-\\[\\#23303f\\]:hover { background-color: ${hoverBg} !important; }`);
    }
  }

  // 3. Disabled Button (e.g. "Зняти виділення" at 0, "Виконати план (0)")
  if (buttons.disabled) {
    const { bg, text, border } = buttons.disabled;
    rules.push(`[data-theme="${id}"] .bg-\\[\\#161d26\\], [data-theme="${id}"] .bg-\\[\\#18202a\\], [data-theme="${id}"] .bg-\\[\\#182029\\], [data-theme="${id}"] .bg-\\[\\#1d242d\\], [data-theme="${id}"] .bg-\\[\\#11161d\\], [data-theme="${id}"] .bg-\\[\\#1b2531\\], [data-theme="${id}"] .bg-\\[\\#121920\\] { background-color: ${bg} !important; color: ${text || '#8da4be'} !important; border-color: ${border || '#d4e3f1'} !important; }`);
    rules.push(`[data-theme="${id}"] button:disabled { background-color: ${bg} !important; color: ${text || '#8da4be'} !important; border-color: ${border || '#d4e3f1'} !important; }`);
  }

  // 4. Active Tab / Active Selector (e.g. [Теги | Колекції], [S | M | L], [Сітка | Список], Selected Tag Filter)
  if (buttons.activeTab) {
    const { bg, text, border } = buttons.activeTab;
    rules.push(`[data-theme="${id}"] .bg-\\[\\#2a475e\\] { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || 'transparent'} !important; }`);
    rules.push(`[data-theme="${id}"] .bg-\\[\\#152433\\] { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || 'transparent'} !important; }`);
  }

  // 5. Blue Buttons (Header Sync, Header Settings, Steam Restart, Full Sync, Steam Tag Cloud & Active Filters)
  if (buttons.blue) {
    const { bg, text, border, hoverBg } = buttons.blue;
    rules.push(`[data-theme="${id}"] .bg-\\[\\#1c2d3f\\], [data-theme="${id}"] .bg-\\[\\#182838\\], [data-theme="${id}"] .bg-\\[\\#152332\\], [data-theme="${id}"] .bg-\\[\\#101b26\\], [data-theme="${id}"] .bg-\\[\\#1a2d42\\], [data-theme="${id}"] .bg-\\[\\#121c27\\], [data-theme="${id}"] .bg-\\[\\#1e344d\\], [data-theme="${id}"] .bg-\\[\\#162738\\], [data-theme="${id}"] .bg-\\[\\#13283a\\], [data-theme="${id}"] .bg-\\[\\#1a334d\\], [data-theme="${id}"] .bg-\\[\\#1b344d\\], [data-theme="${id}"] .bg-\\[\\#112233\\], [data-theme="${id}"] .bg-\\[\\#163047\\], [data-theme="${id}"] .bg-\\[\\#172b3d\\], [data-theme="${id}"] .bg-\\[\\#182a38\\], [data-theme="${id}"] .bg-\\[\\#1a2d42\\]\\/70, [data-theme="${id}"] .bg-\\[\\#1b3b5c\\], [data-theme="${id}"] .bg-\\[\\#1f2d3d\\], [data-theme="${id}"] .bg-\\[\\#25394f\\], [data-theme="${id}"] .bg-\\[\\#253b52\\], [data-theme="${id}"] .bg-\\[\\#2c4e75\\], [data-theme="${id}"] .bg-\\[\\#2a475e\\]\\/40, [data-theme="${id}"] .bg-\\[\\#385e80\\], [data-theme="${id}"] .bg-\\[\\#3d6585\\] { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || 'transparent'} !important; }`);
    if (hoverBg) {
      rules.push(`[data-theme="${id}"] .hover\\:bg-\\[\\#253b52\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#385c7a\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#1a2d42\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#2c4e75\\]:hover { background-color: ${hoverBg} !important; }`);
    }
  }

  // 6. Green Buttons (Action Plan execution, Enable action, Active status filter, Mode A)
  if (buttons.green) {
    const { bg, text, border, hoverBg } = buttons.green;
    rules.push(`[data-theme="${id}"] .bg-\\[\\#142618\\], [data-theme="${id}"] .bg-\\[\\#1e3428\\], [data-theme="${id}"] .bg-\\[\\#1c4d28\\], [data-theme="${id}"] .bg-\\[\\#172e1e\\], [data-theme="${id}"] .bg-\\[\\#14281a\\], [data-theme="${id}"] .bg-\\[\\#14281a\\]\\/95, [data-theme="${id}"] .bg-\\[\\#1b4325\\], [data-theme="${id}"] .bg-\\[\\#15251c\\], [data-theme="${id}"] .bg-\\[\\#1b2b1e\\], [data-theme="${id}"] .bg-\\[\\#233524\\], [data-theme="${id}"] .bg-\\[\\#14291a\\], [data-theme="${id}"] .bg-\\[\\#15291b\\], [data-theme="${id}"] .bg-\\[\\#153e22\\], [data-theme="${id}"] .bg-\\[\\#1b4e2b\\], [data-theme="${id}"] .bg-\\[\\#1c2e22\\], [data-theme="${id}"] .bg-\\[\\#163d20\\], [data-theme="${id}"] .bg-\\[\\#174624\\], [data-theme="${id}"] .bg-\\[\\#1e5a2e\\], [data-theme="${id}"] .bg-\\[\\#1f3b25\\], [data-theme="${id}"] .bg-\\[\\#204526\\], [data-theme="${id}"] .bg-\\[\\#236337\\], [data-theme="${id}"] .bg-\\[\\#246334\\], [data-theme="${id}"] .bg-\\[\\#253f2c\\], [data-theme="${id}"] .bg-\\[\\#25422e\\], [data-theme="${id}"] .bg-\\[\\#255c33\\], [data-theme="${id}"] .bg-\\[\\#262f1c\\], [data-theme="${id}"] .bg-\\[\\#27753c\\], [data-theme="${id}"] .bg-\\[\\#284a32\\], [data-theme="${id}"] .bg-\\[\\#313c23\\], [data-theme="${id}"] .bg-\\[\\#192b1e\\], [data-theme="${id}"] .bg-\\[\\#1e3825\\] { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || 'transparent'} !important; }`);
    if (hoverBg) {
      rules.push(`[data-theme="${id}"] .hover\\:bg-\\[\\#246334\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#1f3b25\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#255c33\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#253f2c\\]:hover { background-color: ${hoverBg} !important; }`);
    }
  }

  // 7. Orange Buttons (Action Disable, Disabled status filter, Mode B, User tags)
  if (buttons.orange) {
    const { bg, text, border, hoverBg } = buttons.orange;
    rules.push(`[data-theme="${id}"] .bg-\\[\\#1a140d\\], [data-theme="${id}"] .bg-\\[\\#3d2c1f\\], [data-theme="${id}"] .bg-\\[\\#3a2818\\], [data-theme="${id}"] .bg-\\[\\#2b2216\\], [data-theme="${id}"] .bg-\\[\\#2d2215\\], [data-theme="${id}"] .bg-\\[\\#241c14\\], [data-theme="${id}"] .bg-\\[\\#2b2416\\], [data-theme="${id}"] .bg-\\[\\#332211\\], [data-theme="${id}"] .bg-\\[\\#241a10\\], [data-theme="${id}"] .bg-\\[\\#2b190d\\]\\/95, [data-theme="${id}"] .bg-\\[\\#2b1f14\\], [data-theme="${id}"] .bg-\\[\\#2e2013\\], [data-theme="${id}"] .bg-\\[\\#332415\\], [data-theme="${id}"] .bg-\\[\\#3d2716\\], [data-theme="${id}"] .bg-\\[\\#47341e\\], [data-theme="${id}"] .bg-\\[\\#523720\\], [data-theme="${id}"] .bg-\\[\\#5c4227\\], [data-theme="${id}"] .bg-\\[\\#1c140c\\]\\/90, [data-theme="${id}"] .bg-\\[\\#33271b\\] { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || 'transparent'} !important; }`);
    if (hoverBg) {
      rules.push(`[data-theme="${id}"] .hover\\:bg-\\[\\#523720\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#33271b\\]:hover { background-color: ${hoverBg} !important; }`);
    }
  }

  // 8. Red Buttons (Action Unsubscribe, Unsubscribed filter, Clear tags)
  if (buttons.red) {
    const { bg, text, border, hoverBg } = buttons.red;
    rules.push(`[data-theme="${id}"] .bg-\\[\\#201013\\], [data-theme="${id}"] .bg-\\[\\#3a1a1e\\], [data-theme="${id}"] .bg-\\[\\#1a1215\\], [data-theme="${id}"] .bg-\\[\\#2a1719\\], [data-theme="${id}"] .bg-\\[\\#2b191c\\], [data-theme="${id}"] .bg-\\[\\#261215\\], [data-theme="${id}"] .bg-\\[\\#201014\\]\\/90, [data-theme="${id}"] .bg-\\[\\#22171a\\], [data-theme="${id}"] .bg-\\[\\#291418\\], [data-theme="${id}"] .bg-\\[\\#2a171a\\], [data-theme="${id}"] .bg-\\[\\#2b1014\\]\\/95, [data-theme="${id}"] .bg-\\[\\#2b1417\\], [data-theme="${id}"] .bg-\\[\\#2d171b\\], [data-theme="${id}"] .bg-\\[\\#33181c\\], [data-theme="${id}"] .bg-\\[\\#341d24\\], [data-theme="${id}"] .bg-\\[\\#36181e\\], [data-theme="${id}"] .bg-\\[\\#361c1c\\], [data-theme="${id}"] .bg-\\[\\#381c22\\], [data-theme="${id}"] .bg-\\[\\#3b171c\\], [data-theme="${id}"] .bg-\\[\\#3b191e\\], [data-theme="${id}"] .bg-\\[\\#3d181d\\], [data-theme="${id}"] .bg-\\[\\#3d1a21\\], [data-theme="${id}"] .bg-\\[\\#40181e\\] { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || 'transparent'} !important; }`);
    if (hoverBg) {
      rules.push(`[data-theme="${id}"] .hover\\:bg-\\[\\#381c22\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#2d171b\\]:hover { background-color: ${hoverBg} !important; }`);
    }
  }

  // 9. Purple Buttons (Classifier rules, Action tags, Online sync)
  if (buttons.purple) {
    const { bg, text, border, hoverBg } = buttons.purple;
    rules.push(`[data-theme="${id}"] .bg-\\[\\#1b1528\\], [data-theme="${id}"] .bg-\\[\\#221736\\], [data-theme="${id}"] .bg-\\[\\#6035a6\\], [data-theme="${id}"] .bg-\\[\\#241738\\], [data-theme="${id}"] .bg-\\[\\#32234e\\], [data-theme="${id}"] .bg-\\[\\#241c38\\], [data-theme="${id}"] .bg-\\[\\#2b1e42\\], [data-theme="${id}"] .bg-\\[\\#130f1f\\], [data-theme="${id}"] .bg-\\[\\#1a1528\\], [data-theme="${id}"] .bg-\\[\\#1e152e\\], [data-theme="${id}"] .bg-\\[\\#231a33\\], [data-theme="${id}"] .bg-\\[\\#231a38\\], [data-theme="${id}"] .bg-\\[\\#2b1c42\\], [data-theme="${id}"] .bg-\\[\\#2c2044\\], [data-theme="${id}"] .bg-\\[\\#321f4e\\], [data-theme="${id}"] .bg-\\[\\#332252\\], [data-theme="${id}"] .bg-\\[\\#3f2963\\], [data-theme="${id}"] .bg-\\[\\#7241c4\\] { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || 'transparent'} !important; }`);
    if (hoverBg) {
      rules.push(`[data-theme="${id}"] .hover\\:bg-\\[\\#332252\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#7241c4\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#321f4e\\]:hover, [data-theme="${id}"] .hover\\:bg-\\[\\#3f2963\\]:hover { background-color: ${hoverBg} !important; }`);
    }
  }

  // 10. Yellow Buttons (Favorites filter, Starred state)
  if (buttons.yellow) {
    const { bg, text, border, hoverBg } = buttons.yellow;
    rules.push(`[data-theme="${id}"] .bg-\\[\\#3d3215\\], [data-theme="${id}"] .bg-\\[\\#4d3f1a\\] { background-color: ${bg} !important; color: ${text} !important; border-color: ${border || 'transparent'} !important; }`);
    if (hoverBg) {
      rules.push(`[data-theme="${id}"] .hover\\:bg-\\[\\#4d3f1a\\]:hover { background-color: ${hoverBg} !important; }`);
    }
  }

  // Typography
  if (colors.textPrimary) {
    rules.push(`[data-theme="${id}"] .text-\\[\\#c7d5e0\\], [data-theme="${id}"] .text-white, [data-theme="${id}"] .text-\\[\\#b8c6d1\\] { color: ${colors.textPrimary} !important; }`);
  }
  if (colors.textSecondary) {
    rules.push(`[data-theme="${id}"] .text-gray-200, [data-theme="${id}"] .text-gray-300, [data-theme="${id}"] .text-\\[\\#9bb0c1\\] { color: ${colors.textSecondary} !important; }`);
  }
  if (colors.textMuted) {
    rules.push(`[data-theme="${id}"] .text-gray-400, [data-theme="${id}"] .text-gray-500, [data-theme="${id}"] .text-\\[\\#8f98a0\\], [data-theme="${id}"] .text-\\[\\#657484\\], [data-theme="${id}"] .text-\\[\\#758494\\], [data-theme="${id}"] .text-\\[\\#86a5b8\\], [data-theme="${id}"] .text-\\[\\#8b949e\\] { color: ${colors.textMuted} !important; }`);
  }
  if (colors.textAccent) {
    rules.push(`[data-theme="${id}"] .text-\\[\\#66c0f4\\] { color: ${colors.textAccent} !important; }`);
  }
  if (colors.tagUserText) {
    rules.push(`[data-theme="${id}"] .text-\\[\\#f49e42\\], [data-theme="${id}"] .text-\\[\\#f4b366\\] { color: ${colors.tagUserText} !important; }`);
  }

  // Custom CSS override
  if (customCss) {
    rules.push(customCss);
  }

  return rules.join('\n');
}

// Extract theme list and inject CSS into DOM
const discoveredThemes = [];
const aggregatedCss = [];

// Ensure base steam theme exists as first option
const sortedEntries = Object.entries(themeModules).sort(([pathA], [pathB]) => {
  if (pathA.includes('steam.json')) return -1;
  if (pathB.includes('steam.json')) return 1;
  return pathA.localeCompare(pathB);
});

for (const [, moduleContent] of sortedEntries) {
  const themeData = moduleContent.default || moduleContent;
  if (themeData && themeData.id) {
    discoveredThemes.push(themeData);
    const css = buildCssFromTheme(themeData);
    if (css) {
      aggregatedCss.push(css);
    }
  }
}

// Inject all generated theme styles once at startup
if (typeof document !== 'undefined') {
  let styleEl = document.getElementById('dynamic-theme-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-theme-styles';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = aggregatedCss.join('\n\n');
}

export const THEMES = discoveredThemes;

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('sw_ui_theme');
    if (saved && THEMES.some(t => t.id === saved)) {
      return saved;
    }
    return 'steam';
  });

  const currentThemeObj = THEMES.find(t => t.id === theme) || THEMES[0];
  const isHighContrast = Boolean(currentThemeObj?.isHighContrast);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    if (isHighContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (currentThemeObj && !currentThemeObj.isDark) {
      root.style.colorScheme = 'light';
    } else {
      root.style.colorScheme = 'dark';
    }

    localStorage.setItem('sw_ui_theme', theme);
  }, [theme, isHighContrast, currentThemeObj]);

  const setTheme = useCallback((newTheme) => {
    if (THEMES.some(t => t.id === newTheme)) {
      setThemeState(newTheme);
    }
  }, []);

  const toggleHighContrast = useCallback((enable) => {
    setThemeState(prev => {
      const shouldEnable = typeof enable === 'boolean' ? enable : !(prev === 'high-contrast-dark' || prev === 'high-contrast-light');
      if (shouldEnable) {
        return (prev === 'light' || prev === 'high-contrast-light') ? 'high-contrast-light' : 'high-contrast-dark';
      } else {
        return (prev === 'high-contrast-light') ? 'light' : 'steam';
      }
    });
  }, []);

  const contextValue = useMemo(() => ({
    theme,
    setTheme,
    isHighContrast,
    toggleHighContrast,
    themes: THEMES
  }), [theme, setTheme, isHighContrast, toggleHighContrast]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

