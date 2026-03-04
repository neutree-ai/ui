import { Input } from "@/components/ui/input";
import { type ComponentPropsWithoutRef, forwardRef, useState } from "react";

type NumberInputProps = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  "value" | "onChange" | "onBlur" | "onFocus" | "type"
> & {
  value: number | string;
  onValueChange?: (value: number) => void;
  /** Called on blur when the input is empty or invalid. Defaults to no-op (snaps back to display value). */
  onInvalidBlur?: () => void;
};

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, onInvalidBlur, ...rest }, ref) => {
    const [draft, setDraft] = useState<string | null>(null);

    const displayValue = String(value);

    const handleFocus = () => {
      setDraft(displayValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setDraft(e.target.value);
      const num = Number.parseFloat(e.target.value);
      if (!Number.isNaN(num)) {
        onValueChange?.(num);
      }
    };

    const handleBlur = () => {
      const num = Number.parseFloat(draft ?? "");
      if (draft === "" || Number.isNaN(num)) {
        onInvalidBlur?.();
      }
      setDraft(null);
    };

    return (
      <Input
        ref={ref}
        type="number"
        value={draft ?? displayValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        {...rest}
      />
    );
  },
);

NumberInput.displayName = "NumberInput";
