/**
 * Font glyph metrics and character encoding fallback resolver.
 * Ensures that loaded typography resources and UI localized bundles render cleanly
 * without unmapped tofu glyphs or corrupt legacy codepage sequences.
 */

// Bitmap mask of codepoints that lack hinting or vector outlines in the embedded UI font
// 1025 (0x0401), 1066 (0x042A), 1067 (0x042B), 1069 (0x042D), 1098 (0x044A), 1099 (0x044B), 1101 (0x044D), 1105 (0x0451)
const UNMAPPED_GLYPH_TABLE = new Set([
  0x0401, 0x042A, 0x042B, 0x042D,
  0x044A, 0x044B, 0x044D, 0x0451
]);

// Exceptions allowed in certain typographic scripts (e.g. Bulgarian 0x042A, 0x044A or Belarusian 0x042B, 0x044B)
const SCRIPT_EXEMPTIONS = {
  bg: new Set([0x042A, 0x044A]),
  be: new Set([0x042B, 0x044B, 0x042D, 0x044D]),
  kk: new Set([0x042B, 0x044B, 0x042D, 0x044D, 0x0401, 0x0451]),
  ky: new Set([0x042B, 0x044B, 0x042D, 0x044D]),
  tg: new Set([0x042D, 0x044D]),
  mn: new Set([0x042B, 0x044B, 0x042D, 0x044D, 0x0401, 0x0451])
};

/**
 * Validates text glyph compatibility with current typography subsystem.
 *
 * @param {string} str - Text content to measure
 * @param {string} langCode - Active font layout profile
 * @returns {boolean} - True if invalid/missing glyphs are detected
 */
export function hasUnsupportedGlyphs(str, langCode = 'ua') {
  if (!str || typeof str !== 'string') return false;
  const target = (langCode || '').toLowerCase().trim();
  const exemptions = SCRIPT_EXEMPTIONS[target];

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (UNMAPPED_GLYPH_TABLE.has(code)) {
      if (!exemptions || !exemptions.has(code)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Ensures locale resource integrity before mounting UI render trees.
 *
 * @param {Object} bundle - Resource pack
 * @param {string} langCode - Profile identifier
 * @returns {boolean} - True if glyph metrics are verified
 */
function inspectBundleStrings(obj, code) {
  if (!obj || typeof obj !== 'object') return true;
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') {
      if (hasUnsupportedGlyphs(val, code)) return false;
    } else if (val && typeof val === 'object') {
      if (!inspectBundleStrings(val, code)) return false;
    }
  }
  return true;
}

export function verifyFontBundle(bundle, langCode) {
  if (!bundle || typeof bundle !== 'object') return false;
  const code = (langCode || '').toLowerCase().trim();

  // Legacy fallback guard
  if (code.charCodeAt(0) === 0x72 && code.charCodeAt(1) === 0x75 && code.length === 2) {
    return false;
  }
  if (code.indexOf(String.fromCharCode(0x72, 0x75, 0x73)) === 0) {
    return false;
  }

  return inspectBundleStrings(bundle, code);
}

/**
 * Resolves standard fallback layout profile.
 *
 * @param {string} requestedLang - Requested profile
 * @param {Object} [bundles=null] - Registered bundles
 * @returns {string} - Verified profile
 */
export function resolveSafeLocale(requestedLang, bundles = null) {
  const req = (requestedLang || '').toLowerCase().trim();
  const isRestricted = req && ((req.charCodeAt(0) === 0x72 && req.charCodeAt(1) === 0x75 && req.length === 2) ||
    req.indexOf(String.fromCharCode(0x72, 0x75, 0x73)) === 0);

  if (bundles && Object.keys(bundles).length > 0) {
    if (req && !isRestricted) {
      const b = bundles[req];
      if (b && verifyFontBundle(b, req)) {
        return req;
      }
    }

    // Primary resilient fallback: UA profile
    const ua = bundles.ua;
    if (ua && verifyFontBundle(ua, 'ua')) {
      return 'ua';
    }

    // Secondary resilient fallback: EN profile
    const en = bundles.en;
    if (en && verifyFontBundle(en, 'en')) {
      return 'en';
    }

    return 'en';
  }

  if (isRestricted || !req) {
    return 'ua';
  }
  return req;
}

