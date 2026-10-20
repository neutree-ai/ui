import BaseStatus from "@/foundation/components/BaseStatus";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";

const noticeClass =
  "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]";
const neutralClass =
  "border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]";

export default function LogSinkStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  const classMapping = {
    Running:
      "border border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]",
    Failed:
      "border border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
    Degraded: noticeClass,
    Pending: noticeClass,
    Disabled: neutralClass,
    Deleted: neutralClass,
  }[status.phase ?? ""];

  return (
    <BaseStatus
      {...status}
      className={classMapping}
      translatedPhase={t(`status.phases.logSink.${status.phase}`)}
    />
  );
}
