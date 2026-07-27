import { type ElementRef, forwardRef } from "react";
import { useTranslation } from "@/foundation/lib/i18n";
import { ParameterSlider } from "./ParameterSlider";

interface TemperatureSelectorProps {
  value: number;
  onChange: (v: number) => void;
}

export const TemperatureSelector = forwardRef<
  ElementRef<typeof ParameterSlider>,
  TemperatureSelectorProps
>(({ value, onChange }, ref) => {
  const { t } = useTranslation();

  return (
    <ParameterSlider
      ref={ref}
      id="temperature"
      label={t("components.playground.chat.temperature")}
      description={t("components.playground.chat.temperatureDescription")}
      max={1}
      step={0.1}
      value={value}
      onChange={onChange}
    />
  );
});
