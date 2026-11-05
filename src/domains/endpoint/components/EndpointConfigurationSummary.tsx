import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  EndpointReviewCapacityMetric,
  EndpointReviewContext,
} from "@/domains/endpoint/lib/review-context";
import { getRoundedVgpuMemoryGiBValue } from "@/domains/endpoint/lib/vgpu";
import type { Endpoint } from "@/domains/endpoint/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { KeyValueList } from "@/foundation/components/KeyValueList";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatToDecimal } from "@/foundation/lib/unit";

type Props = {
  values: Endpoint;
  reviewContext: EndpointReviewContext;
  composeError?: string | null;
  modelRequired?: boolean;
};

export function EndpointConfigurationSummary({
  values,
  reviewContext,
  composeError,
  modelRequired = true,
}: Props) {
  const { t } = useTranslation();
  const spec = values.spec;
  const model = spec.model;
  const resources = spec.resources;
  const accelerator = resources?.accelerator;
  const virtualization = accelerator?.virtualization;
  const engineArgs = Object.entries(
    (spec.variables?.engine_args as Record<string, unknown> | undefined) ?? {},
  );
  const env = Object.entries(spec.env ?? {});
  const replicas = Math.max(1, Number(spec.replicas?.num ?? 1));
  const scheduler = formatScheduler(
    spec.deployment_options?.scheduler?.type,
    t,
  );
  const vgpuMemoryGiB = getRoundedVgpuMemoryGiBValue(
    virtualization?.memory_mib,
  );
  const cacheTimeout = spec.kv_cache?.options?.timeout_seconds ?? 5;
  const cacheValue = spec.kv_cache
    ? t("endpoints.wizard.summary.cacheConfiguration", {
        provider: spec.kv_cache.provider,
        timeout: cacheTimeout,
      })
    : t("endpoints.wizard.summary.cacheDisabled");

  return (
    <div className="space-y-5" data-testid="endpoint-configuration-summary">
      {composeError && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{composeError}</AlertDescription>
        </Alert>
      )}

      <ConfigSection title={t("endpoints.wizard.summary.deployment")}>
        <ConfigRow label={t("common.fields.cluster")}>
          <span
            data-testid="endpoint-summary-cluster-identity"
            className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-0.5"
          >
            <span>{spec.cluster || <EmptyValue />}</span>
            <span className="text-xs text-muted-foreground">
              · {t("endpoints.fields.nodeCount")}{" "}
              {reviewContext.nodeCount ?? <EmptyValue />}
            </span>
          </span>
        </ConfigRow>
        <ConfigRow label={t("endpoints.fields.replicas")}>{replicas}</ConfigRow>
        <ConfigRow label={t("endpoints.fields.schedulerType")}>
          {scheduler || <EmptyValue />}
        </ConfigRow>
      </ConfigSection>

      {modelRequired && (
        <ConfigSection title={t("endpoints.wizard.summary.model")}>
          {reviewContext.catalogOrigin && (
            <>
              <ConfigRow label={t("endpoints.wizard.summary.catalog")}>
                {reviewContext.catalogOrigin.catalog}
              </ConfigRow>
              {reviewContext.catalogOrigin.variant && (
                <>
                  <ConfigRow label={t("endpoints.recipe.variant", "Variant")}>
                    {reviewContext.catalogOrigin.variant}
                  </ConfigRow>
                  <ConfigRow label={t("endpoints.recipe.features", "Features")}>
                    {reviewContext.catalogOrigin.features.length ? (
                      <span className="space-y-1">
                        {reviewContext.catalogOrigin.features.map((feature) => (
                          <span
                            key={`${feature.name}:${feature.value ?? ""}`}
                            className="block break-words"
                          >
                            {feature.value === undefined
                              ? feature.name
                              : `${feature.name}: ${feature.value}`}
                          </span>
                        ))}
                        {reviewContext.catalogOrigin.featuresUnreadable && (
                          <span className="block text-muted-foreground">
                            {t("endpoints.origin.featuresUnreadable")}
                          </span>
                        )}
                      </span>
                    ) : reviewContext.catalogOrigin.featuresUnreadable ? (
                      <span className="text-muted-foreground">
                        {t("endpoints.origin.featuresUnreadable")}
                      </span>
                    ) : (
                      <EmptyValue />
                    )}
                  </ConfigRow>
                </>
              )}
            </>
          )}
          <ConfigRow label={t("endpoints.fields.modelRegistry")}>
            {model?.registry || <EmptyValue />}
          </ConfigRow>
          <ConfigRow label={t("common.fields.model")}>
            {model?.name || <EmptyValue />}
          </ConfigRow>
          <ConfigRow label={t("common.fields.task")}>
            {model?.task || <EmptyValue />}
          </ConfigRow>
          <ConfigRow label={t("endpoints.fields.modelVersion")}>
            {model?.version ||
              t("endpoints.wizard.summary.versionResolvedAtDeployment")}
          </ConfigRow>
          <ConfigRow label={t("endpoints.fields.modelFile")}>
            {model?.file || t("endpoints.wizard.summary.fileDefaultEntryPoint")}
          </ConfigRow>
        </ConfigSection>
      )}

      <ConfigSection title={t("endpoints.wizard.summary.runtime")}>
        <ConfigRow label={t("common.fields.engine")}>
          {formatEngine(spec.engine)}
        </ConfigRow>
        <ConfigRow label={t("endpoints.wizard.summary.cache")}>
          {cacheValue}
        </ConfigRow>
      </ConfigSection>

      <ConfigSection title={t("endpoints.wizard.summary.resources")}>
        <ConfigRow label={t("endpoints.fields.accelerator")}>
          {accelerator?.product || accelerator?.type || <EmptyValue />}
        </ConfigRow>
        <ConfigRow label={t("endpoints.wizard.summary.resourceRequest")}>
          {t("endpoints.wizard.summary.resourcePerReplicaValue", {
            cpu: resources?.cpu ?? 0,
            memory: resources?.memory ?? 0,
            gpu: resources?.gpu ?? 0,
          })}
        </ConfigRow>
        {vgpuMemoryGiB != null && (
          <ConfigRow label={t("endpoints.fields.singleCardMemory")}>
            {t("endpoints.wizard.summary.gibValue", {
              value: vgpuMemoryGiB,
            })}
          </ConfigRow>
        )}
        {virtualization?.core_percent != null && (
          <ConfigRow label={t("endpoints.fields.vgpuCoreLimit")}>
            {t("endpoints.wizard.summary.percentValue", {
              value: virtualization.core_percent,
            })}
          </ConfigRow>
        )}
      </ConfigSection>

      {(reviewContext.clusterCapacity ||
        reviewContext.clusterCapacityUnavailable) && (
        <ConfigSection
          title={t(
            "endpoints.wizard.summary.clusterCapacity",
            "Available cluster capacity",
          )}
        >
          {reviewContext.clusterCapacityUnavailable ? (
            <ConfigRow
              label={t("endpoints.wizard.summary.capacity", "Cluster capacity")}
            >
              {t("endpoints.messages.clusterResourcesUnavailable")}
            </ConfigRow>
          ) : (
            reviewContext.clusterCapacity?.map((metric) => (
              <ConfigRow
                key={metric.key}
                label={capacityLabel(metric.key, t)}
                testId={`configuration-capacity-${metric.key}`}
              >
                {formatCapacity(metric.available)}{" "}
                {t("endpoints.wizard.summary.available", "available")} /{" "}
                {formatCapacity(metric.total)}
                {capacityUnit(metric.key, t)
                  ? ` ${capacityUnit(metric.key, t)}`
                  : ""}
              </ConfigRow>
            ))
          )}
        </ConfigSection>
      )}

      <ConfigSection title={t("endpoints.wizard.summary.variables")}>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            {t("endpoints.fields.engineVariables")}
          </div>
          {engineArgs.length > 0 ? (
            <KeyValueList entries={engineArgs} compact />
          ) : (
            <EmptyValue />
          )}
        </div>
        <div className="space-y-1 pt-2">
          <div className="text-xs font-medium text-muted-foreground">
            {t("endpoints.fields.environment")}
          </div>
          {env.length > 0 ? (
            <KeyValueList entries={env} compact />
          ) : (
            <EmptyValue />
          )}
        </div>
      </ConfigSection>
    </div>
  );
}

const ConfigSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-1.5">
    <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
    <dl className="divide-y">{children}</dl>
  </section>
);

const ConfigRow = ({
  label,
  testId,
  children,
}: {
  label: string;
  testId?: string;
  children: React.ReactNode;
}) => (
  <div
    className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-1.5 text-xs"
    data-testid={testId}
  >
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-foreground">{children}</dd>
  </div>
);

const formatEngine = (
  engine: Endpoint["spec"]["engine"] | null | undefined,
) => {
  const value = [engine?.engine, engine?.version].filter(Boolean).join(" ");
  return value || <EmptyValue />;
};

const capacityLabel = (
  key: EndpointReviewCapacityMetric["key"],
  t: (key: string, options?: { defaultValue?: string }) => string,
) => {
  switch (key) {
    case "cpu":
      return t("common.fields.cpu");
    case "memory":
      return t("common.fields.memory");
    case "cards":
      return t("endpoints.fields.physicalGpu");
    case "vram":
      return t("clusters.fields.memoryUsage");
    case "core":
      return t("clusters.fields.coreUsage");
    default:
      return key;
  }
};

const capacityUnit = (
  key: EndpointReviewCapacityMetric["key"],
  t: (key: string, options?: { defaultValue?: string }) => string,
) => {
  switch (key) {
    case "cpu":
      return t("pages.vramCalculator.metrics.cores");
    case "memory":
    case "vram":
      return t("endpoints.options.gib");
    case "cards":
      return t("endpoints.fields.cards");
    default:
      return "";
  }
};

const formatCapacity = (value: number | null) => {
  if (value == null) return <EmptyValue />;
  return formatToDecimal(value, Number.isInteger(value) ? 0 : 1);
};

const formatScheduler = (
  scheduler: string | undefined,
  t: (key: string) => string,
) => {
  if (scheduler === "roundrobin") return t("models.scheduler.roundRobin");
  if (scheduler === "consistent_hash") {
    return t("models.scheduler.consistentHashing");
  }
  return scheduler ?? "";
};
