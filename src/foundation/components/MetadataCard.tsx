import { useTranslation } from "@refinedev/core";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import type { Metadata } from "@/foundation/types/basic-types";
import Timestamp from "./Timestamp";

type MetadataCardProps = {
  metadata: Metadata;
  showName?: boolean;
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

export default function MetadataCard({
  metadata,
  showName = true,
}: MetadataCardProps) {
  const { translate } = useTranslation();

  return (
    <ShowPage.Section title={translate("common.sections.basicInformation")}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {showName && (
          <ShowPage.Row title={translate("common.fields.name")}>
            <span className="break-all">{metadata.name}</span>
          </ShowPage.Row>
        )}
        {metadata.workspace && (
          <ShowPage.Row title={translate("common.fields.workspace")}>
            <ShowButton
              recordItemId={metadata.workspace}
              meta={{}}
              variant="link"
              resource="workspaces"
            >
              {metadata.workspace}
            </ShowButton>
          </ShowPage.Row>
        )}
        <ShowPage.Row title={translate("common.fields.createdAt")}>
          <Timestamp timestamp={metadata.creation_timestamp} />
        </ShowPage.Row>
        <ShowPage.Row title={translate("common.fields.updatedAt")}>
          <Timestamp timestamp={metadata.update_timestamp} />
        </ShowPage.Row>
      </div>
      {metadata.labels && Object.keys(metadata.labels).length > 0 && (
        <div className="mt-5">
          <ShowPage.Row title={translate("common.fields.labels")}>
            <KeyValueTags data={metadata.labels} />
          </ShowPage.Row>
        </div>
      )}
      {metadata.annotations && Object.keys(metadata.annotations).length > 0 && (
        <div className="mt-5">
          <ShowPage.Row title={translate("common.fields.annotations")}>
            <KeyValueTags data={metadata.annotations} />
          </ShowPage.Row>
        </div>
      )}
    </ShowPage.Section>
  );
}
