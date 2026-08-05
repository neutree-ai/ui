import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/foundation/lib/i18n";
import type { Metadata } from "@/foundation/types/basic-types";
import { ShowPage } from "./ShowPage";
import Timestamp from "./Timestamp";

export function MetadataTimestampMeta({ metadata }: { metadata: Metadata }) {
  const { t } = useTranslation();

  return (
    <ShowPage.Meta label={t("common.fields.updatedAt")}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Timestamp timestamp={metadata.update_timestamp} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t("common.fields.createdAt")}:{" "}
          <Timestamp timestamp={metadata.creation_timestamp} />
        </TooltipContent>
      </Tooltip>
    </ShowPage.Meta>
  );
}
