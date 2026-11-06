import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCatalogFeature } from "@/domains/endpoint/lib/catalog-origin";
import {
  CAPACITY_METRIC_LABELS,
  type EndpointReviewContext,
  formatCapacityValue,
} from "@/domains/endpoint/lib/review-context";
import { schedulerLabel } from "@/domains/endpoint/lib/scheduler";
import { getRoundedVgpuMemoryGiBValue } from "@/domains/endpoint/lib/vgpu";
import type { Endpoint } from "@/domains/endpoint/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { useTranslation } from "@/foundation/lib/i18n";
import { KeyValueList } from "./KeyValueList";

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
  const schedulerType = spec.deployment_options?.scheduler?.type;
  const scheduler = schedulerLabel(schedulerType, t) ?? schedulerType;
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
    <div className="space-y-5">
      {composeError && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{composeError}</AlertDescription>
        </Alert>
      )}

      <ConfigSection title={t("endpoints.wizard.summary.deployment")}>
        <ConfigRow label={t("common.fields.cluster")}>
          <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-0.5">
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
                            {formatCatalogFeature(feature)}
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
            reviewContext.clusterCapacity?.map((metric) => {
              const { label, unit } = CAPACITY_METRIC_LABELS[metric.key];
              return (
                <ConfigRow key={metric.key} label={t(label)}>
                  {capacityValue(metric.available)}{" "}
                  {t("endpoints.wizard.summary.available", "available")} /{" "}
                  {capacityValue(metric.total)}
                  {unit ? ` ${t(unit)}` : ""}
                </ConfigRow>
              );
            })
          )}
        </ConfigSection>
      )}

      <ConfigSection title={t("endpoints.wizard.summary.variables")}>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            {t("endpoints.fields.engineVariables")}
          </div>
          {engineArgs.length > 0 ? (
            <KeyValueList entries={engineArgs} />
          ) : (
            <EmptyValue />
          )}
        </div>
        <div className="space-y-1 pt-2">
          <div className="text-xs font-medium text-muted-foreground">
            {t("endpoints.fields.environment")}
          </div>
          {env.length > 0 ? <KeyValueList entries={env} /> : <EmptyValue />}
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-1.5 text-xs">
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

const capacityValue = (value: number | null) =>
  value == null ? <EmptyValue /> : formatCapacityValue(value);
