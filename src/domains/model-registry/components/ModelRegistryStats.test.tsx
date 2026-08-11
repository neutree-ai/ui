import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ModelRegistryModelCount,
  ModelRegistryStorage,
} from "@/domains/model-registry/components/ModelRegistryStats";
import type { ModelRegistry } from "@/domains/model-registry/types";
import type { ModelRegistryVisibility } from "@/foundation/lib/model-registry-visibility";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

const registry = (
  visibility: ModelRegistryVisibility | undefined,
  stats?: { model_count: number; storage_bytes: number },
): ModelRegistry =>
  ({
    id: 1,
    api_version: "v1",
    kind: "ModelRegistry",
    metadata: {
      name: "r",
      workspace: "default",
      deletion_timestamp: null,
      creation_timestamp: "2026-01-01T00:00:00Z",
      update_timestamp: "2026-01-01T00:00:00Z",
      labels: {},
      annotations: {},
    },
    // Deliberately the type a public Hugging Face registry has, under both
    // visibilities: if anything here still read `spec.type`, the private case
    // below would render "-" and this test would catch it.
    spec: { type: "hugging-face", url: "https://huggingface.co" },
    status: { phase: "Connected", stats: stats ?? null },
    visibility,
  }) as unknown as ModelRegistry;

describe("registry counters", () => {
  it("shows a dash for a registry the control plane does not measure", () => {
    render(<ModelRegistryStorage registry={registry("public")} />);

    expect(
      screen.getByTitle("model_registries.stats.notApplicableHint"),
    ).toBeDefined();
    expect(screen.queryByTestId("registry-storage")).toBeNull();
  });

  it("decides from the server's visibility, not from the registry's type", () => {
    render(
      <ModelRegistryModelCount
        registry={registry("private", { model_count: 5, storage_bytes: 1024 })}
      />,
    );

    expect(screen.getByTestId("registry-model-count").textContent).toContain(
      "5",
    );
  });

  it("says collecting rather than zero before a measurement lands", () => {
    // "Nobody has walked this registry" and "this registry is empty" are
    // different facts, and only one of them is worth acting on.
    render(<ModelRegistryModelCount registry={registry("private")} />);

    expect(screen.getByText("model_registries.stats.collecting")).toBeDefined();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("does not claim a registry is unmeasured when visibility was not selected", () => {
    // A request that forgot `MODEL_REGISTRY_SELECT` must not silently turn every
    // registry's counters into "-", which would read as a deliberate statement
    // about the registry rather than a missing field.
    render(<ModelRegistryModelCount registry={registry(undefined)} />);

    expect(screen.getByText("model_registries.stats.collecting")).toBeDefined();
  });
});
