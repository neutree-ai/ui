import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {
  I18nextProvider,
  initReactI18next,
  useTranslation,
} from "react-i18next";

// Dynamically import all locale files from the locales directory
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../../locales/*.json",
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

const FALLBACK_LOCALE = "en-US";

// The detector may return a locale this build does not ship (e.g. "fr" from the
// browser, or a stale value in localStorage). Only ever write a locale we have
// resources for, so document.documentElement.lang matches the rendered text.
export function resolveSupportedLocale(locale?: string): string {
  if (locale && AVAILABLE_LOCALES.includes(locale)) {
    return locale;
  }
  return AVAILABLE_LOCALES.includes(FALLBACK_LOCALE)
    ? FALLBACK_LOCALE
    : (AVAILABLE_LOCALES[0] ?? FALLBACK_LOCALE);
}

export function syncDocumentLanguage(locale?: string) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.lang = resolveSupportedLocale(locale);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: FALLBACK_LOCALE,
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// index.html ships a static lang="en"; keep it in sync with the resolved
// language on boot and on every switch so screen readers and browser
// translation tools see the language the page is actually rendered in.
syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);
i18n.on("languageChanged", (locale) =>
  syncDocumentLanguage(i18n.resolvedLanguage ?? locale),
);

export { I18nextProvider, i18n, useTranslation };
