import { useTranslation } from "@/foundation/lib/i18n";
import BaseStatus from "@/foundation/role/BaseStatus";
import { STATUS_TONE } from "@/foundation/role/status-tone";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";
export default function RegistryStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  const classMapping = {
    Connected: STATUS_TONE.positive,
    Failed: STATUS_TONE.serious,
    Pending: STATUS_TONE.notice,
    Deleted: STATUS_TONE.neutral,
  }[status.phase ?? ""];

  const translatedPhase = t(`status.phases.registry.${status.phase}`);

  return (
    <BaseStatus
      {...status}
      className={classMapping}
      translatedPhase={translatedPhase}
    />
  );
}
