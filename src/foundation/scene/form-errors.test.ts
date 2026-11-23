import { describe, expect, it } from "vitest";
import { nestFieldErrors } from "./form-errors";

describe("nestFieldErrors", () => {
  it("converts dotted validator paths into the resolver error tree", () => {
    expect(
      nestFieldErrors({
        "metadata.name": { type: "required", message: "Name is required" },
        "spec.cluster": { type: "required", message: "Cluster is required" },
        "spec.engine.version": {
          type: "required",
          message: "Version is required",
        },
      }),
    ).toEqual({
      metadata: {
        name: { type: "required", message: "Name is required" },
      },
      spec: {
        cluster: { type: "required", message: "Cluster is required" },
        engine: {
          version: { type: "required", message: "Version is required" },
        },
      },
    });
  });

  it("keeps a form-only path as one key", () => {
    expect(
      nestFieldErrors({
        "-model-catalog": { type: "manual", message: "Model not found" },
      }),
    ).toEqual({
      "-model-catalog": { type: "manual", message: "Model not found" },
    });
  });

  it("returns an empty tree when validation passes", () => {
    expect(nestFieldErrors({})).toEqual({});
  });
});
