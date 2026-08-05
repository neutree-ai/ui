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
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
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
        <MetadataCard
          metadata={record.metadata}
          showName={false}
          showWorkspace={false}
          showTimestamps={false}
        />
        <ShowPage.Section
          title={t("external_endpoints.sections.configuration")}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
            <ShowPage.Row title={t("external_endpoints.fields.timeout")}>
              {formatTimeout(record.spec?.timeout)}
            </ShowPage.Row>
            {record.status?.service_url && (
              <div className="lg:col-span-3">
                <ServiceUrls serviceUrl={record.status.service_url} />
              </div>
            )}
          </div>
        </ShowPage.Section>

        {record.spec?.upstreams?.map((upstream, index) => {
          const upstreamStatus = upstreamStatuses[index];

          return (
            <ShowPage.Section
              key={index}
              title={
                <span className="inline-flex items-center gap-2">
                  {t("external_endpoints.sections.upstream", {
                    index: index + 1,
                  })}
                  {upstreamStatus && (
                    <UpstreamStatusBadge status={upstreamStatus} />
                  )}
                </span>
              }
            >
              {upstreamStatus?.phase === "Failed" && (
                <FailedUpstreamAlert status={upstreamStatus} />
              )}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
                {upstream.endpoint_ref ? (
                  <div className="lg:col-span-3">
                    <ShowPage.Row
                      title={t("external_endpoints.fields.endpointRef")}
                    >
                      <code className="text-sm break-all">
                        {upstream.endpoint_ref}
                      </code>
                    </ShowPage.Row>
                  </div>
                ) : (
                  upstream.upstream?.url && (
                    <div className="lg:col-span-3">
                      <ShowPage.Row
                        title={t("external_endpoints.fields.upstreamUrl")}
                      >
                        <code className="text-sm break-all">
                          {upstream.upstream.url}
                        </code>
                      </ShowPage.Row>
                    </div>
                  )
                )}
              </div>
              {upstream.model_mapping &&
                Object.keys(upstream.model_mapping).length > 0 && (
                  <div className="mt-4">
                    <dt className="scroll-m-20 text-xs font-semibold tracking-tight">
                      {t("external_endpoints.fields.modelMapping")}
                    </dt>
                    <div className="mt-2 rounded-md border">
                      <table className="w-full table-fixed text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="w-1/2 px-4 py-2 text-left font-medium">
                              {t("external_endpoints.fields.upstreamModelName")}
                            </th>
                            <th className="w-1/2 px-4 py-2 text-left font-medium">
                              {t("external_endpoints.fields.exposedModelName")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(upstream.model_mapping).map(
                            ([exposed, upstreamModel]) => (
                              <tr
                                key={exposed}
                                className="border-b last:border-0"
                              >
                                <td className="px-4 py-2">
                                  <code className="text-sm">
                                    {upstreamModel}
                                  </code>
                                </td>
                                <td className="px-4 py-2">
                                  <code className="text-sm">{exposed}</code>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </ShowPage.Section>
          );
        })}

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
