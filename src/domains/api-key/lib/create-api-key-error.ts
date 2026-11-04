import { translateApiError } from "@/foundation/lib/api-error-code";

type ErrorRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === "object" && value !== null;
}

function errorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return errorText(value.message);
  if (isRecord(value) && "message" in value) return errorText(value.message);
  return "";
}

// PostgREST errors arrive nested ({ message: { message } }), so rendering the
// cause directly yields "[object Object]". Pull out the deepest string and fall
// back to a caller-supplied (translated) message when there is none.
export function apiKeyActionErrorMessage(
  cause: unknown,
  fallback: string,
): string {
  return errorText(cause) || fallback;
}

const SERVICE_ACCOUNT_KEY_ERROR_KEYS: Readonly<Record<string, string>> = {
  "10044": "api_keys.serviceAccount.errors.workspace",
  "10316": "api_keys.serviceAccount.errors.noProject",
  "10317": "api_keys.serviceAccount.errors.inactive",
  "10318": "api_keys.serviceAccount.errors.immutable",
  "10320": "api_keys.serviceAccount.errors.applicationActor",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** As apiKeyActionErrorMessage, with readable text for application keys. */
export function serviceAccountKeyErrorMessage(
  t: Translate,
  cause: unknown,
  fallback: string,
): string {
  return (
    translateApiError(t, cause, SERVICE_ACCOUNT_KEY_ERROR_KEYS) ??
    apiKeyActionErrorMessage(cause, fallback)
  );
}
