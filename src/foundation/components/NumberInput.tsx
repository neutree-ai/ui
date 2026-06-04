import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useRef,
  useState,
} from "react";
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
    const lastEmittedDraftRef = useRef<string | null>(null);

    const displayValue = String(value);

    const handleFocus = () => {
      setDraft(displayValue);
      lastEmittedDraftRef.current = null;
    };

    const handleInputValue = (nextDraft: string) => {
      setDraft(nextDraft);
      const num = Number.parseFloat(nextDraft);
      if (!Number.isNaN(num)) {
        if (lastEmittedDraftRef.current === nextDraft) return;
        lastEmittedDraftRef.current = nextDraft;
        onValueChange?.(num);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInputValue(e.target.value);
    };

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
      handleInputValue(e.currentTarget.value);
    };

    const handleBlur = () => {
      const num = Number.parseFloat(draft ?? "");
      if (draft === "" || Number.isNaN(num)) {
        onInvalidBlur?.();
      }
      setDraft(null);
      lastEmittedDraftRef.current = null;
    };

    return (
      <Input
        ref={ref}
        type="number"
        {...rest}
        value={draft ?? displayValue}
        onFocus={handleFocus}
        onInput={handleInput}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );
  },
);

NumberInput.displayName = "NumberInput";
