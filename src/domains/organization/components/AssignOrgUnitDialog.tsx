import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingIcon } from "@/components/ui/loading";
import { OrgUnitTree } from "@/domains/organization/components/OrgUnitTree";
import {
  expandableIds,
  filterOrgTree,
  indexNodes,
  type OrgTreeNode,
} from "@/domains/organization/lib/org-tree";
import { EmptyState } from "@/foundation/components/EmptyState";
import { useTranslation } from "@/foundation/lib/i18n";

type AssignOrgUnitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree: OrgTreeNode[];
  currentId?: number;
  saving?: boolean;
  error?: string;
  onSave: (orgUnitId: number) => void;
  title?: string;
  description?: string;
  /** Replaces the "nothing synced" text, e.g. for a user who cannot read departments. */
  emptyText?: string;
};

/**
 * Picks a department from the tree. Mount it when opening: the selection
 * starts from currentId. Only Active departments can be chosen; an Inactive
 * one stays visible when an Active one sits below it.
 */
export function AssignOrgUnitDialog({
  open,
  onOpenChange,
  tree,
  currentId,
  saving,
  error,
  onSave,
  title,
  description,
  emptyText,
}: AssignOrgUnitDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | undefined>(currentId);
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());

  const roots = useMemo(() => filterOrgTree(tree, { query }), [tree, query]);
  const expanded = useMemo(
    () => new Set(expandableIds(roots).filter((id) => !collapsed.has(id))),
    [roots, collapsed],
  );
  const selected =
    selectedId === undefined ? undefined : indexNodes(tree).get(selectedId);

  const onExpandedChange = (id: number, next: boolean) => {
    const set = new Set(collapsed);
    if (next) set.delete(id);
    else set.add(id);
    setCollapsed(set);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {title ?? t("user_profiles.department.assignTitle")}
          </DialogTitle>
          <DialogDescription>
            {description ?? t("user_profiles.department.assignHint")}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("organization.filters.searchDepartments")}
          data-testid="assign-org-unit-search"
        />
        <div
          className="max-h-80 min-h-32 overflow-auto rounded-md border p-2"
          data-testid="assign-org-unit-tree"
        >
          {roots.length ? (
            <OrgUnitTree
              roots={roots}
              expanded={expanded}
              onExpandedChange={onExpandedChange}
              selectedId={selectedId}
              onSelect={setSelectedId}
              isDisabled={(node) => node.inactive}
            />
          ) : (
            <EmptyState variant="inline">
              {tree.length
                ? t("organization.departments.noMatch")
                : (emptyText ?? t("organization.departments.empty"))}
            </EmptyState>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {t("user_profiles.department.selected")}:{" "}
          <span
            className="text-foreground"
            data-testid="assign-org-unit-selected"
          >
            {selected?.pathLabel ?? "-"}
          </span>
        </div>
        {error && (
          <Alert variant="destructive" data-testid="assign-org-unit-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("buttons.cancel")}
          </Button>
          <Button
            onClick={() => selectedId !== undefined && onSave(selectedId)}
            disabled={
              saving || selectedId === undefined || selectedId === currentId
            }
            data-testid="assign-org-unit-save"
          >
            {saving && <LoadingIcon className="mr-2" />}
            {t("buttons.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
