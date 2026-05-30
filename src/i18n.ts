import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Page-scoped translation resources (namespaces)
import { help } from "src/locales/en/help.ts";
import { help as help_uk } from "src/locales/uk/help.ts";
import { common } from "src/locales/en/common.ts";
import { common as common_uk } from "src/locales/uk/common.ts";
import { indexPage } from "src/locales/en/index.ts";
import { indexPage as indexPage_uk } from "src/locales/uk/index.ts";
import { auth } from "src/locales/en/auth.ts";
import { auth as auth_uk } from "src/locales/uk/auth.ts";
import { devices } from "src/locales/en/devices.ts";
import { devices as devices_uk } from "src/locales/uk/devices.ts";
import { deviceSettings } from "src/locales/en/deviceSettings.ts";
import { deviceSettings as deviceSettings_uk } from "src/locales/uk/deviceSettings.ts";
import { deviceControl } from "src/locales/en/deviceControl.ts";
import { deviceControl as deviceControl_uk } from "src/locales/uk/deviceControl.ts";
import { fileManager } from "src/locales/en/fileManager.ts";
import { fileManager as fileManager_uk } from "src/locales/uk/fileManager.ts";
import { userSettings } from "src/locales/en/userSettings.ts";
import { userSettings as userSettings_uk } from "src/locales/uk/userSettings.ts";
import { adminUsers } from "src/locales/en/adminUsers.ts";
import { adminUsers as adminUsers_uk } from "src/locales/uk/adminUsers.ts";
import { clipboard } from "src/locales/en/clipboard.ts";
import { clipboard as clipboard_uk } from "src/locales/uk/clipboard.ts";
import { assistant } from "src/locales/en/assistant.ts";
import { assistant as assistant_uk } from "src/locales/uk/assistant.ts";
import { scenarios } from "src/locales/en/scenarios.ts";
import { scenarios as scenarios_uk } from "src/locales/uk/scenarios.ts";
import { subscription, subscription_uk } from "src/locales/subscription.ts";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "uk"],
    ns: [
      "common",
      "help",
      "index",
      "auth",
      "devices",
      "deviceSettings",
      "deviceControl",
      "fileManager",
      "userSettings",
      "adminUsers",
      "clipboard",
      "assistant",
      "scenarios",
      "subscription",
    ],
    defaultNS: "common",
    resources: {
      en: {
        common,
        help,
        index: indexPage,
        auth,
        devices,
        deviceSettings,
        deviceControl,
        fileManager,
        userSettings,
        adminUsers,
        clipboard,
        assistant,
        scenarios,
        subscription,
      },
      uk: {
        common: common_uk,
        help: help_uk,
        index: indexPage_uk,
        auth: auth_uk,
        devices: devices_uk,
        deviceSettings: deviceSettings_uk,
        deviceControl: deviceControl_uk,
        fileManager: fileManager_uk,
        userSettings: userSettings_uk,
        adminUsers: adminUsers_uk,
        clipboard: clipboard_uk,
        assistant: assistant_uk,
        scenarios: scenarios_uk,
        subscription: subscription_uk,
      },
    },
    detection: {
      // prefer query ?lng=uk, then localStorage, then browser language
      order: ["querystring", "localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
    // React options
    react: {
      useSuspense: false,
    },
  });

export { i18n };
