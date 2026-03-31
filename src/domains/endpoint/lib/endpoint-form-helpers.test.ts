import { describe, expect, it } from "vitest";
import {
  buildCatalogMergedSpec,
  computeMaxAvailable,
  deepMerge,
  defaultEndpointSpec,
  transformEndpointValues,
  validateCurrentUsage,
  validateEndpointValues,
} from "./endpoint-form-helpers";

describe("validateCurrentUsage", () => {
  it("returns currentUsage when within capacity", () => {
    expect(validateCurrentUsage(4, 8)).toBe(4);
  });

  it("returns 0 when currentUsage exceeds capacity", () => {
    expect(validateCurrentUsage(10, 8)).toBe(0);
  });

  it("returns currentUsage when equal to capacity", () => {
    expect(validateCurrentUsage(8, 8)).toBe(8);
  });

  it("returns 0 when currentUsage is 0", () => {
    expect(validateCurrentUsage(0, 8)).toBe(0);
  });
});

describe("deepMerge", () => {
  it("overwrites shallow keys", () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("adds new keys from source", () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("recursively merges nested objects", () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3, c: 4 } };
    expect(deepMerge(target, source)).toEqual({
      nested: { a: 1, b: 3, c: 4 },
    });
  });

  it("skips null values from source", () => {
    expect(deepMerge({ a: 1 }, { a: null } as Record<string, unknown>)).toEqual(
      { a: 1 },
    );
  });

  it("skips undefined values from source", () => {
    expect(
      deepMerge({ a: 1 }, { a: undefined } as Record<string, unknown>),
    ).toEqual({ a: 1 });
  });

  it("returns target when source is null", () => {
    const target = { a: 1 };
    expect(
      deepMerge(target, null as unknown as Record<string, unknown>),
    ).toEqual({ a: 1 });
  });

  it("returns source when target is null", () => {
    const source = { a: 1 };
    expect(
      deepMerge(null as unknown as Record<string, unknown>, source),
    ).toEqual({ a: 1 });
  });

  it("replaces arrays instead of merging", () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });
});

describe("computeMaxAvailable", () => {
  it("uses single-node max when singleNodeMax is provided", () => {
    const singleNodeMax = {
      cpu: { available: 10, total: 16 },
      memory: { available: 20, total: 32 },
      gpu: { available: 2, total: 4 },
    };
    const result = computeMaxAvailable(singleNodeMax, null, {
      cpu: 2,
      memory: 4,
      gpu: 1,
    });
    // available = singleNodeMax.available + validCurrentUsage, capped at total
    expect(result.cpu).toEqual({ available: 12, total: 16 });
    expect(result.memory).toEqual({ available: 24, total: 32 });
    expect(result.gpu).toEqual({ available: 3, total: 4 });
  });

  it("caps available at total when paused EP releases resources (singleNodeMax)", () => {
    // When EP is paused, cluster reports all resources as available (e.g., gpu available=1, total=1)
    // but currentUsage is still 1 from the form values → available + current would be 2 > total
    const singleNodeMax = {
      cpu: { available: 8, total: 8 },
      memory: { available: 13.2, total: 13.2 },
      gpu: { available: 1, total: 1 },
    };
    const result = computeMaxAvailable(singleNodeMax, null, {
      cpu: 4,
      memory: 8,
      gpu: 1,
    });
    // available should never exceed total
    expect(result.cpu).toEqual({ available: 8, total: 8 });
    expect(result.memory).toEqual({ available: 13.2, total: 13.2 });
    expect(result.gpu).toEqual({ available: 1, total: 1 });
  });

  it("falls back to cluster resources when singleNodeMax is null", () => {
    const clusterResources = {
      cpu: { available: 80, total: 100 },
      memory: { available: 200, total: 256 },
    };
    const result = computeMaxAvailable(null, clusterResources, {
      cpu: 4,
      memory: 8,
      gpu: 0,
    });
    expect(result.cpu).toEqual({ available: 84, total: 100 });
    expect(result.memory).toEqual({ available: 208, total: 256 });
    expect(result.gpu).toEqual({ available: 0, total: 0 });
  });

  it("caps available at total when paused EP releases resources (cluster)", () => {
    const clusterResources = {
      cpu: { available: 100, total: 100 },
      memory: { available: 256, total: 256 },
    };
    const result = computeMaxAvailable(null, clusterResources, {
      cpu: 4,
      memory: 8,
      gpu: 0,
    });
    expect(result.cpu).toEqual({ available: 100, total: 100 });
    expect(result.memory).toEqual({ available: 256, total: 256 });
  });

  it("returns all zeros when both sources are null", () => {
    const result = computeMaxAvailable(null, null, {
      cpu: 0,
      memory: 0,
      gpu: 0,
    });
    expect(result).toEqual({
      cpu: { available: 0, total: 0 },
      memory: { available: 0, total: 0 },
      gpu: { available: 0, total: 0 },
    });
  });

  it("resets currentUsage that exceeds capacity", () => {
    const singleNodeMax = {
      cpu: { available: 10, total: 16 },
      memory: { available: 20, total: 32 },
      gpu: { available: 2, total: 4 },
    };
    // currentUsage exceeds total → validateCurrentUsage returns 0
    const result = computeMaxAvailable(singleNodeMax, null, {
      cpu: 20,
      memory: 40,
      gpu: 10,
    });
    expect(result.cpu).toEqual({ available: 10, total: 16 });
    expect(result.memory).toEqual({ available: 20, total: 32 });
    expect(result.gpu).toEqual({ available: 2, total: 4 });
  });
});

describe("transformEndpointValues", () => {
  it("converts resource fields to strings", () => {
    const spec = { resources: { cpu: 4, memory: 8, gpu: 2 }, replicas: null };
    transformEndpointValues(spec);
    expect(spec.resources).toEqual({ cpu: "4", memory: "8", gpu: "2" });
  });

  it("converts replicas.num to number", () => {
    const spec = { resources: null, replicas: { num: "3" as unknown } };
    transformEndpointValues(spec);
    expect(spec.replicas.num).toBe(3);
  });

  it("handles null resources gracefully", () => {
    const spec = { resources: null, replicas: { num: 1 } };
    expect(() => transformEndpointValues(spec)).not.toThrow();
  });

  it("handles null replicas gracefully", () => {
    const spec = { resources: { cpu: 1 }, replicas: null };
    expect(() => transformEndpointValues(spec)).not.toThrow();
  });
});

describe("validateEndpointValues", () => {
  const mockT = (key: string) => key;

  const validScheduler = {
    deployment_options: { scheduler: { type: "consistent_hash" } },
  };

  it("returns error when replicas < 1", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 0 }, ...validScheduler },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
      },
      mockT,
    );
    expect(errors["spec.replicas.num"]).toBeDefined();
  });

  it("returns no error when replicas >= 1", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 2 }, ...validScheduler },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
      },
      mockT,
    );
    expect(errors["spec.replicas.num"]).toBeUndefined();
  });

  it("returns error when model not found in create mode", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 1 }, ...validScheduler },
      {
        action: "create",
        currentRegistry: "my-registry",
        currentModelName: "missing-model",
        availableModelNames: ["model-a", "model-b"],
      },
      mockT,
    );
    expect(errors["-model-catalog"]).toBeDefined();
  });

  it("returns no error when model exists in create mode", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 1 }, ...validScheduler },
      {
        action: "create",
        currentRegistry: "my-registry",
        currentModelName: "model-a",
        availableModelNames: ["model-a", "model-b"],
      },
      mockT,
    );
    expect(errors["-model-catalog"]).toBeUndefined();
  });

  it("skips model check in edit mode", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 1 }, ...validScheduler },
      {
        action: "edit",
        currentRegistry: "my-registry",
        currentModelName: "missing-model",
        availableModelNames: [],
      },
      mockT,
    );
    expect(errors["-model-catalog"]).toBeUndefined();
  });

  it("returns error when scheduler type is empty", () => {
    const errors = validateEndpointValues(
      {
        replicas: { num: 1 },
        deployment_options: { scheduler: { type: "" } },
      },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
      },
      mockT,
    );
    expect(errors["spec.deployment_options.scheduler.type"]).toBeDefined();
    expect(errors["spec.deployment_options.scheduler.type"].message).toBe(
      "endpoints.messages.schedulerTypeRequired",
    );
  });

  it("returns error when deployment_options is null", () => {
    const errors = validateEndpointValues(
      {
        replicas: { num: 1 },
        deployment_options: null,
      },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
      },
      mockT,
    );
    expect(errors["spec.deployment_options.scheduler.type"]).toBeDefined();
  });

  it("returns no error when scheduler type is set", () => {
    const errors = validateEndpointValues(
      {
        replicas: { num: 1 },
        deployment_options: { scheduler: { type: "roundrobin" } },
      },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
      },
      mockT,
    );
    expect(errors["spec.deployment_options.scheduler.type"]).toBeUndefined();
  });
});

describe("buildCatalogMergedSpec", () => {
  it("returns defaults (excluding cluster) when catalogSpec is null", () => {
    const result = buildCatalogMergedSpec(null);

    expect(result.cluster).toBeUndefined();
    expect(result.model).toEqual(defaultEndpointSpec.model);
    expect(result.engine).toEqual(defaultEndpointSpec.engine);
    expect(result.resources).toEqual(defaultEndpointSpec.resources);
    expect(result.replicas).toEqual(defaultEndpointSpec.replicas);
    expect(result.deployment_options).toEqual(
      defaultEndpointSpec.deployment_options,
    );
    expect(result.variables).toEqual(defaultEndpointSpec.variables);
    expect(result.env).toEqual(defaultEndpointSpec.env);
  });

  it("merges catalog values onto defaults", () => {
    const catalogSpec = {
      model: { name: "llama-3", registry: "hf" },
      engine: { engine: "vllm", version: "0.6.0" },
    };

    const result = buildCatalogMergedSpec(catalogSpec);

    // Catalog values override defaults
    expect(result.model).toEqual({
      name: "llama-3",
      version: "",
      registry: "hf",
      file: "",
      task: "",
    });
    expect(result.engine).toEqual({ engine: "vllm", version: "0.6.0" });
    // Sections not in catalog fall back to defaults
    expect(result.resources).toEqual(defaultEndpointSpec.resources);
    expect(result.replicas).toEqual(defaultEndpointSpec.replicas);
  });

  it("falls back to defaults for null catalog sections", () => {
    const catalogSpec = {
      model: { name: "tiny-model" },
      resources: null,
      replicas: null,
    };

    const result = buildCatalogMergedSpec(
      catalogSpec as Record<string, unknown>,
    );

    expect(result.model).toMatchObject({ name: "tiny-model" });
    expect(result.resources).toEqual(defaultEndpointSpec.resources);
    expect(result.replicas).toEqual(defaultEndpointSpec.replicas);
  });

  it("never includes cluster in result", () => {
    const catalogSpec = {
      cluster: "should-be-ignored",
      model: { name: "test" },
    };

    const result = buildCatalogMergedSpec(catalogSpec);

    expect(result.cluster).toBeUndefined();
  });

  it("does not leak values between successive calls", () => {
    const catalogA = {
      model: { name: "model-a" },
      variables: { engine_args: { tensor_parallel: "2" } },
    };
    const catalogB = {
      model: { name: "model-b" },
    };

    const resultA = buildCatalogMergedSpec(catalogA);
    const resultB = buildCatalogMergedSpec(catalogB);

    expect(resultA.variables).toEqual({
      engine_args: { tensor_parallel: "2" },
    });
    // Catalog B has no variables → defaults, no leak from A
    expect(resultB.variables).toEqual(defaultEndpointSpec.variables);
    expect(resultB.model).toMatchObject({ name: "model-b" });
  });

  it("deep merges nested engine_args", () => {
    const catalogSpec = {
      variables: { engine_args: { max_model_len: "4096" } },
    };

    const result = buildCatalogMergedSpec(catalogSpec);

    expect(result.variables).toEqual({
      engine_args: { max_model_len: "4096" },
    });
  });
});
