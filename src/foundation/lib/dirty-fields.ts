export type DirtyFields =
  | Record<string, unknown>
  | unknown[]
  | boolean
  | undefined;

export const isDirtyField = (
  dirtyFields: DirtyFields,
  path: string[],
): boolean => {
  let current: unknown = dirtyFields;
  for (const segment of path) {
    if (current === true) return true;
    if (!current || typeof current !== "object") return false;
    current = (current as Record<string, unknown>)[segment];
  }
  return current === true;
};
