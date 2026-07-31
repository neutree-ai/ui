import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { DEFAULT_VARIANT } from "@/foundation/recipe/normalize";
import type { RecipeVariant } from "@/foundation/recipe/types";

type Props = {
  variants: Record<string, RecipeVariant>;
  selectedVariant: string;
  onSelect: (variant: string) => void;
};

const resourceSummary = (
  r: RecipeVariant["resources"] | null | undefined,
): string => {
  if (!r) return "-";
  const parts: string[] = [];
  if (r.gpu != null) parts.push(`${r.gpu} GPU`);
  if (r.cpu != null) parts.push(`${r.cpu} CPU`);
  if (r.memory != null) parts.push(`${r.memory} GiB`);
  return parts.length ? parts.join(" · ") : "-";
};

export const VariantTable = ({
  variants,
  selectedVariant,
  onSelect,
}: Props) => {
  const { t } = useTranslation();
  const entries = Object.entries(variants);
  if (entries.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)]">
      <Table data-testid="variant-selector-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>
              {t("model_catalogs.recipe.profile", "Profile")}
            </TableHead>
            <TableHead>{t("common.fields.intent", "Intent")}</TableHead>
            <TableHead>{t("common.fields.resources", "Resources")}</TableHead>
            <TableHead>
              {t("model_catalogs.recipe.vramMin", "Min VRAM")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, variant]) => {
            const isSelected = key === selectedVariant;
            return (
              <TableRow
                key={key}
                data-state={isSelected ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => onSelect(key)}
              >
                <TableCell>
                  <input
                    type="radio"
                    aria-label={t(
                      "model_catalogs.recipe.selectProfile",
                      "Select {{profile}} profile",
                      { profile: key },
                    )}
                    checked={isSelected}
                    onChange={() => onSelect(key)}
                    className="size-4 cursor-pointer accent-[var(--nt-fill-outstanding-base)]"
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {key}
                    {key === DEFAULT_VARIANT ? (
                      <span
                        aria-hidden="true"
                        title={t(
                          "model_catalogs.recipe.defaultProfile",
                          "Default profile",
                        )}
                        className="text-[var(--nt-fill-outstanding-base)]"
                      >
                        ★
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="max-w-[360px] text-muted-foreground">
                  {variant.description || "-"}
                </TableCell>
                <TableCell>{resourceSummary(variant.resources)}</TableCell>
                <TableCell
                  className={cn(
                    "whitespace-nowrap",
                    variant.vram_minimum_gb != null && "font-medium",
                  )}
                >
                  {variant.vram_minimum_gb != null
                    ? `≥${variant.vram_minimum_gb} GB`
                    : "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
