import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModelInfoBadges } from "./ModelInfoBadges";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

describe("ModelInfoBadges", () => {
  it("renders nothing without displayable model information", () => {
    const { container, rerender } = render(<ModelInfoBadges />);
    expect(container.firstChild).toBeNull();

    rerender(<ModelInfoBadges info={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it("formats metadata and renders architecture inline", () => {
    render(
      <ModelInfoBadges
        variant="inline"
        className="inline-metadata"
        info={{
          parameter_count: "27000000000",
          quantization: "BF16",
          context_length: "131072",
          architecture: "Qwen3ForCausalLM",
        }}
      />,
    );

    expect(screen.getByText("27B")).toBeTruthy();
    expect(screen.getByText("BF16")).toBeTruthy();
    expect(screen.getByText("131K")).toBeTruthy();
    expect(screen.getByText("Qwen3ForCausalLM")).toBeTruthy();
    expect(document.querySelector(".inline-metadata")).not.toBeNull();
  });

  it("shows the complete architecture in a keyboard-accessible tooltip", async () => {
    const architecture =
      "Qwen3MoeForConditionalGenerationWithAnIntentionallyLongArchitectureName";
    render(
      <TooltipProvider delayDuration={0}>
        <ModelInfoBadges
          className="catalog-info"
          info={{ architecture, parameter_count: "6000000000" }}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("6B")).toBeTruthy();
    const triggerValue = screen.getByText(architecture);
    const trigger = triggerValue.closest("div[tabindex='0']");
    if (!trigger)
      throw new Error("architecture tooltip trigger was not rendered");

    expect(triggerValue.className).toContain("truncate");
    fireEvent.focus(trigger);

    expect((await screen.findByRole("tooltip")).textContent).toBe(architecture);
  });
});
