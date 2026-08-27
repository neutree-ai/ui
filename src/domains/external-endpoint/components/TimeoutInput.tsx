import { forwardRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  displayValueToMs,
  msToDisplayValue,
  type TimeoutUnit,
} from "@/domains/external-endpoint/lib/convert-timeout";
import { NumberInput } from "@/foundation/components/NumberInput";
import { useTranslation } from "@/foundation/lib/i18n";

interface TimeoutInputProps {
  value?: number;
  onChange?: (value: number) => void;
}

const TimeoutInput = forwardRef<HTMLInputElement, TimeoutInputProps>(
  ({ value = 60000, onChange }, ref) => {
    const { t } = useTranslation();
    const [unit, setUnit] = useState<TimeoutUnit>("s");

    return (
      <div className="flex min-w-[248px] w-full">
        <NumberInput
          ref={ref}
          min={0}
          value={msToDisplayValue(value, unit)}
          onValueChange={(num) => {
            if (num >= 0) onChange?.(displayValueToMs(num, unit));
          }}
          placeholder={t("external_endpoints.placeholders.timeout")}
          className="min-w-[120px] flex-1 rounded-r-none"
        />
        <Select value={unit} onValueChange={(v) => setUnit(v as TimeoutUnit)}>
          <SelectTrigger className="w-[120px] rounded-l-none border-l-0">
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
