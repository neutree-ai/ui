import { Input } from "@/components/ui/input";
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

    const displayValue = msToDisplayValue(value, unit);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const num = Number.parseFloat(e.target.value);
      if (!Number.isNaN(num) && num >= 0) {
        onChange?.(displayValueToMs(num, unit));
      }
    };

    return (
      <div className="flex gap-2">
        <Input
          ref={ref}
          type="number"
          min={0}
          value={displayValue}
          onChange={handleInputChange}
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
