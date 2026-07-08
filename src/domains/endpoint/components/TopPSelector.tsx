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

interface TopPSelectorProps {
  value: number;
  onChange: (v: number) => void;
}

export const TopPSelector = forwardRef<
  ElementRef<typeof Slider>,
  TopPSelectorProps
>(({ value, onChange }: TopPSelectorProps, ref) => {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2 pt-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="top-p">
                {t("components.playground.chat.topP")}
              </Label>
              <NumberInput
                min={0}
                max={1}
                step={0.1}
                value={value}
                onValueChange={(num) => onChange(Math.min(Math.max(0, num), 1))}
                aria-label={t("components.playground.chat.topP")}
                className="h-7 w-16 px-2 text-right text-sm text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <Slider
              id="top-p"
              ref={ref}
              max={1}
              value={[value]}
              step={0.1}
              onValueChange={(v) => onChange(v[0])}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              aria-label={t("components.playground.chat.topP")}
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          {t("components.playground.chat.topPDescription")}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
});
