import { beforeEach, describe, expect, it } from "vitest";
import {
  AVAILABLE_LOCALES,
  i18n,
  resolveSupportedLocale,
  syncDocumentLanguage,
} from "./i18n";

describe("resolveSupportedLocale", () => {
  it("keeps a locale that this build ships", () => {
    expect(resolveSupportedLocale("en-US")).toBe("en-US");
  });

  it("falls back for a locale the detector returns but we do not ship", () => {
    expect(resolveSupportedLocale("fr")).toBe("en-US");
  });

  it("falls back when the locale is missing", () => {
    expect(resolveSupportedLocale(undefined)).toBe("en-US");
  });
});

describe("syncDocumentLanguage", () => {
  beforeEach(() => {
    document.documentElement.lang = "en";
  });

  it("writes the resolved locale onto the root element", () => {
    syncDocumentLanguage("en-US");
    expect(document.documentElement.lang).toBe("en-US");
  });

  it("never writes an unsupported detector value", () => {
    syncDocumentLanguage("xx-YY");
    expect(AVAILABLE_LOCALES).toContain(document.documentElement.lang);
  });
});

describe("i18n language changes", () => {
  it("syncs the root element on init", () => {
    expect(document.documentElement.lang).toBe(
      i18n.resolvedLanguage ?? "en-US",
    );
  });

  it("syncs the root element on every switch", async () => {
    document.documentElement.lang = "en";

    await i18n.changeLanguage("en-US");
    expect(document.documentElement.lang).toBe("en-US");

    // A locale that is not bundled must not leak into the root element.
    await i18n.changeLanguage("zh-CN");
    expect(AVAILABLE_LOCALES).toContain(document.documentElement.lang);

    await i18n.changeLanguage("en-US");
    expect(document.documentElement.lang).toBe("en-US");
  });
});
