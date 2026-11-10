import { describe, expect, it } from "vitest";
import { isEndpointWithdrawn } from "./endpoint-availability";

describe("isEndpointWithdrawn", () => {
  it.each([
    [{ metadata: { deletion_timestamp: "2026-11-06T16:00:00Z" } }, true],
    [{ status: { phase: "Deleting" } }, true],
    [{ status: { phase: "Deleted" } }, true],
    [{ status: { phase: "Running" } }, false],
  ])("%j → %s", (endpoint, withdrawn) => {
    expect(isEndpointWithdrawn(endpoint)).toBe(withdrawn);
  });
});
