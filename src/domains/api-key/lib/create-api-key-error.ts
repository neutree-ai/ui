import { SERVICE_ACCOUNT_ERROR_KEYS } from "@/foundation/lib/service-account-errors";
import { translateApiError } from "@/foundation/scene/api-error-code";
import { getErrorMessage } from "@/foundation/scene/error-message";

const SERVICE_ACCOUNT_KEY_ERROR_KEYS: Readonly<Record<string, string>> = {
  ...SERVICE_ACCOUNT_ERROR_KEYS,
  "10044": "api_keys.serviceAccount.errors.workspace",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** A readable message for a failed key action, with text for application keys. */
export function serviceAccountKeyErrorMessage(
  t: Translate,
  cause: unknown,
  fallback: string,
): string {
  return (
    translateApiError(t, cause, SERVICE_ACCOUNT_KEY_ERROR_KEYS) ??
    getErrorMessage(cause, fallback)
  );
}
