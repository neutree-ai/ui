import { describe, expect, it } from "vitest";
import { registryIsProvisioned } from "@/domains/model-registry/lib/provisioning";

const registry = (annotations?: Record<string, string> | null) => ({
  metadata: { annotations },
});

describe("registryIsProvisioned", () => {
  it("is the annotation the control plane stamps, spelt exactly", () => {
    expect(
      registryIsProvisioned(registry({ "neutree.ai/builtin": "true" })),
    ).toBe(true);
  });

  it("treats anything other than that annotation as a user's registry", () => {
    expect(registryIsProvisioned(registry({}))).toBe(false);
    expect(
      registryIsProvisioned(registry({ "neutree.ai/builtin": "false" })),
    ).toBe(false);
    // A registry a user made that happens to be a public hub under the same
    // name is still theirs to edit; only the annotation says otherwise.
    expect(
      registryIsProvisioned(registry({ "neutree.ai/managed": "true" })),
    ).toBe(false);
  });

  it("survives a record whose annotations are absent", () => {
    expect(registryIsProvisioned(registry(undefined))).toBe(false);
    expect(registryIsProvisioned(registry(null))).toBe(false);
  });
});
