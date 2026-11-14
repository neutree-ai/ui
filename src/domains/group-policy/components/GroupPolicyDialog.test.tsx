import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/domains/group-policy/components/ModelEntryPicker", () => ({
  ModelEntryPicker: () => null,
}));

import type { GroupPolicy } from "@/domains/group-policy/types";
import { GroupPolicyDialog } from "./GroupPolicyDialog";

const policy = (limit: number) =>
  ({
    id: 1,
    spec: {
      subject_kind: "Team",
      subject_name: "sre",
      allowed_models: null,
      denied_models: null,
      token_quota: { limit, period: "monthly" },
    },
  }) as GroupPolicy;

describe("GroupPolicyDialog token pool", () => {
  it("shows a stored pool in the unit it was most likely entered in", () => {
    render(
      <GroupPolicyDialog
        policy={policy(1_500_000)}
        groupLabel="SRE"
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(
      (screen.getByTestId("group-policy-pool-amount") as HTMLInputElement)
        .value,
    ).toBe("1.5");
    expect(screen.getByTestId("group-policy-pool-unit").textContent).toBe(
      "api_keys.limits.units.M",
    );
  });

  it("reopens and saves both lists and the pool unchanged", () => {
    const onSave = vi.fn();
    const stored = policy(1_500_000);
    stored.spec.allowed_models = [{ model: "a", workspace: "ws" }];
    stored.spec.denied_models = [{ model: "b" }];
    render(
      <GroupPolicyDialog
        policy={stored}
        groupLabel="SRE"
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByTestId("group-policy-save"));
    expect(onSave).toHaveBeenCalledWith(
      stored.spec.allowed_models,
      stored.spec.denied_models,
      {
        limit: 1_500_000,
        period: "monthly",
      },
    );
  });

  it("blocks saving a reopened API quota above the safe integer range", () => {
    render(
      <GroupPolicyDialog
        policy={policy(9_007_199_254_740_992)}
        groupLabel="SRE"
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    screen.getByText("group_policies.pool.invalid");
    expect(
      (
        screen.getByRole("button", {
          name: "buttons.save",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
