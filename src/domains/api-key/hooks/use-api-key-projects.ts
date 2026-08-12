import { useCustomMutation, useInvalidate } from "@refinedev/core";
import { useCallback, useEffect, useState } from "react";
import type { ApiKey, Project, ProjectGroup } from "@/domains/api-key/types";

/**
 * Project data hooks for the grouped API key list.
 *
 * All reads are batched: api.group_projects returns every Project row for a
 * workspace together with its API key count and current-cycle usage in a
 * single RPC, and the list page pulls the keys themselves in one unpaginated
 * query — never one request per Project.
 */

// Refine's data provider rejects with an HttpError ({ message, statusCode });
// render its message (e.g. the RPC's RAISE EXCEPTION text) instead of the raw
// object when it leaks to a UI catch block.
export const rpcErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  const candidate = error as { message?: unknown };
  if (typeof candidate.message === "string" && candidate.message.length > 0) {
    return candidate.message;
  }
  return String(error);
};

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

type GroupProjectsRow = {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  status: "enabled" | "disabled";
  is_default: boolean;
  api_key_count?: number | string;
  usage_used?: number | string;
  usage_limit?: number | string;
};

type ProjectGroupState = {
  data: ProjectGroup[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

// Batched Project rows (count + current-cycle usage) via api.group_projects.
// A specific workspace narrows the query; undefined (all-workspaces view)
// returns every readable Project in the same single call.
export function useProjectGroups(
  workspace: string | undefined,
): ProjectGroupState {
  const { mutateAsync } = useCustomMutation();
  const [data, setData] = useState<ProjectGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mutateAsync({
        url: "/rpc/group_projects",
        method: "post",
        // undefined workspace (all-workspaces view) -> every Project the user
        // can read, still in one batched call.
        values: { p_workspace: workspace ?? null },
        errorNotification: false,
      });
      const rows = (res.data as GroupProjectsRow[] | null) ?? [];
      setData(
        rows.map((r) => ({
          id: r.id,
          workspace: r.workspace,
          name: r.name,
          description: r.description,
          status: r.status,
          is_default: Boolean(r.is_default),
          api_key_count: num(r.api_key_count),
          usage_used: num(r.usage_used),
          usage_limit: num(r.usage_limit),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [mutateAsync, workspace]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

type ProjectMutations = {
  create: (input: {
    workspace: string;
    name: string;
    description?: string | null;
  }) => Promise<Project>;
  update: (input: {
    projectId: string;
    name?: string;
    description?: string | null;
    status?: "enabled" | "disabled";
  }) => Promise<Project>;
  remove: (projectId: string) => Promise<void>;
};

// create_project / update_project / delete_project with a refresh of every
// list that derives from Projects or API keys.
export function useProjectMutations(): ProjectMutations {
  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();

  const refresh = useCallback(() => {
    void invalidate({ resource: "api_keys", invalidates: ["list"] });
    void invalidate({ resource: "projects", invalidates: ["list"] });
  }, [invalidate]);

  const create = useCallback(
    async (input: {
      workspace: string;
      name: string;
      description?: string | null;
    }): Promise<Project> => {
      const res = await mutateAsync({
        url: "/rpc/create_project",
        method: "post",
        values: {
          p_workspace: input.workspace,
          p_name: input.name.trim(),
          p_description: input.description?.trim() || null,
        },
        errorNotification: false,
      });
      refresh();
      return res.data as Project;
    },
    [mutateAsync, refresh],
  );

  const update = useCallback(
    async (input: {
      projectId: string;
      name?: string;
      description?: string | null;
      status?: "enabled" | "disabled";
    }): Promise<Project> => {
      const values: Record<string, unknown> = { p_project_id: input.projectId };
      if (input.name !== undefined) values.p_name = input.name.trim();
      if (input.description !== undefined) {
        values.p_description = input.description?.trim() || null;
      }
      if (input.status !== undefined) values.p_status = input.status;
      const res = await mutateAsync({
        url: "/rpc/update_project",
        method: "post",
        values,
        errorNotification: false,
      });
      refresh();
      return res.data as Project;
    },
    [mutateAsync, refresh],
  );

  const remove = useCallback(
    async (projectId: string): Promise<void> => {
      await mutateAsync({
        url: "/rpc/delete_project",
        method: "post",
        values: { p_project_id: projectId },
        errorNotification: false,
      });
      refresh();
    },
    [mutateAsync, refresh],
  );

  return { create, update, remove };
}

// Single- or batch-migrate API keys to another Project. The backend rejects
// the whole batch on any name conflict and reports the conflicting names.
export function useMigrateApiKeys() {
  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();

  const migrate = useCallback(
    async (apiKeyIds: string[], projectId: string): Promise<ApiKey[]> => {
      const res = await mutateAsync({
        url: "/rpc/migrate_api_keys",
        method: "post",
        values: {
          p_api_key_ids: apiKeyIds,
          p_project_id: projectId,
        },
        errorNotification: false,
      });
      void invalidate({ resource: "api_keys", invalidates: ["list"] });
      void invalidate({ resource: "projects", invalidates: ["list"] });
      return (res.data as ApiKey[] | null) ?? [];
    },
    [mutateAsync, invalidate],
  );

  return { migrate };
}
