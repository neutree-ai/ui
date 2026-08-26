import type { CrudFilter, LogicalFilter } from "@refinedev/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegistryTypeFilter } from "@/domains/model-registry/components/RegistryTypeFilter";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => MESSAGES[key] ?? key }),
}));

const MESSAGES: Record<string, string> = {
  "components.ui.filter.selectAll": "All",
  "model_registries.types.huggingFace": "Hugging Face",
  "model_registries.types.modelScope": "ModelScope",
  "model_registries.types.fileSystem": "File System",
  "model_registries.types.filterTitle": "Filter by type",
};

/**
 * The field the predicate has to be written against. `spec` is a composite
 * column and PostgREST addresses its attributes with the arrow syntax, so this
 * exact string is what makes the filter run in Postgres rather than here. It is
 * repeated rather than imported: a test that reads the same constant as the
 * code cannot notice the constant changing.
 */
const TYPE_FIELD = "spec->>type";

const open = () =>
  fireEvent.pointerDown(screen.getByTestId("registry-type-filter"), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });

// Scoped to the menu: the trigger shows the selected option's own label, so
// matching on text alone finds two nodes as soon as the two agree.
const menuItems = () => screen.getAllByRole("menuitem");

const openAndPick = (label: string) => {
  open();
  const item = menuItems().find((node) => node.textContent === label);
  if (!item) throw new Error(`no menu item labelled ${label}`);
  fireEvent.click(item);
};

const renderFilter = (filters: CrudFilter[] = []) => {
  const setFilters = vi.fn();
  render(<RegistryTypeFilter filters={filters} setFilters={setFilters} />);
  return setFilters;
};

const typeFilter = (value: string): LogicalFilter =>
  ({ field: TYPE_FIELD, operator: "eq", value }) as LogicalFilter;

describe("RegistryTypeFilter", () => {
  it.each([
    ["Hugging Face", "hugging-face"],
    ["ModelScope", "model-scope"],
    ["File System", "bentoml"],
  ])("filters on %s server-side", (label, expectedValue) => {
    const setFilters = renderFilter();

    openAndPick(label);

    expect(setFilters).toHaveBeenCalledWith(
      [{ field: TYPE_FIELD, operator: "eq", value: expectedValue }],
      "replace",
    );
  });

  it("offers exactly the kinds the server defines, plus an unfiltered option", () => {
    renderFilter();

    open();

    // Three kinds and no more: the server's enum has three, so nothing can be
    // filtered out of reach. A fourth entry, or a missing one, means this list
    // and the server's have drifted apart.
    expect(menuItems().map((node) => node.textContent)).toEqual([
      "All",
      "Hugging Face",
      "ModelScope",
      "File System",
    ]);
  });

  it("drops the predicate when the unfiltered option is chosen", () => {
    const setFilters = renderFilter([typeFilter("model-scope")]);

    openAndPick("All");

    expect(setFilters).toHaveBeenCalledWith([], "replace");
  });

  it("replaces its own predicate and leaves other filters alone", () => {
    // The search box writes a filter on the same request. Switching kind must
    // not drop it, and must not stack a second kind predicate that would match
    // nothing.
    const search: LogicalFilter = {
      field: "metadata->>name",
      operator: "contains",
      value: "mirror",
    };
    const setFilters = renderFilter([search, typeFilter("hugging-face")]);

    openAndPick("ModelScope");

    expect(setFilters).toHaveBeenCalledWith(
      [search, { field: TYPE_FIELD, operator: "eq", value: "model-scope" }],
      "replace",
    );
  });

  it("shows the selected kind on the trigger", () => {
    renderFilter([typeFilter("model-scope")]);

    expect(screen.getByTestId("registry-type-filter").textContent).toContain(
      "ModelScope",
    );
  });
});
