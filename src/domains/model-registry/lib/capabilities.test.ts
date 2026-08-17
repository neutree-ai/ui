import { describe, expect, it } from "vitest";
import {
  registryIsDisabled,
  registryIsUnreachable,
} from "@/domains/model-registry/lib/capabilities";
import type { ModelRegistry } from "@/domains/model-registry/types";

const registry = (
  overrides: { phase?: string; deletionTimestamp?: string | null } = {},
): ModelRegistry =>
  ({
    id: 1,
    api_version: "v1",
    kind: "ModelRegistry",
    metadata: {
      name: "r",
      workspace: "default",
      deletion_timestamp: overrides.deletionTimestamp ?? null,
      creation_timestamp: "2026-01-01T00:00:00Z",
      update_timestamp: "2026-01-01T00:00:00Z",
      labels: {},
      annotations: {},
    },
    spec: { type: "hugging-face", url: "https://example.invalid" },
    status: overrides.phase ? { phase: overrides.phase } : null,
  }) as unknown as ModelRegistry;

describe("registryIsUnreachable", () => {
  it("is the Failed phase and nothing else", () => {
    expect(registryIsUnreachable(registry({ phase: "Failed" }))).toBe(true);

    for (const phase of ["Connected", "Pending", "Deleted"]) {
      expect(registryIsUnreachable(registry({ phase }))).toBe(false);
    }
  });

  it("does not call a registry with no status yet unreachable", () => {
    // No status is "not looked at", which is what Pending means. Reporting it as
    // unreachable would put a warning and a retry button on a registry that was
    // created seconds ago and is fine.
    expect(registryIsUnreachable(registry())).toBe(false);
  });
});

describe("registryIsDisabled", () => {
  it("reads the deletion stamp, which lands before the phase does", () => {
    // The two-step is the point: between the stamp and the controller's `Deleted`
    // the registry still reports Connected, and reading only the phase would
    // leave that window looking like a healthy registry that inexplicably lists
    // nothing.
    expect(
      registryIsDisabled(
        registry({
          phase: "Connected",
          deletionTimestamp: "2026-01-02T00:00:00Z",
        }),
      ),
    ).toBe(true);
  });

  it("reads the Deleted phase too", () => {
    expect(registryIsDisabled(registry({ phase: "Deleted" }))).toBe(true);
  });

  it("leaves a live registry alone", () => {
    expect(registryIsDisabled(registry({ phase: "Connected" }))).toBe(false);
  });
});
