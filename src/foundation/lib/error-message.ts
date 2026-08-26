/**
 * Extract a human-readable message from a thrown value.
 *
 * `error instanceof Error` on its own is not enough: third-party libraries and
 * hand-rolled rejections throw plain objects carrying a `message`, and
 * `String(error)` turns those into "[object Object]" in the UI.
 *
 * @param fallback - Shown when no usable message can be read off the value
 */
export const getErrorMessage = (error: unknown, fallback: string): string => {
  const message =
    typeof error === "string"
      ? error
      : (error as { message?: unknown } | null | undefined)?.message;

  return typeof message === "string" && message.trim()
    ? message.trim()
    : fallback;
};

/**
 * Whether a failed write was refused because the name is already taken.
 *
 * Every resource here is unique on (workspace, name), and PostgREST reports
 * that as a raw constraint violation. Callers turn it into what actually
 * happened — "that name is in use" — instead of showing the constraint.
 *
 * The shape varies with how far up the stack the failure was wrapped, so all
 * the forms it arrives in are recognised rather than only the tidiest one.
 */
export const isDuplicateNameError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const e = error as { statusCode?: number; code?: string; message?: string };
  if (e.statusCode === 409 || e.code === "23505") return true;

  const message = (e.message ?? "").toLowerCase();

  return (
    message.includes("duplicate key") ||
    message.includes("already exists") ||
    message.includes("23505") ||
    message.includes("unique constraint")
  );
};
