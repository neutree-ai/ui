import BaseStatus from "@/foundation/components/BaseStatus";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";
export default function EndpointStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  const classMapping = {
    Running: "bg-green-100 text-green-800",
    Failed: "bg-red-100 text-red-800",
    Pending: "bg-yellow-100 text-yellow-800",
    Deploying: "bg-blue-100 text-blue-800",
    Deleting: "bg-orange-100 text-orange-800",
    Paused: "bg-yellow-100 text-yellow-800",
    Deleted: "bg-gray-100 text-gray-800",
  }[status.phase ?? "-"];

  const translatedPhase = t(`status.phases.endpoint.${status.phase}`);

  return (
    <BaseStatus
      {...status}
      className={classMapping}
      translatedPhase={translatedPhase}
    />
  );
}
