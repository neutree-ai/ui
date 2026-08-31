import { Star } from "lucide-react";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import { useTranslation } from "@/foundation/lib/i18n";
import { DEFAULT_VARIANT } from "@/foundation/recipe/normalize";
import type { RecipeVariant } from "@/foundation/recipe/types";

type Props = {
  variants: Record<string, RecipeVariant>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

// A single-line segment control: each variant is a compact button naming
// itself and its VRAM floor, with the fuller description held in a tooltip
// rather than always on screen — the same information a card list showed,
// without the vertical space a card list costs when a recipe has several.
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
    <SegmentedControl
      ariaLabel={t("endpoints.recipe.selectVariant", "Select a variant")}
      value={value}
      onValueChange={onChange}
      items={entries.map(([key, v]) => ({
        value: key,
        disabled,
        description: v.description,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono">{key}</span>
            {key === DEFAULT_VARIANT && (
              <Star
                aria-label={t(
                  "endpoints.recipe.defaultVariant",
                  "Default variant",
                )}
                className="size-3 shrink-0 fill-[var(--nt-fill-outstanding-base)] text-[var(--nt-fill-outstanding-base)]"
              />
            )}
            {v.vram_minimum_gb != null && (
              <span className="text-[10px] text-[var(--nt-text-neutral-tertiary)]">
                ≥{v.vram_minimum_gb} GB
              </span>
            )}
          </span>
        ),
      }))}
    />
  );
};
