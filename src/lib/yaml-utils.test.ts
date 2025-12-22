import * as clipboard from "clipboard-polyfill";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyYamlToClipboard,
  downloadYamlFile,
  generateEntitiesFilename,
  generateEntityFilename,
  generateYamlContentFromEntities,
  generateYamlContentFromEntity,
  getDefaultExportOptions,
  transformEntityToYaml,
} from "./yaml-utils";

vi.mock("js-yaml", async () => {
  const actual = await vi.importActual<typeof import("js-yaml")>("js-yaml");
  return { ...actual };
});

// Mock other external dependencies
vi.mock("clipboard-polyfill", () => ({ writeText: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Setup DOM mocks
global.Blob = vi.fn();
Object.defineProperty(window, "document", {
  value: {
    createElement: vi.fn(() => ({ click: vi.fn() })),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  },
});
Object.defineProperty(window, "URL", {
  value: { createObjectURL: vi.fn(() => "mock-url"), revokeObjectURL: vi.fn() },
});

describe("transformEntityToYaml", () => {
  const baseEntity = {
    api_version: "v1",
    kind: "api",
    metadata: { name: "test-pod" },
    spec: { containers: [] },
    status: { phase: "Running" },
  };

  it("should transform basic entity structure", () => {
    const result = transformEntityToYaml(baseEntity);
    expect(result).toEqual({
      apiVersion: "v1",
      kind: "api",
      metadata: { name: "test-pod" },
      spec: { containers: [] },
      status: { phase: "Running" },
    });
  });

  it("should handle export options correctly", () => {
    // Remove status
    expect(
      transformEntityToYaml(baseEntity, { removeStatus: true }),
    ).not.toHaveProperty("status");

    // Remove timestamps
    const entityWithTimestamps = {
      ...baseEntity,
      metadata: { ...baseEntity.metadata, creation_timestamp: "2024-01-01" },
    };
    const result = transformEntityToYaml(entityWithTimestamps, {
      removeTimestamps: true,
    });
    expect(result.metadata).not.toHaveProperty("creation_timestamp");

    // Remove IDsem
    const entityWithIds = {
      ...baseEntity,
      metadata: { ...baseEntity.metadata, id: "123", workspace: "default" },
    };
    const resultWithIds = transformEntityToYaml(entityWithIds, {
      removeIds: true,
    });
    expect(resultWithIds.metadata).toEqual({
      name: "test-pod",
      workspace: "default",
    });
  });
});

describe("generateYamlContentFromEntity", () => {
  it("should generate YAML content and filter null values", () => {
    const entity = {
      api_version: "v1",
      kind: "api",
      metadata: {
        name: "test-pod",
        // These fields should be filtered out
        deletionTimestamp: null,
        labels: undefined,
      },
      spec: { containers: [] },
    };

    const result = generateYamlContentFromEntity(entity);

    // Verify that the result is a string
    expect(typeof result).toBe("string");
    // Verify that the core fields exist
    expect(result).toContain("kind: api");
    // Verify that null/undefined fields really disappeared (now this is a real integration test)
    expect(result).not.toContain("deletionTimestamp");
    expect(result).not.toContain("labels");
  });
});

describe("generateYamlContentFromEntities", () => {
  it("should handle single and multiple entities", () => {
    const multipleEntities = [
      { apiVersion: "v1", kind: "api", metadata: { name: "pod1" } },
      { apiVersion: "v1", kind: "Service", metadata: { name: "svc1" } },
    ];

    const result = generateYamlContentFromEntities(multipleEntities);

    // Verify the separator
    expect(result).toContain("kind: api");
    expect(result).toContain("---");
    expect(result).toContain("kind: Service");
  });

  // boundary cases
  it("should return empty string for empty array", () => {
    expect(generateYamlContentFromEntities([])).toBe("");
  });
});

describe("copyYamlToClipboard", () => {
  const mockTranslate = vi.fn((key: string) => key);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should copy successfully and handle errors", async () => {
    (clipboard.writeText as any).mockResolvedValueOnce(undefined);
    await copyYamlToClipboard("content", mockTranslate);
    expect(toast.success).toHaveBeenCalled();

    (clipboard.writeText as any).mockRejectedValueOnce(new Error("fail"));
    await expect(
      copyYamlToClipboard("content", mockTranslate),
    ).rejects.toThrow();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe("downloadYamlFile", () => {
  it("should create download link and trigger download", () => {
    downloadYamlFile("content", "test.yaml", vi.fn());
    expect(global.Blob).toHaveBeenCalled();
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(toast.success).toHaveBeenCalled();
  });
});

describe("filename generation", () => {
  it("should generate filenames with current date", () => {
    vi.useFakeTimers().setSystemTime(new Date("2024-01-15"));
    expect(generateEntityFilename("pods")).toBe("pods-2024-01-15.yaml");
    expect(generateEntitiesFilename()).toBe("resources-2024-01-15.yaml");
    vi.useRealTimers();
  });

  // default options test
  it("should return correct defaults", () => {
    expect(getDefaultExportOptions()).toEqual({
      removeStatus: true,
      removeIds: true,
      removeTimestamps: true,
    });
  });
});
