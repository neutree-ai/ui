import { useShow } from "@refinedev/core";
import CurlExample from "@/domains/external-endpoint/components/CurlExample";
import ExternalEndpointStatus from "@/domains/external-endpoint/components/ExternalEndpointStatus";
import FailedUpstreamAlert from "@/domains/external-endpoint/components/FailedUpstreamAlert";
import UpstreamStatusBadge from "@/domains/external-endpoint/components/UpstreamStatusBadge";
import { formatTimeout } from "@/domains/external-endpoint/lib/convert-timeout";
import { getExposedModels } from "@/domains/external-endpoint/lib/get-exposed-models";
import { getUnavailableModels } from "@/domains/external-endpoint/lib/get-unavailable-models";
import { isServingPhase } from "@/domains/external-endpoint/lib/is-serving-phase";
import { matchUpstreamStatuses } from "@/domains/external-endpoint/lib/match-upstream-statuses";
import type {
  ExternalEndpoint,
  ModelRoute,
} from "@/domains/external-endpoint/types";
import { Loader } from "@/foundation/components/Loader";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import ServiceUrls from "@/foundation/components/ServiceUrls";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";

export const ExternalEndpointsShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<ExternalEndpoint>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const allModels = getExposedModels(record.spec);
  const upstreamStatuses = matchUpstreamStatuses(
    record.spec,
    record.status?.upstream_status,
  );
  const isServing = isServingPhase(record.status?.phase);
  // A degraded endpoint still serves, so the example must only offer models
  // that are actually routable — not the ones its failed upstream dropped.
  const unavailableModels = getUnavailableModels(upstreamStatuses);
  const callableModels = allModels.filter(
    (model) => !unavailableModels.has(model),
  );

  const upstreams = record.spec?.upstreams ?? [];
  const upstreamName = (index: number) =>
    upstreams[index]?.name ||
    t("external_endpoints.sections.modelService", { index: index + 1 });
  const routeMode = (targets: ModelRoute["targets"]) => {
    if (targets.length <= 1)
      return t("external_endpoints.options.fixedRouting");
    return targets.some((target) => (target.priority ?? 0) !== 0)
      ? t("external_endpoints.options.priorityRouting")
      : t("external_endpoints.options.weightedRouting");
  };

  return (
    <ShowPage record={record} showCurrentBreadcrumb={false}>
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        status={<ExternalEndpointStatus {...record.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("external_endpoints.fields.type")}>
              {t("external_endpoints.options.upstreamTypeExternal")}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("external_endpoints.fields.models")}>
              {allModels.length || "-"}
            </ShowPage.Meta>
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />

      <div className="mt-4 space-y-4">
        <ShowPage.Section
          title={t("external_endpoints.sections.configuration")}
          className="rounded-md"
          contentClassName="pt-1"
        >
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(140px,0.35fr)_minmax(0,1fr)]">
            <div className="max-w-[180px]">
              <ShowPage.Row title={t("external_endpoints.fields.timeout")}>
                {formatTimeout(record.spec?.timeout)}
              </ShowPage.Row>
            </div>
            {record.status?.service_url && (
              <div className="min-w-0">
                <ServiceUrls serviceUrl={record.status.service_url} />
              </div>
            )}
          </div>
        </ShowPage.Section>

        {record.spec?.model_routes?.length ? (
          <ShowPage.Section
            title={t("external_endpoints.sections.virtualModels")}
            className="rounded-md"
            contentClassName="pt-1"
          >
            <div className="space-y-3">
              {record.spec.model_routes.map((route) => (
                <div key={route.model} className="rounded-md bg-muted/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-base font-semibold text-foreground">
                      {route.model}
                    </div>
                    <span className="rounded-md bg-background px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                      {routeMode(route.targets)}
                    </span>
                  </div>
                  <div className="mt-4 hidden grid-cols-[90px_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-4 border-b border-border/40 pb-2 text-xs font-medium text-muted-foreground sm:grid">
                    <span>{t("external_endpoints.fields.role")}</span>
                    <span>{t("external_endpoints.fields.provider")}</span>
                    <span>
                      {t("external_endpoints.fields.upstreamModelName")}
                    </span>
                    <span>
                      {t("external_endpoints.fields.maxInflightRequests")}
                    </span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {route.targets.map((target, index) => (
                      <div
                        key={`${target.upstream}-${target.upstream_model}-${index}`}
                        className="grid grid-cols-1 gap-2 py-3 text-sm sm:grid-cols-[90px_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)] sm:items-center sm:gap-4"
                      >
                        <span className="font-medium text-foreground">
                          {route.targets.length === 1
                            ? t("external_endpoints.options.fixedRole")
                            : index === 0
                              ? t("external_endpoints.options.primaryRole")
                              : t("external_endpoints.options.fallbackRole")}
                        </span>
                        <span className="min-w-0 truncate text-foreground">
                          {target.upstream}
                        </span>
                        <code className="min-w-0 break-all text-xs text-foreground">
                          {target.upstream_model || "-"}
                        </code>
                        <span className="text-muted-foreground">
                          {route.targets.length > 1 && target.weight
                            ? `${target.weight}%`
                            : target.max_inflight_requests ||
                              t("external_endpoints.fields.unlimited")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ShowPage.Section>
        ) : null}

        {upstreams.length > 0 && (
          <ShowPage.Section
            title={t("external_endpoints.sections.modelServices")}
            className="rounded-md"
            contentClassName="pt-1"
          >
            <div className="divide-y divide-border/50">
              {upstreams.map((upstream, index) => {
                const upstreamStatus = upstreamStatuses[index];

                return (
                  <div key={index} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-foreground">
                          {upstreamName(index)}
                        </span>
                        <span className="rounded-md bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                          {upstream.endpoint_ref
                            ? t(
                                "external_endpoints.options.upstreamTypeEndpointRef",
                              )
                            : t(
                                "external_endpoints.options.upstreamTypeExternal",
                              )}
                        </span>
                        {upstreamStatus && (
                          <UpstreamStatusBadge status={upstreamStatus} />
                        )}
                      </div>
                    </div>
                    {upstreamStatus?.phase === "Failed" && (
                      <FailedUpstreamAlert status={upstreamStatus} />
                    )}
                    <div className="mt-3 grid max-w-3xl grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(140px,0.6fr)]">
                      <ShowPage.Row
                        title={
                          upstream.endpoint_ref
                            ? t("external_endpoints.fields.endpointRef")
                            : t("external_endpoints.fields.upstreamUrl")
                        }
                      >
                        <code className="break-all text-xs font-normal">
                          {upstream.endpoint_ref ||
                            upstream.upstream?.url ||
                            "-"}
                        </code>
                      </ShowPage.Row>
                      <ShowPage.Row
                        title={t("external_endpoints.fields.models")}
                      >
                        {(upstream.models ?? upstreamStatus?.models ?? [])
                          .length || "-"}
                      </ShowPage.Row>
                    </div>
                  </div>
                );
              })}
            </div>
          </ShowPage.Section>
        )}

        {isServing && record.status?.service_url && (
          <CurlExample
            serviceUrl={record.status.service_url}
            models={callableModels}
          />
        )}
      </div>
    </ShowPage>
  );
};
