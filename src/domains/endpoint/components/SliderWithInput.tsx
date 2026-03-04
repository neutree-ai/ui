import { Slider } from "@/components/ui/slider";
import { NumberInput } from "@/foundation/components/NumberInput";
import { formatToDecimal } from "@/foundation/lib/unit";
import { type ElementRef, forwardRef } from "react";

interface SliderWithInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  /** Optional: show remaining info, e.g. "Remaining: 10 / 100" */
  remainingInfo?: {
    remaining: number;
    total: number;
    label?: string;
  };
}

export const SliderWithInput = forwardRef<
  ElementRef<typeof Slider>,
  SliderWithInputProps
>(
  (
    {
      value,
      onChange,
      min = 0,
      max,
      step = 1,
      unit,
      disabled = false,
      remainingInfo,
    },
    ref,
  ) => {
    // Clamp value to [min, max] so that programmatic updates (e.g. catalog
    // templates requesting more GPUs than available) never produce negative
    // remaining or out-of-range slider positions.
    const effectiveValue = Math.max(min, Math.min(value, max));

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm text-muted-foreground items-center">
          <div className="flex items-center gap-2">
            <NumberInput
              data-testid="slider-input"
              min={min}
              max={max}
              step={step}
              value={effectiveValue}
              onValueChange={(num) => {
                const clamped = Math.min(Math.max(min, num), max);
                onChange(clamped);
              }}
              onInvalidBlur={() => onChange(min)}
              disabled={disabled}
              className="w-20 h-7 text-sm"
            />
            {unit && <span>{unit}</span>}
          </div>
          {remainingInfo && (
            <span>
              {remainingInfo.label || "Remaining"}:{" "}
              {formatToDecimal(Math.max(0, remainingInfo.remaining))} /{" "}
              {formatToDecimal(remainingInfo.total)}
              {unit ? ` ${unit}` : ""}
            </span>
          )}
        </div>
        <Slider
          ref={ref}
          min={min}
          max={max}
          step={step}
          value={[effectiveValue]}
          onValueChange={(v) => onChange(v[0])}
          disabled={disabled}
        />
      </div>
    );
  },
);

SliderWithInput.displayName = "SliderWithInput";
