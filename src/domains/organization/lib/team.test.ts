import { describe, expect, it } from "vitest";
import type { Team } from "@/domains/organization/types";
import { isManualTeam, teamSource, validateTeamName } from "./team";

describe("isManualTeam", () => {
  it("tells manual Teams from synced ones", () => {
    const spec = (s: Team["spec"]) => ({ spec: s });
    expect(isManualTeam(spec(null))).toBe(true);
    expect(
      isManualTeam(spec({ identity_source: null, external_id: null })),
    ).toBe(true);
    expect(isManualTeam(spec({ identity_source: "", external_id: "" }))).toBe(
      true,
    );
    expect(
      isManualTeam(spec({ identity_source: "corp", external_id: "g1" })),
    ).toBe(false);
    expect(
      teamSource(spec({ identity_source: "corp", external_id: "g1" })),
    ).toBe("corp");
    expect(teamSource(spec(null))).toBe("");
  });
});

describe("validateTeamName", () => {
  it("accepts a valid name", () => {
    expect(validateTeamName("platform")).toBeUndefined();
    expect(validateTeamName("ml.infra-2")).toBeUndefined();
    // Not 12 hex digits: allowed.
    expect(validateTeamName("team-0123456789a")).toBeUndefined();
  });

  it("refuses what the database refuses", () => {
    expect(validateTeamName("")).toBe("required");
    expect(validateTeamName("Platform")).toBe("format");
    expect(validateTeamName("-a")).toBe("format");
    expect(validateTeamName("a".repeat(64))).toBe("tooLong");
    expect(validateTeamName("corp-0123456789ab")).toBe("reserved");
  });
});
