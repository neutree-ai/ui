import { describe, expect, it } from "vitest";
import { phases, phaseTone } from "@/foundation/role/phases";
import { STATUS_TONE } from "@/foundation/role/status-tone";

const listed = phases("status.phases.engine", { Created: "positive" });
const withFallback = phases(
  "license.phase",
  { Active: "positive" },
  { fallback: "neutral", lowercase: true },
);

describe("phases", () => {
  it.each([
    [listed, "Created", STATUS_TONE.positive],
    [listed, "Unknown", undefined],
    [listed, undefined, undefined],
    [withFallback, "Unknown", STATUS_TONE.neutral],
  ])("tones %#: %s", (table, phase, tone) => {
    expect(phaseTone(table, phase)).toBe(tone);
  });

  it("names each phase's locale key under the prefix", () => {
    expect(listed.label("Created")).toBe("status.phases.engine.Created");
    expect(withFallback.label("Active")).toBe("license.phase.active");
  });
});
