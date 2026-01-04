import { ShowButton, ShowPage } from "@/components/theme";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "@/types";
import { useTranslation } from "@refinedev/core";
import Timestamp from "./Timestamp";

type MetadataCardProps = {
  metadata: Metadata;
};

type KeyValueTagsProps = {
  data: Record<string, string>;
};

function KeyValueTags({ data }: KeyValueTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(data).map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-md"
        >
          <span className="font-medium">{key}:</span>
          <span className="ml-1">{value}</span>
        </span>
      ))}
    </div>
  );
}

export default function MetadataCard({ metadata }: MetadataCardProps) {
  const { translate } = useTranslation();

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-4 gap-8">
          <ShowPage.Row
            title={translate("table.column.name")}
            children={<span className="break-all">{metadata.name}</span>}
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
            children={<KeyValueTags data={metadata.labels} />}
          />
        )}
        {metadata.annotations &&
          Object.keys(metadata.annotations).length > 0 && (
            <ShowPage.Row
              title={translate("table.column.annotations")}
              children={<KeyValueTags data={metadata.annotations} />}
            />
          )}
      </CardContent>
    </Card>
  );
}
