import { translateApiError } from "@/foundation/lib/api-error-code";

/**
 * Identity source write errors → i18n keys. 10250-10259 come from the
 * identity_sources write trigger; 10260 is neutree-api's own validation of an
 * identity source write (the same number means "external email is read-only"
 * on a user profile, which is why the table is per resource).
 */
export const IDENTITY_SOURCE_ERROR_KEYS: Readonly<Record<string, string>> = {
  "10250": "identity_sources.errors.invalidName",
  "10251": "identity_sources.errors.nameImmutable",
  "10252": "identity_sources.errors.noWorkspace",
  "10253": "identity_sources.errors.invalidType",
  "10254": "identity_sources.errors.typeMismatch",
  "10255": "identity_sources.errors.fieldRequired",
  "10256": "identity_sources.errors.invalidUrl",
  "10257": "identity_sources.errors.missingPlaceholder",
  "10258": "identity_sources.errors.invalidTls",
  "10259": "identity_sources.errors.secretsUnavailable",
  "10260": "identity_sources.errors.invalid",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const identitySourceErrorMessage = (
  t: Translate,
  error: unknown,
): string | undefined =>
  translateApiError(t, error, IDENTITY_SOURCE_ERROR_KEYS);
