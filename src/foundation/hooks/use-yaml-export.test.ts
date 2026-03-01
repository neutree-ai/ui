import type {
  ExportOptions,
  ResourceEntity,
} from "@/foundation/lib/yaml-transform";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_WORKSPACES } from "./use-workspace";
import { EXPORTABLE_RESOURCES } from "./use-yaml-export";

// --- Module mocks ---

const stableT = (key: string) => key;

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: stableT }),
}));

const mockTransformEntityForExport =
  vi.fn<
    (entity: ResourceEntity, options: ExportOptions) => Record<string, unknown>
  >();
const mockSerializeToYaml =
  vi.fn<(entities: Record<string, unknown>[]) => string>();

vi.mock("@/foundation/lib/yaml-transform", () => ({
  transformEntityForExport: (...args: unknown[]) =>
    mockTransformEntityForExport(...(args as [ResourceEntity, ExportOptions])),
  serializeToYaml: (...args: unknown[]) =>
    mockSerializeToYaml(...(args as [Record<string, unknown>[]])),
}));

const mockGetList = vi.fn();
const mockCustom = vi.fn();

const stableResources = [
  { name: "clusters", meta: { workspaced: true } },
  { name: "endpoints", meta: { workspaced: true } },
  { name: "engines", meta: { workspaced: false } },
  { name: "image_registries", meta: { workspaced: true } },
  { name: "model_registries", meta: { workspaced: true } },
  { name: "model_catalogs", meta: { workspaced: true } },
  { name: "api_keys", meta: { workspaced: false } },
  { name: "roles", meta: { workspaced: false } },
  { name: "role_assignments", meta: { workspaced: true } },
  { name: "workspaces", meta: { workspaced: false } },
];

vi.mock("@refinedev/core", () => ({
  useDataProvider: () => () => ({ getList: mockGetList, custom: mockCustom }),
  useResource: () => ({ resources: stableResources }),
}));

let mockCurrentWorkspace = "test-ws";

vi.mock("./use-workspace", () => ({
  ALL_WORKSPACES: "_all_",
  useWorkspace: () => ({ current: mockCurrentWorkspace }),
}));

// --- Helpers ---

function makeEntity(id: string, kind = "Cluster"): Record<string, unknown> {
  return {
    id,
    metadata: {
      name: id,
      workspace: "test-ws",
      creation_timestamp: "2024-01-01T00:00:00Z",
      update_timestamp: "2024-01-02T00:00:00Z",
      deletion_timestamp: null,
      labels: {},
      annotations: {},
    },
    kind,
    api_version: "v1",
    spec: { replicas: 3 },
    status: { phase: "Running" },
  };
}

async function exportHook() {
  const { useYamlExport } = await import("./use-yaml-export");
  return renderHook(() => useYamlExport());
}

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();
  mockCurrentWorkspace = "test-ws";

  mockGetList.mockResolvedValue({
    data: [makeEntity("c1"), makeEntity("c2")],
  });
  mockCustom.mockResolvedValue({
    data: [makeEntity("c1"), makeEntity("c2")],
  });
  mockTransformEntityForExport.mockImplementation((entity) => ({
    apiVersion: entity.api_version,
    kind: entity.kind,
    metadata: entity.metadata,
    spec: entity.spec,
  }));
  mockSerializeToYaml.mockReturnValue("apiVersion: v1\nkind: Cluster\n");
});

// --- Tests ---

describe("useYamlExport", () => {
  describe("initial state", () => {
    it("initializes all exportable resource types as unselected", async () => {
      const { result } = await exportHook();

      const types = Object.values(result.current.resourceTypes);
      expect(types.length).toBe(EXPORTABLE_RESOURCES.length);
      for (const rt of types) {
        expect(rt.selected).toBe(false);
        expect(rt.entities).toEqual([]);
        expect(rt.selectedEntities.size).toBe(0);
        expect(rt.loaded).toBe(false);
      }
    });

    it("has default export options", async () => {
      const { result } = await exportHook();

      expect(result.current.exportOptions).toEqual({
        removeStatus: true,
        removeIds: true,
        removeTimestamps: true,
        includeCredentials: true,
      });
    });

    it("reports zero statistics initially", async () => {
      const { result } = await exportHook();

      expect(result.current.statistics).toEqual({
        selectedResourceTypes: 0,
        totalSelectedEntities: 0,
      });
    });
  });

  describe("toggleResourceType", () => {
    it("selects a resource type and all its loaded entities", async () => {
      const { result } = await exportHook();

      // Load entities first
      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleResourceType("clusters"));

      const clusters = result.current.resourceTypes.clusters;
      expect(clusters.selected).toBe(true);
      expect(clusters.selectedEntities.size).toBe(2);
    });

    it("deselects a resource type and clears selected entities", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleResourceType("clusters"));
      expect(result.current.resourceTypes.clusters.selected).toBe(true);

      act(() => result.current.toggleResourceType("clusters"));
      expect(result.current.resourceTypes.clusters.selected).toBe(false);
      expect(result.current.resourceTypes.clusters.selectedEntities.size).toBe(
        0,
      );
    });
  });

  describe("toggleEntity", () => {
    it("adds an entity to selectedEntities", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleEntity("clusters", "c1"));

      expect(
        result.current.resourceTypes.clusters.selectedEntities.has("c1"),
      ).toBe(true);
      expect(result.current.resourceTypes.clusters.selected).toBe(true);
    });

    it("removes an entity from selectedEntities", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleEntity("clusters", "c1"));
      act(() => result.current.toggleEntity("clusters", "c1"));

      expect(
        result.current.resourceTypes.clusters.selectedEntities.has("c1"),
      ).toBe(false);
    });

    it("sets selected=false when all entities are deselected", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleEntity("clusters", "c1"));
      expect(result.current.resourceTypes.clusters.selected).toBe(true);

      act(() => result.current.toggleEntity("clusters", "c1"));
      expect(result.current.resourceTypes.clusters.selected).toBe(false);
    });
  });

  describe("loadEntities", () => {
    it("fetches entities via getList and stores them", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("endpoints"));

      expect(mockGetList).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: "endpoints",
          pagination: { mode: "off" },
        }),
      );
      expect(result.current.resourceTypes.endpoints.entities).toHaveLength(2);
      expect(result.current.resourceTypes.endpoints.loaded).toBe(true);
    });

    it("skips fetch when already loaded", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("endpoints"));
      await act(() => result.current.loadEntities("endpoints"));

      expect(mockGetList).toHaveBeenCalledTimes(1);
    });

    it("includes workspace filter for workspaced resources", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("endpoints"));

      expect(mockGetList).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            workspace: "test-ws",
            workspaced: true,
          }),
        }),
      );
    });

    it("omits workspace filter for non-workspaced resources", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("engines"));

      const callMeta = mockGetList.mock.calls[0][0].meta;
      expect(callMeta.workspace).toBeUndefined();
    });

    it("handles fetch errors gracefully", async () => {
      mockGetList.mockRejectedValueOnce(new Error("network error"));
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("endpoints"));

      expect(result.current.resourceTypes.endpoints.loaded).toBe(false);
      expect(result.current.resourceTypes.endpoints.entities).toEqual([]);
    });
  });

  describe("fetchResourceEntities with credentials", () => {
    it("uses custom credentials API for credential resources", async () => {
      const { result } = await exportHook();

      // includeCredentials is true by default, clusters is a credential resource
      await act(() => result.current.loadEntities("clusters"));

      expect(mockCustom).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("/credentials/clusters"),
          method: "get",
        }),
      );
      expect(mockGetList).not.toHaveBeenCalled();
    });

    it("appends workspace filter to credentials URL", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));

      const callUrl = mockCustom.mock.calls[0][0].url;
      expect(callUrl).toContain("metadata-%3Eworkspace=eq.");
    });

    it("uses getList when includeCredentials is disabled", async () => {
      const { result } = await exportHook();

      act(() =>
        result.current.setExportOptions((prev) => ({
          ...prev,
          includeCredentials: false,
        })),
      );
      await act(() => result.current.loadEntities("clusters"));

      expect(mockGetList).toHaveBeenCalled();
      expect(mockCustom).not.toHaveBeenCalled();
    });

    it("uses getList for non-credential resources even with includeCredentials", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("engines"));

      expect(mockGetList).toHaveBeenCalled();
      expect(mockCustom).not.toHaveBeenCalled();
    });
  });

  describe("generateYamlContent", () => {
    it("transforms and serializes selected entities", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleResourceType("clusters"));

      let yamlContent: string | undefined;
      await act(async () => {
        yamlContent = await result.current.generateYamlContent();
      });

      expect(mockTransformEntityForExport).toHaveBeenCalledTimes(2);
      expect(mockSerializeToYaml).toHaveBeenCalledTimes(1);
      expect(yamlContent).toBe("apiVersion: v1\nkind: Cluster\n");
    });

    it("returns empty YAML when nothing is selected", async () => {
      mockSerializeToYaml.mockReturnValue("");
      const { result } = await exportHook();

      let yamlContent: string | undefined;
      await act(async () => {
        yamlContent = await result.current.generateYamlContent();
      });

      expect(mockSerializeToYaml).toHaveBeenCalledWith([]);
      expect(yamlContent).toBe("");
    });

    it("sets isExporting during generation", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleResourceType("clusters"));

      await act(async () => {
        await result.current.generateYamlContent();
      });

      expect(result.current.isExporting).toBe(false);
    });

    it("only exports individually selected entities", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleEntity("clusters", "c1"));

      await act(async () => {
        await result.current.generateYamlContent();
      });

      expect(mockTransformEntityForExport).toHaveBeenCalledTimes(1);
      expect(mockTransformEntityForExport).toHaveBeenCalledWith(
        expect.objectContaining({ id: "c1" }),
        result.current.exportOptions,
      );
    });
  });

  describe("statistics", () => {
    it("counts selected resource types and entities", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleResourceType("clusters"));

      expect(result.current.statistics).toEqual({
        selectedResourceTypes: 1,
        totalSelectedEntities: 2,
      });
    });
  });

  describe("resetSelections", () => {
    it("clears all selections", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleResourceType("clusters"));
      expect(result.current.statistics.totalSelectedEntities).toBe(2);

      act(() => result.current.resetSelections());

      expect(result.current.statistics).toEqual({
        selectedResourceTypes: 0,
        totalSelectedEntities: 0,
      });
    });
  });

  describe("selectAllResources", () => {
    it("loads and selects all resource types", async () => {
      const { result } = await exportHook();

      await act(() => result.current.selectAllResources());

      expect(result.current.areAllResourcesSelected).toBe(true);
      expect(result.current.statistics.selectedResourceTypes).toBe(
        EXPORTABLE_RESOURCES.length,
      );
    });

    it("does not re-fetch already loaded resources", async () => {
      const { result } = await exportHook();

      // Pre-load clusters (credential resource → uses custom)
      await act(() => result.current.loadEntities("clusters"));
      const callCountCustom = mockCustom.mock.calls.length;
      const callCountGetList = mockGetList.mock.calls.length;

      await act(() => result.current.selectAllResources());

      // clusters should not be re-fetched; other 9 types should be fetched
      // credential resources: image_registries, model_registries (2 more custom calls)
      // non-credential resources: endpoints, engines, model_catalogs, api_keys, roles, role_assignments, workspaces (7 getList calls)
      const newCustomCalls = mockCustom.mock.calls.length - callCountCustom;
      const newGetListCalls = mockGetList.mock.calls.length - callCountGetList;
      expect(newCustomCalls + newGetListCalls).toBe(
        EXPORTABLE_RESOURCES.length - 1,
      );
    });
  });

  describe("resetCredentialResources", () => {
    it("resets loaded state for credential resources only", async () => {
      const { result } = await exportHook();

      // Load and select clusters (credential) and engines (non-credential)
      await act(() => result.current.loadEntities("clusters"));
      await act(() => result.current.loadEntities("engines"));
      act(() => result.current.toggleResourceType("clusters"));
      act(() => result.current.toggleResourceType("engines"));

      act(() => result.current.resetCredentialResources());

      // Credential resource should be reset
      expect(result.current.resourceTypes.clusters.loaded).toBe(false);
      expect(result.current.resourceTypes.clusters.selected).toBe(false);
      expect(result.current.resourceTypes.clusters.entities).toEqual([]);

      // Non-credential resource should be untouched
      expect(result.current.resourceTypes.engines.loaded).toBe(true);
      expect(result.current.resourceTypes.engines.selected).toBe(true);
    });
  });

  describe("areAllResourcesSelected", () => {
    it("returns false when not all types are selected", async () => {
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));
      act(() => result.current.toggleResourceType("clusters"));

      expect(result.current.areAllResourcesSelected).toBe(false);
    });

    it("returns true when all types are selected", async () => {
      const { result } = await exportHook();

      await act(() => result.current.selectAllResources());

      expect(result.current.areAllResourcesSelected).toBe(true);
    });
  });

  describe("workspace filtering", () => {
    it("omits workspace filter when currentWorkspace is ALL_WORKSPACES", async () => {
      mockCurrentWorkspace = ALL_WORKSPACES;
      const { result } = await exportHook();

      // Disable credentials to test getList path
      act(() =>
        result.current.setExportOptions((prev) => ({
          ...prev,
          includeCredentials: false,
        })),
      );
      await act(() => result.current.loadEntities("clusters"));

      const callMeta = mockGetList.mock.calls[0][0].meta;
      expect(callMeta.workspace).toBeUndefined();
    });

    it("omits workspace query param for credentials when ALL_WORKSPACES", async () => {
      mockCurrentWorkspace = ALL_WORKSPACES;
      const { result } = await exportHook();

      await act(() => result.current.loadEntities("clusters"));

      const callUrl = mockCustom.mock.calls[0][0].url;
      expect(callUrl).toBe("/credentials/clusters");
    });
  });
});
