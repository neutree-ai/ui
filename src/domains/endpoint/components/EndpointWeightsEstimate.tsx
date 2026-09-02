import { useEffect, useRef, useState } from "react";
import { KVCacheEstimate } from "@/domains/endpoint/components/KVCacheEstimate";
import { VRAMCheckBadge } from "@/domains/endpoint/components/VRAMCheckBadge";
import type {
  EngineCacheArgControls,
  EngineCacheArgs,
} from "@/domains/endpoint/lib/engine-cache-args";
import { InfoHint } from "@/foundation/components/InfoHint";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelInfoRead } from "@/foundation/lib/model-info-read";
import { formatGb } from "@/foundation/recipe/vram";

/**
 * What this deployment is expected to weigh, in one place for both ways of
 * getting here.
 *
 * Two halves that answer different questions and must not read as one number:
 *
 *   - what the catalog *declares* — the weights alone, as its author measured
 *     them, multiplied out by the replica count, plus what the checkpoint
 *     says about itself;
 *   - what the KV cache *works out to* — computed here from the checkpoint and
 *     from the context and concurrency this deployment will run with.
 *
 * The two halves are shown apart because they come from different places and
 * change on different schedules, but a deployment needs both in VRAM at once.
 * The VRAM check is therefore run against their sum — weights plus the KV
 * cache's current estimate — not against the declared figure alone, which
 * would understate what the deployment actually needs the moment the KV cache
 * is more than a rounding error.
 *
 * Deploying without a catalog has only the second, so the first is absent
 * rather than empty. An engine that serves a model baked into its own image
 * has no checkpoint to compute from and gets no estimator, but a catalog can
 * still declare what its weights need — the declared figure is about
 * hardware, not about which engine reads the weights.
 */

type Declared = {
  /** Weights per replica, as the catalog states them. Null when it states
   * none. Does not include KV cache — that is computed separately and added
   * back in for the VRAM check. */
  perReplicaGb: number | null;
  replicas: number;
  /**
   * What the chosen cluster offers one replica, so the declared figure can be
   * checked against it rather than left as a number to compare by hand.
   */
  accelerator: {
    product?: string | null;
    perGpuGb?: number | null;
    gpuCount?: number | string | null;
  };
};

type KvCache = {
  read: ModelInfoRead;
  engineArgs: EngineCacheArgs;
  /** Controls elsewhere on the form that own the context and concurrency. */
  controls: EngineCacheArgControls;
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
  onRequiredGbChange,
}: {
  declared: Declared | null;
  kvCache: KvCache | null;
  /**
   * Reports the combined per-replica requirement (weights + KV cache) as it
   * changes, for callers elsewhere on the form that need the same figure this
   * section's own badge checks against — an accelerator notice showing "requires
   * ≥ N GB" would otherwise fall back to the declared weights alone and
   * understate what a replica needs once the KV cache is more than a rounding
   * error.
   */
  onRequiredGbChange?: (gb: number | null) => void;
}) => {
  const { t } = useTranslation();

  // The KV cache panel reports its own current total here as it recomputes.
  // Kept apart from the panel's internal state (precision, tokens, etc.),
  // which stays local to it — this is only the one number the badge needs.
  // Reset on every model switch: the previous model's total is not an answer
  // about the next one, and letting it linger for the one render before the
  // new estimate lands would understate or overstate the new model's need.
  const [kvGb, setKvGb] = useState<number | null>(null);
  const modelKey = kvCache?.modelKey ?? null;
  const lastModelKey = useRef(modelKey);
  if (lastModelKey.current !== modelKey) {
    lastModelKey.current = modelKey;
    if (kvGb !== null) setKvGb(null);
  }

  const perReplicaGb = declared?.perReplicaGb ?? null;
  // A catalog that states no VRAM figure has nothing this section can show:
  // the checkpoint facts it might otherwise carry are not a substitute for a
  // number a reader can size hardware against, so this section is silent
  // rather than showing them on their own.
  const showsDeclared = perReplicaGb != null;
  // What one replica actually needs in VRAM: the declared weights plus
  // whatever the KV cache panel currently works out to. Adding zero when the
  // KV cache has not resolved yet keeps this equal to the weights alone,
  // which is what the badge showed before the KV panel existed.
  const requiredGb = perReplicaGb != null ? perReplicaGb + (kvGb ?? 0) : null;

  useEffect(() => {
    onRequiredGbChange?.(requiredGb);
  }, [requiredGb, onRequiredGbChange]);

  if (!showsDeclared && !kvCache) return null;

  return (
    <div className="space-y-3" data-testid="endpoint-weights-estimate">
      {declared && perReplicaGb != null && (
        <div
          className="rounded-lg border bg-muted/20 p-3"
          data-testid="endpoint-declared-weights"
        >
          <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            {t("endpoints.weights.declared")}
            <InfoHint label={t("endpoints.descriptions.declaredWeights")} />
          </div>
          <div className="space-y-1">
            {/* The requirement and the check on it are one statement. Stated
            apart, the same figure appeared twice — as a number to compare by
            hand, and as the comparison — and at one replica the two were the
            same number in two places. The requirement itself is weights
            plus the KV cache's current estimate, not the declared weights
            alone — a deployment needs both in VRAM at once. */}
            <VRAMCheckBadge
              acceleratorProduct={declared.accelerator.product}
              perGpuGb={declared.accelerator.perGpuGb}
              gpuCount={declared.accelerator.gpuCount}
              requiredGb={requiredGb}
            />
            {/* Rounded to the same display precision as every other GB
            figure on this form (formatGb, one decimal) — the underlying
            KV-cache estimate carries far more precision than that (a
            binary fraction of a byte-per-token count multiplied out), and
            showing it unrounded here read as a different, more exact
            number than the one the badge above it just checked. */}
            {kvGb != null && (
              <div className="text-xs text-muted-foreground">
                {t("endpoints.weights.breakdown", {
                  weights: formatGb(perReplicaGb),
                  kv: formatGb(kvGb),
                  total: formatGb(requiredGb ?? 0),
                })}
              </div>
            )}
            {/* The badge speaks per replica, which is what a GPU allocation
            is measured against. The fleet total is a different question and
            is only worth asking once there is more than one replica. */}
            {declared.replicas > 1 && requiredGb != null && (
              <div className="text-xs text-muted-foreground">
                {t("endpoints.weights.acrossReplicas", {
                  gb: formatGb(requiredGb),
                  count: declared.replicas,
                  total: formatGb(requiredGb * declared.replicas),
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {kvCache && (
        <KVCacheEstimate
          key={kvCache.modelKey}
          read={kvCache.read}
          engineArgs={kvCache.engineArgs}
          controls={kvCache.controls}
          onEstimate={setKvGb}
        />
      )}
    </div>
  );
};

EndpointWeightsEstimate.displayName = "EndpointWeightsEstimate";
