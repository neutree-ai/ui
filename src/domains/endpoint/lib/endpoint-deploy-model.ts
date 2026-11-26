import type { EngineCacheArgs } from "@/domains/endpoint/lib/engine-cache-args";
import type { ModelSpec } from "@/domains/endpoint/types";
import type { RecipeVariant } from "@/foundation/recipe/types";
import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * A resolved model as its read-only summary shows it: registry, name, and
 * "version · file" with an empty version shown as `autoVersion`.
 */
export const resolvedModelSummary = (
  model: Pick<ModelSpec, "registry" | "name" | "version" | "file">,
  autoVersion: string,
) => ({
  registry: model.registry,
  name: model.name,
  versionFile: [model.version || autoVersion, model.file]
    .filter(Boolean)
    .join(" · "),
});

/** The registry a recipe variant pins its model to, or null when it does not. */
export const variantRegistry = (variant: RecipeVariant) =>
  variant.model?.registry || null;

/**
 * Which extra estimate inputs a checkpoint calls for, each keyed on what the
 * checkpoint states: linear-attention layers, a sparse-attention indexer
 * (compress ratio 4), and draft modules (MTP layers, or more compress ratios
 * than hidden layers).
 */
export const kvCacheEstimateInputs = (info: ModelInfo) => ({
  linearAttention: (info.layer_types ?? []).includes("linear_attention"),
  indexer: (info.compress_ratios ?? []).includes(4),
  draftModules:
    Boolean(info.mtp_num_layers) ||
    (info.compress_ratios ?? []).length > (info.num_hidden_layers ?? 0),
});

/**
 * The context length the estimate starts from: the engine args first, then
 * the checkpoint's maximum, else null rather than an invented count.
 */
export const defaultEstimateTokens = (
  engineArgs: EngineCacheArgs,
  info: ModelInfo,
) => engineArgs.maxModelLen ?? info.max_position_embeddings ?? null;
