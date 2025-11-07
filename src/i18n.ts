import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Page-scoped translation resources (namespaces)
import help_en from 'src/locales/en/help.ts';
import help_uk from 'src/locales/uk/help.ts';
import common_en from 'src/locales/en/common.ts';
import common_uk from 'src/locales/uk/common.ts';
import index_en from 'src/locales/en/index.ts';
import index_uk from 'src/locales/uk/index.ts';
import auth_en from 'src/locales/en/auth.ts';
import auth_uk from 'src/locales/uk/auth.ts';
import devices_en from 'src/locales/en/devices.ts';
import devices_uk from 'src/locales/uk/devices.ts';
import deviceSettings_en from 'src/locales/en/deviceSettings.ts';
import deviceSettings_uk from 'src/locales/uk/deviceSettings.ts';
import deviceControl_en from 'src/locales/en/deviceControl.ts';
import deviceControl_uk from 'src/locales/uk/deviceControl.ts';
import userSettings_en from 'src/locales/en/userSettings.ts';
import userSettings_uk from 'src/locales/uk/userSettings.ts';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'uk'],
    ns: ['common', 'help', 'index', 'auth', 'devices', 'deviceSettings', 'deviceControl', 'userSettings'],
    defaultNS: 'common',
    resources: {
      en: { common: common_en, help: help_en, index: index_en, auth: auth_en, devices: devices_en, deviceSettings: deviceSettings_en, deviceControl: deviceControl_en, userSettings: userSettings_en },
      uk: { common: common_uk, help: help_uk, index: index_uk, auth: auth_uk, devices: devices_uk, deviceSettings: deviceSettings_uk, deviceControl: deviceControl_uk, userSettings: userSettings_uk },
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

// Side-effect module: no export
