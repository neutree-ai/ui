import { useTranslation } from "@/foundation/lib/i18n";
import BaseStatus from "@/foundation/role/BaseStatus";
import { STATUS_TONE } from "@/foundation/role/status-tone";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";

const classMapping: Record<string, string> = {
  Running: STATUS_TONE.positive,
  Failed: STATUS_TONE.serious,
  Degraded: STATUS_TONE.notice,
  Pending: STATUS_TONE.notice,
  Disabled: STATUS_TONE.neutral,
  Deleted: STATUS_TONE.neutral,
};

export default function LogSinkStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  return (
    <BaseStatus
      {...status}
      className={classMapping[status.phase ?? ""]}
      translatedPhase={t(`status.phases.logSink.${status.phase}`)}
    />
  );
}
