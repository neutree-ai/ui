import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/foundation/lib/utils";

type SegmentedControlItem<TValue extends string> = {
  value: TValue;
  label: ReactNode;
  disabled?: boolean;
};

type SegmentedControlProps<TValue extends string> = {
  ariaLabel: string;
  value: TValue | null | undefined;
  items: SegmentedControlItem<TValue>[];
  onValueChange: (value: TValue) => void;
  className?: string;
};

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  value,
  items,
  onValueChange,
  className,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-md border bg-background p-1",
        className,
      )}
      role="group"
    >
      {items.map((item) => {
        const selected = item.value === value;

        return (
          <Button
            aria-pressed={selected}
            disabled={item.disabled}
            key={item.value}
            onClick={() => onValueChange(item.value)}
            size="sm"
            type="button"
            variant={selected ? "default" : "ghost"}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}
