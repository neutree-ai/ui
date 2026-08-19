import {
  useCustomMutation,
  useDelete,
  useList,
  useNavigation,
  useNotification,
} from "@refinedev/core";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiKeyRankingOverview } from "@/domains/api-key/components/ApiKeyRankingOverview";
import { CreateApiKeyForm } from "@/domains/api-key/components/CreateApiKeyForm";
import { ProjectPicker } from "@/domains/api-key/components/ProjectPicker";
import {
  rateSummary,
  useAllApiKeyTraffic,
  useAllApiKeyUsage,
  useApiKeyDisable,
  useWorkspaceModelMap,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { useApiKeyProjectGroups } from "@/domains/api-key/hooks/use-api-key-project-groups";
import { useApiKeyProjects } from "@/domains/api-key/hooks/use-api-key-projects";
import { apiKeyActionErrorMessage } from "@/domains/api-key/lib/create-api-key-error";
import type {
  AllowedModel,
  ApiKey,
  ApiKeyProject,
} from "@/domains/api-key/types";
import { DeleteConfirmDialog } from "@/foundation/components/DeleteConfirmDialog";
import { ListPage } from "@/foundation/components/ListPage";
import Timestamp from "@/foundation/components/Timestamp";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import { buildBatchDeleteVariables } from "@/foundation/lib/batch-delete";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokenQuota } from "@/foundation/lib/token-quota";
import { cn } from "@/foundation/lib/utils";

const endpointPhaseClass = (phase: string | null | undefined) =>
  ({
    Running:
      "border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]",
    Failed:
      "border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
    Pending:
      "border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
    Deploying:
      "border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]",
    ModelDownloading:
      "border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]",
    Deleting:
      "border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
    Paused:
      "border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
    Deleted:
      "border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]",
  })[phase ?? ""] ??
  "border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]";

function ModelsCell({
  models,
  modelMap,
  scopedWorkspace,
}: {
  models: AllowedModel[];
  modelMap: ReturnType<typeof useWorkspaceModelMap>;
  scopedWorkspace: string | undefined;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? models : models.slice(0, 2);

  if (models.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("api_keys.limits.allModels")}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((model, index) => {
        const pinned = Boolean(model.type && model.endpoint_name);
        const endpoint = pinned
          ? modelMap
              .get(model.model)
              ?.endpoints.find(
                (item) =>
                  item.name === model.endpoint_name && item.type === model.type,
              )
          : undefined;
        return (
          <div
            key={`${model.type ?? ""}:${model.endpoint_name ?? ""}:${model.model}:${index}`}
            className="flex min-w-0 flex-col gap-1"
          >
            <span className="truncate font-semibold" title={model.model}>
              {model.model}
            </span>
            {pinned ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <span className="max-w-[140px] truncate">
                  {model.endpoint_name}
                </span>
                <Badge variant="outline" className="h-5 font-normal">
                  {t(`api_keys.models.${model.type}`)}
                </Badge>
                {endpoint ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 font-normal",
                      endpointPhaseClass(endpoint.phase),
                    )}
                  >
                    {endpoint.phase
                      ? t(`status.phases.endpoint.${endpoint.phase}`)
                      : t("api_keys.models.unknown")}
                  </Badge>
                ) : scopedWorkspace ? (
                  <Badge variant="outline" className="h-5 font-normal">
                    {t("api_keys.modelAccess.unavailable")}
                  </Badge>
                ) : null}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t("api_keys.models.anySource")}
              </span>
            )}
          </div>
        );
      })}
      {models.length > 2 && (
        <button
          type="button"
          className="self-start text-xs text-muted-foreground hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? t("api_keys.limits.showLess")
            : t("api_keys.limits.showMore", { count: models.length - 2 })}
        </button>
      )}
    </div>
  );
}

export const ApiKeysList = () => {
  const { t } = useTranslation();
  const { current: workspace } = useWorkspace();
  const scoped = workspace === ALL_WORKSPACES ? undefined : workspace;
  const [open, setOpen] = useState(false);
  const [createKeyPreset, setCreateKeyPreset] = useState({
    workspace: "",
    projectId: "",
  });
  const [createKeySession, setCreateKeySession] = useState(0);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [keyStatus, setKeyStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ApiKeyProject>();
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [actionError, setActionError] = useState("");
  const [deletingProject, setDeletingProject] = useState<ApiKeyProject>();
  const [deletingKeys, setDeletingKeys] = useState<ApiKey[]>([]);
  const [deletingKeyPending, setDeletingKeyPending] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectName, setCreateProjectName] = useState("");
  const [createProjectDescription, setCreateProjectDescription] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const { mutateAsync } = useCustomMutation();
  const { open: openNotification } = useNotification();
  const { show } = useNavigation();
  const { mutateAsync: deleteKey } = useDelete();
  const { disable, enable } = useApiKeyDisable();
  // The trace endpoint understands the UI's `_all_` sentinel and applies the
  // caller's per-workspace permissions while aggregating. Passing `scoped`
  // here would turn All Workspaces into undefined and skip the request.
  const trafficByKey = useAllApiKeyTraffic(workspace);
  const usageByKey = useAllApiKeyUsage(scoped);
  const modelMap = useWorkspaceModelMap(scoped);
  const { data: keysData } = useList<ApiKey>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace, workspaced: true },
    queryOptions: { enabled: Boolean(workspace) },
  });
  const rankingKeys = useMemo(
    () =>
      (keysData?.data ?? [])
        .filter(
          (key) =>
            !key.metadata?.deletion_timestamp &&
            (workspace === ALL_WORKSPACES ||
              key.metadata?.workspace === workspace),
        )
        .map((key) => ({
          id: String(key.id),
          name:
            key.metadata?.display_name ?? key.metadata?.name ?? String(key.id),
          description: key.description,
        })),
    [keysData, workspace],
  );
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const groupsQuery = useApiKeyProjectGroups({
    workspace: scoped,
    search: debouncedQuery,
    apiKeyDisabled: keyStatus === "all" ? null : keyStatus === "disabled",
    page,
    pageSize,
  });
  const grouped = groupsQuery.data.map((group) => ({
    project: group.project,
    all: group.api_keys,
    shown: group.api_keys,
    visible: true,
    count: group.api_key_count,
  }));
  const selectedKeys = (keysData?.data ?? []).filter((key) =>
    selected.has(key.id),
  );
  const selectedWorkspaces = [
    ...new Set(
      selectedKeys
        .map((key) => key.metadata.workspace)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const moveWorkspace =
    selectedWorkspaces.length === 1 ? selectedWorkspaces[0] : "";
  const movableKeyCount = selectedKeys.filter(
    (key) => (key.project_id ?? "") !== target,
  ).length;
  const { data: moveProjects } = useApiKeyProjects(moveWorkspace);
  const projects = grouped.map((group) => group.project);
  const moveProjectNames = new Map(
    [...moveProjects, ...projects].map((project) => [project.id, project.name]),
  );
  const groupedProjectIds = grouped.map((group) => group.project.id).join(",");
  const expansionContext = [
    scoped,
    debouncedQuery,
    keyStatus,
    page,
    pageSize,
  ].join("\0");
  const pageCount = Math.max(
    1,
    Math.ceil((groupsQuery.data[0]?.total_projects ?? 0) / pageSize),
  );

  const pageGroups = grouped;
  const pageKeys = pageGroups.flatMap((group) => group.shown);
  const pageKeyIds = pageKeys.map((key) => key.id);
  const selectedPageKeyCount = pageKeyIds.filter((id) =>
    selected.has(id),
  ).length;
  const pageSelectionState =
    selectedPageKeyCount === 0
      ? false
      : selectedPageKeyCount === pageKeyIds.length
        ? true
        : "indeterminate";
  // Reset only when the result context changes. User toggles must not cause a
  // collapsed Project to immediately reopen.
  useEffect(() => {
    const projectIds = expansionContext
      ? groupedProjectIds.split(",").filter(Boolean)
      : [];
    setExpanded(new Set(projectIds));
  }, [expansionContext, groupedProjectIds]);
  const refresh = async () => {
    await groupsQuery.refetch();
  };
  const createKey = (project?: ApiKeyProject) => {
    setCreateKeyPreset({
      workspace: project?.workspace ?? scoped ?? "",
      projectId: project?.is_ungrouped ? "" : (project?.id ?? ""),
    });
    setCreateKeySession((session) => session + 1);
    setOpen(true);
  };
  const createProject = async () => {
    if (!scoped || !createProjectName.trim()) return;
    setActionError("");
    setCreatingProject(true);
    try {
      const response = await mutateAsync({
        url: "/rpc/create_api_key_project",
        method: "post",
        values: {
          p_workspace: scoped,
          p_name: createProjectName.trim(),
          p_description: createProjectDescription.trim(),
        },
      });
      const project = response.data as ApiKeyProject;
      setCreateProjectOpen(false);
      setCreateProjectName("");
      setCreateProjectDescription("");
      setExpanded((current) => new Set([...current, project.id]));
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreatingProject(false);
    }
  };
  const migrate = async () => {
    setActionError("");
    try {
      const response = await mutateAsync({
        url: "/rpc/move_api_keys_to_project",
        method: "post",
        values: {
          p_api_key_ids: [...selected],
          p_project_id: target || null,
        },
        successNotification: false,
        errorNotification: false,
      });
      setSelected(new Set());
      setMoveOpen(false);
      setExpanded(
        (v) => new Set([...v, target || `__ungrouped__:${moveWorkspace}`]),
      );
      openNotification?.({
        type: "success",
        message: `${Number(response.data) || 0} API key${Number(response.data) === 1 ? "" : "s"} moved`,
      });
      await refresh();
    } catch (cause) {
      setActionError(
        apiKeyActionErrorMessage(
          cause,
          "Failed to move API keys. Please try again.",
        ),
      );
    }
  };
  const startEdit = (project: ApiKeyProject) => {
    setEditing(project);
    setEditName(project.name);
    setEditDescription(project.description);
  };
  const saveProject = async () => {
    if (!editing) return;
    setActionError("");
    try {
      await mutateAsync({
        url: "/rpc/update_api_key_project",
        method: "post",
        values: {
          p_project_id: editing.id,
          p_name: editName,
          p_description: editDescription,
        },
      });
      setEditing(undefined);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const deleteApiKeys = async (forceDelete: boolean) => {
    if (deletingKeys.length === 0) return;
    if (deletingKeys.some((key) => !key.metadata.workspace)) {
      setActionError(
        "An API key is missing its workspace. Refresh and try again.",
      );
      return;
    }
    const variables = buildBatchDeleteVariables(
      deletingKeys.map((key) => ({
        original: {
          metadata: {
            ...key.metadata,
            workspace: key.metadata.workspace ?? undefined,
          },
        },
      })),
      "api_keys",
      forceDelete,
    );
    if (variables.length !== deletingKeys.length) {
      setActionError("An API key is missing its name. Refresh and try again.");
      return;
    }
    setActionError("");
    setDeletingKeyPending(true);
    try {
      const results = await Promise.allSettled(
        variables.map((variable) => deleteKey(variable)),
      );
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        setActionError(
          `${failed.length} of ${variables.length} API keys could not be deleted.`,
        );
        if (failed.length === variables.length) return;
      }
      const deletedIds = new Set(
        deletingKeys
          .filter((_, index) => results[index]?.status === "fulfilled")
          .map((key) => key.id),
      );
      setSelected((current) => {
        const next = new Set(current);
        for (const id of deletedIds) next.delete(id);
        return next;
      });
      setDeletingKeys([]);
      openNotification?.({
        type: "success",
        message:
          deletedIds.size === 1
            ? "Successfully deleted API key"
            : `Successfully deleted ${deletedIds.size} API keys`,
      });
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDeletingKeyPending(false);
    }
  };

  return (
    <ListPage createButtonProps={{ onClick: () => createKey() }}>
      <ApiKeyRankingOverview keys={rankingKeys} traffic={trafficByKey} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Create a key in a Project.</DialogDescription>
          </DialogHeader>
          <CreateApiKeyForm
            key={createKeySession}
            initialWorkspace={createKeyPreset.workspace}
            initialProjectId={createKeyPreset.projectId}
            onClose={() => setOpen(false)}
            onCreated={refresh}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={createProjectOpen}
        onOpenChange={(nextOpen) => {
          setCreateProjectOpen(nextOpen);
          setActionError("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Create a Project in workspace {scoped}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label
              htmlFor="new-project-name"
              className="block text-sm font-medium"
            >
              Name
              <Input
                id="new-project-name"
                value={createProjectName}
                onChange={(event) => setCreateProjectName(event.target.value)}
              />
            </label>
            <label
              htmlFor="new-project-description"
              className="block text-sm font-medium"
            >
              Description
              <Textarea
                id="new-project-description"
                value={createProjectDescription}
                onChange={(event) =>
                  setCreateProjectDescription(event.target.value)
                }
              />
            </label>
          </div>
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setCreateProjectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!createProjectName.trim() || creatingProject}
              onClick={() => void createProject()}
            >
              {creatingProject ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move API keys</DialogTitle>
            <DialogDescription>
              {selected.size} selected. The operation is atomic.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-2 gap-4 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>API key</span>
              <span>Current Project</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {selectedKeys.map((key) => (
                <div
                  key={key.id}
                  className="grid grid-cols-2 gap-4 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="min-w-0 truncate font-medium">
                    {key.metadata.display_name ?? key.metadata.name}
                  </span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {key.project_id
                      ? (moveProjectNames.get(key.project_id) ??
                        "Unknown Project")
                      : "Ungrouped"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <ProjectPicker
            workspace={moveWorkspace}
            value={target}
            onChange={setTarget}
          />
          {selectedWorkspaces.length > 1 && (
            <p className="text-sm text-destructive">
              Selected API keys span multiple workspaces. Move one workspace at
              a time.
            </p>
          )}
          {movableKeyCount === 0 && (
            <p className="text-sm text-muted-foreground">
              The selected API keys already belong to this Project.
            </p>
          )}
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !selected.size ||
                selectedWorkspaces.length !== 1 ||
                movableKeyCount === 0
              }
              onClick={() => void migrate()}
            >
              Move
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Renaming does not change API key associations or usage history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label htmlFor="project-name" className="block text-sm font-medium">
              Name
              <Input
                id="project-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label
              htmlFor="project-description"
              className="block text-sm font-medium"
            >
              Description
              <Textarea
                id="project-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(undefined)}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim()}
              onClick={() => void saveProject()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deletingProject)}
        onOpenChange={(open) => !open && setDeletingProject(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Delete {deletingProject?.name}? Only an empty Project can be
              deleted.
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setDeletingProject(undefined)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deletingProject) return;
                setActionError("");
                void mutateAsync({
                  url: "/rpc/delete_api_key_project",
                  method: "post",
                  values: { p_project_id: deletingProject.id },
                })
                  .then(async () => {
                    setDeletingProject(undefined);
                    openNotification?.({
                      type: "success",
                      message: "Successfully deleted Project",
                    });
                    await refresh();
                  })
                  .catch((cause) =>
                    setActionError(
                      cause instanceof Error ? cause.message : String(cause),
                    ),
                  );
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        open={deletingKeys.length > 0}
        onOpenChange={(nextOpen) => !nextOpen && setDeletingKeys([])}
        loading={deletingKeyPending}
        title={
          deletingKeys.length > 1
            ? `Delete ${deletingKeys.length} API keys?`
            : undefined
        }
        errorMessage={actionError || undefined}
        onConfirm={(forceDelete) => void deleteApiKeys(forceDelete)}
      >
        <span className="hidden" />
      </DeleteConfirmDialog>
      <div className="my-4 flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search Project, API key, or description"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={keyStatus}
          onValueChange={(value) => {
            setKeyStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All API keys</SelectItem>
            <SelectItem value="active">Active API keys</SelectItem>
            <SelectItem value="disabled">Disabled API keys</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="h-8 w-36 shrink-0 whitespace-nowrap"
          variant="outline"
          disabled={!scoped}
          onClick={() => setCreateProjectOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Create Project
        </Button>
        {selected.size > 0 && (
          <>
            <span className="inline-flex h-8 shrink-0 items-center whitespace-nowrap text-sm">
              {selected.size} selected
            </span>
            <Button
              className="h-8 w-36 shrink-0 whitespace-nowrap"
              onClick={() => {
                setActionError("");
                setTarget("");
                setMoveOpen(true);
              }}
            >
              Move to Project
            </Button>
            <Button
              className="h-8 shrink-0 whitespace-nowrap"
              variant="destructive"
              onClick={() => {
                setActionError("");
                setDeletingKeys(selectedKeys);
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
            <Button
              className="h-8 shrink-0"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </>
        )}
      </div>
      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-[minmax(240px,2fr)_100px_48px] gap-4 border-b bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-3">
            <Checkbox
              aria-label="Select all API keys on this page"
              checked={pageSelectionState}
              disabled={pageKeyIds.length === 0}
              onCheckedChange={(checked) =>
                setSelected((current) => {
                  const next = new Set(current);
                  for (const id of pageKeyIds) {
                    checked ? next.add(id) : next.delete(id);
                  }
                  return next;
                })
              }
            />
            Project / description
          </span>
          <span>API keys</span>
          <span />
        </div>
        {groupsQuery.isLoading && (
          <div className="p-8 text-center text-muted-foreground">
            Loading...
          </div>
        )}
        {groupsQuery.error && (
          <div className="p-8 text-center text-destructive">
            {groupsQuery.error}
          </div>
        )}
        {!groupsQuery.isLoading &&
          !groupsQuery.error &&
          grouped.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No matching Projects or API keys
            </div>
          )}
        {pageGroups.map(({ project, shown, count }) => {
          const isOpen = expanded.has(project.id);
          const projectKeyIds = shown.map((key) => key.id);
          const selectedProjectKeyCount = projectKeyIds.filter((id) =>
            selected.has(id),
          ).length;
          const projectSelectionState =
            selectedProjectKeyCount === 0
              ? false
              : selectedProjectKeyCount === projectKeyIds.length
                ? true
                : "indeterminate";
          return (
            <div key={project.id} className="border-b last:border-b-0">
              <div className="grid grid-cols-[minmax(240px,2fr)_100px_48px] items-center gap-4 px-4 py-3">
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-2 text-left"
                  onClick={() =>
                    setExpanded((old) => {
                      const n = new Set(old);
                      n.has(project.id)
                        ? n.delete(project.id)
                        : n.add(project.id);
                      return n;
                    })
                  }
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <strong className="block truncate">{project.name}</strong>
                    {project.description && (
                      <span
                        className="block truncate text-xs text-muted-foreground"
                        title={project.description}
                      >
                        {project.description}
                      </span>
                    )}
                  </span>
                </button>
                <span className="text-sm">{count}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!project.is_ungrouped && (
                      <DropdownMenuItem onClick={() => startEdit(project)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Project
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => createKey(project)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create API key
                    </DropdownMenuItem>
                    {!project.is_ungrouped && (
                      <DropdownMenuItem
                        className="text-destructive"
                        disabled={count > 0}
                        title={
                          count > 0
                            ? `Move or delete the ${count} API key${count === 1 ? "" : "s"} first`
                            : undefined
                        }
                        onClick={() => setDeletingProject(project)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {isOpen && (
                <div className="border-t bg-muted/20 px-6 py-3">
                  {shown.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      This Project has no API keys
                      <div>
                        <Button
                          variant="link"
                          onClick={() => createKey(project)}
                        >
                          Create API key
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[960px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="w-10">
                              <Checkbox
                                aria-label={`Select all API keys in ${project.name}`}
                                checked={projectSelectionState}
                                onCheckedChange={(checked) =>
                                  setSelected((current) => {
                                    const next = new Set(current);
                                    for (const id of projectKeyIds) {
                                      checked ? next.add(id) : next.delete(id);
                                    }
                                    return next;
                                  })
                                }
                              />
                            </th>
                            <th className="py-2">API key / description</th>
                            <th>Workspace</th>
                            <th>Status</th>
                            <th>Usage</th>
                            <th>Rate limit</th>
                            <th>Supported models</th>
                            <th>Created</th>
                            <th className="w-12" />
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((key) => {
                            const limits = key.spec.limits ?? {};
                            const usage = usageByKey.get(String(key.id));
                            const usageRatio =
                              usage && usage.token_limit > 0
                                ? usage.used / usage.token_limit
                                : 0;
                            const usagePercent = Math.max(
                              0,
                              Math.min(100, usageRatio * 100),
                            );
                            const usageOver = usage
                              ? usage.used >= usage.token_limit
                              : false;
                            const usageWarn = !usageOver && usageRatio >= 0.8;
                            return (
                              <tr key={key.id} className="border-t">
                                <td>
                                  <Checkbox
                                    checked={selected.has(key.id)}
                                    onCheckedChange={(v) =>
                                      setSelected((old) => {
                                        const n = new Set(old);
                                        v ? n.add(key.id) : n.delete(key.id);
                                        return n;
                                      })
                                    }
                                  />
                                </td>
                                <td className="py-3">
                                  <strong>
                                    {key.metadata.display_name ??
                                      key.metadata.name}
                                  </strong>
                                  {key.description && (
                                    <div
                                      className="max-w-xs truncate text-xs text-muted-foreground"
                                      title={key.description}
                                    >
                                      {key.description}
                                    </div>
                                  )}
                                </td>
                                <td>{key.metadata.workspace}</td>
                                <td>
                                  <Badge
                                    variant={
                                      limits.disabled || usageOver
                                        ? "destructive"
                                        : "outline"
                                    }
                                  >
                                    {limits.disabled
                                      ? t("api_keys.limits.statusDisabled")
                                      : usageOver
                                        ? t(
                                            "api_keys.limits.statusQuotaExceeded",
                                          )
                                        : t("api_keys.limits.statusActive")}
                                  </Badge>
                                </td>
                                <td>
                                  {usage && usage.token_limit > 0 ? (
                                    <div className="flex w-40 flex-col gap-1">
                                      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                                        <span>
                                          {formatTokenQuota(usage.used)} /{" "}
                                          {formatTokenQuota(usage.token_limit)}
                                        </span>
                                        <span>{Math.round(usagePercent)}%</span>
                                      </div>
                                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
                                        <div
                                          className={cn(
                                            "h-full",
                                            usageOver
                                              ? "bg-destructive"
                                              : usageWarn
                                                ? "bg-amber-500"
                                                : "bg-primary",
                                          )}
                                          style={{
                                            width: `${usagePercent}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {rateSummary(limits).length > 0 ? (
                                    <span className="text-xs text-muted-foreground">
                                      {rateSummary(limits).join(" · ")}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <ModelsCell
                                    models={limits.allowed_models ?? []}
                                    modelMap={modelMap}
                                    scopedWorkspace={scoped}
                                  />
                                </td>
                                <td>
                                  <Timestamp
                                    timestamp={key.metadata.creation_timestamp}
                                    relative
                                  />
                                </td>
                                <td>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() =>
                                          show(
                                            "api_keys",
                                            key.metadata.name,
                                            "push",
                                            {
                                              workspace: key.metadata.workspace,
                                            },
                                          )
                                        }
                                      >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          void (
                                            limits.disabled
                                              ? enable(key.id)
                                              : disable(key.id)
                                          ).then(refresh)
                                        }
                                      >
                                        {limits.disabled ? (
                                          <Power className="mr-2 h-4 w-4" />
                                        ) : (
                                          <PowerOff className="mr-2 h-4 w-4" />
                                        )}
                                        {limits.disabled ? "Enable" : "Disable"}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelected(new Set([key.id]));
                                          setTarget("");
                                          setMoveOpen(true);
                                        }}
                                      >
                                        <FolderInput className="mr-2 h-4 w-4" />
                                        Move to Project
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => {
                                          setActionError("");
                                          setDeletingKeys([key]);
                                        }}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <span>
          {groupsQuery.data[0]?.total_projects ?? 0} groups,{" "}
          {groupsQuery.totalApiKeys} API keys
        </span>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {t("table.pagination.rowsPerPage")}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="font-medium text-foreground">
            {t("table.pagination.page", { current: page, total: pageCount })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              aria-label={t("table.pagination.goToFirstPage")}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label={t("table.pagination.goToPreviousPage")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              aria-label={t("table.pagination.goToNextPage")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= pageCount}
              onClick={() => setPage(pageCount)}
              aria-label={t("table.pagination.goToLastPage")}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </ListPage>
  );
};
