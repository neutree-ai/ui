import type {
  GroupPolicyModel,
  GroupPolicySpec,
  GroupPolicySubjectKind,
} from "@/domains/group-policy/types";

export const entryKey = (entry: GroupPolicyModel) =>
  `${entry.workspace ?? ""}/${entry.model}`;

/** Append `models` scoped to `workspace` (empty = every workspace), skipping duplicates. */
export const addEntries = (
  entries: GroupPolicyModel[],
  models: string[],
  workspace: string,
): GroupPolicyModel[] => {
  const seen = new Set(entries.map(entryKey));
  const next = [...entries];
  for (const raw of models) {
    const model = raw.trim();
    if (!model) continue;
    const entry: GroupPolicyModel = workspace
      ? { model, workspace }
      : { model };
    if (seen.has(entryKey(entry))) continue;
    seen.add(entryKey(entry));
    next.push(entry);
  }
  return next;
};

export const removeEntry = (
  entries: GroupPolicyModel[],
  entry: GroupPolicyModel,
): GroupPolicyModel[] =>
  entries.filter((candidate) => entryKey(candidate) !== entryKey(entry));

/** Both lists always go out: a PATCH clears the one it leaves out. */
export const buildGroupPolicySpec = (
  kind: GroupPolicySubjectKind,
  name: string,
  allowed: GroupPolicyModel[],
  denied: GroupPolicyModel[],
): GroupPolicySpec => ({
  subject_kind: kind,
  subject_name: name,
  allowed_models: allowed.length > 0 ? allowed : null,
  denied_models: denied.length > 0 ? denied : null,
});

export const hasRules = (
  spec:
    | Pick<GroupPolicySpec, "allowed_models" | "denied_models">
    | null
    | undefined,
) =>
  (spec?.allowed_models?.length ?? 0) > 0 ||
  (spec?.denied_models?.length ?? 0) > 0;
