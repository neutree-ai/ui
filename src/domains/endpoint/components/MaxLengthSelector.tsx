import { type ElementRef, forwardRef } from "react";
import type { Slider } from "@/components/ui/slider";
import { useTranslation } from "@/foundation/lib/i18n";
import { ParameterSlider } from "./ParameterSlider";

interface MaxLengthSelectorProps {
  value: number;
  onChange: (v: number) => void;
}

const KB = 1024;
const MB = 1024 * 1024;

export function formatMaxLength(v: number): string {
  if (v >= MB) {
    const m = v / MB;
    return `${Number.isInteger(m) ? m : m.toFixed(2)}M`;
  }
  if (v >= KB) {
    const k = v / KB;
    return `${Number.isInteger(k) ? k : k.toFixed(2)}K`;
  }
  return `${v}`;
}

export const MaxLengthSelector = forwardRef<
  ElementRef<typeof Slider>,
  MaxLengthSelectorProps
>(({ value, onChange }, ref) => {
  const { t } = useTranslation();

  return (
    <ParameterSlider
      ref={ref}
      id="maxlength"
      label={t("components.playground.chat.maximumLength")}
      description={t("components.playground.chat.maximumLengthDescription")}
      min={KB}
      max={MB}
      step={KB}
      value={value}
      onChange={onChange}
      numberInputClassName="h-7 w-24 px-2 text-right text-sm text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      valuePreview={
        <span className="text-xs text-muted-foreground">
          {formatMaxLength(value)}
        </span>
      }
    />
  );
});
