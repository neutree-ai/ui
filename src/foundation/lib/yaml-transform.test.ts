import { describe, expect, it } from "vitest";
import type {
  ExportOptions,
  ResourceEntity,
  YamlResource,
} from "./yaml-transform";
import {
  isValidYamlResource,
  kindToResourceType,
  parseYamlDocuments,
  serializeToYaml,
  transformEntityForExport,
  transformResourceForImport,
} from "./yaml-transform";

// --- Helpers ---

function makeEntity(overrides?: Partial<ResourceEntity>): ResourceEntity {
  return {
    id: "abc-123",
    metadata: {
      name: "my-cluster",
      workspace: "default",
      creation_timestamp: "2024-01-01T00:00:00Z",
      update_timestamp: "2024-01-02T00:00:00Z",
      deletion_timestamp: null,
      labels: { env: "prod" },
      annotations: { note: "test" },
    },
    kind: "Cluster",
    api_version: "v1",
    spec: { replicas: 3 },
    status: { phase: "Running" },
    ...overrides,
  };
}

const ALL_OFF: ExportOptions = {
  removeStatus: false,
  removeIds: false,
  removeTimestamps: false,
  includeCredentials: false,
};

const ALL_ON: ExportOptions = {
  removeStatus: true,
  removeIds: true,
  removeTimestamps: true,
  includeCredentials: false,
};

// --- transformEntityForExport ---

describe("transformEntityForExport", () => {
  it("keeps all fields when no options are enabled", () => {
    const result = transformEntityForExport(makeEntity(), ALL_OFF);

    expect(result.id).toBe("abc-123");
    expect(result.apiVersion).toBe("v1");
    expect(result.kind).toBe("Cluster");
    expect(result.spec).toEqual({ replicas: 3 });
    expect(result.status).toEqual({ phase: "Running" });
    expect(
      (result.metadata as Record<string, unknown>).creation_timestamp,
    ).toBe("2024-01-01T00:00:00Z");
  });

  it("removes status when removeStatus is true", () => {
    const result = transformEntityForExport(makeEntity(), {
      ...ALL_OFF,
      removeStatus: true,
    });

    expect(result.status).toBeUndefined();
    expect(result.spec).toEqual({ replicas: 3 });
  });

  it("removes id and rebuilds metadata when removeIds is true", () => {
    const result = transformEntityForExport(makeEntity(), {
      ...ALL_OFF,
      removeIds: true,
    });

    expect(result.id).toBeUndefined();
    const metadata = result.metadata as Record<string, unknown>;
    expect(metadata.name).toBe("my-cluster");
    expect(metadata.workspace).toBe("default");
    expect(metadata.display_name).toBeUndefined();
    expect(metadata.labels).toEqual({ env: "prod" });
    expect(metadata.annotations).toEqual({ note: "test" });
    // Auto-generated fields should be stripped
    expect(metadata.creation_timestamp).toBeUndefined();
    expect(metadata.update_timestamp).toBeUndefined();
  });

  it("removes timestamps when removeTimestamps is true", () => {
    const result = transformEntityForExport(makeEntity(), {
      ...ALL_OFF,
      removeTimestamps: true,
    });

    const metadata = result.metadata as Record<string, unknown>;
    expect(metadata.creation_timestamp).toBeUndefined();
    expect(metadata.update_timestamp).toBeUndefined();
    expect(metadata.deletion_timestamp).toBeUndefined();
    // Other metadata fields preserved
    expect(metadata.name).toBe("my-cluster");
    expect(metadata.workspace).toBe("default");
  });

  it("removeIds strips timestamps regardless of removeTimestamps setting", () => {
    // When removeIds is true, metadata is rebuilt with only {name, workspace, display_name, labels, annotations}
    // so timestamps are gone even if removeTimestamps is false
    const result = transformEntityForExport(makeEntity(), {
      ...ALL_OFF,
      removeIds: true,
      removeTimestamps: false,
    });

    const metadata = result.metadata as Record<string, unknown>;
    expect(metadata.creation_timestamp).toBeUndefined();
    expect(metadata.update_timestamp).toBeUndefined();
  });

  it("applies all options together", () => {
    const result = transformEntityForExport(makeEntity(), ALL_ON);

    expect(result.id).toBeUndefined();
    expect(result.status).toBeUndefined();
    const metadata = result.metadata as Record<string, unknown>;
    expect(metadata.name).toBe("my-cluster");
    expect(metadata.creation_timestamp).toBeUndefined();
  });

  it("omits spec when entity has no spec", () => {
    const entity = makeEntity({ spec: undefined });
    const result = transformEntityForExport(entity, ALL_OFF);
    expect(result.spec).toBeUndefined();
  });

  it("omits status when entity has no status even if removeStatus is false", () => {
    const entity = makeEntity({ status: undefined });
    const result = transformEntityForExport(entity, ALL_OFF);
    expect(result.status).toBeUndefined();
  });
});

// --- serializeToYaml ---

describe("serializeToYaml", () => {
  it("serializes a single entity", () => {
    const output = serializeToYaml([{ apiVersion: "v1", kind: "Cluster" }]);
    expect(output).toContain("apiVersion: v1");
    expect(output).toContain("kind: Cluster");
    expect(output).not.toContain("---");
  });

  it("separates multiple entities with ---", () => {
    const output = serializeToYaml([
      { apiVersion: "v1", kind: "Cluster" },
      { apiVersion: "v1", kind: "Endpoint" },
    ]);
    expect(output).toContain("---");
    const parts = output.split("---");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("Cluster");
    expect(parts[1]).toContain("Endpoint");
  });

  it("filters out null and undefined values", () => {
    const output = serializeToYaml([
      { apiVersion: "v1", nullField: null, undefinedField: undefined },
    ]);
    expect(output).not.toContain("nullField");
    expect(output).not.toContain("undefinedField");
  });

  it("returns empty string for empty array", () => {
    expect(serializeToYaml([])).toBe("");
  });
});

// --- kindToResourceType ---

describe("kindToResourceType", () => {
  it("converts simple PascalCase to plural snake_case", () => {
    expect(kindToResourceType("Cluster")).toBe("clusters");
  });

  it("converts compound PascalCase to plural snake_case", () => {
    expect(kindToResourceType("ModelRegistry")).toBe("model_registries");
  });

  it("handles RoleAssignment", () => {
    expect(kindToResourceType("RoleAssignment")).toBe("role_assignments");
  });

  it("handles ImageRegistry", () => {
    expect(kindToResourceType("ImageRegistry")).toBe("image_registries");
  });

  it("handles Endpoint", () => {
    expect(kindToResourceType("Endpoint")).toBe("endpoints");
  });

  it("handles Engine", () => {
    expect(kindToResourceType("Engine")).toBe("engines");
  });

  it("handles ModelCatalog", () => {
    expect(kindToResourceType("ModelCatalog")).toBe("model_catalogs");
  });

  it("handles Workspace", () => {
    expect(kindToResourceType("Workspace")).toBe("workspaces");
  });

  it("handles ApiKey", () => {
    expect(kindToResourceType("ApiKey")).toBe("api_keys");
  });

  it("handles Role", () => {
    expect(kindToResourceType("Role")).toBe("roles");
  });
});

// --- parseYamlDocuments ---

describe("parseYamlDocuments", () => {
  it("parses a single YAML document", () => {
    const input = `apiVersion: v1
kind: Cluster
metadata:
  name: test-cluster
spec:
  replicas: 3`;

    const result = parseYamlDocuments(input);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("Cluster");
    expect(result[0].apiVersion).toBe("v1");
  });

  it("parses multi-document YAML", () => {
    const input = `apiVersion: v1
kind: Cluster
metadata:
  name: cluster-1
---
apiVersion: v1
kind: Endpoint
metadata:
  name: endpoint-1`;

    const result = parseYamlDocuments(input);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe("Cluster");
    expect(result[1].kind).toBe("Endpoint");
  });

  it("throws on invalid YAML", () => {
    const input = "{{{invalid yaml: [";
    expect(() => parseYamlDocuments(input)).toThrow();
  });

  it("skips non-resource objects (missing apiVersion/kind)", () => {
    const input = `foo: bar
baz: 123
---
apiVersion: v1
kind: Cluster
metadata:
  name: test`;

    const result = parseYamlDocuments(input);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("Cluster");
  });

  it("skips scalar documents", () => {
    const input = `hello
---
apiVersion: v1
kind: Cluster
metadata:
  name: test`;

    const result = parseYamlDocuments(input);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for empty content", () => {
    expect(parseYamlDocuments("")).toHaveLength(0);
  });
});

// --- transformResourceForImport ---

describe("transformResourceForImport", () => {
  const resource: YamlResource = {
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

  it("uses current workspace when resource has no workspace", () => {
    const result = transformResourceForImport(resource, "my-workspace");
    const metadata = result.metadata as Record<string, unknown>;
    expect(metadata.workspace).toBe("my-workspace");
  });

  it("preserves resource workspace when present", () => {
    const resourceWithWs: YamlResource = {
      ...resource,
      metadata: { ...resource.metadata, workspace: "from-yaml" },
    };
    const result = transformResourceForImport(resourceWithWs, "current-ws");
    const metadata = result.metadata as Record<string, unknown>;
    expect(metadata.workspace).toBe("from-yaml");
  });

  it("defaults labels to empty object", () => {
    const noLabels: YamlResource = {
      ...resource,
      metadata: {
        ...resource.metadata,
        labels: undefined as unknown as Record<string, string>,
      },
    };
    const result = transformResourceForImport(noLabels, "ws");
    const metadata = result.metadata as Record<string, unknown>;
    expect(metadata.labels).toEqual({});
  });

  it("converts apiVersion to api_version", () => {
    const result = transformResourceForImport(resource, "ws");
    expect(result.api_version).toBe("v1");
    expect(result.apiVersion).toBeUndefined();
  });

  it("preserves spec", () => {
    const result = transformResourceForImport(resource, "ws");
    expect(result.spec).toEqual({ replicas: 3 });
  });
});

// --- isValidYamlResource ---

describe("isValidYamlResource", () => {
  it("returns true for valid resource", () => {
    expect(
      isValidYamlResource({
        apiVersion: "v1",
        kind: "Cluster",
        metadata: { name: "test" },
      }),
    ).toBe(true);
  });

  it("returns false when apiVersion is missing", () => {
    expect(
      isValidYamlResource({
        kind: "Cluster",
        metadata: { name: "test" },
      }),
    ).toBe(false);
  });

  it("returns false when kind is missing", () => {
    expect(
      isValidYamlResource({
        apiVersion: "v1",
        metadata: { name: "test" },
      }),
    ).toBe(false);
  });

  it("returns false when metadata.name is missing", () => {
    expect(
      isValidYamlResource({
        apiVersion: "v1",
        kind: "Cluster",
        metadata: {},
      }),
    ).toBe(false);
  });

  it("returns false when metadata is missing", () => {
    expect(
      isValidYamlResource({
        apiVersion: "v1",
        kind: "Cluster",
      }),
    ).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidYamlResource(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isValidYamlResource("string")).toBe(false);
  });
});
