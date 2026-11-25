import { describe, expect, it } from "vitest";
import type { ApiKey } from "@/domains/api-key/types";
import { fieldKeys, fieldValue } from "@/foundation/testing/detail-fields";
import { apiKeyHeaderFields, type ProjectLookup } from "./detail-fields";

const key = (spec: Partial<ApiKey["spec"]>, service_account_id?: string) =>
  ({ metadata: {}, spec, service_account_id }) as ApiKey;
const loaded: ProjectLookup = { name: "team-a", isLoading: false, error: null };
const renderApplication = () => null;

describe("apiKeyHeaderFields", () => {
  it("names the application of an application's key, not a project", () => {
    const keys = fieldKeys(
      apiKeyHeaderFields(key({}, "sa-1"), loaded, renderApplication),
    );

    expect(keys).toContain("application");
    expect(keys).not.toContain("project");
  });

  it.each([
    { project_id: null, lookup: loaded, shown: "api_keys.projects.ungrouped" },
    {
      project_id: "p1",
      lookup: { ...loaded, isLoading: true },
      shown: "api_keys.messages.loading",
    },
    {
      project_id: "p1",
      lookup: { ...loaded, error: new Error("x") },
      shown: "api_keys.projects.loadFailed",
    },
    { project_id: "p1", lookup: loaded, shown: "team-a" },
  ])("shows the project as $shown", ({ project_id, lookup, shown }) => {
    const record = key({ project_id });
    const fields = apiKeyHeaderFields(record, lookup, renderApplication);

    expect(fieldValue(fields, "project", record)).toBe(shown);
  });
});
