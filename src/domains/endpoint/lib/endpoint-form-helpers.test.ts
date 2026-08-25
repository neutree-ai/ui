import { describe, expect, it } from "vitest";
import {
  buildCatalogMergedSpec,
  computeMaxAvailable,
  deepMerge,
  defaultEndpointSpec,
  isResourceRequestExceeded,
  normalizeEndpointRecordForForm,
  normalizeEndpointResourcesForForm,
  transformEndpointValues,
  validateCurrentUsage,
  validateEndpointValues,
} from "./endpoint-form-helpers";

describe("isResourceRequestExceeded", () => {
  it("flags a request larger than the available budget", () => {
    // 3 requested vs 2.9 free on the target node -> over-allocated (NEU-514).
    expect(isResourceRequestExceeded(3, 2.9, 15.7)).toBe(true);
  });

  it("does not flag a request that fits", () => {
    expect(isResourceRequestExceeded(2, 2.9, 15.7)).toBe(false);
  });

  it("treats exactly-available as fitting (not exceeded)", () => {
    expect(isResourceRequestExceeded(2.9, 2.9, 15.7)).toBe(false);
  });

  it("does not flag floating-point drift from per-replica × count", () => {
    // The CPU field steps by 0.1, so 0.1 requested across 3 replicas is
    // 0.30000000000000004 — must not spuriously exceed a 0.3 budget.
    expect(isResourceRequestExceeded(0.1 * 3, 0.3, 15.7)).toBe(false);
  });

  it("never flags a zero request", () => {
    expect(isResourceRequestExceeded(0, 0, 15.7)).toBe(false);
  });

  it("never flags when capacity info is unknown (total 0)", () => {
    // No cluster selected / no resource data yet -> avoid false positives.
    expect(isResourceRequestExceeded(3, 0, 0)).toBe(false);
  });
});

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

  it("normalizes empty accelerator resources to null", () => {
    const spec = {
      resources: {
        accelerator: {
          type: "",
          product: "",
          ignored: "value",
        },
      },
      replicas: null,
    };

    transformEndpointValues(spec);

    expect(spec.resources.accelerator).toBeNull();
  });

  it("removes the accelerator declaration when the card count is zero", () => {
    const spec = {
      resources: {
        gpu: 0,
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
        },
      },
      replicas: null,
    };

    transformEndpointValues(spec);

    expect(spec.resources.gpu).toBe("0");
    expect(spec.resources.accelerator).toBeNull();
  });

  it("normalizes vGPU virtualization before submission", () => {
    const spec = {
      resources: {
        cpu: 4,
        memory: 8,
        gpu: 1,
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            memory_mib: "10240",
            memory_percent: "",
            core_percent: "30",
          },
        },
      },
      replicas: null,
    };

    transformEndpointValues(spec);

    expect(spec.resources.accelerator).toEqual({
      type: "nvidia_gpu",
      product: "Tesla-T4",
      "virtualization.memory_mib": "10240",
      "virtualization.core_percent": "30",
    });
  });

  it("drops memory_percent virtualization before submission", () => {
    const spec = {
      resources: {
        cpu: 4,
        memory: 8,
        gpu: 1,
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            memory_percent: 50,
            core_percent: 30,
          },
        },
      },
      replicas: null,
    };

    transformEndpointValues(spec);

    expect(spec.resources.accelerator).toEqual({
      type: "nvidia_gpu",
      product: "Tesla-T4",
    });
  });

  it("drops core-only virtualization before submission", () => {
    const spec = {
      resources: {
        cpu: 4,
        memory: 8,
        gpu: 1,
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            core_percent: 25,
          },
        },
      },
      replicas: null,
    };

    transformEndpointValues(spec);

    expect(spec.resources.accelerator).toEqual({
      type: "nvidia_gpu",
      product: "Tesla-T4",
    });
  });

  it("parses valid JSON object and array engine_args strings before submission", () => {
    const spec = {
      resources: null,
      replicas: null,
      variables: {
        engine_args: {
          speculative_config: '{"method":"mtp","nested":{"enabled":true}}',
          stop: '["</s>","<|end|>"]',
          max_model_len: "4096",
          invalid_object: '{"method":',
          json_number: "1",
        },
      },
    };

    transformEndpointValues(spec);

    expect(spec.variables.engine_args).toEqual({
      speculative_config: {
        method: "mtp",
        nested: { enabled: true },
      },
      stop: ["</s>", "<|end|>"],
      max_model_len: "4096",
      invalid_object: '{"method":',
      json_number: "1",
    });
  });

  it("ignores non-object engine_args values during submission normalization", () => {
    const spec = {
      resources: null,
      replicas: null,
      variables: {
        engine_args: '{"speculative_config":{"method":"mtp"}}',
      },
    } as unknown as Parameters<typeof transformEndpointValues>[0];

    expect(() => transformEndpointValues(spec)).not.toThrow();
    expect(spec.variables?.engine_args).toBe(
      '{"speculative_config":{"method":"mtp"}}',
    );
  });
});

describe("normalizeEndpointResourcesForForm", () => {
  it("normalizes backend resource strings and flat vGPU keys for form editing", () => {
    expect(
      normalizeEndpointResourcesForForm({
        cpu: "2",
        memory: "8Gi",
        gpu: "1",
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          "virtualization.memory_mib": "8192",
          "virtualization.core_percent": "50",
        },
      }),
    ).toEqual({
      cpu: 2,
      memory: 8,
      gpu: 1,
      accelerator: {
        type: "nvidia_gpu",
        product: "Tesla-T4",
        virtualization: {
          memory_mib: 8192,
          core_percent: 50,
        },
      },
    });
  });

  it("normalizes MiB memory quantities to GiB values for the form", () => {
    expect(
      normalizeEndpointResourcesForForm({
        cpu: "2",
        memory: "8192Mi",
        gpu: "1",
        accelerator: null,
      }),
    ).toMatchObject({
      cpu: 2,
      memory: 8,
      gpu: 1,
      accelerator: null,
    });
  });

  it("normalizes endpoint records before refine writes query data into the form", () => {
    const record = {
      id: 1,
      spec: {
        resources: {
          cpu: "2",
          memory: "8Gi",
          gpu: "1",
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            "virtualization.memory_mib": "8192",
            "virtualization.core_percent": "50",
          },
        },
      },
    };

    expect(normalizeEndpointRecordForForm(record).spec.resources).toEqual({
      cpu: 2,
      memory: 8,
      gpu: 1,
      accelerator: {
        type: "nvidia_gpu",
        product: "Tesla-T4",
        virtualization: {
          memory_mib: 8192,
          core_percent: 50,
        },
      },
    });
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
        availableRegistryNames: null,
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
        availableRegistryNames: null,
      },
      mockT,
    );
    expect(errors["spec.replicas.num"]).toBeUndefined();
  });

  // A catalog written elsewhere names its author's registry. The picker shows an
  // unknown value as an empty box, so nothing else says the field is wrong.
  it("returns error when the registry is not in this workspace", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 1 }, ...validScheduler },
      {
        action: "create",
        currentRegistry: "someone-elses-registry",
        currentModelName: "",
        availableModelNames: null,
        availableRegistryNames: ["mine"],
      },
      mockT,
    );
    expect(errors["spec.model.registry"]).toBeDefined();
  });

  it("returns no error when the registry is in this workspace", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 1 }, ...validScheduler },
      {
        action: "create",
        currentRegistry: "mine",
        currentModelName: "",
        availableModelNames: null,
        availableRegistryNames: ["mine"],
      },
      mockT,
    );
    expect(errors["spec.model.registry"]).toBeUndefined();
  });

  it("skips the registry check while the listing has not resolved", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 1 }, ...validScheduler },
      {
        action: "create",
        currentRegistry: "someone-elses-registry",
        currentModelName: "",
        availableModelNames: null,
        availableRegistryNames: null,
      },
      mockT,
    );
    expect(errors["spec.model.registry"]).toBeUndefined();
  });

  // Editing an endpoint whose registry has since been removed must stay
  // editable — the field is not what the user came to change.
  it("skips the registry check in edit mode", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 1 }, ...validScheduler },
      {
        action: "edit",
        currentRegistry: "gone",
        currentModelName: "",
        availableModelNames: null,
        availableRegistryNames: ["mine"],
      },
      mockT,
    );
    expect(errors["spec.model.registry"]).toBeUndefined();
  });

  it("returns error when model not found in create mode", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 1 }, ...validScheduler },
      {
        action: "create",
        currentRegistry: "my-registry",
        currentModelName: "missing-model",
        availableModelNames: ["model-a", "model-b"],
        availableRegistryNames: null,
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
        availableRegistryNames: null,
      },
      mockT,
    );
    expect(errors["-model-catalog"]).toBeUndefined();
  });

  it("skips model check when availableModelNames is null (existence unknown)", () => {
    const errors = validateEndpointValues(
      { replicas: { num: 1 }, ...validScheduler },
      {
        action: "create",
        currentRegistry: "my-registry",
        currentModelName: "missing-model",
        availableModelNames: null,
        availableRegistryNames: null,
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
        availableRegistryNames: null,
      },
      mockT,
    );
    expect(errors["-model-catalog"]).toBeUndefined();
  });

  it("returns error when scheduler type is blank", () => {
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
        availableRegistryNames: null,
      },
      mockT,
    );
    expect(errors["spec.deployment_options.scheduler.type"]).toEqual({
      type: "manual",
      message: "endpoints.messages.schedulerTypeRequired",
    });
  });

  it("returns error when deployment_options are missing", () => {
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
        availableRegistryNames: null,
      },
      mockT,
    );
    expect(errors["spec.deployment_options.scheduler.type"]).toEqual({
      type: "manual",
      message: "endpoints.messages.schedulerTypeRequired",
    });
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
        availableRegistryNames: null,
      },
      mockT,
    );
    expect(errors["spec.deployment_options.scheduler.type"]).toBeUndefined();
  });

  it("ignores memory_percent when memory_mib is set", () => {
    const errors = validateEndpointValues(
      {
        ...validScheduler,
        resources: {
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 10240,
              memory_percent: 50,
              core_percent: 30,
            },
          },
        },
      },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
        availableRegistryNames: null,
      },
      mockT,
    );

    expect(
      errors["spec.resources.accelerator.virtualization.memory_percent"],
    ).toBeUndefined();
    expect(
      errors["spec.resources.accelerator.virtualization.memory_mib"],
    ).toBeUndefined();
  });

  it("treats blank optional vGPU fields as not configured", () => {
    const errors = validateEndpointValues(
      {
        ...validScheduler,
        resources: {
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: "" as unknown as number,
              memory_percent: "" as unknown as number,
              core_percent: "" as unknown as number,
            },
          },
        },
      },
      {
        action: "edit",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
        availableRegistryNames: null,
      },
      mockT,
    );

    expect(errors).toEqual({});
  });

  it("ignores memory_percent and allows zero vGPU core percent as not configured", () => {
    const errors = validateEndpointValues(
      {
        ...validScheduler,
        resources: {
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_percent: 50,
              core_percent: 0,
            },
          },
        },
      },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
        availableRegistryNames: null,
      },
      mockT,
    );

    expect(
      errors["spec.resources.accelerator.virtualization.core_percent"],
    ).toBeUndefined();
  });

  it("returns error when vGPU core percent is out of range", () => {
    const errors = validateEndpointValues(
      {
        ...validScheduler,
        resources: {
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              core_percent: -1,
            },
          },
        },
      },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
        availableRegistryNames: null,
      },
      mockT,
    );

    expect(
      errors["spec.resources.accelerator.virtualization.memory_percent"],
    ).toBeUndefined();
    expect(
      errors["spec.resources.accelerator.virtualization.core_percent"]?.message,
    ).toBe("endpoints.messages.vgpuCorePercentRange");
  });
});

describe("validateEndpointValues GPU count precision", () => {
  const mockT = (key: string) => key;

  const scheduler = {
    deployment_options: { scheduler: { type: "consistent_hash" } },
  };

  const validate = (
    gpu: number | null,
    clusterType: "ssh" | "kubernetes" | undefined,
    accelerator?: { type?: string; product?: string } | null,
  ) => {
    return validateEndpointValues(
      {
        ...scheduler,
        resources: {
          gpu,
          accelerator:
            accelerator === undefined
              ? { type: "nvidia_gpu", product: "Tesla-T4" }
              : accelerator,
        },
      },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
        availableRegistryNames: null,
        clusterType,
      },
      mockT,
    );
  };

  it("allows ssh 0 as the unselect value", () => {
    expect(validate(0, "ssh")).toEqual({});
  });

  it("allows kubernetes 0 as the unselect value", () => {
    expect(validate(0, "kubernetes")).toEqual({});
  });

  it("allows ssh one-decimal counts below one", () => {
    for (const gpu of [0.1, 0.5, 0.9]) {
      expect(validate(gpu, "ssh")).toEqual({});
    }
  });

  it("allows ssh integer counts at or above one", () => {
    for (const gpu of [1, 2, 8]) {
      expect(validate(gpu, "ssh")).toEqual({});
    }
  });

  it("rejects ssh multi-decimal counts below one", () => {
    for (const gpu of [0.01, 0.15]) {
      const errors = validate(gpu, "ssh");
      expect(errors["spec.resources.gpu"]).toEqual({
        type: "manual",
        message: "endpoints.messages.gpuCountPrecisionSsh",
      });
    }
  });

  it("rejects ssh non-integer counts at or above one", () => {
    for (const gpu of [1.1, 1.5]) {
      const errors = validate(gpu, "ssh");
      expect(errors["spec.resources.gpu"]).toBeDefined();
    }
  });

  it("rejects ssh negative counts", () => {
    const errors = validate(-1, "ssh");
    expect(errors["spec.resources.gpu"]).toBeDefined();
  });

  it("allows kubernetes positive integer counts only", () => {
    for (const gpu of [1, 2, 8]) {
      expect(validate(gpu, "kubernetes")).toEqual({});
    }
  });

  it("rejects kubernetes fractional counts", () => {
    for (const gpu of [0.5, 1.5]) {
      const errors = validate(gpu, "kubernetes");
      expect(errors["spec.resources.gpu"]).toBeDefined();
    }
  });

  it("rejects kubernetes negative counts", () => {
    const errors = validate(-1, "kubernetes");
    expect(errors["spec.resources.gpu"]).toBeDefined();
  });

  it("skips precision validation when no accelerator is selected", () => {
    expect(validate(1.5, "ssh", null)).toEqual({});
  });

  it("skips precision validation when accelerator product is missing", () => {
    expect(validate(1.5, "ssh", { type: "nvidia_gpu", product: "" })).toEqual(
      {},
    );
  });

  it("skips precision validation when cluster type is unknown", () => {
    expect(validate(1.5, undefined)).toEqual({});
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
