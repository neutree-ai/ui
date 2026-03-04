import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type TimeoutUnit,
  displayValueToMs,
  msToDisplayValue,
} from "@/domains/external-endpoint/lib/convert-timeout";
import { NumberInput } from "@/foundation/components/NumberInput";
import { useTranslation } from "@/foundation/lib/i18n";
import { forwardRef, useState } from "react";

interface TimeoutInputProps {
  value?: number;
  onChange?: (value: number) => void;
}

const TimeoutInput = forwardRef<HTMLInputElement, TimeoutInputProps>(
  ({ value = 60000, onChange }, ref) => {
    const { t } = useTranslation();
    const [unit, setUnit] = useState<TimeoutUnit>("s");

    return (
      <div className="flex gap-2">
        <NumberInput
          ref={ref}
          min={0}
          value={msToDisplayValue(value, unit)}
          onValueChange={(num) => {
            if (num >= 0) onChange?.(displayValueToMs(num, unit));
          }}
          placeholder={t("external_endpoints.placeholders.timeout")}
          className="flex-1"
        />
        <Select value={unit} onValueChange={(v) => setUnit(v as TimeoutUnit)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="s">
              {t("external_endpoints.fields.timeoutUnitSeconds")}
            </SelectItem>
            <SelectItem value="min">
              {t("external_endpoints.fields.timeoutUnitMinutes")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  },
);

TimeoutInput.displayName = "TimeoutInput";

export default TimeoutInput;
