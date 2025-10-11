import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useTranslation } from "@/lib/i18n";
import { type ElementRef, forwardRef } from "react";

interface TemperatureSelectorProps {
  value: number;
  onChange: (v: number) => void;
}

export const TemperatureSelector = forwardRef<
  ElementRef<typeof Slider>,
  TemperatureSelectorProps
>(({ value, onChange }, ref) => {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2 pt-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature">
                {t("components.playground.chat.temperature")}
              </Label>
              <span className="w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm text-muted-foreground hover:border-border">
                {value}
              </span>
            </div>
            <Slider
              ref={ref}
              id="temperature"
              max={1}
              value={[value]}
              step={0.1}
              onValueChange={(v) => onChange(v[0])}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              aria-label={t("components.playground.chat.temperature")}
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          {t("components.playground.chat.temperatureDescription")}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
});
