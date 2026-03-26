import { useShow } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CurlExample from "@/domains/external-endpoint/components/CurlExample";
import ExternalEndpointStatus from "@/domains/external-endpoint/components/ExternalEndpointStatus";
import { formatTimeout } from "@/domains/external-endpoint/lib/convert-timeout";
import { getExposedModels } from "@/domains/external-endpoint/lib/get-exposed-models";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
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

  return (
    <ShowPage record={record}>
      <MetadataCard metadata={record.metadata} />
      <Card className="mt-4">
        <CardContent>
          <ShowPage.Row title={t("common.fields.status")}>
            <ExternalEndpointStatus {...record.status} />
          </ShowPage.Row>
          <div className="grid grid-cols-4 gap-8">
            <ShowPage.Row title={t("external_endpoints.fields.timeout")}>
              {formatTimeout(record.spec?.timeout)}
            </ShowPage.Row>
            {record.status?.service_url && (
              <div className="col-span-3">
                <ShowPage.Row title={t("external_endpoints.fields.serviceUrl")}>
                  <ServiceUrls serviceUrl={record.status.service_url} />
                </ShowPage.Row>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {record.spec?.upstreams?.map((upstream, index) => (
        <Card key={index} className="mt-4">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">
              {t("external_endpoints.sections.upstream", {
                index: index + 1,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-8">
              {upstream.endpoint_ref ? (
                <div className="col-span-3">
                  <ShowPage.Row
                    title={t("external_endpoints.fields.endpointRef")}
                  >
                    <code className="text-sm break-all">
                      {upstream.endpoint_ref}
                    </code>
                  </ShowPage.Row>
                </div>
              ) : (
                <>
                  {upstream.upstream?.url && (
                    <div className="col-span-3">
                      <ShowPage.Row
                        title={t("external_endpoints.fields.upstreamUrl")}
                      >
                        <code className="text-sm break-all">
                          {upstream.upstream.url}
                        </code>
                      </ShowPage.Row>
                    </div>
                  )}
                </>
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
                            {t("external_endpoints.fields.exposedModelName")}
                          </th>
                          <th className="w-1/2 px-4 py-2 text-left font-medium">
                            {t("external_endpoints.fields.upstreamModelName")}
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
                                <code className="text-sm">{exposed}</code>
                              </td>
                              <td className="px-4 py-2">
                                <code className="text-sm">{upstreamModel}</code>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      ))}

      {record.status?.phase === "Running" && record.status?.service_url && (
        <CurlExample
          serviceUrl={record.status.service_url}
          models={allModels}
        />
      )}
    </ShowPage>
  );
};
