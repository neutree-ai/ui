import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  createMembership: vi.fn(),
  canAssign: true,
  options: undefined as
    | {
        departmentField?: unknown;
        onCreated: (user: { id: string; orgUnit: string }) => Promise<void>;
      }
    | undefined,
}));

vi.mock("@refinedev/core", () => ({
  useNotification: () => ({ open: mocks.notify }),
}));
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: () => ({
    allowed: mocks.canAssign,
    isLoading: false,
  }),
}));
vi.mock("@/domains/organization/hooks/use-organization", () => ({
  useOrgTree: () => ({ byName: new Map([["eng", { unit: { id: 7 } }]]) }),
  useCreateOrgUnitMembership: () => mocks.createMembership,
}));
vi.mock("@/domains/organization/components/OrgUnitField", () => ({
  OrgUnitField: () => null,
}));
vi.mock("@/domains/user/hooks/use-user-form", () => ({
  useUserForm: (options: typeof mocks.options) => {
    mocks.options = options;
    return { form: {}, registerFields: null };
  },
}));
vi.mock("@/foundation/components/ResourceForm", () => ({
  ResourceForm: () => null,
}));

import { UsersCreate } from "./create";

describe("UsersCreate", () => {
  beforeEach(() => {
    mocks.canAssign = true;
    mocks.notify.mockReset();
    mocks.createMembership.mockReset();
  });

  it("offers the department only with a global assign-member grant", () => {
    render(<UsersCreate />);
    expect(mocks.options?.departmentField).toBeTruthy();

    mocks.canAssign = false;
    render(<UsersCreate />);
    expect(mocks.options?.departmentField).toBeUndefined();
  });

  it("puts the created user into the chosen department", async () => {
    render(<UsersCreate />);
    await mocks.options?.onCreated({ id: "u-1", orgUnit: "eng" });
    expect(mocks.createMembership).toHaveBeenCalledWith("u-1", 7);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("does nothing when no department is chosen", async () => {
    render(<UsersCreate />);
    await mocks.options?.onCreated({ id: "u-1", orgUnit: "" });
    expect(mocks.createMembership).not.toHaveBeenCalled();
  });

  it("reports a failed assignment without undoing the user", async () => {
    mocks.createMembership.mockRejectedValue(new Error("denied"));
    render(<UsersCreate />);
    await mocks.options?.onCreated({ id: "u-1", orgUnit: "eng" });
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "user_profiles.department.errors.createdNotAssigned",
      }),
    );
  });
});
