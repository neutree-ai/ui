import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/foundation/providers/auth-provider";
import dayjs from "dayjs";
import { CalendarIcon, Download, RefreshCw, Search, X } from "lucide-react";
import { type FC, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { VirtualLog } from "./VirtualLog";

interface LogViewerProps {
  source: string; // Complete log content
  downloadUrl?: string;
  height?: number | string;
  defaultFontSize?: number;
  onRefresh?: () => void;
}

/**
 * LogViewer Component
 *
 * A comprehensive log viewing component with search, filtering, and virtualization capabilities.
 * All filtering and processing is done on the frontend for better responsiveness.
 *
 * Features include:
 * - Virtualized rendering for performance with large logs
 * - Search with highlighting
 * - Time-based filtering (frontend-based)
 * - Reverse ordering
 * - Download functionality
 * - Responsive design with theme support
 */
export const LogViewer: FC<LogViewerProps> = ({
  source,
  downloadUrl,
  height = "100%",
  defaultFontSize = 12,
  onRefresh,
}) => {
  const { t } = useTranslation();

  // State management
  const [search, setSearch] = useState<string>("");
  const [reverse, setReverse] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [fontSize] = useState<number>(defaultFontSize);

  /**
   * Clear time filters
   */
  const clearTimeFilters = useCallback(() => {
    setStartTime("");
    setEndTime("");
  }, []);

  /**
   * Handle refresh button click
   */
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  /**
   * Handle download with auth headers
   */
  const handleDownload = useCallback(async () => {
    if (!downloadUrl) return;

    try {
      const { data } = await auth.getSession();
      const token = data.session?.access_token;

      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(downloadUrl, {
        headers,
      });

      if (!response.ok) {
        toast.error(`Download failed: ${await response.text()}`);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Try to get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "log.txt";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch?.[1]) {
          filename = filenameMatch[1];
        }
      } else {
        // Fallback to filename from URL
        const urlParts = downloadUrl.split("/");
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart) filename = lastPart;
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error(`Download error: ${String(error)}`);
    }
  }, [downloadUrl]);

  /**
   * Toolbar component
   */
  const Toolbar = (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-muted/30">
      {/* Search Input */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("components.logViewer.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Reverse Checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="reverse-logs"
          checked={reverse}
          onCheckedChange={(checked) => setReverse(checked === true)}
        />
        <Label htmlFor="reverse-logs" className="text-sm font-normal">
          {t("components.logViewer.reverse")}
        </Label>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Time Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">
          {t("components.logViewer.timeFilter")}:
        </Label>

        {/* Start Time */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startTime
                ? dayjs(startTime).format("MM-DD HH:mm")
                : t("components.logViewer.startTime")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="space-y-2">
              <Label htmlFor="start-time" className="text-sm">
                {t("components.logViewer.startTime")}
              </Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* End Time */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endTime
                ? dayjs(endTime).format("MM-DD HH:mm")
                : t("components.logViewer.endTime")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="space-y-2">
              <Label htmlFor="end-time" className="text-sm">
                {t("components.logViewer.endTime")}
              </Label>
              <Input
                id="end-time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {(startTime || endTime) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTimeFilters}
            className="px-2"
            title="Clear time filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t("buttons.refresh")}
        </Button>

        {downloadUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {t("components.logViewer.download")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="flex flex-col border rounded-lg bg-background"
      style={{ height }}
    >
      {Toolbar}

      <VirtualLog
        log={source}
        search={search}
        reverse={reverse}
        startTime={startTime || undefined}
        endTime={endTime || undefined}
        fontSize={fontSize}
      />
    </div>
  );
};
