import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  HardDrive,
  Cloud,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Tag,
  FileText,
  Star,
  RotateCcw,
  EyeOff,
  Trash2,
  PowerOff,
  Power,
  CircleDashed,
  Copy,
  Check,
  Folder,
  FolderPlus,
  Plus
} from 'lucide-react';
import { getTagDisplayPath, resolveTagFromPath, transliterate, matchesTagSearch } from '../utils/tagUtils';
import { formatBytes, formatDate } from '../utils/formatters';
import SteamBBCode from './SteamBBCode';
import { useI18n } from '../i18n/I18nContext';
import { TAG_TRANSLATIONS } from '../i18n/translations';

export function ItemDetailModal({
  item,
  onClose,
  initialSidebarMode = 'tags',
  collections = [],
  onAddToCollection,
  onRemoveFromCollection,
  onCreateCollectionWithItem,
  onUpdateItemUserTags,
  allAvailableUserTags = [],
  allAvailableSteamTags = [],
  onToggleFavorite,
  onUpdateSteamTags,
  onClearItemTags,
  onResetItemTags,
  onToggleDisabled,
  onToggleSubscription,
  onToggleSorted,
  onDisableItem,
  onUnsubscribeItem,
  selectedSteamTags = new Set(),
  selectedUserTags = new Set(),
  tagPathMap,
  tagFullPathMap,
  reverseTagPathMap,
  onNavigatePrev,
  onNavigateNext,
  hasNavigation = false,
  currentIndex,
  totalCount
}) {
  const { t, tTag, lang, translateTags, updateTagTranslations, customTagTranslations } = useI18n();
  const mouseDownTargetRef = useRef(null);
  const [activeTab, setActiveTab] = useState(initialSidebarMode || 'tags');
  const [newColInput, setNewColInput] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [galleryImages, setGalleryImages] = useState([]);
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = async (text, fieldName) => {
    if (!text) return;
    const str = String(text);

    let success = false;

    // 1. Native desktop PyWebView Qt clipboard (instant and zero permissions)
    if (window.pywebview?.api?.copy_to_clipboard) {
      try {
        const res = await window.pywebview.api.copy_to_clipboard(str);
        if (res?.status === 'ok') {
          success = true;
        }
      } catch (e) {
        // Fall through
      }
    }

    // 2. Safe execCommand fallback (does not trigger Qt permission dialog or crashes)
    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = str;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (e) {
        // Fall through
      }
    }

    // 3. Fallback to navigator.clipboard with error suppression
    if (!success && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(str);
        success = true;
      } catch (e) {
        // Suppress error
      }
    }

    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Keyboard navigation between mods (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && onNavigatePrev) {
        e.preventDefault();
        onNavigatePrev();
      } else if (e.key === 'ArrowRight' && onNavigateNext) {
        e.preventDefault();
        onNavigateNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigatePrev, onNavigateNext]);
  const [newTagInput, setNewTagInput] = useState('');
  const [userTags, setUserTags] = useState(item?.user_tags || []);
  const [steamTags, setSteamTags] = useState(item?.tags || []);
  const [deactivatedSteamTags, setDeactivatedSteamTags] = useState(item?.deactivated_steam_tags || []);
  const [isFavorited, setIsFavorited] = useState(Boolean(item?.is_favorited));
  const [isDisabled, setIsDisabled] = useState(Boolean(item?.is_disabled));
  const [isUnsubscribed, setIsUnsubscribed] = useState(Boolean(item?.is_unsubscribed));
  const [isSorted, setIsSorted] = useState(
    item?.is_sorted !== undefined ? Boolean(item.is_sorted) : (item?.user_tags || []).length > 0
  );
  const [stubMessage, setStubMessage] = useState(null);

  const handleDisableToggle = async () => {
    const nextState = !isDisabled;
    setIsDisabled(nextState);
    if (onToggleDisabled) {
      onToggleDisabled(item.published_file_id, nextState);
    } else if (onDisableItem) {
      onDisableItem(item);
    } else {
      try {
        await fetch(`/api/items/${item.published_file_id}/toggle-disabled`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_disabled: nextState })
        });
      } catch (err) {
        console.error('Failed to toggle disabled:', err);
      }
    }
    setStubMessage(nextState ? t('detail.modDisabled') : t('detail.modEnabled'));
    setTimeout(() => setStubMessage(null), 3000);
  };

  const handleSubscriptionToggle = async () => {
    const nextState = !isUnsubscribed;
    setIsUnsubscribed(nextState);
    if (onToggleSubscription) {
      onToggleSubscription(item.published_file_id, nextState);
    } else if (onUnsubscribeItem) {
      onUnsubscribeItem(item);
    } else {
      try {
        await fetch(`/api/items/${item.published_file_id}/toggle-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_unsubscribed: nextState })
        });
      } catch (err) {
        console.error('Failed to toggle subscription:', err);
      }
    }
    setStubMessage(nextState ? t('detail.unsubscribedMsg') : t('detail.subscribedMsg'));
    setTimeout(() => setStubMessage(null), 3000);
  };

  const handleToggleSorted = async () => {
    const nextState = !isSorted;
    setIsSorted(nextState);
    if (onToggleSorted) {
      onToggleSorted(item.published_file_id, nextState);
    } else {
      try {
        await fetch(`/api/items/${item.published_file_id}/toggle-sorted`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_sorted: nextState })
        });
      } catch (err) {
        console.error('Failed to toggle sorted:', err);
      }
    }
    setStubMessage(nextState ? t('detail.sortedMsg') : t('detail.unsortedMsg'));
    setTimeout(() => setStubMessage(null), 3000);
  };

  useEffect(() => {
    setUserTags(item?.user_tags || []);
    setSteamTags(item?.tags || []);
    setDeactivatedSteamTags(item?.deactivated_steam_tags || []);
    setIsFavorited(Boolean(item?.is_favorited));
    setIsDisabled(Boolean(item?.is_disabled));
    setIsUnsubscribed(Boolean(item?.is_unsubscribed));
    setIsSorted(item?.is_sorted !== undefined ? Boolean(item.is_sorted) : (item?.user_tags || []).length > 0);
  }, [item]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Initial images and fetch full workshop gallery from backend
  useEffect(() => {
    if (!item) return;

    const initial = [];
    const localPrev = `/api/previews/${item.published_file_id}`;
    initial.push(localPrev);

    if (item.preview_url && item.preview_url !== localPrev) {
      initial.push(item.preview_url);
    }
    setGalleryImages(initial);
    setActiveImageIndex(0);

    fetch(`/api/items/${item.published_file_id}/gallery`)
      .then((r) => r.json())
      .then((data) => {
        if (data.gallery && data.gallery.length > 0) {
          const combined = [];
          const seen = new Set();
          
          data.gallery.forEach((url) => {
            if (!seen.has(url)) {
              seen.add(url);
              combined.push(url);
            }
          });

          if (!seen.has(localPrev)) {
            combined.unshift(localPrev);
          }

          setGalleryImages(combined);
        }
      })
      .catch((err) => console.error('Failed to load gallery:', err));
  }, [item?.published_file_id]);

  if (!item) return null;

  const formatDetailDate = (unixTs) => formatDate(unixTs, true) || '—';

  const currentImage = galleryImages[activeImageIndex] || `/api/previews/${item.published_file_id}`;
  const steamWorkshopUrl = `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.published_file_id}`;
  const authorProfileUrl = item.creator ? `https://steamcommunity.com/profiles/${item.creator}` : null;

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1));
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0));
  };

  const handleToggleFav = () => {
    const nextVal = !isFavorited;
    setIsFavorited(nextVal);
    if (onToggleFavorite) {
      onToggleFavorite(item.published_file_id);
    }
  };

  const safeUserTags = Array.isArray(userTags) ? userTags : [];
  const safeSteamTags = Array.isArray(steamTags) ? steamTags : [];
  const safeDeactivatedSteamTags = Array.isArray(deactivatedSteamTags) ? deactivatedSteamTags : [];
  const safeAvailableSteamTags = Array.isArray(allAvailableSteamTags) ? allAvailableSteamTags : [];
  const safeAvailableUserTags = Array.isArray(allAvailableUserTags) ? allAvailableUserTags : [];

  // Add User tag
  const handleAddUserTag = (tagToAdd) => {
    const rawInput = (tagToAdd || newTagInput).trim();
    if (!rawInput) return;
    setNewTagInput('');

    // Transliterate into system identifier if needed
    const systemTag = transliterate(rawInput);
    const systemLower = systemTag.toLowerCase();
    const rawLower = rawInput.toLowerCase();

    // Duplicate check: avoid duplicate user tags (comparing both system name and translated name)
    const alreadyExists = safeUserTags.some(t => {
      const tLower = t.toLowerCase();
      const transLower = (tTag(t) || '').toLowerCase();
      return tLower === systemLower || tLower === rawLower || transLower === rawLower;
    });

    if (!alreadyExists) {
      // Save translation according to user rules:
      // If translateTags is ON -> save only for current UI language (lang)
      // If translateTags is OFF -> save only as English translation (en)
      const newTranslations = translateTags
        ? { [lang]: rawInput }
        : { en: rawInput };

      if (updateTagTranslations) {
        updateTagTranslations(systemTag, newTranslations);
      }

      fetch('/api/classifier/tag-translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: systemTag, translations: newTranslations })
      }).catch(err => console.warn('Failed to save tag translation on backend:', err));

      const updated = [...safeUserTags, systemTag];
      setUserTags(updated);
      setIsSorted(true);
      if (onUpdateItemUserTags) {
        onUpdateItemUserTags(item.published_file_id, updated);
      }
    }
  };

  // Remove User tag
  const handleRemoveUserTag = (tagToRemove) => {
    const updated = safeUserTags.filter(t => t !== tagToRemove);
    setUserTags(updated);
    setIsSorted(true);
    if (onUpdateItemUserTags) {
      onUpdateItemUserTags(item.published_file_id, updated);
    }
  };

  // Assign Steam Tag (add to steamTags and make sure it is not deactivated)
  const handleAssignSteamTag = (tagToAdd) => {
    const trimmed = (tagToAdd || newTagInput).trim();
    if (!trimmed) return;
    setNewTagInput('');

    let nextTags = [...safeSteamTags];
    const exists = safeSteamTags.some(t => t.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      nextTags.push(trimmed);
      setSteamTags(nextTags);
    }

    let nextDeactivated = [...safeDeactivatedSteamTags];
    const isDeactivated = safeDeactivatedSteamTags.some(t => t.toLowerCase() === trimmed.toLowerCase());
    if (isDeactivated) {
      nextDeactivated = safeDeactivatedSteamTags.filter(t => t.toLowerCase() !== trimmed.toLowerCase());
      setDeactivatedSteamTags(nextDeactivated);
    }

    setIsSorted(true);
    if (onUpdateSteamTags) {
      onUpdateSteamTags(item.published_file_id, nextTags, nextDeactivated);
    }
  };

  // Remove manually added Steam Tag (which was not in original Steam tags)
  const handleRemoveSteamTag = (tagToRemove) => {
    const nextTags = safeSteamTags.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase());
    const nextDeactivated = safeDeactivatedSteamTags.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase());
    setSteamTags(nextTags);
    setDeactivatedSteamTags(nextDeactivated);
    setIsSorted(true);
    if (onUpdateSteamTags) {
      onUpdateSteamTags(item.published_file_id, nextTags, nextDeactivated);
    }
  };

  // Deactivate Steam Tag
  const handleDeactivateSteamTag = (tagToDeactivate) => {
    if (!safeDeactivatedSteamTags.includes(tagToDeactivate)) {
      const updated = [...safeDeactivatedSteamTags, tagToDeactivate];
      setDeactivatedSteamTags(updated);
      setIsSorted(true);
      if (onUpdateSteamTags) {
        onUpdateSteamTags(item.published_file_id, safeSteamTags, updated);
      }
    }
  };

  // Re-activate Steam Tag
  const handleReactivateSteamTag = (tagToActivate) => {
    const updated = safeDeactivatedSteamTags.filter(t => t !== tagToActivate);
    setDeactivatedSteamTags(updated);
    setIsSorted(true);
    if (onUpdateSteamTags) {
      onUpdateSteamTags(item.published_file_id, safeSteamTags, updated);
    }
  };

  // Clear all tags (delete user tags, revert steam tags to original and deactivate all of them)
  const handleClearAllTags = () => {
    const orig = Array.isArray(item?.original_steam_tags) ? item.original_steam_tags : safeSteamTags;
    setUserTags([]);
    setIsSorted(false);
    setSteamTags([...orig]);
    setDeactivatedSteamTags([...orig]);
    if (onClearItemTags && item) {
      onClearItemTags(item.published_file_id);
    }
  };

  // Revert all tag changes to original Steam tags (pulled from Steam)
  const handleResetOriginalTags = () => {
    const orig = Array.isArray(item.original_steam_tags) ? item.original_steam_tags : safeSteamTags;
    setUserTags([]);
    setIsSorted(false);
    setDeactivatedSteamTags([]);
    setSteamTags([...orig]);
    if (onResetItemTags) {
      onResetItemTags(item.published_file_id);
    }
  };

  // Unified submit for Add Tag form:
  // - If the entered value matches an existing Steam tag (case-insensitive full match), assign/reactivate it as Steam tag
  // - Otherwise, add as custom user tag
  // - If the tag already exists (either as user tag or active Steam tag), accept duplicate input without re-adding
  const handleUnifiedAddTag = (e) => {
    if (e) e.preventDefault();
    const rawVal = newTagInput.trim();
    if (!rawVal) return;
    const resolved = resolveTagFromPath(rawVal, reverseTagPathMap);
    const val = resolved || rawVal;
    const valLower = val.toLowerCase();

    // Check if entered value is a match to any available Steam tag (by system name or translated name)
    const matchedSteamTag = safeAvailableSteamTags.find(st => {
      if (typeof st !== 'string') return false;
      const lower = st.toLowerCase();
      const transLower = (tTag(st) || '').toLowerCase();
      return lower === valLower || transLower === valLower;
    });

    if (matchedSteamTag) {
      handleAssignSteamTag(matchedSteamTag);
    } else {
      // Check if matches an existing user tag by system name or translated name
      const matchedUserTag = safeAvailableUserTags.find(ut => {
        if (typeof ut !== 'string') return false;
        const lower = ut.toLowerCase();
        const transLower = (tTag(ut) || '').toLowerCase();
        return lower === valLower || transLower === valLower;
      });

      handleAddUserTag(matchedUserTag || val);
    }
  };

  // Set of original Steam tags fetched from Steam (lowercase for safe matching)
  const originalSteamTagsSet = new Set(
    (Array.isArray(item?.original_steam_tags) ? item.original_steam_tags : []).map(t =>
      typeof t === 'string' ? t.toLowerCase() : ''
    )
  );

  // Build ordered unified tag list for detailed view:
  // 1. Active tags: user tags + active Steam tags (order within themselves preserved)
  // 2. Deactivated Steam tags: placed AFTER all active tags (order preserved)
  const deactivatedSet = new Set(safeDeactivatedSteamTags);
  const activeSteamTagItems = safeSteamTags.filter(t => !deactivatedSet.has(t)).map(t => ({
    tag: t,
    type: 'steam',
    deactivated: false,
    isOriginal: originalSteamTagsSet.has(t.toLowerCase())
  }));
  const userTagItems = safeUserTags.map(t => ({
    tag: t,
    type: 'user',
    deactivated: false,
    isOriginal: false
  }));
  const activeTags = [...userTagItems, ...activeSteamTagItems];

  const deactivatedSteamTagItems = safeSteamTags.filter(t => deactivatedSet.has(t)).map(t => ({
    tag: t,
    type: 'steam',
    deactivated: true,
    isOriginal: originalSteamTagsSet.has(t.toLowerCase())
  }));

  const allDisplayTags = [...activeTags, ...deactivatedSteamTagItems];

  // Filtered suggestions (both Steam tags and user tags) based on newTagInput:
  const searchFilter = (newTagInput || '').trim().toLowerCase();

  // Steam suggestions: available Steam tags that are not currently active on this item
  const filteredSteamSuggestions = safeAvailableSteamTags
    .filter(t => typeof t === 'string' && (!safeSteamTags.includes(t) || deactivatedSet.has(t)))
    .filter(t => {
      if (!searchFilter) return true;
      const displayPath = getTagDisplayPath(t, 'steam', tagPathMap);
      const fullPath = getTagDisplayPath(t, 'steam', tagFullPathMap);
      return matchesTagSearch(t, searchFilter, {
        customTranslations: customTagTranslations,
        systemTranslations: TAG_TRANSLATIONS,
        displayPath,
        fullPath
      });
    })
    .map(t => ({ tag: t, type: 'steam' }));

  // User suggestions: available user tags that are not currently on this item
  const filteredUserSuggestions = safeAvailableUserTags
    .filter(t => typeof t === 'string' && !safeUserTags.includes(t))
    .filter(t => {
      if (!searchFilter) return true;
      const displayPath = getTagDisplayPath(t, 'user', tagPathMap);
      const fullPath = getTagDisplayPath(t, 'user', tagFullPathMap);
      return matchesTagSearch(t, searchFilter, {
        customTranslations: customTagTranslations,
        systemTranslations: TAG_TRANSLATIONS,
        displayPath,
        fullPath
      });
    })
    .map(t => ({ tag: t, type: 'user' }));

  // Combine suggestions: matching user tags and steam tags (deduplicating by name)
  const combinedSuggestions = [];
  const seenTagNames = new Set();

  // Priority: custom user tags first, then steam tags
  filteredUserSuggestions.forEach(item => {
    const lower = (item.tag || '').toLowerCase();
    if (lower && !seenTagNames.has(lower)) {
      seenTagNames.add(lower);
      combinedSuggestions.push(item);
    }
  });

  filteredSteamSuggestions.forEach(item => {
    const lower = (item.tag || '').toLowerCase();
    if (lower && !seenTagNames.has(lower)) {
      seenTagNames.add(lower);
      combinedSuggestions.push(item);
    }
  });

  const modCollectionIds = Array.isArray(item?.collection_ids) ? item.collection_ids : [];
  const modCollections = collections.filter(c => modCollectionIds.includes(c.id));
  const availableToAddCollections = collections.filter(c => !modCollectionIds.includes(c.id));

  const handleCreateColWithThisMod = async () => {
    const trimmed = newColInput.trim();
    if (!trimmed) return;
    if (onCreateCollectionWithItem) {
      await onCreateCollectionWithItem(trimmed, item.published_file_id);
      setNewColInput('');
    }
  };

  return (
    <div
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-[#101721] border border-[#1e2c3d] rounded-xl w-full max-w-5xl max-h-[calc(100%-2rem)] my-auto flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-[#1b2838] flex items-center justify-between bg-[#121922] shrink-0">
          <div className="flex items-center gap-3 truncate mr-4">
            <h2 className="text-base font-bold text-white truncate" title={item.title}>
              {item.title}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {hasNavigation && (
              <div className="flex items-center gap-1 bg-[#0a0f15] border border-[#233547] rounded-lg p-0.5 text-xs text-gray-400">
                <button
                  type="button"
                  onClick={onNavigatePrev}
                  title="←"
                  className="hover:text-white p-1 rounded hover:bg-[#1a2636] transition cursor-pointer text-[#8f98a0]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-[11px] px-1.5 text-gray-300 select-none">
                  {currentIndex !== undefined && currentIndex >= 0 && totalCount !== undefined ? `${currentIndex + 1} / ${totalCount}` : ''}
                </span>
                <button
                  type="button"
                  onClick={onNavigateNext}
                  title="→"
                  className="hover:text-white p-1 rounded hover:bg-[#1a2636] transition cursor-pointer text-[#8f98a0]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-[#8f98a0] hover:text-white p-1 rounded transition cursor-pointer"
              title={t('detail.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          
          {/* Section 1: Main Photo (Left) + Metadata Column with Button (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left: Main Big Image Box (col-span-8 for wider preview) */}
            <div className="lg:col-span-8">
              <div className="relative aspect-video w-full bg-[#0a0f14] rounded-lg border border-[#1f2d3d] overflow-hidden flex items-center justify-center group shadow">
                <img
                  src={currentImage}
                  alt={item.title}
                  onError={(e) => {
                    if (item.preview_url && e.target.src !== item.preview_url) {
                      e.target.src = item.preview_url;
                    }
                  }}
                  className="w-full h-full object-contain"
                />

                {galleryImages.length > 1 && (
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2 rounded transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}

                {galleryImages.length > 1 && (
                  <button
                    onClick={handleNextImage}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2 rounded transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                  <span className="bg-black/70 backdrop-blur-xs text-[#c7d5e0] font-mono text-[11px] px-2.5 py-1 rounded border border-black/40">
                    {activeImageIndex + 1} / {galleryImages.length}
                  </span>
                  <a
                    href={currentImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-black/70 hover:bg-black/90 backdrop-blur-xs text-white p-1.5 rounded border border-black/40 transition"
                    title={t('detail.fullImage')}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Metadata Panel & Action Buttons (col-span-4) */}
            <div className="lg:col-span-4 flex flex-col space-y-2.5">
              
              {/* Status & Organization Block */}
              <div className="bg-[#131c26] border border-[#1f2d3d] rounded-lg p-2.5 grid grid-cols-2 gap-2">
                {/* 1. Status Indicator */}
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0d141d]/60 border border-[#1a2533]">
                  {isUnsubscribed ? (
                    <Trash2 className="w-4 h-4 text-[#ff6b6b] shrink-0" />
                  ) : isDisabled ? (
                    <PowerOff className="w-4 h-4 text-[#f49e42] shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#a4d053] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] text-[#8f98a0] block">{t('detail.status')}</span>
                    <strong className={`text-xs font-semibold truncate block ${
                      isUnsubscribed
                        ? 'text-[#ff6b6b]'
                        : isDisabled
                        ? 'text-[#f49e42]'
                        : 'text-[#a4d053]'
                    }`}>
                      {isUnsubscribed ? t('detail.statusUnsubscribed') : isDisabled ? t('detail.statusDisabled') : t('detail.statusActive')}
                    </strong>
                  </div>
                </div>

                {/* 2. Organization Indicator (styled analogous to Status) */}
                <button
                  type="button"
                  onClick={handleToggleSorted}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0d141d]/60 hover:bg-[#15202c] border border-[#1a2533] hover:border-[#2d4358] transition cursor-pointer text-left select-none group"
                >
                  {isSorted ? (
                    <CheckCircle2 className="w-4 h-4 text-[#a4d053] shrink-0 group-hover:scale-105 transition" />
                  ) : (
                    <CircleDashed className="w-4 h-4 text-[#f49e42] shrink-0 group-hover:scale-105 transition" />
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] text-[#8f98a0] block group-hover:text-gray-300 transition">{t('detail.organization')}</span>
                    <strong className={`text-xs font-semibold truncate block ${
                      isSorted ? 'text-[#a4d053]' : 'text-[#f49e42]'
                    }`}>
                      {isSorted ? t('detail.sorted') : t('detail.unsorted')}
                    </strong>
                  </div>
                </button>
              </div>

              {/* Stack of Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                {/* 1. Favorite status button */}
                <button
                  type="button"
                  onClick={handleToggleFav}
                  title={isFavorited ? t('detail.removeFromFavorites') : t('detail.addToFavorites')}
                  className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition shadow text-xs cursor-pointer active:scale-98 border ${
                    isFavorited
                      ? 'bg-[#3d3215] hover:bg-[#4d3f1a] text-[#f6be3c] border-[#8a6b20]'
                      : 'bg-[#182330] hover:bg-[#223245] text-gray-300 hover:text-white border-[#2b3e52]'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-[#f6be3c] text-[#f6be3c]' : 'text-gray-400'}`} />
                  <span>{isFavorited ? t('detail.inFavorites') : t('detail.addToFavorites')}</span>
                </button>

                {/* 2. Steam Workshop Button */}
                <a
                  href={steamWorkshopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#1b2838] hover:bg-[#23354a] border border-[#2d4358] hover:border-[#38536f] text-white py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition shadow text-xs group"
                >
                  <svg className="w-4 h-4 text-[#66c0f4] group-hover:scale-110 transition" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15.5l-2.12-.85a2.6 2.6 0 0 1-1.38-2.31c0-1.44 1.16-2.6 2.6-2.6.43 0 .84.11 1.2.3l3.52-2.56c-.02-.16-.02-.32-.02-.48 0-2.6 2.1-4.7 4.7-4.7s4.7 2.1 4.7 4.7-2.1 4.7-4.7 4.7c-.52 0-1.01-.09-1.48-.25l-2.48 3.55c.1.34.16.69.16 1.06 0 1.93-1.57 3.5-3.5 3.5-.67 0-1.29-.19-1.82-.52L4.5 20.3C6.6 21.38 9.21 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
                  </svg>
                  <span>{t('detail.openSteam')}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition" />
                </a>

                {/* 3. Connect/Disconnect & Subscribe/Unsubscribe side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDisableToggle}
                    className={`w-full py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 font-semibold transition shadow text-xs cursor-pointer active:scale-98 border ${
                      isDisabled
                        ? 'bg-[#15251c] hover:bg-[#253f2c] border-[#3b6346] text-[#a4d053] hover:text-white'
                        : 'bg-[#16202c] hover:bg-[#1f2d3d] border-[#2b3e52] hover:border-[#f49e42]/60 text-[#f4b366] hover:text-[#ffd699]'
                    }`}
                  >
                    {isDisabled ? (
                      <>
                        <Power className="w-3.5 h-3.5 shrink-0 text-[#a4d053]" />
                        <span className="truncate">{t('detail.enable')}</span>
                      </>
                    ) : (
                      <>
                        <PowerOff className="w-3.5 h-3.5 shrink-0 text-[#f49e42]" />
                        <span className="truncate">{t('detail.disable')}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSubscriptionToggle}
                    className={`w-full py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 font-semibold transition shadow text-xs cursor-pointer active:scale-98 border ${
                      isUnsubscribed
                        ? 'bg-[#121c27] hover:bg-[#1a2d42] border-[#2a475e] text-[#66c0f4] hover:text-white'
                        : 'bg-[#1a1215] hover:bg-[#2d171b] border-[#4a1f24] hover:border-[#66282e] text-[#ff6b6b] hover:text-[#ff8585]'
                    }`}
                  >
                    {isUnsubscribed ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#66c0f4]" />
                        <span className="truncate">{t('detail.subscribe')}</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 shrink-0 text-[#ff6b6b]" />
                        <span className="truncate">{t('detail.unsubscribe')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {stubMessage && (
                <div className="bg-[#1a232e] border border-[#66c0f4]/40 text-[#8ec8f6] text-[11px] px-3 py-1.5 rounded-lg text-center animate-in fade-in duration-200 shadow">
                  {stubMessage}
                </div>
              )}

            </div>

          </div>

          {/* Section 2: Full-width Thumbnails Carousel */}
          <div className="w-full bg-[#0d141d] border border-[#1b2838] rounded-lg p-2 flex items-center gap-2 shadow-inner">
            <button
              onClick={handlePrevImage}
              className="bg-[#16202c] hover:bg-[#1f2d3d] border border-[#233547] text-gray-400 hover:text-white p-2.5 rounded transition shrink-0"
              title={t('detail.prevPhoto')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex-1 flex gap-2 overflow-x-auto py-1 px-1 scroll-smooth">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative aspect-video h-16 rounded overflow-hidden border-2 transition shrink-0 bg-[#0a0f14] ${
                    activeImageIndex === idx
                      ? 'border-[#66c0f4] ring-2 ring-[#66c0f4]/40 scale-102'
                      : 'border-[#1f2d3d] opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <button
              onClick={handleNextImage}
              className="bg-[#16202c] hover:bg-[#1f2d3d] border border-[#233547] text-gray-400 hover:text-white p-2.5 rounded transition shrink-0"
              title={t('detail.nextPhoto')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Section 3 & 4: UNIFIED TAG / COLLECTION FIELD */}
          <div className="space-y-3 bg-[#121822] p-3.5 rounded-lg border border-[#26374a]">
            {/* Tab switch header: [ 🏷️ Теги (N) | 📁 Колекції (M) ] */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-[#1e2a38]">
              <div className="flex items-center bg-[#0d141b] border border-[#233547] rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('tags')}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 font-semibold text-xs cursor-pointer ${
                    activeTab === 'tags'
                      ? 'bg-[#2a475e] text-[#66c0f4] shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title={t('tags.title')}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{t('detail.tabs.tags', { count: activeTags.length })}</span>
                  {deactivatedSteamTagItems.length > 0 && (
                    <span className="text-[10px] text-gray-500 font-normal lowercase">
                      (+{deactivatedSteamTagItems.length})
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('collections')}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 font-semibold text-xs cursor-pointer ${
                    activeTab === 'collections'
                      ? 'bg-[#2a475e] text-[#66c0f4] shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title={t('collections.title')}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>{t('detail.tabs.collections', { count: modCollections.length })}</span>
                </button>
              </div>

              {activeTab === 'tags' ? (
                /* Action buttons: Clear all tags & Reset original tags */
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearAllTags();
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-medium transition border flex items-center gap-1 bg-[#1a1215] hover:bg-[#2d171b] text-[#ff6b6b] hover:text-[#ff8585] border-[#4a1f24] hover:border-[#66282e] cursor-pointer"
                    title={t('bulk.clearAllTags')}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t('bulk.clearAllTags')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetOriginalTags();
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-medium transition border flex items-center gap-1 bg-[#121c27] hover:bg-[#1a2d42] text-[#66c0f4] hover:text-[#99d6ff] border-[#22394f] hover:border-[#325373] cursor-pointer"
                    title={t('bulk.resetAllTags')}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t('bulk.resetAllTags')}</span>
                  </button>
                </div>
              ) : null}
            </div>

            {activeTab === 'tags' ? (
              <>
                {/* Tags Badges List (Active first, then Deactivated Steam tags) */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {allDisplayTags.map(({ tag, type, deactivated, isOriginal }, idx) => {
                    const isUser = type === 'user';
                    const isSteam = type === 'steam';
                    const isSelectedInFilter = isUser
                      ? (selectedUserTags && typeof selectedUserTags.has === 'function' ? selectedUserTags.has(tag) : false)
                      : (selectedSteamTags && typeof selectedSteamTags.has === 'function' ? selectedSteamTags.has(tag) : false);

                    // Styling rules:
                    let pillClass = '';
                    if (deactivated) {
                      pillClass = 'bg-[#11161d] text-[#8b949e] border border-[#30363d] line-through-none opacity-80';
                    } else if (isSelectedInFilter) {
                      pillClass = isUser
                        ? 'border-2 border-[#f49e42] bg-[#332211] text-[#ffd699] font-bold shadow-xs'
                        : 'border-2 border-[#66c0f4] bg-[#162738] text-[#cce8ff] font-bold shadow-xs';
                    } else {
                      pillClass = isUser
                        ? 'bg-[#1b1e24] text-[#f49e42] border border-[#4d3319] font-medium hover:border-[#f49e42]/60'
                        : 'bg-[#141e29] text-[#66c0f4] border border-[#233542] font-medium hover:border-[#66c0f4]/60';
                    }
                    const rawDisplayLabel = getTagDisplayPath(tag, type, tagPathMap);
                    const displayLabel = tTag(rawDisplayLabel);
                    const fullPath = tTag(getTagDisplayPath(tag, type, tagFullPathMap));

                    return (
                      <span
                        key={`${type}-${tag}-${deactivated ? 'deact' : 'act'}-${idx}`}
                        className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 transition select-none max-w-full ${pillClass}`}
                        title={fullPath}
                      >
                        <span className="truncate">{displayLabel}</span>

                        {/* Action buttons */}
                        {isUser && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleRemoveUserTag(tag);
                            }}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                            title={t('context.delete')}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}

                        {/* Manually added Steam tag: can be deleted completely */}
                        {isSteam && !isOriginal && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleRemoveSteamTag(tag);
                            }}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer ml-0.5"
                            title={t('context.delete')}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}

                        {/* Original Steam tag: can only be hidden/deactivated */}
                        {isSteam && isOriginal && !deactivated && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleDeactivateSteamTag(tag);
                            }}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer ml-0.5"
                          >
                            <EyeOff className="w-3 h-3" />
                          </button>
                        )}

                        {/* Original Steam tag (deactivated): can be reactivated */}
                        {isSteam && isOriginal && deactivated && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleReactivateSteamTag(tag);
                            }}
                            className="text-[#66c0f4] hover:text-white p-0.5 cursor-pointer ml-0.5"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    );
                  })}

                  {allDisplayTags.length === 0 && (
                    <span className="text-gray-500 text-xs py-1">{t('tags.noTags')}</span>
                  )}
                </div>

                {/* UNIFIED ADD TAG CONTROL */}
                <div className="pt-2 border-t border-[#1e2a38] space-y-2">
                  <form onSubmit={handleUnifiedAddTag} className="flex flex-wrap items-center gap-2">
                    {/* Input */}
                    <div className="relative flex-1 min-w-[220px] max-w-sm">
                      <input
                        type="text"
                        placeholder={t('detail.addTagPlaceholder')}
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        className="w-full bg-[#0b1016] border border-[#2a3c4f] focus:border-[#66c0f4] rounded px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!newTagInput.trim()}
                      className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                        newTagInput.trim()
                          ? safeAvailableSteamTags.some(st => typeof st === 'string' && st.toLowerCase() === newTagInput.trim().toLowerCase())
                            ? 'bg-[#2a475e] hover:bg-[#385c7a] text-white'
                            : 'bg-[#f49e42] hover:bg-[#e08b31] text-black'
                          : 'bg-[#1b2531] text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {t('detail.addTag')}
                    </button>
                  </form>

                  {/* Combined filtered suggestions (both Steam tags and User tags) */}
                  {combinedSuggestions.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 overflow-x-auto py-1">
                      {combinedSuggestions.slice(0, 10).map(({ tag, type }, idx) => {
                        const isSteam = type === 'steam';
                        const displayLabel = tTag(getTagDisplayPath(tag, type, tagPathMap));
                        const fullPath = tTag(getTagDisplayPath(tag, type, tagFullPathMap));
                        return (
                          <button
                            key={`sug-${type}-${tag}-${idx}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSteam) {
                                handleAssignSteamTag(tag);
                              } else {
                                handleAddUserTag(tag);
                              }
                            }}
                            className={`px-2 py-0.5 rounded-full text-[11px] shrink-0 transition border flex items-center gap-1 cursor-pointer max-w-[260px] truncate ${
                              isSteam
                                ? 'bg-[#121c27] hover:bg-[#1a2d42] text-[#8ec8f6] hover:text-white border-[#22394f]'
                                : 'bg-[#241c14] hover:bg-[#33271b] text-[#f4b366] hover:text-white border-[#47341e]'
                            }`}
                            title={`+ ${fullPath}`}
                          >
                            <span className="truncate">+ {displayLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* COLLECTIONS TAB CONTENT */
              <div className="space-y-3 pt-1">
                {/* Mod Collections Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  {modCollections.map(col => (
                    <span
                      key={`mod-col-${col.id}`}
                      className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-[#141e29] text-[#66c0f4] border border-[#233a52] font-medium shadow-xs select-none"
                    >
                      <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: col.color || '#66c0f4' }} />
                      <span className="truncate max-w-[200px]">{col.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRemoveFromCollection) onRemoveFromCollection(col.id, item.published_file_id);
                        }}
                        className="text-gray-400 hover:text-white p-0.5 cursor-pointer ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  {modCollections.length === 0 && (
                    <span className="text-gray-500 text-xs py-1">{t('collections.noCollections')}</span>
                  )}
                </div>

                {/* Add to collection dropdown & Quick create collection */}
                <div className="pt-2 border-t border-[#1e2a38] flex flex-wrap items-center gap-2">
                  {/* Select existing collection */}
                  <div className="relative flex-1 min-w-[220px] max-w-xs">
                    <select
                      value=""
                      onChange={(e) => {
                        const colId = Number(e.target.value);
                        if (colId && onAddToCollection) {
                          onAddToCollection(colId, item.published_file_id);
                        }
                      }}
                      disabled={availableToAddCollections.length === 0}
                      className="w-full bg-[#0b1016] border border-[#2a3c4f] focus:border-[#66c0f4] rounded px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>
                        {t('bulk.addToCollection')}
                      </option>
                      {availableToAddCollections.map(col => (
                        <option key={`opt-col-${col.id}`} value={col.id}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Create new collection with this mod */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
                    <input
                      type="text"
                      placeholder={t('collections.namePlaceholder')}
                      value={newColInput}
                      onChange={(e) => setNewColInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateColWithThisMod();
                        }
                      }}
                      className="flex-1 bg-[#0b1016] border border-[#2a3c4f] focus:border-[#a4d053] rounded px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={!newColInput.trim()}
                      onClick={handleCreateColWithThisMod}
                      className={`px-3 py-1 rounded font-semibold text-xs transition flex items-center gap-1 shrink-0 ${
                        newColInput.trim()
                          ? 'bg-[#1b4325] hover:bg-[#255c33] text-[#a4d053] border border-[#307541] cursor-pointer'
                          : 'bg-[#121920] text-gray-600 border border-[#1d2733] cursor-not-allowed'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('collections.create')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: DESCRIPTION */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-xs">
              <FileText className="w-3.5 h-3.5 text-[#66c0f4]" />
              <span>{t('detail.description')}</span>
            </div>
            <div className="bg-[#0b1016] border border-[#1b2838] rounded-lg p-4 text-xs text-[#b8c6d1] leading-relaxed font-sans max-h-64 overflow-y-auto">
              <SteamBBCode content={item.description} />
            </div>
          </div>

        </div>

        {/* Footer: 3 columns, each column has its 2 rows aligned via CSS Grid by number/value start */}
        <div className="px-6 py-3 bg-[#0d131b] border-t border-[#1b2838] text-xs text-[#8f98a0] shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3">
            {/* Column 1: ID мода & ID автора */}
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-2 min-w-0">
              <span className="text-[11px] text-[#8f98a0] whitespace-nowrap">{t('detail.publishedId')}</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-xs font-semibold text-[#66c0f4] bg-[#141d27] px-2 py-0.5 rounded border border-[#22394f] truncate">
                  {item.published_file_id}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(item.published_file_id, 'mod_id')}
                  title={t('detail.copyModId')}
                  className="text-gray-400 hover:text-white p-0.5 hover:bg-[#1f2d3d] rounded transition cursor-pointer shrink-0 flex items-center gap-1"
                >
                  {copiedField === 'mod_id' ? (
                    <span className="flex items-center gap-1 text-[10px] text-[#a4d053] font-sans font-medium px-1">
                      <Check className="w-3 h-3" />
                      <span>{t('detail.copied')}</span>
                    </span>
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400 hover:text-[#66c0f4]" />
                  )}
                </button>
              </div>

              <span className="text-[11px] text-[#8f98a0] whitespace-nowrap">{t('detail.authorId')}</span>
              <div className="flex items-center min-w-0">
                {authorProfileUrl ? (
                  <a
                    href={authorProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs font-semibold text-white hover:text-[#66c0f4] bg-[#141d27] px-2 py-0.5 rounded border border-[#22394f] hover:border-[#385d82] flex items-center gap-1 transition group truncate max-w-full"
                    title={item.creator ? `${t('detail.openSteam')} (ID: ${item.creator})` : t('detail.openSteam')}
                  >
                    <span className="truncate">{item.creator_name || item.creator || t('detail.notSpecified')}</span>
                    <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-[#66c0f4] shrink-0 transition" />
                  </a>
                ) : (
                  <span className="font-mono text-xs font-semibold text-white bg-[#141d27] px-2 py-0.5 rounded border border-[#22394f] truncate">
                    {item.creator_name || item.creator || t('detail.notSpecified')}
                  </span>
                )}
              </div>
            </div>

            {/* Column 2: Локальний розмір & Розмір у Steam */}
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-2 min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-[#8f98a0] whitespace-nowrap">
                <HardDrive className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                <span>{t('detail.localSize')}</span>
              </div>
              <span className="font-mono text-xs font-bold text-white truncate">
                {formatBytes(item.local_size_bytes || item.api_file_size)}
              </span>

              <div className="flex items-center gap-1.5 text-[11px] text-[#8f98a0] whitespace-nowrap">
                <Cloud className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                <span>{t('detail.steamSize')}</span>
              </div>
              <span className="font-mono text-xs font-bold text-white truncate">
                {formatBytes(item.api_file_size || item.local_size_bytes)}
              </span>
            </div>

            {/* Column 3: Дата створення & Останнє оновлення */}
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-2 min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-[#8f98a0] whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                <span>{t('detail.createdAt')}</span>
              </div>
              <span className="font-mono text-xs font-semibold text-white truncate">
                {formatDetailDate(item.time_created)}
              </span>

              <div className="flex items-center gap-1.5 text-[11px] text-[#8f98a0] whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                <span>{t('detail.updatedAt')}</span>
              </div>
              <span className="font-mono text-xs font-semibold text-white truncate">
                {formatDetailDate(item.time_updated || item.local_mtime)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
