import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/foundation/lib/i18n";
import type {
  FeatureSelection,
  RecipeFeature,
} from "@/foundation/recipe/types";
import { cn } from "@/foundation/lib/utils";

type Props = {
  features: Record<string, RecipeFeature>;
  /** Currently selected features, in order (order matters for compose). */
  value: FeatureSelection[];
  onChange: (next: FeatureSelection[]) => void;
  disabled?: boolean;
};

function featureType(f: RecipeFeature): "boolean" | "select" | "input" {
  return f.type && f.type !== "boolean" ? f.type : "boolean";
}

/**
 * FeaturePicker renders one control per recipe feature, switching on the
 * feature's type:
 *   - boolean → a Switch (on/off).
 *   - select  → a radio group over the feature's options (n-choose-1).
 *   - input   → a text/number field for a free value.
 *
 * A feature is shown as disabled when activating it would conflict with an
 * already-active feature (based on `conflicts_with` declared on either side).
 * Selections are emitted in feature-declaration order, which is the compose
 * override order and must match the backend.
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

  const byName = new Map(value.map((s) => [s.name, s] as const));
  const active = new Set(byName.keys());

  // Rebuild the selection array in feature-declaration order from the working
  // map so the emitted order is deterministic (= compose override order).
  const commit = (next: Map<string, FeatureSelection>) => {
    const out: FeatureSelection[] = [];
    for (const [name] of entries) {
      const sel = next.get(name);
      if (sel) out.push(sel);
    }
    onChange(out);
  };

  const setSel = (name: string, sel: FeatureSelection | undefined) => {
    const m = new Map(byName);
    if (sel) m.set(name, sel);
    else m.delete(name);
    commit(m);
  };

  const conflictingWithSelection = (key: string): string | null => {
    const f = features[key];
    const fc = new Set(f?.conflicts_with ?? []);
    for (const other of active) {
      if (other === key) continue;
      if (fc.has(other)) return other;
      const oc = new Set(features[other]?.conflicts_with ?? []);
      if (oc.has(key)) return other;
    }
    return null;
  };

  const renderHeader = (
    key: string,
    f: RecipeFeature,
    conflict: string | null,
  ) => (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm">{key}</span>
        {f.default && featureType(f) === "boolean" && (
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
    </div>
  );

  const renderItem = ([key, f]: [string, RecipeFeature]) => {
    const type = featureType(f);
    const isActive = active.has(key);
    const conflict = !isActive ? conflictingWithSelection(key) : null;
    const itemDisabled = disabled || (!isActive && conflict !== null);

    if (type === "select") {
      const selectedOpt = byName.get(key)?.value ?? "";
      const options = Object.entries(f.options ?? {});
      return (
        <div key={key} className="space-y-2">
          {renderHeader(key, f, conflict)}
          <div
            role="radiogroup"
            aria-label={key}
            className="flex flex-wrap gap-2"
          >
            {options.map(([optKey, opt]) => {
              const selected = selectedOpt === optKey;
              return (
                <button
                  key={optKey}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={itemDisabled}
                  onClick={() =>
                    setSel(
                      key,
                      selected ? undefined : { name: key, value: optKey },
                    )
                  }
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-input hover:bg-accent/40",
                    itemDisabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="font-mono">{optKey}</span>
                  {opt.description && (
                    <div className="text-xs text-muted-foreground">
                      {opt.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (type === "input") {
      const vt = f.input?.value_type ?? "string";
      const required = Boolean(f.input?.required);
      const current = byName.get(key)?.value ?? "";
      return (
        <div key={key} className="flex items-start justify-between gap-3">
          {renderHeader(key, f, conflict)}
          <Input
            aria-label={key}
            type={vt === "int" || vt === "number" ? "number" : "text"}
            value={current}
            placeholder={f.input?.default ?? ""}
            disabled={itemDisabled}
            min={f.input?.min ?? undefined}
            max={f.input?.max ?? undefined}
            onChange={(event) => {
              const val = event.target.value;
              setSel(
                key,
                val === "" && !required ? undefined : { name: key, value: val },
              );
            }}
            className="h-9 w-44 shrink-0"
          />
        </div>
      );
    }

    return (
      <div key={key} className="flex items-start justify-between gap-3">
        {renderHeader(key, f, conflict)}
        <Switch
          aria-label={key}
          checked={isActive}
          disabled={itemDisabled}
          onCheckedChange={(on) => setSel(key, on ? { name: key } : undefined)}
          className="mt-0.5 shrink-0"
        />
      </div>
    );
  };

  const behaviorEntries = entries.filter(([, f]) => f?.category !== "tuning");
  const tuningEntries = entries.filter(([, f]) => f?.category === "tuning");

  return (
    <div className="space-y-5">
      {behaviorEntries.length > 0 && (
        <div className="space-y-4">{behaviorEntries.map(renderItem)}</div>
      )}
      {tuningEntries.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("endpoints.recipe.performanceTuning", "Performance tuning")}
          </div>
          {tuningEntries.map(renderItem)}
        </div>
      )}
    </div>
  );
};
