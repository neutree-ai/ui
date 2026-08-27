import { KVCacheEstimate } from "@/domains/endpoint/components/KVCacheEstimate";
import type { EngineCacheArgs } from "@/domains/endpoint/lib/engine-cache-args";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelInfoRead } from "@/foundation/lib/model-info-read";
import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * What this deployment is expected to weigh, in one place for both ways of
 * getting here.
 *
 * Two halves that answer different questions and must not read as one number:
 *
 *   - what the catalog *declares* — a figure its author measured, multiplied
 *     out by the replica count, plus what the checkpoint says about itself;
 *   - what the KV cache *works out to* — computed here from the checkpoint and
 *     from the context and concurrency this deployment will run with.
 *
 * Deploying without a catalog has only the second, so the first is absent
 * rather than empty. An engine that serves a model baked into its own image
 * has no checkpoint to compute from and gets no estimator, but a catalog can
 * still declare what it needs — the declared figure is about hardware, not
 * about which engine reads the weights.
 */

type Declared = {
  /** Per replica, as the catalog states it. Null when it states none. */
  perReplicaGb: number | null;
  replicas: number;
  /** What the checkpoint states about itself, as the catalog carries it. */
  info: ModelInfo | null;
};

type KvCache = {
  read: ModelInfoRead;
  engineArgs: EngineCacheArgs;
  /**
   * Identity of the model being estimated. The estimator's inputs derive their
   * defaults from the checkpoint, so it is remounted when the checkpoint
   * changes — carrying the previous model's context length into the next
   * model's estimate would look like a value read from it.
   *
   * Applied here rather than to the whole section, so switching profile does
   * not also rebuild the declared half beside it.
   */
  modelKey: string;
};

export const EndpointWeightsEstimate = ({
  declared,
  kvCache,
}: {
  declared: Declared | null;
  kvCache: KvCache | null;
}) => {
  const { t } = useTranslation();

  const facts = declared ? modelFacts(declared.info) : [];
  const totalGb =
    declared?.perReplicaGb != null
      ? declared.perReplicaGb * declared.replicas
      : null;
  const showsDeclared = totalGb != null || facts.length > 0;

  if (!showsDeclared && !kvCache) return null;

  return (
    <div className="space-y-3" data-testid="endpoint-weights-estimate">
      {showsDeclared && (
        <div
          className="rounded-lg border bg-muted/20 p-3"
          data-testid="endpoint-declared-weights"
        >
          <div className="mb-2 text-sm font-medium">
            {t("endpoints.weights.declared")}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {totalGb != null && declared && (
              <Fact
                label={t("endpoints.recipe.estimatedVram")}
                value={`≈ ${totalGb} GB`}
              >
                {t("endpoints.weights.perReplica", {
                  gb: declared.perReplicaGb,
                  count: declared.replicas,
                })}
              </Fact>
            )}
            {facts.map((fact) => (
              <Fact key={fact.key} label={t(fact.key)} value={fact.value} />
            ))}
          </div>
        </div>
      )}
      {kvCache && (
        <KVCacheEstimate
          key={kvCache.modelKey}
          read={kvCache.read}
          engineArgs={kvCache.engineArgs}
        />
      )}
    </div>
  );
};

EndpointWeightsEstimate.displayName = "EndpointWeightsEstimate";

const Fact = ({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) => (
  <div className="rounded-md border bg-background px-3 py-2">
    <div className="text-xs font-medium text-muted-foreground">{label}</div>
    <div className="mt-1 font-semibold tabular-nums">{value}</div>
    {children && (
      <div className="text-xs text-muted-foreground">{children}</div>
    )}
  </div>
);

/** The checkpoint's own description, in the order a reader wants it. Absent
 * fields are dropped rather than shown as blanks. */
function modelFacts(info: ModelInfo | null) {
  const fields = [
    ["model_catalogs.modelInfo.parameterCount", info?.parameter_count],
    ["model_catalogs.modelInfo.quantization", info?.quantization],
    ["model_catalogs.modelInfo.contextLength", info?.context_length],
    ["model_catalogs.modelInfo.architecture", info?.architecture],
  ] as const;

  return fields
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({ key, value: value as string }));
}
