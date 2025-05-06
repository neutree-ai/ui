import MetadataCard from "@/components/business/MetadataCard";
import ModelRegistryStatus from "@/components/business/ModelRegistryStatus";
import ModelRegistryType from "@/components/business/ModelRegistryType";
import { ShowPage } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ModelRegistry } from "@/types";
import { useShow } from "@refinedev/core";

export const ModelRegistriesShow = () => {
  const {
    query: { data, isLoading },
  } = useShow<ModelRegistry>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>404 not found</div>;
  }

  return (
    <ShowPage record={record}>
      <MetadataCard metadata={record.metadata} />
      <Card className="mt-4">
        <CardContent>
          <ShowPage.Row title={"Status"}>
            <ModelRegistryStatus phase={record.status?.phase} />
          </ShowPage.Row>
          <div className="grid grid-cols-4 gap-8">
            <ShowPage.Row title={"Type"}>
              <ModelRegistryType type={record.spec.type} />
            </ShowPage.Row>
            <ShowPage.Row title={"URL"}>
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
