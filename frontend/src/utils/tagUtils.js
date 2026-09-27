/**
 * Utilities for hierarchical tag display paths based on folder structure.
 */
import { hasUnsupportedGlyphs } from './fontGlyphs';

/**
 * Determines whether a tree node represents a user/custom tag.
 * Steam tags have absolute priority: if the tag is known to be a Steam tag, returns false.
 */
export function isUserTagNode(node, knownSteamTags = null) {
  if (!node || node.type !== 'tag') return false;
  if (knownSteamTags && node.tag) {
    const tagName = String(node.tag).trim().toLowerCase();
    if (knownSteamTags.has ? knownSteamTags.has(tagName) : (Array.isArray(knownSteamTags) && knownSteamTags.includes(tagName))) {
      return false;
    }
  }
  const t = String(node.tagType || '').toLowerCase();
  return t === 'user' || t === 'custom';
}

/**
 * Ensures that no two tag nodes in a tree share the same tag name (case-insensitive).
 * Steam tags have absolute priority: if any occurrence is steam (or in knownSteamTags),
 * the resulting node is always marked as steam.
 */
export function deduplicateTagTree(tree, knownSteamTags = null) {
  if (!Array.isArray(tree)) return [];
  const seenTags = new Map(); // tagNameLower -> existingNode

  const isSteamCheck = (node) => {
    if (!node || node.type !== 'tag') return false;
    if (knownSteamTags && node.tag) {
      const tagName = String(node.tag).trim().toLowerCase();
      if (knownSteamTags.has ? knownSteamTags.has(tagName) : (Array.isArray(knownSteamTags) && knownSteamTags.includes(tagName))) {
        return true;
      }
    }
    return String(node.tagType || '').toLowerCase() === 'steam';
  };

  const processNodes = (nodes) => {
    if (!Array.isArray(nodes)) return [];
    const result = [];

    for (const rawNode of nodes) {
      if (!rawNode) continue;
      const node = { ...rawNode };

      if (node.type === 'tag' && node.tag) {
        if (isSteamCheck(node)) {
          node.tagType = 'steam';
        } else if (isUserTagNode(node, knownSteamTags)) {
          node.tagType = 'user';
        } else {
          node.tagType = 'steam';
        }

        const key = String(node.tag).trim().toLowerCase();
        if (seenTags.has(key)) {
          // Duplicate tag encountered! Merge with the existing node
          const existing = seenTags.get(key);
          // Steam tags have priority! If either is steam, the surviving node is steam
          if (existing.tagType === 'steam' || node.tagType === 'steam' || isSteamCheck(existing) || isSteamCheck(node)) {
            existing.tagType = 'steam';
          } else {
            existing.tagType = 'user';
          }
          if (Array.isArray(node.children) && node.children.length > 0) {
            existing.children = processNodes([...(existing.children || []), ...node.children]);
          }
          continue;
        } else {
          // First occurrence of this tag
          seenTags.set(key, node);
          if (Array.isArray(node.children) && node.children.length > 0) {
            node.children = processNodes(node.children);
          } else {
            node.children = [];
          }
          result.push(node);
        }
      } else {
        // Folder or other non-tag node
        if (Array.isArray(node.children) && node.children.length > 0) {
          node.children = processNodes(node.children);
        } else {
          node.children = [];
        }
        result.push(node);
      }
    }
    return result;
  };

  return processNodes(tree);
}

/**
 * Migrates local tree hierarchy into a new target tree.
 * If a tag existed in localTree and had child tags, those children will migrate WITH this tag
 * to its new position in targetTree, UNLESS those children have an explicit new location
 * specified anywhere in the targetTree.
 */
export function migrateTreeWithChildren(localTree, targetTree, knownSteamTags = null) {
  if (!Array.isArray(localTree) || localTree.length === 0) {
    return deduplicateTagTree(targetTree || [], knownSteamTags);
  }
  if (!Array.isArray(targetTree) || targetTree.length === 0) {
    return deduplicateTagTree(localTree, knownSteamTags);
  }

  // 1. Collect all tag/folder keys present ANYWHERE in the new targetTree
  const targetAllKeys = new Set();
  const collectTargetKeys = (nodes) => {
    (nodes || []).forEach(n => {
      if (n) {
        const key = n.type === 'folder'
          ? `folder:${String(n.name || '').trim().toLowerCase()}`
          : `tag:${String(n.tag || '').trim().toLowerCase()}`;
        targetAllKeys.add(key);
        if (Array.isArray(n.children)) {
          collectTargetKeys(n.children);
        }
      }
    });
  };
  collectTargetKeys(targetTree);

  // 2. Clone targetTree
  const resultTree = JSON.parse(JSON.stringify(targetTree));

  // 3. Build a map of targetTree nodes so we can find target parents by key
  const targetNodeMap = new Map();
  const indexTargetNodes = (nodes) => {
    (nodes || []).forEach(n => {
      if (n) {
        const key = n.type === 'folder'
          ? `folder:${String(n.name || '').trim().toLowerCase()}`
          : `tag:${String(n.tag || '').trim().toLowerCase()}`;
        targetNodeMap.set(key, n);
        if (Array.isArray(n.children)) {
          indexTargetNodes(n.children);
        }
      }
    });
  };
  indexTargetNodes(resultTree);

  // 4. Traverse localTree: if a node in localTree also exists in targetTree,
  // check each of its children: if the child is NOT placed anywhere in targetTree,
  // migrate it with its parent!
  const preserveLocalChildren = (localNodes) => {
    (localNodes || []).forEach(localNode => {
      if (!localNode) return;
      const key = localNode.type === 'folder'
        ? `folder:${String(localNode.name || '').trim().toLowerCase()}`
        : `tag:${String(localNode.tag || '').trim().toLowerCase()}`;

      const targetParent = targetNodeMap.get(key);

      if (targetParent && Array.isArray(localNode.children) && localNode.children.length > 0) {
        if (!Array.isArray(targetParent.children)) {
          targetParent.children = [];
        }

        localNode.children.forEach(localChild => {
          if (!localChild) return;
          const childKey = localChild.type === 'folder'
            ? `folder:${String(localChild.name || '').trim().toLowerCase()}`
            : `tag:${String(localChild.tag || '').trim().toLowerCase()}`;

          // If this child has NO new place anywhere in targetTree:
          if (!targetAllKeys.has(childKey)) {
            const clonedChild = JSON.parse(JSON.stringify(localChild));
            targetParent.children.push(clonedChild);
            targetAllKeys.add(childKey);
            targetNodeMap.set(childKey, clonedChild);
            indexTargetNodes([clonedChild]);
          }
        });
      }

      if (Array.isArray(localNode.children)) {
        preserveLocalChildren(localNode.children);
      }
    });
  };

  preserveLocalChildren(localTree);

  return deduplicateTagTree(resultTree, knownSteamTags);
}

/**
 * Deep recursive merge of two tag trees.
 * Strictly guarantees that no two nodes share the same tag name.
 * Steam tags have priority over custom tags.
 * The incoming packTree defines the authoritative placement for all tags present in packTree
 * (e.g. if packTree moves 'Small boat' under 'Ship', it moves to 'Ship' instead of staying in 'Sea').
 * Any local tags, branches, or unassigned child components not present in packTree are preserved.
 */
export function mergeTagTrees(localTree, packTree, knownSteamTags = null) {
  if (!Array.isArray(packTree) || packTree.length === 0) {
    return deduplicateTagTree(localTree || [], knownSteamTags);
  }
  if (!Array.isArray(localTree) || localTree.length === 0) {
    return deduplicateTagTree(packTree, knownSteamTags);
  }

  // 1. PackTree is the authoritative structure for all tags defined in packTree.
  // migrateTreeWithChildren places pack tags in pack locations and migrates local children whose parents exist in packTree.
  const baseResult = migrateTreeWithChildren(localTree, packTree, knownSteamTags);

  // 2. In Merge mode, also preserve ANY local nodes/branches that do NOT exist anywhere in baseResult:
  const allExistingKeys = new Set();
  const collectKeys = (nodes) => {
    (nodes || []).forEach(n => {
      if (n) {
        const key = n.type === 'folder'
          ? `folder:${String(n.name || '').trim().toLowerCase()}`
          : `tag:${String(n.tag || '').trim().toLowerCase()}`;
        allExistingKeys.add(key);
        if (Array.isArray(n.children)) collectKeys(n.children);
      }
    });
  };
  collectKeys(baseResult);

  const result = JSON.parse(JSON.stringify(baseResult));
  const preserveUnmatchedLocal = (localNodes) => {
    (localNodes || []).forEach(localNode => {
      if (!localNode) return;
      const key = localNode.type === 'folder'
        ? `folder:${String(localNode.name || '').trim().toLowerCase()}`
        : `tag:${String(localNode.tag || '').trim().toLowerCase()}`;

      if (!allExistingKeys.has(key)) {
        const cloned = JSON.parse(JSON.stringify(localNode));
        result.push(cloned);
        allExistingKeys.add(key);
        collectKeys([cloned]);
      } else if (Array.isArray(localNode.children)) {
        preserveUnmatchedLocal(localNode.children);
      }
    });
  };

  preserveUnmatchedLocal(localTree);

  return deduplicateTagTree(result, knownSteamTags);
}

/**
 * Automatically unrolls legacy { type: 'group' } folder nodes into plain tags.
 */
export function migrateLegacyTree(nodes) {
  if (!Array.isArray(nodes)) return [];
  const result = [];
  for (const node of nodes) {
    if (!node) continue;
    if (node.type === 'group') {
      // Unpack group children recursively
      const unpacked = migrateLegacyTree(node.children || []);
      result.push(...unpacked);
    } else {
      const children = Array.isArray(node.children) ? migrateLegacyTree(node.children) : [];
      result.push({
        ...node,
        type: 'tag',
        tagType: isUserTagNode(node) ? 'user' : (node.tagType || 'steam'),
        children
      });
    }
  }
  return deduplicateTagTree(result);
}

/**
 * Formats a hierarchical tag path with parent structure shortened with rounding up to ~14 characters
 * (taking into account the tag's own name).
 * 
 * Rules:
 * 1. The leaf tag is always shown in full at the end: ".../TagName".
 * 2. The immediate parent is ALWAYS included, even if total length exceeds 14 characters (guaranteed at least 1 level).
 * 3. Total character budget is 14 characters, including the tag name, immediate parent, and '/' separators.
 * 4. Starting from the immediate parent, we go up the ancestor chain and include higher
 *    ancestors as long as the total label length does not exceed 14 characters.
 * 5. If any higher ancestors were omitted because of the 14-character limit,
 *    a leading slash '/' is prepended to indicate that higher levels exist.
 * 
 * @param {string[]} ancestors - Array of ancestor tag names from root to immediate parent, e.g. ['Vehicle', 'Sea', 'Ship']
 * @param {string} tagName - The leaf tag name, e.g. 'Large boat'
 * @param {number} [budget=14] - Total character budget including tag name
 * @returns {{ shortPath: string, fullPath: string }}
 */
export function formatHierarchicalTagPath(ancestors, tagName, budget = 14) {
  const fullPath = [...ancestors, tagName].join('/');
  if (!Array.isArray(ancestors) || ancestors.length === 0) {
    return { shortPath: tagName, fullPath };
  }

  // Guaranteed at least 1 level: immediate parent
  const immediateParent = ancestors[ancestors.length - 1];
  const includedParents = [immediateParent];
  // Total length includes leaf tag name, separator '/', and immediate parent
  let currentLen = tagName.length + 1 + immediateParent.length;
  let omitted = false;

  // Try to include higher parents from immediate parent going backwards to root
  // as long as total length (including tag name) <= budget (14)
  for (let i = ancestors.length - 2; i >= 0; i--) {
    const parent = ancestors[i];
    const nextLen = currentLen + 1 + parent.length;
    if (nextLen <= budget) {
      includedParents.unshift(parent);
      currentLen = nextLen;
    } else {
      omitted = true;
      break;
    }
  }

  if (ancestors.length > includedParents.length) {
    omitted = true;
  }

  const parentStr = includedParents.join('/');
  const prefix = omitted ? `/${parentStr}` : parentStr;
  const shortPath = `${prefix}/${tagName}`;

  return { shortPath, fullPath };
}

/**
 * Builds a forward, full, and reverse map of tag paths from the tag structure tree.
 * 
 * - tagPathMap: Maps tag names to shortened display paths (with total label budgeted to ~14 chars)
 * - tagFullPathMap: Maps tag names to full unabbreviated paths
 * - reverseTagPathMap: Maps both full, shortened, and trimmed paths back to leaf tag names
 */
export function buildTagPathMap(tree, budget = 14) {
  const tagPathMap = new Map();
  const tagFullPathMap = new Map();
  const reverseTagPathMap = new Map();

  if (!Array.isArray(tree) || tree.length === 0) {
    return { tagPathMap, tagFullPathMap, reverseTagPathMap };
  }

  const traverse = (nodes, currentParentTagNames = []) => {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
      if (!node) continue;

      // Legacy fallback if group exists
      if (node.type === 'group' && node.name) {
        const groupName = String(node.name).trim();
        if (groupName) {
          traverse(node.children || [], [...currentParentTagNames, groupName]);
        }
        continue;
      }

      const tagName = String(node.tag || '').trim();
      if (!tagName) continue;

      if (currentParentTagNames.length > 0) {
        // Tag is nested under one or more parent tags
        const { shortPath, fullPath } = formatHierarchicalTagPath(currentParentTagNames, tagName, budget);
        const type = isUserTagNode(node) ? 'user' : 'steam';
        const typeKey = `${type}:${tagName}`;

        // Shortened display path for UI pills
        tagPathMap.set(typeKey, shortPath);
        tagPathMap.set(`user:${tagName}`, shortPath);
        tagPathMap.set(`steam:${tagName}`, shortPath);
        tagPathMap.set(`custom:${tagName}`, shortPath);
        tagPathMap.set(tagName, shortPath);

        // Full unabbreviated path for tooltips and deep search
        tagFullPathMap.set(typeKey, fullPath);
        tagFullPathMap.set(`user:${tagName}`, fullPath);
        tagFullPathMap.set(`steam:${tagName}`, fullPath);
        tagFullPathMap.set(`custom:${tagName}`, fullPath);
        tagFullPathMap.set(tagName, fullPath);

        // Reverse map resolves full path, short path, and short path without leading slash
        reverseTagPathMap.set(fullPath.toLowerCase(), tagName);
        reverseTagPathMap.set(shortPath.toLowerCase(), tagName);
        if (shortPath.startsWith('/')) {
          reverseTagPathMap.set(shortPath.slice(1).toLowerCase(), tagName);
        }
      }

      // If this tag has children, traverse them with this tag added to path
      if (Array.isArray(node.children) && node.children.length > 0) {
        traverse(node.children, [...currentParentTagNames, tagName]);
      }
    }
  };

  traverse(tree);
  return { tagPathMap, tagFullPathMap, reverseTagPathMap };
}

/**
 * Gets the hierarchical display path for a tag if it belongs to a folder.
 * 
 * @param {string} tag - Tag name
 * @param {'steam' | 'user'} [type] - Optional tag type ('steam' or 'user')
 * @param {Map<string, string>} [tagPathMap] - Lookup map from buildTagPathMap
 * @returns {string} The full display path (e.g. "Folder/Subfolder/Tag") or original tag name.
 */
export function getTagDisplayPath(tag, type, tagPathMap) {
  if (!tag) return '';
  const trimmed = typeof tag === 'string' ? tag.trim() : String(tag);
  if (!tagPathMap || !(tagPathMap instanceof Map)) {
    return trimmed;
  }

  if (type) {
    const typeKey = `${type}:${trimmed}`;
    if (tagPathMap.has(typeKey)) {
      return tagPathMap.get(typeKey);
    }
  }

  if (tagPathMap.has(trimmed)) {
    return tagPathMap.get(trimmed);
  }

  return trimmed;
}

/**
 * Resolves typed tag input: if user typed a full hierarchical path, resolves to raw tag name.
 */
export function resolveTagFromPath(input, reverseTagPathMap) {
  if (!input || typeof input !== 'string') return input;
  const key = input.trim().toLowerCase();
  if (reverseTagPathMap && reverseTagPathMap.has(key)) {
    return reverseTagPathMap.get(key);
  }
  if (key.startsWith('/') && reverseTagPathMap && reverseTagPathMap.has(key.slice(1))) {
    return reverseTagPathMap.get(key.slice(1));
  }
  if (key.includes('/')) {
    const parts = key.split('/').filter(p => p.trim());
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  return input.trim();
}

let measureCanvasCtx = null;
const tagWidthCache = new Map();
const descriptionCleanCache = new Map();

/**
 * Strips Steam BBCode, URLs, and excess whitespace from a description for card snippet display.
 * Results are cached in memory to avoid repeated regex passes across thousands of cards.
 */
export function cleanDescription(raw) {
  if (!raw) return '';
  const cached = descriptionCleanCache.get(raw);
  if (cached !== undefined) return cached;

  const slice = raw.length > 500 ? raw.slice(0, 500) : raw;
  const cleaned = slice
    .replace(/\[\/?(b|i|u|h[1-6]|url|quote|code|list|\*|table|tr|th|td|img|previewimg|strike|spoiler|noparse)[^\]]*\]/gi, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (descriptionCleanCache.size > 2500) {
    descriptionCleanCache.clear();
  }
  descriptionCleanCache.set(raw, cleaned);
  return cleaned;
}

/**
 * Accurately measures the rendered width of a tag pill in pixels.
 * Uses an offscreen Canvas 2D context to avoid forced DOM layout reflows,
 * with an in-memory cache for O(1) repeated lookups.
 */
export function estimateTagWidth(text, isActive = false) {
  if (!text) return 0;
  const cacheKey = `${text}:${isActive ? 1 : 0}`;
  const cached = tagWidthCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  if (typeof document === 'undefined') return text.length * 8 + 16;

  if (!measureCanvasCtx) {
    try {
      const canvas = document.createElement('canvas');
      measureCanvasCtx = canvas.getContext('2d');
    } catch {
      measureCanvasCtx = null;
    }
  }

  let textWidth;
  if (measureCanvasCtx) {
    measureCanvasCtx.font = isActive ? '600 12px sans-serif' : '500 12px sans-serif';
    textWidth = measureCanvasCtx.measureText(text).width;
  } else {
    textWidth = text.length * 7.5;
  }

  // Padding & borders: active pill px-2 (16px) + 2px = 18px; inactive pill px-1.5 (12px) + 2px = 14px
  const paddingBorder = isActive ? 18 : 14;
  const width = Math.ceil(textWidth + paddingBorder);
  tagWidthCache.set(cacheKey, width);
  return width;
}

const observerCallbacks = new WeakMap();
let sharedObserver = null;

function getSharedObserver() {
  if (!sharedObserver && typeof ResizeObserver !== 'undefined') {
    sharedObserver = new ResizeObserver((entries) => {
      if (typeof document !== 'undefined' && document.body.classList.contains('is-resizing')) {
        return;
      }
      for (const entry of entries) {
        const cb = observerCallbacks.get(entry.target);
        if (cb) {
          cb(entry);
        }
      }
    });
  }
  return sharedObserver;
}

/**
 * High-performance shared ResizeObserver for card containers.
 * Replaces 1000+ individual ResizeObserver instances with a single batched observer,
 * and automatically pauses during column resize dragging to prevent layout thrashing.
 */
export function observeElementResize(element, callback) {
  if (!element || typeof ResizeObserver === 'undefined') return () => {};
  const obs = getSharedObserver();
  if (!obs) return () => {};

  observerCallbacks.set(element, callback);
  obs.observe(element);
  return () => {
    obs.unobserve(element);
    observerCallbacks.delete(element);
  };
}

const visibilityCallbacks = new WeakMap();
let sharedIntersectionObserver = null;

function getIntersectionObserver() {
  if (!sharedIntersectionObserver && typeof IntersectionObserver !== 'undefined') {
    sharedIntersectionObserver = new IntersectionObserver((entries) => {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const cb = visibilityCallbacks.get(entry.target);
        if (cb) {
          cb(entry.isIntersecting, entry);
        }
      }
    }, {
      rootMargin: '300px 0px 300px 0px'
    });
  }
  return sharedIntersectionObserver;
}

/**
 * High-performance shared IntersectionObserver for card viewport visibility.
 * Defers expensive DOM operations, measurements, and resize observers until
 * the card is in or within 300px of the visible viewport.
 */
export function observeElementVisibility(element, callback) {
  if (!element || typeof IntersectionObserver === 'undefined') {
    callback(true);
    return () => {};
  }
  const obs = getIntersectionObserver();
  if (!obs) {
    callback(true);
    return () => {};
  }

  visibilityCallbacks.set(element, callback);
  obs.observe(element);
  return () => {
    obs.unobserve(element);
    visibilityCallbacks.delete(element);
  };
}

/**
 * Transliterates Cyrillic/Ukrainian text into Latin/English alphabet.
 * If input is already ASCII/Latin, returns the trimmed text unchanged.
 *
 * @param {string} text - Input text
 * @returns {string} Transliterated Latin text
 */
export function transliterate(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // If already pure ASCII, return as is
  if (/^[\x00-\x7F]*$/.test(trimmed)) {
    return trimmed;
  }

  const charMap = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'H', 'Ґ': 'G', 'Д': 'D', 'Е': 'E', 'Є': 'Ye',
    'Ж': 'Zh', 'З': 'Z', 'И': 'Y', 'І': 'I', 'Ї': 'Yi', 'Й': 'Y', 'К': 'K', 'Л': 'L',
    'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ю': 'Yu', 'Я': 'Ya',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
    'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ю': 'yu', 'я': 'ya',
    'Ь': '', 'ь': '', 'Ъ': '', 'ъ': '', '’': '', '\'': '', '`': '',
    'Ы': 'Y', 'ы': 'y', 'Э': 'E', 'э': 'e', 'Ё': 'Yo', 'ё': 'yo'
  };

  return trimmed
    .split('')
    .map(ch => charMap[ch] !== undefined ? charMap[ch] : ch)
    .join('')
    .trim();
}

/**
 * Resolves a tag display name following the strict user fallback hierarchy:
 * 
 * When translateTags === true:
 *   1. Active UI language translation (translations[lang])
 *   2. English translation (translations.en)
 *   3. Any other present language translation
 *   4. System tag name (tagName)
 * 
 * When translateTags === false:
 *   1. English translation (translations.en)
 *   2. Active UI language translation (translations[lang])
 *   3. Any other present language translation
 *   4. System tag name (tagName)
 * 
 * Linguistic Guard:
 * If a translation contains disallowed characters for its language, it cascades:
 * Active Lang -> Ukrainian -> English -> System Tag Name.
 */
export function resolveTagTranslation(tagName, {
  lang = 'ua',
  translateTags = false,
  customTranslations = {},
  systemTranslations = {}
} = {}) {
  if (!tagName) return '';
  const str = String(tagName).trim();
  if (!str) return '';

  // Support hierarchical paths (e.g. "/Sea/Ship" or "Sea/Ship")
  if (str.includes('/')) {
    const parts = str.split('/');
    return parts.map(part => {
      if (!part) return '';
      return resolveTagTranslation(part, { lang, translateTags, customTranslations, systemTranslations });
    }).join('/');
  }

  // Combine custom user translations (which have priority) and system translations
  const tagCustom = (customTranslations && customTranslations[str]) || {};
  const tagSystem = (systemTranslations && systemTranslations[str]) || {};
  const rawTrans = { ...tagSystem, ...tagCustom };

  // Filter out any translations containing disallowed characters for their language
  const trans = {};
  for (const [code, val] of Object.entries(rawTrans)) {
    if (typeof val === 'string' && val.trim()) {
      if (!hasUnsupportedGlyphs(val, code)) {
        trans[code] = val.trim();
      }
    }
  }

  if (!translateTags) {
    // 1. English translation
    if (trans.en && typeof trans.en === 'string' && trans.en.trim()) {
      return trans.en.trim();
    }
    // 2. Active UI language translation
    if (trans[lang] && typeof trans[lang] === 'string' && trans[lang].trim()) {
      return trans[lang].trim();
    }
    // 3. Any available language translation
    const anyVal = Object.values(trans).find(v => typeof v === 'string' && v.trim());
    if (anyVal) {
      return anyVal.trim();
    }
    // 4. System tag name
    return str;
  }

  // When translateTags is TRUE:
  // 1. Active UI language translation
  if (trans[lang] && typeof trans[lang] === 'string' && trans[lang].trim()) {
    return trans[lang].trim();
  }
  // 2. English translation fallback
  if (trans.en && typeof trans.en === 'string' && trans.en.trim()) {
    return trans.en.trim();
  }
  // 3. Any available language translation
  const anyVal = Object.values(trans).find(v => typeof v === 'string' && v.trim());
  if (anyVal) {
    return anyVal.trim();
  }
  // 4. System tag name fallback (e.g. if user deleted all translations)
  return str;
}

/**
 * Checks whether a tag matches a search query across ALL available languages,
 * translations, paths, and system names.
 *
 * @param {string} tagName - Tag identifier
 * @param {string} query - Search query
 * @param {Object} options
 * @param {Object} [options.customTranslations={}] - Custom tag translations
 * @param {Object} [options.systemTranslations={}] - System TAG_TRANSLATIONS
 * @param {string} [options.displayPath=''] - Short hierarchical display path
 * @param {string} [options.fullPath=''] - Full hierarchical display path
 * @returns {boolean} True if tag or any of its translations match the query
 */
export function matchesTagSearch(tagName, query, {
  customTranslations = {},
  systemTranslations = {},
  displayPath = '',
  fullPath = ''
} = {}) {
  if (!query) return true;
  const q = String(query).trim().toLowerCase();
  if (!q) return true;

  if (!tagName) return false;
  const rawTag = String(tagName).trim();

  // 1. Direct match on system tag name
  if (rawTag.toLowerCase().includes(q)) return true;

  // 2. Direct match on display paths if provided
  if (displayPath && String(displayPath).toLowerCase().includes(q)) return true;
  if (fullPath && String(fullPath).toLowerCase().includes(q)) return true;

  // 3. Collect all translation values from both system and custom dictionaries
  const tagSystem = (systemTranslations && systemTranslations[rawTag]) || {};
  const tagCustom = (customTranslations && customTranslations[rawTag]) || {};
  const allTrans = { ...tagSystem, ...tagCustom };

  for (const val of Object.values(allTrans)) {
    if (typeof val === 'string' && val.trim().toLowerCase().includes(q)) {
      return true;
    }
  }

  // 4. Also check translations of path segments if path contains '/'
  const pathToTest = fullPath || displayPath;
  if (pathToTest && pathToTest.includes('/')) {
    const segments = pathToTest.split('/').filter(Boolean);
    for (const seg of segments) {
      if (seg.toLowerCase().includes(q)) return true;
      const segSys = (systemTranslations && systemTranslations[seg]) || {};
      const segCust = (customTranslations && customTranslations[seg]) || {};
      const segAll = { ...segSys, ...segCust };
      for (const val of Object.values(segAll)) {
        if (typeof val === 'string' && val.trim().toLowerCase().includes(q)) {
          return true;
        }
      }
    }
  }

  return false;
}




