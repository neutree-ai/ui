import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/foundation/lib/i18n";

// Status codes with a maintained, gateway-accurate description (includes the
// non-standard 499 "client closed request" and 504 "gateway timeout" seen from
// the Kong layer). Codes outside this set fall back to a status-class hint.
// This is also the suggestion list of the status filter — the gateway can emit
// any code, so the filter accepts arbitrary ones on top of these.
export const DESCRIBED_STATUS_CODES = [
  200, 400, 401, 403, 404, 408, 429, 499, 500, 502, 503, 504,
];

const DESCRIBED = new Set(DESCRIBED_STATUS_CODES);

/**
 * Parses free-typed filter input into an HTTP status code.
 * Returns null when the input is not a plausible code (three digits, 1xx–5xx).
 */
export function parseStatusCode(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{3}$/.test(trimmed)) return null;
  const code = Number(trimmed);
  return code >= 100 && code <= 599 ? code : null;
}

export function statusBadgeVariant(
  status: number,
): "default" | "outline" | "destructive" {
  if (status >= 200 && status < 300) return "default";
  if (status >= 400 && status < 500) return "outline";
  return "destructive";
}

export function statusDescription(
  status: number,
  t: (key: string) => string,
): string {
  if (DESCRIBED.has(status)) {
    return t(`ai_traces.status.description.${status}`);
  }
  if (status >= 200 && status < 300) return t("ai_traces.status.classSuccess");
  if (status >= 300 && status < 400) return t("ai_traces.status.classRedirect");
  if (status >= 400 && status < 500) return t("ai_traces.status.classClient");
  if (status >= 500) return t("ai_traces.status.classServer");
  return t("ai_traces.status.unknown");
}

/**
 * Short label for a status code — a couple of words, for lists where the full
 * sentence from `statusDescription` would be truncated.
 */
export function statusShortLabel(
  status: number,
  t: (key: string) => string,
): string {
  if (DESCRIBED.has(status)) {
    return t(`ai_traces.status.short.${status}`);
  }
  if (status >= 200 && status < 300) return t("ai_traces.status.shortSuccess");
  if (status >= 300 && status < 400) return t("ai_traces.status.shortRedirect");
  if (status >= 400 && status < 500) return t("ai_traces.status.shortClient");
  if (status >= 500) return t("ai_traces.status.shortServer");
  return t("ai_traces.status.unknown");
}

export const StatusBadge = ({ status }: { status: number }) => {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={statusBadgeVariant(status)} className="cursor-help">
          {status || "-"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">
        {statusDescription(status, t)}
      </TooltipContent>
    </Tooltip>
  );
};
