/**
 * What an API key shows wherever it is named: usage tables and charts, the
 * access log and its filters. One rule keeps those places consistent.
 */
type ApiKeyLabelParts = {
  /** The name to read: the display name, or the technical name without one. */
  primary: string;
  /** `metadata.name` when a display name hides it; null when it is the primary. */
  technicalName: string | null;
  /** The description, or null when blank. */
  description: string | null;
};

export function apiKeyLabelParts({
  name,
  displayName,
  description,
}: {
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
}): ApiKeyLabelParts {
  const technical = name?.trim() || null;
  const display = displayName?.trim() || null;
  return {
    primary: display ?? technical ?? "",
    technicalName:
      display && technical && display !== technical ? technical : null,
    description: description?.trim() || null,
  };
}

/**
 * The full text of a label, one entry per line, for a tooltip. `technicalLabel`
 * is the already translated caption of the technical name.
 */
export function apiKeyLabelDetails(
  { primary, technicalName, description }: ApiKeyLabelParts,
  technicalLabel: string,
): string[] {
  return [
    primary,
    technicalName ? `${technicalLabel}: ${technicalName}` : null,
    description,
  ].filter((line): line is string => Boolean(line));
}
