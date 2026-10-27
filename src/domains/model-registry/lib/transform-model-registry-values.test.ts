import { describe, expect, it } from "vitest";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { transformModelRegistryValues } from "./transform-model-registry-values";

const makeRegistry = (credentials?: string): ModelRegistry =>
  ({
    api_version: "v1",
    kind: "ModelRegistry",
    metadata: { name: "reg1", workspace: "default" },
    spec: { type: "hugging-face", url: "https://huggingface.co", credentials },
  }) as unknown as ModelRegistry;

describe("transformModelRegistryValues", () => {
  it.each([
    ["keeps empty credentials on create", "", false, undefined, ""],
    [
      "keeps new credentials on edit",
      "token-123",
      true,
      undefined,
      "token-123",
    ],
    [
      "drops untouched empty credentials on edit",
      "",
      true,
      undefined,
      undefined,
    ],
    [
      "keeps credentials cleared on purpose on edit",
      "",
      true,
      { spec: { credentials: true } },
      "",
    ],
  ])("%s", (_, credentials, isEdit, touched, expected) => {
    const result = transformModelRegistryValues(
      makeRegistry(credentials),
      isEdit,
      touched,
    );
    expect(result.spec.credentials).toBe(expected);
  });
});
