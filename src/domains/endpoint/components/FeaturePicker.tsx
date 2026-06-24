import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
 * SuggestInput is a compact "pick a preset or type your own" combobox for input
 * features that declare `suggestions` — a shadcn-style Popover + Command where
 * the search box doubles as the free-input (Enter / "Use …" commits a custom
 * value), and the list offers the presets.
 */
function SuggestInput({
  value,
  suggestions,
  numeric,
  placeholder,
  disabled,
  ariaLabel,
  onCommit,
}: {
  value: string;
  suggestions: string[];
  numeric: boolean;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  const matches = trimmed
    ? suggestions.filter((s) => s.includes(trimmed))
    : suggestions;
  const showCustom = trimmed !== "" && !suggestions.includes(trimmed);

  const commit = (v: string) => {
    onCommit(v);
    setOpen(false);
    setDraft("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          // biome-ignore lint/a11y/useSemanticElements: shadcn combobox pattern
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className="h-9 w-44 shrink-0 justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder || ""}
          </span>
          <ChevronsUpDown className="ml-2 size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={draft}
            onValueChange={setDraft}
            inputMode={numeric ? "numeric" : "text"}
            placeholder={placeholder ?? "Type or pick…"}
            className="h-9"
          />
          <CommandList>
            {showCustom && (
              <CommandGroup>
                <CommandItem value={`__use__${trimmed}`} onSelect={() => commit(trimmed)}>
                  Use “{trimmed}”
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {matches.map((s) => (
                <CommandItem key={s} value={s} onSelect={() => commit(s)}>
                  {s}
                  <Check
                    className={cn(
                      "ml-auto size-4",
                      value === s ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
        {f.display_name ? (
          <>
            <span className="text-sm font-medium">{f.display_name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {key}
            </span>
          </>
        ) : (
          <span className="font-mono text-sm">{key}</span>
        )}
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
      const numeric = vt === "int" || vt === "number";
      const required = Boolean(f.input?.required);
      const current = byName.get(key)?.value ?? "";
      const suggestions = (f.input?.suggestions ?? []).filter(Boolean);
      const commitValue = (val: string) =>
        setSel(
          key,
          val === "" && !required ? undefined : { name: key, value: val },
        );
      return (
        <div key={key} className="flex items-start justify-between gap-3">
          {renderHeader(key, f, conflict)}
          {suggestions.length > 0 ? (
            <SuggestInput
              ariaLabel={key}
              value={current}
              suggestions={suggestions}
              numeric={numeric}
              placeholder={f.input?.default ?? ""}
              disabled={itemDisabled}
              onCommit={commitValue}
            />
          ) : (
            <Input
              aria-label={key}
              type={numeric ? "number" : "text"}
              value={current}
              placeholder={f.input?.default ?? ""}
              disabled={itemDisabled}
              min={f.input?.min ?? undefined}
              max={f.input?.max ?? undefined}
              onChange={(event) => commitValue(event.target.value)}
              className="h-9 w-44 shrink-0"
            />
          )}
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
