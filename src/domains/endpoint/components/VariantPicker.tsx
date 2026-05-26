import { Check } from "lucide-react";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import type { RecipeVariant } from "@/foundation/recipe/types";

type Props = {
  variants: Record<string, RecipeVariant>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

// VariantPicker renders one button per variant in a horizontal row — matches
// the pattern on recipes.vllm.ai (Hardware/Variant rows use button groups,
// not dropdowns) and the show page's variant tab strip.
export const VariantPicker = ({
  variants,
  value,
  onChange,
  disabled,
}: Props) => {
  const { t } = useTranslation();
  const entries = Object.entries(variants);
  if (entries.length === 0) return null;

  return (
    <div
      role="radiogroup"
      aria-label={t("endpoints.recipe.selectVariant", "Select a variant")}
      className="flex flex-wrap gap-2"
    >
      {entries.map(([key, v]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(key)}
            className={cn(
              "group flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
              "min-w-[180px] max-w-sm",
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-input hover:bg-accent/40",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="font-mono text-sm">{key}</span>
              {selected && <Check className="size-4 text-primary ml-auto" />}
            </div>
            {v.description && (
              <span className="text-xs text-muted-foreground">
                {v.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
