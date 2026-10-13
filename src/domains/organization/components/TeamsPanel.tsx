import { useMemo, useState } from "react";
import { InactiveBadge } from "@/domains/organization/components/InactiveBadge";
import { MemberTable } from "@/domains/organization/components/MemberTable";
import { OrganizationToolbar } from "@/domains/organization/components/OrganizationToolbar";
import {
  useTeamMembers,
  useTeams,
} from "@/domains/organization/hooks/use-organization";
import {
  displayName,
  filterTeams,
  isInactive,
} from "@/domains/organization/lib/org-tree";
import { organizationErrorMessage } from "@/domains/organization/lib/organization-errors";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

export function TeamsPanel() {
  const { t } = useTranslation();
  const errorText = (error: unknown) =>
    error
      ? (organizationErrorMessage(t, error) ??
        getErrorMessage(error, t("common.errors.unknown")))
      : undefined;

  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number>();

  const { data, isLoading, error } = useTeams();
  const all = data?.data ?? [];
  const teams = useMemo(
    () => filterTeams(data?.data ?? [], { query, showInactive }),
    [data, query, showInactive],
  );
  const selected = all.find((team) => team.id === selectedId);
  const members = useTeamMembers(selected?.id);

  return (
    <div className="space-y-3">
      <OrganizationToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder={t("organization.filters.searchTeams")}
        showInactive={showInactive}
        onShowInactiveChange={setShowInactive}
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ShowPage.Section
          title={t("organization.teams.title")}
          contentClassName="max-h-[calc(100vh-300px)] min-h-40 overflow-auto px-3 pb-4 pt-3"
        >
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader className="w-10 text-muted-foreground" />
            </div>
          ) : error ? (
            <EmptyState variant="inline" className="text-destructive">
              {errorText(error)}
            </EmptyState>
          ) : !teams.length ? (
            <EmptyState variant="inline" data-testid="teams-empty">
              {all.length
                ? t("organization.teams.noMatch")
                : t("organization.teams.empty")}
            </EmptyState>
          ) : (
            <ul className="space-y-0.5" data-testid="team-list">
              {teams.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    aria-pressed={team.id === selectedId}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      team.id === selectedId
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted",
                      isInactive(team) && "text-muted-foreground",
                    )}
                    onClick={() => setSelectedId(team.id)}
                    data-testid={`team-${team.id}`}
                  >
                    <span className="truncate">
                      {displayName(team.metadata)}
                    </span>
                    {isInactive(team) && <InactiveBadge />}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {team.spec.identity_source}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ShowPage.Section>

        <ShowPage.Section
          title={
            selected ? (
              <span className="inline-flex items-center gap-2">
                {displayName(selected.metadata)}
                {isInactive(selected) && <InactiveBadge />}
              </span>
            ) : (
              t("organization.members.title")
            )
          }
          description={selected?.spec.identity_source}
        >
          {selected ? (
            <MemberTable
              rows={members.members.map((m) => ({
                key: m.user_id,
                profile: m.user_profiles,
                since: m.created_at,
              }))}
              isLoading={members.isLoading}
              error={errorText(members.error)}
              sinceLabel={t("organization.fields.joinedAt")}
            />
          ) : (
            <EmptyState variant="inline">
              {t("organization.members.selectTeam")}
            </EmptyState>
          )}
        </ShowPage.Section>
      </div>
    </div>
  );
}
