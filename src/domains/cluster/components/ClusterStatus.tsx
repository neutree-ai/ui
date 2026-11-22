import { useTranslation } from "@/foundation/lib/i18n";
import BaseStatus from "@/foundation/role/BaseStatus";
import { STATUS_TONE } from "@/foundation/role/status-tone";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";
export default function ClusterStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  const classMapping = {
    Running: STATUS_TONE.positive,
    Failed: STATUS_TONE.serious,
    Pending: STATUS_TONE.notice,
    Paused: STATUS_TONE.notice,
    Deleted: STATUS_TONE.neutral,
    Initializing: STATUS_TONE.notice,
    Updating: STATUS_TONE.notice,
    Upgrading:
      "border border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]",
    Deleting: STATUS_TONE.neutral,
  }[status.phase ?? ""];

  const translatedPhase = t(`status.phases.cluster.${status.phase}`);

  return (
    <BaseStatus
      {...status}
      className={classMapping}
      translatedPhase={translatedPhase}
    />
  );
}
