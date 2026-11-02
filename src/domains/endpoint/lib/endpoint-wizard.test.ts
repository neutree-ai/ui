import { describe, expect, it } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";
import {
  endpointDirtySteps,
  endpointErrorsByStep,
  endpointServerIssue,
  endpointStepCompletions,
  endpointStepValidationPaths,
  endpointWizardIssues,
  firstEndpointErrorStep,
} from "./endpoint-wizard";

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
    ]);
  });

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
    const base = {
      metadata: { name: "", workspace: "default" },
      spec: {
        cluster: "",
        model: { registry: "", name: "", version: "", file: "", task: "" },
        engine: { engine: "", version: "" },
        resources: { cpu: 0, memory: 0, gpu: 0, accelerator: null },
        replicas: { num: 1 },
      },
    } as unknown as Endpoint;

    expect(endpointStepCompletions(base, true)[0]).toBe("not-started");

    const inProgress = structuredClone(base);
    inProgress.metadata.name = "chat";
    expect(endpointStepCompletions(inProgress, true)[0]).toBe("in-progress");

    const complete = structuredClone(inProgress);
    complete.spec.model = {
      registry: "hf",
      name: "org/model",
      version: "",
      file: "",
      task: "text-generation",
    };
    complete.spec.cluster = "cluster-a";
    complete.spec.resources = {
      cpu: 4,
      memory: 16,
      gpu: 1,
      accelerator: { type: "nvidia_gpu", product: "L40S" },
    };
    complete.spec.engine = { engine: "vllm", version: "v0.32.0" };

    expect(endpointStepCompletions(complete, true)).toMatchObject({
      0: "complete",
      1: "complete",
      2: "complete",
      3: "complete",
    });
  });

  it("keeps the model step complete when its task is still missing", () => {
    const values = {
      metadata: { name: "chat", workspace: "default" },
      spec: {
        cluster: "cluster-a",
        model: {
          registry: "hf",
          name: "org/model",
          version: "",
          file: "",
          task: "",
        },
        engine: { engine: "vllm", version: "v0.32.0" },
        resources: {
          cpu: 4,
          memory: 16,
          gpu: 1,
          accelerator: { type: "nvidia_gpu", product: "L40S" },
        },
        replicas: { num: 1 },
      },
    } as unknown as Endpoint;

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
      endpointServerIssue({ code: "unknown", message: "" }, "fallback"),
    ).toEqual({
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
  });
});
