import type { Team } from "@/domains/organization/types";

/** The identity source a Team was synced from; "" for a manual Team. */
export const teamSource = (team: Pick<Team, "spec">): string =>
  team.spec?.identity_source?.trim() ?? "";

/**
 * A project is an ordinary Team marked with this label; only the UI tells
 * them apart.
 */
export const TEAM_KIND_LABEL = "neutree.ai/team-kind";
const TEAM_KIND_PROJECT = "project";

export const isProjectTeam = (team: Pick<Team, "metadata">): boolean =>
  team.metadata?.labels?.[TEAM_KIND_LABEL] === TEAM_KIND_PROJECT;

export type TeamKindFilter = "all" | "project" | "team";

export const matchesTeamKind = (
  team: Pick<Team, "metadata">,
  kind: TeamKindFilter,
): boolean => kind === "all" || isProjectTeam(team) === (kind === "project");

/** Sets or removes the project label, keeping the other labels. */
export function withProjectLabel(
  labels: Record<string, string> | null | undefined,
  project: boolean,
): Record<string, string> {
  const { [TEAM_KIND_LABEL]: _kind, ...rest } = labels ?? {};
  return project ? { ...rest, [TEAM_KIND_LABEL]: TEAM_KIND_PROJECT } : rest;
}

export const isManualTeam = (team: Pick<Team, "spec">): boolean =>
  teamSource(team) === "" && !team.spec?.external_id?.trim();

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/;
// Sync names its Teams "<source>-<12 hex>"; the database refuses that ending
// for a manual Team (10288).
const RESERVED_SUFFIX = /-[0-9a-f]{12}$/;
const NAME_MAX_LENGTH = 63;

export type TeamNameError = "required" | "format" | "tooLong" | "reserved";

/** Checks a new Team's metadata.name the way the database does. */
export function validateTeamName(name: string): TeamNameError | undefined {
  if (!name) return "required";
  if (name.length > NAME_MAX_LENGTH) return "tooLong";
  if (!NAME_PATTERN.test(name)) return "format";
  if (RESERVED_SUFFIX.test(name)) return "reserved";
  return undefined;
}
