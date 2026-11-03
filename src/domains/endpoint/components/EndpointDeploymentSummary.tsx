import { ChevronDown } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  EndpointDeclaredWeights,
  EndpointKvCacheInput,
} from "@/domains/endpoint/components/EndpointWeightsEstimate";
import {
  KVCacheEstimate,
  type KVCacheEstimateState,
} from "@/domains/endpoint/components/KVCacheEstimate";
import { VRAMCheckBadge } from "@/domains/endpoint/components/VRAMCheckBadge";
import type { Endpoint } from "@/domains/endpoint/types";
import { InfoHint } from "@/foundation/components/InfoHint";
import { METRIC_BAR_SERIES_FILL_CLASSES } from "@/foundation/components/MetricBar";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { formatGb } from "@/foundation/recipe/vram";

type Props = {
  values: Endpoint;
  declared: EndpointDeclaredWeights | null;
  kvCache: EndpointKvCacheInput | null;
};

const sameKvState = (
  first: KVCacheEstimateState,
  second: KVCacheEstimateState,
) => {
  if (first.kind !== second.kind) return false;
  if (first.kind === "ready" && second.kind === "ready") {
    return (
      first.totalGb === second.totalGb &&
      first.tokensPerSequence === second.tokensPerSequence &&
      first.sequences === second.sequences &&
      first.precision === second.precision &&
      first.family === second.family
    );
  }
  return (
    first.kind === "unavailable" &&
    second.kind === "unavailable" &&
    first.reason === second.reason &&
    JSON.stringify(first.missingFields) === JSON.stringify(second.missingFields)
  );
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
}: Props) {
  const { t } = useTranslation();
  const [kvState, setKvState] = useState<KVCacheEstimateState>({
    kind: "unavailable",
    reason: "pending",
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const updateKvState = useCallback((next: KVCacheEstimateState) => {
    setKvState((current) => (sameKvState(current, next) ? current : next));
  }, []);

  const declaredWeightsGb = declared?.perReplicaGb ?? null;
  const weightsGb = declaredWeightsGb;
  const kvGb = kvState.kind === "ready" ? kvState.totalGb : null;
  const knownPerReplicaGb =
    weightsGb != null || kvGb != null ? (weightsGb ?? 0) + (kvGb ?? 0) : null;
  const replicas = Math.max(1, Number(values.spec.replicas?.num ?? 1));
  const fleetGb =
    knownPerReplicaGb != null ? knownPerReplicaGb * replicas : null;
  const completeEstimate = weightsGb != null && kvGb != null;
  const cacheEnabled = Boolean(values.spec.kv_cache);
  const weightsLabel =
    declared?.source === "checkpoint"
      ? t("endpoints.weights.estimated")
      : declared?.source === "catalog"
        ? t("endpoints.weights.declared")
        : t("endpoints.wizard.summary.weights");
  const weightsSourceHint =
    declared?.source === "checkpoint"
      ? t("endpoints.weights.sourceCheckpoint")
      : declared?.source === "catalog"
        ? t("endpoints.weights.sourceCatalog")
        : null;

  return (
    <div className="space-y-4" data-testid="endpoint-deployment-summary">
      {knownPerReplicaGb != null ? (
        <div className="space-y-3">
          <div>
            <div className="text-[32px] font-semibold leading-none tracking-tight tabular-nums">
              {formatGb(knownPerReplicaGb)} GB
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {completeEstimate
                ? t("endpoints.wizard.summary.perReplica")
                : t("endpoints.wizard.summary.partialPerReplica")}
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
                className={METRIC_BAR_SERIES_FILL_CLASSES.purple}
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
                  METRIC_BAR_SERIES_FILL_CLASSES.purple,
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
              stackFields
              onStateChange={updateKvState}
            />
          </div>
        </div>
      )}
    </div>
  );
}
