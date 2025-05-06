import i18n from "i18next";
import {
  initReactI18next,
  useTranslation,
  I18nextProvider,
} from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "../locales/en-US.json";
import zh from "../locales/zh-CN.json";

const resources = {
  "en-US": {
    translation: en,
  },
  "zh-CN": {
    translation: zh,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en-US",
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

export { i18n, useTranslation, I18nextProvider };
