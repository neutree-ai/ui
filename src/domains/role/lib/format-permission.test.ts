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

  it("labels model:invoke as calling models, apart from the registry actions", () => {
    expect(formatPermission(t, "model:invoke")).toBe(
      "permissions.labels.modelInvoke",
    );
  });

  it("labels the Team-level resources", () => {
    expect(formatPermission(t, "service_account:create")).toBe(
      "permissions.resources.service_account:permissions.create",
    );
  });
});
