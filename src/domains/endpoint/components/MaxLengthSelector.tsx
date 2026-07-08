import { type ElementRef, forwardRef } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { NumberInput } from "@/foundation/components/NumberInput";
import { useTranslation } from "@/foundation/lib/i18n";

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
    <div className="grid gap-2 pt-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="maxlength">
                {t("components.playground.chat.maximumLength")}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatMaxLength(value)}
                </span>
                <NumberInput
                  min={KB}
                  max={MB}
                  step={KB}
                  value={value}
                  onValueChange={(num) =>
                    onChange(Math.min(Math.max(KB, num), MB))
                  }
                  aria-label={t("components.playground.chat.maximumLength")}
                  className="h-7 w-24 px-2 text-right text-sm text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>
            <Slider
              ref={ref}
              id="maxlength"
              min={KB}
              max={MB}
              value={[value]}
              step={KB}
              onValueChange={(v) => onChange(v[0])}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              aria-label={t("components.playground.chat.maximumLength")}
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          {t("components.playground.chat.maximumLengthDescription")}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
});
