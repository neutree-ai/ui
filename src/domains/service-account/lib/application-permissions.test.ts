import { describe, expect, it } from "vitest";
import { isManagementRole } from "@/domains/service-account/lib/application-permissions";

describe("isManagementRole", () => {
  it("flags roles that manage access", () => {
    expect(isManagementRole(["system:admin"])).toBe(true);
    expect(isManagementRole(["role:read", "role_assignment:create"])).toBe(
      true,
    );
    expect(isManagementRole(["team:read", "service_account:create"])).toBe(
      true,
    );
  });

  it("passes roles that only use or read", () => {
    expect(isManagementRole(["model:invoke", "workspace:read"])).toBe(false);
    expect(isManagementRole(["endpoint:create", "user_profile:read"])).toBe(
      false,
    );
    expect(isManagementRole(undefined)).toBe(false);
  });
});
