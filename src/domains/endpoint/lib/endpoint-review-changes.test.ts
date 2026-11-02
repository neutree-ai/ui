import { describe, expect, it } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";
import {
  endpointReviewChanges,
  formatEndpointReviewValue,
} from "./endpoint-review-changes";

const endpoint = {
  metadata: { name: "chat", workspace: "default" },
  spec: {
    cluster: "cluster-a",
    replicas: { num: 1 },
    model: {
      registry: "registry-a",
      name: "model-a",
      version: "",
      file: "",
      task: "text-generation",
    },
    engine: { engine: "vllm", version: "0.31.0" },
    resources: {
      cpu: 4,
      memory: 8,
      gpu: 1,
      accelerator: {
        type: "nvidia_gpu",
        product: "H100",
        virtualization: { memory_mib: 8192, core_percent: 50 },
      },
    },
    kv_cache: null,
    deployment_options: { scheduler: { type: "consistent_hash" } },
    variables: { engine_args: { max_model_len: 32768 } },
    env: { A: "1" },
  },
} as unknown as Endpoint;

const changed = (overrides: Record<string, unknown>) =>
  ({
    ...endpoint,
    spec: { ...endpoint.spec, ...overrides } as unknown as Endpoint["spec"],
  }) as Endpoint;

const setAtPath = (
  source: Endpoint,
  path: readonly string[],
  value: unknown,
) => {
  const next = structuredClone(source) as unknown as Record<string, unknown>;
  let target = next;
  for (const key of path.slice(0, -1)) {
    target = target[key] as Record<string, unknown>;
  }
  target[path.at(-1)!] = structuredClone(value);
  return next as unknown as Endpoint;
};

const valueAtPath = (source: Endpoint, path: readonly string[]) => {
  let value: unknown = source;
  for (const key of path) {
    value = (value as Record<string, unknown>)[key];
  }
  return value;
};

const reviewFieldCases: Array<{
  step: number;
  label: string;
  path: readonly string[];
  value: unknown;
  restoreAsString?: boolean;
}> = [
  {
    step: 0,
    label: "endpoints.fields.replicas",
    path: ["spec", "replicas", "num"],
    value: 2,
    restoreAsString: true,
  },
  {
    step: 0,
    label: "endpoints.fields.modelRegistry",
    path: ["spec", "model", "registry"],
    value: "registry-b",
  },
  {
    step: 0,
    label: "endpoints.fields.modelName",
    path: ["spec", "model", "name"],
    value: "model-b",
  },
  {
    step: 0,
    label: "endpoints.fields.modelVersion",
    path: ["spec", "model", "version"],
    value: "2.0",
  },
  {
    step: 0,
    label: "endpoints.fields.modelFile",
    path: ["spec", "model", "file"],
    value: "model-b.safetensors",
  },
  {
    step: 1,
    label: "common.fields.cluster",
    path: ["spec", "cluster"],
    value: "cluster-b",
  },
  {
    step: 1,
    label: "common.fields.cpu",
    path: ["spec", "resources", "cpu"],
    value: 8,
    restoreAsString: true,
  },
  {
    step: 1,
    label: "common.fields.memory",
    path: ["spec", "resources", "memory"],
    value: 16,
    restoreAsString: true,
  },
  {
    step: 1,
    label: "endpoints.fields.physicalGpu",
    path: ["spec", "resources", "gpu"],
    value: 2,
    restoreAsString: true,
  },
  {
    step: 1,
    label: "endpoints.fields.accelerator",
    path: ["spec", "resources", "accelerator", "product"],
    value: "H200",
  },
  {
    step: 1,
    label: "endpoints.fields.vgpuMemory",
    path: ["spec", "resources", "accelerator", "virtualization", "memory_mib"],
    value: 4096,
    restoreAsString: true,
  },
  {
    step: 1,
    label: "endpoints.fields.vgpuCoreLimit",
    path: [
      "spec",
      "resources",
      "accelerator",
      "virtualization",
      "core_percent",
    ],
    value: 25,
    restoreAsString: true,
  },
  {
    step: 2,
    label: "endpoints.fields.taskType",
    path: ["spec", "model", "task"],
    value: "text-embedding",
  },
  {
    step: 2,
    label: "common.fields.engine",
    path: ["spec", "engine", "engine"],
    value: "sglang",
  },
  {
    step: 2,
    label: "endpoints.fields.engineVersion",
    path: ["spec", "engine", "version"],
    value: "0.32.0",
  },
  {
    step: 2,
    label: "endpoints.sections.kvCache",
    path: ["spec", "kv_cache"],
    value: { provider: "zcache", options: { timeout_seconds: 5 } },
  },
  {
    step: 3,
    label: "endpoints.fields.schedulerType",
    path: ["spec", "deployment_options", "scheduler", "type"],
    value: "round_robin",
  },
  {
    step: 3,
    label: "endpoints.fields.engineVariables",
    path: ["spec", "variables", "engine_args"],
    value: { max_model_len: 65536 },
  },
  {
    step: 3,
    label: "endpoints.fields.environment",
    path: ["spec", "env", "A"],
    value: "2",
  },
];

describe("endpointReviewChanges", () => {
  it("returns no changes for equivalent empty and missing values", () => {
    expect(
      endpointReviewChanges(
        changed({
          model: { ...endpoint.spec.model, version: "", file: "" },
        }),
        endpoint,
      ),
    ).toEqual([]);
  });

  it("treats numeric form input strings as their persisted numeric values", () => {
    const baseline = changed({
      kv_cache: {
        provider: "zcache",
        options: { timeout_seconds: 5 },
      },
    });
    const current = changed({
      replicas: { num: "1" },
      resources: {
        ...endpoint.spec.resources!,
        cpu: "4",
        memory: "8",
        gpu: "1",
        accelerator: {
          ...endpoint.spec.resources!.accelerator,
          virtualization: { memory_mib: "8192", core_percent: "50" },
        },
      },
      kv_cache: {
        provider: "zcache",
        options: { timeout_seconds: "5" },
      },
    }) as unknown as Endpoint;

    expect(endpointReviewChanges(current, baseline)).toEqual([]);
  });

  it.each(reviewFieldCases)(
    "detects $label and clears it after the value is restored",
    ({ step, label, path, value, restoreAsString }) => {
      const modified = setAtPath(endpoint, path, value);

      expect(
        endpointReviewChanges(modified, endpoint).map((change) => ({
          step: change.step,
          label: change.label,
        })),
      ).toEqual([{ step, label }]);

      const original = valueAtPath(endpoint, path);
      const restored = setAtPath(
        modified,
        path,
        restoreAsString ? String(original) : original,
      );

      expect(endpointReviewChanges(restored, endpoint)).toEqual([]);
    },
  );

  it("maps changed fields to their editable wizard steps", () => {
    const current = changed({
      replicas: { num: 2 },
      resources: { ...endpoint.spec.resources, cpu: 8 },
      engine: { engine: "vllm", version: "0.32.0" },
      variables: { engine_args: { max_model_len: 65536 } },
    });

    const changes = endpointReviewChanges(current, endpoint);

    expect(
      changes.map((change) => ({
        step: change.step,
        label: change.label,
        before: change.before,
        after: change.after,
      })),
    ).toEqual([
      {
        step: 0,
        label: "endpoints.fields.replicas",
        before: 1,
        after: 2,
      },
      {
        step: 1,
        label: "common.fields.cpu",
        before: 4,
        after: 8,
      },
      {
        step: 2,
        label: "endpoints.fields.engineVersion",
        before: "0.31.0",
        after: "0.32.0",
      },
      {
        step: 3,
        label: "endpoints.fields.engineVariables",
        before: { max_model_len: 32768 },
        after: { max_model_len: 65536 },
      },
    ]);
  });

  it("ignores object key order and reports cache changes", () => {
    const current = changed({
      variables: {
        engine_args: { b: 2, a: 1 },
      },
      kv_cache: {
        provider: "zcache",
        options: { timeout_seconds: 5 },
      },
    });
    const baseline = changed({
      variables: {
        engine_args: { a: 1, b: 2 },
      },
    });

    expect(endpointReviewChanges(current, baseline)).toEqual([
      {
        step: 2,
        label: "endpoints.sections.kvCache",
        before: null,
        after: {
          provider: "zcache",
          options: { timeout_seconds: 5 },
        },
        format: "cache",
      },
    ]);
  });
});

describe("formatEndpointReviewValue", () => {
  it("formats structured and cache values compactly", () => {
    expect(formatEndpointReviewValue({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
    expect(
      formatEndpointReviewValue(
        { provider: "zcache", options: { timeout_seconds: 5 } },
        "cache",
      ),
    ).toBe("zcache · 5s");
  });
});
