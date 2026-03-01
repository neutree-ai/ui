import type { ModelRegistry } from "@/domains/model-registry/types";
import { describe, expect, it } from "vitest";
import { transformModelRegistryValues } from "./transform-model-registry-values";

const makeRegistry = (credentials?: string): ModelRegistry =>
  ({
    api_version: "v1",
    kind: "ModelRegistry",
    metadata: { name: "reg1", workspace: "default" },
    spec: { type: "hugging-face", url: "https://huggingface.co", credentials },
  }) as unknown as ModelRegistry;

describe("transformModelRegistryValues", () => {
  it("preserves empty credentials in create mode", () => {
    const result = transformModelRegistryValues(makeRegistry(""));
    expect(result.spec.credentials).toBe("");
  });

  it("preserves non-empty credentials in edit mode", () => {
    const result = transformModelRegistryValues(
      makeRegistry("token-123"),
      true,
    );
    expect(result.spec.credentials).toBe("token-123");
  });

  it("removes empty credentials in edit mode", () => {
    const result = transformModelRegistryValues(makeRegistry(""), true);
    expect(result.spec.credentials).toBeUndefined();
  });
});
