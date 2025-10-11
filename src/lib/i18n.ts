import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {
  I18nextProvider,
  initReactI18next,
  useTranslation,
} from "react-i18next";

// Dynamically import all locale files from the locales directory
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../locales/*.json",
  { eager: true },
);

// Build resources object from available locale files
const resources = Object.entries(localeModules).reduce(
  (acc, [path, module]) => {
    // Extract locale code from path: ../locales/en-US.json -> en-US
    const locale = path.match(/\.\.\/locales\/(.+)\.json$/)?.[1];
    if (locale) {
      acc[locale] = { translation: module.default };
    }
    return acc;
  },
  {} as Record<string, { translation: Record<string, unknown> }>,
);

// Export available locales for components to use
export const AVAILABLE_LOCALES = Object.keys(resources);

// Build locale labels from each language file's nativeName field
export const LOCALE_LABELS = AVAILABLE_LOCALES.reduce(
  (acc, locale) => {
    const translation = resources[locale]?.translation;
    // Read nativeName from the translation file, fallback to locale code
    acc[locale] = (translation?.nativeName as string) || locale;
    return acc;
  },
  {} as Record<string, string>,
);

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
