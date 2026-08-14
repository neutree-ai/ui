import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EndpointAdvancedParameters } from "./EndpointAdvancedParameters";

const copyMock = vi.fn();

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      key === "endpoints.messages.parameterCount"
        ? `${options?.count} parameters`
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

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
}));

describe("EndpointAdvancedParameters", () => {
  beforeEach(() => copyMock.mockClear());

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
});
