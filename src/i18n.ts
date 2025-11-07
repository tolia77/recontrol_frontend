import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Page-scoped translation resources (namespaces)
import help_en from 'src/locales/en/help.ts';
import help_uk from 'src/locales/uk/help.ts';
import common_en from 'src/locales/en/common.ts';
import common_uk from 'src/locales/uk/common.ts';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'uk'],
    ns: ['common', 'help'],
    defaultNS: 'common',
    resources: {
      en: { common: common_en, help: help_en },
      uk: { common: common_uk, help: help_uk },
    },
    detection: {
      // prefer query ?lng=uk, then localStorage, then browser language
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    // React options
    react: {
      useSuspense: false,
    },
  });

export default i18n;
