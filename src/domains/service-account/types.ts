import type { Metadata } from "@/foundation/types/basic-types";

/**
 * An application of a Team (a ServiceAccount on the server). It is not a
 * user: it has no login and is never a member of a group. Its API keys call
 * models with its own role assignments and its Team's group policy.
 */
export type ServiceAccount = {
  id: string;
  api_version?: "v1";
  kind?: "ServiceAccount";
  metadata: Metadata;
  spec: { description?: string | null; disabled?: boolean | null };
  team_id: number;
  created_by?: string | null;
};

/** The roles a Team's applications may hold, and where. */
export type ServiceAccountCeiling = {
  roles: string[];
  /** null: every workspace. */
  workspaces: string[] | null;
  /** The Team has no ceiling of its own and uses the default. */
  is_default: boolean;
};
