import { useTranslation } from "@/foundation/lib/i18n";
import Timestamp from "@/foundation/role/Timestamp";
import { ShowPage } from "@/foundation/scene/ShowPage";
import type { Metadata } from "@/foundation/types/basic-types";

export function MetadataTimestampMeta({ metadata }: { metadata: Metadata }) {
  const { t } = useTranslation();

  return (
    <ShowPage.Meta label={t("common.fields.createdAt")}>
      <Timestamp timestamp={metadata.creation_timestamp} relative />
    </ShowPage.Meta>
  );
}
