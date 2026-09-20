import { useNavigation, useShow } from "@refinedev/core";
import { ChevronRight } from "lucide-react";
import CurlExample from "@/domains/external-endpoint/components/CurlExample";
import ExternalEndpointStatus from "@/domains/external-endpoint/components/ExternalEndpointStatus";
import FailedUpstreamAlert from "@/domains/external-endpoint/components/FailedUpstreamAlert";
import ModelRouteDetails from "@/domains/external-endpoint/components/ModelRouteDetails";
import UpstreamStatusBadge from "@/domains/external-endpoint/components/UpstreamStatusBadge";
import { formatTimeout } from "@/domains/external-endpoint/lib/convert-timeout";
import { getExposedModels } from "@/domains/external-endpoint/lib/get-exposed-models";
import { getUnavailableModels } from "@/domains/external-endpoint/lib/get-unavailable-models";
import { getUpstreamModelMappings } from "@/domains/external-endpoint/lib/get-upstream-model-mappings";
import { isServingPhase } from "@/domains/external-endpoint/lib/is-serving-phase";
import { matchUpstreamStatuses } from "@/domains/external-endpoint/lib/match-upstream-statuses";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import { Loader } from "@/foundation/components/Loader";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import ServiceUrls from "@/foundation/components/ServiceUrls";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";

export const ExternalEndpointsShow = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
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

  return (
    <ShowPage record={record} showCurrentBreadcrumb={false}>
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        status={<ExternalEndpointStatus {...record.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("external_endpoints.fields.models")}>
              {allModels.length ? allModels.join(", ") : "-"}
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
                <ModelRouteDetails
                  key={route.model}
                  route={route}
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
            className="rounded-md"
            contentClassName="pt-1"
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
                        {upstream.endpoint_ref || upstream.upstream?.url || "-"}
                      </code>
                    </p>
                    <details className="group mt-3">
                      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                        <span className="group-open:hidden">
                          {t("external_endpoints.actions.viewModelMappings")}
                        </span>
                        <span className="hidden group-open:inline">
                          {t("external_endpoints.actions.hideModelMappings")}
                        </span>
                        {t("external_endpoints.messages.mappingSummary", {
                          upstreamCount: mappings.length,
                          exposedCount,
                        })}
                      </summary>
                      {mappings.length ? (
                        <div className="mt-3 overflow-hidden rounded-md border">
                          <table className="w-full table-fixed text-left text-sm">
                            <thead className="bg-muted/40 text-xs text-muted-foreground">
                              <tr>
                                <th className="w-1/3 px-3 py-2 font-medium">
                                  {t(
                                    "external_endpoints.fields.upstreamModelName",
                                  )}
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  {t("external_endpoints.fields.virtualModel")}
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
                                      {mapping.exposedModels.map((model) => (
                                        <code
                                          key={model}
                                          className="max-w-full break-all rounded bg-muted px-2 py-1 text-xs"
                                        >
                                          {model}
                                        </code>
                                      ))}
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
    </ShowPage>
  );
};
