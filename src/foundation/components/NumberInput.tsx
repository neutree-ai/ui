import { type ComponentPropsWithoutRef, forwardRef, useState } from "react";
import { Input } from "@/components/ui/input";

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

    const handleInputValue = (nextDraft: string) => {
      setDraft(nextDraft);
      const num = Number.parseFloat(nextDraft);
      if (!Number.isNaN(num)) {
        onValueChange?.(num);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInputValue(e.target.value);
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
        {...rest}
        value={draft ?? displayValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );
  },
);

NumberInput.displayName = "NumberInput";
