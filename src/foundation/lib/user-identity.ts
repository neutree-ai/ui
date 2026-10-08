/**
 * How a user is named and addressed in the UI.
 *
 * A user profile's `metadata.name` is the unique, technical id;
 * `metadata.display_name` is what people read and may repeat.
 *
 * Users from an identity source (LDAP, OIDC) carry the source type in
 * `app_metadata.identity_source`. Their GoTrue email is a placeholder; the
 * real address is in `user_metadata.email`. The directory owns their
 * password and email, so they cannot change them here.
 */

type ProfileMetadata = {
  name: string;
  display_name?: string | null;
};

/** The name to show for a user profile. `||`: an unset display name is "". */
export function profileDisplayName(metadata: ProfileMetadata): string {
  return metadata.display_name?.trim() || metadata.name;
}

/**
 * A label that tells apart users who share a display name: the display name
 * with the unique name after it, or just the name when they are the same.
 */
export function profileOptionLabel(metadata: ProfileMetadata): string {
  const displayName = profileDisplayName(metadata);
  return displayName === metadata.name
    ? metadata.name
    : `${displayName} (${metadata.name})`;
}

/** The label the database keeps on the profile of a user from an identity source. */
export const IDENTITY_SOURCE_LABEL = "neutree.ai/identity-source";

/**
 * The identity source type ("ldap", "oidc") of a user profile, else "". It
 * reads the read-only label the database sets, so it works for any profile,
 * not only the signed-in user's.
 */
export function profileIdentitySource(
  metadata: { labels?: Record<string, string> | null } | null | undefined,
): string {
  const value = metadata?.labels?.[IDENTITY_SOURCE_LABEL];
  return typeof value === "string" ? value.trim() : "";
}

type AuthUserLike = {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

const stringField = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): string => {
  const value = record?.[key];
  return typeof value === "string" ? value.trim() : "";
};

/** The identity source type ("ldap", "oidc") of an external user, else "". */
export function identitySourceOf(user: AuthUserLike | null | undefined) {
  return stringField(user?.app_metadata, "identity_source");
}

export function isExternalUser(user: AuthUserLike | null | undefined) {
  return identitySourceOf(user) !== "";
}

/** The email to show for a signed-in user; never an external placeholder. */
export function authUserEmail(user: AuthUserLike | null | undefined): string {
  if (!user) {
    return "";
  }
  if (isExternalUser(user)) {
    return stringField(user.user_metadata, "email");
  }
  return user.email ?? "";
}

/**
 * The name to show for a signed-in user: the profile display name when
 * known, else the names GoTrue keeps, else the email.
 */
export function authUserDisplayName(
  user: AuthUserLike | null | undefined,
  profile?: ProfileMetadata | null,
): string {
  if (profile) {
    const fromProfile = profileDisplayName(profile);
    if (fromProfile) {
      return fromProfile;
    }
  }
  const meta = user?.user_metadata;
  return (
    stringField(meta, "name") ||
    stringField(meta, "username") ||
    stringField(meta, "preferred_username") ||
    authUserEmail(user)
  );
}
