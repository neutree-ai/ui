import { describe, expect, it } from "vitest";
import { availableSubjectKinds, subjectFields, subjectKindOf } from "./subject";

describe("subjectKindOf", () => {
  it("reads a missing or null kind as User", () => {
    expect(subjectKindOf({})).toBe("User");
    expect(subjectKindOf({ subject_kind: null })).toBe("User");
    expect(subjectKindOf({ subject_kind: "Team" })).toBe("Team");
  });
});

describe("subjectFields", () => {
  const user = { user_id: "u-1", subject_kind: "User" as const };
  const team = {
    user_id: null,
    subject_kind: "Team" as const,
    subject_name: "sre",
  };

  it("clears user_id for a group", () => {
    expect(subjectFields("Team", user)).toEqual({
      subject_kind: "Team",
      subject_name: "",
      user_id: null,
    });
  });

  it("clears subject_name for a user", () => {
    expect(subjectFields("User", team)).toEqual({
      subject_kind: "User",
      subject_name: null,
      user_id: "",
    });
  });

  it("keeps the pick within a kind only", () => {
    expect(subjectFields("Team", team).subject_name).toBe("sre");
    expect(subjectFields("OrgUnit", team).subject_name).toBe("");
    expect(subjectFields("User", { user_id: "u-1" }).user_id).toBe("u-1");
  });
});

describe("availableSubjectKinds", () => {
  it("offers every kind to a global administrator", () => {
    expect(
      availableSubjectKinds({ delegated: false, canReadTeams: true }),
    ).toEqual(["User", "Team", "OrgUnit"]);
  });

  it("offers no Team to a delegated administrator", () => {
    expect(
      availableSubjectKinds({ delegated: true, canReadTeams: true }),
    ).toEqual(["User", "OrgUnit"]);
  });

  it("offers no Team to a caller who cannot list teams", () => {
    expect(
      availableSubjectKinds({ delegated: false, canReadTeams: false }),
    ).toEqual(["User", "OrgUnit"]);
  });
});

describe("application subjects", () => {
  it("keeps the application id in user_id, with no subject_name", () => {
    expect(
      subjectFields("ServiceAccount", {
        user_id: "u-1",
        subject_kind: "User",
      }),
    ).toEqual({
      subject_kind: "ServiceAccount",
      subject_name: null,
      user_id: "",
    });
    expect(
      subjectFields("ServiceAccount", {
        user_id: "sa-1",
        subject_kind: "ServiceAccount",
      }).user_id,
    ).toBe("sa-1");
  });
});
