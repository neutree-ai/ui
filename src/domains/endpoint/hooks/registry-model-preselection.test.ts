import { afterEach, describe, expect, it } from "vitest";
import { readRegistryModelQueryParams } from "@/domains/endpoint/hooks/use-endpoint-form";

const originalHash = window.location.hash;

afterEach(() => {
  window.location.hash = originalHash;
});

describe("readRegistryModelQueryParams", () => {
  it("reads and decodes an exact registry model reference", () => {
    window.location.hash =
      "#/default/endpoints/create?model_registry=team-models&model=org%2Fmodel&version=abc123";

    expect(readRegistryModelQueryParams()).toEqual({
      registry: "team-models",
      model: "org/model",
      version: "abc123",
    });
  });

  it("requires both the registry and model", () => {
    window.location.hash =
      "#/default/endpoints/create?model_registry=team-models";

    expect(readRegistryModelQueryParams()).toBeNull();
  });
});
