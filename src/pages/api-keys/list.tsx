import {
  useCustomMutation,
  useDelete,
  useList,
  useNavigation,
} from "@refinedev/core";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import { Textarea } from "@/components/ui/textarea";
import { ApiKeyRankingOverview } from "@/domains/api-key/components/ApiKeyRankingOverview";
import { CreateApiKeyForm } from "@/domains/api-key/components/CreateApiKeyForm";
import { ProjectPicker } from "@/domains/api-key/components/ProjectPicker";
import {
  rateSummary,
  useAllApiKeyTraffic,
  useApiKeyDisable,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { useApiKeyProjectGroups } from "@/domains/api-key/hooks/use-api-key-project-groups";
import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";
import { ListPage } from "@/foundation/components/ListPage";
import RelativeTimestamp from "@/foundation/components/RelativeTimestamp";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import { buildBatchDeleteVariables } from "@/foundation/lib/batch-delete";
import { formatTokenQuota } from "@/foundation/lib/token-quota";

export const ApiKeysList = () => {
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
  const [projectStatus, setProjectStatus] = useState("all");
  const [keyStatus, setKeyStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ApiKeyProject>();
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [actionError, setActionError] = useState("");
  const [deletingProject, setDeletingProject] = useState<ApiKeyProject>();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectName, setCreateProjectName] = useState("");
  const [createProjectDescription, setCreateProjectDescription] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const pageSize = 10;
  const { mutateAsync } = useCustomMutation();
  const { show } = useNavigation();
  const { mutateAsync: deleteKey } = useDelete();
  const { disable, enable } = useApiKeyDisable();
  const trafficByKey = useAllApiKeyTraffic(scoped);
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
            workspace === ALL_WORKSPACES ||
            key.metadata?.workspace === workspace,
        )
        .map((key) => ({
          id: String(key.id),
          name: key.metadata?.name ?? String(key.id),
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
    projectEnabled: projectStatus === "all" ? null : projectStatus === "active",
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
    usage: group.current_usage,
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
  const projects = grouped.map((group) => group.project);
  const firstProjectId = projects[0]?.id;
  const groupedProjectIds = grouped.map((group) => group.project.id).join(",");
  const pageCount = Math.max(
    1,
    Math.ceil((groupsQuery.data[0]?.total_projects ?? 0) / pageSize),
  );

  useEffect(() => {
    if (firstProjectId && expanded.size === 0 && !query)
      setExpanded(new Set([firstProjectId]));
  }, [firstProjectId, expanded.size, query]);
  const pageGroups = grouped;

  useEffect(() => {
    if (query)
      setExpanded(new Set(groupedProjectIds.split(",").filter(Boolean)));
  }, [query, groupedProjectIds]);
  const refresh = async () => {
    await groupsQuery.refetch();
  };
  const createKey = (project?: ApiKeyProject) => {
    setCreateKeyPreset({
      workspace: project?.workspace ?? scoped ?? "",
      projectId: project?.id ?? "",
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
      await mutateAsync({
        url: "/rpc/move_api_keys_to_project",
        method: "post",
        values: { p_api_key_ids: [...selected], p_project_id: target },
      });
      setSelected(new Set());
      setMoveOpen(false);
      setExpanded((v) => new Set([...v, target]));
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
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
          p_name: editing.name === "Default" ? null : editName,
          p_description: editDescription,
        },
      });
      setEditing(undefined);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
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
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !target || !selected.size || selectedWorkspaces.length !== 1
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
                disabled={editing?.name === "Default"}
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
              disabled={editing?.name !== "Default" && !editName.trim()}
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
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search Project, API key, description, or workspace"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              if (!e.target.value)
                setExpanded(
                  projects[0] ? new Set([projects[0].id]) : new Set(),
                );
            }}
          />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={projectStatus}
          onChange={(e) => {
            setProjectStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Projects</option>
          <option value="active">Active Projects</option>
          <option value="disabled">Disabled Projects</option>
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={keyStatus}
          onChange={(e) => {
            setKeyStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All API keys</option>
          <option value="active">Active API keys</option>
          <option value="disabled">Disabled API keys</option>
        </select>
        <Button
          variant="outline"
          disabled={!scoped}
          onClick={() => setCreateProjectOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Create Project
        </Button>
        {selected.size > 0 && (
          <>
            <span className="text-sm">{selected.size} selected</span>
            <Button
              onClick={() => {
                setActionError("");
                setTarget("");
                setMoveOpen(true);
              }}
            >
              Move to Project
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </>
        )}
      </div>
      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-[minmax(240px,2fr)_100px_120px_140px_48px] gap-4 border-b bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground">
          <span>Project / description</span>
          <span>API keys</span>
          <span>Status</span>
          <span>Current usage</span>
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
        {pageGroups.map(({ project, shown, count, usage: total }) => {
          const isOpen = expanded.has(project.id);
          return (
            <div key={project.id} className="border-b last:border-b-0">
              <div className="grid grid-cols-[minmax(240px,2fr)_100px_120px_140px_48px] items-center gap-4 px-4 py-3">
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
                    <span
                      className="block truncate text-xs text-muted-foreground"
                      title={project.description}
                    >
                      {project.description || "No description"}
                    </span>
                  </span>
                </button>
                <span>{count}</span>
                <Badge variant={project.enabled ? "outline" : "secondary"}>
                  {project.enabled ? "Active" : "Disabled"}
                </Badge>
                <span className="tabular-nums">{formatTokenQuota(total)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => startEdit(project)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Project
                    </DropdownMenuItem>
                    {project.enabled && (
                      <DropdownMenuItem onClick={() => createKey(project)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create API key
                      </DropdownMenuItem>
                    )}
                    {project.name !== "Default" && (
                      <DropdownMenuItem
                        onClick={() => {
                          setActionError("");
                          void mutateAsync({
                            url: "/rpc/update_api_key_project",
                            method: "post",
                            values: {
                              p_project_id: project.id,
                              p_enabled: !project.enabled,
                            },
                          })
                            .then(refresh)
                            .catch((cause) =>
                              setActionError(
                                cause instanceof Error
                                  ? cause.message
                                  : String(cause),
                              ),
                            );
                        }}
                      >
                        {project.enabled ? "Disable" : "Enable"}
                      </DropdownMenuItem>
                    )}
                    {project.name !== "Default" && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeletingProject(project)}
                      >
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
                      {project.enabled && (
                        <div>
                          <Button
                            variant="link"
                            onClick={() => createKey(project)}
                          >
                            Create API key
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[960px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="w-10" />
                            <th className="py-2">API key / description</th>
                            <th>Workspace</th>
                            <th>Status</th>
                            <th>Usage</th>
                            <th>Rate limit</th>
                            <th>Models</th>
                            <th>Created</th>
                            <th className="w-12" />
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((key) => {
                            const limits = key.spec.limits ?? {};
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
                                  <strong>{key.metadata.name}</strong>
                                  <div
                                    className="max-w-xs truncate text-xs text-muted-foreground"
                                    title={key.description}
                                  >
                                    {key.description || "No description"}
                                  </div>
                                </td>
                                <td>{key.metadata.workspace}</td>
                                <td>
                                  <Badge
                                    variant={
                                      limits.disabled
                                        ? "destructive"
                                        : "outline"
                                    }
                                  >
                                    {limits.disabled ? "Disabled" : "Active"}
                                  </Badge>
                                </td>
                                <td className="tabular-nums">
                                  {limits.token_quota?.limit
                                    ? `${formatTokenQuota(key.status?.usage ?? 0)} / ${formatTokenQuota(limits.token_quota.limit)}`
                                    : "Unlimited"}
                                </td>
                                <td>
                                  {rateSummary(limits).join(" · ") || "-"}
                                </td>
                                <td>
                                  {limits.allowed_models
                                    ?.map((m) => m.model)
                                    .join(", ") || "All"}
                                </td>
                                <td>
                                  <RelativeTimestamp
                                    timestamp={key.metadata.creation_timestamp}
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
                                        View and edit
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
                                        Move to Project
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              `Delete API key ${key.metadata.name}?`,
                                            )
                                          ) {
                                            const keyWorkspace =
                                              key.metadata.workspace;
                                            if (!keyWorkspace) {
                                              setActionError(
                                                "API key workspace is missing. Refresh and try again.",
                                              );
                                              return;
                                            }
                                            const [variables] =
                                              buildBatchDeleteVariables(
                                                [
                                                  {
                                                    original: {
                                                      metadata: {
                                                        ...key.metadata,
                                                        workspace: keyWorkspace,
                                                      },
                                                    },
                                                  },
                                                ],
                                                "api_keys",
                                                false,
                                              );
                                            if (variables)
                                              void deleteKey(variables).then(
                                                refresh,
                                              );
                                          }
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
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {groupsQuery.data[0]?.total_projects ?? 0} Projects, paged by complete
          group
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </ListPage>
  );
};
