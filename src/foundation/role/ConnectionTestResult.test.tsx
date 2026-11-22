import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionTestResult } from "./ConnectionTestResult";

const TIME = "2026-01-01T00:00:00Z";

describe("ConnectionTestResult", () => {
  it.each([
    { test: { ok: true, time: TIME }, text: "common.connectionTest.ok" },
    { test: { ok: false, time: TIME }, text: "common.connectionTest.failed" },
    { test: { ok: true }, text: "common.connectionTest.never" },
    { test: null, text: "common.connectionTest.never" },
  ])("shows $text for $test", ({ test, text }) => {
    render(
      <TooltipProvider>
        <ConnectionTestResult test={test} />
      </TooltipProvider>,
    );

    screen.getByText(text);
    expect(screen.queryByText(/ago$/) !== null).toBe(Boolean(test?.time));
  });
});
