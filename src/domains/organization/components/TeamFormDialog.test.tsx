import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Team } from "@/domains/organization/types";
import { TeamFormDialog } from "./TeamFormDialog";

it.each(["Guild", "", null, undefined])(
  "reopens an API team with display name %s without submitting unchanged data",
  (displayName) => {
    const team = {
      id: 7,
      api_version: "v1",
      kind: "Team",
      metadata: {
        name: "guild",
        display_name: displayName,
        workspace: null,
        deletion_timestamp: null,
        creation_timestamp: "2026-01-01T00:00:00Z",
        update_timestamp: "2026-01-01T00:00:00Z",
        labels: {},
        annotations: {},
      },
      spec: { identity_source: null, external_id: null },
    } satisfies Team;
    const onSave = vi.fn();
    const dialog = () => (
      <TeamFormDialog team={team} onOpenChange={() => {}} onSave={onSave} />
    );
    const first = render(dialog());
    fireEvent.change(screen.getByLabelText("organization.fields.displayName"), {
      target: { value: "Discarded" },
    });
    first.unmount();
    render(dialog());

    expect(
      screen.getByLabelText("organization.fields.displayName"),
    ).toHaveProperty("value", displayName ?? "");
    expect(screen.getByRole("button", { name: "buttons.save" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "buttons.save" }));
    expect(onSave).not.toHaveBeenCalled();
  },
);
