import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveByName = vi.fn();
vi.mock("@/domains/group-policy/hooks/use-group-policies", () => ({
  GroupPolicyGoneError: class extends Error {},
  useScopeSubjectPolicies: vi.fn(),
  useUserGroupPolicy: () => ({ policy: undefined, denied: true }),
  useGroupPolicyWrites: () => ({
    saveByName,
    removeByName: vi.fn(),
    isPending: false,
  }),
}));
// TokenPoolSummary's module renders a ShowPage, which pulls refine's table
// package; it does not load under vitest.
vi.mock("@/foundation/components/ShowPage", () => ({ ShowPage: {} }));
vi.mock("@/domains/group-policy/components/ModelEntryPicker", () => ({
  ModelEntryPicker: () => null,
}));

import { useScopeSubjectPolicies } from "@/domains/group-policy/hooks/use-group-policies";
import type { ScopeSubjectPolicy } from "@/domains/group-policy/types";
import { SubjectQuotaCell } from "./SubjectQuotaCell";

const scope = { kind: "Team", name: "sre", id: 1, label: "SRE" } as const;
const subject = { kind: "User", id: "u1", label: "Ann" } as const;

const row = (over: Partial<ScopeSubjectPolicy>): ScopeSubjectPolicy => ({
  subject_kind: "User",
  subject_name: "u1",
  policy_name: null,
  allowed_models: null,
  denied_models: null,
  token_quota: null,
  used: null,
  remaining: null,
  resets_at: null,
  effective_remaining: null,
  ...over,
});

const setRows = (rows: ScopeSubjectPolicy[]) =>
  vi.mocked(useScopeSubjectPolicies).mockReturnValue({
    rows,
    isLoading: false,
    denied: false,
    error: null,
  });

beforeEach(() => {
  saveByName.mockReset().mockResolvedValue([]);
});

describe("SubjectQuotaCell", () => {
  it("shows this scope's pool, what is left in effect, and only the allowed actions", () => {
    setRows([
      row({
        policy_name: "p",
        token_quota: { limit: 1000, period: "daily" },
        used: 10,
        remaining: 990,
        resets_at: "2026-11-11",
        effective_remaining: 0,
      }),
    ]);
    render(
      <SubjectQuotaCell
        scope={scope}
        subject={subject}
        access={{ canCreate: true, canUpdate: false, canDelete: true }}
      />,
    );
    screen.getByTestId("group-policy-pool-usage");
    screen.getByText(/^group_policies\.subject\.effectiveRemaining:/);
    screen.getByText("group_policies.pool.exhausted");
    expect(screen.queryByTestId("subject-quota-edit-u1")).toBeNull();
    screen.getByTestId("subject-quota-clear-u1");
  });

  it("creates a policy scoped to the scope from the dialog", async () => {
    setRows([row({})]);
    render(
      <SubjectQuotaCell
        scope={scope}
        subject={subject}
        access={{ canCreate: true, canUpdate: false, canDelete: false }}
      />,
    );
    fireEvent.click(screen.getByTestId("subject-quota-edit-u1"));
    fireEvent.change(screen.getByTestId("subject-policy-quota-amount"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("subject-policy-save"));
    await vi.waitFor(() => expect(saveByName).toHaveBeenCalled());
    expect(saveByName).toHaveBeenCalledWith(null, {
      subject_kind: "User",
      subject_name: "u1",
      scope_kind: "Team",
      scope_name: "sre",
      allowed_models: null,
      denied_models: null,
      token_quota: { limit: 2_000_000, period: "monthly" },
    });
  });
});
