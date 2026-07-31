import type { ReactNode } from "react";
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
        "inline-flex flex-wrap items-center gap-1 rounded-[calc(var(--nt-radius-button)+2px)] bg-[var(--nt-fill-neutral-opaque-1)] p-1 text-[var(--nt-text-neutral-secondary)]",
        className,
      )}
      role="group"
    >
      {items.map((item) => {
        const selected = item.value === value;

        return (
          <button
            aria-pressed={selected}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--nt-radius-button)] px-2.5 text-sm font-medium [transition:background-color_var(--nt-motion-fast),color_var(--nt-motion-fast),box-shadow_var(--nt-motion-fast)] hover:bg-[var(--nt-fill-neutral-trans-3)] hover:text-[var(--nt-text-neutral-super)] focus-visible:outline-none focus-visible:shadow-[var(--nt-outline-active-focus)] disabled:pointer-events-none disabled:opacity-50",
              selected &&
                "bg-[var(--nt-fill-neutral-white)] text-[var(--nt-text-neutral-primary)] shadow-[var(--nt-effect-button-shadow-push-button-ordinary)] hover:bg-[var(--nt-fill-neutral-white)]",
            )}
            disabled={item.disabled}
            key={item.value}
            onClick={() => onValueChange(item.value)}
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
