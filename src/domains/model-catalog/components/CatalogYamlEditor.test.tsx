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

  // The text and the caret have to move together. They used to be kept in step
  // by copying the textarea's scroll offsets onto the highlight layer, which
  // silently failed past the point where the two elements stop agreeing on
  // their extent — the textarea's scrollbars take space out of its own box, so
  // on a catalog with a long line it can still scroll while the overlay is
  // already at its end, leaving the caret a line or two away from the text
  // under it. They are now scrolled by one shared parent, which is the property
  // this pins: nothing between the two layers scrolls on its own.
  it("scrolls the text and the highlight layer with one shared parent", () => {
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

    const scroller = textarea.parentElement?.parentElement;
    expect(scroller).toBe(highlight.parentElement?.parentElement);
    expect(scroller).not.toBe(container.firstElementChild);
    expect(scroller?.contains(textarea)).toBe(true);
    expect(scroller?.contains(highlight)).toBe(true);
  });
});
