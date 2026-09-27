/**
 * Stormworks Workshop Manager Translations
 * Dynamically discovers all locale JSON files in ./locales/
 * Verifies font glyph compatibility and locale structure.
 */
import { verifyFontBundle } from '../utils/fontGlyphs';

const localeModules = import.meta.glob('./locales/*.json', { eager: true });

// Registered valid locale bundles
export const LOCALES = {};

for (const [path, mod] of Object.entries(localeModules)) {
  const match = path.match(/\/([^/]+)\.json$/);
  if (match) {
    const code = match[1].toLowerCase();
    const data = mod.default || mod;
    if (verifyFontBundle(data, code)) {
      LOCALES[code] = data;
    }
  }
}

// UI Translations dictionary: { ua: { ... }, en: { ... }, ... }
export const UI_TRANSLATIONS = {};
for (const [code, bundle] of Object.entries(LOCALES)) {
  UI_TRANSLATIONS[code] = bundle.ui || {};
}

// Build unified TAG_TRANSLATIONS dictionary: { 'TagName': { ua: '...', en: '...', ... } }
export const TAG_TRANSLATIONS = {};

const allTagKeys = new Set();
for (const bundle of Object.values(LOCALES)) {
  if (bundle.tags && typeof bundle.tags === 'object') {
    Object.keys(bundle.tags).forEach(tag => allTagKeys.add(tag));
  }
}

allTagKeys.forEach(tag => {
  TAG_TRANSLATIONS[tag] = {};
  for (const [code, bundle] of Object.entries(LOCALES)) {
    if (bundle.tags && bundle.tags[tag]) {
      TAG_TRANSLATIONS[tag][code] = bundle.tags[tag];
    }
  }
});
