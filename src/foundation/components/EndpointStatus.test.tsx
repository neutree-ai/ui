import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/components/BaseStatus", () => ({
  default: ({
    className,
    translatedPhase,
  }: {
    className?: string;
    translatedPhase: string;
  }) => <span className={className}>{translatedPhase}</span>,
}));

import EndpointStatus from "./EndpointStatus";

describe("EndpointStatus", () => {
  it("uses the shared endpoint phase style", () => {
    render(<EndpointStatus phase="Running" />);
    const status = screen.getByText("status.phases.endpoint.Running");
    expect(status.className).toContain("positive");
  });
});
