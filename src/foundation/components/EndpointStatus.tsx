import BaseStatus from "@/foundation/components/BaseStatus";
import { useTranslation } from "@/foundation/lib/i18n";
import { STATUS_TONE } from "@/foundation/lib/status-tone";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";

// Endpoint phases are read by two domains — `endpoint` owns them, and
// `external-endpoint` shows them for the internal endpoint an upstream points
// at. Cross-domain imports are forbidden (`no-L2-cross-domain`), so per
// contributing/architecture.md the shared component lives in L1 rather than
// being copied into the second domain.
export const endpointPhaseClassMapping: Record<string, string> = {
  Running: STATUS_TONE.positive,
  Failed: STATUS_TONE.serious,
  Pending: STATUS_TONE.notice,
  // External endpoints only: serving, but some upstream is unavailable
  Degraded: STATUS_TONE.notice,
  Deploying:
    "border border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]",
  ModelDownloading:
    "border border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]",
  Deleting: STATUS_TONE.notice,
  Paused: STATUS_TONE.notice,
  Deleted: STATUS_TONE.neutral,
};

export default function EndpointStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  return (
    <BaseStatus
      {...status}
      className={
        status.phase ? endpointPhaseClassMapping[status.phase] : undefined
      }
      translatedPhase={t(`status.phases.endpoint.${status.phase}`)}
    />
  );
}
