import type { FieldErrors, FieldValues } from "react-hook-form";

type FlatFieldError = {
  type: string;
  message: string;
};

/**
 * React Hook Form's resolver contract is a nested FieldErrors tree, while
 * domain validators often collect errors by dotted path. Returning the flat
 * map directly leaves literal dotted keys in form state, which per-field
 * revalidation cannot remove. Nest at the resolver boundary.
 */
export function nestFieldErrors<T extends FieldValues = FieldValues>(
  errors: Record<string, FlatFieldError>,
): FieldErrors<T> {
  const nested: Record<string, unknown> = {};

  for (const [path, error] of Object.entries(errors)) {
    const segments = path.split(".");
    let cursor = nested;

    for (const segment of segments.slice(0, -1)) {
      const child = cursor[segment];
      if (!child || typeof child !== "object" || Array.isArray(child)) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }

    const leaf = segments.at(-1);
    if (leaf) cursor[leaf] = error;
  }

  return nested as FieldErrors<T>;
}
