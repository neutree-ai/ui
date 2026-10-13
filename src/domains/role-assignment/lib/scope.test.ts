import { describe, expect, it } from "vitest";
import { availableScopes, scopeFields, scopeOf } from "./scope";

describe("scopeOf", () => {
  it("reads each scope", () => {
    expect(scopeOf({ global: true, workspace: null, org_unit: null })).toBe(
      "global",
    );
    expect(scopeOf({ global: false, workspace: "ws", org_unit: null })).toBe(
      "workspace",
    );
    expect(scopeOf({ global: false, workspace: null, org_unit: "rnd" })).toBe(
      "org_unit",
    );
  });

  it("treats a missing org_unit (older server) as no subtree", () => {
    expect(scopeOf({ global: false, workspace: "ws" })).toBe("workspace");
  });

  it("keeps the subtree scope while no department is picked yet", () => {
    expect(scopeOf({ global: false, workspace: null, org_unit: "" })).toBe(
      "org_unit",
    );
  });
});

describe("scopeFields", () => {
  const subtree = { global: false, workspace: null, org_unit: "rnd" };
  const workspace = { global: false, workspace: "ws", org_unit: null };

  it("leaves exactly one scope set", () => {
    expect(scopeFields("global", subtree)).toEqual({
      global: true,
      workspace: null,
      org_unit: null,
    });
    expect(scopeFields("workspace", subtree)).toEqual({
      global: false,
      workspace: "",
      org_unit: null,
    });
    expect(scopeFields("org_unit", workspace)).toEqual({
      global: false,
      workspace: null,
      org_unit: "",
    });
  });

  it("keeps the value of the scope already selected", () => {
    expect(scopeFields("workspace", workspace).workspace).toBe("ws");
    expect(scopeFields("org_unit", subtree).org_unit).toBe("rnd");
  });
});

describe("availableScopes", () => {
  it("limits a delegated administrator to the subtree scope", () => {
    expect(
      availableScopes({
        isEnterprise: true,
        supportMultiWorkspace: true,
        delegated: true,
      }),
    ).toEqual(["org_unit"]);
  });

  it("offers the subtree scope only in the enterprise edition", () => {
    expect(
      availableScopes({
        isEnterprise: false,
        supportMultiWorkspace: true,
        delegated: false,
      }),
    ).toEqual(["global", "workspace"]);
    expect(
      availableScopes({
        isEnterprise: true,
        supportMultiWorkspace: false,
        delegated: false,
      }),
    ).toEqual(["global", "org_unit"]);
  });
});
