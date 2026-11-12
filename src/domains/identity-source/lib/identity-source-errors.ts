import { translateApiError } from "@/foundation/lib/api-error-code";

/**
 * Identity source write and sync-request errors → i18n keys. 10260 belongs to
 * user profiles and is not mapped here.
 */
const IDENTITY_SOURCE_ERROR_KEYS: Readonly<Record<string, string>> = {
  "10250": "identity_sources.errors.invalidName",
  "10251": "identity_sources.errors.immutable",
  "10252": "identity_sources.errors.noWorkspace",
  "10253": "identity_sources.errors.invalidType",
  "10254": "identity_sources.errors.typeMismatch",
  "10255": "identity_sources.errors.fieldRequired",
  "10256": "identity_sources.errors.invalidUrl",
  "10257": "identity_sources.errors.missingPlaceholder",
  "10258": "identity_sources.errors.invalidTls",
  "10259": "identity_sources.errors.secretsUnavailable",
  "10261": "identity_sources.errors.invalid",
  "10262": "identity_sources.errors.invalidSync",
  "10263": "identity_sources.errors.notFound",
  "10264": "identity_sources.errors.syncNotEnabled",
  "10304": "identity_sources.errors.syncPaused",
  "10330": "identity_sources.errors.syncBaseDnRequired",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const identitySourceErrorMessage = (
  t: Translate,
  error: unknown,
): string | undefined =>
  translateApiError(t, error, IDENTITY_SOURCE_ERROR_KEYS);
