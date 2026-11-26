import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";
import {
  apiKeyCurrentGroupLabel,
  apiKeyGroupView,
  createKeyPreset,
  keysMovingTo,
  projectPickerOption,
} from "./api-key-display-project";

const t = ((key: string) => key) as TFunction;
const group = (id: string, is_ungrouped = false, description = "") =>
  ({
    id,
    metadata: { name: id, workspace: "ws-a" },
    spec: { description },
    is_ungrouped,
  }) as ApiKeyProject;
const key = (project_id?: string | null) =>
  ({ spec: { project_id } }) as ApiKey;

describe("apiKeyGroupView", () => {
  it("labels the ungrouped bucket by translation and offers no Project actions", () => {
    expect(apiKeyGroupView(group("Ungrouped", true), t)).toEqual({
      label: "api_keys.projects.ungrouped",
      description: null,
      isProject: false,
    });
  });

  it("labels a Project by its name", () => {
    expect(apiKeyGroupView(group("billing", false, "Invoices"), t)).toEqual({
      label: "billing",
      description: "Invoices",
      isProject: true,
    });
  });
});

it.each([
  [null, "api_keys.projects.ungrouped"],
  ["p1", "Billing"],
  ["p9", "api_keys.move.unknownProject"],
])("a key in Project %s shows %s", (projectId, label) => {
  expect(
    apiKeyCurrentGroupLabel(key(projectId), new Map([["p1", "Billing"]]), t),
  ).toBe(label);
});

it("moves only the keys not already in the target", () => {
  expect(keysMovingTo([key(null), key("p1")], "")).toEqual([key("p1")]);
});

it.each([
  [group("p1"), undefined, { workspace: "ws-a", projectId: "p1" }],
  [group("u", true), undefined, { workspace: "ws-a", projectId: "" }],
  [undefined, "ws-b", { workspace: "ws-b", projectId: "" }],
  [undefined, undefined, { workspace: "", projectId: "" }],
])("creating from %j in %s starts with %j", (project, scoped, preset) => {
  expect(createKeyPreset(project, scoped)).toEqual(preset);
});

it("searches a picker option by name and description", () => {
  expect(projectPickerOption(group("billing", false, "Invoices"))).toEqual({
    label: "billing",
    description: "Invoices",
    searchText: "billing Invoices",
  });
});
