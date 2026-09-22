import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { formatThousands } from "@/foundation/lib/token-quota";

// Amount input that re-groups digits with thousands separators as you type
// (10000 → 10,000). Shared by the key's overall token quota and by the
// per-model limit on each allowed-model row, so both read the same way.
// Receives value/onChange either from FormFieldGroup's cloneElement or directly.
export const ThousandsInput = ({
  value,
  onChange,
  ...rest
}: {
  value?: string;
  onChange?: (value: string) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) => (
  <Input
    {...rest}
    type="text"
    inputMode="decimal"
    value={value ?? ""}
    onChange={(e) => onChange?.(formatThousands(e.target.value))}
  />
);
