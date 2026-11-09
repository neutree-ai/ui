import { Globe, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { OrgUnitTree } from "@/domains/organization/components/OrgUnitTree";
import {
  filterTeams,
  isInactive,
  type OrgTreeNode,
} from "@/domains/organization/lib/org-tree";
import type { Team } from "@/domains/organization/types";
import { InactiveBadge } from "@/foundation/components/InactiveBadge";
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

/**
 * The scope picker: the whole platform and the Teams, for a reader of every
 * group, and the departments the caller may read. A user is opened from the
 * breakdown, not from here, so a user scope keeps the group it came from
 * selected.
 */
export const UsageScopePanel = ({
  roots,
  nodesByName,
  nodesById,
  teams,
  scope,
  canReadPlatform,
  onScopeChange,
}: {
  roots: OrgTreeNode[];
  nodesByName: ReadonlyMap<string, OrgTreeNode>;
  nodesById: ReadonlyMap<number, OrgTreeNode>;
  teams: Team[];
  scope: UsageScope;
  canReadPlatform: boolean;
  onScopeChange: (scope: UsageScope) => void;
}) => {
  const { t } = useTranslation();
  // Open to the second level by default; the tree is the page's navigation,
  // so its first screen should already show where to go.
  const [expanded, setExpanded] = useState<Set<number> | null>(null);
  const openIds = expanded ?? new Set(roots.map((node) => node.unit.id));

  const group = groupOf(scope);
  const selectedId =
    group?.type === "orgUnit"
      ? nodesByName.get(group.name)?.unit.id
      : undefined;
  const selectedTeam = group?.type === "team" ? group.name : undefined;
  // Inactive Teams stay listed: their past usage still counts.
  const teamList = filterTeams(teams, { showInactive: true });

  return (
    <aside className="rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] p-3">
      <div className="mb-2 px-1 text-sm font-medium">
        {t("model_usage.scope.title")}
      </div>
      {canReadPlatform ? (
        <div className="mb-0.5">
          <ScopeButton
            selected={scope.type === "platform"}
            icon={<Globe className="size-4 shrink-0 text-muted-foreground" />}
            label={t("model_usage.scope.platform")}
            onClick={() => onScopeChange({ type: "platform" })}
          />
        </div>
      ) : null}
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
      {teamList.length > 0 ? (
        <section
          className="mt-3 border-t border-[var(--nt-stroke-neutral-trans-2)] pt-3"
          aria-label={t("model_usage.scope.teams")}
        >
          <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">
            {t("model_usage.scope.teams")}
          </div>
          <ul className="space-y-0.5">
            {teamList.map((team) => {
              const label = displayName(team.metadata);
              return (
                <li key={team.id}>
                  <ScopeButton
                    selected={selectedTeam === team.metadata.name}
                    icon={
                      <Users className="size-4 shrink-0 text-muted-foreground" />
                    }
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
      ) : null}
      <p className="mt-3 border-t border-[var(--nt-stroke-neutral-trans-2)] px-1 pt-3 text-xs text-muted-foreground">
        {t("model_usage.scope.hint")}
      </p>
    </aside>
  );
};
