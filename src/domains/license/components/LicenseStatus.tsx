import { useTranslation } from "@/foundation/lib/i18n";
import BaseStatus from "@/foundation/role/BaseStatus";
import { STATUS_TONE } from "@/foundation/role/status-tone";
import type { LicenseStatus as LicenseStatusType } from "@/foundation/types/license";

const classMapping: Record<string, string> = {
  Active: STATUS_TONE.positive,
  Expired: STATUS_TONE.serious,
  Invalid: STATUS_TONE.serious,
  Pending: STATUS_TONE.notice,
};

export function LicenseStatus({ status }: { status: LicenseStatusType }) {
  const { t } = useTranslation();

  return (
    <BaseStatus
      phase={status.phase}
      error_message={status.error_message}
      last_transition_time={status.last_transition_time}
      className={classMapping[status.phase] ?? STATUS_TONE.neutral}
      translatedPhase={t(`license.phase.${status.phase.toLowerCase()}`)}
    />
  );
}
