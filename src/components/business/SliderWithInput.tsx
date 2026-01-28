import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatToDecimal } from "@/lib/unit";
import { type ElementRef, forwardRef, useEffect, useState } from "react";

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
    // Local state for input display value, allowing empty string while typing
    const [inputValue, setInputValue] = useState<string>(String(value));

    // Sync local state when external value changes (e.g., from slider or parent)
    useEffect(() => {
      setInputValue(String(value));
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      // If it's a valid number, commit immediately for real-time slider response
      const numValue = Number(newValue);
      if (newValue !== "" && !Number.isNaN(numValue)) {
        const clampedValue = Math.min(Math.max(min, numValue), max);
        onChange(clampedValue);
      }
    };

    const handleBlur = () => {
      // On blur, normalize display and handle empty/invalid input
      const numValue = Number(inputValue);
      if (inputValue === "" || Number.isNaN(numValue)) {
        setInputValue(String(min));
        onChange(min);
      } else {
        // Sync display with actual clamped value
        setInputValue(String(value));
      }
    };

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm text-muted-foreground items-center">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={min}
              max={max}
              step={step}
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleBlur}
              disabled={disabled}
              className="w-20 h-7 text-sm"
            />
            {unit && <span>{unit}</span>}
          </div>
          {remainingInfo && (
            <span>
              {remainingInfo.label || "Remaining"}:{" "}
              {formatToDecimal(remainingInfo.remaining)} /{" "}
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
          value={[value]}
          onValueChange={(v) => onChange(v[0])}
          disabled={disabled}
        />
      </div>
    );
  },
);

SliderWithInput.displayName = "SliderWithInput";

export default SliderWithInput;
