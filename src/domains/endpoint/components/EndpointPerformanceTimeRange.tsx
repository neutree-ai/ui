import dayjs from "dayjs";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PerformanceTimeRange } from "@/domains/endpoint/hooks/use-endpoint-performance-trends";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import { useTranslation } from "@/foundation/lib/i18n";

const MAX_RANGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_FUTURE_SKEW_SECONDS = 5;
const DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm:ss";

export function EndpointPerformanceTimeRange({
  value,
  onChange,
}: {
  value: PerformanceTimeRange;
  onChange: (range: PerformanceTimeRange) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");

  const start = parseDateTime(draftStart);
  const end = parseDateTime(draftEnd);
  const rangeError = validateRange(start, end);
  const customLabel =
    value.kind === "custom"
      ? `${dayjs.unix(value.start).format("MMM D HH:mm")} – ${dayjs
          .unix(value.end)
          .format("MMM D HH:mm")}`
      : t("endpoints.performance.customRange");

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const customStart =
        value.kind === "custom"
          ? value.start
          : dayjs().subtract(1, "hour").unix();
      const customEnd = value.kind === "custom" ? value.end : dayjs().unix();
      setDraftStart(dayjs.unix(customStart).format(DATE_TIME_FORMAT));
      setDraftEnd(dayjs.unix(customEnd).format(DATE_TIME_FORMAT));
    }
    setOpen(nextOpen);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        ariaLabel={t("endpoints.sections.monitoringMetrics")}
        value={value.kind === "preset" ? value.window : null}
        onValueChange={(window) => onChange({ kind: "preset", window })}
        items={[
          { value: "5m", label: t("endpoints.performance.window5m") },
          { value: "1h", label: t("endpoints.performance.window1h") },
          { value: "24h", label: t("endpoints.performance.window24h") },
        ]}
      />
      <Popover onOpenChange={handleOpenChange} open={open}>
        <PopoverTrigger asChild>
          <Button
            className="h-[34px] max-w-[230px]"
            size="sm"
            type="button"
            variant={value.kind === "custom" ? "outline" : "ghost"}
          >
            <CalendarDays />
            <span className="truncate">{customLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[320px]">
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">
                {t("endpoints.performance.customRangeTitle")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("endpoints.performance.customRangeHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="performance-range-start">
                {t("endpoints.performance.startTime")}
              </Label>
              <Input
                id="performance-range-start"
                max={dayjs().format(DATE_TIME_FORMAT)}
                onChange={(event) => setDraftStart(event.target.value)}
                step={1}
                type="datetime-local"
                value={draftStart}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="performance-range-end">
                {t("endpoints.performance.endTime")}
              </Label>
              <Input
                id="performance-range-end"
                max={dayjs().format(DATE_TIME_FORMAT)}
                onChange={(event) => setDraftEnd(event.target.value)}
                step={1}
                type="datetime-local"
                value={draftEnd}
              />
            </div>
            {rangeError && (
              <p
                className="text-xs text-[var(--nt-text-colorful-serious)]"
                role="alert"
              >
                {t(`endpoints.performance.rangeErrors.${rangeError}`)}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                onClick={() => setOpen(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("buttons.cancel")}
              </Button>
              <Button
                disabled={Boolean(rangeError)}
                onClick={() => {
                  if (start == null || end == null) return;
                  onChange({ kind: "custom", start, end });
                  setOpen(false);
                }}
                size="sm"
                type="button"
              >
                {t("buttons.apply")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function parseDateTime(value: string): number | null {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.unix() : null;
}

function validateRange(
  start: number | null,
  end: number | null,
): "required" | "order" | "future" | "tooLong" | null {
  if (start == null || end == null) return "required";
  const now = dayjs().unix();
  if (start >= end) return "order";
  if (end > now + MAX_FUTURE_SKEW_SECONDS) return "future";
  if (end - start > MAX_RANGE_SECONDS) return "tooLong";
  return null;
}
