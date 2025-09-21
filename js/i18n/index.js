import zhHant from './locales/zh-Hant.js';
import en from './locales/en.js';

const STORAGE_KEY = 'autofix_mermaid_locale';
const LOCALES = {
  'zh-Hant': zhHant,
  en,
};

const LOCALE_META = {
  'zh-Hant': { nameKey: 'locale.zh-Hant' },
  en: { nameKey: 'locale.en' },
};

let currentLocale = 'zh-Hant';
const listeners = new Set();

function resolveLocale(locale) {
  if (locale && LOCALES[locale]) {
    return locale;
  }
  if (typeof locale === 'string') {
    const normalized = locale.toLowerCase();
    const match = Object.keys(LOCALES).find(code => {
      const lower = code.toLowerCase();
      return normalized === lower || normalized.startsWith(lower);
    });
    if (match) return match;
  }
  return 'zh-Hant';
}

function getDictionary(locale = currentLocale) {
  return LOCALES[locale] || LOCALES['zh-Hant'];
}

function formatMessage(template, params = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(params, token)) {
      return String(params[token]);
    }
    return match;
  });
}

function t(key, params = {}) {
  if (!key) return '';
  const dictionary = getDictionary(currentLocale);
  const fallback = getDictionary('zh-Hant');
  const template = dictionary[key] ?? fallback[key] ?? key;
  if (typeof template !== 'string') {
    return key;
  }
  return formatMessage(template, params);
}

function applyDocumentTranslations(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (!key) return;
    element.textContent = t(key);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (!key) return;
    if ('placeholder' in element) {
      element.placeholder = t(key);
    }
  });
  root.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    if (!key) return;
    element.setAttribute('title', t(key));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    const key = element.getAttribute('data-i18n-aria-label');
    if (!key) return;
    element.setAttribute('aria-label', t(key));
  });
  root.querySelectorAll('option[data-i18n]').forEach(option => {
    const key = option.getAttribute('data-i18n');
    if (!key) return;
    option.textContent = t(key);
  });
}

function initI18n({ defaultLocale } = {}) {
  let initial = defaultLocale;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      initial = stored;
    }
  } catch (error) {
    console.warn('Unable to read stored locale:', error);
  }
  if (!initial && typeof navigator !== 'undefined') {
    initial = navigator.language || (Array.isArray(navigator.languages) ? navigator.languages[0] : '');
  }
  currentLocale = resolveLocale(initial);
  applyHtmlLang(currentLocale);
  return { locale: currentLocale };
}

function setLocale(locale) {
  const resolved = resolveLocale(locale);
  if (resolved === currentLocale) {
    return currentLocale;
  }
  currentLocale = resolved;
  try {
    localStorage.setItem(STORAGE_KEY, currentLocale);
  } catch (error) {
    console.warn('Unable to persist locale preference:', error);
  }
  applyHtmlLang(currentLocale);
  notifyListeners();
  return currentLocale;
}

function getLocale() {
  return currentLocale;
}

function getAvailableLocales() {
  return Object.keys(LOCALE_META).map(code => ({
    code,
    nameKey: LOCALE_META[code]?.nameKey || code,
  }));
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener(currentLocale);
    } catch (error) {
      console.error('i18n listener error:', error);
    }
  }
}

function onLocaleChange(listener) {
  if (typeof listener === 'function') {
    listeners.add(listener);
  }
  return () => listeners.delete(listener);
}

function applyHtmlLang(locale) {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = locale;
    }
  } catch {}
}

export {
  initI18n,
  applyDocumentTranslations as translateDocument,
  t,
  setLocale,
  getLocale,
  onLocaleChange,
  getAvailableLocales,
  resolveLocale,
};
