import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ReferenceList,
  referencePhaseClassName,
} from "@/domains/model-registry/components/ModelDeleteDialog";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

describe("referencePhaseClassName", () => {
  it("leaves a serving endpoint unmarked", () => {
    expect(referencePhaseClassName("Running")).toContain("muted");
  });

  it("marks every phase that is not serving traffic", () => {
    // Decided by what a phase is not, so the set never needs updating: a phase
    // the server adds later is marked rather than silently reading as "in
    // service", which is the reading that would let someone delete a model out
    // from under a deployment they thought was idle.
    for (const phase of [
      "Pending",
      "Deploying",
      "ModelDownloading",
      "Paused",
      "Failed",
      "Deleting",
      "Deleted",
      "SomePhaseAddedLater",
    ]) {
      expect(referencePhaseClassName(phase)).toContain("amber");
    }
  });
});

describe("ReferenceList", () => {
  it("renders the server's own word for the phase, not an interpretation", () => {
    render(
      <ReferenceList
        references={[
          { kind: "Endpoint", name: "a", workspace: "default", phase: "Pending" },
        ]}
      />,
    );

    const phase = screen.getByTestId("model-delete-reference-phase-Pending");
    expect(phase.textContent).toBe("Pending");
  });

  it("names the recipe variant a catalog reference points through", () => {
    render(
      <ReferenceList
        references={[
          {
            kind: "ModelCatalog",
            name: "c",
            workspace: "default",
            variant: "int4",
          },
        ]}
      />,
    );

    const item = screen.getByTestId("model-delete-references");
    expect(item.textContent).toContain("ModelCatalog");
    expect(item.textContent).toContain(
      "model_registries.models.delete.variant:int4",
    );
  });
});
