import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Module mocks ---

let mockListData: { data: any[] } | undefined = undefined;

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    data: mockListData,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// --- Helpers ---

function makeOemConfig(spec: Record<string, unknown>) {
  return { spec };
}

async function oemConfigHook() {
  const { useOemConfig } = await import("./use-oem-config");
  return renderHook(() => useOemConfig());
}

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockListData = undefined;
});

// --- Tests ---

describe("useOemConfig", () => {
  describe("brandName fallback chain", () => {
    it("returns spec brand_name when present", async () => {
      mockListData = { data: [makeOemConfig({ brand_name: "Acme Corp" })] };
      const { result } = await oemConfigHook();

      expect(result.current.brandName).toBe("Acme Corp");
    });

    it("falls back to VITE_BRAND_NAME when spec brand_name is null", async () => {
      mockListData = { data: [makeOemConfig({ brand_name: null })] };
      vi.stubEnv("VITE_BRAND_NAME", "EnvBrand");
      const { result } = await oemConfigHook();

      expect(result.current.brandName).toBe("EnvBrand");
    });

    it("falls back to Neutree when both spec and env are absent", async () => {
      mockListData = { data: [makeOemConfig({ brand_name: null })] };
      const { result } = await oemConfigHook();

      expect(result.current.brandName).toBe("Neutree");
    });

    it("falls back to Neutree when no oem config returned", async () => {
      mockListData = { data: [] };
      const { result } = await oemConfigHook();

      expect(result.current.brandName).toBe("Neutree");
    });
  });
});
