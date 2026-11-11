import { describe, expect, it } from "vitest";
import { makeEndpoint } from "@/domains/endpoint/testing/builders";
import { endpointCacheErrorMessage } from "./endpoint-cache-errors";
import {
  endpointDirtySteps,
  endpointErrorsByStep,
  endpointServerIssue,
  endpointStepCompletions,
  endpointStepStatus,
  endpointStepValidationPaths,
  endpointWizardIssues,
  firstEndpointErrorPath,
  firstEndpointErrorStep,
} from "./endpoint-wizard";

const complete = makeEndpoint({
  spec: {
    resources: {
      cpu: 4,
      memory: 16,
      gpu: 1,
      accelerator: { type: "nvidia_gpu", product: "L40S" },
    },
  },
});

describe("endpoint wizard error mapping", () => {
  it("groups nested field errors under the step that owns the field", () => {
    const grouped = endpointErrorsByStep({
      metadata: {
        name: { type: "required", message: "Name is required" },
      },
      spec: {
        resources: {
          gpu: { type: "min", message: "GPU is required" },
        },
        engine: {
          version: { type: "required", message: "Version is required" },
        },
        model: {
          task: { type: "required", message: "Task is required" },
        },
        variables: {
          engine_args: {
            max_model_len: {
              type: "min",
              message: "Context must be positive",
            },
          },
        },
      },
    });

    expect(grouped[0]).toEqual(["Name is required"]);
    expect(grouped[1]).toEqual(["GPU is required"]);
    expect(grouped[2]).toEqual(["Version is required", "Task is required"]);
    expect(grouped[3]).toEqual(["Context must be positive"]);
  });

  it("returns the earliest actionable step", () => {
    expect(
      firstEndpointErrorStep({
        spec: {
          kv_cache: {
            options: {
              timeout_seconds: {
                type: "min",
                message: "Timeout is invalid",
              },
            },
          },
          cluster: { type: "required", message: "Cluster is required" },
        },
      }),
    ).toBe(1);
  });

  it("marks model task changes with the runtime step that renders it", () => {
    expect(
      endpointDirtySteps({
        spec: {
          model: { task: true },
          engine: { engine: true },
        },
      }),
    ).toEqual(new Set([2]));
  });

  it("returns null for a valid form", () => {
    expect(firstEndpointErrorStep({})).toBeNull();
  });

  it("finds the first invalid field on a step to focus", () => {
    const errors = {
      metadata: { name: { type: "required", message: "Name is required" } },
      spec: {
        resources: { cpu: { type: "min", message: "CPU" } },
        cluster: { type: "required", message: "Cluster" },
      },
    };

    expect(firstEndpointErrorPath(errors, 1)).toBe("spec.resources.cpu");
    expect(firstEndpointErrorPath(errors, 2)).toBeNull();
  });

  it("uses the model step for an error path the wizard does not recognize", () => {
    expect(
      firstEndpointErrorStep({
        unexpected: { type: "manual", message: "Unexpected error" },
      }),
    ).toBe(0);
  });

  it("maps modified fields to their wizard steps", () => {
    expect(
      endpointDirtySteps({
        metadata: { name: true },
        spec: {
          cluster: true,
          resources: { gpu: true },
          engine: { engine: true },
          env: { HF_TOKEN: true },
        },
      }),
    ).toEqual(new Set([0, 1, 2, 3]));
  });

  it("counts each field error even when messages are identical", () => {
    expect(
      endpointWizardIssues(
        {
          0: [
            "Name is required",
            "This field is required",
            "This field is required",
          ],
          1: ["GPU is required"],
        },
        "Capacity is insufficient",
        { step: 4, message: "Server rejected" },
      ),
    ).toEqual([
      { step: 0, message: "Name is required", source: "validation" },
      { step: 0, message: "This field is required", source: "validation" },
      { step: 0, message: "This field is required", source: "validation" },
      { step: 1, message: "GPU is required", source: "validation" },
      {
        step: 1,
        message: "Capacity is insufficient",
        source: "capacity",
      },
      { step: 4, message: "Server rejected", source: "server" },
    ]);
  });

  it.each([
    {
      mode: "create",
      active: false,
      issueCount: 2,
      modified: false,
      completion: "complete",
      status: "attention",
    },
    {
      mode: "edit",
      active: false,
      issueCount: 0,
      modified: true,
      completion: "complete",
      status: "modified",
    },
    {
      mode: "create",
      active: false,
      issueCount: 0,
      modified: false,
      completion: "complete",
      status: "completed",
    },
    {
      mode: "create",
      active: true,
      issueCount: 0,
      modified: false,
      completion: "complete",
      status: "current",
    },
    {
      mode: "create",
      active: true,
      issueCount: 0,
      modified: false,
      completion: "in-progress",
      status: "in-progress",
    },
    {
      mode: "edit",
      active: false,
      issueCount: 0,
      modified: false,
      completion: "in-progress",
      status: "pending",
    },
    {
      mode: "create",
      active: false,
      issueCount: 0,
      modified: false,
      completion: "not-started",
      status: "pending",
    },
  ] as const)(
    "$mode step (active $active, $issueCount issues, modified $modified, $completion) -> $status",
    ({ status, ...step }) => {
      expect(endpointStepStatus(step)).toBe(status);
    },
  );

  it("defines a disjoint validation scope for each wizard step", () => {
    expect(endpointStepValidationPaths[0]).toEqual(
      expect.arrayContaining([
        "metadata.name",
        "metadata.workspace",
        "spec.replicas.num",
        "spec.model.registry",
        "spec.model.name",
      ]),
    );
    expect(endpointStepValidationPaths[0]).not.toContain("spec.model.task");
    expect(endpointStepValidationPaths[1]).toEqual([
      "spec.cluster",
      "spec.resources",
    ]);
    expect(endpointStepValidationPaths[2]).toEqual(
      expect.arrayContaining(["spec.engine", "spec.model.task"]),
    );
    expect(endpointStepValidationPaths[4]).toEqual([]);
  });

  it("separates untouched, in-progress and completed create steps", () => {
    const base = makeEndpoint({
      metadata: { name: "" },
      spec: {
        cluster: "",
        model: { registry: "", name: "", version: "", file: "", task: "" },
        engine: { engine: "", version: "" },
        resources: { cpu: 0, memory: 0, gpu: 0, accelerator: null },
      },
    });

    expect(endpointStepCompletions(base, true)[0]).toBe("not-started");

    const inProgress = structuredClone(base);
    inProgress.metadata.name = "chat";
    expect(endpointStepCompletions(inProgress, true)[0]).toBe("in-progress");

    expect(endpointStepCompletions(complete, true)).toMatchObject({
      0: "complete",
      1: "complete",
      2: "complete",
      3: "complete",
    });
  });

  it("keeps the model step complete when its task is still missing", () => {
    const values = structuredClone(complete);
    values.spec.model!.task = "";

    expect(endpointStepCompletions(values, true)).toMatchObject({
      0: "complete",
      1: "complete",
      2: "in-progress",
    });
  });

  it("maps stable server codes to steps without parsing the message", () => {
    expect(
      endpointServerIssue(
        { code: "10232", message: "server wording can change" },
        "fallback",
      ),
    ).toEqual({
      step: 2,
      path: undefined,
      message: "server wording can change",
    });
    expect(
      endpointServerIssue(
        { code: "10234", message: "endpoint identity is immutable" },
        "fallback",
      ),
    ).toEqual({
      step: 0,
      path: undefined,
      message: "endpoint identity is immutable",
    });
    expect(
      endpointServerIssue({ statusCode: 409, message: "conflict" }, "fallback"),
    ).toEqual({
      step: 0,
      path: "metadata.name",
      message: "conflict",
    });
    expect(
      endpointServerIssue(
        { code: "PGRST", message: 'duplicate key value "chat" (23505)' },
        "fallback",
      ),
    ).toEqual({
      step: 0,
      path: "metadata.name",
      message: 'duplicate key value "chat" (23505)',
    });
    expect(
      endpointServerIssue({ code: "unknown", message: "" }, "fallback"),
    ).toEqual({
      step: 4,
      path: undefined,
      message: "fallback",
    });
    expect(endpointServerIssue(null, "fallback")).toEqual({
      step: 4,
      path: undefined,
      message: "fallback",
    });
    expect(
      endpointServerIssue(
        { field: "spec.engine.version", message: "unsupported version" },
        "fallback",
      ),
    ).toEqual({
      step: 2,
      path: "spec.engine.version",
      message: "unsupported version",
    });
    expect(
      endpointServerIssue(
        {
          code: "ENDPOINT_CACHE_CUSTOM_OVERRIDE",
          hint: "LMCACHE_CHUNK_SIZE",
          message: "remove custom LMCACHE_CHUNK_SIZE",
        },
        "fallback",
        (err) =>
          endpointCacheErrorMessage(
            (key, options) => `${key}:${String(options?.hint ?? "")}`,
            err,
          ),
      ),
    ).toEqual({
      step: 3,
      path: undefined,
      message:
        "endpoints.kvCacheSettings.errors.customOverride:LMCACHE_CHUNK_SIZE",
    });
  });
});
