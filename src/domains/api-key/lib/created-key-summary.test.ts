import { describe, expect, it } from "vitest";
import { createdKeySummary } from "./created-key-summary";

const key = (spec: object = {}, display_name = "Support") =>
  ({
    metadata: { name: "apikey-1", display_name },
    spec,
  }) as never;
const projects = [{ id: "p1", metadata: { name: "Billing" } }] as never;

describe("createdKeySummary", () => {
  it("names the Project and trims the description", () => {
    expect(
      createdKeySummary(key({ project_id: "p1", description: " Prod " }), {
        projects,
        hasProject: true,
      }),
    ).toEqual({
      name: "Support",
      description: "Prod",
      project: { name: "Billing", unresolved: false },
    });
  });

  it("files a key without a Project as ungrouped and blanks an empty description", () => {
    expect(
      createdKeySummary(key({ project_id: null, description: "  " }), {
        projects,
        hasProject: true,
      }),
    ).toEqual({
      name: "Support",
      description: null,
      project: { name: null, unresolved: false },
    });
  });

  it("flags a Project that is not in the list", () => {
    expect(
      createdKeySummary(key({ project_id: "gone" }), {
        projects,
        hasProject: true,
      }).project,
    ).toEqual({ name: null, unresolved: true });
  });

  it("has no Project row for an application key", () => {
    expect(
      createdKeySummary(key({ project_id: "p1" }), {
        projects,
        hasProject: false,
      }).project,
    ).toBeNull();
  });

  it("falls back to the technical name without a display name", () => {
    expect(
      createdKeySummary(key({}, ""), { projects, hasProject: false }).name,
    ).toBe("apikey-1");
  });
});
