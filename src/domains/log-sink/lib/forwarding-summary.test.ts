import { describe, expect, it } from "vitest";
import type { LogSink } from "@/domains/log-sink/types";
import { summarizeForwarding } from "./forwarding-summary";

const sink = (
  phase: string | undefined,
  options: { enabled?: boolean; deleted?: boolean } = {},
) =>
  ({
    metadata: {
      name: "s",
      deletion_timestamp: options.deleted ? "2026-01-01T00:00:00Z" : null,
    },
    spec: { type: "victorialogs", enabled: options.enabled },
    status: phase ? { phase } : null,
  }) as unknown as LogSink;

describe("summarizeForwarding", () => {
  it("counts enabled destinations, treating an absent flag as enabled", () => {
    const summary = summarizeForwarding([
      sink("Running"),
      sink("Running", { enabled: true }),
      sink("Disabled", { enabled: false }),
      sink(undefined),
    ]);
    expect(summary.enabled).toBe(3);
    expect(summary.alert).toBeNull();
  });

  it("reports failed over degraded", () => {
    const summary = summarizeForwarding([
      sink("Degraded"),
      sink("Failed"),
      sink("Degraded"),
    ]);
    expect(summary).toMatchObject({ failed: 1, degraded: 2, alert: "failed" });
  });

  it("reports degraded when nothing has failed", () => {
    expect(summarizeForwarding([sink("Degraded"), sink("Pending")]).alert).toBe(
      "degraded",
    );
  });

  it("ignores destinations being deleted", () => {
    const summary = summarizeForwarding([sink("Failed", { deleted: true })]);
    expect(summary).toMatchObject({ enabled: 0, failed: 0, alert: null });
  });

  it("is empty for no destinations", () => {
    expect(summarizeForwarding([])).toEqual({
      enabled: 0,
      failed: 0,
      degraded: 0,
      alert: null,
    });
  });
});
