/**
 * Universal Supported Languages Registry
 * Officially supported Steam Workshop languages (28 languages).
 * Any 'ru'/'russian' entry is silently redirected/rolled back to 'ua'.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'ua', name: 'Українська', steamLang: 'ukrainian' },
  { code: 'en', name: 'English', steamLang: 'english' },
  { code: 'de', name: 'Deutsch', steamLang: 'german' },
  { code: 'fr', name: 'Français', steamLang: 'french' },
  { code: 'it', name: 'Italiano', steamLang: 'italian' },
  { code: 'es', name: 'Español (España)', steamLang: 'spanish' },
  { code: 'latam', name: 'Español (Latinoamérica)', steamLang: 'latam' },
  { code: 'pl', name: 'Polski', steamLang: 'polish' },
  { code: 'pt', name: 'Português', steamLang: 'portuguese' },
  { code: 'pt-br', name: 'Português (Brasil)', steamLang: 'brazilian' },
  { code: 'cs', name: 'Čeština', steamLang: 'czech' },
  { code: 'da', name: 'Dansk', steamLang: 'danish' },
  { code: 'nl', name: 'Nederlands', steamLang: 'dutch' },
  { code: 'fi', name: 'Suomi', steamLang: 'finnish' },
  { code: 'el', name: 'Ελληνικά', steamLang: 'greek' },
  { code: 'hu', name: 'Magyar', steamLang: 'hungarian' },
  { code: 'ja', name: '日本語', steamLang: 'japanese' },
  { code: 'ko', name: '한국어', steamLang: 'korean' },
  { code: 'no', name: 'Norsk', steamLang: 'norwegian' },
  { code: 'ro', name: 'Română', steamLang: 'romanian' },
  { code: 'zh-cn', name: '简体中文', steamLang: 'schinese' },
  { code: 'zh-tw', name: '繁體中文', steamLang: 'tchinese' },
  { code: 'sv', name: 'Svenska', steamLang: 'swedish' },
  { code: 'th', name: 'ไทย', steamLang: 'thai' },
  { code: 'tr', name: 'Türkçe', steamLang: 'turkish' },
  { code: 'bg', name: 'Български', steamLang: 'bulgarian' },
  { code: 'vi', name: 'Tiếng Việt', steamLang: 'vietnamese' },
  { code: 'id', name: 'Bahasa Indonesia', steamLang: 'indonesian' }
];

export const DEFAULT_LANGUAGE = 'ua';

export function isLanguageSupported(code) {
  if (!code || typeof code !== 'string') return false;
  const c = code.trim().toLowerCase();
  if (c === 'ru' || c === 'russian') return false;
  return SUPPORTED_LANGUAGES.some(l => l.code === c);
}

export function getLanguageConfig(code) {
  if (!code) return SUPPORTED_LANGUAGES[0];
  const c = code.trim().toLowerCase();
  if (c === 'ru' || c === 'russian') return SUPPORTED_LANGUAGES[0];
  const found = SUPPORTED_LANGUAGES.find(l => l.code === c);
  return found || SUPPORTED_LANGUAGES[0];
}
