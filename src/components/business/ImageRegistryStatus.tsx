import type { ImageRegistry } from "@/types";

export default function ImageRegistryStatus({
  phase,
}: Partial<Pick<Exclude<ImageRegistry["status"], null>, "phase">>) {
  if (!phase) {
    return "-";
  }

  const classMapping = {
    Connected: "bg-green-100 text-green-800",
    Failed: "bg-red-100 text-red-800",
    Pending: "bg-yellow-100 text-yellow-800",
    Deleted: "bg-gray-100 text-gray-800",
  }[phase];
  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded-lg ${classMapping}`}
    >
      {phase}
    </span>
  );
}
