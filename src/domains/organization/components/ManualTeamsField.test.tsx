import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Team } from "@/domains/organization/types";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const team = (
  id: number,
  name: string,
  spec: Team["spec"],
  labels?: Record<string, string>,
) =>
  ({
    id,
    metadata: { name, display_name: name.toUpperCase(), labels },
    spec,
  }) as unknown as Team;

const teams = [
  team(1, "synced", { identity_source: "corp", external_id: "g1" }),
  team(2, "guild", { identity_source: null, external_id: null }),
  team(
    3,
    "launch",
    { identity_source: null, external_id: null },
    {
      "neutree.ai/team-kind": "project",
    },
  ),
];
vi.mock("@/domains/organization/hooks/use-organization", () => ({
  useTeamsByName: () => ({ list: teams, byName: new Map(), isLoading: false }),
}));

import { ManualTeamsField } from "./ManualTeamsField";

describe("ManualTeamsField", () => {
  it("lists only Teams and scenarios created in Neutree", () => {
    render(<ManualTeamsField value={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("manual-teams-field"));

    expect(screen.queryByTestId("manual-team-option-synced")).toBeNull();
    screen.getByTestId("manual-team-option-guild");
    screen.getByTestId("manual-team-option-launch");
  });

  it("adds and removes a pick without closing the list", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ManualTeamsField value={["guild"]} onChange={onChange} />,
    );
    expect(screen.getByTestId("manual-teams-field").textContent).toContain(
      "GUILD",
    );
    fireEvent.click(screen.getByTestId("manual-teams-field"));

    fireEvent.click(screen.getByTestId("manual-team-option-launch"));
    expect(onChange).toHaveBeenLastCalledWith(["guild", "launch"]);

    rerender(<ManualTeamsField value={["guild"]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("manual-team-option-guild"));
    expect(onChange).toHaveBeenLastCalledWith([]);
    screen.getByTestId("manual-team-option-launch");
  });
});
