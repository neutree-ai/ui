/**
 * The Organization page's view as URL query parameters, so a reload, the
 * browser history or a shared link restores it. Groups are named by
 * metadata.name, which stays the same across syncs.
 */

export type OrganizationTab = "departments" | "teams";

export type OrganizationView = {
  tab: OrganizationTab;
  department?: string;
  /** Expanded departments; null is the default for the tree. */
  expanded: string[] | null;
  team?: string;
};

const TAB = "tab";
const DEPARTMENT = "department";
const EXPANDED = "expanded";
const TEAM = "team";

export const readOrganizationView = (
  params: URLSearchParams,
): OrganizationView => ({
  tab: params.get(TAB) === "teams" ? "teams" : "departments",
  department: params.get(DEPARTMENT) || undefined,
  expanded: params.has(EXPANDED)
    ? params.getAll(EXPANDED).filter(Boolean)
    : null,
  team: params.get(TEAM) || undefined,
});

/** `params` with the given parts of the view replaced; other keys are kept. */
export const writeOrganizationView = (
  params: URLSearchParams,
  change: Partial<OrganizationView>,
): URLSearchParams => {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string | undefined) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  if ("tab" in change) {
    setOrDelete(TAB, change.tab === "teams" ? "teams" : undefined);
  }
  if ("department" in change) setOrDelete(DEPARTMENT, change.department);
  if ("team" in change) setOrDelete(TEAM, change.team);
  if ("expanded" in change) {
    next.delete(EXPANDED);
    if (change.expanded) {
      // An empty value keeps "everything collapsed" apart from the default.
      if (!change.expanded.length) next.set(EXPANDED, "");
      for (const name of change.expanded) next.append(EXPANDED, name);
    }
  }
  return next;
};
