import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import english from "@/locales/en-US.json";

describe("endpoint log translations", () => {
  it.each(["en-US", "zh-CN"])(
    "resolves shipped controls, aria labels and previous errors with fallback for %s",
    async (language) => {
      const i18n = createInstance();
      await i18n.init({
        lng: language,
        resources: { "en-US": { translation: english } },
        fallbackLng: "en-US",
        interpolation: { escapeValue: false },
      });
      const keys = [
        "common.fields.replica",
        "endpoints.logs.container",
        "endpoints.logs.inference",
        "endpoints.logs.modelDownloader",
        "endpoints.logs.containerRun",
        "endpoints.logs.current",
        "endpoints.logs.previous",
        "endpoints.logs.previousUnavailable",
        "endpoints.logs.loadError",
        "endpoints.logs.httpError",
        "endpoints.logs.unreadableResponse",
        "endpoints.logs.unknownError",
        "components.logViewer.downloadFailed",
        "components.logViewer.clearTimeFilters",
        "components.logViewer.search",
      ];
      for (const key of keys) {
        expect(i18n.exists(key)).toBe(true);
        expect(i18n.t(key)).not.toBe(key);
      }
      expect(i18n.t("endpoints.logs.inference")).toBe("inference");
      expect(i18n.t("endpoints.logs.modelDownloader")).toBe("model downloader");
      expect(i18n.t("endpoints.logs.previousUnavailable")).toContain(
        "LastContainer",
      );
      expect(i18n.t("endpoints.logs.previousUnavailable")).toContain(
        "Switch to Current",
      );
      expect(i18n.t("endpoints.logs.httpError", { status: 404 })).toContain(
        "404",
      );
    },
  );
});
