import { ChevronDown, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type AITraceExportFormat,
  type AITraceFilterParams,
  exportAITraces,
} from "@/foundation/lib/api/ai-traces";
import { useTranslation } from "@/foundation/lib/i18n";

type TraceExportButtonProps = {
  // The same params the list query is built from.
  params: AITraceFilterParams;
};

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const TraceExportButton = ({ params }: TraceExportButtonProps) => {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: AITraceExportFormat) => {
    setExporting(true);
    try {
      const { blob, filename } = await exportAITraces(params, format);
      saveBlob(blob, filename);
    } catch (error) {
      toast.error(t("ai_traces.export.failed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {exporting
            ? t("ai_traces.export.exporting")
            : t("ai_traces.export.button")}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          {t("ai_traces.export.csv")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("jsonl")}>
          {t("ai_traces.export.jsonl")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {t("ai_traces.export.hint")}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
