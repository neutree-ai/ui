import type { ClusterSpec } from "@/types";
import { useTranslation } from "react-i18next";

const clusterTypeMap: Record<string, string> = {
  ssh: "multipleStaticNodes",
  kubernetes: "kubernetes",
};

export default function ClusterType({ type }: { type: ClusterSpec["type"] }) {
  const { t } = useTranslation();
  const translationKey = clusterTypeMap[type] || type;

  return (
    <div className="flex gap-1 items-center">
      <div>
        {t(`clusters.options.${translationKey}`, { defaultValue: type })}
      </div>
    </div>
  );
}
