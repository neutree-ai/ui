import { describe, expect, it } from "vitest";
import { formatPermission } from "@/domains/role/lib/format-permission";

const t = ((key: string) => key) as Parameters<typeof formatPermission>[0];

describe("formatPermission", () => {
  it("labels a resource by its page title", () => {
    expect(formatPermission(t, "model:push")).toBe(
      "models.title:permissions.push",
    );
  });

  it("labels group_policy as the policy, not as model access", () => {
    expect(formatPermission(t, "group_policy:read")).toBe(
      "group_policies.permissionTitle:permissions.read",
    );
  });
});
