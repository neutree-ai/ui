import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/foundation/lib/i18n";
import type { RecipeVariant } from "@/foundation/recipe/types";

type Props = {
  variants: Record<string, RecipeVariant>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export const VariantPicker = ({
  variants,
  value,
  onChange,
  disabled,
}: Props) => {
  const { t } = useTranslation();
  const entries = Object.entries(variants);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue
          placeholder={t("endpoints.recipe.selectVariant", "Select a variant")}
        />
      </SelectTrigger>
      <SelectContent>
        {entries.map(([key, v]) => (
          <SelectItem key={key} value={key}>
            <div className="flex flex-col">
              <span className="font-mono text-sm">{key}</span>
              {v.description && (
                <span className="text-xs text-muted-foreground">
                  {v.description}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
