import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domains/group-policy/hooks/use-group-policies", () => ({
  useUserGroupPolicy: () => ({ policy: undefined, denied: true }),
}));
// TokenPoolSummary's module renders a ShowPage, which pulls refine's table
// package; it does not load under vitest.
vi.mock("@/foundation/components/ShowPage", () => ({ ShowPage: {} }));
vi.mock("@/domains/group-policy/components/ModelEntryPicker", () => ({
  ModelEntryPicker: () => null,
}));

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
  id: null,
  pool: null,
  effective_remaining: null,
  ...over,
});

const writes = { save: vi.fn(), remove: vi.fn(), isPending: false };

beforeEach(() => {
  writes.save.mockReset().mockResolvedValue([]);
});

describe("SubjectQuotaCell", () => {
  it("shows this scope's pool, what is left in effect, and only the allowed actions", () => {
    render(
      <SubjectQuotaCell
        scope={scope}
        subject={subject}
        policy={row({
          id: 7,
          policy_name: "p",
          token_quota: { limit: 1000, period: "daily" },
          pool: { used: 10, remaining: 990, resets_at: "2026-11-11" },
          effective_remaining: 0,
        })}
        access={{ canCreate: true, canUpdate: false, canDelete: true }}
        writes={writes}
      />,
    );
    screen.getByTestId("group-policy-pool-usage");
    screen.getByText(/^group_policies\.subject\.effectiveRemaining:/);
    screen.getByText("group_policies.pool.exhausted");
    expect(screen.queryByTestId("subject-quota-edit-u1")).toBeNull();
    screen.getByTestId("subject-quota-clear-u1");
  });

  it("creates a policy scoped to the scope from the dialog", async () => {
    render(
      <SubjectQuotaCell
        scope={scope}
        subject={subject}
        policy={row({})}
        access={{ canCreate: true, canUpdate: false, canDelete: false }}
        writes={writes}
      />,
    );
    fireEvent.click(screen.getByTestId("subject-quota-edit-u1"));
    fireEvent.change(screen.getByTestId("subject-policy-quota-amount"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("subject-policy-save"));
    await vi.waitFor(() => expect(writes.save).toHaveBeenCalled());
    expect(writes.save).toHaveBeenCalledWith(undefined, {
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
