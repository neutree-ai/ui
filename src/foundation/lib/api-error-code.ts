/**
 * The application error code of a failed API call, if it carries one.
 *
 * The data provider copies the PostgREST / neutree-api error body onto the
 * thrown error, so a database `RAISE ... '{"code": "10255", ...}'` or a
 * neutree-api validation response arrives here as `code: "10255"`.
 */
export const getApiErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "number") return String(code);
  return typeof code === "string" && code ? code : undefined;
};

/** The server's hint (what to fix) of a failed API call, if any. */
export const getApiErrorHint = (error: unknown): string => {
  if (!error || typeof error !== "object") return "";
  const hint = (error as { hint?: unknown }).hint;
  return typeof hint === "string" ? hint.trim() : "";
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Translate a failed API call through a code → i18n key table, or return
 * undefined when its code is not in the table (the caller keeps its default).
 * The key receives the server hint as `{{hint}}`.
 *
 * Codes are scoped by the caller, not global: the same number can mean
 * different things on different resources.
 */
export const translateApiError = (
  t: Translate,
  error: unknown,
  keysByCode: Readonly<Record<string, string>>,
): string | undefined => {
  const code = getApiErrorCode(error);
  if (!code || !(code in keysByCode)) return undefined;
  return t(keysByCode[code], { hint: getApiErrorHint(error) });
};
