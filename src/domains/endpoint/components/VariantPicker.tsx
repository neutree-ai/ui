import { Star } from "lucide-react";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { DEFAULT_VARIANT } from "@/foundation/recipe/normalize";
import type { RecipeVariant } from "@/foundation/recipe/types";

type Props = {
  variants: Record<string, RecipeVariant>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

// VariantPicker renders variants as a horizontal segmented tab strip (each tab
// = variant key + its min-VRAM badge), with the selected variant's description
// shown below. This uses horizontal space far better than stacked full-width
// cards and mirrors the show page's variant tab strip.
export const VariantPicker = ({
  variants,
  value,
  onChange,
  disabled,
}: Props) => {
  const { t } = useTranslation();
  const entries = Object.entries(variants);
  if (entries.length === 0) return null;

  const selected = variants[value] ?? entries[0]?.[1];

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label={t("endpoints.recipe.selectVariant", "Select a variant")}
        className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
      >
        {entries.map(([key, v]) => {
          const isSelected = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                isSelected
                  ? "bg-background text-foreground shadow-sm ring-1 ring-primary"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="font-mono">{key}</span>
              {key === DEFAULT_VARIANT && (
                <Star
                  className="size-3 shrink-0 fill-current text-primary"
                  aria-label={t(
                    "endpoints.recipe.defaultVariant",
                    "Default variant",
                  )}
                />
              )}
              {v.vram_minimum_gb != null && (
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                    isSelected
                      ? "border-primary/30 text-muted-foreground"
                      : "border-muted text-muted-foreground",
                  )}
                >
                  ≥{v.vram_minimum_gb} GB
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected?.description && (
        <p className="text-xs text-muted-foreground">{selected.description}</p>
      )}
    </div>
  );
};
