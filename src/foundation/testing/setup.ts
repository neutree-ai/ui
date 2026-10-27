import { beforeEach, vi } from "vitest";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { resetRefineForm } from "./refine-form";

// Global test environment. Everything here applies to every test file, so a
// test only declares what is specific to it. See contributing/unit-test.md.

// i18n: components render translation keys instead of English copy, so
// assertions stay stable when wording changes. Interpolation values are
// appended after a colon (`key:a,b`); a string fallback argument is ignored.
// A test that needs other output declares its own vi.mock for the module.
const t = (key: string, ...args: unknown[]) => {
  const values = args.find(
    (arg): arg is Record<string, unknown> =>
      typeof arg === "object" && arg !== null,
  );
  const shown = Object.entries(values ?? {})
    .filter(([name]) => name !== "defaultValue")
    .map(([, value]) => String(value));
  return shown.length ? `${key}:${shown.join(",")}` : key;
};
const useTranslation = () => ({ t, i18n: { resolvedLanguage: "en-US" } });

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation,
}));

vi.mock("@/foundation/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/foundation/lib/i18n")>()),
  useTranslation,
}));

// Refine forms run on plain react-hook-form; see ./refine-form.
vi.mock("@refinedev/react-hook-form", () => import("./refine-form"));

// jsdom has no layout, so nothing ever measures as clipped. A test that needs
// a clipped element says so: vi.mocked(useIsTruncated).mockReturnValue(true).
vi.mock("@/foundation/hooks/use-is-truncated", () => ({
  useIsTruncated: vi.fn(() => false),
}));

beforeEach(() => {
  resetRefineForm();
  vi.mocked(useIsTruncated).mockReset().mockReturnValue(false);
});

// jsdom lacks the layout APIs Radix and cmdk call.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
