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
