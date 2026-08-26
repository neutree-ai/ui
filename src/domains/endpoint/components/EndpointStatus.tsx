import BaseStatus from "@/foundation/components/BaseStatus";
import { endpointStatusClass } from "@/foundation/lib/endpoint-status-class";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";
export default function EndpointStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  const classMapping = endpointStatusClass(status.phase);

  const translatedPhase = t(`status.phases.endpoint.${status.phase}`);

  return (
    <BaseStatus
      {...status}
      className={classMapping}
      translatedPhase={translatedPhase}
    />
  );
}
