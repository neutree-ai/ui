import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@refinedev/core", () => ({
  useGetIdentity: vi.fn(),
}));
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({ title, children, ...props }: Record<string, ReactNode>) => (
      <section data-testid={props["data-testid"] as string}>
        {title}
        {children}
      </section>
    ),
  },
}));
vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: vi.fn(),
}));
vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspaceOptions: () => ({
    workspaces: [{ metadata: { name: "ws1" } }, { metadata: { name: "ws2" } }],
    isLoading: false,
  }),
}));
vi.mock("@/domains/group-policy/hooks/use-group-policies", () => ({
  useUserGroupPolicy: vi.fn(),
}));

import { useGetIdentity } from "@refinedev/core";
import { useUserGroupPolicy } from "@/domains/group-policy/hooks/use-group-policies";
import type { UserGroupPolicy } from "@/domains/group-policy/types";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { UserGroupModelAccess } from "./UserGroupModelAccess";

const setup = ({
  self,
  canRead,
  policy,
  denied = false,
}: {
  self: boolean;
  canRead: boolean;
  policy?: UserGroupPolicy;
  denied?: boolean;
}) => {
  vi.mocked(useGetIdentity).mockReturnValue({
    data: { id: self ? "u-1" : "admin" },
  } as unknown as ReturnType<typeof useGetIdentity>);
  vi.mocked(useHasGlobalPermission).mockReturnValue({
    allowed: canRead,
    isLoading: false,
  });
  vi.mocked(useUserGroupPolicy).mockReturnValue({
    policy,
    isLoading: false,
    denied,
    error: null,
  });
};

const policy: UserGroupPolicy = {
  allowed_models: null,
  denied_models: ["gpt"],
  groups: [
    {
      kind: "OrgUnit",
      name: "rd",
      active: false,
      allowed_models: null,
      denied_models: [{ model: "gpt" }, { model: "other", workspace: "ws2" }],
    },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("UserGroupModelAccess", () => {
  it("does not ask for another user's policy without group_policy:read", () => {
    setup({ self: false, canRead: false });
    const { container } = render(<UserGroupModelAccess userId="u-1" />);
    expect(container.innerHTML).toBe("");
    expect(vi.mocked(useUserGroupPolicy).mock.calls[0][2]).toBe(false);
  });

  it("is hidden when the server refuses", () => {
    setup({ self: true, canRead: false, denied: true });
    const { container } = render(<UserGroupModelAccess userId="u-1" />);
    expect(container.innerHTML).toBe("");
  });

  it("reads the preselected workspace", () => {
    setup({ self: true, canRead: false, policy });
    render(<UserGroupModelAccess userId="u-1" initialWorkspace="ws2" />);
    expect(vi.mocked(useUserGroupPolicy).mock.calls[0][1]).toBe("ws2");
  });

  it("shows the merged result and each group, marking inactive ones", () => {
    setup({ self: false, canRead: true, policy });
    render(
      <UserGroupModelAccess
        userId="u-1"
        renderOrgUnit={(name) => `dept:${name}`}
      />,
    );
    expect(vi.mocked(useUserGroupPolicy).mock.calls[0][1]).toBe("ws1");
    expect(screen.getByTestId("user-model-access-allowed").textContent).toBe(
      "group_policies.unrestricted",
    );
    expect(screen.getByTestId("user-model-access-denied").textContent).toBe(
      "gpt",
    );
    const row = screen.getByTestId("user-model-access-group-OrgUnit-rd");
    expect(row.textContent).toContain("dept:rd");
    expect(row.textContent).toContain("group_policies.effective.inactive");
    // The entry pinned to ws2 does not apply in ws1.
    expect(row.textContent).not.toContain("other");
  });
});
