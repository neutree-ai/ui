import { describe, expect, it } from "vitest";
import { moveTargetGroupId } from "@/domains/api-key/lib/move-target-group";
import type { ApiKeyProject } from "@/domains/api-key/types";

const group = (
  id: string,
  workspace: string,
  is_ungrouped = false,
): ApiKeyProject =>
  ({
    id,
    metadata: { name: id, workspace },
    spec: { description: "" },
    is_ungrouped,
  }) as ApiKeyProject;

const groups = [
  group("ungrouped-a", "ws-a", true),
  group("ungrouped-b", "ws-b", true),
  group("project-1", "ws-a"),
];

describe("moveTargetGroupId", () => {
  it("finds the target Project's group", () => {
    expect(moveTargetGroupId(groups, "project-1", "ws-a")).toBe("project-1");
  });

  it("finds the ungrouped bucket of the keys' workspace for an empty target", () => {
    expect(moveTargetGroupId(groups, "", "ws-b")).toBe("ungrouped-b");
  });

  it("is undefined when the target group is not listed", () => {
    expect(moveTargetGroupId(groups, "project-9", "ws-a")).toBeUndefined();
  });
});
