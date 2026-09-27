import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { UI_TRANSLATIONS, TAG_TRANSLATIONS, LOCALES } from './translations';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, isLanguageSupported } from './languages';
import { resolveSafeLocale, hasUnsupportedGlyphs } from '../utils/fontGlyphs';
import { resolveTagTranslation } from '../utils/tagUtils';

export const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  // Current language initialized with safe typography resolution
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('sw_ui_language') || DEFAULT_LANGUAGE;
    return resolveSafeLocale(saved, LOCALES);
  });

  // Translate tags checkbox state: default false
  const [translateTags, setTranslateTags] = useState(() => {
    const saved = localStorage.getItem('sw_ui_translate_tags');
    return saved === 'true'; // default false
  });

  // Custom user tag translations loaded from rules or created dynamically
  const [customTagTranslations, setCustomTagTranslations] = useState({});

  // Load custom tag translations from backend classifier rules on mount
  useEffect(() => {
    fetch('/api/classifier/rules')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          const extracted = {};
          Object.entries(data).forEach(([tag, rule]) => {
            if (rule && typeof rule === 'object' && rule.translations && typeof rule.translations === 'object') {
              extracted[tag] = rule.translations;
            }
          });
          setCustomTagTranslations(prev => ({ ...extracted, ...prev }));
        }
      })
      .catch(err => console.warn('Failed to fetch classifier tag translations:', err));
  }, []);

  const updateTagTranslations = useCallback((tagName, translations) => {
    if (!tagName) return;
    setCustomTagTranslations(prev => ({
      ...prev,
      [tagName]: {
        ...(prev[tagName] || {}),
        ...(translations || {})
      }
    }));
  }, []);

  // Persist language dynamically with silent typography fallback
  const changeLanguage = useCallback((newLang) => {
    const safeLang = resolveSafeLocale(newLang, LOCALES);
    setLang(safeLang);
    localStorage.setItem('sw_ui_language', safeLang);
  }, []);

  // Persist translateTags
  const changeTranslateTags = useCallback((val) => {
    const boolVal = Boolean(val);
    setTranslateTags(boolVal);
    localStorage.setItem('sw_ui_translate_tags', String(boolVal));
  }, []);

  /**
   * Pre-resolve UI dictionary once when language changes.
   * Eliminates character-by-character glyph scanning on every t() call during rendering.
   */
  const resolvedDictionary = useMemo(() => {
    const currentDict = UI_TRANSLATIONS[lang] || {};
    const uaDict = UI_TRANSLATIONS.ua || {};
    const enDict = UI_TRANSLATIONS.en || {};

    const resolved = {};
    const allKeys = new Set([
      ...Object.keys(currentDict),
      ...Object.keys(uaDict),
      ...Object.keys(enDict)
    ]);

    for (const key of allKeys) {
      let text = null;
      if (currentDict[key] && typeof currentDict[key] === 'string' && currentDict[key].trim()) {
        if (!hasUnsupportedGlyphs(currentDict[key], lang)) {
          text = currentDict[key].trim();
        }
      }
      if (!text && uaDict[key] && typeof uaDict[key] === 'string' && uaDict[key].trim()) {
        if (!hasUnsupportedGlyphs(uaDict[key], 'ua')) {
          text = uaDict[key].trim();
        }
      }
      if (!text && enDict[key] && typeof enDict[key] === 'string' && enDict[key].trim()) {
        if (!hasUnsupportedGlyphs(enDict[key], 'en')) {
          text = enDict[key].trim();
        }
      }
      resolved[key] = text || key;
    }
    return resolved;
  }, [lang]);

  /**
   * Translate UI string by key with O(1) dictionary lookup and optional variable substitution.
   */
  const t = useCallback((key, params = null) => {
    let text = resolvedDictionary[key] || key;
    if (params && typeof text === 'string') {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return text;
  }, [resolvedDictionary]);

  /**
   * Translate tag name following the strict user fallback hierarchy:
   * 
   * When translateTags === true:
   *   1. Selected UI language (lang)
   *   2. English (en)
   *   3. Any other available language
   *   4. System tag name
   * 
   * When translateTags === false:
   *   1. English (en)
   *   2. Selected UI language (lang)
   *   3. Any other available language
   *   4. System tag name
   */
  const tTag = useCallback((tagName, extraRuleTranslations = null) => {
    if (!tagName) return '';
    const dynamicCustom = extraRuleTranslations
      ? { ...customTagTranslations, [tagName]: { ...(customTagTranslations[tagName] || {}), ...extraRuleTranslations } }
      : customTagTranslations;

    return resolveTagTranslation(tagName, {
      lang,
      translateTags,
      customTranslations: dynamicCustom,
      systemTranslations: TAG_TRANSLATIONS
    });
  }, [lang, translateTags, customTagTranslations]);

  const value = useMemo(() => ({
    lang,
    setLang: changeLanguage,
    translateTags,
    setTranslateTags: changeTranslateTags,
    t,
    tTag,
    customTagTranslations,
    setCustomTagTranslations,
    updateTagTranslations
  }), [lang, translateTags, customTagTranslations, t, tTag, changeLanguage, changeTranslateTags, updateTagTranslations]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
