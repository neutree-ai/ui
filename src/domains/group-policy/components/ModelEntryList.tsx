import { X } from "lucide-react";
import { entryKey } from "@/domains/group-policy/lib/model-entries";
import type { GroupPolicyModel } from "@/domains/group-policy/types";
import { useTranslation } from "@/foundation/lib/i18n";

/** Policy entries as chips: the model, and its workspace or "all workspaces". */
export function ModelEntryList({
  entries,
  onRemove,
  emptyText,
  "data-testid": testId,
}: {
  entries: GroupPolicyModel[];
  onRemove?: (entry: GroupPolicyModel) => void;
  emptyText?: string;
  "data-testid"?: string;
}) {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return emptyText ? (
      <span className="text-sm text-muted-foreground" data-testid={testId}>
        {emptyText}
      </span>
    ) : null;
  }

  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {entries.map((entry) => (
        <span
          key={entryKey(entry)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 py-0.5 pl-2 pr-1 text-xs"
          data-testid="model-entry"
        >
          <span className="break-all font-medium">{entry.model}</span>
          <span className="truncate text-muted-foreground">
            {entry.workspace || t("group_policies.allWorkspaces")}
          </span>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(entry)}
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
              aria-label={t("buttons.delete")}
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <span className="w-0.5" />
          )}
        </span>
      ))}
    </div>
  );
}
