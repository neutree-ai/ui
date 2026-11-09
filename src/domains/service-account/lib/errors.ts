import { translateApiError } from "@/foundation/lib/api-error-code";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { SERVICE_ACCOUNT_ERROR_KEYS } from "@/foundation/lib/service-account-errors";

/** Server errors of applications (ServiceAccounts), their keys and permissions. */
const ERROR_KEYS: Readonly<Record<string, string>> = {
  ...SERVICE_ACCOUNT_ERROR_KEYS,
  "10315": "service_accounts.errors.teamHasApplications",
  "10324": "service_accounts.errors.ceilingUnknown",
  "10325": "service_accounts.errors.managementRole",
  "23505": "service_accounts.errors.nameTaken",
};

/** A PATCH or DELETE that changed no row: the application is gone or hidden. */
export class ServiceAccountGoneError extends Error {
  constructor() {
    super("The application no longer exists or cannot be changed");
    this.name = "ServiceAccountGoneError";
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** A readable message for a failed call, falling back to the server text. */
export const serviceAccountErrorMessage = (
  t: Translate,
  error: unknown,
  fallback: string,
): string =>
  (error instanceof ServiceAccountGoneError
    ? t("service_accounts.errors.gone")
    : undefined) ??
  translateApiError(t, error, ERROR_KEYS) ??
  getErrorMessage(error, fallback);
