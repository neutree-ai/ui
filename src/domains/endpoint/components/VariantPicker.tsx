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

// VariantPicker renders variants as native radio rows so the form choice is
// semantically a single-select input while keeping descriptions comparable.
export const VariantPicker = ({
  variants,
  value,
  onChange,
  disabled,
}: Props) => {
  const { t } = useTranslation();
  const entries = Object.entries(variants);
  if (entries.length === 0) return null;

  const radioName = "endpoint-variant";

  return (
    <div
      role="radiogroup"
      aria-label={t("endpoints.recipe.selectVariant", "Select a variant")}
      className="space-y-2"
    >
      {entries.map(([key, v]) => {
        const isSelected = value === key;
        return (
          <label
            key={key}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[var(--nt-radius-card)] border px-3 py-3 text-sm transition-colors",
              isSelected
                ? "border-[var(--nt-stroke-outstanding-base)] bg-[var(--nt-fill-outstanding-thin)] ring-1 ring-[var(--nt-stroke-outstanding-light)]"
                : "border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] hover:border-[var(--nt-stroke-neutral-trans-4)] hover:bg-[var(--nt-fill-neutral-opaque-1)]",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              checked={isSelected}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--nt-fill-outstanding-base)] focus-visible:outline-none focus-visible:shadow-[var(--nt-outline-active-focus)]"
              disabled={disabled}
              name={radioName}
              onChange={() => onChange(key)}
              type="radio"
              value={key}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "font-mono text-sm font-medium",
                    isSelected
                      ? "text-[var(--nt-text-neutral-primary)]"
                      : "text-[var(--nt-text-neutral-super)]",
                  )}
                >
                  {key}
                </span>
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
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                      isSelected
                        ? "border-[var(--nt-stroke-outstanding-light)] text-[var(--nt-text-colorful-outstanding)]"
                        : "border-[var(--nt-stroke-neutral-trans-3)] text-[var(--nt-text-neutral-tertiary)]",
                    )}
                  >
                    ≥{v.vram_minimum_gb} GB
                  </span>
                )}
              </span>
              {v.description && (
                <span className="mt-1 block text-xs leading-5 text-[var(--nt-text-neutral-tertiary)]">
                  {v.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
};
