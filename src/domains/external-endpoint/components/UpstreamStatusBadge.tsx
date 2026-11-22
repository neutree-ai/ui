import type {
  UpstreamStatus,
  UpstreamStatusPhase,
} from "@/domains/external-endpoint/types";
import { useTranslation } from "@/foundation/lib/i18n";
import BaseStatus from "@/foundation/role/BaseStatus";
import { STATUS_TONE } from "@/foundation/role/status-tone";

const classMapping: Record<UpstreamStatusPhase, string> = {
  Ready: STATUS_TONE.positive,
  Failed: STATUS_TONE.serious,
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
