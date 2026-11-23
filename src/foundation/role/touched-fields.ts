export type TouchedFields =
  | Record<string, unknown>
  | unknown[]
  | boolean
  | undefined;

export const isTouchedField = (
  touchedFields: TouchedFields,
  path: string[],
): boolean => {
  let current: unknown = touchedFields;
  for (const segment of path) {
    if (current === true) return true;
    if (!current || typeof current !== "object") return false;
    current = (current as Record<string, unknown>)[segment];
  }
  return current === true;
};

/**
 * On edit the API never returns masked secrets, so an empty untouched input
 * means "keep the stored value": drop those keys from the payload. A key the
 * user typed into and emptied is kept, so it goes out as `""`.
 */
export const omitEmptyUntouched = <T extends object>(
  target: T | undefined,
  path: string[],
  keys: (keyof T & string)[],
  touchedFields: TouchedFields,
) => {
  for (const key of keys) {
    if (!target?.[key] && !isTouchedField(touchedFields, [...path, key])) {
      delete target?.[key];
    }
  }
};
