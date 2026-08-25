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
