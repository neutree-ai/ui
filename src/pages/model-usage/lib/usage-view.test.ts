import { describe, expect, it } from "vitest";
import type { UsageScope } from "./usage-scope";
import { readUsageView, writeUsageView } from "./usage-view";

const roundTrip = (scope: UsageScope | null) =>
  readUsageView(writeUsageView(new URLSearchParams(), { scope })).scope;

describe("usage view in the URL", () => {
  it("restores every kind of scope", () => {
    const team = { type: "team", name: "t1", label: "t1" } as const;
    expect(roundTrip({ type: "platform" })).toEqual({ type: "platform" });
    expect(roundTrip({ type: "applications" })).toEqual({
      type: "applications",
    });
    expect(roundTrip(null)).toBeNull();
    expect(roundTrip({ type: "orgUnit", name: "rnd" })).toEqual({
      type: "orgUnit",
      name: "rnd",
    });
    // A Team's label comes from the page; the URL holds only its name.
    expect(roundTrip({ ...team, label: "Team 1" })).toEqual(team);
    expect(
      roundTrip({ type: "user", id: "u1", label: "Ann", from: team }),
    ).toEqual({ type: "user", id: "u1", label: "Ann", from: team });
    expect(
      roundTrip({ type: "application", id: "sa1", label: "Bot", from: team }),
    ).toEqual({ type: "application", id: "sa1", label: "Bot", from: team });
  });

  it("leaves the scope to the page when the URL names none", () => {
    expect(readUsageView(new URLSearchParams()).scope).toBeUndefined();
  });

  it("drops the previous scope's keys and keeps unrelated ones", () => {
    const params = writeUsageView(new URLSearchParams("tab=detail"), {
      scope: { type: "user", id: "u1", label: "Ann", from: null },
    });
    const next = writeUsageView(params, { scope: { type: "platform" } });

    expect(next.toString()).toBe("tab=detail&scope=platform");

    const app = writeUsageView(params, {
      scope: { type: "application", id: "sa1", label: "Bot", from: null },
    });
    expect(
      writeUsageView(app, { scope: { type: "platform" } }).toString(),
    ).toBe("tab=detail&scope=platform");
  });

  it("reads a valid range only, and a known tab only", () => {
    const view = (query: string) => readUsageView(new URLSearchParams(query));

    expect(view("from=2026-10-01&to=2026-10-07").range).toEqual({
      start: "2026-10-01",
      end: "2026-10-07",
    });
    expect(view("from=2026-10-07&to=2026-10-01").range).toBeUndefined();
    expect(view("from=oops&to=2026-10-01").range).toBeUndefined();
    expect(view("tab=model").tab).toBeUndefined();
    expect(view("tab=apiKey").tab).toBe("apiKey");
  });
});
