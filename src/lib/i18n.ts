import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './locales/vi.json';
import en from './locales/en.json';

const STORAGE_KEY = 'dw_language';

const savedLanguage = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'vi';
  } catch {
    return 'vi';
  }
})();

i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: savedLanguage,
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
});

export const changeLanguage = (lang: 'vi' | 'en') => {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore storage errors (e.g. privacy mode)
  }
};

export default i18n;
