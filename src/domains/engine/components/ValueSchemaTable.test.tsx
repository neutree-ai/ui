import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { ValueSchemaTable } from "./ValueSchemaTable";

// Row building, filtering and description splitting are owned by
// lib/value-schema-rows.test.ts; this file proves the table wires them up.

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

const search = (value: string) =>
  fireEvent.change(
    screen.getByPlaceholderText("engines.schema.searchPlaceholder"),
    { target: { value } },
  );

const requiredOnly = () =>
  screen.getByRole("checkbox", { name: "engines.schema.filters.onlyRequired" });

describe("ValueSchemaTable", () => {
  beforeEach(() => {
    vi.mocked(useIsTruncated).mockReturnValue(true);
    copyMock.mockClear();
  });

  it("renders a row per parameter with title, type, default and required", () => {
    renderTable();

    screen.getByText("engines.schema.parameterCount:6");
    expect(row("command")?.textContent).toContain("Command");
    expect(row("command")?.textContent).toContain("engines.schema.required");
    expect(row("health_path")?.textContent).toContain('"/health"');
    expect(row("served_model_name")?.textContent).toContain("array<string>");
  });

  it("labels a parameter that declares no type as unknown", () => {
    renderTable({
      type: "object",
      properties: { mystery: { description: "Declares no type." } },
    });

    expect(screen.getByTestId("value-schema-row").textContent).toContain(
      "unknown",
    );
  });

  it("collapses and re-expands nested fields", () => {
    renderTable();
    const toggle = screen.getByRole("button", {
      name: "engines.schema.toggleNested:rope_scaling",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(row("rope_scaling.factor")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(row("rope_scaling.factor")).not.toBeNull();
  });

  it("filters by name from the search box", () => {
    renderTable();

    search("factor");

    expect(row("rope_scaling.factor")).not.toBeNull();
    expect(row("health_path")).toBeNull();
  });

  it("narrows to required parameters and reports what is left", () => {
    renderTable();

    fireEvent.click(requiredOnly());

    expect(row("command")).not.toBeNull();
    expect(row("health_path")).toBeNull();
    screen.getByText("engines.schema.filteredCount:1,6");

    fireEvent.click(requiredOnly());
    screen.getByText("engines.schema.parameterCount:6");
  });

  it("narrows by the type picked in the toolbar and clears with all types", () => {
    renderTable();
    const typeFilter = screen.getByTestId("value-schema-type-filter");

    fireEvent.change(typeFilter, { target: { value: "number" } });
    expect(row("rope_scaling.factor")).not.toBeNull();
    expect(row("health_path")).toBeNull();

    fireEvent.change(typeFilter, { target: { value: "all" } });
    expect(row("health_path")).not.toBeNull();
  });

  it("says so when a filter matches nothing", () => {
    renderTable();

    search("no such parameter");

    screen.getByText("engines.schema.noMatches");
    expect(screen.queryAllByTestId("value-schema-row")).toHaveLength(0);
  });

  it("only offers the required switch when the schema has required fields", () => {
    renderTable({ type: "object", properties: { dtype: { type: "string" } } });

    expect(
      screen.queryByRole("checkbox", {
        name: "engines.schema.filters.onlyRequired",
      }),
    ).toBeNull();
  });

  it("names the parent of a row nested past the indent cap", () => {
    const nest = (names: string[]): object =>
      names.length === 0
        ? { type: "integer" }
        : {
            type: "object",
            properties: { [names[0]]: nest(names.slice(1)) },
          };
    renderTable(
      nest(["serving", "placement", "affinity", "weights", "weight"]),
    );

    const path = "serving.placement.affinity.weights.weight";
    expect(within(row(path) as HTMLElement).getByTitle(path).textContent).toBe(
      "weights.weight",
    );
  });

  it("shows enum values inline", () => {
    renderTable();

    const inline = row("rope_scaling.type")?.querySelector(
      '[data-testid="value-schema-enum"]',
    );
    expect(inline?.textContent).toContain("linear");
    expect(inline?.textContent).toContain("dynamic");
  });

  it("offers the details panel only when the description or enum is cut off", () => {
    // The description fits, so the enum row is what has to ask for the panel.
    vi.mocked(useIsTruncated)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderTable();
    screen.getByRole("button", {
      name: "engines.schema.expandDescription:rope_scaling.type",
    });
  });

  it("offers no details panel while everything fits", () => {
    vi.mocked(useIsTruncated).mockReturnValue(false);
    renderTable();
    expect(
      screen.queryAllByRole("button", {
        name: /^engines\.schema\.expandDescription:/,
      }),
    ).toHaveLength(0);
  });

  it("lists every enum value in the details panel", () => {
    renderTable();

    const panel = screen
      .getAllByTestId("row-details")
      .find((element) =>
        element.textContent?.includes("engines.schema.enumAll:2"),
      )!;
    expect(panel.textContent).toContain("linear");
    expect(panel.textContent).toContain("dynamic");
  });

  it("copies the pretty-printed JSON example from the details panel", () => {
    renderTable();

    fireEvent.click(
      screen.getByRole("button", { name: "engines.schema.copyJson" }),
    );

    expect(copyMock).toHaveBeenCalledWith(
      '{\n  "port": 8000\n}',
      expect.anything(),
    );
  });

  it.each([
    { schema: { type: "object", additionalProperties: true }, extras: true },
    { schema: { type: "object" }, extras: false },
  ])("shows the empty state (extras note: $extras)", ({ schema, extras }) => {
    renderTable(schema);

    screen.getByText("engines.schema.empty");
    expect(screen.queryByText("engines.schema.allowsAdditional") !== null).toBe(
      extras,
    );
  });

  it("notes the parameters a schema accepts but does not list", () => {
    renderTable({
      type: "object",
      additionalProperties: true,
      properties: { dtype: { type: "string" } },
    });

    screen.getByTestId("value-schema-row");
    screen.getByText("engines.schema.allowsAdditional");
  });
});
