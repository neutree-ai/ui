import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComposedSpec } from "@/foundation/recipe/types";
import { ComposePreview } from "./ComposePreview";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const composed = {
  model: {
    name: "BAAI/bge-large-en-v1.5",
    task: "text-generation",
  },
  engine: {
    engine: "vllm",
    version: "v0.25.0",
  },
  resources: {
    cpu: 4,
    memory: 8,
    gpu: 1,
  },
  engine_args: {
    max_model_len: 262144,
  },
  env: {
    TOKEN: "secret",
  },
} as unknown as ComposedSpec;

describe("ComposePreview", () => {
  it("renders the endpoint configuration directly in the summary rail", () => {
    render(<ComposePreview composed={composed} compact surface="plain" />);

    const preview = screen.getByTestId("compose-preview");
    expect(preview.getAttribute("data-state")).toBe("ok");
    screen.getByText("Engine");
    expect(screen.queryByTestId("compose-preview-toggle")).toBeNull();
    expect(
      preview.querySelector('[data-key-value-entry="max_model_len"]')
        ?.textContent,
    ).toBe("max_model_len: 262144");
    expect(
      preview.querySelector('[data-key-value-entry="TOKEN"]')?.textContent,
    ).toBe("TOKEN: secret");
  });

  it.each(["card", "plain"] as const)(
    "renders compose failures on the %s surface",
    (surface) => {
      render(
        <ComposePreview
          composed={null}
          error="Missing model"
          surface={surface}
        />,
      );

      expect(
        screen.getByTestId("compose-preview").getAttribute("data-state"),
      ).toBe("error");
      screen.getByText("Missing model");
    },
  );

  it("renders nothing before composition has a result", () => {
    const { container } = render(<ComposePreview composed={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders the card surface when the preview is not collapsible", () => {
    render(<ComposePreview composed={composed} />);

    expect(
      screen.getByTestId("compose-preview").getAttribute("data-state"),
    ).toBe("ok");
    screen.getByText("Engine");
  });
});
