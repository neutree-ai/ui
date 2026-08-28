import { render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/domains/endpoint/components/KVCacheEstimate", () => ({
  KVCacheEstimate: ({
    onEstimate,
  }: {
    onEstimate?: (gb: number | null) => void;
  }) => {
    // Stands in for the real panel's own effect, which reports its current
    // total upward as it recomputes — fixed here so the combined-requirement
    // math above it is testable without the real estimator's inputs.
    useEffect(() => {
      onEstimate?.(10);
    }, [onEstimate]);
    return <div data-testid="kv-cache-estimate" />;
  },
}));

import {
  type EngineCacheArgs,
  NO_ENGINE_CACHE_ARG_CONTROLS,
} from "@/domains/endpoint/lib/engine-cache-args";
import type { ModelInfoRead } from "@/foundation/lib/model-info-read";
import { EndpointWeightsEstimate } from "./EndpointWeightsEstimate";

const kvCache = {
  read: { state: "ready", info: {} } as unknown as ModelInfoRead,
  engineArgs: {} as EngineCacheArgs,
  controls: NO_ENGINE_CACHE_ARG_CONTROLS,
  modelKey: "hf:qwen:v1",
};

const declared = {
  perReplicaGb: 48,
  replicas: 2,
  info: { parameter_count: "35B", quantization: "fp8" },
  accelerator: {},
};

describe("EndpointWeightsEstimate", () => {
  // Two different questions — what the catalog measured, and what this
  // deployment's context and concurrency work out to — kept as two blocks so
  // they cannot read as one number.
  it("shows both halves when deploying from a catalog", () => {
    render(<EndpointWeightsEstimate declared={declared} kvCache={kvCache} />);

    const block = screen.getByTestId("endpoint-declared-weights");
    // The requirement and the check on it are one statement, not a number and
    // a comparison of it stated separately.
    expect(within(block).getByTestId("vram-check-badge")).toBeDefined();
    expect(within(block).getByText("35B")).toBeDefined();
    expect(within(block).getByText("fp8")).toBeDefined();
    expect(screen.getByTestId("kv-cache-estimate")).toBeDefined();
  });

  it("shows only the estimate when there is no catalog", () => {
    render(<EndpointWeightsEstimate declared={null} kvCache={kvCache} />);

    expect(screen.queryByTestId("endpoint-declared-weights")).toBeNull();
    expect(screen.getByTestId("kv-cache-estimate")).toBeDefined();
  });

  // An engine serving a model baked into its image has no checkpoint to
  // compute from, but the catalog can still state what it needs.
  it("shows only the declared half when there is nothing to estimate from", () => {
    render(<EndpointWeightsEstimate declared={declared} kvCache={null} />);

    expect(screen.getByTestId("endpoint-declared-weights")).toBeDefined();
    expect(screen.queryByTestId("kv-cache-estimate")).toBeNull();
  });

  // The badge speaks per replica, which is what a GPU allocation is measured
  // against; the fleet total is a different question and only arises above one.
  it("states the fleet total only when there is more than one replica", () => {
    const { rerender } = render(
      <EndpointWeightsEstimate declared={declared} kvCache={null} />,
    );

    expect(
      screen.getByTestId("endpoint-declared-weights").textContent,
    ).toContain("endpoints.weights.acrossReplicas");

    rerender(
      <EndpointWeightsEstimate
        declared={{ ...declared, replicas: 1 }}
        kvCache={null}
      />,
    );

    expect(
      screen.getByTestId("endpoint-declared-weights").textContent,
    ).not.toContain("endpoints.weights.acrossReplicas");
  });

  it("renders nothing when neither half has anything to say", () => {
    render(
      <EndpointWeightsEstimate
        declared={{
          perReplicaGb: null,
          replicas: 1,
          info: null,
          accelerator: {},
        }}
        kvCache={null}
      />,
    );

    expect(screen.queryByTestId("endpoint-weights-estimate")).toBeNull();
  });

  it("states the declared metadata a catalog carries without a VRAM figure", () => {
    render(
      <EndpointWeightsEstimate
        declared={{
          perReplicaGb: null,
          replicas: 1,
          info: { architecture: "moe" },
          accelerator: {},
        }}
        kvCache={null}
      />,
    );

    const block = screen.getByTestId("endpoint-declared-weights");
    expect(within(block).getByText("moe")).toBeDefined();
    expect(within(block).queryByText(/GB/)).toBeNull();
  });

  // A deployment needs the weights and the KV cache in VRAM at once, so the
  // badge is checked against their sum, not the declared weights alone.
  it("checks VRAM against declared weights plus the KV cache's current estimate", () => {
    render(<EndpointWeightsEstimate declared={declared} kvCache={kvCache} />);

    const block = screen.getByTestId("endpoint-declared-weights");
    expect(block.textContent).toContain("endpoints.weights.breakdown");
  });

  // Callers elsewhere on the form (an accelerator notice outside this
  // section) need the same combined figure this section's own badge uses.
  it("reports the combined requirement to the caller as it changes", () => {
    const onRequiredGbChange = vi.fn();
    render(
      <EndpointWeightsEstimate
        declared={declared}
        kvCache={kvCache}
        onRequiredGbChange={onRequiredGbChange}
      />,
    );

    // 48 GB declared weights + the mocked 10 GB KV cache estimate.
    expect(onRequiredGbChange).toHaveBeenCalledWith(58);
  });

  it("reports null when there is nothing declared to require", () => {
    const onRequiredGbChange = vi.fn();
    render(
      <EndpointWeightsEstimate
        declared={null}
        kvCache={kvCache}
        onRequiredGbChange={onRequiredGbChange}
      />,
    );

    expect(onRequiredGbChange).toHaveBeenLastCalledWith(null);
  });
});
