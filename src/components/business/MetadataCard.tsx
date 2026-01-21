import { ShowButton, ShowPage } from "@/components/theme";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const MAX_VALUE_LENGTH = 30;

  const truncateValue = (value: string) => {
    if (value.length > MAX_VALUE_LENGTH) {
      return `${value.substring(0, MAX_VALUE_LENGTH)}...`;
    }
    return value;
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {Object.entries(data).map(([key, value]) => {
          const shouldTruncate = value.length > MAX_VALUE_LENGTH;

          return (
            <span
              key={key}
              className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-md"
            >
              <span className="font-medium">{key}:</span>
              {shouldTruncate ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 cursor-help">
                      {truncateValue(value)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md max-h-96 overflow-y-auto">
                    <p className="break-all whitespace-pre-wrap">{value}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="ml-1">{value}</span>
              )}
            </span>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export default function MetadataCard({ metadata }: MetadataCardProps) {
  const { translate } = useTranslation();

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-4 gap-8">
          <ShowPage.Row
            title={translate("common.fields.name")}
            children={<span className="break-all">{metadata.name}</span>}
          />
          {metadata.workspace && (
            <ShowPage.Row
              title={translate("common.fields.workspace")}
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
            title={translate("common.fields.createdAt")}
            children={<Timestamp timestamp={metadata.creation_timestamp} />}
          />
          <ShowPage.Row
            title={translate("common.fields.updatedAt")}
            children={<Timestamp timestamp={metadata.update_timestamp} />}
          />
        </div>
        {metadata.labels && Object.keys(metadata.labels).length > 0 && (
          <ShowPage.Row
            title={translate("common.fields.labels")}
            children={<KeyValueTags data={metadata.labels} />}
          />
        )}
        {metadata.annotations &&
          Object.keys(metadata.annotations).length > 0 && (
            <ShowPage.Row
              title={translate("common.fields.annotations")}
              children={<KeyValueTags data={metadata.annotations} />}
            />
          )}
      </CardContent>
    </Card>
  );
}
