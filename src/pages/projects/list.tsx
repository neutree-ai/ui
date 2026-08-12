import {
  useCreate,
  useDelete,
  useInvalidate,
  useList,
  useUpdate,
} from "@refinedev/core";
import {
  Edit,
  MoreHorizontal,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/domains/project/types";
import { ListPage } from "@/foundation/components/ListPage";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

type Values = { name: string; description: string };

export const ProjectsList = () => {
  const { t } = useTranslation();
  const { current: workspace } = useWorkspace();
  const scopedWorkspace = workspace === ALL_WORKSPACES ? undefined : workspace;
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<Values>({ name: "", description: "" });
  const invalidate = useInvalidate();
  const { data, isLoading } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
    meta: {
      workspace: scopedWorkspace,
      workspaced: true,
      workspaceField: "workspace",
    },
    queryOptions: { enabled: Boolean(scopedWorkspace) },
  });
  const { mutate: create } = useCreate();
  const { mutate: update } = useUpdate();
  const { mutate: remove } = useDelete();
  const projects = useMemo(() => data?.data ?? [], [data]);

  const openCreate = () => {
    setEditing(null);
    setValues({ name: "", description: "" });
    setCreating(true);
  };
  const openEdit = (project: Project) => {
    setEditing(project);
    setValues({ name: project.name, description: project.description ?? "" });
    setCreating(true);
  };
  const close = () => setCreating(false);
  const save = () => {
    if (!scopedWorkspace || !values.name.trim()) return;
    const done = () => {
      close();
      invalidate({ resource: "projects", invalidates: ["list"] });
    };
    if (editing) {
      update(
        { resource: "projects", id: editing.id, values },
        { onSuccess: done },
      );
    } else {
      create(
        {
          resource: "projects",
          values: { ...values, workspace: scopedWorkspace },
        },
        { onSuccess: done },
      );
    }
  };

  return (
    <ListPage
      title={t("projects.title")}
      extra={
        <Button onClick={openCreate} disabled={!scopedWorkspace}>
          <Plus className="mr-2 h-4 w-4" />
          {t("projects.create")}
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">{t("common.fields.name")}</th>
              <th className="p-3">{t("common.fields.description")}</th>
              <th className="p-3">{t("common.fields.status")}</th>
              <th className="p-3 text-right">{t("common.fields.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && projects.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="p-8 text-center text-muted-foreground"
                >
                  {t("projects.empty")}
                </td>
              </tr>
            )}
            {projects.map((project) => (
              <tr key={project.id} className="border-b last:border-0">
                <td className="p-3 font-medium">
                  {project.name}
                  {project.is_default && (
                    <Badge variant="outline" className="ml-2">
                      {t("projects.default")}
                    </Badge>
                  )}
                </td>
                <td className="max-w-md truncate p-3 text-muted-foreground">
                  {project.description || "-"}
                </td>
                <td className="p-3">
                  <Badge variant="outline">
                    {t(`projects.status.${project.status}`)}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.fields.actions")}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(project)}>
                        <Edit className="mr-2 h-4 w-4" />
                        {t("buttons.edit")}
                      </DropdownMenuItem>
                      {!project.is_default && (
                        <DropdownMenuItem
                          onClick={() =>
                            update(
                              {
                                resource: "projects",
                                id: project.id,
                                values: {
                                  status:
                                    project.status === "enabled"
                                      ? "disabled"
                                      : "enabled",
                                },
                              },
                              {
                                onSuccess: () =>
                                  invalidate({
                                    resource: "projects",
                                    invalidates: ["list"],
                                  }),
                              },
                            )
                          }
                        >
                          {project.status === "enabled" ? (
                            <PowerOff className="mr-2 h-4 w-4" />
                          ) : (
                            <Power className="mr-2 h-4 w-4" />
                          )}
                          {t(
                            `projects.actions.${project.status === "enabled" ? "disable" : "enable"}`,
                          )}
                        </DropdownMenuItem>
                      )}
                      {!project.is_default && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            remove(
                              { resource: "projects", id: project.id },
                              {
                                onSuccess: () =>
                                  invalidate({
                                    resource: "projects",
                                    invalidates: ["list"],
                                  }),
                              },
                            )
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("buttons.delete")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(editing ? "projects.edit" : "projects.create")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm">
              {t("common.fields.name")}
              <Input
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              {t("common.fields.description")}
              <Textarea
                value={values.description}
                onChange={(e) =>
                  setValues({ ...values, description: e.target.value })
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={close}>
              {t("buttons.cancel")}
            </Button>
            <Button onClick={save} disabled={!values.name.trim()}>
              {t("buttons.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListPage>
  );
};
