/** The name to show for a resource: its display name, or else its name. */
export const displayName = (metadata: {
  name: string;
  display_name?: string | null;
}): string => metadata.display_name?.trim() || metadata.name;
