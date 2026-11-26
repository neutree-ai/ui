import type { TFunction } from "i18next";
import { apiKeyLabelParts } from "@/domains/api-key/lib/api-key-label";
import type {
  AllowedModel,
  ApiKey,
  ApiKeyLimits,
} from "@/domains/api-key/types";
import { modelSourceOfEndpointKind } from "@/foundation/model-reference/model-source";

/** A key is gone once its deletion has started. */
const isApiKeyDeleted = (key: ApiKey) =>
  Boolean(key.metadata?.deletion_timestamp);

/** A disabled key is refused by the gateway, whatever its lifecycle phase. */
const isApiKeyDisabled = (key: ApiKey) => Boolean(key.spec.limits?.disabled);

/**
 * A key row in a key table: the label rule's name and description, and the
 * workspace (null when missing).
 */
export function apiKeyRowView(key: ApiKey) {
  const { primary, description } = apiKeyLabelParts({
    name: key.metadata.name,
    displayName: key.metadata.display_name,
    description: key.spec.description,
  });
  return {
    name: primary,
    description,
    workspace: key.metadata.workspace || null,
  };
}

/**
 * The key's status badge: disabled first, then an exceeded overall quota,
 * else active. `alert` marks the two that need attention.
 */
export function apiKeyStatus(key: ApiKey, t: TFunction, quotaExceeded = false) {
  const disabled = isApiKeyDisabled(key);
  return {
    disabled,
    alert: disabled || quotaExceeded,
    label: disabled
      ? t("api_keys.limits.statusDisabled")
      : quotaExceeded
        ? t("api_keys.limits.statusQuotaExceeded")
        : t("api_keys.limits.statusActive"),
  };
}

/**
 * The live keys of `scopedWorkspace` (undefined: every workspace) as the
 * ranking names them, falling back to the key id.
 */
export const rankingKeys = (keys: ApiKey[], scopedWorkspace?: string) =>
  keys
    .filter(
      (key) =>
        !isApiKeyDeleted(key) &&
        (scopedWorkspace === undefined ||
          key.metadata.workspace === scopedWorkspace),
    )
    .map((key) => ({
      id: String(key.id),
      name: apiKeyRowView(key).name || String(key.id),
      description: key.spec.description,
    }));

/** Live keys, newest first. */
export const liveKeysNewestFirst = (keys: ApiKey[]) =>
  keys
    .filter((key) => !isApiKeyDeleted(key))
    .sort((a, b) =>
      String(b.metadata.creation_timestamp ?? "").localeCompare(
        String(a.metadata.creation_timestamp ?? ""),
      ),
    );

/** The distinct workspaces of `keys`; a move needs exactly one. */
export const keyWorkspaces = (keys: ApiKey[]) => [
  ...new Set(
    keys
      .map((key) => key.metadata.workspace)
      .filter((value): value is string => Boolean(value)),
  ),
];

/** A delete needs each key's workspace. */
export const everyKeyHasWorkspace = (keys: ApiKey[]) =>
  keys.every((key) => Boolean(key.metadata.workspace));

/** The rows `buildBatchDeleteVariables` reads to delete `keys`. */
export const apiKeyDeleteRows = (keys: ApiKey[]) =>
  keys.map((key) => ({
    original: {
      metadata: {
        ...key.metadata,
        workspace: key.metadata.workspace ?? undefined,
      },
    },
  }));

/** The key's overall token quota with its period (monthly when unset), or null without an amount. */
export function overallTokenQuota(limits: ApiKeyLimits | null | undefined) {
  const quota = limits?.token_quota;
  if (!quota?.limit) return null;
  return { limit: quota.limit, period: quota.period ?? "monthly" };
}

type ServedEndpoint = { name: string; type: string; source?: string };

/**
 * An allowed-model entry as the list's Models column shows it. A pinned entry
 * names its endpoint and, when the workspace still serves it, that endpoint;
 * without the endpoint its source falls back to the one its type implies.
 */
export function allowedModelView<E extends ServedEndpoint>(
  model: AllowedModel,
  modelMap: Map<string, { endpoints: E[] }>,
  index: number,
) {
  const pinned = Boolean(model.type && model.endpoint_name);
  const endpoint = pinned
    ? modelMap
        .get(model.model)
        ?.endpoints.find(
          (item) =>
            item.name === model.endpoint_name && item.type === model.type,
        )
    : undefined;
  return {
    key: `${model.type ?? ""}:${model.endpoint_name ?? ""}:${model.model}:${index}`,
    model: model.model,
    endpointName: pinned ? (model.endpoint_name ?? null) : null,
    endpoint,
    source: endpoint
      ? endpoint.source
      : model.type
        ? modelSourceOfEndpointKind(model.type)
        : undefined,
  };
}
