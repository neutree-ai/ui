import { describe, expect, it } from "vitest";
import { ownerTone } from "./gpu-ownership";

describe("GPU ownership tones", () => {
  it("mixes soft ownership against a theme-independent white tint", () => {
    expect(ownerTone("#0077bb", 24)).toContain("var(--nt-text-neutral-ontint)");
    expect(ownerTone("#0077bb", 24)).not.toContain(
      "var(--nt-fill-neutral-white)",
    );
  });
});
