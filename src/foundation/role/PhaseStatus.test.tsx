import { render, screen } from "@testing-library/react";
import { describe, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PhaseStatus } from "@/foundation/role/PhaseStatus";
import { phases } from "@/foundation/role/phases";
import type { BaseStatus } from "@/foundation/types/basic-types";

const upstreamPhases = phases("status.phases.externalEndpointUpstream", {
  Ready: "positive",
});

describe("PhaseStatus", () => {
  it("renders a status that carries fields beyond the phase", () => {
    const status = {
      phase: "Ready",
      ref: "endpoint-a",
      models: ["chat"],
    } as BaseStatus;

    render(
      <TooltipProvider>
        <PhaseStatus status={status} phases={upstreamPhases} />
      </TooltipProvider>,
    );

    screen.getByText("status.phases.externalEndpointUpstream.Ready");
  });
});
