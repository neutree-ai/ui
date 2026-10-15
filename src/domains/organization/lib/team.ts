import type { Team } from "@/domains/organization/types";

/** The identity source a Team was synced from; "" for a manual Team. */
export const teamSource = (team: Pick<Team, "spec">): string =>
  team.spec?.identity_source?.trim() ?? "";

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
