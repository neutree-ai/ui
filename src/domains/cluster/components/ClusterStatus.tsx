import BaseStatus from "@/foundation/components/BaseStatus";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";
export default function ClusterStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  const classMapping = {
    Running:
      "border border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]",
    Failed:
      "border border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
    Pending:
      "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
    Paused:
      "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
    Deleted:
      "border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]",
    Initializing:
      "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
    Updating:
      "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
    Upgrading:
      "border border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]",
    Deleting:
      "border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]",
  }[status.phase ?? "-"];

  const translatedPhase = t(`status.phases.cluster.${status.phase}`);

  return (
    <BaseStatus
      {...status}
      className={classMapping}
      translatedPhase={translatedPhase}
    />
  );
}
