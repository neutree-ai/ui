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
  it.each([
    // 3 requested vs 2.9 free on the target node -> over-allocated.
    { requested: 3, available: 2.9, total: 15.7, exceeded: true },
    { requested: 2, available: 2.9, total: 15.7, exceeded: false },
    { requested: 2.9, available: 2.9, total: 15.7, exceeded: false },
    // The CPU field steps by 0.1, so 0.1 × 3 replicas is 0.30000000000000004.
    { requested: 0.1 * 3, available: 0.3, total: 15.7, exceeded: false },
    { requested: 0, available: 0, total: 15.7, exceeded: false },
    // No cluster selected / no resource data yet -> avoid false positives.
    { requested: 3, available: 0, total: 0, exceeded: false },
  ])(
    "$requested of $available available (total $total) -> exceeded: $exceeded",
    ({ requested, available, total, exceeded }) => {
      expect(isResourceRequestExceeded(requested, available, total)).toBe(
        exceeded,
      );
    },
  );
});

describe("validateCurrentUsage", () => {
  it.each([
    { usage: 4, capacity: 8, kept: 4 },
    { usage: 8, capacity: 8, kept: 8 },
    { usage: 10, capacity: 8, kept: 0 },
    { usage: 0, capacity: 8, kept: 0 },
  ])("$usage of $capacity -> $kept", ({ usage, capacity, kept }) => {
    expect(validateCurrentUsage(usage, capacity)).toBe(kept);
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
  type Spec = Parameters<typeof validateEndpointValues>[0];
  type Context = Parameters<typeof validateEndpointValues>[1];

  const t = (key: string) => key;

  const validate = (spec: Spec, context: Partial<Context> = {}) =>
    validateEndpointValues(
      {
        replicas: { num: 1 },
        deployment_options: { scheduler: { type: "consistent_hash" } },
        ...spec,
      },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
        availableRegistryNames: null,
        ...context,
      },
      t,
    );

  it.each([
    { num: 0, error: true },
    { num: 2, error: false },
  ])("replicas $num -> error: $error", ({ num, error }) => {
    expect(Boolean(validate({ replicas: { num } })["spec.replicas.num"])).toBe(
      error,
    );
  });

  // A catalog written elsewhere names its author's registry. The picker shows
  // an unknown value as an empty box, so nothing else says the field is wrong.
  // Editing an endpoint whose registry has since been removed must stay
  // editable, and an unresolved listing must not block submit.
  it.each([
    { action: "create", registry: "elsewhere", listed: ["mine"], error: true },
    { action: "create", registry: "mine", listed: ["mine"], error: false },
    { action: "create", registry: "elsewhere", listed: null, error: false },
    { action: "edit", registry: "gone", listed: ["mine"], error: false },
  ] as const)(
    "$action with registry $registry among $listed -> error: $error",
    ({ action, registry, listed, error }) => {
      const errors = validate(
        {},
        {
          action,
          currentRegistry: registry,
          availableModelNames: null,
          availableRegistryNames: listed ? [...listed] : null,
        },
      );
      expect(Boolean(errors["spec.model.registry"])).toBe(error);
    },
  );

  // `null` model names mean the existence lookup has not resolved.
  it.each([
    {
      action: "create",
      model: "missing-model",
      found: ["model-a"],
      error: true,
    },
    { action: "create", model: "model-a", found: ["model-a"], error: false },
    { action: "create", model: "missing-model", found: null, error: false },
    { action: "edit", model: "missing-model", found: [], error: false },
  ] as const)(
    "$action with model $model among $found -> error: $error",
    ({ action, model, found, error }) => {
      const errors = validate(
        {},
        {
          action,
          currentRegistry: "my-registry",
          currentModelName: model,
          availableModelNames: found ? [...found] : null,
        },
      );
      expect(Boolean(errors["-model-catalog"])).toBe(error);
    },
  );

  it.each([
    { deployment_options: { scheduler: { type: "" } }, error: true },
    { deployment_options: null, error: true },
    { deployment_options: { scheduler: { type: "roundrobin" } }, error: false },
  ])(
    "scheduler $deployment_options -> error: $error",
    ({ deployment_options, error }) => {
      const message = validate({ deployment_options })[
        "spec.deployment_options.scheduler.type"
      ]?.message;
      expect(message).toBe(
        error ? "endpoints.messages.schedulerTypeRequired" : undefined,
      );
    },
  );

  const withVirtualization = (
    virtualization: Record<string, unknown>,
  ): Spec => ({
    resources: {
      accelerator: {
        type: "nvidia_gpu",
        product: "Tesla-T4",
        virtualization: virtualization as never,
      },
    },
  });

  it.each([
    { memory_mib: 10240, memory_percent: 50, core_percent: 30 },
    // Blank optional fields are not configured.
    { memory_mib: "", memory_percent: "", core_percent: "" },
    // memory_percent is ignored and a zero core percent is not configured.
    { memory_percent: 50, core_percent: 0 },
  ])("accepts vGPU virtualization %o", (virtualization) => {
    expect(validate(withVirtualization(virtualization))).toEqual({});
  });

  it("returns error when vGPU core percent is out of range", () => {
    const errors = validate(withVirtualization({ core_percent: -1 }));

    expect(
      errors["spec.resources.accelerator.virtualization.core_percent"]?.message,
    ).toBe("endpoints.messages.vgpuCorePercentRange");
  });
});

describe("validateEndpointValues GPU count precision", () => {
  const validate = (
    gpu: number,
    clusterType: "ssh" | "kubernetes" | undefined,
    accelerator: { type?: string; product?: string } | null = {
      type: "nvidia_gpu",
      product: "Tesla-T4",
    },
  ) =>
    validateEndpointValues(
      {
        deployment_options: { scheduler: { type: "consistent_hash" } },
        resources: { gpu, accelerator },
      },
      {
        action: "create",
        currentRegistry: "",
        currentModelName: "",
        availableModelNames: [],
        availableRegistryNames: null,
        clusterType,
      },
      (key) => key,
    );

  // 0 is the unselect value on both cluster types; ssh takes one decimal below
  // one card and whole cards above it, kubernetes whole cards only.
  it.each([
    { gpu: 0, cluster: "ssh", error: false },
    { gpu: 0, cluster: "kubernetes", error: false },
    { gpu: 0.1, cluster: "ssh", error: false },
    { gpu: 0.9, cluster: "ssh", error: false },
    { gpu: 1, cluster: "ssh", error: false },
    { gpu: 8, cluster: "ssh", error: false },
    { gpu: 0.01, cluster: "ssh", error: true },
    { gpu: 0.15, cluster: "ssh", error: true },
    { gpu: 1.5, cluster: "ssh", error: true },
    { gpu: -1, cluster: "ssh", error: true },
    { gpu: 2, cluster: "kubernetes", error: false },
    { gpu: 0.5, cluster: "kubernetes", error: true },
    { gpu: 1.5, cluster: "kubernetes", error: true },
    { gpu: -1, cluster: "kubernetes", error: true },
  ] as const)(
    "count $gpu on $cluster -> error: $error",
    ({ gpu, cluster, error }) => {
      expect(Boolean(validate(gpu, cluster)["spec.resources.gpu"])).toBe(error);
    },
  );

  it("names the ssh precision rule in its message", () => {
    expect(validate(0.15, "ssh")["spec.resources.gpu"]).toEqual({
      type: "manual",
      message: "endpoints.messages.gpuCountPrecisionSsh",
    });
  });

  it.each([
    { accelerator: null, cluster: "ssh" },
    { accelerator: { type: "nvidia_gpu", product: "" }, cluster: "ssh" },
    { accelerator: undefined, cluster: undefined },
  ] as const)(
    "skips precision validation for $accelerator on $cluster",
    ({ accelerator, cluster }) => {
      expect(validate(1.5, cluster, accelerator)).toEqual({});
    },
  );
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

    // Catalog values override defaults; a key the catalog is silent about
    // comes back as the default rather than being left off, which is what
    // clears the previous catalog's value off the form.
    expect(result.model).toEqual({
      name: "llama-3",
      version: "",
      registry: "hf",
      file: "",
      task: "",
      info: null,
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
