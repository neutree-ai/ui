import dayjs from "dayjs";
import { CalendarDays } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

// DateRange is an inclusive [start, end] window as YYYY-MM-DD strings. Consumers
// decide how to interpret it for their API (e.g. Postgres DATE vs timestamp
// start/end-of-day).
export type DateRange = { start: string; end: string };

const PRESETS = [7, 30, 90];

// trailingRange returns the inclusive window covering the last `days` days up to
// and including today.
export function trailingRange(days: number): DateRange {
  const end = dayjs();
  return {
    start: end.subtract(days - 1, "day").format("YYYY-MM-DD"),
    end: end.format("YYYY-MM-DD"),
  };
}

// DateRangePicker is a reusable date-range control: quick presets plus two
// native date inputs, in a popover. Shared by the trace and model-usage lists.
export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const fromId = useId();
  const toId = useId();
  const label = `${dayjs(value.start).format("MMM D")} – ${dayjs(value.end).format("MMM D")}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("justify-start font-normal", className)}
        >
          <CalendarDays className="size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((d) => (
              <Button
                key={d}
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onChange(trailingRange(d))}
              >
                {t("common.dateRange.lastDays", { days: d })}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={fromId} className="text-xs text-muted-foreground">
                {t("common.dateRange.from")}
              </label>
              <Input
                id={fromId}
                type="date"
                className="h-8 w-[150px]"
                value={value.start}
                max={value.end}
                onChange={(e) =>
                  e.target.value &&
                  onChange({ ...value, start: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={toId} className="text-xs text-muted-foreground">
                {t("common.dateRange.to")}
              </label>
              <Input
                id={toId}
                type="date"
                className="h-8 w-[150px]"
                value={value.end}
                min={value.start}
                onChange={(e) =>
                  e.target.value && onChange({ ...value, end: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
