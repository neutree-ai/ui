import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/foundation/lib/i18n";
import type { RecipeFeature } from "@/foundation/recipe/types";

type Props = {
  features: Record<string, RecipeFeature>;
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

const summarize = (m: Record<string, unknown> | null | undefined): string => {
  if (!m) return "";
  return Object.entries(m)
    .map(([k, v]) => `${k}=${fmt(v)}`)
    .join(", ");
};

export const FeaturesList = ({ features }: Props) => {
  const { t } = useTranslation();
  const entries = Object.entries(features);
  if (entries.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("model_catalogs.recipe.features", "Features")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {entries.map(([key, f]) => {
            const argsSummary = summarize(f.engine_args);
            const envSummary = summarize(f.env);
            const conflicts = f.conflicts_with ?? [];
            return (
              <li key={key} className="border-b last:border-b-0 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="font-mono">
                    {key}
                  </Badge>
                  {f.default ? (
                    <Badge variant="default">
                      {t("model_catalogs.recipe.defaultOn", "default on")}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {t("model_catalogs.recipe.optIn", "opt-in")}
                    </Badge>
                  )}
                  {conflicts.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t(
                        "model_catalogs.recipe.conflictsWith",
                        "conflicts with",
                      )}
                      {": "}
                      {conflicts.join(", ")}
                    </span>
                  )}
                </div>
                {f.description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {f.description}
                  </div>
                )}
                {argsSummary && (
                  <div className="font-mono text-xs mt-1 break-all">
                    <span className="text-muted-foreground">args:</span>{" "}
                    {argsSummary}
                  </div>
                )}
                {envSummary && (
                  <div className="font-mono text-xs mt-1 break-all">
                    <span className="text-muted-foreground">env:</span>{" "}
                    {envSummary}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};
