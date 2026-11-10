import { fireEvent, render, screen, within } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Form } from "@/components/ui/form";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasPermission: () => ({ allowed: true, isLoading: false }),
}));
vi.mock("@/domains/organization/hooks/use-organization", async () => {
  const { orgTreeIndex, teamIndex } = await import(
    "@/domains/organization/lib/org-tree"
  );
  const NONE: never[] = [];
  const useOrgUnits = vi.fn();
  const useTeams = vi.fn();
  return {
    useOrgUnits,
    useTeams,
    useOrgTree: (enabled?: boolean) => {
      const query = useOrgUnits(enabled);
      return {
        ...orgTreeIndex(query?.data?.data ?? NONE),
        isLoading: query?.isLoading,
        error: query?.error,
      };
    },
    useTeamsByName: (enabled?: boolean) => {
      const query = useTeams(enabled);
      return {
        ...teamIndex(query?.data?.data ?? NONE),
        isLoading: query?.isLoading,
      };
    },
  };
});

import {
  useOrgUnits,
  useTeams,
} from "@/domains/organization/hooks/use-organization";
import { OrgUnitLabel } from "./OrgUnitField";
import { TeamField, TeamLabel } from "./TeamField";

function TeamPicker() {
  const form = useForm<FieldValues>({ defaultValues: { team: "" } });
  return (
    <Form {...form}>
      <FormFieldGroup {...form} name="team" label="Team">
        <TeamField />
      </FormFieldGroup>
    </Form>
  );
}

const loading = { data: undefined, isLoading: true } as never;
const loaded = (rows: unknown[]) =>
  ({ data: { data: rows, total: rows.length }, isLoading: false }) as never;

beforeEach(() => {
  vi.mocked(useOrgUnits).mockReturnValue(loading);
  vi.mocked(useTeams).mockReturnValue(loading);
});

describe("group labels", () => {
  it("never shows the internal name while the groups load", () => {
    render(
      <>
        <OrgUnitLabel name="ou-7f3a" />
        <TeamLabel name="demo-team-a" />
      </>,
    );
    expect(screen.getByTestId("org-unit-label").dataset.loading).toBe("true");
    expect(screen.getByTestId("team-label").dataset.loading).toBe("true");
    expect(document.body.textContent).not.toMatch(/ou-7f3a|demo-team-a/);
  });

  it("shows the display name once loaded", () => {
    vi.mocked(useOrgUnits).mockReturnValue(
      loaded([
        {
          id: 1,
          path: "/1/",
          metadata: { name: "ou-1", display_name: "Corp" },
        },
        {
          id: 2,
          path: "/1/2/",
          metadata: { name: "ou-7f3a", display_name: "R&D" },
        },
      ]),
    );
    vi.mocked(useTeams).mockReturnValue(
      loaded([{ id: 5, metadata: { name: "demo-team-a", display_name: "A" } }]),
    );
    render(
      <>
        <OrgUnitLabel name="ou-7f3a" />
        <TeamLabel name="demo-team-a" />
      </>,
    );
    expect(screen.getByTestId("org-unit-label").textContent).toBe("Corp / R&D");
    expect(screen.getByTestId("team-label").textContent).toBe("A");
  });

  it("uses the fallback label for a group the reader cannot list", () => {
    vi.mocked(useOrgUnits).mockReturnValue(loaded([]));
    vi.mocked(useTeams).mockReturnValue(loaded([]));
    render(
      <>
        <OrgUnitLabel name="ou-7f3a" fallback="R&D" />
        <TeamLabel name="demo-team-a" fallback="Demo Team A" />
        <TeamLabel name="other" />
      </>,
    );
    expect(screen.getByTestId("org-unit-label").textContent).toBe("R&D");
    const teams = screen.getAllByTestId("team-label");
    expect(teams[0].textContent).toBe("Demo Team A");
    expect(teams[1].textContent).toBe("other");
  });

  it("marks scene teams in the team picker", () => {
    vi.mocked(useTeams).mockReturnValue(
      loaded([
        {
          id: 5,
          metadata: {
            name: "scene",
            labels: { "neutree.ai/team-kind": "project" },
          },
        },
        { id: 6, metadata: { name: "plain" } },
      ]),
    );
    render(<TeamPicker />);
    fireEvent.click(screen.getByRole("combobox"));
    within(screen.getByTestId("team-option-scene")).getByText(
      "organization.values.project",
    );
    expect(
      within(screen.getByTestId("team-option-plain")).queryByText(
        "organization.values.project",
      ),
    ).toBeNull();
  });
});
