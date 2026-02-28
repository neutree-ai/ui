import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ModelRegistryStatus from "@/domains/model-registry/components/ModelRegistryStatus";
import ModelRegistryType from "@/domains/model-registry/components/ModelRegistryType";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
import { useShow } from "@refinedev/core";

export const ModelRegistriesShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<ModelRegistry>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  return (
    <ShowPage record={record}>
      <MetadataCard metadata={record.metadata} />
      <Card className="mt-4">
        <CardContent>
          <ShowPage.Row title={t("common.fields.status")}>
            <ModelRegistryStatus {...record.status} />
          </ShowPage.Row>
          <div className="grid grid-cols-4 gap-8">
            <ShowPage.Row title={t("common.fields.type")}>
              <ModelRegistryType type={record.spec.type} />
            </ShowPage.Row>
            <ShowPage.Row title={t("model_registries.fields.url")}>
              <a href={record.spec.url} target="_blank" rel="noreferrer">
                <Button variant="link" className="p-0">
                  {record.spec.url}
                </Button>
              </a>
            </ShowPage.Row>
          </div>
        </CardContent>
      </Card>
    </ShowPage>
  );
};
