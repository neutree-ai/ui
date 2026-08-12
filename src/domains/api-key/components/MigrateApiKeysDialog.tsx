import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ProjectPicker } from "@/domains/api-key/components/ProjectPicker";
import {
  useMigrateApiKeys,
  useProjectMutations,
} from "@/domains/api-key/hooks/use-api-key-projects";
import type { Project } from "@/domains/api-key/types";
import { useTranslation } from "@/foundation/lib/i18n";

export type MigrateKeyRow = {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string;
};

type MigrateApiKeysDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: string;
  projects: Project[];
  keys: MigrateKeyRow[];
  onMigrated?: (targetProjectId: string) => void;
};

/**
 * Single / batch migration dialog. Shows every selected key with its source
 * Project, a searchable target Project picker (disabled Projects visible but
 * not selectable) with an inline create area, and backend-driven validation:
 * the target must be enabled, be in the same workspace, and contain no key
 * with a colliding name (the backend reports the conflicting names).
 */
export const MigrateApiKeysDialog = ({
  open,
  onOpenChange,
  workspace,
  projects,
  keys,
  onMigrated,
}: MigrateApiKeysDialogProps) => {
  const { t } = useTranslation();
  const { migrate } = useMigrateApiKeys();
  const { create } = useProjectMutations();

  const [targetId, setTargetId] = useState<string | null>(null);
  // Projects created inline in this dialog, merged into the picker list so the
  // freshly created Project can be selected immediately without a refetch.
  const [inlineProjects, setInlineProjects] = useState<Project[]>([]);
  const allProjects = useMemo(() => [...projects, ...inlineProjects], [projects, inlineProjects]);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const target = allProjects.find((p) => p.id === targetId);
  const allAlreadyInTarget =
    keys.length > 0 &&
    keys.every((k) => k.projectId === targetId);
  const canConfirm = Boolean(target && !allAlreadyInTarget && !submitting);

  const reset = () => {
    setTargetId(null);
    setCreating(false);
    setCreateName("");
    setCreateDescription("");
    setCreateError(null);
    setError(null);
    setSubmitting(false);
    setInlineProjects([]);
  };

  const handleClose = (next: boolean) => {
    if (!submitting) {
      if (!next) reset();
      onOpenChange(next);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError(t("common.validation.required"));
      return;
    }
    setCreateError(null);
    try {
      const created = await create({
        workspace,
        name: createName,
        description: createDescription,
      });
      setInlineProjects((prev) => [...prev.filter((p) => p.id !== created.id), created]);
      setTargetId(created.id);
      setCreating(false);
      setCreateName("");
      setCreateDescription("");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleConfirm = async () => {
    if (!target || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ids = keys.map((k) => k.id);
      await migrate(ids, target.id);
      toast.success(
        t("projects.migrateSuccess", {
          count: ids.length,
          project: target.name,
        }),
      );
      const targetIdToExpand = target.id;
      reset();
      onOpenChange(false);
      onMigrated?.(targetIdToExpand);
    } catch (e) {
      // Keep the dialog + selection + target open so the user can retry.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("projects.migrateTitle")}</DialogTitle>
          <DialogDescription>
            {t("projects.migrateDescription", { count: keys.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-sm font-medium">
              {t("projects.selectedKeys", { count: keys.length })}
            </div>
            <ScrollArea className="max-h-44">
              <ul className="divide-y">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium">{k.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {k.projectName}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t("projects.targetProject")}
            </div>
            <ProjectPicker
              projects={allProjects}
              value={targetId}
              onChange={setTargetId}
              placeholder={t("projects.selectTargetPlaceholder")}
              canCreate
              onRequestCreate={() => setCreating((v) => !v)}
            />
          </div>

          {creating && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div className="text-sm font-medium">
                {t("projects.createTitle")}
              </div>
              <Input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder={t("common.fields.name")}
                autoFocus
              />
              <Textarea
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                placeholder={t("common.fields.description")}
              />
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCreating(false)}
                >
                  {t("buttons.cancel")}
                </Button>
                <Button type="button" onClick={() => void handleCreate()}>
                  {t("projects.createAndSelect")}
                </Button>
              </div>
            </div>
          )}

          {allAlreadyInTarget && (
            <p className="text-sm text-muted-foreground">
              {t("projects.allAlreadyInTarget")}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => handleClose(false)}
          >
            {t("buttons.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("projects.migrateButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
