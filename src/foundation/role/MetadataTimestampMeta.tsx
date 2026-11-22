import { useTranslation } from "@/foundation/lib/i18n";
import type { Metadata } from "@/foundation/types/basic-types";
import { ShowPage } from "./ShowPage";
import Timestamp from "./Timestamp";

export function MetadataTimestampMeta({ metadata }: { metadata: Metadata }) {
  const { t } = useTranslation();

  return (
    <ShowPage.Meta label={t("common.fields.createdAt")}>
      <Timestamp timestamp={metadata.creation_timestamp} relative />
    </ShowPage.Meta>
  );
}
