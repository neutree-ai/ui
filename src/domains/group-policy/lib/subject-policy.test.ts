import { describe, expect, it } from "vitest";
import type {
  GroupTokenPool,
  SubjectPolicy,
  UserGroupPolicyGroup,
} from "@/domains/group-policy/types";
import {
  buildSubjectPolicySpec,
  otherPolicyRules,
  subjectPolicyChange,
  tokenPoolSource,
} from "./subject-policy";

const pool = (over: Partial<GroupTokenPool>) =>
  ({ kind: "Team", name: "sre", ...over }) as GroupTokenPool;

const group = (over: Partial<UserGroupPolicyGroup>): UserGroupPolicyGroup => ({
  kind: "Team",
  name: "sre",
  active: true,
  allowed_models: [{ model: "a" }],
  denied_models: null,
  ...over,
});

const own = (over: Partial<SubjectPolicy>): SubjectPolicy => ({
  name: "user-u1-team-sre",
  subject_kind: "User",
  scope_kind: "Team",
  scope_name: "sre",
  scope_display_name: "SRE",
  in_scope: true,
  allowed_models: [{ model: "b" }],
  denied_models: null,
  token_quota: null,
  ...over,
});

describe("buildSubjectPolicySpec", () => {
  it("sends subject, scope and every field, keeping the denied list", () => {
    expect(
      buildSubjectPolicySpec(
        { kind: "ServiceAccount", id: "sa-1" },
        { kind: "Team", name: "sre" },
        [],
        [{ model: "x" }],
        { limit: 10, period: "daily" },
      ),
    ).toEqual({
      subject_kind: "ServiceAccount",
      subject_name: "sa-1",
      scope_kind: "Team",
      scope_name: "sre",
      allowed_models: null,
      denied_models: [{ model: "x" }],
      token_quota: { limit: 10, period: "daily" },
    });
  });
});

describe("subjectPolicyChange", () => {
  const spec = (allowed: number, quota: boolean) =>
    buildSubjectPolicySpec(
      { kind: "User", id: "u1" },
      { kind: "Team", name: "sre" },
      Array.from({ length: allowed }, (_, i) => ({ model: `m${i}` })),
      null,
      quota ? { limit: 1, period: "daily" } : null,
    );

  it.each([
    { existing: null, allowed: 0, quota: false, change: "none" },
    { existing: 7, allowed: 0, quota: false, change: "remove" },
    { existing: null, allowed: 1, quota: false, change: "save" },
    { existing: 7, allowed: 0, quota: true, change: "save" },
  ] as const)(
    "existing $existing, $allowed models, quota $quota -> $change",
    ({ existing, allowed, quota, change }) => {
      expect(subjectPolicyChange(existing, spec(allowed, quota))).toBe(change);
    },
  );
});

describe("tokenPoolSource", () => {
  it.each([
    {
      pool: pool({ display_name: "Site Reliability" }),
      source: {
        owner: "group",
        kind: "Team",
        name: "sre",
        label: "Site Reliability",
      },
    },
    {
      pool: pool({ kind: "OrgUnit", name: "rd", display_name: null }),
      source: { owner: "group", kind: "OrgUnit", name: "rd", label: "rd" },
    },
    {
      pool: pool({
        kind: "User",
        name: "u1",
        scope_kind: "OrgUnit",
        scope_name: "rd",
        scope_display_name: "R&D",
      }),
      source: {
        owner: "subject",
        scopeKind: "OrgUnit",
        scopeName: "rd",
        scopeLabel: "R&D",
      },
    },
    {
      pool: pool({ kind: "ServiceAccount", name: "sa-1", scope_kind: null }),
      source: {
        owner: "subject",
        scopeKind: null,
        scopeName: null,
        scopeLabel: null,
      },
    },
  ])("$pool.kind $pool.name", ({ pool, source }) => {
    expect(tokenPoolSource(pool)).toEqual(source);
  });
});

describe("otherPolicyRules", () => {
  it("lists groups and the subject's other policies with model rules", () => {
    const rules = otherPolicyRules(
      {
        groups: [
          group({ active: false }),
          group({ name: "pool-only", allowed_models: null }),
        ],
        subject_policies: [
          own({}),
          own({ name: "elsewhere", scope_name: "ops", in_scope: false }),
        ],
      },
      "user-u1-team-sre",
    );
    expect(rules.map((rule) => [rule.key, rule.applies])).toEqual([
      // An inactive group's policy still applies; a policy whose subject
      // left its scope does not.
      ["Team/sre", true],
      ["elsewhere", false],
    ]);
  });
});
