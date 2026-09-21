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
});
