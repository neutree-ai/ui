import { describe, expect, it } from "vitest";
import { makeTarget, makeUpstream } from "../testing/fixtures";
import { routesFromLegacy } from "./routes-from-legacy";

describe("routesFromLegacy", () => {
  it("turns each mapped model into a fixed route, first upstream wins", () => {
    const routes = routesFromLegacy([
      makeUpstream({ name: "a", model_mapping: { chat: "actual-chat" } }),
      makeUpstream({
        name: "b",
        model_mapping: { chat: "other-chat", embed: "actual-embed" },
      }),
    ]);

    expect(routes).toEqual([
      {
        model: "chat",
        strategy: "fixed",
        targets: [makeTarget({ upstream: "a", upstream_model: "actual-chat" })],
      },
      {
        model: "embed",
        strategy: "fixed",
        targets: [
          makeTarget({ upstream: "b", upstream_model: "actual-embed" }),
        ],
      },
    ]);
  });

  it("names an unnamed upstream by position and skips a missing mapping", () => {
    const routes = routesFromLegacy([
      makeUpstream({
        model_mapping: null as unknown as Record<string, string>,
      }),
      makeUpstream({ name: undefined, model_mapping: { chat: "m" } }),
    ]);

    expect(routes.map((route) => route.targets[0].upstream)).toEqual([
      "provider-2",
    ]);
  });
});
