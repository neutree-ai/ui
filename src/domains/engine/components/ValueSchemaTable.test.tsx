import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ValueSchemaTable } from "./ValueSchemaTable";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: {
        count?: number;
        values?: string;
        name?: string;
        visible?: number;
        total?: number;
      },
    ) => {
      if (key === "engines.schema.parameterCount") {
        return `${options?.count} parameters`;
      }
      if (key === "engines.schema.nestedCount") {
        return `${options?.count} nested parameters`;
      }
      if (key === "engines.schema.filteredCount") {
        return `${options?.visible} of ${options?.total} parameters`;
      }
      if (key === "engines.schema.enumLead") return "one of";
      if (key === "engines.schema.expandDescription")
        return `expand ${options?.name}`;
      if (key === "engines.schema.toggleNested") {
        return `Expand or collapse ${options?.name}`;
      }
      if (key === "engines.schema.required") return "required";
      if (key === "engines.schema.filters.type") return "Type";
      if (key === "engines.schema.filters.allTypes") return "All types";
      if (key === "engines.schema.filters.onlyRequired") return "Required only";
      if (key === "engines.schema.noMatches") {
        return "No parameters match the filters.";
      }
      if (key === "engines.schema.copyJson") return "Copy JSON";
      if (key === "engines.schema.enumAll") {
        return `${options?.count} allowed values`;
      }
      return key;
    },
  }),
}));

// jsdom has no layout, so truncation never measures true; the dialog path is
// asserted by faking the measurement.
vi.mock("@/foundation/hooks/use-is-truncated", () => ({
  useIsTruncated: () => true,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="row-details">{children}</div>
  ),
}));

// A native select keeps the toolbar's own wiring under test (which value it
// hands the filter) without depending on Radix's pointer handling in jsdom.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      data-testid="value-schema-type-filter"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const copyMock = vi.fn();
vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copy: copyMock, copied: false }),
}));

const schema = {
  type: "object",
  required: ["command"],
  properties: {
    command: {
      type: "string",
      title: "Command",
      description: "Starts the workload. Example: '{\"port\": 8000}'",
    },
    health_path: {
      type: "string",
      default: "/health",
      description: "Path polled.",
    },
    rope_scaling: {
      type: "object",
      description: "RoPE scaling configuration",
      properties: {
        factor: { type: "number" },
        type: { type: "string", enum: ["linear", "dynamic"] },
      },
    },
    served_model_name: {
      type: ["string", "array"],
      items: { type: "string" },
      description: "Model names.",
    },
  },
};

const renderTable = (value: unknown = schema) =>
  render(
    <TooltipProvider>
      <ValueSchemaTable schema={value} />
    </TooltipProvider>,
  );

const row = (path: string) =>
  document.querySelector(
    `[data-testid="value-schema-row"][data-path="${path}"]`,
  );

describe("ValueSchemaTable", () => {
  it("renders a row per parameter with type, default and required", () => {
    renderTable();

    // Four declared parameters, two of which have nested children.
    expect(screen.getByText("6 parameters")).toBeTruthy();
    expect(row("command")?.textContent).toContain("Command");
    expect(row("command")?.textContent).toContain("command");
    expect(row("command")?.textContent).toContain("required");
    expect(row("health_path")?.textContent).toContain('"/health"');
  });

  it("shows union branches and the array item type", () => {
    renderTable();

    expect(row("served_model_name")?.textContent).toContain("string");
    expect(row("served_model_name")?.textContent).toContain("array<string>");
  });

  it("keeps nested fields behind an expand toggle", () => {
    renderTable();

    const toggle = screen.getByRole("button", {
      name: "Expand or collapse rope_scaling",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(row("rope_scaling.factor")).toBeTruthy();

    fireEvent.click(toggle);

    expect(row("rope_scaling.factor")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Expand or collapse rope_scaling" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("filters by parameter name and keeps the matching ancestors", () => {
    renderTable();

    fireEvent.change(
      screen.getByPlaceholderText("engines.schema.searchPlaceholder"),
      { target: { value: "factor" } },
    );

    expect(row("rope_scaling.factor")).toBeTruthy();
    expect(row("rope_scaling")).toBeTruthy();
    expect(row("health_path")).toBeNull();
  });

  it("narrows to required parameters from the toolbar", () => {
    renderTable();

    expect(row("health_path")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Required only" }));

    // `command` is the only required parameter; the rest goes, and the count
    // reports what is left of the whole schema.
    expect(row("command")).toBeTruthy();
    expect(row("health_path")).toBeNull();
    expect(row("rope_scaling.factor")).toBeNull();
    expect(screen.getByText("1 of 6 parameters")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Required only" }));

    expect(row("health_path")).toBeTruthy();
    expect(screen.getByText("6 parameters")).toBeTruthy();
  });

  it("says so when a filter matches nothing", () => {
    renderTable();

    fireEvent.change(
      screen.getByPlaceholderText("engines.schema.searchPlaceholder"),
      { target: { value: "no such parameter" } },
    );

    expect(screen.getByTestId("value-schema-no-matches")).toBeTruthy();
    expect(screen.queryAllByTestId("value-schema-row")).toHaveLength(0);
  });

  it("only offers the required switch when the schema has required fields", () => {
    // Built-in packages declare none, and a switch that can only empty the
    // table is not worth showing.
    renderTable({
      type: "object",
      properties: {
        dtype: { type: "string" },
        block_size: { type: "integer" },
      },
    });

    expect(
      screen.queryByRole("checkbox", { name: "Required only" }),
    ).toBeNull();
    expect(screen.getByTestId("value-schema-type-filter")).toBeTruthy();
  });

  it("narrows by the type picked in the toolbar", () => {
    renderTable();

    fireEvent.change(screen.getByTestId("value-schema-type-filter"), {
      target: { value: "number" },
    });

    // Only `rope_scaling.factor` is a number; its parent stays as context.
    expect(row("rope_scaling.factor")).toBeTruthy();
    expect(row("rope_scaling")).toBeTruthy();
    expect(row("health_path")).toBeNull();
    expect(screen.getByText("2 of 6 parameters")).toBeTruthy();

    // The "all types" entry clears the filter again.
    fireEvent.change(screen.getByTestId("value-schema-type-filter"), {
      target: { value: "all" },
    });
    expect(row("health_path")).toBeTruthy();
  });

  it("keeps rows past the indent cap attached to their parent", () => {
    renderTable({
      type: "object",
      properties: {
        serving: {
          type: "object",
          properties: {
            placement: {
              type: "object",
              properties: {
                affinity: {
                  type: "object",
                  properties: {
                    weights: {
                      type: "object",
                      properties: { weight: { type: "integer" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const indent = (path: string) =>
      (row(path)?.querySelector("div[style]") as HTMLElement | null)?.style
        .paddingLeft;
    const label = (path: string) =>
      row(path)?.querySelector("span[title]")?.getAttribute("title");

    // The indent grows a level at a time, then stops so a deep schema cannot
    // squeeze the name out of its column.
    expect(indent("serving.placement")).toBe("16px");
    expect(indent("serving.placement.affinity")).toBe("32px");
    expect(indent("serving.placement.affinity.weights")).toBe("48px");
    expect(indent("serving.placement.affinity.weights.weight")).toBe("48px");

    // Past the cap the indent no longer separates two levels, so the row
    // names its parent instead. The full path stays reachable.
    expect(row("serving.placement.affinity.weights")?.textContent).toContain(
      "weights",
    );
    expect(
      row("serving.placement.affinity.weights.weight")?.textContent,
    ).toContain("weights.weight");
    expect(label("serving.placement.affinity.weights.weight")).toBe(
      "serving.placement.affinity.weights.weight",
    );
  });

  it("shows the enum values inline as tags", () => {
    renderTable();

    const inline = row("rope_scaling.type")?.querySelector(
      '[data-testid="value-schema-enum"]',
    );
    expect(inline?.textContent).toContain("one of");
    expect(inline?.textContent).toContain("linear");
    expect(inline?.textContent).toContain("dynamic");
    // Tags, not prose: each value is its own element.
    expect(inline?.querySelectorAll("code").length).toBe(2);
  });

  it("opens a floating details panel with the full text and JSON example", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: "expand command" }));

    // Every row renders its panel inline in this mock; pick the command one.
    const panel = screen
      .getAllByTestId("row-details")
      .find((element) => element.textContent?.includes("Starts the workload"))!;
    expect(panel.textContent).toContain("Starts the workload. Example:");
    expect(panel.querySelector("pre")?.textContent).toContain('"port": 8000');
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeTruthy();
  });

  it("copies the pretty-printed example rather than the cell's one line", () => {
    copyMock.mockClear();
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));

    expect(copyMock).toHaveBeenCalledWith(
      '{\n  "port": 8000\n}',
      expect.objectContaining({
        successMessage: "components.apiKey.copySuccess",
        errorMessage: "components.apiKey.errors.copyFailed",
      }),
    );
  });

  it("lists every enum value in the details panel", () => {
    renderTable();

    fireEvent.click(
      screen.getByRole("button", { name: "expand rope_scaling.type" }),
    );

    const panel = screen
      .getAllByTestId("row-details")
      .find((element) => element.textContent?.includes("allowed values"))!;
    expect(panel.textContent).toContain("2 allowed values");
    expect(panel.textContent).toContain("linear");
    expect(panel.textContent).toContain("dynamic");
  });

  it("renders an empty state for a version that declares nothing", () => {
    renderTable({ type: "object", additionalProperties: true });

    expect(screen.getByText("engines.schema.empty")).toBeTruthy();
    expect(screen.getByText("engines.schema.allowsAdditional")).toBeTruthy();
  });

  it("measures the toolbar so the sticky header can clear it", () => {
    const observed: Element[] = [];
    const disconnect = vi.fn();
    class FakeResizeObserver {
      observe(element: Element) {
        observed.push(element);
      }
      disconnect = disconnect;
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);

    const { unmount } = renderTable();

    // The header's sticky offset is built from the toolbar's height, so the
    // toolbar has to be the element being observed.
    expect(observed).toHaveLength(1);
    expect(observed[0].querySelector("input")).toBeTruthy();
    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
