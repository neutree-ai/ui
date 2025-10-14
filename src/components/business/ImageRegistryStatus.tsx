import { useTranslation } from "@/lib/i18n";
import type { BaseStatus as BaseStatusType } from "@/types";
import BaseStatus from "./BaseStatus";

export default function ImageRegistryStatus(status: BaseStatusType) {
  const { t } = useTranslation();

  const classMapping = {
    Connected: "bg-green-100 text-green-800",
    Failed: "bg-red-100 text-red-800",
    Pending: "bg-yellow-100 text-yellow-800",
    Deleted: "bg-gray-100 text-gray-800",
  }[status.phase ?? "-"];

  const translatedPhase = t(`status.phases.registry.${status.phase}`);

  return (
    <BaseStatus
      {...status}
      className={classMapping}
      translatedPhase={translatedPhase}
    />
  );
}
