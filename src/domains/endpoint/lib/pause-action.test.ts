import { describe, expect, it } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";
import {
  computeTogglePayload,
  derivePauseState,
  LAST_REPLICA_LABEL,
  parseReplicaCount,
} from "./pause-action";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEndpoint(
  overrides: {
    replicas?: { num: number } | null;
    labels?: Record<string, unknown> | null;
  } = {},
): Endpoint {
  return {
    id: 1,
    api_version: "v1",
    kind: "Endpoint",
    metadata: {
      name: "ep-1",
      workspace: "ws-1",
      labels: overrides.labels ?? null,
    },
    spec: {
      cluster: "cluster-1",
      model: {
        name: "model-1",
        source: "HuggingFace",
        task: "text-generation",
      },
      engine: { engine: "vllm" },
      resources: null,
      replicas: overrides.replicas ?? null,
      deployment_options: null,
      variables: null,
      env: null,
    },
    status: null,
  } as unknown as Endpoint;
}

// ---------------------------------------------------------------------------
// parseReplicaCount
// ---------------------------------------------------------------------------

describe("parseReplicaCount", () => {
  it("returns the number for a valid positive string", () => {
    expect(parseReplicaCount("3")).toBe(3);
  });

  it("returns the number for a numeric value", () => {
    expect(parseReplicaCount(5)).toBe(5);
  });

  it("returns undefined for zero", () => {
    expect(parseReplicaCount(0)).toBeUndefined();
  });

  it("returns undefined for negative", () => {
    expect(parseReplicaCount(-1)).toBeUndefined();
  });

  it("returns undefined for NaN string", () => {
    expect(parseReplicaCount("abc")).toBeUndefined();
  });

  it("returns undefined for null/undefined", () => {
    expect(parseReplicaCount(null)).toBeUndefined();
    expect(parseReplicaCount(undefined)).toBeUndefined();
  });

  it("returns undefined for Infinity", () => {
    expect(parseReplicaCount(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// derivePauseState
// ---------------------------------------------------------------------------

describe("derivePauseState", () => {
  it("running endpoint (replicas > 0) is not paused", () => {
    const ep = makeEndpoint({ replicas: { num: 2 } });
    const state = derivePauseState(ep);
    expect(state.isPaused).toBe(false);
    expect(state.replicaCount).toBe(2);
    expect(state.resumeReplicaCount).toBe(2);
  });

  it("paused endpoint (replicas = 0) with stored count resumes to stored count", () => {
    const ep = makeEndpoint({
      replicas: { num: 0 },
      labels: { [LAST_REPLICA_LABEL]: "4" },
    });
    const state = derivePauseState(ep);
    expect(state.isPaused).toBe(true);
    expect(state.replicaCount).toBe(0);
    expect(state.resumeReplicaCount).toBe(4);
  });

  it("paused endpoint without stored count resumes to 1", () => {
    const ep = makeEndpoint({ replicas: { num: 0 } });
    const state = derivePauseState(ep);
    expect(state.isPaused).toBe(true);
    expect(state.resumeReplicaCount).toBe(1);
  });

  it("null replicas defaults to replicaCount 1 (not paused)", () => {
    const ep = makeEndpoint({ replicas: null });
    const state = derivePauseState(ep);
    expect(state.isPaused).toBe(false);
    expect(state.replicaCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeTogglePayload
// ---------------------------------------------------------------------------

describe("computeTogglePayload", () => {
  it("pausing sets replicas to 0 and stores previous count in label", () => {
    const ep = makeEndpoint({ replicas: { num: 3 } });
    const payload = computeTogglePayload(ep);
    expect(payload.nextReplicaCount).toBe(0);
    expect(payload.nextLabels).toEqual({
      [LAST_REPLICA_LABEL]: "3",
    });
  });

  it("resuming restores stored replica count and removes label", () => {
    const ep = makeEndpoint({
      replicas: { num: 0 },
      labels: { [LAST_REPLICA_LABEL]: "5" },
    });
    const payload = computeTogglePayload(ep);
    expect(payload.nextReplicaCount).toBe(5);
    expect(payload.nextLabels).toBeNull();
  });

  it("resuming without stored count defaults to 1", () => {
    const ep = makeEndpoint({ replicas: { num: 0 } });
    const payload = computeTogglePayload(ep);
    expect(payload.nextReplicaCount).toBe(1);
    expect(payload.nextLabels).toBeNull();
  });

  it("pausing preserves existing labels", () => {
    const ep = makeEndpoint({
      replicas: { num: 2 },
      labels: { "custom-key": "value" },
    });
    const payload = computeTogglePayload(ep);
    expect(payload.nextReplicaCount).toBe(0);
    expect(payload.nextLabels).toEqual({
      "custom-key": "value",
      [LAST_REPLICA_LABEL]: "2",
    });
  });

  it("resuming preserves other labels but removes replica label", () => {
    const ep = makeEndpoint({
      replicas: { num: 0 },
      labels: {
        "custom-key": "value",
        [LAST_REPLICA_LABEL]: "3",
      },
    });
    const payload = computeTogglePayload(ep);
    expect(payload.nextReplicaCount).toBe(3);
    expect(payload.nextLabels).toEqual({ "custom-key": "value" });
  });
});
