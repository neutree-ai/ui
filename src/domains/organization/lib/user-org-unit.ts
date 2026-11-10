import type { OrgUnitMember } from "@/domains/organization/types";
import { profileIdentitySource } from "@/foundation/lib/user-identity";

type ProfileLike = {
  metadata: { labels?: Record<string, string> | null };
};

/** A local account: its profile has no identity-source label. */
export const isLocalProfile = (profile: ProfileLike) =>
  !profileIdentitySource(profile.metadata);

/**
 * What a hand assignment can do for this user: "create" when a local user has
 * no department, "update" when their department was assigned by hand, null
 * otherwise. An external user's department comes from sync (the database
 * refuses a hand assignment with 10278).
 */
export function orgUnitAssignmentMode(
  profile: ProfileLike,
  membership: Pick<OrgUnitMember, "identity_source"> | null | undefined,
): "create" | "update" | null {
  if (!isLocalProfile(profile)) return null;
  if (!membership) return "create";
  return membership.identity_source ? null : "update";
}
