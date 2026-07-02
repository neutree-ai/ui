import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelInfoBadges } from "@/domains/model-catalog/components/ModelInfoBadges";
import { useTranslation } from "@/foundation/lib/i18n";
import type { RecipeBase, RecipeVariant } from "@/foundation/recipe/types";

type Props = {
  variants: Record<string, RecipeVariant>;
  base: RecipeBase;
};

const fmt = (v: unknown): string => {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};

const resourceSummary = (
  r: RecipeVariant["resources"] | null | undefined,
): string => {
  if (!r) return "—";
  const parts: string[] = [];
  if (r.cpu != null) parts.push(`${r.cpu} CPU`);
  if (r.memory != null) parts.push(`${r.memory} GiB`);
  if (r.gpu != null) parts.push(`${r.gpu} GPU`);
  if (r.accelerator)
    parts.push(`${r.accelerator.type}/${r.accelerator.product}`);
  return parts.length ? parts.join(" · ") : "—";
};

/**
 * Render an engine_args diff between base and the variant override.
 * Only keys that differ are shown; values are rendered as compact JSON.
 */
const argsDiff = (
  base: Record<string, unknown> | null | undefined,
  override: Record<string, unknown> | null | undefined,
): Array<{ key: string; from: string; to: string }> => {
  if (!override) return [];
  const out: Array<{ key: string; from: string; to: string }> = [];
  for (const [k, v] of Object.entries(override)) {
    const before = base?.[k];
    if (fmt(before) !== fmt(v)) {
      out.push({ key: k, from: fmt(before), to: fmt(v) });
    }
  }
  return out;
};

export const VariantTable = ({ variants, base }: Props) => {
  const { t } = useTranslation();
  const entries = Object.entries(variants);
  if (entries.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("model_catalogs.recipe.variants", "Variants")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-4 font-medium">
                  {t("model_catalogs.recipe.variantKey", "Variant")}
                </th>
                <th className="py-2 pr-4 font-medium">
                  {t("common.fields.description", "Description")}
                </th>
                <th className="py-2 pr-4 font-medium">
                  {t("common.fields.model", "Model")}
                </th>
                <th className="py-2 pr-4 font-medium">
                  {t("model_catalogs.modelInfo.title", "Model info")}
                </th>
                <th className="py-2 pr-4 font-medium">
                  {t("common.fields.resources", "Resources")}
                </th>
                <th className="py-2 pr-4 font-medium">
                  {t("model_catalogs.recipe.vramMin", "Min VRAM")}
                </th>
                <th className="py-2 pr-4 font-medium">
                  {t("model_catalogs.recipe.argsOverrides", "Args overrides")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, v]) => {
                const diffs = argsDiff(
                  base.engine_args ?? null,
                  v.engine_args ?? null,
                );
                return (
                  <tr key={key} className="border-b align-top">
                    <td className="py-2 pr-4">
                      <Badge variant="secondary" className="font-mono">
                        {key}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {v.description || "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs break-all">
                      {v.model?.name || "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {v.model?.info ? (
                        <ModelInfoBadges info={v.model.info} variant="inline" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {resourceSummary(v.resources)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {v.vram_minimum_gb != null
                        ? `≥${v.vram_minimum_gb} GB`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {diffs.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-1">
                          {diffs.map((d) => (
                            <div
                              key={d.key}
                              className="font-mono text-xs leading-snug"
                            >
                              <span className="font-medium">{d.key}</span>
                              {d.from ? (
                                <>
                                  {": "}
                                  <span className="line-through text-muted-foreground">
                                    {d.from}
                                  </span>
                                  {" → "}
                                </>
                              ) : (
                                ": "
                              )}
                              <span>{d.to}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
