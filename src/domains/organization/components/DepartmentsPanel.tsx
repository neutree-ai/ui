import { type ReactNode, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  type MemberRow,
  MemberTable,
} from "@/domains/organization/components/MemberTable";
import { OrganizationToolbar } from "@/domains/organization/components/OrganizationToolbar";
import { OrgUnitTree } from "@/domains/organization/components/OrgUnitTree";
import {
  useOrgTree,
  useOrgUnitMembers,
} from "@/domains/organization/hooks/use-organization";
import { useOrganizationView } from "@/domains/organization/hooks/use-organization-view";
import {
  expandableIds,
  filterOrgTree,
  groupByIdentitySource,
} from "@/domains/organization/lib/org-tree";
import { ORGANIZATION_ERROR_KEYS } from "@/domains/organization/lib/organization-errors";
import { EmptyState } from "@/foundation/components/EmptyState";
import { InactiveBadge } from "@/foundation/components/InactiveBadge";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import { translateApiErrorOr } from "@/foundation/lib/api-error-code";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ExtraColumn } from "@/foundation/types/extra-column";
import type { LabeledScope } from "@/foundation/types/group-scope";

const ALL_SOURCES = "__all__";

const noMemberColumn = () => undefined;

/**
 * `renderRoleAssignments` lists the selected department's role assignments;
 * `useMemberColumn` adds a member column for it (a hook, as it belongs to
 * other domains).
 */
export function DepartmentsPanel({
  renderRoleAssignments,
  useMemberColumn = noMemberColumn,
}: {
  renderRoleAssignments?: (orgUnitName: string, label: string) => ReactNode;
  useMemberColumn?: (
    department: LabeledScope | undefined,
  ) => ExtraColumn<MemberRow> | undefined;
} = {}) {
  const { t } = useTranslation();
  const errorText = (error: unknown) =>
    error
      ? translateApiErrorOr(
          t,
          error,
          ORGANIZATION_ERROR_KEYS,
          "common.errors.unknown",
        )
      : undefined;

  const [query, setQuery] = useState("");
  const [source, setSource] = useState(ALL_SOURCES);
  const [showInactive, setShowInactive] = useState(false);
  const [includeSubtree, setIncludeSubtree] = useState(false);
  // The selection and the expanded nodes live in the URL. Expanded null: the
  // default for the current query (roots open, or every match open while
  // searching); a list once the user toggles a node.
  const [view, updateView] = useOrganizationView();

  const {
    roots: tree,
    byId: nodesById,
    byName: nodesByName,
    isLoading,
    error,
  } = useOrgTree();
  const selectedId = view.department
    ? nodesByName.get(view.department)?.unit.id
    : undefined;
  const expanded = useMemo(
    () =>
      view.expanded &&
      new Set(
        view.expanded
          .map((name) => nodesByName.get(name)?.unit.id)
          .filter((id): id is number => id !== undefined),
      ),
    [view.expanded, nodesByName],
  );
  const groups = useMemo(() => groupByIdentitySource(tree), [tree]);
  const visibleGroups = useMemo(
    () =>
      groups
        .filter((g) => source === ALL_SOURCES || g.identitySource === source)
        .map((g) => ({
          ...g,
          roots: filterOrgTree(g.roots, { query, showInactive }),
        }))
        .filter((g) => g.roots.length),
    [groups, source, query, showInactive],
  );

  const searching = query.trim() !== "";
  const effectiveExpanded = useMemo(() => {
    if (expanded) return expanded;
    const roots = visibleGroups.flatMap((g) => g.roots);
    const ids = searching
      ? expandableIds(roots)
      : roots.filter((r) => r.children.length).map((r) => r.unit.id);
    // A link to a deep department opens the way down to it.
    const selectedUnit =
      selectedId === undefined ? undefined : nodesById.get(selectedId)?.unit;
    const ancestors = selectedUnit
      ? selectedUnit.path
          .split("/")
          .filter(Boolean)
          .map(Number)
          .filter((id) => id !== selectedUnit.id)
      : [];
    return new Set([...ids, ...ancestors]);
  }, [expanded, visibleGroups, searching, selectedId, nodesById]);

  const onQueryChange = (next: string) => {
    setQuery(next);
    if (view.expanded) updateView({ expanded: null }, { replace: true });
  };
  const onExpandedChange = (id: number, open: boolean) => {
    const next = new Set(effectiveExpanded);
    if (open) next.add(id);
    else next.delete(id);
    updateView(
      {
        expanded: [...next]
          .map((nodeId) => nodesById.get(nodeId)?.unit.metadata.name)
          .filter((name): name is string => !!name)
          .sort(),
      },
      { replace: true },
    );
  };
  const onSelect = (id: number) =>
    updateView({ department: nodesById.get(id)?.unit.metadata.name });

  const selected =
    selectedId === undefined ? undefined : nodesById.get(selectedId);
  const members = useOrgUnitMembers(selected?.unit.id, includeSubtree);
  const memberColumn = useMemberColumn(
    selected && {
      kind: "OrgUnit",
      id: selected.unit.id,
      name: selected.unit.metadata.name,
      label: selected.label,
    },
  );
  const memberRows = useMemo<MemberRow[]>(
    () =>
      members.members.map((m) => ({
        key: m.user_id,
        profile: m.user_profiles,
        department:
          nodesById.get(m.org_unit_id)?.pathLabel ??
          m.org_units?.metadata.display_name ??
          undefined,
        source: m.identity_source ?? t("organization.values.manual"),
        since: m.assigned_at,
      })),
    [members.members, nodesById, t],
  );

  return (
    <div className="space-y-3">
      <OrganizationToolbar
        query={query}
        onQueryChange={onQueryChange}
        placeholder={t("organization.filters.searchDepartments")}
        showInactive={showInactive}
        onShowInactiveChange={setShowInactive}
      >
        {groups.length > 1 && (
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger
              className="w-full sm:w-56"
              data-testid="organization-source-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SOURCES}>
                {t("organization.filters.allSources")}
              </SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.identitySource} value={g.identitySource}>
                  {g.identitySource}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </OrganizationToolbar>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ShowPage.Section
          title={t("organization.departments.title")}
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
          ) : !visibleGroups.length ? (
            <EmptyState variant="inline" data-testid="org-units-empty">
              {tree.length
                ? t("organization.departments.noMatch")
                : t("organization.departments.empty")}
            </EmptyState>
          ) : (
            <div className="space-y-4" data-testid="org-unit-tree">
              {visibleGroups.map((g) => (
                <div key={g.identitySource}>
                  <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                    {t("organization.departments.fromSource", {
                      source: g.identitySource,
                    })}
                  </div>
                  <OrgUnitTree
                    roots={g.roots}
                    expanded={effectiveExpanded}
                    onExpandedChange={onExpandedChange}
                    selectedId={selectedId}
                    onSelect={onSelect}
                  />
                </div>
              ))}
            </div>
          )}
        </ShowPage.Section>

        <div className="min-w-0 space-y-3">
          <ShowPage.Section
            title={
              selected ? (
                <span className="inline-flex items-center gap-2">
                  {selected.label}
                  {selected.inactive && <InactiveBadge />}
                </span>
              ) : (
                t("organization.members.title")
              )
            }
            description={
              selected && selected.pathLabel !== selected.label
                ? selected.pathLabel
                : undefined
            }
            actions={
              selected && (
                <div className="inline-flex items-center gap-2">
                  <Switch
                    id="org-unit-include-subtree"
                    checked={includeSubtree}
                    onCheckedChange={setIncludeSubtree}
                    data-testid="org-unit-include-subtree"
                  />
                  <Label
                    htmlFor="org-unit-include-subtree"
                    className="cursor-pointer font-normal text-muted-foreground"
                  >
                    {t("organization.members.includeSubtree")}
                  </Label>
                </div>
              )
            }
          >
            {selected ? (
              <MemberTable
                rows={memberRows}
                isLoading={members.isLoading}
                error={errorText(members.error)}
                showDepartment={includeSubtree}
                showSource
                sinceLabel={t("organization.fields.assignedAt")}
                extraColumn={memberColumn}
              />
            ) : (
              <EmptyState variant="inline">
                {t("organization.members.selectDepartment")}
              </EmptyState>
            )}
          </ShowPage.Section>
          {selected &&
            renderRoleAssignments?.(
              selected.unit.metadata.name,
              selected.label,
            )}
        </div>
      </div>
    </div>
  );
}
