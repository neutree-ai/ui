import BaseStatus from "@/foundation/components/BaseStatus";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";

// Endpoint phases are read by two domains — `endpoint` owns them, and
// `external-endpoint` shows them for the internal endpoint an upstream points
// at. Cross-domain imports are forbidden (`no-L2-cross-domain`), so per
// contributing/architecture.md the shared component lives in L1 rather than
// being copied into the second domain.
const classMapping: Record<string, string> = {
  Running:
    "border border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]",
  Failed:
    "border border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
  Pending:
    "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
  Deploying:
    "border border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]",
  ModelDownloading:
    "border border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]",
  Deleting:
    "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
  Paused:
    "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
  Deleted:
    "border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]",
};

export default function EndpointStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  return (
    <BaseStatus
      {...status}
      className={status.phase ? classMapping[status.phase] : undefined}
      translatedPhase={t(`status.phases.endpoint.${status.phase}`)}
    />
  );
}
