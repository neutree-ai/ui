import { Eye, Globe, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrgUnitTree } from "@/domains/organization/components/OrgUnitTree";
import {
  filterTeams,
  isInactive,
  type OrgTreeNode,
} from "@/domains/organization/lib/org-tree";
import { isProjectTeam } from "@/domains/organization/lib/team";
import type { Team } from "@/domains/organization/types";
import { InactiveBadge } from "@/foundation/components/InactiveBadge";
import { InfoHint } from "@/foundation/components/InfoHint";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { groupOf, type UsageScope } from "@/pages/model-usage/lib/usage-scope";

const ScopeButton = ({
  selected,
  icon,
  label,
  inactive = false,
  onClick,
}: {
  selected: boolean;
  icon: ReactNode;
  label: string;
  inactive?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className={cn(
      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
      selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
      inactive && "text-muted-foreground",
    )}
    title={label}
    aria-pressed={selected}
    onClick={onClick}
  >
    {icon}
    <span className="truncate">{label}</span>
    {inactive && <InactiveBadge />}
  </button>
);

/** A list of Teams, or of scenarios, to open as a scope; nothing when empty. */
const TeamSection = ({
  title,
  teams,
  icon,
  selected,
  onScopeChange,
}: {
  title: string;
  teams: Team[];
  icon: ReactNode;
  selected: string | undefined;
  onScopeChange: (scope: UsageScope) => void;
}) =>
  teams.length > 0 ? (
    <section
      className="mt-3 border-t border-[var(--nt-stroke-neutral-trans-2)] pt-3"
      aria-label={title}
    >
      <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-0.5">
        {teams.map((team) => {
          const label = displayName(team.metadata);
          return (
            <li key={team.id}>
              <ScopeButton
                selected={selected === team.metadata.name}
                icon={icon}
                label={label}
                inactive={isInactive(team)}
                onClick={() =>
                  onScopeChange({
                    type: "team",
                    name: team.metadata.name,
                    label,
                  })
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  ) : null;

/**
 * The scope picker: the whole platform for a reader of every group, or else
 * every API key the caller reads (no scope); the departments, Teams and
 * scenarios the caller may read. A user is opened from the breakdown, not from here, so a
 * user scope keeps the group it came from selected.
 */
export const UsageScopePanel = ({
  roots,
  nodesByName,
  nodesById,
  teams,
  scope,
  canReadPlatform,
  loading,
  onScopeChange,
}: {
  roots: OrgTreeNode[];
  nodesByName: ReadonlyMap<string, OrgTreeNode>;
  nodesById: ReadonlyMap<number, OrgTreeNode>;
  teams: Team[];
  scope: UsageScope | null;
  canReadPlatform: boolean;
  loading: boolean;
  onScopeChange: (scope: UsageScope | null) => void;
}) => {
  const { t } = useTranslation();
  // Open to the second level by default; the tree is the page's navigation,
  // so its first screen should already show where to go.
  const [expanded, setExpanded] = useState<Set<number> | null>(null);
  const openIds = expanded ?? new Set(roots.map((node) => node.unit.id));

  const group = scope ? groupOf(scope) : null;
  const selectedId =
    group?.type === "orgUnit"
      ? nodesByName.get(group.name)?.unit.id
      : undefined;
  const selectedTeam = group?.type === "team" ? group.name : undefined;
  // Inactive Teams stay listed: their past usage still counts.
  const teamList = filterTeams(teams, { showInactive: true });
  const isEmpty = !loading && roots.length === 0 && teams.length === 0;
  const canCreateTeam = useHasGlobalPermission("team:create").allowed === true;

  return (
    <aside>
      <Card className="p-3">
        <div className="mb-2 flex items-center gap-1 px-1 text-sm font-medium">
          {t("model_usage.scope.title")}
          <InfoHint label={t("model_usage.scope.hint")} />
        </div>
        <div className="mb-0.5">
          {canReadPlatform ? (
            <ScopeButton
              // The platform's applications are a part of the platform.
              selected={
                scope?.type === "platform" || scope?.type === "applications"
              }
              icon={<Globe className="size-4 shrink-0 text-muted-foreground" />}
              label={t("model_usage.scope.platform")}
              onClick={() => onScopeChange({ type: "platform" })}
            />
          ) : (
            <ScopeButton
              selected={scope === null}
              icon={<Eye className="size-4 shrink-0 text-muted-foreground" />}
              label={t("model_usage.scope.visible")}
              onClick={() => onScopeChange(null)}
            />
          )}
        </div>
        {isEmpty && (
          <div
            className="mt-3 space-y-2 px-1 text-sm text-muted-foreground"
            data-testid="usage-scope-empty"
          >
            <p>{t("model_usage.scope.empty")}</p>
            {canCreateTeam && (
              <Button asChild variant="outline" size="sm">
                <Link to="/organization">
                  {t("model_usage.scope.goToOrganization")}
                </Link>
              </Button>
            )}
          </div>
        )}
        <OrgUnitTree
          roots={roots}
          expanded={openIds}
          onExpandedChange={(id, open) => {
            const next = new Set(openIds);
            if (open) next.add(id);
            else next.delete(id);
            setExpanded(next);
          }}
          selectedId={selectedId}
          onSelect={(id) => {
            const node = nodesById.get(id);
            if (node) {
              onScopeChange({ type: "orgUnit", name: node.unit.metadata.name });
              // Selecting a department shows its children in the tree too.
              if (node.children.length && !openIds.has(id)) {
                setExpanded(new Set([...openIds, id]));
              }
            }
          }}
        />
        <TeamSection
          title={t("model_usage.scope.teams")}
          teams={teamList.filter((team) => !isProjectTeam(team))}
          icon={<Users className="size-4 shrink-0 text-muted-foreground" />}
          selected={selectedTeam}
          onScopeChange={onScopeChange}
        />
        <TeamSection
          title={t("model_usage.scope.scenarios")}
          teams={teamList.filter(isProjectTeam)}
          icon={<Users className="size-4 shrink-0 text-muted-foreground" />}
          selected={selectedTeam}
          onScopeChange={onScopeChange}
        />
      </Card>
    </aside>
  );
};
