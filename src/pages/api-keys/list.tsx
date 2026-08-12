import { useInvalidate, useList, useNavigation } from "@refinedev/core";
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  KeyRound,
  Loader,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DropdownMenuSeparator,
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
import { ApiKeyRankingOverview } from "@/domains/api-key/components/ApiKeyRankingOverview";
import { CreateApiKeyForm } from "@/domains/api-key/components/CreateApiKeyForm";
import {
  type MigrateKeyRow,
  MigrateApiKeysDialog,
} from "@/domains/api-key/components/MigrateApiKeysDialog";
import { ProjectFormDialog } from "@/domains/api-key/components/ProjectFormDialog";
import {
  rateSummary,
  rpcErrorMessage,
  useAllApiKeyTraffic,
  useAllApiKeyUsage,
  useApiKeyDisable,
  useWorkspaceModelMap,
} from "@/domains/api-key/hooks/use-api-key-policy";
import {
  useProjectGroups,
  useProjectMutations,
} from "@/domains/api-key/hooks/use-api-key-projects";
import type { ApiKey, ApiKeyLimits, Project, ProjectGroup } from "@/domains/api-key/types";
import { ListPage } from "@/foundation/components/ListPage";
import Timestamp from "@/foundation/components/Timestamp";
import { RowAction, Table } from "@/foundation/components/Table";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { DeleteProvider } from "@/foundation/providers/delete-provider";

const fmt = (n: number) => Number(n).toLocaleString();
const PAGE_SIZE = 10;

type Group = {
  project: ProjectGroup;
  keys: ApiKey[];
};

const dash = <span className="text-muted-foreground">—</span>;

// A key is disabled when its limits carry the disabled flag; otherwise it is
// enabled unless it has exhausted its current quota.
const isKeyDisabled = (key: ApiKey): boolean =>
  Boolean((key.spec?.limits as ApiKeyLimits | undefined)?.disabled);

export const ApiKeysList = () => {
  const { t } = useTranslation();
  const { show } = useNavigation();
  const invalidate = useInvalidate();
  const refresh = useCallback(
    () => invalidate({ resource: "api_keys", invalidates: ["list"] }),
    [invalidate],
  );

  const { current: workspace } = useWorkspace();
  const scopedWorkspace =
    workspace === ALL_WORKSPACES ? undefined : workspace;

  // ---- bulk data (no per-project requests) ----
  const { data: keysData } = useList<ApiKey>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace, workspaced: true },
    queryOptions: { enabled: Boolean(workspace) },
  });
  const { data: allProjectsData } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
    queryOptions: { enabled: Boolean(workspace) },
  });
  const {
    data: groupedProjects,
    loading: groupsLoading,
    refetch: refetchGroups,
  } = useProjectGroups(scopedWorkspace);

  const usageByKey = useAllApiKeyUsage(scopedWorkspace);
  const trafficByKey = useAllApiKeyTraffic(scopedWorkspace);
  const modelMap = useWorkspaceModelMap(scopedWorkspace);
  const { disable, enable } = useApiKeyDisable();
  const { update: updateProject, remove: deleteProject } =
    useProjectMutations();

  const allKeys = useMemo(
    () => (keysData?.data ?? []).filter((k) => !k.metadata.deletion_timestamp),
    [keysData],
  );

  // Projects with aggregates: from the batched RPC when scoped; computed
  // client-side (counts only) in the all-workspaces view.
  const projects: ProjectGroup[] = useMemo(() => {
    if (scopedWorkspace) return groupedProjects;
    const counts = new Map<string, number>();
    for (const k of allKeys) {
      counts.set(String(k.project_id), (counts.get(String(k.project_id)) ?? 0) + 1);
    }
    return (allProjectsData?.data ?? []).map((p) => ({
      ...p,
      api_key_count: counts.get(String(p.id)) ?? 0,
    }));
  }, [scopedWorkspace, groupedProjects, allProjectsData, allKeys]);

  const projectById = useMemo(
    () => new Map(projects.map((p) => [String(p.id), p])),
    [projects],
  );

  // Group keys under their Project, preserving the Project order from the
  // batched query (Default first). One bulk key query, no N+1.
  const groups: Group[] = useMemo(() => {
    const byProject = new Map<string, ApiKey[]>();
    for (const k of allKeys) {
      const list = byProject.get(String(k.project_id)) ?? [];
      list.push(k);
      byProject.set(String(k.project_id), list);
    }
    return projects.map((project) => ({
      project,
      keys: (byProject.get(String(project.id)) ?? []).sort((a, b) =>
        String(b.metadata.creation_timestamp ?? "").localeCompare(
          String(a.metadata.creation_timestamp ?? ""),
        ),
      ),
    }));
  }, [projects, allKeys]);

  const rankingKeys = useMemo(
    () =>
      allKeys
        .filter(
          (k) =>
            workspace === ALL_WORKSPACES ||
            k.metadata?.workspace === workspace,
        )
        .map((k) => ({
          id: String(k.id),
          name: k.metadata?.name ?? String(k.id),
        })),
    [allKeys, workspace],
  );

  // ---- search / filter (client-side; keys are already fully loaded) ----
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState(searchRaw);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchRaw), 300);
    return () => clearTimeout(timer);
  }, [searchRaw]);
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");

  const filtering = search.trim().length > 0 || statusFilter !== "all";

  const visibleGroups = useMemo(() => {
    if (!filtering) return groups;
    const q = search.trim().toLowerCase();
    return groups.flatMap((g): Group[] => {
      const projectHit =
        q.length > 0 &&
        (g.project.name.toLowerCase().includes(q) ||
          (g.project.description ?? "").toLowerCase().includes(q));
      if (projectHit) {
        const keys =
          statusFilter === "all"
            ? g.keys
            : g.keys.filter(
                (k) => isKeyDisabled(k) === (statusFilter === "disabled"),
              );
        return [{ ...g, keys }];
      }
      const keys = g.keys.filter((k) => {
        if (statusFilter !== "all" && isKeyDisabled(k) !== (statusFilter === "disabled")) {
          return false;
        }
        if (!q) return true;
        return (
          k.metadata.name.toLowerCase().includes(q) ||
          (k.description ?? "").toLowerCase().includes(q) ||
          (k.metadata.workspace ?? "").toLowerCase().includes(q)
        );
      });
      return keys.length > 0 ? [{ ...g, keys }] : [];
    });
  }, [groups, filtering, search, statusFilter]);

  const groupsKey = useMemo(
    () => visibleGroups.map((g) => String(g.project.id)).join("|"),
    [visibleGroups],
  );

  // ---- expand/collapse ----
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    // Auto-expand matching Projects while filtering; default back to the
    // first (Default) Project expanded when the view is cleared.
    setExpanded(
      filtering
        ? new Set(visibleGroups.map((g) => String(g.project.id)))
        : visibleGroups.length > 0
          ? new Set([String(visibleGroups[0].project.id)])
          : new Set(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsKey, filtering]);

  const toggleProject = (projectId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  // ---- pagination over Projects (keys never split across pages) ----
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [groupsKey]);
  const pageCount = Math.max(1, Math.ceil(visibleGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageGroups = visibleGroups.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // ---- dialogs / selection ----
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [createKeyPreset, setCreateKeyPreset] = useState<{
    workspace?: string;
    projectId?: string;
  }>({});
  const [projectDialog, setProjectDialog] = useState<{
    open: boolean;
    project: Project | null;
  }>({ open: false, project: null });
  const [migrateDialog, setMigrateDialog] = useState<{
    open: boolean;
    keys: MigrateKeyRow[];
  }>({ open: false, keys: [] });
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(
    null,
  );
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(
    null,
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (keyId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  const selectedKeys = useMemo(
    () => allKeys.filter((k) => selected.has(String(k.id))),
    [allKeys, selected],
  );

  const openMigrate = (keys: ApiKey[]) => {
    if (keys.length === 0) return;
    if (!scopedWorkspace) {
      toast.error(t("projects.migrateRequiresWorkspace"));
      return;
    }
    setMigrateDialog({
      open: true,
      keys: keys.map((k) => ({
        id: String(k.id),
        name: k.metadata.name,
        projectId: k.project_id ? String(k.project_id) : null,
        projectName: k.project_id
          ? (projectById.get(String(k.project_id))?.name ?? "Default")
          : "Default",
      })),
    });
  };

  const handleMigrated = (targetProjectId: string) => {
    setSelected(new Set());
    setExpanded((prev) => new Set(prev).add(targetProjectId));
    void refetchGroups();
  };

  const handleProjectSaved = () => {
    void refetchGroups();
  };

  const handleProjectDelete = async () => {
    if (!deleteProjectTarget || deletingProject) return;
    setDeletingProject(true);
    setDeleteProjectError(null);
    try {
      await deleteProject(deleteProjectTarget.id);
      toast.success(t("projects.deleted"));
      setDeleteProjectTarget(null);
      void refetchGroups();
    } catch (e) {
      setDeleteProjectError(rpcErrorMessage(e));
    } finally {
      setDeletingProject(false);
    }
  };

  const toggleKeyDisabled = async (key: ApiKey) => {
    const id = String(key.id);
    try {
      if (isKeyDisabled(key)) await enable(id);
      else await disable(id);
      refresh();
      void refetchGroups();
    } catch {
      // keep the row unchanged; the server message is surfaced by the RPC
    }
  };

  const limitsOf = (key: ApiKey): ApiKeyLimits =>
    (key.spec?.limits as ApiKeyLimits | undefined) ?? {};

  const loading = Boolean(workspace) && (keysData === undefined || groupsLoading);

  return (
    <DeleteProvider>
      <ListPage
        createButtonProps={{
          onClick: () => {
            setCreateKeyPreset({});
            setCreateKeyOpen(true);
          },
        }}
      >
        <div className="mb-4">
          <ApiKeyRankingOverview keys={rankingKeys} traffic={trafficByKey} />
        </div>

        {/* Toolbar: search + status filter + create project */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchRaw}
              onChange={(event) => setSearchRaw(event.target.value)}
              placeholder={t("projects.searchPlaceholder")}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as "all" | "enabled" | "disabled")
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("projects.filterAll")}</SelectItem>
              <SelectItem value="enabled">{t("projects.filterEnabled")}</SelectItem>
              <SelectItem value="disabled">{t("projects.filterDisabled")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setProjectDialog({ open: true, project: null });
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("projects.createTitle")}
          </Button>
        </div>

        {/* Batch operations bar */}
        {selected.size > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">
              {t("projects.selectedKeys", { count: selected.size })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => openMigrate(selectedKeys)}
                disabled={selectedKeys.length === 0}
              >
                {t("projects.migrateButton")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                <X className="mr-1 h-4 w-4" />
                {t("buttons.cancel")}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : pageGroups.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-md border text-sm text-muted-foreground">
            {filtering
              ? t("projects.noResults")
              : projects.length === 0
                ? t("projects.noProjects")
                : t("projects.noKeys")}
          </div>
        ) : (
          <div className="space-y-3">
            {pageGroups.map((group) => {
              const isOpen = expanded.has(String(group.project.id));
              const { project } = group;
              const projectUsage =
                project.usage_used !== undefined && project.usage_limit !== undefined
                  ? project.usage_used
                  : undefined;
              return (
                <div
                  key={String(project.id)}
                  className="overflow-hidden rounded-md border"
                >
                  {/* Project row */}
                  <div
                    className="flex cursor-pointer items-center gap-3 border-b bg-muted/30 px-3 py-2.5"
                    onClick={() => toggleProject(String(project.id))}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="truncate font-medium">{project.name}</span>
                      {project.description && (
                        <span
                          className="hidden min-w-0 max-w-64 truncate text-xs text-muted-foreground sm:block"
                          title={project.description}
                        >
                          {project.description}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 font-normal">
                      {t("projects.keys", { count: project.api_key_count ?? group.keys.length })}
                    </Badge>
                    {project.status === "disabled" ? (
                      <Badge variant="secondary" className="shrink-0 font-normal">
                        {t("projects.statusDisabled")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 font-normal text-green-700">
                        {t("projects.statusEnabled")}
                      </Badge>
                    )}
                    <div className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {projectUsage !== undefined && project.usage_limit
                        ? `${fmt(projectUsage)} / ${fmt(project.usage_limit)}`
                        : projectUsage !== undefined
                          ? fmt(projectUsage)
                          : dash}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation();
                            setProjectDialog({ open: true, project });
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          {t("buttons.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation();
                            setCreateKeyPreset({
                              workspace: project.workspace,
                              projectId: project.id,
                            });
                            setCreateKeyOpen(true);
                          }}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          {t("projects.createKey")}
                        </DropdownMenuItem>
                        {!project.is_default && (
                          <>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation();
                                void updateProject({
                                  projectId: project.id,
                                  status:
                                    project.status === "enabled"
                                      ? "disabled"
                                      : "enabled",
                                }).then(() => void refetchGroups());
                              }}
                            >
                              {project.status === "enabled" ? (
                                <PowerOff className="mr-2 h-4 w-4" />
                              ) : (
                                <Power className="mr-2 h-4 w-4" />
                              )}
                              {project.status === "enabled"
                                ? t("api_keys.limits.disable")
                                : t("api_keys.limits.enable")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteProjectTarget(project);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("buttons.delete")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* API key sub-table */}
                  {isOpen && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/20 text-left text-xs text-muted-foreground">
                            <th className="w-10 px-3 py-2">
                              <Checkbox
                                checked={
                                  group.keys.length > 0 &&
                                  group.keys.every((k) => selected.has(String(k.id)))
                                }
                                onCheckedChange={(checked) => {
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    for (const k of group.keys) {
                                      if (checked) next.add(String(k.id));
                                      else next.delete(String(k.id));
                                    }
                                    return next;
                                  });
                                }}
                                aria-label={t("table.selectAll")}
                              />
                            </th>
                            <th className="min-w-44 px-3 py-2 font-medium">
                              {t("common.fields.name")}
                            </th>
                            <th className="px-3 py-2 font-medium">
                              {t("common.fields.workspace")}
                            </th>
                            <th className="px-3 py-2 font-medium">
                              {t("api_keys.limits.statusColumn")}
                            </th>
                            <th className="px-3 py-2 font-medium">
                              {t("api_keys.limits.usageColumn")}
                            </th>
                            <th className="px-3 py-2 font-medium">
                              {t("api_keys.limits.rateColumn")}
                            </th>
                            <th className="px-3 py-2 font-medium">
                              {t("api_keys.limits.modelsColumn")}
                            </th>
                            <th className="px-3 py-2 font-medium">
                              {t("common.fields.createdAt")}
                            </th>
                            <th className="w-24 px-3 py-2 font-medium"> </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.keys.length === 0 && (
                            <tr>
                              <td
                                colSpan={9}
                                className="px-3 py-6 text-center text-sm text-muted-foreground"
                              >
                                {t("projects.noKeys")}
                              </td>
                            </tr>
                          )}
                          {group.keys.map((key) => {
                            const limits = limitsOf(key);
                            const disabled = isKeyDisabled(key);
                            const usage = usageByKey.get(String(key.id));
                            const quotaExceeded =
                              usage && usage.token_limit > 0 && usage.used >= usage.token_limit;
                            const models = limits.allowed_models ?? [];
                            return (
                              <tr key={String(key.id)}>
                                <td className="px-3 py-2">
                                  <Checkbox
                                    checked={selected.has(String(key.id))}
                                    onCheckedChange={() => toggleSelect(String(key.id))}
                                    aria-label={t("table.selectRow")}
                                  />
                                </td>
                                <td className="min-w-44 px-3 py-2">
                                  <div className="font-medium">{key.metadata.name}</div>
                                  {key.description && (
                                    <div
                                      className="max-w-64 truncate text-xs text-muted-foreground"
                                      title={key.description}
                                    >
                                      {key.description}
                                    </div>
                                  )}
                                </td>
                                <td className="max-w-40 truncate px-3 py-2 text-xs text-muted-foreground" title={key.metadata.workspace ?? undefined}>
                                  {key.metadata.workspace}
                                </td>
                                <td className="px-3 py-2">
                                  {disabled ? (
                                    <Badge variant="destructive">
                                      {t("api_keys.limits.statusDisabled")}
                                    </Badge>
                                  ) : quotaExceeded ? (
                                    <Badge variant="destructive">
                                      {t("api_keys.limits.statusQuotaExceeded")}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">
                                      {t("api_keys.limits.statusActive")}
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {usage && usage.token_limit > 0 ? (
                                    <div className="flex w-36 flex-col gap-1">
                                      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                                        <span>
                                          {fmt(usage.used)} / {fmt(usage.token_limit)}
                                        </span>
                                        <span>{Math.round(Math.min(100, (usage.used / usage.token_limit) * 100))}%</span>
                                      </div>
                                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
                                        <div
                                          className={cn(
                                            "h-full",
                                            quotaExceeded
                                              ? "bg-destructive"
                                              : usage.used / usage.token_limit >= 0.8
                                                ? "bg-amber-500"
                                                : "bg-primary",
                                          )}
                                          style={{
                                            width: `${Math.min(100, (usage.used / usage.token_limit) * 100)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    dash
                                  )}
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                  {rateSummary(limits).length > 0
                                    ? rateSummary(limits).join(" · ")
                                    : dash}
                                </td>
                                <td className="max-w-52 px-3 py-2 text-xs">
                                  {models.length === 0 ? (
                                    <span className="text-muted-foreground">
                                      {t("api_keys.limits.allModels")}
                                    </span>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      {models.map((m) => {
                                        const info = modelMap.get(m);
                                        return (
                                          <div key={m} className="flex items-center gap-1">
                                            <span className="max-w-36 truncate font-medium" title={m}>
                                              {m}
                                            </span>
                                            {info?.internal && (
                                              <Badge variant="outline" className="font-normal">
                                                {t("api_keys.models.internal")}
                                              </Badge>
                                            )}
                                            {info?.external && (
                                              <Badge variant="outline" className="font-normal">
                                                {t("api_keys.models.external")}
                                              </Badge>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                  <Timestamp timestamp={key.metadata.creation_timestamp} />
                                </td>
                                <td className="px-3 py-2">
                                  <Table.Actions>
                                    <RowAction
                                      title={t("buttons.edit")}
                                      icon={<Pencil size={16} />}
                                      onClick={() => {
                                        if (key.metadata?.name) {
                                          show("api_keys", key.metadata.name, "push", {
                                            workspace: key.metadata.workspace,
                                          });
                                        }
                                      }}
                                    />
                                    <RowAction
                                      title={
                                        disabled
                                          ? t("api_keys.limits.enable")
                                          : t("api_keys.limits.disable")
                                      }
                                      icon={
                                        disabled ? <Power size={16} /> : <PowerOff size={16} />
                                      }
                                      onClick={() => void toggleKeyDisabled(key)}
                                    />
                                    <RowAction
                                      title={t("projects.migrate")}
                                      icon={<FolderKanban size={16} />}
                                      onClick={() => openMigrate([key])}
                                    />
                                    <Table.DeleteAction
                                      title={t("buttons.delete")}
                                      row={key}
                                      resource="api_keys"
                                      icon={<Trash2 size={16} />}
                                    />
                                  </Table.Actions>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Project pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-end gap-2 pt-1 text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground">
                  {safePage} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Create API key dialog */}
        <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("api_keys.create")}</DialogTitle>
              <DialogDescription>
                {t("api_keys.messages.createDescription")}
              </DialogDescription>
            </DialogHeader>
            <CreateApiKeyForm
              onClose={() => {
                setCreateKeyOpen(false);
                void refetchGroups();
              }}
              initialWorkspace={createKeyPreset.workspace}
              initialProjectId={createKeyPreset.projectId}
            />
          </DialogContent>
        </Dialog>

        {/* Project create/edit dialog */}
        <ProjectFormDialog
          open={projectDialog.open}
          onOpenChange={(open) => setProjectDialog((p) => ({ ...p, open }))}
          workspace={scopedWorkspace}
          project={projectDialog.project}
          onSaved={handleProjectSaved}
        />

        {/* Migration dialog */}
        <MigrateApiKeysDialog
          open={migrateDialog.open}
          onOpenChange={(open) => setMigrateDialog((m) => ({ ...m, open }))}
          workspace={scopedWorkspace ?? ""}
          projects={projects}
          keys={migrateDialog.keys}
          onMigrated={handleMigrated}
        />

        {/* Delete project confirmation */}
        <AlertDialog
          open={Boolean(deleteProjectTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteProjectTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("projects.deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("projects.deleteDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteProjectError && (
              <p className="text-sm text-destructive">{deleteProjectError}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingProject}>
                {t("buttons.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deletingProject}
                onClick={(event) => {
                  event.preventDefault();
                  void handleProjectDelete();
                }}
              >
                {deletingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("projects.deleteConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ListPage>
    </DeleteProvider>
  );
};
