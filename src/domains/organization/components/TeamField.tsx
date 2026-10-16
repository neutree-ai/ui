import { forwardRef, useMemo } from "react";
import { InactiveBadge } from "@/domains/organization/components/InactiveBadge";
import { TeamSourceLabel } from "@/domains/organization/components/TeamSourceLabel";
import { useTeams } from "@/domains/organization/hooks/use-organization";
import { displayName, isInactive } from "@/domains/organization/lib/org-tree";
import type { Team } from "@/domains/organization/types";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

const useTeamsByName = () => {
  const teams = useTeams();
  return useMemo(() => {
    const list = [...(teams.data?.data ?? [])].sort(
      (a, b) =>
        Number(isInactive(a)) - Number(isInactive(b)) ||
        displayName(a.metadata).localeCompare(displayName(b.metadata)),
    );
    return {
      list,
      byName: new Map(list.map((team) => [team.metadata.name, team])),
      isLoading: teams.isLoading,
    };
  }, [teams.data, teams.isLoading]);
};

type TeamFieldProps = {
  /** metadata.name of the selected Team. */
  value?: string | null;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

/**
 * A form field that picks a Team, synced or manual, by metadata.name. An
 * Inactive Team stays selectable but greyed: its assignments apply again once
 * it is Active.
 */
export const TeamField = forwardRef<HTMLDivElement, TeamFieldProps>(
  ({ value, onChange, disabled }, ref) => {
    const { t } = useTranslation();
    const { list, byName, isLoading } = useTeamsByName();

    return (
      <FormCombobox
        ref={ref}
        value={value ?? ""}
        onChange={(next) => onChange?.(String(next))}
        disabled={disabled || isLoading}
        allowUnselect={false}
        placeholder={t("role_assignments.placeholders.selectTeam")}
        options={list.map((team) => ({
          label: displayName(team.metadata),
          value: team.metadata.name,
        }))}
        renderOption={(option) => {
          const team = byName.get(String(option.value));
          if (!team) return null;
          return (
            <span
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2",
                isInactive(team) && "text-muted-foreground",
              )}
              data-testid={`team-option-${team.metadata.name}`}
            >
              <span className="truncate">{option.label}</span>
              {isInactive(team) && <InactiveBadge />}
              <span className="ml-auto" />
              <TeamSourceLabel team={team} />
            </span>
          );
        }}
      />
    );
  },
);

TeamField.displayName = "TeamField";

/** A Team by metadata.name, shown by its display name. */
export function TeamLabel({ name }: { name: string }) {
  const { byName } = useTeamsByName();
  const team: Team | undefined = byName.get(name);
  return (
    <span className="inline-flex items-center gap-2" data-testid="team-label">
      {team ? displayName(team.metadata) : name}
      {team && isInactive(team) && <InactiveBadge />}
    </span>
  );
}
