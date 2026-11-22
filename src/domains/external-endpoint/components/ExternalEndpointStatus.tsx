import BaseStatus from "@/foundation/components/BaseStatus";
import { useTranslation } from "@/foundation/lib/i18n";
import { STATUS_TONE } from "@/foundation/lib/status-tone";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";

// Degraded is still serving, so it reads as a caution rather than a failure.
const classMapping: Record<string, string> = {
  Running: STATUS_TONE.positive,
  Failed: STATUS_TONE.serious,
  Degraded: STATUS_TONE.notice,
  Pending: STATUS_TONE.notice,
  Deleted: STATUS_TONE.neutral,
};

export default function ExternalEndpointStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  return (
    <BaseStatus
      {...status}
      className={classMapping[status.phase ?? ""]}
      translatedPhase={t(`status.phases.externalEndpoint.${status.phase}`)}
    />
  );
}
