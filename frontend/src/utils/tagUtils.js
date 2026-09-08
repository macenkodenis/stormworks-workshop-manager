/**
 * Utilities for hierarchical tag display paths based on folder structure.
 */

/**
 * Builds a forward and reverse map of tag paths from the tag structure tree.
 * 
 * If a tag is nested inside folders:
 * - One folder: "ParentFolder/TagName"
 * - Two folders: "ParentFolder/SubFolder/TagName"
 * - N folders: "Folder1/Folder2/.../TagName"
 * 
 * Tags that are at the root level (not inside any folder) are NOT mapped,
 * so they retain their original name.
 */
export function buildTagPathMap(tree) {
  const tagPathMap = new Map();
  const reverseTagPathMap = new Map();

  if (!Array.isArray(tree) || tree.length === 0) {
    return { tagPathMap, reverseTagPathMap };
  }

  const traverse = (nodes, currentFolderNames = []) => {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
      if (!node) continue;

      if (node.type === 'group' && node.name) {
        const groupName = String(node.name).trim();
        if (groupName) {
          traverse(node.children || [], [...currentFolderNames, groupName]);
        }
      } else if (node.type === 'tag' && node.tag) {
        const tagName = String(node.tag).trim();
        if (tagName && currentFolderNames.length > 0) {
          // Tag is nested in one or more folders
          const fullPath = [...currentFolderNames, tagName].join('/');
          const typeKey = `${node.tagType || 'steam'}:${tagName}`;

          tagPathMap.set(typeKey, fullPath);
          if (!tagPathMap.has(tagName)) {
            tagPathMap.set(tagName, fullPath);
          }

          reverseTagPathMap.set(fullPath.toLowerCase(), tagName);
        }
      }
    }
  };

  traverse(tree);
  return { tagPathMap, reverseTagPathMap };
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
  return input.trim();
}

let measureSpan = null;
const tagWidthCache = new Map();

/**
 * Accurately measures the rendered width of a tag pill in pixels.
 * Uses a cached hidden DOM span with identical styling to ensure exact fit calculation.
 */
export function estimateTagWidth(text, isActive = false) {
  if (!text) return 0;
  const cacheKey = `${text}:${isActive ? 1 : 0}`;
  if (tagWidthCache.has(cacheKey)) {
    return tagWidthCache.get(cacheKey);
  }
  if (typeof document === 'undefined') return text.length * 8 + 16;

  if (!measureSpan) {
    measureSpan = document.createElement('span');
    measureSpan.style.position = 'absolute';
    measureSpan.style.visibility = 'hidden';
    measureSpan.style.whiteSpace = 'nowrap';
    measureSpan.style.top = '-9999px';
    measureSpan.style.left = '-9999px';
    measureSpan.style.pointerEvents = 'none';
    document.body.appendChild(measureSpan);
  }

  measureSpan.className = `text-xs whitespace-nowrap leading-tight select-none inline-block ${
    isActive
      ? 'border border-[#66c0f4] px-2 py-0.5 rounded-full font-semibold'
      : 'border border-[#233547]/50 px-1.5 py-0.5 rounded-md font-medium'
  }`;
  measureSpan.textContent = text;
  const width = Math.ceil(measureSpan.getBoundingClientRect().width);
  tagWidthCache.set(cacheKey, width);
  return width;
}

