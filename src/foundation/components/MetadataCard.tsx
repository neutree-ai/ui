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
  showWorkspace?: boolean;
  showTimestamps?: boolean;
};

type KeyValueTagsProps = {
  data: Record<string, string>;
};

export function KeyValueTags({ data }: KeyValueTagsProps) {
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
              className="inline-flex items-center rounded-md border border-border/70 bg-background/40 px-2 py-1 text-xs text-foreground shadow-[0_1px_0_rgba(15,23,42,0.03)]"
            >
              <span className="font-medium text-muted-foreground">{key}:</span>
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
  showWorkspace = true,
  showTimestamps = true,
}: MetadataCardProps) {
  const { translate } = useTranslation();
  const workspace = showWorkspace ? metadata.workspace : null;
  const hasName = showName;
  const hasWorkspace = Boolean(workspace);
  const hasTimestamps = showTimestamps;
  const hasPrimaryFields = hasName || hasWorkspace || hasTimestamps;
  const hasLabels = metadata.labels && Object.keys(metadata.labels).length > 0;
  const hasAnnotations =
    metadata.annotations && Object.keys(metadata.annotations).length > 0;

  if (
    !hasName &&
    !hasWorkspace &&
    !hasTimestamps &&
    !hasLabels &&
    !hasAnnotations
  ) {
    return null;
  }

  return (
    <ShowPage.Section
      title={translate("common.sections.basicInformation")}
      contentClassName={hasPrimaryFields ? undefined : "px-5 pb-5 pt-3"}
    >
      {hasPrimaryFields && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          {hasName && (
            <ShowPage.Row title={translate("common.fields.name")}>
              <span className="break-all">{metadata.name}</span>
            </ShowPage.Row>
          )}
          {hasWorkspace && workspace && (
            <ShowPage.Row title={translate("common.fields.workspace")}>
              <ShowButton
                recordItemId={workspace}
                meta={{}}
                variant="link"
                resource="workspaces"
              >
                {workspace}
              </ShowButton>
            </ShowPage.Row>
          )}
          {hasTimestamps && (
            <ShowPage.Row title={translate("common.fields.createdAt")}>
              <Timestamp timestamp={metadata.creation_timestamp} relative />
            </ShowPage.Row>
          )}
        </div>
      )}
      {hasLabels && (
        <div className={hasPrimaryFields ? "mt-5" : undefined}>
          <ShowPage.Row title={translate("common.fields.labels")}>
            <KeyValueTags data={metadata.labels} />
          </ShowPage.Row>
        </div>
      )}
      {hasAnnotations && (
        <div className={hasPrimaryFields || hasLabels ? "mt-5" : undefined}>
          <ShowPage.Row title={translate("common.fields.annotations")}>
            <KeyValueTags data={metadata.annotations} />
          </ShowPage.Row>
        </div>
      )}
    </ShowPage.Section>
  );
}
