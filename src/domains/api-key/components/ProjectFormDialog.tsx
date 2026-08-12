import { useSelect } from "@refinedev/core";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProjectMutations } from "@/domains/api-key/hooks/use-api-key-projects";
import type { Project } from "@/domains/api-key/types";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { useTranslation } from "@/foundation/lib/i18n";

type ProjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: string;
  project?: Project | null;
  onSaved?: (project: Project) => void;
};

/**
 * Create / edit a Project. Editing the Default Project only allows changing
 * the description (the backend rejects renames/disable); create mode offers a
 * workspace picker when the page is in the all-workspaces view.
 */
export const ProjectFormDialog = ({
  open,
  onOpenChange,
  workspace,
  project,
  onSaved,
}: ProjectFormDialogProps) => {
  const { t } = useTranslation();
  const { create, update } = useProjectMutations();
  const workspaces = useSelect({ resource: "workspaces" });

  const editing = Boolean(project);
  const defaultProject = Boolean(project?.is_default);

  const [workspaceValue, setWorkspaceValue] = useState<string>(workspace ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"enabled" | "disabled">("enabled");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setWorkspaceValue(workspace ?? "");
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setStatus(project?.status ?? "enabled");
      setError(null);
      setSaving(false);
    }
  }, [open, workspace, project]);

  const canSave =
    (editing || Boolean(workspaceValue.trim())) &&
    (!editing || defaultProject || name.trim().length > 0);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      let saved: Project;
      if (project) {
        saved = await update({
          projectId: project.id,
          description,
          ...(defaultProject ? {} : { name, status }),
        });
      } else {
        saved = await create({
          workspace: workspaceValue.trim(),
          name,
          description,
        });
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("projects.editTitle") : t("projects.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? t("projects.editDescription")
              : t("projects.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!editing && (
            <div className="space-y-2">
              <Label>{t("common.fields.workspace")}</Label>
              <FormCombobox
                placeholder={t("api_keys.placeholders.selectWorkspace")}
                disabled={Boolean(workspace) || workspaces.query.isLoading}
                value={workspaceValue}
                onChange={(value) => setWorkspaceValue(String(value))}
                options={(workspaces.query.data?.data ?? []).map((e) => ({
                  label: e.metadata.name,
                  value: e.metadata.name,
                }))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("common.fields.name")}</Label>
            <Input
              value={name}
              disabled={defaultProject}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
            />
            {defaultProject && (
              <p className="text-xs text-muted-foreground">
                {t("projects.defaultLockHint")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("common.fields.description")}</Label>
            <Textarea
              value={description ?? ""}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Project description"
            />
          </div>

          {editing && !defaultProject && (
            <div className="space-y-2">
              <Label>{t("common.fields.status")}</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as "enabled" | "disabled")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">
                    {t("projects.statusEnabled")}
                  </SelectItem>
                  <SelectItem value="disabled">
                    {t("projects.statusDisabled")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("buttons.cancel")}
          </Button>
          <Button type="button" disabled={!canSave || saving} onClick={handleSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? t("buttons.save") : t("projects.createButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
