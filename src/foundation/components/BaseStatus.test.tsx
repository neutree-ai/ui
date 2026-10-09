import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Timestamp reaches the real i18n module, which registers the react-i18next
// plugin mocked above and throws on a partial mock.
vi.mock("./Timestamp", () => ({ default: () => null }));

import BaseStatus from "./BaseStatus";

describe("BaseStatus", () => {
  it("renders the placeholder token when no phase has been reported", () => {
    // External endpoints the controller has never reconciled carry no phase.
    // The dash is the product's empty-value placeholder, so it takes the
    // placeholder colour instead of the typography of whatever sits beside it.
    const { container } = render(<BaseStatus translatedPhase="Running" />);
    const placeholder = container.querySelector("span");
    expect(placeholder?.textContent).toBe("-");
    expect(placeholder?.className).toContain("--nt-text-neutral-quaternary");
  });

  it("renders the translated phase when there is one", () => {
    const { container } = render(
      <TooltipProvider delayDuration={0}>
        <BaseStatus phase="Running" translatedPhase="Running" />
      </TooltipProvider>,
    );
    expect(container.textContent).toContain("Running");
  });
});
