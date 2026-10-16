import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({
      title,
      actions,
      children,
      ...props
    }: Record<string, ReactNode>) => (
      <section data-testid={props["data-testid"] as string}>
        {title}
        {actions}
        {children}
      </section>
    ),
  },
}));
vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: vi.fn(),
}));
vi.mock("@/domains/group-policy/hooks/use-group-policies", () => ({
  GroupPolicyGoneError: class extends Error {},
  useGroupPolicy: vi.fn(),
  useGroupPolicyWrites: () => ({
    save: vi.fn(),
    remove: vi.fn(),
    isPending: false,
  }),
}));

import { useGroupPolicy } from "@/domains/group-policy/hooks/use-group-policies";
import type { GroupPolicy } from "@/domains/group-policy/types";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { GroupModelAccess } from "./GroupModelAccess";

const grant = (...actions: string[]) =>
  vi.mocked(useHasGlobalPermission).mockImplementation((permission) => ({
    allowed: actions.some((a) => permission === `group_policy:${a}`),
    isLoading: false,
  }));

const withPolicy = (policy?: Partial<GroupPolicy["spec"]>) =>
  vi.mocked(useGroupPolicy).mockReturnValue({
    policy: policy
      ? ({
          id: 1,
          spec: {
            subject_kind: "Team",
            subject_name: "sre",
            allowed_models: null,
            denied_models: null,
            ...policy,
          },
        } as GroupPolicy)
      : undefined,
    isLoading: false,
    error: null,
  });

beforeEach(() => vi.clearAllMocks());

describe("GroupModelAccess", () => {
  it("is hidden without group_policy:read", () => {
    grant();
    withPolicy();
    const { container } = render(<GroupModelAccess kind="Team" name="sre" />);
    expect(container.innerHTML).toBe("");
  });

  it("shows no limit and offers create when the group has no policy", () => {
    grant("read", "create", "delete");
    withPolicy();
    render(<GroupModelAccess kind="OrgUnit" name="rd" />);
    expect(screen.getByTestId("group-policy-unrestricted")).toBeTruthy();
    expect(screen.getByTestId("group-policy-edit")).toBeTruthy();
    expect(screen.queryByTestId("group-policy-delete")).toBeNull();
  });

  it("lists the entries with their workspace scope", () => {
    grant("read");
    withPolicy({
      allowed_models: [{ model: "qwen", workspace: "ws1" }],
      denied_models: [{ model: "gpt" }],
    });
    render(<GroupModelAccess kind="Team" name="sre" />);
    const allowed = screen.getByTestId("group-policy-allowed");
    expect(allowed.textContent).toContain("qwen");
    expect(allowed.textContent).toContain("ws1");
    expect(screen.getByTestId("group-policy-denied").textContent).toContain(
      "group_policies.allWorkspaces",
    );
    expect(screen.queryByTestId("group-policy-edit")).toBeNull();
    expect(screen.queryByTestId("group-policy-delete")).toBeNull();
  });

  it("offers edit and delete on an existing policy with update and delete", () => {
    grant("read", "update", "delete");
    withPolicy({ denied_models: [{ model: "gpt" }] });
    render(<GroupModelAccess kind="Team" name="sre" />);
    expect(screen.getByTestId("group-policy-edit")).toBeTruthy();
    expect(screen.getByTestId("group-policy-delete")).toBeTruthy();
  });
});
