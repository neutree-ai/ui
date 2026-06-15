import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/foundation/lib/utils";

export type CalendarProps = ComponentProps<typeof DayPicker>;

// shadcn-style calendar built on react-day-picker (v9/v10 classNames API).
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // `months` is the positioning context for the nav. react-day-picker v10
        // renders <Nav> here (a sibling of the month), so anchoring the prev/next
        // buttons to it keeps them inside the calendar caption row instead of
        // escaping up to the popover.
        months: "relative flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex h-7 items-center justify-center",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex h-7 items-center justify-between px-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        // In v10 the range/selected/today modifier classes land on the day <td>
        // (not the button), so rounding is applied here directly. Round only the
        // outer ends of the range — including a row's first/last cell so a window
        // that wraps weeks stays clean.
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&[aria-selected]:first-child]:rounded-l-md [&[aria-selected]:last-child]:rounded-r-md",
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100",
        ),
        range_start: "rounded-l-md",
        range_end: "rounded-r-md",
        range_middle: "bg-accent text-accent-foreground",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        // Only style "today" when it isn't part of the selection, otherwise its
        // full rounding/background fights the range boundary styles.
        today:
          "[&:not([aria-selected])]:bg-accent [&:not([aria-selected])]:text-accent-foreground [&:not([aria-selected])]:rounded-md",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", chevronClassName)} />
          ) : (
            <ChevronRight className={cn("size-4", chevronClassName)} />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
