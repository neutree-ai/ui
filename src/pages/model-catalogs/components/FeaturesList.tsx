import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/foundation/lib/i18n";
import type { RecipeFeature } from "@/foundation/recipe/types";

type Props = {
  /** Ordered feature list; grouped into cards by `group` (first-seen order). */
  features: RecipeFeature[];
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

const renderItem = (f: RecipeFeature, t: (k: string, d: string) => string) => {
  const argsSummary = summarize(f.engine_args);
  const envSummary = summarize(f.env);
  const conflicts = f.conflicts_with ?? [];
  return (
    <li key={f.name} className="border-b last:border-b-0 pb-3">
      <div className="flex items-center gap-2 flex-wrap">
        {f.display_name && (
          <span className="text-sm font-medium">{f.display_name}</span>
        )}
        <Badge variant="secondary" className="font-mono">
          {f.name}
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
            {t("model_catalogs.recipe.conflictsWith", "conflicts with")}
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
          <span className="text-muted-foreground">args:</span> {argsSummary}
        </div>
      )}
      {envSummary && (
        <div className="font-mono text-xs mt-1 break-all">
          <span className="text-muted-foreground">env:</span> {envSummary}
        </div>
      )}
    </li>
  );
};

export const FeaturesList = ({ features }: Props) => {
  const { t } = useTranslation();
  const items = (features ?? []).filter((f) => f?.name);
  if (items.length === 0) return null;

  // Group into one card per `group` (first-seen order; items keep list order).
  // Ungrouped features fall under the default "Features" card.
  const groupOrder: string[] = [];
  const grouped = new Map<string, RecipeFeature[]>();
  for (const f of items) {
    const g = f.group ?? "";
    if (!grouped.has(g)) {
      grouped.set(g, []);
      groupOrder.push(g);
    }
    grouped.get(g)?.push(f);
  }

  return (
    <>
      {groupOrder.map((g) => (
        <Card key={g || "__default__"} className="mt-4">
          <CardHeader>
            <CardTitle>
              {g || t("model_catalogs.recipe.features", "Features")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(grouped.get(g) ?? []).map((f) => renderItem(f, t))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </>
  );
};
