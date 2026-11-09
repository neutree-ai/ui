import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
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
  useGroupTokenPool: vi.fn(() => ({ pool: undefined, refetch: vi.fn() })),
  useGroupPolicyWrites: () => ({
    save: vi.fn(),
    remove: vi.fn(),
    isPending: false,
  }),
}));

import {
  useGroupPolicy,
  useGroupTokenPool,
} from "@/domains/group-policy/hooks/use-group-policies";
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
    screen.getByTestId("group-policy-unrestricted");
    screen.getByTestId("group-policy-edit");
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
    screen.getByTestId("group-policy-edit");
    screen.getByTestId("group-policy-delete");
  });

  it("shows the token pool with its usage", () => {
    grant("read");
    withPolicy({ token_quota: { limit: 1000, period: "daily" } });
    vi.mocked(useGroupTokenPool).mockReturnValue({
      pool: {
        kind: "Team",
        name: "sre",
        token_limit: 1000,
        period: "daily",
        used: 1200,
        remaining: -200,
        resets_at: "2026-10-19",
      },
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGroupTokenPool>);
    render(<GroupModelAccess kind="Team" name="sre" />);
    screen.getByTestId("group-policy-pool");
    screen.getByTestId("group-policy-pool-usage");
    screen.getByText("group_policies.pool.exhausted");
    expect(vi.mocked(useGroupTokenPool)).toHaveBeenCalledWith(
      "Team",
      "sre",
      true,
    );
  });

  it("formats the limit, used and remaining tokens alike", () => {
    grant("read");
    withPolicy({ token_quota: { limit: 1_500_000, period: "monthly" } });
    vi.mocked(useGroupTokenPool).mockReturnValue({
      pool: {
        kind: "Team",
        name: "sre",
        token_limit: 1_500_000,
        period: "monthly",
        used: 250_000,
        remaining: 1_250_000,
        resets_at: "2026-11-01",
      },
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGroupTokenPool>);
    render(<GroupModelAccess kind="Team" name="sre" />);
    expect(screen.getByTestId("group-policy-pool").textContent).toContain(
      '"limit":"1.5M"',
    );
    const usage = screen.getByTestId("group-policy-pool-usage").textContent;
    expect(usage).toContain('"used":"250K"');
    expect(usage).toContain('"remaining":"1.25M"');
  });

  it("does not read a pool the policy does not set", () => {
    grant("read");
    withPolicy({ denied_models: [{ model: "gpt" }] });
    render(<GroupModelAccess kind="Team" name="sre" />);
    expect(screen.queryByTestId("group-policy-pool")).toBeNull();
    expect(vi.mocked(useGroupTokenPool)).toHaveBeenCalledWith(
      "Team",
      "sre",
      false,
    );
  });
});
