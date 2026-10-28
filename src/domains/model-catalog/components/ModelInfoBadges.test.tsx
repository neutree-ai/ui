import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
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
        info={{
          parameter_count: "27000000000",
          quantization: "BF16",
          context_length: "131072",
          architecture: "Qwen3ForCausalLM",
        }}
      />,
    );

    screen.getByText("27B");
    screen.getByText("BF16");
    screen.getByText("131K");
    screen.getByText("Qwen3ForCausalLM");
  });

  it("shows the complete architecture in a keyboard-accessible tooltip", async () => {
    vi.mocked(useIsTruncated).mockReturnValue(true);
    const architecture =
      "Qwen3MoeForConditionalGenerationWithAnIntentionallyLongArchitectureName";
    render(
      <TooltipProvider delayDuration={0}>
        <ModelInfoBadges
          info={{ architecture, parameter_count: "6000000000" }}
        />
      </TooltipProvider>,
    );

    screen.getByText("6B");
    const triggerValue = screen.getByText(architecture);
    const trigger = triggerValue.closest("div[tabindex='0']");
    if (!trigger)
      throw new Error("architecture tooltip trigger was not rendered");

    fireEvent.focus(trigger);

    expect((await screen.findByRole("tooltip")).textContent).toBe(architecture);
    vi.mocked(useIsTruncated).mockReturnValue(false);
  });

  it("leaves an architecture that fits alone", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <ModelInfoBadges
          info={{ architecture: "Llama", parameter_count: "6000000000" }}
        />
      </TooltipProvider>,
    );

    const triggerValue = screen.getByText("Llama");
    const trigger = triggerValue.parentElement as HTMLElement;

    // Nothing to reveal: no tab stop, no popup.
    expect(trigger.getAttribute("tabindex")).toBeNull();

    fireEvent.focus(trigger);
    fireEvent.mouseEnter(trigger);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
