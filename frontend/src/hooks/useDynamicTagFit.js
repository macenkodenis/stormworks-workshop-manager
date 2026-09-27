import { useState, useRef, useEffect, useCallback } from 'react';
import { getTagDisplayPath, estimateTagWidth, observeElementResize, observeElementVisibility } from '../utils/tagUtils';
import { useI18n } from '../i18n/I18nContext';

/**
 * Custom hook that manages dynamic single-line tag fitting and hover popover state.
 *
 * @param {Object} params
 * @param {Array<{tag: string, type: 'steam'|'user'}>} params.displayTags - Sorted tags to display
 * @param {Map|null} params.tagPathMap - Mapping for shortened display paths
 * @param {number} params.cardSize - Active card size (1 = S, 2 = M, 3 = L)
 * @param {number} params.defaultFit - Initial estimated fit count before DOM measurement
 * @param {React.RefObject} params.containerRef - Ref to tags container DOM element
 * @param {React.RefObject} params.rootRef - Ref to card root DOM element for viewport visibility check
 * @returns {{
 *   visibleTagCount: number,
 *   showTagsPopover: boolean,
 *   handleTagsMouseEnter: () => void,
 *   handleTagsMouseLeave: () => void
 * }}
 */
export function useDynamicTagFit({
  displayTags = [],
  tagPathMap = null,
  cardSize = 2,
  defaultFit = 3,
  containerRef,
  rootRef
}) {
  const { tTag } = useI18n();
  const [measuredFit, setMeasuredFit] = useState(null);
  const [showTagsPopover, setShowTagsPopover] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const popoverTimeoutRef = useRef(null);

  // Reset measuredFit when cardSize changes
  useEffect(() => {
    setMeasuredFit(null);
  }, [cardSize]);

  const visibleTagCount = measuredFit !== null ? measuredFit : defaultFit;

  const computeFit = useCallback((entry) => {
    if (typeof document !== 'undefined' && document.body.classList.contains('is-resizing')) return;
    const container = containerRef.current;
    if (!container || displayTags.length === 0) return;

    // Use zero-reflow contentRect.width from ResizeObserver entry if available, fallback to offsetWidth
    const containerWidth = (entry && entry.contentRect && entry.contentRect.width > 0)
      ? entry.contentRect.width
      : container.offsetWidth;
    if (containerWidth <= 0) return;

    let totalWidth = 0;
    let fitCount = 0;
    const gap = 4; // gap-1 is 4px
    const remainderReserve = 36; // Full reserve for "+N" badge including padding/border

    for (let i = 0; i < displayTags.length; i++) {
      const { tag, type } = displayTags[i];
      const rawDisplayLabel = getTagDisplayPath(tag, type, tagPathMap);
      const displayLabel = tTag ? tTag(rawDisplayLabel) : rawDisplayLabel;
      const tagWidth = estimateTagWidth(displayLabel, false);
      const needed = totalWidth + tagWidth + (fitCount > 0 ? gap : 0);

      const hasMore = i < displayTags.length - 1;
      if (needed + (hasMore ? gap + remainderReserve : 0) <= containerWidth) {
        totalWidth = needed;
        fitCount++;
      } else {
        break;
      }
    }

    const nextFit = Math.max(1, fitCount);
    setMeasuredFit(prev => prev === nextFit ? prev : nextFit);
  }, [displayTags, tagPathMap, containerRef, tTag]);

  // Viewport intersection observer: only activate measurements when element is in viewport
  useEffect(() => {
    const rootEl = rootRef?.current;
    if (!rootEl) return;

    return observeElementVisibility(rootEl, (intersecting) => {
      setIsVisible(intersecting);
      if (intersecting) {
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => computeFit());
        } else {
          computeFit();
        }
      }
    });
  }, [computeFit, rootRef]);

  // Resize observer: ONLY active when card is actually visible in viewport
  useEffect(() => {
    if (!isVisible) return;
    const container = containerRef?.current;
    if (!container || displayTags.length === 0) return;

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => computeFit());
    }

    return observeElementResize(container, computeFit);
  }, [isVisible, displayTags.length, computeFit, containerRef]);

  const handleTagsMouseEnter = useCallback(() => {
    if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
    computeFit();
    if (displayTags.length > visibleTagCount) {
      setShowTagsPopover(true);
    }
  }, [computeFit, displayTags.length, visibleTagCount]);

  const handleTagsMouseLeave = useCallback(() => {
    popoverTimeoutRef.current = setTimeout(() => {
      setShowTagsPopover(false);
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
    };
  }, []);

  return {
    visibleTagCount,
    showTagsPopover,
    handleTagsMouseEnter,
    handleTagsMouseLeave
  };
}
