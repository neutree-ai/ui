import type {
  UpstreamStatus,
  UpstreamStatusPhase,
} from "@/domains/external-endpoint/types";
import BaseStatus from "@/foundation/components/BaseStatus";
import { useTranslation } from "@/foundation/lib/i18n";

const classMapping: Record<UpstreamStatusPhase, string> = {
  Ready:
    "border border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]",
  Failed:
    "border border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
};

export default function UpstreamStatusBadge({
  status,
}: {
  status: UpstreamStatus;
}) {
  const { t } = useTranslation();

  if (!status.phase) {
    return null;
  }

  return (
    <BaseStatus
      phase={status.phase}
      error_message={status.error_message}
      className={classMapping[status.phase]}
      translatedPhase={t(
        `status.phases.externalEndpointUpstream.${status.phase}`,
      )}
    />
  );
}
