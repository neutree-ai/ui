import {
  licensePhaseLabelKey,
  licensePhaseTone,
} from "@/domains/license/lib/phase";
import { useTranslation } from "@/foundation/lib/i18n";
import BaseStatus from "@/foundation/role/BaseStatus";
import type { LicenseStatus as LicenseStatusType } from "@/foundation/types/license";

export function LicenseStatus({ status }: { status: LicenseStatusType }) {
  const { t } = useTranslation();

  return (
    <BaseStatus
      phase={status.phase}
      error_message={status.error_message}
      last_transition_time={status.last_transition_time}
      className={licensePhaseTone(status.phase)}
      translatedPhase={t(licensePhaseLabelKey(status.phase))}
    />
  );
}
