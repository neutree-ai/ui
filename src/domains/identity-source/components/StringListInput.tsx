import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type StringListInputProps = {
  value?: string[] | null;
  onChange?: (value: string[]) => void;
  onBlur?: () => void;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  /** "lines": one entry per line in a textarea; "words": space separated. */
  mode?: "lines" | "words";
};

/**
 * Edits a string array as text. Entries are kept as typed (including the
 * empty one being started), so typing never loses the separator; the form
 * drops blank entries when it submits.
 */
export const StringListInput = forwardRef<
  HTMLTextAreaElement & HTMLInputElement,
  StringListInputProps
>(({ value, onChange, mode = "lines", ...props }, ref) => {
  const separator = mode === "lines" ? "\n" : " ";
  const text = Array.isArray(value) ? value.join(separator) : "";
  const split = (raw: string) =>
    mode === "lines" ? raw.split(/\r?\n/) : raw.split(/[ ,]/);

  if (mode === "words") {
    return (
      <Input
        ref={ref}
        {...props}
        value={text}
        onChange={(e) => onChange?.(split(e.target.value))}
      />
    );
  }

  return (
    <Textarea
      ref={ref}
      rows={3}
      {...props}
      value={text}
      onChange={(e) => onChange?.(split(e.target.value))}
    />
  );
});

StringListInput.displayName = "StringListInput";
