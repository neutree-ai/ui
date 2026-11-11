import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  KVCacheEstimate,
  type KVCacheEstimateState,
} from "@/domains/endpoint/components/KVCacheEstimate";
import { VRAMCheckBadge } from "@/domains/endpoint/components/VRAMCheckBadge";
import type {
  EngineCacheArgControls,
  EngineCacheArgs,
} from "@/domains/endpoint/lib/engine-cache-args";
import { perReplicaRequiredGb } from "@/domains/endpoint/lib/estimate-weights";
import type { Endpoint } from "@/domains/endpoint/types";
import { InfoHint } from "@/foundation/components/InfoHint";
import { METRIC_BAR_SERIES_FILL_CLASSES } from "@/foundation/components/MetricBar";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelInfoRead } from "@/foundation/lib/model-info-read";
import { cn } from "@/foundation/lib/utils";
import { formatGb } from "@/foundation/recipe/vram";

type EndpointDeclaredWeights = {
  /** Weights per replica, from the catalog, the model version's size, or the
   * checkpoint fallback for a catalog that declares no VRAM minimum. Does not
   * include the KV cache, which is computed separately and added. */
  perReplicaGb: number | null;
  /** Catalog declarations are measured; model-size values are storage proxies;
   * checkpoint values are calculated. */
  source?: "catalog" | "model-size" | "checkpoint";
  replicas: number;
  /** What the chosen cluster offers one replica, for the VRAM check. */
  accelerator: {
    product?: string | null;
    perGpuGb?: number | null;
    gpuCount?: number | string | null;
  };
};

type EndpointKvCacheInput = {
  read: ModelInfoRead;
  engineArgs: EngineCacheArgs;
  /** Controls elsewhere on the form that own the context and concurrency. */
  controls: EngineCacheArgControls;
  /**
   * Identity of the model being estimated. The estimator's inputs derive their
   * defaults from the checkpoint, so it is remounted when the checkpoint
   * changes — carrying the previous model's context length into the next
   * model's estimate would look like a value read from it.
   */
  modelKey: string;
};

type Props = {
  values: Endpoint;
  declared: EndpointDeclaredWeights | null;
  kvCache: EndpointKvCacheInput | null;
  /** The KV cache estimate's current total, owned by the caller so the rest of
   * the form checks the same per-replica figure this summary shows. */
  kvCacheGb: number | null;
  onKvCacheStateChange: (state: KVCacheEstimateState) => void;
};

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  );
}

export function EndpointDeploymentSummary({
  values,
  declared,
  kvCache,
  kvCacheGb: kvGb,
  onKvCacheStateChange,
}: Props) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const weightsGb = declared?.perReplicaGb ?? null;
  const knownPerReplicaGb = perReplicaRequiredGb(weightsGb, kvGb);
  const replicas = Math.max(1, Number(values.spec.replicas?.num ?? 1));
  const fleetGb =
    knownPerReplicaGb != null ? knownPerReplicaGb * replicas : null;
  const completeEstimate = weightsGb != null && kvGb != null;
  const partialEstimateLabel =
    weightsGb == null
      ? t("endpoints.wizard.summary.kvCacheOnly")
      : t("endpoints.wizard.summary.weightsOnly");
  const cacheEnabled = Boolean(values.spec.kv_cache);
  const weightsLabel =
    declared?.source === "model-size"
      ? t("endpoints.weights.estimatedFromSize")
      : declared?.source === "checkpoint"
        ? t("endpoints.weights.estimated")
        : declared?.source === "catalog"
          ? t("endpoints.weights.declared")
          : t("endpoints.wizard.summary.weights");
  const weightsSourceHint =
    declared?.source === "model-size"
      ? t("endpoints.weights.sourceModelSize")
      : declared?.source === "checkpoint"
        ? t("endpoints.weights.sourceCheckpoint")
        : declared?.source === "catalog"
          ? t("endpoints.weights.sourceCatalog")
          : null;

  return (
    <div className="space-y-4" data-testid="endpoint-deployment-summary">
      {knownPerReplicaGb != null ? (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              {t("endpoints.wizard.summary.perReplica")}
            </div>
            <div className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular-nums">
              {formatGb(knownPerReplicaGb)} GB
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {completeEstimate
                ? t("endpoints.wizard.summary.weightsAndKvCache")
                : partialEstimateLabel}
            </div>
          </div>

          <div
            className="flex h-2 overflow-hidden rounded-full bg-muted"
            data-testid="deployment-capacity-bar"
          >
            {weightsGb != null && knownPerReplicaGb > 0 && (
              <span
                className={METRIC_BAR_SERIES_FILL_CLASSES.blue}
                style={{ width: `${(weightsGb / knownPerReplicaGb) * 100}%` }}
              />
            )}
            {kvGb != null && knownPerReplicaGb > 0 && (
              <span
                className={METRIC_BAR_SERIES_FILL_CLASSES.violet}
                style={{ width: `${(kvGb / knownPerReplicaGb) * 100}%` }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-sm",
                  METRIC_BAR_SERIES_FILL_CLASSES.blue,
                )}
              />
              {weightsLabel}{" "}
              {weightsGb != null ? `${formatGb(weightsGb)} GB` : "—"}
              {weightsSourceHint && <InfoHint label={weightsSourceHint} />}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-sm",
                  METRIC_BAR_SERIES_FILL_CLASSES.violet,
                )}
              />
              {t("endpoints.wizard.summary.kvCache")}{" "}
              {kvGb != null ? `${formatGb(kvGb)} GB` : "—"}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t("endpoints.wizard.summary.estimateUnavailable")}
        </div>
      )}

      {declared && knownPerReplicaGb != null && (
        <VRAMCheckBadge
          acceleratorProduct={declared.accelerator.product}
          perGpuGb={declared.accelerator.perGpuGb}
          gpuCount={declared.accelerator.gpuCount}
          requiredGb={knownPerReplicaGb}
        />
      )}

      <dl className="divide-y border-y">
        <SummaryRow label={t("endpoints.wizard.summary.fleetTotal")}>
          {fleetGb != null
            ? `${formatGb(knownPerReplicaGb ?? 0)} × ${replicas} = ${formatGb(
                fleetGb,
              )} GB`
            : "—"}
        </SummaryRow>
        <SummaryRow label={t("endpoints.wizard.summary.kvCacheState")}>
          {cacheEnabled
            ? t("endpoints.wizard.summary.cacheEnabled")
            : t("endpoints.wizard.summary.cacheDisabled")}
        </SummaryRow>
      </dl>

      {kvCache && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-xs text-muted-foreground hover:bg-transparent"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen
              ? t("endpoints.wizard.summary.hideEstimateDetails")
              : t("endpoints.wizard.summary.showEstimateDetails")}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                detailsOpen && "rotate-180",
              )}
            />
          </Button>
          <div
            className={detailsOpen ? "mt-3" : "hidden"}
            aria-hidden={!detailsOpen}
          >
            <KVCacheEstimate
              key={kvCache.modelKey}
              read={kvCache.read}
              engineArgs={kvCache.engineArgs}
              controls={kvCache.controls}
              onStateChange={onKvCacheStateChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
