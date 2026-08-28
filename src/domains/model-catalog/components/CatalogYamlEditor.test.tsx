import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogYamlEditor } from "./CatalogYamlEditor";

describe("CatalogYamlEditor", () => {
  it("renders highlighted YAML behind the editable textarea", () => {
    const { container } = render(
      <CatalogYamlEditor
        value={'kind: ModelCatalog\nname: "qwen"'}
        onChange={vi.fn()}
        ariaLabel="Catalog YAML"
        className="custom-editor"
      />,
    );

    expect(container.firstElementChild?.className).toContain("custom-editor");
    expect(
      (screen.getByLabelText("Catalog YAML") as HTMLTextAreaElement).value,
    ).toBe('kind: ModelCatalog\nname: "qwen"');
    expect(container.querySelector("pre code")?.textContent).toContain(
      "ModelCatalog",
    );
    expect(container.querySelector(".hljs-attr")).not.toBeNull();
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

  it("synchronizes the highlight layer with textarea scrolling", () => {
    const { container } = render(
      <CatalogYamlEditor
        value="kind: ModelCatalog"
        onChange={vi.fn()}
        ariaLabel="Catalog YAML"
      />,
    );
    const textarea = screen.getByLabelText("Catalog YAML");
    const highlight = container.querySelector("pre");
    if (!highlight) throw new Error("highlight layer was not rendered");

    Object.defineProperties(textarea, {
      scrollTop: { configurable: true, value: 120 },
      scrollLeft: { configurable: true, value: 36 },
    });
    fireEvent.scroll(textarea);

    expect(highlight.scrollTop).toBe(120);
    expect(highlight.scrollLeft).toBe(36);
  });
});
