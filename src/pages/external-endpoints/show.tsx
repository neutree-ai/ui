import { useNavigation, useShow } from "@refinedev/core";
import { ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EndpointAccessSummary } from "@/domains/endpoint/components/EndpointAccessSummary";
import CurlExample from "@/domains/external-endpoint/components/CurlExample";
import ExternalEndpointMonitor, {
  ExternalEndpointMonitorLink,
} from "@/domains/external-endpoint/components/ExternalEndpointMonitor";
import ExternalEndpointStatus from "@/domains/external-endpoint/components/ExternalEndpointStatus";
import FailedUpstreamAlert from "@/domains/external-endpoint/components/FailedUpstreamAlert";
import ModelRouteDetails from "@/domains/external-endpoint/components/ModelRouteDetails";
import UpstreamStatusBadge from "@/domains/external-endpoint/components/UpstreamStatusBadge";
import { formatTimeout } from "@/domains/external-endpoint/lib/convert-timeout";
import { getEndpointType } from "@/domains/external-endpoint/lib/get-endpoint-type";
import { getExposedModels } from "@/domains/external-endpoint/lib/get-exposed-models";
import { getUnavailableModels } from "@/domains/external-endpoint/lib/get-unavailable-models";
import { getUpstreamModelMappings } from "@/domains/external-endpoint/lib/get-upstream-model-mappings";
import { isServingPhase } from "@/domains/external-endpoint/lib/is-serving-phase";
import { matchUpstreamStatuses } from "@/domains/external-endpoint/lib/match-upstream-statuses";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import {
  detailTabsListClassName,
  detailTabTriggerClassName,
} from "@/foundation/components/detail-tabs";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { Loader } from "@/foundation/components/Loader";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
import { resolveExternalModelSource } from "@/foundation/lib/model-source";

export const ExternalEndpointsShow = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "monitor" ? "monitor" : "overview";
  const selectTab = (value: string, model?: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", value);
      if (model) next.set("model", model);
      return next;
    });
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

  const endpointType = getEndpointType(record.spec);
  const endpointTypeLabels = {
    external: t("external_endpoints.options.upstreamTypeExternal"),
    endpoint_ref: t("external_endpoints.options.upstreamTypeInternal"),
    mixed: t("external_endpoints.options.upstreamTypeMixed"),
  };
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

  return (
    <ShowPage record={record} showCurrentBreadcrumb={false}>
      <Tabs
        value={tab}
        onValueChange={selectTab}
        className="flex h-full flex-col"
      >
        <ShowPage.ObjectHeader
          title={record.metadata.name}
          // No phase, no badge: the identity line reads as "name, dash"
          // otherwise, and the dash carries no information there.
          status={
            record.status?.phase ? (
              <ExternalEndpointStatus {...record.status} />
            ) : undefined
          }
          description={
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <ShowPage.Meta label={t("external_endpoints.fields.type")}>
                {endpointType ? (
                  endpointTypeLabels[endpointType]
                ) : (
                  <EmptyValue />
                )}
              </ShowPage.Meta>
              <ShowPage.Meta label={t("external_endpoints.fields.models")}>
                {allModels.length}
              </ShowPage.Meta>
              <ShowPage.Meta label={t("external_endpoints.fields.timeout")}>
                {formatTimeout(record.spec?.timeout)}
              </ShowPage.Meta>
              {/* The URLs are long and only worth their space when asked for —
                  the same affordance the endpoint detail page uses. */}
              {record.status?.service_url && (
                <EndpointAccessSummary
                  serviceUrl={record.status.service_url}
                  className="shrink-0"
                />
              )}
              <MetadataTimestampMeta metadata={record.metadata} />
            </span>
          }
        />

        <div className="relative">
          <TabsList className={detailTabsListClassName}>
            <TabsTrigger value="overview" className={detailTabTriggerClassName}>
              {t("common.tabs.basic")}
            </TabsTrigger>
            <TabsTrigger value="monitor" className={detailTabTriggerClassName}>
              {t("common.tabs.monitor")}
            </TabsTrigger>
          </TabsList>
          {/* Rides in the tab row so the deep link costs no vertical space. */}
          {tab === "monitor" && (
            <div className="absolute right-0 top-0 flex h-11 items-center">
              <ExternalEndpointMonitorLink record={record} />
            </div>
          )}
        </div>
        <TabsContent
          value="monitor"
          className="mt-0 flex-1 overflow-hidden pt-4"
        >
          <ExternalEndpointMonitor record={record} />
        </TabsContent>
        <TabsContent
          value="overview"
          className="mt-0 flex-1 overflow-auto pt-4"
        >
          {/* Same rhythm as the endpoint detail page: sections 12px apart,
              each one keeping ShowPage.Section's own 20px content padding and
              card radius instead of restating them tighter here. */}
          <div className="space-y-3">
            {record.spec?.model_routes?.length ? (
              <ShowPage.Section
                title={t("external_endpoints.sections.virtualModels")}
              >
                <div className="space-y-3">
                  {record.spec.model_routes.map((route) => (
                    <ModelRouteDetails
                      key={route.model}
                      onViewMonitoring={() => selectTab("monitor", route.model)}
                      route={route}
                      source={resolveExternalModelSource(
                        record.spec,
                        route.model,
                      )}
                      editUrl={navigation.editUrl(
                        "external_endpoints",
                        record.metadata.name,
                        { ...record.metadata, query: { model: route.model } },
                      )}
                      serviceUrl={record.status?.service_url ?? undefined}
                    />
                  ))}
                </div>
              </ShowPage.Section>
            ) : null}

            {upstreams.length > 0 && (
              <ShowPage.Section
                title={t("external_endpoints.sections.modelServices")}
              >
                <div className="divide-y divide-border/50">
                  {upstreams.map((upstream, index) => {
                    const upstreamStatus = upstreamStatuses[index];
                    const mappings = getUpstreamModelMappings(
                      record.spec,
                      upstream,
                    );
                    const exposedCount = new Set(
                      mappings.flatMap((mapping) => mapping.exposedModels),
                    ).size;

                    return (
                      <div key={index} className="py-4 first:pt-1 last:pb-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {upstreamName(index)}
                            </span>
                            <span className="rounded-md bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                              {upstream.endpoint_ref
                                ? t(
                                    "external_endpoints.options.upstreamTypeInternal",
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
                        <p className="mt-2 break-all text-xs text-muted-foreground">
                          <span className="mr-2">
                            {upstream.endpoint_ref
                              ? t("external_endpoints.fields.endpointRef")
                              : t("external_endpoints.fields.upstreamUrl")}
                          </span>
                          <code>
                            {upstream.endpoint_ref ||
                              upstream.upstream?.url || <EmptyValue />}
                          </code>
                        </p>
                        <details className="group mt-3">
                          {/* Muted rather than primary: the primary-coloured
                              text in this section is a real link (the internal
                              endpoint name navigates), so a disclosure in the
                              same colour reads as another way off the page.
                              `-ml-2` cancels the px-2 so the chevron lines up
                              with the channel name and description above. */}
                          <summary className="-ml-2 flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                            <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                            <span className="group-open:hidden">
                              {t(
                                "external_endpoints.actions.viewModelMappings",
                              )}
                            </span>
                            <span className="hidden group-open:inline">
                              {t(
                                "external_endpoints.actions.hideModelMappings",
                              )}
                            </span>
                            {t("external_endpoints.messages.mappingSummary", {
                              upstream: t(
                                "external_endpoints.messages.mappingUpstreamCount",
                                { count: mappings.length },
                              ),
                              exposed: t(
                                "external_endpoints.messages.mappingExposedCount",
                                { count: exposedCount },
                              ),
                            })}
                          </summary>
                          {mappings.length ? (
                            <div className="mt-3 overflow-hidden rounded-md border">
                              <table className="w-full table-fixed text-left text-sm">
                                {/* Same header treatment as the shared table
                                    and the route tables above. */}
                                <thead className="bg-muted/80 text-xs text-muted-foreground">
                                  <tr>
                                    <th className="w-1/3 px-3 py-2 font-semibold">
                                      {t(
                                        "external_endpoints.fields.upstreamModelName",
                                      )}
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                      {t(
                                        "external_endpoints.fields.virtualModel",
                                      )}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {mappings.map((mapping) => (
                                    <tr key={mapping.upstreamModel}>
                                      <td className="break-all px-3 py-2 align-top font-mono text-xs">
                                        {mapping.upstreamModel}
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-1.5">
                                          {mapping.exposedModels.map(
                                            (model) => (
                                              <code
                                                key={model}
                                                className="max-w-full break-all rounded bg-muted px-2 py-1 text-xs"
                                              >
                                                {model}
                                              </code>
                                            ),
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {t("external_endpoints.messages.noModelMappings")}
                            </p>
                          )}
                        </details>
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
        </TabsContent>
      </Tabs>
    </ShowPage>
  );
};
