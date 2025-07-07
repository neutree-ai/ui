import { Card, CardContent } from "@/components/ui/card";
import { ShowButton, ShowPage } from "@/components/theme";
import Timestamp from "./Timestamp";
import { useTranslation } from "@refinedev/core";
import type { Metadata } from "@/types";

type MetadataCardProps = {
  metadata: Metadata;
};

export default function MetadataCard({ metadata }: MetadataCardProps) {
  const { translate } = useTranslation();

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-4 gap-8">
          <ShowPage.Row
            title={translate("table.column.name")}
            children={metadata.name}
          />
          {metadata.workspace && (
            <ShowPage.Row
              title={translate("table.column.workspace")}
              children={
                <ShowButton
                  recordItemId={metadata.workspace}
                  meta={{}}
                  variant="link"
                  resource="workspaces"
                >
                  {metadata.workspace}
                </ShowButton>
              }
            />
          )}
        </div>
        <div className="grid grid-cols-4 gap-8">
          <ShowPage.Row
            title={translate("table.column.creation_timestamp")}
            children={<Timestamp timestamp={metadata.creation_timestamp} />}
          />
          <ShowPage.Row
            title={translate("table.column.update_timestamp")}
            children={<Timestamp timestamp={metadata.update_timestamp} />}
          />
        </div>
        {metadata.labels && Object.keys(metadata.labels).length > 0 && (
          <ShowPage.Row
            title={translate("table.column.labels")}
            children={
              <div className="flex flex-wrap gap-2">
                {Object.entries(metadata.labels).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-md"
                  >
                    <span className="font-medium">{key}:</span>
                    <span className="ml-1">{value}</span>
                  </span>
                ))}
              </div>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
