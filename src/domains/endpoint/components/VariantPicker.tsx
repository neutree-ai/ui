import { Star } from "lucide-react";
import { useId } from "react";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { DEFAULT_VARIANT } from "@/foundation/recipe/normalize";
import type { RecipeVariant } from "@/foundation/recipe/types";

type Props = {
  variants: Record<string, RecipeVariant>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  layout?: "compact" | "radio";
};

// Legacy forms use the compact segmented view switch. The deployment wizard
// presents Variant as a form value, so it uses native radio rows instead.
export const VariantPicker = ({
  variants,
  value,
  onChange,
  disabled,
  layout = "compact",
}: Props) => {
  const { t } = useTranslation();
  const groupName = useId();
  const entries = Object.entries(variants);
  if (entries.length === 0) return null;

  if (layout === "radio") {
    return (
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label={t("endpoints.recipe.selectVariant", "Select a variant")}
      >
        {entries.map(([key, v]) => {
          const selected = key === value;
          return (
            <label
              key={key}
              className={cn(
                "flex min-w-0 items-start gap-3 rounded-[var(--nt-radius-card)] border bg-[var(--nt-fill-neutral-white)] px-3 py-2.5 text-left transition-colors",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                selected
                  ? "border-[var(--nt-stroke-outstanding-base)] bg-[var(--nt-fill-outstanding-thin)]"
                  : "border-[var(--nt-stroke-neutral-trans-2)]",
                !selected &&
                  !disabled &&
                  "hover:border-[var(--nt-stroke-outstanding-light)] hover:bg-[var(--nt-fill-outstanding-thin)]",
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={key}
                checked={selected}
                disabled={disabled}
                aria-label={key}
                onChange={() => onChange(key)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 [transition:border-color_var(--nt-motion-fast)]",
                  "peer-focus-visible:[outline:2px_solid_var(--nt-stroke-outstanding-base)] peer-focus-visible:[outline-offset:2px]",
                  selected
                    ? "border-[var(--nt-stroke-outstanding-base)]"
                    : "border-[var(--nt-stroke-neutral-trans-4)]",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full bg-[var(--nt-fill-outstanding-base)] transition-transform",
                    selected ? "scale-100" : "scale-0",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold text-[var(--nt-text-neutral-super)]">
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
                    <span className="text-[10px] font-normal text-[var(--nt-text-neutral-tertiary)]">
                      ≥{v.vram_minimum_gb} GB
                    </span>
                  )}
                </span>
                {v.model?.registry && (
                  <span className="mt-1 block truncate font-mono text-[10px] text-[var(--nt-text-neutral-tertiary)]">
                    {v.model.registry}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

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
