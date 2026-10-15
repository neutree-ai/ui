import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";

type OrgObjectStatus = BaseStatus<"Active" | "Inactive">;

/** A department, synced from an identity source. */
export type OrgUnit = {
  id: number;
  api_version: "v1";
  kind: "OrgUnit";
  metadata: Metadata;
  spec: {
    identity_source: string;
    external_id: string;
    /** metadata.name of the parent OrgUnit; empty for a root. */
    parent?: string | null;
  };
  status?: OrgObjectStatus | null;
  /** Materialized path of ids, "/<root id>/.../<id>/". */
  path: string;
};

/**
 * A flat group. Synced from an identity source when spec.identity_source is
 * set; created in Neutree (manual) when spec.identity_source and
 * spec.external_id are both empty.
 */
export type Team = {
  id: number;
  api_version: "v1";
  kind: "Team";
  metadata: Metadata;
  spec?: {
    identity_source?: string | null;
    external_id?: string | null;
  } | null;
  status?: OrgObjectStatus | null;
};

export type MemberProfile = {
  id: string;
  metadata: Metadata;
  spec?: { email?: string | null } | null;
};

export type OrgUnitMember = {
  user_id: string;
  org_unit_id: number;
  /** The source whose sync wrote the row; null when assigned by hand. */
  identity_source: string | null;
  assigned_at: string;
  user_profiles?: MemberProfile | null;
  org_units?: OrgUnit | null;
};

export type TeamMember = {
  team_id: number;
  user_id: string;
  created_at: string;
  user_profiles?: MemberProfile | null;
  teams?: Team | null;
};
