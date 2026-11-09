import { translateApiError } from "@/foundation/lib/api-error-code";

/** Server errors of applications (ServiceAccounts), their keys and permissions. */
const SERVICE_ACCOUNT_ERROR_KEYS: Readonly<Record<string, string>> = {
  "10315": "service_accounts.errors.teamHasApplications",
  "10316": "service_accounts.errors.keyHasNoProject",
  "10317": "service_accounts.errors.inactive",
  "10318": "service_accounts.errors.immutable",
  "10319": "service_accounts.errors.hasKeys",
  "10320": "service_accounts.errors.applicationActor",
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

const messageOf = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return messageOf((error as { message: unknown }).message);
  }
  return "";
};

/** A readable message for a failed call, falling back to the server text. */
export const serviceAccountErrorMessage = (
  t: Translate,
  error: unknown,
  fallback: string,
): string =>
  (error instanceof ServiceAccountGoneError
    ? t("service_accounts.errors.gone")
    : undefined) ??
  translateApiError(t, error, SERVICE_ACCOUNT_ERROR_KEYS) ??
  (messageOf(error) || fallback);
