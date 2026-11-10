import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
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

  it("saves an untouched pool unchanged", () => {
    const onSave = vi.fn();
    render(
      <GroupPolicyDialog
        policy={policy(1_500_000)}
        groupLabel="SRE"
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByTestId("group-policy-save"));
    expect(onSave).toHaveBeenCalledWith([], [], {
      limit: 1_500_000,
      period: "monthly",
    });
  });
});
