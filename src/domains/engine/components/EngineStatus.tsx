import BaseStatus from "@/foundation/components/BaseStatus";
import { useTranslation } from "@/foundation/lib/i18n";
import { STATUS_TONE } from "@/foundation/lib/status-tone";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";
export default function EngineStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  const classMapping = {
    Created: STATUS_TONE.positive,
    Failed: STATUS_TONE.serious,
    Pending: STATUS_TONE.notice,
    Deleted: STATUS_TONE.neutral,
  }[status.phase ?? ""];

  const translatedPhase = t(`status.phases.engine.${status.phase}`);

  return (
    <BaseStatus
      {...status}
      className={classMapping}
      translatedPhase={translatedPhase}
    />
  );
}
