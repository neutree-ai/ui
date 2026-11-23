import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/foundation/role/Timestamp", () => ({ default: () => null }));

import LogSinkStatus from "./LogSinkStatus";

describe("LogSinkStatus", () => {
  it.each([
    ["Running", "positive"],
    ["Failed", "serious"],
    ["Degraded", "notice"],
    ["Pending", "notice"],
    ["Disabled", "neutral"],
    ["Deleted", "neutral"],
  ])("%s reads as %s", (phase, tone) => {
    render(
      <TooltipProvider>
        <LogSinkStatus phase={phase as never} />
      </TooltipProvider>,
    );
    expect(
      screen.getByText(`status.phases.logSink.${phase}`).className,
    ).toContain(`-${tone}-`);
  });
});
