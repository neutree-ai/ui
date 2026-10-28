import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/foundation/components/Timestamp", () => ({
  default: ({ timestamp }: { timestamp: string }) => <span>{timestamp}</span>,
}));

import { IdentitySourceStatus } from "./IdentitySourceStatus";

const renderStatus = (
  status: Parameters<typeof IdentitySourceStatus>[0]["status"],
) =>
  render(
    <TooltipProvider>
      <IdentitySourceStatus status={status} />
    </TooltipProvider>,
  );

describe("IdentitySourceStatus", () => {
  it("renders a dash before the controller has written a phase", () => {
    renderStatus(null);
    expect(screen.getByTestId("identity-source-status").textContent).toBe("-");
  });

  it("shows the phase and, on hover, the failed test and its message", async () => {
    renderStatus({
      phase: "Failed",
      error_message: "LDAP bind failed: invalid credentials",
      last_connection_test: {
        time: "2026-10-08T01:00:00Z",
        ok: false,
        message: "LDAP bind failed: invalid credentials",
      },
    });
    const badge = screen.getByTestId("identity-source-status");
    expect(badge.textContent).toBe("identity_sources.phases.Failed");
    fireEvent.focus(badge);
    await screen.findAllByText("LDAP bind failed: invalid credentials");
    screen.getAllByText(/^identity_sources\.status\.lastTestFailed/);
  });

  it("says when a source has not been tested yet", async () => {
    renderStatus({ phase: "Pending" });
    fireEvent.focus(screen.getByTestId("identity-source-status"));
    await screen.findAllByText("identity_sources.status.notTested");
  });
});
