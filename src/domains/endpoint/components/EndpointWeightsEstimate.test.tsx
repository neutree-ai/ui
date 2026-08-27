import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/domains/endpoint/components/KVCacheEstimate", () => ({
  KVCacheEstimate: () => <div data-testid="kv-cache-estimate" />,
}));

import type { EngineCacheArgs } from "@/domains/endpoint/lib/engine-cache-args";
import type { ModelInfoRead } from "@/foundation/lib/model-info-read";
import { EndpointWeightsEstimate } from "./EndpointWeightsEstimate";

const kvCache = {
  read: { state: "ready", info: {} } as unknown as ModelInfoRead,
  engineArgs: {} as EngineCacheArgs,
  modelKey: "hf:qwen:v1",
};

const declared = {
  perReplicaGb: 48,
  replicas: 2,
  info: { parameter_count: "35B", quantization: "fp8" },
};

describe("EndpointWeightsEstimate", () => {
  // Two different questions — what the catalog measured, and what this
  // deployment's context and concurrency work out to — kept as two blocks so
  // they cannot read as one number.
  it("shows both halves when deploying from a catalog", () => {
    render(<EndpointWeightsEstimate declared={declared} kvCache={kvCache} />);

    const block = screen.getByTestId("endpoint-declared-weights");
    expect(within(block).getByText("≈ 96 GB")).toBeDefined();
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

  it("renders nothing when neither half has anything to say", () => {
    render(
      <EndpointWeightsEstimate
        declared={{ perReplicaGb: null, replicas: 1, info: null }}
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
        }}
        kvCache={null}
      />,
    );

    const block = screen.getByTestId("endpoint-declared-weights");
    expect(within(block).getByText("moe")).toBeDefined();
    expect(within(block).queryByText(/GB/)).toBeNull();
  });
});
