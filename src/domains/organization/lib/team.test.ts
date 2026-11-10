import { describe, expect, it } from "vitest";
import type { Team } from "@/domains/organization/types";
import {
  isManualTeam,
  isProjectTeam,
  matchesTeamKind,
  TEAM_KIND_LABEL,
  teamSource,
  validateTeamName,
  withProjectLabel,
} from "./team";

describe("project label", () => {
  const team = (labels?: Record<string, string>) =>
    ({ metadata: { name: "t", labels } }) as unknown as Team;

  it("tells project Teams from others", () => {
    expect(isProjectTeam(team({ [TEAM_KIND_LABEL]: "project" }))).toBe(true);
    expect(isProjectTeam(team({ [TEAM_KIND_LABEL]: "other" }))).toBe(false);
    expect(isProjectTeam(team())).toBe(false);
  });

  it("filters by kind", () => {
    const project = team({ [TEAM_KIND_LABEL]: "project" });
    expect(matchesTeamKind(project, "all")).toBe(true);
    expect(matchesTeamKind(project, "project")).toBe(true);
    expect(matchesTeamKind(project, "team")).toBe(false);
    expect(matchesTeamKind(team(), "team")).toBe(true);
    expect(matchesTeamKind(team(), "project")).toBe(false);
  });

  it("sets and removes the label, keeping the others", () => {
    expect(withProjectLabel({ a: "b" }, true)).toEqual({
      a: "b",
      [TEAM_KIND_LABEL]: "project",
    });
    expect(
      withProjectLabel({ a: "b", [TEAM_KIND_LABEL]: "project" }, false),
    ).toEqual({ a: "b" });
    expect(withProjectLabel(null, false)).toEqual({});
  });
});

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
