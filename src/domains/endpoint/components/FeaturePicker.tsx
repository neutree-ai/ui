import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/foundation/lib/i18n";
import type { RecipeFeature } from "@/foundation/recipe/types";

type Props = {
  features: Record<string, RecipeFeature>;
  /** Currently enabled feature keys (order matters for compose). */
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

/**
 * FeaturePicker renders one checkbox per recipe feature. A feature is shown as
 * disabled when toggling it on would conflict with another already-enabled
 * feature (based on `conflicts_with` declared on either side).
 */
export const FeaturePicker = ({
  features,
  value,
  onChange,
  disabled,
}: Props) => {
  const { t } = useTranslation();
  const entries = Object.entries(features);
  if (entries.length === 0) return null;

  const enabled = new Set(value);

  // For each feature key, compute whether toggling it on would clash with the
  // current selection. A feature `a` conflicts with `b` if either `a.conflicts_with`
  // includes `b` or `b.conflicts_with` includes `a`.
  const conflictingWithSelection = (key: string): string | null => {
    const f = features[key];
    const fc = new Set(f?.conflicts_with ?? []);
    for (const other of enabled) {
      if (other === key) continue;
      if (fc.has(other)) return other;
      const otherC = new Set(features[other]?.conflicts_with ?? []);
      if (otherC.has(key)) return other;
    }
    return null;
  };

  const toggle = (key: string, on: boolean) => {
    if (on) {
      if (enabled.has(key)) return;
      onChange([...value, key]);
    } else {
      onChange(value.filter((k) => k !== key));
    }
  };

  // Split entries by category: behavior features (no category) and tuning.
  // Stable order within each group: keep YAML iteration order.
  const behaviorEntries = entries.filter(([, f]) => f?.category !== "tuning");
  const tuningEntries = entries.filter(([, f]) => f?.category === "tuning");

  const renderItem = ([key, f]: [string, RecipeFeature]) => {
    const isChecked = enabled.has(key);
    const conflict = !isChecked ? conflictingWithSelection(key) : null;
    const itemDisabled = disabled || (!isChecked && conflict !== null);
    return (
      <div key={key} className="flex items-start gap-3">
        <Checkbox
          id={`feature-${key}`}
          checked={isChecked}
          disabled={itemDisabled}
          onCheckedChange={(checked) => toggle(key, checked === true)}
          className="mt-1"
        />
        <label htmlFor={`feature-${key}`} className="flex-1 cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm">{key}</span>
            {f.default && (
              <Badge variant="outline" className="text-xs">
                {t("endpoints.recipe.defaultOn", "default on")}
              </Badge>
            )}
            {conflict && (
              <span className="text-xs text-destructive">
                {t("endpoints.recipe.conflictsWith", "conflicts with")}{" "}
                <span className="font-mono">{conflict}</span>
              </span>
            )}
          </div>
          {f.description && (
            <div className="text-xs text-muted-foreground">{f.description}</div>
          )}
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {behaviorEntries.length > 0 && (
        <div className="space-y-3">{behaviorEntries.map(renderItem)}</div>
      )}
      {tuningEntries.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("endpoints.recipe.performanceTuning", "Performance tuning")}
          </div>
          {tuningEntries.map(renderItem)}
        </div>
      )}
    </div>
  );
};
