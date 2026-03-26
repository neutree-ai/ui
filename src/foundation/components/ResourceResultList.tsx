import { CheckCircle, Circle, Loader2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/foundation/lib/utils";

export type ResourceResultStatus =
  | "pending"
  | "in-progress"
  | "success"
  | "skipped"
  | "error";

export interface ResourceResultItem {
  label: string;
  name: string;
  status: ResourceResultStatus;
  error?: string;
}

function StatusIcon({ status }: { status: ResourceResultStatus }) {
  switch (status) {
    case "pending":
      return <Circle className="h-5 w-5 text-gray-400 mt-0.5" />;
    case "in-progress":
      return <Loader2 className="h-5 w-5 text-primary animate-spin mt-0.5" />;
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />;
    case "skipped":
      return <CheckCircle className="h-5 w-5 text-gray-600 mt-0.5" />;
    case "error":
      return <XCircle className="h-5 w-5 text-red-600 mt-0.5" />;
  }
}

const bgStyles: Record<ResourceResultStatus, string> = {
  pending: "bg-gray-50 border-gray-200",
  "in-progress": "bg-blue-50 border-blue-200",
  success: "bg-green-50 border-green-200",
  skipped: "bg-gray-50 border-gray-200",
  error: "bg-red-50 border-red-200",
};

interface ResourceResultListProps {
  items: ResourceResultItem[];
}

export function ResourceResultList({ items }: ResourceResultListProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div
          key={item.name}
          className={cn("p-3 rounded-lg border", bgStyles[item.status])}
        >
          <div className="flex items-start gap-3">
            <StatusIcon status={item.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 text-secondary">
                <span className="font-medium">{item.label}</span>
                <span className="text-sm text-muted-foreground">
                  {item.name}
                </span>
              </div>
              {item.status === "success" && (
                <div className="text-sm text-green-700">
                  {t("common.resourceResult.created")}
                </div>
              )}
              {item.status === "skipped" && (
                <div className="text-sm text-gray-500">
                  {t("common.resourceResult.skipped")}
                </div>
              )}
              {item.status === "in-progress" && (
                <div className="text-sm text-blue-600">
                  {t("common.resourceResult.creating")}
                </div>
              )}
              {item.status === "error" && item.error && (
                <div className="text-sm text-red-700 mt-1">
                  <strong>{t("common.resourceResult.error")}:</strong>{" "}
                  {item.error}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
