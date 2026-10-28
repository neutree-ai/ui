import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferenceList } from "@/domains/model-registry/components/ModelDeleteDialog";

describe("ReferenceList", () => {
  it("renders the server's own word for the phase, not an interpretation", () => {
    render(
      <ReferenceList
        references={[
          {
            kind: "Endpoint",
            name: "a",
            workspace: "default",
            phase: "Pending",
          },
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
