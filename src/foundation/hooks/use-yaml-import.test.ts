import type { YamlResource } from "@/foundation/lib/yaml-transform";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Module mocks ---

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockParseYamlDocuments = vi.fn<(content: string) => YamlResource[]>();
const mockIsValidYamlResource = vi.fn<(doc: unknown) => boolean>();
const mockKindToResourceType = vi.fn<(kind: string) => string>();
const mockTransformResourceForImport =
  vi.fn<(resource: YamlResource, ws: string) => Record<string, unknown>>();

vi.mock("@/foundation/lib/yaml-transform", () => ({
  parseYamlDocuments: (...args: unknown[]) =>
    mockParseYamlDocuments(...(args as [string])),
  isValidYamlResource: (...args: unknown[]) =>
    mockIsValidYamlResource(...(args as [unknown])),
  kindToResourceType: (...args: unknown[]) =>
    mockKindToResourceType(...(args as [string])),
  transformResourceForImport: (...args: unknown[]) =>
    mockTransformResourceForImport(...(args as [YamlResource, string])),
}));

const mockMutateAsync = vi.fn();
const mockGetOne = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutateAsync: mockMutateAsync }),
  useDataProvider: () => () => ({ getOne: mockGetOne }),
  useResource: () => ({
    resources: [
      { name: "clusters", meta: { workspaced: true } },
      { name: "endpoints", meta: { workspaced: true } },
      { name: "workspaces", meta: { workspaced: false } },
    ],
  }),
}));

vi.mock("./use-workspace", () => ({
  useWorkspace: () => ({ current: "test-ws" }),
}));

// --- Helpers ---

function makeResource(
  overrides?: Partial<Omit<YamlResource, "metadata">> & {
    metadata?: Partial<YamlResource["metadata"]>;
  },
): YamlResource {
  const defaults: YamlResource = {
    apiVersion: "v1",
    kind: "Cluster",
    metadata: {
      name: "my-cluster",
      workspace: "",
      creation_timestamp: "",
      update_timestamp: "",
      deletion_timestamp: null,
      labels: {},
      annotations: {},
    },
    spec: { replicas: 3 },
  };
  return {
    ...defaults,
    ...overrides,
    metadata: { ...defaults.metadata, ...overrides?.metadata },
  };
}

async function importHook() {
  const { useYamlImport } = await import("./use-yaml-import");
  return renderHook(() => useYamlImport());
}

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();

  const resource = makeResource();
  mockParseYamlDocuments.mockReturnValue([resource]);
  mockIsValidYamlResource.mockReturnValue(true);
  mockKindToResourceType.mockReturnValue("clusters");
  mockTransformResourceForImport.mockReturnValue({
    api_version: "v1",
    kind: "Cluster",
    metadata: { name: "my-cluster", workspace: "test-ws", labels: {} },
    spec: { replicas: 3 },
  });
  mockGetOne.mockRejectedValue(new Error("not found"));
  mockMutateAsync.mockResolvedValue({ data: {} });
});

// --- Tests ---

describe("useYamlImport", () => {
  describe("importFromYaml", () => {
    it("creates a new resource when it does not exist", async () => {
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: "clusters",
          values: expect.objectContaining({ api_version: "v1" }),
          meta: expect.objectContaining({ idColumnName: "metadata->name" }),
        }),
      );
      expect(result.current.progress.results).toHaveLength(1);
      expect(result.current.progress.results[0]).toMatchObject({
        success: true,
        skipped: false,
      });
    });

    it("skips an existing resource", async () => {
      mockGetOne.mockResolvedValue({ data: { id: 1 } });
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(result.current.progress.results[0]).toMatchObject({
        success: true,
        skipped: true,
      });
    });

    it("includes workspace meta for workspace-scoped resources", async () => {
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            workspace: "test-ws",
            workspaced: true,
          }),
        }),
      );
    });

    it("excludes workspace meta for non-workspace-scoped resources", async () => {
      mockKindToResourceType.mockReturnValue("workspaces");
      const resource = makeResource({ kind: "Workspace" });
      mockParseYamlDocuments.mockReturnValue([resource]);
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      const callMeta = mockMutateAsync.mock.calls[0][0].meta;
      expect(callMeta.workspace).toBeUndefined();
      expect(callMeta.workspaced).toBeUndefined();
      expect(callMeta.idColumnName).toBe("metadata->name");
    });

    it("falls back to currentWorkspace when resource has no workspace", async () => {
      const resource = makeResource({ metadata: { workspace: "" } });
      mockParseYamlDocuments.mockReturnValue([resource]);
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      // getOne should have been called with test-ws (the currentWorkspace)
      expect(mockGetOne).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ workspace: "test-ws" }),
        }),
      );
    });

    it("uses workspace from YAML when present", async () => {
      const resource = makeResource({ metadata: { workspace: "yaml-ws" } });
      mockParseYamlDocuments.mockReturnValue([resource]);
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(mockGetOne).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ workspace: "yaml-ws" }),
        }),
      );
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ workspace: "yaml-ws" }),
        }),
      );
    });

    it("records error when creation fails with message", async () => {
      mockMutateAsync.mockRejectedValue({ message: "conflict" });
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(result.current.progress.results[0]).toMatchObject({
        success: false,
        error: "conflict",
      });
    });

    it("falls back to i18n key when error has no message", async () => {
      mockMutateAsync.mockRejectedValue("some string error");
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(result.current.progress.results[0]).toMatchObject({
        success: false,
        error: "components.yamlImport.errors.unknownError",
      });
    });

    it("filters out invalid resources", async () => {
      mockIsValidYamlResource.mockReturnValue(false);
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(result.current.progress.total).toBe(0);
      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(mockGetOne).not.toHaveBeenCalled();
    });

    it("handles multiple resources with mixed results", async () => {
      const resources = [
        makeResource({ metadata: { name: "r1" } }),
        makeResource({ metadata: { name: "r2" } }),
        makeResource({ metadata: { name: "r3" } }),
      ];
      mockParseYamlDocuments.mockReturnValue(resources);

      // r1 exists, r2 creates ok, r3 fails
      mockGetOne
        .mockResolvedValueOnce({ data: { id: 1 } }) // r1 exists
        .mockRejectedValueOnce(new Error("not found")) // r2 does not exist
        .mockRejectedValueOnce(new Error("not found")); // r3 does not exist
      mockMutateAsync
        .mockResolvedValueOnce({ data: {} }) // r2 created
        .mockRejectedValueOnce({ message: "quota exceeded" }); // r3 fails

      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(result.current.progress.completed).toBe(3);
      expect(result.current.progress.results).toHaveLength(3);
      expect(result.current.progress.results[0]).toMatchObject({
        resourceName: "r1",
        skipped: true,
      });
      expect(result.current.progress.results[1]).toMatchObject({
        resourceName: "r2",
        success: true,
        skipped: false,
      });
      expect(result.current.progress.results[2]).toMatchObject({
        resourceName: "r3",
        success: false,
        error: "quota exceeded",
      });
    });

    it("sets progress state correctly after completion", async () => {
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(result.current.isImporting).toBe(false);
      expect(result.current.progress.completed).toBe(
        result.current.progress.total,
      );
      expect(result.current.progress.results).toHaveLength(
        result.current.progress.total,
      );
    });

    it("sets isImporting to false when parse throws", async () => {
      mockParseYamlDocuments.mockImplementation(() => {
        throw new Error("bad yaml");
      });
      const { result } = await importHook();

      await act(() => result.current.importFromYaml("yaml-content"));

      expect(result.current.isImporting).toBe(false);
    });
  });

  describe("importFromFile", () => {
    it("delegates to importFromYaml with file content", async () => {
      const file = new File(["file-yaml-content"], "test.yaml", {
        type: "text/yaml",
      });
      file.text = vi.fn().mockResolvedValue("file-yaml-content");
      const { result } = await importHook();

      await act(() => result.current.importFromFile(file));

      expect(mockParseYamlDocuments).toHaveBeenCalledWith("file-yaml-content");
    });

    it("records error when file read fails", async () => {
      const file = new File([""], "bad.yaml");
      file.text = vi.fn().mockRejectedValue(new Error("read error"));
      const { result } = await importHook();

      await act(() => result.current.importFromFile(file));

      expect(result.current.progress.results).toHaveLength(1);
      expect(result.current.progress.results[0]).toMatchObject({
        resourceType: "file",
        success: false,
        error: "read error",
      });
      expect(result.current.isImporting).toBe(false);
    });
  });

  describe("importFromUrl", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve("url-yaml-content"),
        }),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fetches URL and delegates to importFromYaml", async () => {
      const { result } = await importHook();

      await act(() =>
        result.current.importFromUrl("https://example.com/file.yaml"),
      );

      expect(fetch).toHaveBeenCalledWith("https://example.com/file.yaml", {
        method: "GET",
        headers: {
          Accept: "application/x-yaml, text/yaml, text/plain, */*",
        },
      });
      expect(mockParseYamlDocuments).toHaveBeenCalledWith("url-yaml-content");
    });

    it("adds https:// prefix when protocol is missing", async () => {
      const { result } = await importHook();

      await act(() => result.current.importFromUrl("example.com/file.yaml"));

      expect(fetch).toHaveBeenCalledWith(
        "https://example.com/file.yaml",
        expect.any(Object),
      );
    });

    it("records error when fetch response is not ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      );
      const { result } = await importHook();

      await act(() =>
        result.current.importFromUrl("https://example.com/missing.yaml"),
      );

      expect(result.current.progress.results).toHaveLength(1);
      expect(result.current.progress.results[0]).toMatchObject({
        resourceType: "url",
        success: false,
      });
      expect(result.current.isImporting).toBe(false);
    });
  });

  describe("resetProgress", () => {
    it("resets progress to initial state", async () => {
      const { result } = await importHook();

      // Import first to populate progress
      await act(() => result.current.importFromYaml("yaml-content"));
      expect(result.current.progress.results.length).toBeGreaterThan(0);

      // Reset
      act(() => result.current.resetProgress());

      expect(result.current.progress).toEqual({
        total: 0,
        completed: 0,
        results: [],
      });
    });
  });
});
