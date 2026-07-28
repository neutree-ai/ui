import dayjs from "dayjs";
import { CalendarDays } from "lucide-react";
import type { DateRange as RdpRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

const DEFAULT_PRESETS = [7, 30, 90];

// trailingRange returns the inclusive window covering the last `days` days up to
// and including today.
export function trailingRange(days: number): DateRange {
  const end = dayjs();
  return {
    start: end.subtract(days - 1, "day").format("YYYY-MM-DD"),
    end: end.format("YYYY-MM-DD"),
  };
}

// DateRangePicker is a reusable date-range control: quick presets plus a
// shadcn calendar (react-day-picker), in a popover. Shared by the trace and
// model-usage lists.
// `presets` lets a caller narrow the quick picks to what its data actually
// covers — e.g. access logs are only retained for 30 days.
export function DateRangePicker({
  value,
  onChange,
  className,
  presets = DEFAULT_PRESETS,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  presets?: number[];
}) {
  const { t } = useTranslation();
  const label = `${dayjs(value.start).format("MMM D")} – ${dayjs(value.end).format("MMM D")}`;
  const selected: RdpRange = {
    from: dayjs(value.start).toDate(),
    to: dayjs(value.end).toDate(),
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 justify-start font-normal", className)}
        >
          <CalendarDays className="size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex flex-wrap gap-1 border-b p-2">
          {presets.map((d) => (
            <Button
              key={d}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(trailingRange(d))}
            >
              {t("common.dateRange.lastDays", { days: d })}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          defaultMonth={selected.from}
          selected={selected}
          onSelect={(r: RdpRange | undefined) => {
            if (r?.from) {
              onChange({
                start: dayjs(r.from).format("YYYY-MM-DD"),
                end: dayjs(r.to ?? r.from).format("YYYY-MM-DD"),
              });
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
