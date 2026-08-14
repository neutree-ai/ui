import { describe, expect, it } from "vitest";
import type { RegistryModelPage } from "@/foundation/lib/api/registry-models";
import {
  MODEL_REGISTRY_SELECT,
  registryAcceptsWrites,
  registryContentsAreMeasured,
  registryModelDelivery,
  registryPagesFromOffset,
} from "@/foundation/lib/model-registry-visibility";

const page = (total: number | null): RegistryModelPage => ({
  models: [],
  total,
  freshness: { timestamp: null, cached: false },
});

describe("MODEL_REGISTRY_SELECT", () => {
  it("names visibility, because select=* does not include a computed field", () => {
    // The one thing that makes every rule below reachable. A request that sends
    // `*` gets `visibility: undefined` and every page silently renders the
    // fallback, which is the failure mode this constant exists to prevent.
    expect(MODEL_REGISTRY_SELECT).toContain("visibility");
  });
});

describe("visibility rules", () => {
  it("treats a public registry as somebody else's storage", () => {
    expect(registryContentsAreMeasured("public")).toBe(false);
    expect(registryAcceptsWrites("public")).toBe(false);
    expect(registryModelDelivery("public")).toBe("at-deploy-time");
  });

  it("treats a private registry as ours", () => {
    expect(registryContentsAreMeasured("private")).toBe(true);
    expect(registryAcceptsWrites("private")).toBe(true);
    expect(registryModelDelivery("private")).toBe("already-local");
  });

  it("does not assume public when the field was not selected", () => {
    // Undefined means "not asked for", not "public". Counting falls back to the
    // reading that resolves itself by waiting; nothing claims a registry is a
    // public one on the strength of a missing field.
    expect(registryContentsAreMeasured(undefined)).toBe(true);
  });

  it("does not call a registry writable on the strength of a missing field", () => {
    // Fails closed: "not public" would be true here, and a caller that forgot
    // the select would get write controls on a public registry — the acceptance
    // this predicate exists to hold. Two missing buttons is the cheaper wrong
    // answer, and the one somebody notices.
    expect(registryAcceptsWrites(undefined)).toBe(false);
  });

  it("refuses to say where models come from when nobody said", () => {
    // Not folded into "already-local". That answer would take the deploy-time
    // warning off the screen and leave no trace that it had — the one failure
    // mode a caller cannot notice. Naming it makes the caller decide.
    expect(registryModelDelivery(undefined)).toBe("unknown");
  });
});

describe("registryPagesFromOffset", () => {
  it("pages when the server counted the matches", () => {
    expect(registryPagesFromOffset(page(57))).toBe(true);
    // Zero is a count, not an absence of one.
    expect(registryPagesFromOffset(page(0))).toBe(true);
  });

  it("does not page when the server could not count them", () => {
    expect(registryPagesFromOffset(page(null))).toBe(false);
  });

  it("says nothing before a page has arrived", () => {
    // Null, not false: the capability is unknown at this point, and a caller
    // that reads "unknown" as either answer draws paging controls on a guess.
    expect(registryPagesFromOffset(null)).toBeNull();
  });
});
