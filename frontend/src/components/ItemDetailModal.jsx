import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  HardDrive,
  Cloud,
  Calendar,
  User,
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
  CircleDashed
} from 'lucide-react';

export function ItemDetailModal({
  item,
  onClose,
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
  selectedUserTags = new Set()
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [galleryImages, setGalleryImages] = useState([]);
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
    setStubMessage(nextState ? 'Мод відключено' : 'Мод підключено');
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
    setStubMessage(nextState ? 'Відписано від моду' : 'Підписку відновлено');
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
    setStubMessage(nextState ? 'Статус змінено: Відсортовано' : 'Статус змінено: Не відсортовано');
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
  }, [item]);

  if (!item) return null;

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (unixTs) => {
    if (!unixTs) return '—';
    const d = new Date(unixTs * 1000);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${hh}:${min} ${dd}.${mm}.${yy}`;
  };

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
    const trimmed = (tagToAdd || newTagInput).trim();
    if (!trimmed) return;
    setNewTagInput('');
    // Duplicate check: avoid duplicate user tags (case-insensitive)
    const alreadyExists = safeUserTags.some(t => t.toLowerCase() === trimmed.toLowerCase());
    if (!alreadyExists) {
      const updated = [...safeUserTags, trimmed];
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

  // Clear all tags (delete user tags, deactivate all steam tags)
  const handleClearAllTags = () => {
    setUserTags([]);
    setIsSorted(false);
    setDeactivatedSteamTags([...safeSteamTags]);
    if (onClearItemTags) {
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
    const val = newTagInput.trim();
    if (!val) return;

    // Check if entered value is a full match to any available Steam tag
    const matchedSteamTag = safeAvailableSteamTags.find(
      st => typeof st === 'string' && st.toLowerCase() === val.toLowerCase()
    );

    if (matchedSteamTag) {
      handleAssignSteamTag(matchedSteamTag);
    } else {
      handleAddUserTag(val);
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
    .filter(t => !searchFilter || t.toLowerCase().includes(searchFilter))
    .map(t => ({ tag: t, type: 'steam' }));

  // User suggestions: available user tags that are not currently on this item
  const filteredUserSuggestions = safeAvailableUserTags
    .filter(t => typeof t === 'string' && !safeUserTags.includes(t))
    .filter(t => !searchFilter || t.toLowerCase().includes(searchFilter))
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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#101721] border border-[#1e2c3d] rounded-xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-[#1b2838] flex items-center justify-between bg-[#121922]">
          <div className="flex items-center gap-3 truncate mr-4">
            <h2 className="text-base font-bold text-white truncate" title={item.title}>
              {item.title}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onClose}
              className="text-[#8f98a0] hover:text-white p-1 rounded transition cursor-pointer"
              title="Закрити (Esc)"
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
                    title="Відкрити повне зображення"
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
                    <span className="text-[10px] text-[#8f98a0] block">Статус</span>
                    <strong className={`text-xs font-semibold truncate block ${
                      isUnsubscribed
                        ? 'text-[#ff6b6b]'
                        : isDisabled
                        ? 'text-[#f49e42]'
                        : 'text-[#a4d053]'
                    }`}>
                      {isUnsubscribed ? 'Видалений' : isDisabled ? 'Відключений' : 'Активний'}
                    </strong>
                  </div>
                </div>

                {/* 2. Organization Indicator (styled analogous to Status) */}
                <button
                  type="button"
                  onClick={handleToggleSorted}
                  title={isSorted ? 'Натисніть, щоб змінити на "Не відсортовано"' : 'Натисніть, щоб змінити на "Відсортовано"'}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0d141d]/60 hover:bg-[#15202c] border border-[#1a2533] hover:border-[#2d4358] transition cursor-pointer text-left select-none group"
                >
                  {isSorted ? (
                    <CheckCircle2 className="w-4 h-4 text-[#a4d053] shrink-0 group-hover:scale-105 transition" />
                  ) : (
                    <CircleDashed className="w-4 h-4 text-[#f49e42] shrink-0 group-hover:scale-105 transition" />
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] text-[#8f98a0] block group-hover:text-gray-300 transition">Організація</span>
                    <strong className={`text-xs font-semibold truncate block ${
                      isSorted ? 'text-[#a4d053]' : 'text-[#f49e42]'
                    }`}>
                      {isSorted ? 'Відсортовано' : 'Не відсортовано'}
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
                  title={isFavorited ? 'Видалити з обраного' : 'Додати в обране'}
                  className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition shadow text-xs cursor-pointer active:scale-98 border ${
                    isFavorited
                      ? 'bg-[#3d3215] hover:bg-[#4d3f1a] text-[#f6be3c] border-[#8a6b20]'
                      : 'bg-[#182330] hover:bg-[#223245] text-gray-300 hover:text-white border-[#2b3e52]'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-[#f6be3c] text-[#f6be3c]' : 'text-gray-400'}`} />
                  <span>{isFavorited ? 'В обраному' : 'Додати в обране'}</span>
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
                  <span>Відкрити в Steam Workshop</span>
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
                    title={isDisabled ? 'Підключити мод назад' : 'Відключити мод'}
                  >
                    {isDisabled ? (
                      <>
                        <Power className="w-3.5 h-3.5 shrink-0 text-[#a4d053]" />
                        <span className="truncate">Підключити</span>
                      </>
                    ) : (
                      <>
                        <PowerOff className="w-3.5 h-3.5 shrink-0 text-[#f49e42]" />
                        <span className="truncate">Відключити</span>
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
                    title={isUnsubscribed ? 'Підписатися назад на цей мод' : 'Відписатися від моду'}
                  >
                    {isUnsubscribed ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#66c0f4]" />
                        <span className="truncate">Підписатися</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 shrink-0 text-[#ff6b6b]" />
                        <span className="truncate">Відписатися</span>
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
              title="Попереднє фото"
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
              title="Наступне фото"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Section 3 & 4: UNIFIED TAG FIELD (Steam + User tags) */}
          <div className="space-y-3 bg-[#121822] p-3.5 rounded-lg border border-[#26374a]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-xs">
                <Tag className="w-3.5 h-3.5 text-[#66c0f4]" />
                <span>Теги мода ({activeTags.length})</span>
                {deactivatedSteamTagItems.length > 0 && (
                  <span className="text-[11px] text-gray-500 font-normal lowercase">
                    (+{deactivatedSteamTagItems.length} деактивовано)
                  </span>
                )}
              </div>

              {/* Action buttons: Clear all tags & Reset original tags */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearAllTags}
                  className="px-2 py-0.5 rounded text-[11px] font-medium transition border flex items-center gap-1 bg-[#1a1215] hover:bg-[#2d171b] text-[#ff6b6b] hover:text-[#ff8585] border-[#4a1f24] hover:border-[#66282e] cursor-pointer"
                  title="Видалити користувацькі та деактивувати всі Steam-теги"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Видалити всі теги</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetOriginalTags}
                  className="px-2 py-0.5 rounded text-[11px] font-medium transition border flex items-center gap-1 bg-[#121c27] hover:bg-[#1a2d42] text-[#66c0f4] hover:text-[#99d6ff] border-[#22394f] hover:border-[#325373] cursor-pointer"
                  title="Повернути початкові теги зі Steam та статус «не відсортовано»"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Повернути оригінальні теги</span>
                </button>
              </div>
            </div>

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
                    : 'bg-[#141e29] text-[#66c0f4] border border-[#233a52] font-medium hover:border-[#66c0f4]/60';
                }

                return (
                  <span
                    key={`${type}-${tag}-${deactivated ? 'deact' : 'act'}-${idx}`}
                    className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 transition select-none ${pillClass}`}
                  >
                    <span>{tag}</span>

                    {/* Action buttons */}
                    {isUser && (
                      <button
                        type="button"
                        onClick={() => handleRemoveUserTag(tag)}
                        className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                        title="Видалити користувацький тег"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}

                    {/* Manually added Steam tag: can be deleted completely */}
                    {isSteam && !isOriginal && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSteamTag(tag)}
                        className="text-gray-400 hover:text-white p-0.5 cursor-pointer ml-0.5"
                        title="Видалити доданий вручну Steam-тег"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}

                    {/* Original Steam tag: can only be hidden/deactivated */}
                    {isSteam && isOriginal && !deactivated && (
                      <button
                        type="button"
                        onClick={() => handleDeactivateSteamTag(tag)}
                        className="text-gray-400 hover:text-white p-0.5 cursor-pointer ml-0.5"
                        title="Приховати цей Steam-тег для цього моду"
                      >
                        <EyeOff className="w-3 h-3" />
                      </button>
                    )}

                    {/* Original Steam tag (deactivated): can be reactivated */}
                    {isSteam && isOriginal && deactivated && (
                      <button
                        type="button"
                        onClick={() => handleReactivateSteamTag(tag)}
                        className="text-[#66c0f4] hover:text-white p-0.5 cursor-pointer ml-0.5"
                        title="Повернути показ Steam-тегу"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}

              {allDisplayTags.length === 0 && (
                <span className="text-gray-500 text-xs py-1">Немає тегів</span>
              )}
            </div>

            {/* UNIFIED ADD TAG CONTROL */}
            <div className="pt-2 border-t border-[#1e2a38] space-y-2">
              <form onSubmit={handleUnifiedAddTag} className="flex flex-wrap items-center gap-2">
                {/* Input */}
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <input
                    type="text"
                    placeholder="Введіть назву тегу для додавання..."
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
                  title={
                    newTagInput.trim() && safeAvailableSteamTags.some(st => typeof st === 'string' && st.toLowerCase() === newTagInput.trim().toLowerCase())
                      ? 'Буде призначено/активовано як Steam-тег'
                      : 'Буде додано як власний тег'
                  }
                >
                  + Додати тег
                </button>
              </form>

              {/* Combined filtered suggestions (both Steam tags and User tags) */}
              {combinedSuggestions.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 overflow-x-auto py-1">
                  <span className="shrink-0 text-[10px] text-gray-500">
                    {newTagInput.trim() ? 'Знайдені підказки:' : 'Рекомендовані теги:'}
                  </span>
                  {combinedSuggestions.slice(0, 10).map(({ tag, type }, idx) => {
                    const isSteam = type === 'steam';
                    return (
                      <button
                        key={`sug-${type}-${tag}-${idx}`}
                        type="button"
                        onClick={() => {
                          if (isSteam) {
                            handleAssignSteamTag(tag);
                          } else {
                            handleAddUserTag(tag);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-full text-[11px] shrink-0 transition border flex items-center gap-1 cursor-pointer ${
                          isSteam
                            ? 'bg-[#121c27] hover:bg-[#1a2d42] text-[#8ec8f6] hover:text-white border-[#22394f]'
                            : 'bg-[#241c14] hover:bg-[#33271b] text-[#f4b366] hover:text-white border-[#47341e]'
                        }`}
                        title={`+ ${tag}`}
                      >
                        <span>+ {tag}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Section 5: DESCRIPTION */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-xs">
              <FileText className="w-3.5 h-3.5 text-[#66c0f4]" />
              <span>ОПИС ЗІ STEAM WORKSHOP</span>
            </div>
            <div className="bg-[#0b1016] border border-[#1b2838] rounded-lg p-4 text-xs text-[#b8c6d1] leading-relaxed whitespace-pre-line font-sans max-h-48 overflow-y-auto">
              {item.description || 'Опис відсутній.'}
            </div>
          </div>

        </div>

        {/* Footer: 2 rows with all item metadata */}
        <div className="px-6 py-3 bg-[#0d131b] border-t border-[#1b2838] text-xs text-[#8f98a0]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2.5">
            {/* Column 1, Row 1: ID мода */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8f98a0]">ID мода:</span>
              <span className="font-mono text-xs font-semibold text-[#66c0f4] bg-[#141d27] px-2.5 py-0.5 rounded border border-[#22394f]">
                {item.published_file_id}
              </span>
            </div>

            {/* Column 2, Row 1: Локальний розмір */}
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
              <span className="text-[11px] text-[#8f98a0]">Локальний розмір:</span>
              <span className="font-mono text-xs font-bold text-white">
                {formatBytes(item.local_size_bytes || item.api_file_size)}
              </span>
            </div>

            {/* Column 3, Row 1: Дата створення */}
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
              <span className="text-[11px] text-[#8f98a0]">Дата створення:</span>
              <span className="font-mono text-xs font-semibold text-white">
                {formatDate(item.time_created)}
              </span>
            </div>

            {/* Column 1, Row 2: ID автора */}
            <div className="flex items-center gap-2 truncate">
              <span className="text-[11px] text-[#8f98a0] shrink-0">ID автора:</span>
              {authorProfileUrl ? (
                <a
                  href={authorProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs font-semibold text-white hover:text-[#66c0f4] bg-[#141d27] px-2 py-0.5 rounded border border-[#22394f] hover:border-[#385d82] flex items-center gap-1 transition group truncate"
                  title="Відкрити профіль автора в Steam"
                >
                  <span className="truncate">{item.creator || 'Не вказано'}</span>
                  <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-[#66c0f4] shrink-0 transition" />
                </a>
              ) : (
                <span className="font-mono text-xs font-semibold text-white bg-[#141d27] px-2 py-0.5 rounded border border-[#22394f] truncate">
                  {item.creator || 'Не вказано'}
                </span>
              )}
            </div>

            {/* Column 2, Row 2: Розмір у Steam */}
            <div className="flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
              <span className="text-[11px] text-[#8f98a0]">Розмір у Steam:</span>
              <span className="font-mono text-xs font-bold text-white">
                {formatBytes(item.api_file_size || item.local_size_bytes)}
              </span>
            </div>

            {/* Column 3, Row 2: Останнє оновлення */}
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
              <span className="text-[11px] text-[#8f98a0]">Останнє оновлення:</span>
              <span className="font-mono text-xs font-semibold text-white">
                {formatDate(item.time_updated || item.local_mtime)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
