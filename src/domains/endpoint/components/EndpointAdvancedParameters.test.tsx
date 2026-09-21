import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EndpointAdvancedParameters } from "./EndpointAdvancedParameters";

const copyMock = vi.fn();

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; name?: string }) =>
      key === "endpoints.messages.parameterCount"
        ? `${options?.count} parameters`
        : key === "endpoints.messages.expandParameterValue"
          ? `${key} ${options?.name}`
          : key,
  }),
}));

vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copy: copyMock, copied: false }),
}));

vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({
      title,
      children,
    }: {
      title: ReactNode;
      children: ReactNode;
    }) => (
      <section>
        <h2>{title}</h2>
        {children}
      </section>
    ),
  },
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <span data-testid="parameter-value-details">{children}</span>
  ),
}));

// jsdom has no layout, so a truncation measurement never reads true; the panel
// path is exercised by faking the measurement.
const truncatedMock = vi.fn(() => true);
vi.mock("@/foundation/hooks/use-is-truncated", () => ({
  useIsTruncated: () => truncatedMock(),
}));

describe("EndpointAdvancedParameters", () => {
  beforeEach(() => {
    copyMock.mockClear();
    truncatedMock.mockReturnValue(true);
  });

  it("does not render when both parameter groups are empty", () => {
    const { container } = render(
      <EndpointAdvancedParameters
        engineParameters={{}}
        environmentVariables={null}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders both groups, counts, and serialized values", () => {
    render(
      <EndpointAdvancedParameters
        engineParameters={{
          tensor_parallel_size: 4,
          enable_prefix_caching: true,
          options: { eager: false },
        }}
        environmentVariables={{ HF_HOME: "/models/cache" }}
      />,
    );

    expect(screen.getByText("endpoints.sections.advancedOptions")).toBeTruthy();
    expect(screen.getByText("endpoints.fields.engineVariables")).toBeTruthy();
    expect(
      screen.getByText("endpoints.sections.environmentVariables"),
    ).toBeTruthy();
    expect(screen.getByText("3 parameters")).toBeTruthy();
    expect(screen.getByText("1 parameters")).toBeTruthy();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("true").length).toBeGreaterThan(0);
    expect(screen.getAllByText('{"eager":false}').length).toBeGreaterThan(0);
    expect(screen.getAllByText("/models/cache").length).toBeGreaterThan(0);
  });

  it("falls back to a string for values that cannot be serialized", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    render(
      <EndpointAdvancedParameters
        engineParameters={{ circular }}
        environmentVariables={undefined}
      />,
    );

    expect(screen.getAllByText("[object Object]").length).toBeGreaterThan(0);
  });

  it("copies the formatted parameter value", () => {
    render(
      <EndpointAdvancedParameters
        engineParameters={{ max_model_len: 32768 }}
        environmentVariables={undefined}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "max_model_len api_keys.buttons.copy",
      }),
    );

    expect(copyMock).toHaveBeenCalledWith("32768", {
      successMessage: "components.apiKey.copySuccess",
      errorMessage: "components.apiKey.errors.copyFailed",
    });
  });

  it("shows the full value JSON-indented, because the cell can only show a slice", () => {
    render(
      <EndpointAdvancedParameters
        engineParameters={{
          additional_config: {
            ascend_compilation_config: { enable_npugraph_ex: true },
            enable_cpu_binding: true,
          },
        }}
        environmentVariables={undefined}
      />,
    );

    // The cell keeps one line for the sake of the table…
    expect(
      screen.getAllByText(
        '{"ascend_compilation_config":{"enable_npugraph_ex":true},"enable_cpu_binding":true}',
      ).length,
    ).toBeGreaterThan(0);

    // …and the card hands back the structure that the line had to drop.
    const [panel] = screen.getAllByTestId("parameter-value-details");
    const text = panel.textContent ?? "";
    expect(text).toContain('\n  "ascend_compilation_config"');
    expect(text).toContain('{\n    "enable_npugraph_ex": true\n  }');
  });

  it("indents a value that arrives as a JSON string", () => {
    render(
      <EndpointAdvancedParameters
        engineParameters={{ additional_config: '{"a":[1,2]}' }}
        environmentVariables={undefined}
      />,
    );

    const [panel] = screen.getAllByTestId("parameter-value-details");
    expect(panel.textContent).toContain("additional_config");
    expect(panel.querySelector("pre")?.textContent).toBe(
      '{\n  "a": [\n    1,\n    2\n  ]\n}',
    );
  });

  it("leaves a plain string and a primitive untouched in the panel", () => {
    render(
      <EndpointAdvancedParameters
        engineParameters={{ max_model_len: 8192, dtype: "bfloat16" }}
        environmentVariables={undefined}
      />,
    );

    const texts = screen
      .getAllByTestId("parameter-value-details")
      .map((node) => node.querySelector("pre")?.textContent);
    expect(texts).toContain("8192");
    expect(texts).toContain("bfloat16");
  });

  it("offers the expand control only while the value is cut off", () => {
    truncatedMock.mockReturnValue(false);
    render(
      <EndpointAdvancedParameters
        engineParameters={{ max_model_len: 8192 }}
        environmentVariables={undefined}
      />,
    );

    // A value that fits needs no control: the button has to mean "there is more".
    expect(screen.queryByTestId("parameter-value-details")).toBeNull();
  });

  it("labels the expand control after the parameter it belongs to", () => {
    render(
      <EndpointAdvancedParameters
        engineParameters={{ additional_config: { a: 1 } }}
        environmentVariables={undefined}
      />,
    );

    const value = screen.getByText('{"a":1}');
    expect(value.className).toContain("truncate");
    expect(
      screen.getByRole("button", {
        name: "endpoints.messages.expandParameterValue additional_config",
      }),
    ).toBeTruthy();
  });
});
