import { type ElementRef, forwardRef } from "react";
import { useTranslation } from "@/foundation/lib/i18n";
import { ParameterSlider } from "./ParameterSlider";

interface TopPSelectorProps {
  value: number;
  onChange: (v: number) => void;
}

export const TopPSelector = forwardRef<
  ElementRef<typeof ParameterSlider>,
  TopPSelectorProps
>(({ value, onChange }, ref) => {
  const { t } = useTranslation();

  return (
    <ParameterSlider
      ref={ref}
      id="top-p"
      label={t("components.playground.chat.topP")}
      description={t("components.playground.chat.topPDescription")}
      max={1}
      step={0.1}
      value={value}
      onChange={onChange}
    />
  );
});
