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
