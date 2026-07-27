import { type ElementRef, forwardRef, type ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { NumberInput } from "@/foundation/components/NumberInput";

interface ParameterSliderProps {
  id: string;
  label: string;
  description: string;
  min?: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  numberInputClassName?: string;
  /** Optional content rendered before the numeric input (e.g. a formatted value). */
  valuePreview?: ReactNode;
}

export const ParameterSlider = forwardRef<
  ElementRef<typeof Slider>,
  ParameterSliderProps
>(
  (
    {
      id,
      label,
      description,
      min = 0,
      max,
      step,
      value,
      onChange,
      numberInputClassName = "h-7 w-16 px-2 text-right text-sm text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
      valuePreview,
    },
    ref,
  ) => {
    const clamp = (num: number) => Math.min(Math.max(min, num), max);

    return (
      <div className="grid gap-2 pt-2">
        <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor={id}>{label}</Label>
                <div className="flex items-center gap-2">
                  {valuePreview}
                  <NumberInput
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onValueChange={(num) => onChange(clamp(num))}
                    aria-label={label}
                    className={numberInputClassName}
                  />
                </div>
              </div>
              <Slider
                ref={ref}
                id={id}
                min={min}
                max={max}
                value={[value]}
                step={step}
                onValueChange={(v) => onChange(v[0])}
                className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                aria-label={label}
              />
            </div>
          </HoverCardTrigger>
          <HoverCardContent
            align="start"
            className="w-[260px] text-sm"
            side="left"
          >
            {description}
          </HoverCardContent>
        </HoverCard>
      </div>
    );
  },
);
