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

export function apiKeyActionErrorMessage(
  cause: unknown,
  fallback = "API key operation failed. Please try again.",
): string {
  const message = errorText(cause);
  return message || fallback;
}

export function createApiKeyErrorMessage(cause: unknown): string {
  return apiKeyActionErrorMessage(
    cause,
    "Failed to create API key. Please try again.",
  );
}
