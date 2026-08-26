import { describe, expect, it } from "vitest";
import { RegistryModelError } from "@/foundation/lib/api/registry-models";
import { resolveModelInfoRead } from "@/foundation/lib/model-info-read";

const idle = {
  selected: true,
  info: undefined,
  isLoading: false,
  error: null,
};

describe("resolveModelInfoRead", () => {
  it("asks nothing until a model is chosen", () => {
    expect(resolveModelInfoRead({ ...idle, selected: false })).toEqual({
      state: "none",
    });
  });

  it("reports the read while it is in flight", () => {
    expect(resolveModelInfoRead({ ...idle, isLoading: true })).toEqual({
      state: "loading",
    });
  });

  it("separates a gated repository from a model that is not there", () => {
    // Both are 4xx and both leave us with no checkpoint, but one is fixed by
    // configuring a token on the registry and the other by picking another
    // model — so they must not share a sentence.
    const gated = resolveModelInfoRead({
      ...idle,
      error: new RegistryModelError(401, {
        reason: "registry_unauthorized",
        message: "access to this model is gated",
      }),
    });

    expect(gated).toEqual({
      state: "unread",
      reason: "unauthorized",
      message: "access to this model is gated",
    });

    expect(
      resolveModelInfoRead({
        ...idle,
        error: new RegistryModelError(404, { reason: "not_found" }),
      }),
    ).toMatchObject({ state: "unread", reason: "not-found" });
  });

  it("falls back to the status when the server named no reason", () => {
    expect(
      resolveModelInfoRead({
        ...idle,
        error: new RegistryModelError(403, {}),
      }),
    ).toMatchObject({ state: "unread", reason: "unauthorized" });

    expect(
      resolveModelInfoRead({
        ...idle,
        error: new RegistryModelError(502, { message: "bad gateway" }),
      }),
    ).toMatchObject({ state: "unread", reason: "unavailable" });

    expect(
      resolveModelInfoRead({
        ...idle,
        error: new RegistryModelError(429, { reason: "rate_limited" }),
      }),
    ).toMatchObject({ state: "unread", reason: "unavailable" });
  });

  it("treats a failure that is not a registry error as unavailable", () => {
    expect(
      resolveModelInfoRead({ ...idle, error: new TypeError("network down") }),
    ).toEqual({ state: "unread", reason: "unavailable", message: null });
  });

  it("separates a registry that said nothing from a checkpoint it could not parse", () => {
    expect(resolveModelInfoRead(idle)).toEqual({ state: "unreported" });

    // What the parser returns for a model with no readable config.json: every
    // field looked for, none established.
    expect(
      resolveModelInfoRead({
        ...idle,
        info: {
          missing_fields: [
            "architecture",
            "num_hidden_layers",
            "num_key_value_heads",
            "head_dim",
          ],
        },
      }),
    ).toEqual({ state: "unparsed" });
  });

  it("passes a checkpoint through once anything about it is established", () => {
    // One established field is enough: the estimator, not this, decides whether
    // the fields it needs are among them.
    const info = {
      num_hidden_layers: 28,
      field_sources: { num_hidden_layers: "auto" },
      missing_fields: ["head_dim"],
    };

    expect(resolveModelInfoRead({ ...idle, info })).toEqual({
      state: "ready",
      info,
    });
  });

  it("prefers a failure to a stale checkpoint", () => {
    // The query keeps the previous model's data around; a read that failed is
    // not an answer about this model.
    expect(
      resolveModelInfoRead({
        ...idle,
        info: { num_hidden_layers: 28, field_sources: { x: "auto" } },
        error: new RegistryModelError(401, { reason: "registry_unauthorized" }),
      }),
    ).toMatchObject({ state: "unread", reason: "unauthorized" });
  });
});
