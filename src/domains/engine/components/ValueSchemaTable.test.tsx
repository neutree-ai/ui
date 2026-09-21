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
      if (key === "engines.schema.enumSummary")
        return `one of ${options?.values}`;
      if (key === "engines.schema.expandDescription")
        return `expand ${options?.name}`;
      if (key === "engines.schema.toggleNested") {
        return `Expand or collapse ${options?.name}`;
      }
      if (key === "engines.schema.required") return "required";
      if (key === "engines.schema.copyJson") return "Copy JSON";
      return key;
    },
  }),
}));

// jsdom has no layout, so truncation never measures true; the dialog path is
// asserted by faking the measurement.
vi.mock("@/foundation/hooks/use-is-truncated", () => ({
  useIsTruncated: () => true,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="description-dialog">{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

  it("summarizes an enum instead of listing every value", () => {
    renderTable();

    expect(row("rope_scaling.type")?.textContent).toContain(
      "one of linear · dynamic",
    );
  });

  it("opens a description dialog that pretty-prints embedded JSON", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: "expand command" }));

    // Every row renders its dialog inline in this mock; pick the command one.
    const dialog = screen
      .getAllByTestId("description-dialog")
      .find((element) => element.textContent?.includes("Starts the workload"))!;
    expect(dialog.textContent).toContain("Starts the workload. Example:");
    expect(dialog.querySelector("pre")?.textContent).toContain('"port": 8000');
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeTruthy();
  });

  it("renders an empty state for a version that declares nothing", () => {
    renderTable({ type: "object", additionalProperties: true });

    expect(screen.getByText("engines.schema.empty")).toBeTruthy();
    expect(screen.getByText("engines.schema.allowsAdditional")).toBeTruthy();
  });
});
