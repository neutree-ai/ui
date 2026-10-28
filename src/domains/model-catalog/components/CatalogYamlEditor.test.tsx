import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogYamlEditor } from "./CatalogYamlEditor";

describe("CatalogYamlEditor", () => {
  it("shows the YAML in the editable textarea", () => {
    render(
      <CatalogYamlEditor
        value={'kind: ModelCatalog\nname: "qwen"'}
        onChange={vi.fn()}
        ariaLabel="Catalog YAML"
      />,
    );

    expect(
      (screen.getByLabelText("Catalog YAML") as HTMLTextAreaElement).value,
    ).toBe('kind: ModelCatalog\nname: "qwen"');
  });

  it("keeps the empty editor editable and reports text changes", () => {
    const onChange = vi.fn();
    render(
      <CatalogYamlEditor
        value=""
        onChange={onChange}
        ariaLabel="Catalog YAML"
      />,
    );

    fireEvent.change(screen.getByLabelText("Catalog YAML"), {
      target: { value: "kind: ModelCatalog" },
    });

    expect(onChange).toHaveBeenCalledWith("kind: ModelCatalog");
  });
});
