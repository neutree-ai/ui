/** A Team or a department (OrgUnit). */
export type GroupKind = "Team" | "OrgUnit";

/** One Team or department: `name` is its metadata.name, `id` its row id. */
export type LabeledScope = {
  kind: GroupKind;
  name: string;
  id: number;
  label: string;
};

export const isGroupKind = (
  kind: string | null | undefined,
): kind is GroupKind => kind === "Team" || kind === "OrgUnit";
