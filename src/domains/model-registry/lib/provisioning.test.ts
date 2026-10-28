import { describe, expect, it } from "vitest";
import { registryIsProvisioned } from "@/domains/model-registry/lib/provisioning";

describe("registryIsProvisioned", () => {
  // Only the annotation the control plane stamps, spelt exactly: a user's own
  // registry may be a public hub under the same name and is still theirs.
  it.each([
    [{ "neutree.ai/builtin": "true" }, true],
    [{}, false],
    [{ "neutree.ai/builtin": "false" }, false],
    [{ "neutree.ai/managed": "true" }, false],
    [undefined, false],
    [null, false],
  ])("annotations %j -> %s", (annotations, expected) => {
    expect(registryIsProvisioned({ metadata: { annotations } })).toBe(expected);
  });
});
