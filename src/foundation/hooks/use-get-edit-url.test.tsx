import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Module mocks ---

let mockResourceId: string | undefined = undefined;
const mockGenerateEditUrl = vi.fn(
  (resource: string, id: string, meta?: any) =>
    `/resources/${resource}/edit/${id}`,
);

vi.mock("@refinedev/core", () => ({
  useNavigation: () => ({ editUrl: mockGenerateEditUrl }),
  useResource: (resource: string) => ({
    id: mockResourceId,
    resource: { name: resource },
  }),
}));

// --- Helpers ---

async function editUrlHook(resource: string, recordItemId: string, meta?: any) {
  const { useGetEditUrl } = await import("./use-get-edit-url");
  return renderHook(() => useGetEditUrl(resource, recordItemId, meta));
}

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();
  mockResourceId = undefined;
});

// --- Tests ---

describe("useGetEditUrl", () => {
  describe("url generation", () => {
    it("generates edit URL from resource and recordItemId", async () => {
      const { result } = await editUrlHook("clusters", "my-cluster");

      expect(mockGenerateEditUrl).toHaveBeenCalledWith(
        "clusters",
        "my-cluster",
        undefined,
      );
      expect(result.current.url).toBe("/resources/clusters/edit/my-cluster");
    });

    it("passes meta to generateEditUrl", async () => {
      const meta = { workspace: "ws-1" };
      await editUrlHook("endpoints", "ep-1", meta);

      expect(mockGenerateEditUrl).toHaveBeenCalledWith(
        "endpoints",
        "ep-1",
        meta,
      );
    });

    it("falls back to useResource id when recordItemId is nullish", async () => {
      mockResourceId = "fallback-id";
      const { result } = await editUrlHook(
        "clusters",
        undefined as unknown as string,
      );

      expect(result.current.url).toBe("/resources/clusters/edit/fallback-id");
    });

    it("returns empty URL when resource is empty", async () => {
      const { result } = await editUrlHook("", "some-id");

      expect(result.current.url).toBe("");
      expect(mockGenerateEditUrl).not.toHaveBeenCalled();
    });
  });
});
