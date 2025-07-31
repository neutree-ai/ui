import { useTranslation } from "@/lib/i18n";
import type { EndpointPhase } from "@/types";

export default function EndpointStatus({
  phase,
}: {
  phase: EndpointPhase | null | undefined;
}) {
  const { t } = useTranslation();

  if (!phase) {
    return "-";
  }

  const classMapping = {
    Running: "bg-green-100 text-green-800",
    Failed: "bg-red-100 text-red-800",
    Pending: "bg-yellow-100 text-yellow-800",
    Deleted: "bg-gray-100 text-gray-800",
  }[phase];

  const translatedPhase = t(`status.phases.endpoint.${phase}`);

  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded-lg ${classMapping}`}
    >
      {translatedPhase}
    </span>
  );
}
