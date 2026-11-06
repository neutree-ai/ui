import { useList } from "@refinedev/core";
import { useMemo } from "react";
import { LIST_POLL_QUERY_OPTIONS } from "@/foundation/lib/constant";
import {
  type ExternalModelSourceSpec,
  type ModelSource,
  modelSourceRank,
  resolveExternalModelSource,
  SELF_HOSTED_MODEL_SOURCE,
} from "@/foundation/lib/model-source";

// A model name is an identity the engine reports and the gateway matches
// exactly, so it is returned verbatim, surrounding whitespace included. Only a
// blank name is not a name.
export function nonBlankModelName(raw: unknown): string | undefined {
  const name = String(raw ?? "");
  return name.trim() ? name : undefined;
}

export type WorkspaceModelOption = {
  value: string;
  label: string;
  model: string;
  endpointName: string;
  // The endpoint kind. Still the half of the allowlist triple that is written
  // to the API, and still what `value` is keyed on, even though it is no longer
  // shown as a badge — `source` displays instead.
  type: "internal" | "external";
  // The displayed source. Self-deployed for every internal endpoint; resolved
  // per model from the external endpoint's spec otherwise, and `undefined` when
  // that yields none.
  source: ModelSource | undefined;
  phase: string | null;
  /** The endpoint's workspace; tells rows apart when listing every workspace. */
  workspace?: string;
};

type WorkspaceEndpointRef = {
  metadata?: {
    name?: string | null;
    workspace?: string | null;
    deletion_timestamp?: string | null;
  } | null;
  status?: { phase?: string | null; served_models?: string[] | null } | null;
};

type WorkspaceExternalEndpointRef = {
  metadata?: {
    name?: string | null;
    workspace?: string | null;
    deletion_timestamp?: string | null;
    labels?: Record<string, string> | null;
  } | null;
  spec?: ExternalModelSourceSpec;
  status?: { phase?: string | null } | null;
};

export function isWorkspaceEndpointUnavailable(endpoint: {
  metadata?: { deletion_timestamp?: string | null } | null;
  status?: { phase?: string | null } | null;
}): boolean {
  return (
    Boolean(endpoint.metadata?.deletion_timestamp) ||
    endpoint.status?.phase === "Deleting" ||
    endpoint.status?.phase === "Deleted"
  );
}

export const modelOptionValue = (
  type: WorkspaceModelOption["type"],
  endpointName: string,
  model: string,
) => `${type}:${endpointName}:${model}`;

function exposedExternalModels(
  spec: WorkspaceExternalEndpointRef["spec"],
): string[] {
  if (!spec?.upstreams) return [];
  if (spec.model_routes?.length) {
    return spec.model_routes
      .map((route) => route.model)
      .filter((model): model is string => Boolean(model));
  }
  return spec.upstreams.flatMap((upstream) =>
    upstream.model_mapping ? Object.keys(upstream.model_mapping) : [],
  );
}

// Order the allowed-models options: source is the primary grouping, so the
// picker can render one contiguous section per source and the cost profile of
// a model is visible before anything else. Within a source, serving endpoints
// come first (usable models at the top of their section), then a stable
// alphabetical order (model, endpoint). A Degraded external endpoint is still
// serving, so its models rank with the Running ones.
//
// An internal endpoint and an external one fronting a self-hosted model share
// a section; the endpoint name on each row is what tells them apart.
export function compareWorkspaceModelOptions(
  a: WorkspaceModelOption,
  b: WorkspaceModelOption,
): number {
  const runningRank = (phase: string | null) =>
    phase === "Running" || phase === "Degraded" ? 0 : 1;
  return (
    modelSourceRank(a.source) - modelSourceRank(b.source) ||
    (a.source ?? "").localeCompare(b.source ?? "") ||
    runningRank(a.phase) - runningRank(b.phase) ||
    a.model.localeCompare(b.model) ||
    a.endpointName.localeCompare(b.endpointName) ||
    (a.workspace ?? "").localeCompare(b.workspace ?? "")
  );
}

// Available client-facing models in a workspace, or in every readable one for
// ALL_WORKSPACES (for the allowed-models dropdown). Options are endpoint-level rows so duplicate model names served by
// different internal/external endpoints remain visually distinct in the picker.
// An internal endpoint contributes the first name the engine reports, since the
// workspace model list exposes one candidate per endpoint.
export function useWorkspaceModels(
  workspace: string | undefined,
): WorkspaceModelOption[] {
  const enabled = Boolean(workspace);
  const { data: endpointsData } = useList<WorkspaceEndpointRef>({
    resource: "endpoints",
    pagination: { mode: "off" },
    meta: { workspace, workspaced: true },
    queryOptions: { enabled, ...LIST_POLL_QUERY_OPTIONS },
  });
  const { data: externalEndpointsData } = useList<WorkspaceExternalEndpointRef>(
    {
      resource: "external_endpoints",
      pagination: { mode: "off" },
      meta: { workspace, workspaced: true },
      queryOptions: { enabled, ...LIST_POLL_QUERY_OPTIONS },
    },
  );

  return useMemo(() => {
    if (!workspace) return [];
    const options: WorkspaceModelOption[] = [];

    for (const endpoint of endpointsData?.data ?? []) {
      if (isWorkspaceEndpointUnavailable(endpoint)) continue;
      const model = nonBlankModelName(endpoint.status?.served_models?.[0]);
      const endpointName = String(endpoint.metadata?.name ?? "").trim();
      if (model === undefined || !endpointName) continue;
      options.push({
        value: modelOptionValue("internal", endpointName, model),
        label: model,
        model,
        endpointName,
        type: "internal",
        source: SELF_HOSTED_MODEL_SOURCE,
        phase: endpoint.status?.phase ?? null,
        workspace: endpoint.metadata?.workspace ?? undefined,
      });
    }

    for (const endpoint of externalEndpointsData?.data ?? []) {
      if (isWorkspaceEndpointUnavailable(endpoint)) continue;
      const endpointName = String(endpoint.metadata?.name ?? "").trim();
      if (!endpointName) continue;
      for (const model of exposedExternalModels(endpoint.spec)) {
        const name = nonBlankModelName(model);
        if (name === undefined) continue;
        options.push({
          value: modelOptionValue("external", endpointName, name),
          label: name,
          model: name,
          endpointName,
          type: "external",
          // Resolved per model, not once per endpoint: two models of one
          // endpoint can genuinely have different sources.
          source: resolveExternalModelSource(endpoint.spec, name),
          phase: endpoint.status?.phase ?? null,
          workspace: endpoint.metadata?.workspace ?? undefined,
        });
      }
    }

    return options.sort(compareWorkspaceModelOptions);
  }, [endpointsData?.data, externalEndpointsData?.data, workspace]);
}
